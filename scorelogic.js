import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    doc,
    writeBatch,
    where
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: 'AIzaSyCe0FsT02jnf0zmxW58rqVl--IFZG3EzEo',
    authDomain: 'class-behavior.firebaseapp.com',
    projectId: 'class-behavior',
    storageBucket: 'class-behavior.firebasestorage.app',
    messagingSenderId: '898970121463',
    appId: '1:898970121463:web:15768abb68a9d23da9cff2',
    measurementId: 'G-5QJP72E58S'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let students = [];
let currentStudentId = null;
let currentFilter = 'all';
let behaviorCounts = {};
let unsubscribeBehaviors = null;

const behaviors = {
    'helped friends': 'positive',
    'disrupted class': 'negative',
    'completed work': 'positive',
    'stayed focused': 'positive',
    participated: 'positive'
};

document.addEventListener('DOMContentLoaded', () => {
    initUI();

    signInAnonymously(auth).catch((err) => {
        console.error('Anonymous sign-in failed:', err);
        const loading = document.getElementById('loading');
        if (err && err.code === 'auth/configuration-not-found') {
            const projectId = firebaseConfig && firebaseConfig.projectId ? firebaseConfig.projectId : '';
            const consoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
            if (loading) {
                loading.textContent = 'Anonymous sign-in is disabled for this Firebase project. Enable it in Firebase Console: ' + consoleUrl;
            }
        } else if (loading) {
            loading.textContent = 'Anonymous sign-in failed. See console for details.';
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('Signed in anonymously as', user.uid);
            loadStudents();
            setupRealtimeUpdates(currentFilter);
        } else {
            console.warn('No authenticated user yet');
        }
    });
});

function initUI() {
    const addBtn = document.getElementById('addStudentButton');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addStudent();
        });
    }

    const nameInput = document.getElementById('newStudentName');
    if (nameInput) {
        nameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addStudent();
            }
        });
    }

    document.querySelectorAll('.history-controls .btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter || 'all';
            filterBehaviors(filter);
        });
    });

    const toggleHistoryBtn = document.getElementById('toggleHistory');
    const historyList = document.getElementById('historyList');
    if (toggleHistoryBtn && historyList) {
        toggleHistoryBtn.addEventListener('click', () => {
            historyList.classList.toggle('hidden');
            toggleHistoryBtn.textContent = historyList.classList.contains('hidden') ? 'Expand' : 'Collapse';
        });
    }

    const studentsGrid = document.getElementById('studentsGrid');
    if (studentsGrid) {
        studentsGrid.addEventListener('click', (event) => {
            const behaviorButton = event.target.closest('.behavior-button');
            if (behaviorButton) {
                const studentId = behaviorButton.dataset.studentId;
                const behaviorName = behaviorButton.dataset.behaviorName;
                recordBehavior(studentId, behaviorName);
                return;
            }

            const deleteButton = event.target.closest('[data-delete-student-id]');
            if (deleteButton) {
                deleteStudent(deleteButton.dataset.deleteStudentId);
                return;
            }

            const card = event.target.closest('.student-card');
            if (card) {
                selectStudent(card.dataset.studentId);
            }
        });
    }
}

async function loadStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, 'students'));
        students = [];
        querySnapshot.forEach((docSnap) => {
            students.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        renderDashboard();
    } catch (error) {
        console.error('Error loading students:', error);
        const loading = document.getElementById('loading');
        if (loading) loading.textContent = 'Error loading students. Check console.';
    }
}

async function addStudent() {
    const nameInput = document.getElementById('newStudentName');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        alert('Please enter a student name');
        return;
    }

    try {
        const docRef = await addDoc(collection(db, 'students'), {
            name,
            createdAt: new Date()
        });

        students.push({
            id: docRef.id,
            name,
            createdAt: new Date()
        });

        if (nameInput) nameInput.value = '';
        renderDashboard();
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Error adding student. Check console.');
    }
}

async function recordBehavior(studentId, behaviorName) {
    const type = behaviors[behaviorName];

    if (!type) {
        console.error('Unknown behavior:', behaviorName);
        return;
    }

    try {
        await addDoc(collection(db, 'behaviors'), {
            studentId,
            behavior: behaviorName,
            timestamp: new Date()
        });

        triggerBackgroundFlash(type);
        playSound(type === 'positive' ? 'up' : 'down');
    } catch (error) {
        console.error('Error recording behavior:', error);
        alert('Error recording behavior. Check console.');
    }
}

function renderDashboard() {
    const loadingEl = document.getElementById('loading');
    const studentsContainerEl = document.getElementById('studentsContainer');
    const behaviorHistoryEl = document.getElementById('behaviorHistory');
    if (loadingEl) loadingEl.style.display = 'none';
    if (studentsContainerEl) studentsContainerEl.style.display = 'block';
    if (behaviorHistoryEl) behaviorHistoryEl.style.display = 'block';

    const studentsGrid = document.getElementById('studentsGrid');
    if (!studentsGrid) return;

    studentsGrid.innerHTML = students.map((student) => {
        const score = student.score || 0;
        const scoreClass = score < 0 ? 'negative' : score > 0 ? 'positive' : 'zero';
        const behaviorButtons = Object.entries(behaviors).map(([name, type]) => `
            <button
                class="btn btn-${type} behavior-button"
                data-student-id="${student.id}"
                data-behavior-name="${name}"
            >
                ${name}
            </button>
        `).join('');

        return `
            <div class="student-card ${currentStudentId === student.id ? 'active' : ''}" data-student-id="${student.id}">
                <div class="student-name">
                    <span class="student-name-label">${student.name}</span>
                    <span class="student-controls">
                        <span class="student-count ${scoreClass}">${score}</span>
                        <button class="btn btn-delete" data-delete-student-id="${student.id}">X</button>
                    </span>
                </div>

                <div class="behavior-buttons hidden" id="behaviors-${student.id}">
                    ${behaviorButtons}
                </div>
            </div>
        `;
    }).join('');
}

