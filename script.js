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
const deleteChecklistBtn = document.getElementById("delete-checklist-btn");

let currentChecklistId = null;

loginBtn.onclick = () => {
    signInWithPopup(auth, provider).catch(err => {
        console.error("Chyba přihlášení:", err);
        alert("Chyba přihlášení: " + err.message);
    });
};

logoutBtn.onclick = () => {
    signOut(auth).catch(err => console.error("Chyba odhlášení:", err));
};

onAuthStateChanged(auth, user => {
    if (user) {
        console.log("Uživatel přihlášen:", user.uid);
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userInfo.textContent = "Přihlášen jako: " + user.displayName;
        contactInfo.style.display = "none";
        taskControls.style.display = "block";
        checklistControls.style.display = "block";
        loadChecklists();
    } else {
        console.log("Uživatel odhlášen");
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        contactInfo.style.display = "block";
        taskControls.style.display = "none";
        checklistControls.style.display = "none";
        checklistSelect.innerHTML = '<option value="">Vyberte checklist</option>';
        checklistItems.innerHTML = "";
        currentChecklistId = null;
        deleteChecklistBtn.style.display = "none";
    }
});

window.createNewChecklist = function() {
    const checklistName = prompt("Zadejte název nového checklistu:");
    if (!checklistName || checklistName.trim() === "") {
        alert("Název checklistu nemůže být prázdný!");
        return;
    }
    const checklistId = `checklist-${Date.now()}`;
    const checklistRef = ref(database, `checklist/metadata/${checklistId}`);
    console.log("Vytvářím nový checklist:", checklistId, checklistName);
    set(checklistRef, { name: checklistName.trim() })
        .then(() => {
            console.log("Checklist úspěšně vytvořen:", checklistId);
            switchChecklist(checklistId);
        })
        .catch(err => {
            console.error("Chyba při vytváření checklistu:", err);
            alert("Chyba při vytváření checklistu: " + err.message);
        });
};

window.deleteChecklist = function() {
    if (!currentChecklistId) {
        alert("Není vybrán žádný checklist k smazání!");
        return;
    }
    if (!confirm(`Opravdu chcete smazat checklist '${checklistSelect.selectedOptions[0].text}'?`)) {
        return;
    }
    const checklistRef = ref(database, `checklist/${currentChecklistId}`);
    const metadataRef = ref(database, `checklist/metadata/${currentChecklistId}`);
    console.log("Mažu checklist:", currentChecklistId);
    Promise.all([
        remove(checklistRef),
        remove(metadataRef)
    ])
        .then(() => {
            console.log("Checklist úspěšně smazán:", currentChecklistId);
            currentChecklistId = null;
            checklistItems.innerHTML = "";
            deleteChecklistBtn.style.display = "none";
            checklistSelect.innerHTML = '<option value="">Vyberte checklist</option>';
            loadChecklists();
        })
        .catch(err => {
            console.error("Chyba při mazání checklistu:", err);
            alert("Chyba při mazání checklistu: " + err.message);
        });
};

window.switchChecklist = function(checklistId) {
    if (checklistId === "") {
        console.log("Žádný checklist nevybrán");
        currentChecklistId = null;
        checklistItems.innerHTML = "";
        deleteChecklistBtn.style.display = "none";
        return;
    }
    console.log("Přepínám na checklist:", checklistId);
    currentChecklistId = checklistId;
    deleteChecklistBtn.style.display = "inline-block";
    loadTasks();
    updateChecklistSelect();
};

function loadChecklists() {
    const checklistsRef = ref(database, `checklist/metadata`);
    console.log("Načítám checklisty");
    onValue(checklistsRef, snapshot => {
        checklistSelect.innerHTML = '<option value="">Vyberte checklist</option>';
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const checklistId = childSnapshot.key;
                const checklistData = childSnapshot.val();
                const option = document.createElement('option');
                option.value = checklistId;
                option.textContent = checklistData.name;
                if (checklistId === currentChecklistId) option.selected = true;
                checklistSelect.appendChild(option);
            });
            if (!currentChecklistId) {
                const firstChecklistId = Object.keys(snapshot.val())[0];
                switchChecklist(firstChecklistId);
            }
        } else {
            console.log("Žádné checklisty nenalezeny");
        }
    }, err => {
        console.error("Chyba při načítání checklistů:", err);
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
    if (taskText === '' || !currentChecklistId) {
        console.log("Prázdný úkol nebo žádný checklist nevybrán");
        return;
    }
    const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    const newTaskRef = push(tasksRef);
    const newTaskId = newTaskRef.key;
    console.log("Přidávám úkol:", taskText, "do checklistu:", currentChecklistId);
    set(newTaskRef, { text: taskText, checked: false, subtasks: {} })
        .then(() => {
            newTaskInput.value = '';
        })
        .catch(err => console.error("Chyba při přidávání úkolu:", err));
};

window.editTask = function(taskId, currentText) {
    const newText = prompt("Upravit úkol:", currentText);
    if (newText && newText.trim() !== '') {
        const taskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`);
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, text: newText.trim() })
                .catch(err => console.error("Chyba při úpravě úkolu:", err));
        }, { onlyOnce: true });
    }
};

window.addSubtask = function(taskId) {
    const subtaskInput = document.getElementById(`subtask-input-${taskId}`);
    const subtaskText = subtaskInput.value.trim();
    if (subtaskText === '' || !currentChecklistId) {
        console.log("Prázdný podúkol nebo žádný checklist nevybrán");
        return;
    }
    const subtaskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
    const newSubtaskRef = push(subtaskRef);
    set(newSubtaskRef, { text: subtaskText, checked: false })
        .then(() => {
            subtaskInput.value = '';
        })
        .catch(err => console.error("Chyba při přidávání podúkolu:", err));
};

window.deleteTask = function(taskId) {
    const taskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`);
    console.log("Mažu úkol:", taskId, "z checklistu:", currentChecklistId);
    remove(taskRef).catch(err => console.error("Chyba při mazání úkolu:", err));
};

window.deleteSubtask = function(taskId, subtaskId) {
    const subtaskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`);
    console.log("Mažu podúkol:", subtaskId, "z úkolu:", taskId);
    remove(subtaskRef).catch(err => console.error("Chyba při mazání podúkolu:", err));
};

function setupCheckbox(taskId) {
    const checkbox = document.getElementById(taskId);
    const taskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`);
    checkbox.addEventListener('change', function() {
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, checked: this.checked })
                .catch(err => console.error("Chyba při změně stavu úkolu:", err));
        }, { onlyOnce: true });
    });
}

function setupSubtaskCheckbox(taskId, subtaskId) {
    const checkbox = document.getElementById(subtaskId);
    const subtaskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`);
    checkbox.addEventListener('change', function() {
        onValue(subtaskRef, snapshot => {
            const subtaskData = snapshot.val();
            set(subtaskRef, { ...subtaskData, checked: this.checked })
                .catch(err => console.error("Chyba při změně stavu podúkolu:", err));
        }, { onlyOnce: true });
    });
}

function loadTasks() {
    if (!currentChecklistId) {
        console.log("Žádný checklist nevybrán, čistím seznam úkolů");
        checklistItems.innerHTML = '';
        return;
    }
    const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    console.log("Načítám úkoly pro checklist:", currentChecklistId);
    onValue(tasksRef, snapshot => {
        checklistItems.innerHTML = '';
        if (snapshot.exists()) {
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
        } else {
            console.log("Žádné úkoly v checklistu:", currentChecklistId);
        }
    }, err => {
        console.error("Chyba při načítání úkolů:", err);
    });
}
