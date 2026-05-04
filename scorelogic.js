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
                <div class="student-card ${currentStudentId === student.id ? 'active' : ''}" onclick="selectStudent('${student.id}')">
                        <div class="student-name">
                            ${student.name}
                            <button class="btn btn-delete"
                                    onclick="deleteStudent('${student.id}'); event.stopPropagation();">
                                x
                            </button>
                            </div>
                    <div class="behavior-buttons">
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
            renderDashboard();
        }

        // Setup realtime updates for behavior history
        function setupRealtimeUpdates(filter = 'all') {
            currentFilter = filter;
            let q = query(collection(db, 'behaviors'), orderBy('timestamp', 'desc'), limit(40));

            // Apply filters
            if (filter === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                q = query(collection(db, 'behaviors'),
                    where('timestamp', '>=', today),
                    orderBy('timestamp', 'desc'),
                    limit(100));
            }

            onSnapshot(q, (querySnapshot) => {
                const historyList = document.getElementById('historyList');
                historyList.innerHTML = '';

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const student = students.find(s => s.id === data.studentId);
                    const behavior = behaviors.find(b => b.name === data.behavior);

                    if (student && behavior) {
                        // Apply client-side filters for positive/negative
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
