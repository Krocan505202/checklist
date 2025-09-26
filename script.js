import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyALhWs0vz-ZG84KWXXdF8CoMZu6b6zFuDQ",
    authDomain: "checklist-3aaa2.firebaseapp.com",
    databaseURL: "https://checklist-3aaa2-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "checklist-3aaa2",
    storageBucket: "checklist-3aaa2.appspot.com",
    messagingSenderId: "315001625337",
    appId: "1:315001625337:web:10d787a6c1440437166028",
    measurementId: "G-CX7TCLZDN3"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const contactInfo = document.getElementById("contact-info");
const taskControls = document.getElementById("task-controls");
const checklistControls = document.getElementById("checklist-controls");
const checklistSelect = document.getElementById("checklist-select");
const checklistItems = document.getElementById("checklist-items");

let currentChecklistId = "automatizace"; // Výchozí je "Automatizace"

loginBtn.onclick = () => {
    signInWithPopup(auth, provider).catch(err => alert("Chyba: " + err.message));
};

logoutBtn.onclick = () => {
    signOut(auth);
};

onAuthStateChanged(auth, user => {
    if (user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userInfo.textContent = "Přihlášen jako: " + user.displayName;
        contactInfo.style.display = "none";
        taskControls.style.display = "block";
        checklistControls.style.display = "block";
        loadChecklists(user.uid);
        loadTasks(); // Načte úkoly pro výchozí checklist ("Automatizace")
    } else {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        contactInfo.style.display = "block";
        taskControls.style.display = "none";
        checklistControls.style.display = "none";
        checklistSelect.innerHTML = '<option value="automatizace">Automatizace</option>';
        checklistItems.innerHTML = "";
        currentChecklistId = "automatizace";
    }
});

window.createNewChecklist = function() {
    const checklistName = prompt("Zadejte název nového checklistu:");
    if (checklistName && checklistName.trim() !== '') {
        const user = auth.currentUser;
        if (!user) return;
        const checklistId = `checklist-${Date.now()}`;
        const checklistRef = ref(database, `checklists/${user.uid}/metadata/${checklistId}`);
        set(checklistRef, { name: checklistName.trim() }).then(() => {
            switchChecklist(checklistId);
        });
    }
};

window.openDailyChecklist = function() {
    const user = auth.currentUser;
    if (!user) return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const checklistId = `daily-${today}`;
    const checklistRef = ref(database, `checklists/${user.uid}/metadata/${checklistId}`);
    onValue(checklistRef, snapshot => {
        if (!snapshot.exists()) {
            set(checklistRef, { name: `Denní - ${today}` });
        }
        switchChecklist(checklistId);
    }, { onlyOnce: true });
};

window.switchChecklist = function(checklistId) {
    if (checklistId === "") return;
    currentChecklistId = checklistId;
    loadTasks();
    updateChecklistSelect();
};

function loadChecklists(userId) {
    const checklistsRef = ref(database, `checklists/${userId}/metadata`);
    onValue(checklistsRef, snapshot => {
        checklistSelect.innerHTML = '<option value="automatizace">Automatizace</option>';
        snapshot.forEach(childSnapshot => {
            const checklistId = childSnapshot.key;
            const checklistData = childSnapshot.val();
            const option = document.createElement('option');
            option.value = checklistId;
            option.textContent = checklistData.name;
            if (checklistId === currentChecklistId) option.selected = true;
            checklistSelect.appendChild(option);
        });
    });
}

function updateChecklistSelect() {
    Array.from(checklistSelect.options).forEach(option => {
        option.selected = option.value === currentChecklistId;
    });
}

window.addTask = function() {
    const newTaskInput = document.getElementById('new-task');
    const taskText = newTaskInput.value.trim();
    if (taskText === '' || !currentChecklistId) return;

    const user = auth.currentUser;
    if (!user) return;
    let tasksRef;
    if (currentChecklistId === "automatizace") {
        tasksRef = ref(database, 'checklist');
    } else {
        tasksRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks`);
    }
    const newTaskRef = push(tasksRef);
    const newTaskId = newTaskRef.key;

    set(newTaskRef, { text: taskText, checked: false, subtasks: {} });
    newTaskInput.value = '';
};

window.editTask = function(taskId, currentText) {
    const newText = prompt("Upravit úkol:", currentText);
    if (newText && newText.trim() !== '') {
        const user = auth.currentUser;
        if (!user) return;
        let taskRef;
        if (currentChecklistId === "automatizace") {
            taskRef = ref(database, `checklist/${taskId}`);
        } else {
            taskRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks/${taskId}`);
        }
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, text: newText.trim() });
        }, { onlyOnce: true });
    }
};

