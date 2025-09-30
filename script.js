import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, get, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyALhWs0vz-ZG84KWXXdF8CoMZu6b6zFuDQ",
    authDomain: "checklist-3aaa2.firebaseapp.com",
    databaseURL: "https://checklist-3aaa2-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "checklist-3aaa2",
    storageBucket: "checklist-3aaa2.appspot.com",
    messagingSenderId: "315001625337",
    appId: "1:315001625337:web:10d087a6c1440437166028",
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
const checklistList = document.getElementById("checklist-list");
const checklistItems = document.getElementById("checklist-items");
const currentChecklistDisplay = document.getElementById("current-checklist-display");
const currentChecklistName = document.getElementById("current-checklist-name");
const toggleChecklistBtn = document.getElementById("toggle-checklist-btn");

let currentChecklistId = null;
let isChecklistListOpen = false;

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
        loadChecklists(true); // Vždy otevřít seznam checklistů po přihlášení
        toggleChecklistList(true); // Explicitně otevřít seznam checklistů
    } else {
        console.log("Uživatel odhlášen");
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        contactInfo.style.display = "block";
        taskControls.style.display = "none";
        checklistControls.style.display = "none";
        checklistList.innerHTML = "";
        checklistItems.innerHTML = "";
        currentChecklistId = null;
        currentChecklistDisplay.style.display = "none";
        isChecklistListOpen = false;
        checklistList.classList.remove('show');
        toggleChecklistBtn.textContent = '▶';
    }
});

async function createNewChecklist() {
    const checklistName = prompt("Zadejte název nového checklistu:");
    if (!checklistName || checklistName.trim() === "") {
        alert("Název checklistu nemůže být prázdný!");
        return;
    }
    const checklistsRef = ref(database, `checklist/metadata`);
    const snapshot = await get(checklistsRef);
    const checklists = snapshot.val() || {};
    const orders = Object.values(checklists).map(c => c.order || 0);
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    const newOrder = maxOrder + 1;
    const checklistId = `checklist-${Date.now()}`;
    const checklistRef = ref(database, `checklist/metadata/${checklistId}`);
    console.log("Vytvářím nový checklist:", checklistId, checklistName);
    set(checklistRef, { name: checklistName.trim(), order: newOrder })
        .then(() => {
            console.log("Checklist úspěšně vytvořen:", checklistId);
            switchChecklist(checklistId);
            loadChecklists();
        })
        .catch(err => {
            console.error("Chyba při vytváření checklistu:", err);
            alert("Chyba při vytváření checklistu: " + err.message);
        });
}

function renameChecklist(checklistId) {
    if (!checklistId) {
        alert("Není vybrán žádný checklist k přejmenování!");
        return;
    }
    const currentName = document.querySelector(`#checklist-list li[data-id="${checklistId}"] span`).textContent;
    const newName = prompt("Zadejte nový název checklistu:", currentName);
    if (!newName || newName.trim() === "") {
        alert("Název checklistu nemůže být prázdný!");
        return;
    }
    const checklistRef = ref(database, `checklist/metadata/${checklistId}`);
    console.log("Přejmenovávám checklist:", checklistId, "na:", newName);
    update(checklistRef, { name: newName.trim() })
        .then(() => {
            console.log("Checklist úspěšně přejmenován:", checklistId);
            loadChecklists();
        })
        .catch(err => {
            console.error("Chyba při přejmenování checklistu:", err);
            alert("Chyba při přejmenování checklistu: " + err.message);
        });
}