function selectStudent(studentId) {
    currentStudentId = studentId;
    document.querySelectorAll('.student-card').forEach((card) => {
        card.classList.toggle('active', card.dataset.studentId === studentId);
    });
    toggleBehaviors(studentId);
}

function toggleBehaviors(studentId) {
    document.querySelectorAll('.behavior-buttons').forEach((el) => {
        el.classList.add('hidden');
    });

    const behaviorContainer = document.getElementById(`behaviors-${studentId}`);
    if (!behaviorContainer) return;

    behaviorContainer.classList.remove('hidden');
    behaviorContainer.classList.add('animate');
    behaviorContainer.addEventListener('animationend', () => {
        behaviorContainer.classList.remove('animate');
    }, { once: true });
}

function setupRealtimeUpdates(filter = 'all') {
    currentFilter = filter;

    if (unsubscribeBehaviors) {
        unsubscribeBehaviors();
        unsubscribeBehaviors = null;
    }

    let q = query(collection(db, 'behaviors'), orderBy('timestamp', 'desc'));

    if (filter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        q = query(collection(db, 'behaviors'), where('timestamp', '>=', today), orderBy('timestamp', 'desc'));
    }

    unsubscribeBehaviors = onSnapshot(q, (querySnapshot) => {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        historyList.innerHTML = '';

        const openBehaviorIds = Array.from(document.querySelectorAll('.behavior-buttons:not(.hidden)')).map((el) => el.id);
        const docs = querySnapshot.docs;
        behaviorCounts = {};

        docs.forEach((docSnap) => {
            const data = docSnap.data();
            const student = students.find((s) => s.id === data.studentId);
            const behaviorType = behaviors[data.behavior];
            if (!data || !data.studentId || !student || !behaviorType) return;
            if (filter === 'positive' && behaviorType !== 'positive') return;
            if (filter === 'negative' && behaviorType !== 'negative') return;

            behaviorCounts[data.studentId] = (behaviorCounts[data.studentId] || 0) + (behaviorType === 'positive' ? 1 : -1);
        });

        students.forEach((student) => {
            student.score = behaviorCounts[student.id] || 0;
        });

        docs.forEach((docSnap) => {
            const data = docSnap.data();
            const student = students.find((s) => s.id === data.studentId);
            const behaviorType = behaviors[data.behavior];
            if (!student || !behaviorType) return;
            if (filter === 'positive' && behaviorType !== 'positive') return;
            if (filter === 'negative' && behaviorType !== 'negative') return;

            const item = document.createElement('div');
            item.className = 'behavior-item';
            item.innerHTML = `
                <span>
                    <strong>${student.name}</strong> ${data.behavior}
                </span>
                <span class="timestamp ${behaviorType === 'positive' ? 'behavior-positive' : 'behavior-negative'}">
                    ${data.timestamp.toDate().toLocaleString()}
                </span>
            `;
            historyList.appendChild(item);
        });

        renderDashboard();

        openBehaviorIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
    }, (err) => {
        console.error('Realtime snapshot error:', err);
        const loading = document.getElementById('loading');
        if (loading) {
            loading.textContent = 'Realtime error: ' + (err && err.message ? err.message : String(err));
        }
    });
}

function filterBehaviors(filterType) {
    setupRealtimeUpdates(filterType);
}

function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'up') {
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } else {
            oscillator.frequency.value = 400;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        }
    } catch (e) {
        // No audio available, continue silently.
    }
}

function triggerBackgroundFlash(type) {
    const body = document.body;
    const flashClass = type === 'positive' ? 'flash-positive' : 'flash-negative';

    body.classList.add(flashClass);
    setTimeout(() => {
        body.classList.remove(flashClass);
    }, 1000);
}

async function deleteStudent(studentId) {
    if (!confirm('Delete this student and their behavior history?')) {
        return;
    }

    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'students', studentId));

        const q = query(collection(db, 'behaviors'), where('studentId', '==', studentId));
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
            batch.delete(doc(db, 'behaviors', docSnap.id));
        });

        await batch.commit();

        students = students.filter((s) => s.id !== studentId);
        if (currentStudentId === studentId) currentStudentId = null;
        renderDashboard();
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Could not delete student. Check console.');
    }
}

window.addStudent = addStudent;
window.selectStudent = selectStudent;
window.recordBehavior = recordBehavior;
window.deleteStudent = deleteStudent;
window.filterBehaviors = filterBehaviors;
window.toggleBehaviors = toggleBehaviors;