window.addSubtask = function(taskId) {
    const subtaskInput = document.getElementById(`subtask-input-${taskId}`);
    const subtaskText = subtaskInput.value.trim();
    if (subtaskText === '' || !currentChecklistId) return;

    const user = auth.currentUser;
    if (!user) return;
    let subtaskRef;
    if (currentChecklistId === "automatizace") {
        subtaskRef = ref(database, `checklist/${taskId}/subtasks`);
    } else {
        subtaskRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks/${taskId}/subtasks`);
    }
    const newSubtaskRef = push(subtaskRef);
    set(newSubtaskRef, { text: subtaskText, checked: false });
    subtaskInput.value = '';
};

window.deleteTask = function(taskId) {
    const user = auth.currentUser;
    if (!user) return;
    let taskRef;
    if (currentChecklistId === "automatizace") {
        taskRef = ref(database, `checklist/${taskId}`);
    } else {
        taskRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks/${taskId}`);
    }
    remove(taskRef);
};

window.deleteSubtask = function(taskId, subtaskId) {
    const user = auth.currentUser;
    if (!user) return;
    let subtaskRef;
    if (currentChecklistId === "automatizace") {
        subtaskRef = ref(database, `checklist/${taskId}/subtasks/${subtaskId}`);
    } else {
        subtaskRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`);
    }
    remove(subtaskRef);
};

function setupCheckbox(taskId) {
    const checkbox = document.getElementById(taskId);
    const user = auth.currentUser;
    if (!user) return;
    let taskRef;
    if (currentChecklistId === "automatizace") {
        taskRef = ref(database, `checklist/${taskId}`);
    } else {
        taskRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks/${taskId}`);
    }

    checkbox.addEventListener('change', function() {
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, checked: this.checked });
        }, { onlyOnce: true });
    });
}

function setupSubtaskCheckbox(taskId, subtaskId) {
    const checkbox = document.getElementById(subtaskId);
    const user = auth.currentUser;
    if (!user) return;
    let subtaskRef;
    if (currentChecklistId === "automatizace") {
        subtaskRef = ref(database, `checklist/${taskId}/subtasks/${subtaskId}`);
    } else {
        subtaskRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`);
    }

    checkbox.addEventListener('change', function() {
        onValue(subtaskRef, snapshot => {
            const subtaskData = snapshot.val();
            set(subtaskRef, { ...subtaskData, checked: this.checked });
        }, { onlyOnce: true });
    });
}

function loadTasks() {
    if (!currentChecklistId) {
        checklistItems.innerHTML = '';
        return;
    }
    const user = auth.currentUser;
    if (!user) return;
    let tasksRef;
    if (currentChecklistId === "automatizace") {
        tasksRef = ref(database, 'checklist');
    } else {
        tasksRef = ref(database, `checklists/${user.uid}/${currentChecklistId}/tasks`);
    }
    onValue(tasksRef, snapshot => {
        checklistItems.innerHTML = '';
        snapshot.forEach(childSnapshot => {
            const taskId = childSnapshot.key;
            const taskData = childSnapshot.val();
            const newItem = document.createElement('div');
            newItem.className = 'checklist-item';
            newItem.innerHTML = `
                <div class="task-header">
                    <input type="checkbox" id="${taskId}" ${taskData.checked ? "checked" : ""}>
                    <label for="${taskId}" class="${taskData.checked ? "completed" : ""}">${taskData.text}</label>
                    <button class="edit-btn" onclick="editTask('${taskId}', '${taskData.text}')">Upravit</button>
                    <button class="delete-btn" onclick="deleteTask('${taskId}')">Smazat</button>
                </div>
                <div class="add-subtask">
                    <input type="text" id="subtask-input-${taskId}" placeholder="Zadejte nový podúkol">
                    <button onclick="addSubtask('${taskId}')">Přidat podúkol</button>
                </div>
                <div class="subtask-list" id="subtask-list-${taskId}"></div>
            `;
            checklistItems.appendChild(newItem);
            setupCheckbox(taskId);

            if (taskData.subtasks) {
                const subtaskList = document.getElementById(`subtask-list-${taskId}`);
                Object.entries(taskData.subtasks).forEach(([subtaskId, subtaskData]) => {
                    const subtaskItem = document.createElement('div');
                    subtaskItem.className = 'subtask-item';
                    subtaskItem.innerHTML = `
                        <input type="checkbox" id="${subtaskId}" ${subtaskData.checked ? "checked" : ""}>
                        <label for="${subtaskId}" class="${subtaskData.checked ? "completed" : ""}">${subtaskData.text}</label>
                        <button class="delete-btn" onclick="deleteSubtask('${taskId}', '${subtaskId}')">Smazat</button>
                    `;
                    subtaskList.appendChild(subtaskItem);
                    setupSubtaskCheckbox(taskId, subtaskId);
                });
            }
        });
    });
}