function deleteChecklist(checklistId) {
    if (!checklistId) {
        alert("Není vybrán žádný checklist k smazání!");
        return;
    }
    const currentName = document.querySelector(`#checklist-list li[data-id="${checklistId}"] span`).textContent;
    if (!confirm(`Opravdu chcete smazat checklist '${currentName}'?`)) {
        return;
    }
    const checklistRef = ref(database, `checklist/${checklistId}`);
    const metadataRef = ref(database, `checklist/metadata/${checklistId}`);
    console.log("Mažu checklist:", checklistId);
    Promise.all([
        remove(checklistRef),
        remove(metadataRef)
    ])
        .then(() => {
            console.log("Checklist úspěšně smazán:", checklistId);
            if (currentChecklistId === checklistId) {
                currentChecklistId = null;
                checklistItems.innerHTML = "";
            }
            loadChecklists(true); // Otevřít seznam po smazání, aby uživatel mohl vybrat jiný
        })
        .catch(err => {
            console.error("Chyba při mazání checklistu:", err);
            alert("Chyba při mazání checklistu: " + err.message);
        });
}

function switchChecklist(checklistId) {
    if (checklistId === "") {
        console.log("Žádný checklist nevybrán");
        currentChecklistId = null;
        checklistItems.innerHTML = "";
        toggleChecklistList(false); // Sbalit seznam po výběru
        updateCurrentDisplay();
        return;
    }
    console.log("Přepínám na checklist:", checklistId);
    currentChecklistId = checklistId;
    loadTasks();
    loadChecklists();
    toggleChecklistList(false); // Sbalit seznam po výběru
    updateCurrentDisplay();
}

function loadChecklists(openList = false) {
    const checklistsRef = ref(database, `checklist/metadata`);
    console.log("Načítám checklisty");
    onValue(checklistsRef, snapshot => {
        checklistList.innerHTML = '';
        if (snapshot.exists()) {
            const checklists = [];
            snapshot.forEach(childSnapshot => {
                const checklistId = childSnapshot.key;
                const checklistData = childSnapshot.val();
                checklists.push({ id: checklistId, name: checklistData.name, order: checklistData.order || 0 });
            });
            checklists.sort((a, b) => a.order - b.order);
            checklists.forEach(checklist => {
                const li = document.createElement('li');
                li.dataset.id = checklist.id;
                li.className = checklist.id === currentChecklistId ? 'current' : '';
                li.innerHTML = `
                    <span onclick="switchChecklist('${checklist.id}')">${checklist.name}</span>
                    <button class="edit-btn" onclick="renameChecklist('${checklist.id}')">Přejmenovat</button>
                    <button class="delete-btn" onclick="deleteChecklist('${checklist.id}')">Smazat</button>
                `;
                checklistList.appendChild(li);
            });
            if (!checklistList.sortable) {
                checklistList.sortable = new Sortable(checklistList, {
                    animation: 150,
                    onEnd: updateChecklistOrder
                });
            }
            // Automaticky vybrat první checklist, pokud není žádný vybrán
            if (!currentChecklistId && checklists.length > 0) {
                currentChecklistId = checklists[0].id;
                loadTasks();
            }
            updateCurrentDisplay();
            // Otevřít seznam checklistů, pokud je openList true
            toggleChecklistList(openList);
        } else {
            currentChecklistId = null;
            checklistItems.innerHTML = "";
            currentChecklistDisplay.style.display = "none";
            toggleChecklistList(true); // Otevřít seznam, pokud neexistují checklisty
        }
    }, err => {
        console.error("Chyba při načítání checklistů:", err);
    });
}

function updateCurrentDisplay() {
    if (currentChecklistId) {
        const currentLi = document.querySelector(`#checklist-list li[data-id="${currentChecklistId}"]`);
        if (currentLi) {
            currentChecklistName.textContent = currentLi.querySelector('span').textContent;
            currentChecklistDisplay.style.display = "flex";
        } else {
            currentChecklistDisplay.style.display = "none";
        }
    } else {
        currentChecklistDisplay.style.display = "none";
    }
}

function toggleChecklistList(force = null) {
    isChecklistListOpen = force !== null ? force : !isChecklistListOpen;
    if (isChecklistListOpen) {
        checklistList.classList.add('show');
        toggleChecklistBtn.textContent = '▼';
    } else {
        checklistList.classList.remove('show');
        toggleChecklistBtn.textContent = '▶';
    }
}

