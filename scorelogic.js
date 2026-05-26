    //Firebase SDK 
        const firebaseConfig = {
            apiKey: "AIzaSyCe0FsT02jnf0zmxW58rqVl--IFZG3EzEo",
            authDomain: "class-behavior.firebaseapp.com",
            projectId: "class-behavior",
            storageBucket: "class-behavior.firebasestorage.app",
            messagingSenderId: "898970121463",
            appId: "1:898970121463:web:15768abb68a9d23da9cff2",
            measurementId: "G-5QJP72E58S"
        };

        // Initialize Firebase
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
        import {
        getFirestore,
        collection,
        addDoc,
        getDocs,
        query,
        orderBy,
        limit,
        onSnapshot,
        deleteDoc,
        doc,
        writeBatch,
        where
        } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // Global variables
        let students = [];
        let currentStudentId = null;
        let currentFilter = 'all'; // Track current filter
        let behaviorCounts = {}; // map studentId -> net score (+1 for positive, -1 for negative)

        // Behavior types
        const behaviors = [
            { name: 'helped friends', type: 'positive' },
            { name: 'disrupted class', type: 'negative' },
            { name: 'completed work', type: 'positive' },
            { name: 'stayed focused', type: 'positive' },
            { name: 'participated', type: 'positive' }
        ];

        // Initialize app when page loads
        document.addEventListener('DOMContentLoaded', () => {
            loadStudents();
            setupRealtimeUpdates();
        });

        // Load students from Firebase
        async function loadStudents() {
            try {
                const querySnapshot = await getDocs(collection(db, 'students'));
                students = [];
                querySnapshot.forEach((doc) => {
                    students.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                renderDashboard();
            } catch (error) {
                console.error('Error loading students:', error);
                document.getElementById('loading').textContent = 'Error loading students. Check console.';
            }
        }

        // Add new student
        async function addStudent() {
            const nameInput = document.getElementById('newStudentName');
            const name = nameInput.value.trim();

            if (!name) {
                alert('Please enter a student name');
                return;
            }

            try {
                const docRef = await addDoc(collection(db, 'students'), {
                    name: name,
                    createdAt: new Date()
                });

                students.push({
                    id: docRef.id,
                    name: name,
                    createdAt: new Date()
                });

                nameInput.value = '';
                renderDashboard();
            } catch (error) {
                console.error('Error adding student:', error);
                alert('Error adding student. Check console.');
            }
        }

        // Record behavior
        async function recordBehavior(studentId, behaviorName) {
            try {
                await addDoc(collection(db, 'behaviors'), {
                    studentId: studentId,
                    behavior: behaviorName,
                    timestamp: new Date()
                });

                // Trigger background flash effect
                triggerBackgroundFlash(behaviors.find(b => b.name === behaviorName).type);

                // Play sound effect
                playSound(behaviors.find(b => b.name === behaviorName).type === 'positive' ? 'up' : 'down');

            } catch (error) {
                console.error('Error recording behavior:', error);
                alert('Error recording behavior. Check console.');
            }
        }

        // Render the dashboard
        function renderDashboard() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('studentsContainer').style.display = 'block';
            document.getElementById('behaviorHistory').style.display = 'block';

            const studentsGrid = document.getElementById('studentsGrid');
            studentsGrid.innerHTML = students.map(student => `
                <div class="student-card ${currentStudentId === student.id ? 'active' : ''}" data-student-id="${student.id}" onclick="selectStudent('${student.id}')">
                    <div class="student-name">
                        <span class="student-name-label">${student.name}</span>
                        <span style="display:flex;align-items:center;gap:8px;">
                            
                            <span class="student-count ${(student.score < 0) ? 'negative' : (student.score > 0) ? 'positive' : 'zero'}">${student.score}</span>
                            <button class="btn btn-delete" onclick="deleteStudent('${student.id}'); event.stopPropagation();">x</button>
                        </span>
                    </div>
                    <div class="behavior-buttons hidden" id="behaviors-${student.id}">
                        ${behaviors.map(behavior => `
                            <button class="btn btn-${behavior.type}"
                                    onclick="recordBehavior('${student.id}', '${behavior.name}'); event.stopPropagation();">
                                ${behavior.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        // Select student
        function selectStudent(studentId) {
            currentStudentId = studentId;
            // Manually update active class instead of rerendering
            document.querySelectorAll('.student-card').forEach(card => {
                card.classList.remove('active');
            });
            const activeCard = document.querySelector(`[data-student-id="${studentId}"]`);
            if (activeCard) {
                activeCard.classList.add('active');
            }
            // Also open this card's behavior panel (accordion behavior)
            toggleBehaviors(studentId);
        }

        // Toggle behavior buttons visibility
        function toggleBehaviors(studentId) {
            // Hide all behavior containers
            document.querySelectorAll('.behavior-buttons').forEach(el => {
                el.classList.add('hidden');
            });
            
            // Show only the clicked card's behaviors
            const behaviorContainer = document.getElementById(`behaviors-${studentId}`);
            if (!behaviorContainer) return;
            behaviorContainer.classList.remove('hidden');

            // Trigger the one-time animation for a user-open action
            behaviorContainer.classList.add('animate');
            behaviorContainer.addEventListener('animationend', () => {
                behaviorContainer.classList.remove('animate');
            }, { once: true });
        }

        // Setup realtime updates for behavior history
        function setupRealtimeUpdates(filter = 'all') {
            currentFilter = filter;
            let q = query(collection(db, 'behaviors'), orderBy('timestamp', 'desc'));

            // Apply filters
            if (filter === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                q = query(collection(db, 'behaviors'),
                    where('timestamp', '>=', today),
                    orderBy('timestamp', 'desc'));
            }

            onSnapshot(q, (querySnapshot) => {
                // remember which behavior panels are currently open so we can restore them
                const openBehaviorIds = Array.from(document.querySelectorAll('.behavior-buttons:not(.hidden)')).map(el => el.id);

                const historyList = document.getElementById('historyList');
                historyList.innerHTML = '';

                // Build counts and render history. Use docs array so we can iterate twice.
                const docs = querySnapshot.docs;
                behaviorCounts = {};
                docs.forEach((docSnap) => {
                    const data = docSnap.data();
                    const student = students.find(s => s.id === data.studentId);
                    const behavior = behaviors.find(b => b.name === data.behavior);
                    if (!data || !data.studentId || !student || !behavior) return;
                    if (filter === 'positive' && behavior.type !== 'positive') return;
                    if (filter === 'negative' && behavior.type !== 'negative') return;
                    const delta = behavior.type === 'positive' ? 1 : -1;
                    behaviorCounts[data.studentId] = (behaviorCounts[data.studentId] || 0) + delta;
                });

                // Update each student object with their score
                students.forEach((student) => {
                    student.score = behaviorCounts[student.id] || 0;
                });

                // Now render history (apply filters client-side)
                docs.forEach((docSnap) => {
                    const data = docSnap.data();
                    const student = students.find(s => s.id === data.studentId);
                    const behavior = behaviors.find(b => b.name === data.behavior);

                    if (student && behavior) {
                        if (filter === 'positive' && behavior.type !== 'positive') return;
                        if (filter === 'negative' && behavior.type !== 'negative') return;

                        const item = document.createElement('div');
                        item.className = 'behavior-item';
                        item.innerHTML = `
                            <span>
                                <strong>${student.name}</strong> ${data.behavior}
                            </span>
                            <span class="timestamp ${behavior.type === 'positive' ? 'behavior-positive' : 'behavior-negative'}">
                                ${data.timestamp.toDate().toLocaleString()}
                            </span>
                        `;
                        historyList.appendChild(item);
                    }
                });

                // Update the student dashboard so counters appear next to names
                renderDashboard();

                // restore previously-open panels so UI doesn't collapse when snapshot updates
                if (openBehaviorIds && openBehaviorIds.length) {
                    openBehaviorIds.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.classList.remove('hidden');
                    });
                }
            });
        }

        // Filter behaviors
        function filterBehaviors(filterType) {
            setupRealtimeUpdates(filterType);
        }

        // Sound effects
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
                // No audio available, continue silently
            }
        }

        // Background flash effect
        function triggerBackgroundFlash(type) {
            const body = document.body;
            const flashClass = type === 'positive' ? 'flash-positive' : 'flash-negative';

            // Add flash class
            body.classList.add(flashClass);

            // Remove flash class after 1 second
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

                // Delete student doc
                batch.delete(doc(db, 'students', studentId));

                // Delete related behavior docs
                const q = query(collection(db, 'behaviors'), where('studentId', '==', studentId));
                const snapshot = await getDocs(q);
                snapshot.forEach(docSnap => batch.delete(doc(db, 'behaviors', docSnap.id)));

                await batch.commit();

                // Update local list and UI
                students = students.filter(s => s.id !== studentId);
                if (currentStudentId === studentId) currentStudentId = null;
                renderDashboard();
            } catch (error) {
                console.error('Error deleting student:', error);
                alert('Could not delete student. Check console.');
            }
        }



        // Make functions global so HTML can call them
        window.addStudent = addStudent;
        window.selectStudent = selectStudent;
        window.recordBehavior = recordBehavior;
        window.deleteStudent = deleteStudent;
        window.filterBehaviors = filterBehaviors;
        window.toggleBehaviors = toggleBehaviors;