async function updateChecklistOrder() {
    const items = Array.from(checklistList.children);
    const updates = {};
    items.forEach((item, index) => {
        const id = item.dataset.id;
        updates[`checklist/metadata/${id}/order`] = index;
    });
    try {
        await update(ref(database), updates);
        console.log("Pořadí checklistů aktualizováno");
    } catch (err) {
        console.error("Chyba při aktualizaci pořadí checklistů:", err);
    }
}

async function addTask() {
    console.log("Spouštím addTask, currentChecklistId:", currentChecklistId);
    const newTaskInput = document.getElementById('new-task');
    if (!newTaskInput) {
        console.error("Input s id='new-task' nenalezen!");
        alert("Chyba: Input pro nový úkol nenalezen!");
        return;
    }
    const taskText = newTaskInput.value.trim();
    console.log("Task text:", taskText);
    if (taskText === '' || !currentChecklistId) {
        console.log("Prázdný úkol nebo žádný checklist nevybrán");
        alert("Vyberte checklist nebo zadejte text úkolu!");
        return;
    }
    const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    const snapshot = await get(tasksRef);
    const tasks = snapshot.val() || {};
    const orders = Object.values(tasks).map(t => t.order || 0);
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    const newOrder = maxOrder + 1;
    const newTaskRef = push(tasksRef);
    const newTaskId = newTaskRef.key;
    console.log("Přidávám úkol:", taskText, "do checklistu:", currentChecklistId);
    try {
        await set(newTaskRef, { text: taskText, checked: false, subtasks: {}, order: newOrder });
        console.log("Úkol úspěšně přidán:", newTaskId);
        newTaskInput.value = '';
        loadTasks();
    } catch (err) {
        console.error("Chyba při přidávání úkolu:", err);
        alert("Chyba při přidávání úkolu: " + err.message);
    }
}

function editTask(taskId, currentText) {
    const newText = prompt("Upravit úkol:", currentText);
    if (newText && newText.trim() !== '') {
        const taskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`);
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, text: newText.trim() })
                .catch(err => console.error("Chyba při úpravě úkolu:", err));
        }, { onlyOnce: true });
    }
}

function editSubtask(taskId, subtaskId, currentText) {
    const newText = prompt("Upravit podúkol:", currentText);
    if (newText && newText.trim() !== '') {
        const subtaskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`);
        onValue(subtaskRef, snapshot => {
            const subtaskData = snapshot.val();
            set(subtaskRef, { ...subtaskData, text: newText.trim() })
                .catch(err => console.error("Chyba při úpravě podúkolu:", err));
        }, { onlyOnce: true });
    }
}

async function addSubtask(taskId) {
    console.log("Spouštím addSubtask pro taskId:", taskId);
    const subtaskInput = document.getElementById(`subtask-input-${taskId}`);
    if (!subtaskInput) {
        console.error("Input pro podúkol nenalezen:", `subtask-input-${taskId}`);
        alert("Chyba: Input pro podúkol nenalezen!");
        return;
    }
    const subtaskText = subtaskInput.value.trim();
    console.log("Subtask text:", subtaskText);
    if (subtaskText === '' || !currentChecklistId) {
        console.log("Prázdný podúkol nebo žádný checklist nevybrán");
        alert("Zadejte text podúkolu!");
        return;
    }
    const subtasksRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
    const snapshot = await get(subtasksRef);
    const subtasks = snapshot.val() || {};
    const orders = Object.values(subtasks).map(s => s.order || 0);
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    const newOrder = maxOrder + 1;
    const newSubtaskRef = push(subtasksRef);
    try {
        await set(newSubtaskRef, { text: subtaskText, checked: false, order: newOrder });
        console.log("Podúkol úspěšně přidán");
        subtaskInput.value = '';
        toggleSubtaskMenu(taskId, true);
        loadTasks();
    } catch (err) {
        console.error("Chyba při přidávání podúkolu:", err);
        alert("Chyba při přidávání podúkolu: " + err.message);
    }
}

function deleteTask(taskId) {
    const taskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`);
    console.log("Mažu úkol:", taskId, "z checklistu:", currentChecklistId);
    remove(taskRef).catch(err => console.error("Chyba při mazání úkolu:", err));
}

function deleteSubtask(taskId, subtaskId) {
    const subtaskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`);
    console.log("Mažu podúkol:", subtaskId, "z úkolu:", taskId);
    remove(subtaskRef).catch(err => console.error("Chyba při mazání podúkolu:", err));
}

function toggleSubtaskMenu(taskId, forceOpen = false) {
    const subtaskMenu = document.getElementById(`subtask-menu-${taskId}`);
    if (forceOpen) {
        subtaskMenu.style.display = 'block';
    } else {
        const isHidden = subtaskMenu.style.display === 'none';
        subtaskMenu.style.display = isHidden ? 'block' : 'none';
    }
}

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
        console.log("Snapshot úkolů:", snapshot.val());
        checklistItems.innerHTML = '';
        if (snapshot.exists()) {
            const tasks = [];
            snapshot.forEach(childSnapshot => {
                const taskId = childSnapshot.key;
                const taskData = childSnapshot.val();
                tasks.push({ id: taskId, ...taskData });
            });
            tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
            tasks.forEach(taskData => {
                const taskId = taskData.id;
                const hasSubtasks = taskData.subtasks && Object.keys(taskData.subtasks).length > 0;
                const newItem = document.createElement('div');
                newItem.className = 'checklist-item';
                newItem.dataset.id = taskId;
                newItem.innerHTML = `
                    <div class="task-header">
                        <input type="checkbox" id="${taskId}" ${taskData.checked ? "checked" : ""}>
                        <label for="${taskId}" class="${taskData.checked ? "completed" : ""}">${taskData.text}</label>
                        <button class="edit-btn" data-task-id="${taskId}">Upravit</button>
                        <button class="delete-btn" data-task-id="${taskId}">Smazat</button>
                        <button class="toggle-subtask-btn" data-task-id="${taskId}">${hasSubtasks ? '▼' : '▶'} Podúkoly</button>
                    </div>
                    <div class="subtask-menu" id="subtask-menu-${taskId}" style="display: ${hasSubtasks ? 'block' : 'none'};">
                        <div class="add-subtask" id="add-subtask-${taskId}">
                            <input type="text" id="subtask-input-${taskId}" placeholder="Zadejte nový podúkol">
                            <button class="add-subtask-btn" data-task-id="${taskId}">Přidat podúkol</button>
                        </div>
                        <div class="subtask-list" id="subtask-list-${taskId}"></div>
                    </div>
                `;
                checklistItems.appendChild(newItem);
                setupCheckbox(taskId);

                // Attach event listeners for task buttons
                const editBtn = newItem.querySelector(`.edit-btn[data-task-id="${taskId}"]`);
                const deleteBtn = newItem.querySelector(`.delete-btn[data-task-id="${taskId}"]`);
                const toggleSubtaskBtn = newItem.querySelector(`.toggle-subtask-btn[data-task-id="${taskId}"]`);
                const addSubtaskBtn = newItem.querySelector(`.add-subtask-btn[data-task-id="${taskId}"]`);

                editBtn.addEventListener('click', () => editTask(taskId, taskData.text));
                deleteBtn.addEventListener('click', () => deleteTask(taskId));
                toggleSubtaskBtn.addEventListener('click', () => toggleSubtaskMenu(taskId));
                addSubtaskBtn.addEventListener('click', () => addSubtask(taskId));

                if (taskData.subtasks) {
                    const subtaskList = document.getElementById(`subtask-list-${taskId}`);
                    const subtasks = [];
                    Object.entries(taskData.subtasks).forEach(([subtaskId, subtaskData]) => {
                        subtasks.push({ id: subtaskId, ...subtaskData });
                    });
                    subtasks.sort((a, b) => (a.order || 0) - (b.order || 0));
                    subtasks.forEach(subtaskData => {
                        const subtaskId = subtaskData.id;
                        const subtaskItem = document.createElement('div');
                        subtaskItem.className = 'subtask-item';
                        subtaskItem.dataset.id = subtaskId;
                        subtaskItem.innerHTML = `
                            <input type="checkbox" id="${subtaskId}" ${subtaskData.checked ? "checked" : ""}>
                            <label for="${subtaskId}" class="${subtaskData.checked ? "completed" : ""}">${subtaskData.text}</label>
                            <button class="edit-subtask-btn" data-task-id="${taskId}" data-subtask-id="${subtaskId}">Upravit</button>
                            <button class="delete-subtask-btn" data-task-id="${taskId}" data-subtask-id="${subtaskId}">Smazat</button>
                        `;
                        subtaskList.appendChild(subtaskItem);
                        setupSubtaskCheckbox(taskId, subtaskId);

                        // Attach event listeners for subtask buttons
                        const editSubtaskBtn = subtaskItem.querySelector(`.edit-subtask-btn[data-subtask-id="${subtaskId}"]`);
                        const deleteSubtaskBtn = subtaskItem.querySelector(`.delete-subtask-btn[data-subtask-id="${subtaskId}"]`);
                        editSubtaskBtn.addEventListener('click', () => editSubtask(taskId, subtaskId, subtaskData.text));
                        deleteSubtaskBtn.addEventListener('click', () => deleteSubtask(taskId, subtaskId));
                    });
                    if (!subtaskList.sortable) {
                        subtaskList.sortable = new Sortable(subtaskList, {
                            animation: 150,
                            onEnd: () => updateSubtaskOrder(taskId)
                        });
                    }
                }
            });
            if (!checklistItems.sortable) {
                checklistItems.sortable = new Sortable(checklistItems, {
                    animation: 150,
                    onEnd: updateTaskOrder
                });
            }
        } else {
            console.log("Žádné úkoly v checklistu:", currentChecklistId);
        }
    }, err => {
        console.error("Chyba při načítání úkolů:", err);
    });
}

async function updateTaskOrder() {
    const items = Array.from(checklistItems.children);
    const updates = {};
    items.forEach((item, index) => {
        const id = item.dataset.id;
        updates[`checklist/${currentChecklistId}/tasks/${id}/order`] = index;
    });
    try {
        await update(ref(database), updates);
        console.log("Pořadí úkolů aktualizováno");
    } catch (err) {
        console.error("Chyba při aktualizaci pořadí úkolů:", err);
    }
}

async function updateSubtaskOrder(taskId) {
    const subtaskList = document.getElementById(`subtask-list-${taskId}`);
    const items = Array.from(subtaskList.children);
    const updates = {};
    items.forEach((item, index) => {
        const id = item.dataset.id;
        updates[`checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${id}/order`] = index;
    });
    try {
        await update(ref(database), updates);
        console.log("Pořadí podúkolů aktualizováno pro úkol:", taskId);
    } catch (err) {
        console.error("Chyba při aktualizaci pořadí podúkolů:", err);
    }
}

// Attach event listeners for static buttons
document.addEventListener('DOMContentLoaded', () => {
    const newChecklistBtn = document.getElementById('new-checklist-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const toggleChecklistBtn = document.getElementById('toggle-checklist-btn');

    if (newChecklistBtn) {
        newChecklistBtn.addEventListener('click', createNewChecklist);
    } else {
        console.error("Tlačítko s id='new-checklist-btn' nenalezeno!");
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addTask);
    } else {
        console.error("Tlačítko s id='add-task-btn' nenalezeno!");
    }

    if (toggleChecklistBtn) {
        toggleChecklistBtn.addEventListener('click', () => toggleChecklistList());
    } else {
        console.error("Tlačítko s id='toggle-checklist-btn' nenalezeno!");
    }
});

// Expose functions globally for inline onclick handlers in checklist-list
window.switchChecklist = switchChecklist;
window.renameChecklist = renameChecklist;
window.deleteChecklist = deleteChecklist;    
