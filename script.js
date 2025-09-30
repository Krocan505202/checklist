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
const subchecklistList = document.getElementById("subchecklist-list");
const subchecklistMenu = document.getElementById("subchecklist-menu");
const checklistItems = document.getElementById("checklist-items");
const currentChecklistDisplay = document.getElementById("current-checklist-display");
const currentChecklistName = document.getElementById("current-checklist-name");
const toggleChecklistBtn = document.getElementById("toggle-checklist-btn");
const newSubchecklistBtn = document.getElementById("new-subchecklist-btn");
const subchecklistSelector = document.getElementById("subchecklist-selector");

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
        loadChecklists(true);
        toggleChecklistList(true);
    } else {
        console.log("Uživatel odhlášen");
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        contactInfo.style.display = "block";
        taskControls.style.display = "none";
        checklistControls.style.display = "none";
        checklistList.innerHTML = "";
        subchecklistList.innerHTML = "";
        checklistItems.innerHTML = "";
        subchecklistSelector.style.display = "none";
        currentChecklistId = null;
        currentChecklistDisplay.style.display = "none";
        subchecklistMenu.style.display = "none";
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

async function createNewSubchecklist() {
    if (!currentChecklistId) {
        alert("Nejprve vyberte checklist!");
        return;
    }
    const subchecklistName = prompt("Zadejte název nového podchecklistu:");
    if (!subchecklistName || subchecklistName.trim() === "") {
        alert("Název podchecklistu nemůže být prázdný!");
        return;
    }
    const subchecklistsRef = ref(database, `checklist/${currentChecklistId}/subchecklists`);
    const snapshot = await get(subchecklistsRef);
    const subchecklists = snapshot.val() || {};
    const orders = Object.values(subchecklists).map(s => s.order || 0);
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    const newOrder = maxOrder + 1;
    const newSubchecklistRef = push(subchecklistsRef);
    const subchecklistId = newSubchecklistRef.key;
    console.log("Vytvářím nový podchecklist:", subchecklistId, subchecklistName);
    try {
        await set(newSubchecklistRef, { name: subchecklistName.trim(), order: newOrder });
        console.log("Podchecklist úspěšně vytvořen:", subchecklistId);
        loadSubchecklists();
    } catch (err) {
        console.error("Chyba při vytváření podchecklistu:", err);
        alert("Chyba při vytváření podchecklistu: " + err.message);
    }
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

function renameSubchecklist(subchecklistId) {
    if (!currentChecklistId || !subchecklistId) {
        alert("Není vybrán žádný podchecklist k přejmenování!");
        return;
    }
    const currentName = document.querySelector(`#subchecklist-list li[data-id="${subchecklistId}"] span`).textContent;
    const newName = prompt("Zadejte nový název podchecklistu:", currentName);
    if (!newName || newName.trim() === "") {
        alert("Název podchecklistu nemůže být prázdný!");
        return;
    }
    const subchecklistRef = ref(database, `checklist/${currentChecklistId}/subchecklists/${subchecklistId}`);
    console.log("Přejmenovávám podchecklist:", subchecklistId, "na:", newName);
    update(subchecklistRef, { name: newName.trim() })
        .then(() => {
            console.log("Podchecklist úspěšně přejmenován:", subchecklistId);
            loadSubchecklists();
        })
        .catch(err => {
            console.error("Chyba při přejmenování podchecklistu:", err);
            alert("Chyba při přejmenování podchecklistu: " + err.message);
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
                subchecklistList.innerHTML = "";
                subchecklistMenu.style.display = "none";
                subchecklistSelector.style.display = "none";
            }
            loadChecklists(true);
        })
        .catch(err => {
            console.error("Chyba při mazání checklistu:", err);
            alert("Chyba při mazání checklistu: " + err.message);
        });
}

function deleteSubchecklist(subchecklistId) {
    if (!currentChecklistId || !subchecklistId) {
        alert("Není vybrán žádný podchecklist k smazání!");
        return;
    }
    const currentName = document.querySelector(`#subchecklist-list li[data-id="${subchecklistId}"] span`).textContent;
    if (!confirm(`Opravdu chcete smazat podchecklist '${currentName}'?`)) {
        return;
    }
    const subchecklistRef = ref(database, `checklist/${currentChecklistId}/subchecklists/${subchecklistId}`);
    console.log("Mažu podchecklist:", subchecklistId);
    remove(subchecklistRef)
        .then(() => {
            console.log("Podchecklist úspěšně smazán:", subchecklistId);
            loadSubchecklists();
        })
        .catch(err => {
            console.error("Chyba při mazání podchecklistu:", err);
            alert("Chyba při mazání podchecklistu: " + err.message);
        });
}

function switchChecklist(checklistId) {
    if (checklistId === "") {
        console.log("Žádný checklist nevybrán");
        currentChecklistId = null;
        checklistItems.innerHTML = "";
        subchecklistList.innerHTML = "";
        subchecklistMenu.style.display = "none";
        subchecklistSelector.style.display = "none";
        toggleChecklistList(false);
        updateCurrentDisplay();
        return;
    }
    console.log("Přepínám na checklist:", checklistId);
    currentChecklistId = checklistId;
    loadTasks();
    loadSubchecklists();
    loadChecklists();
    toggleChecklistList(false);
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
            if (!currentChecklistId && checklists.length > 0) {
                currentChecklistId = checklists[0].id;
                loadTasks();
                loadSubchecklists();
            }
            updateCurrentDisplay();
            toggleChecklistList(openList);
            newSubchecklistBtn.style.display = currentChecklistId ? "inline-block" : "none";
        } else {
            currentChecklistId = null;
            checklistItems.innerHTML = "";
            subchecklistList.innerHTML = "";
            subchecklistMenu.style.display = "none";
            subchecklistSelector.style.display = "none";
            currentChecklistDisplay.style.display = "none";
            toggleChecklistList(true);
            newSubchecklistBtn.style.display = "none";
        }
    }, err => {
        console.error("Chyba při načítání checklistů:", err);
    });
}

function loadSubchecklists() {
    if (!currentChecklistId) {
        subchecklistList.innerHTML = "";
        subchecklistMenu.style.display = "none";
        subchecklistSelector.style.display = "none";
        return;
    }
    const subchecklistsRef = ref(database, `checklist/${currentChecklistId}/subchecklists`);
    console.log("Načítám podchecklisty pro checklist:", currentChecklistId);
    onValue(subchecklistsRef, snapshot => {
        subchecklistList.innerHTML = '';
        subchecklistSelector.innerHTML = '<option value="">Hlavní checklist</option>';
        if (snapshot.exists()) {
            subchecklistMenu.style.display = "block";
            subchecklistSelector.style.display = "inline-block";
            const subchecklists = [];
            snapshot.forEach(childSnapshot => {
                const subchecklistId = childSnapshot.key;
                const subchecklistData = childSnapshot.val();
                subchecklists.push({ id: subchecklistId, name: subchecklistData.name, order: subchecklistData.order || 0 });
            });
            subchecklists.sort((a, b) => a.order - b.order);
            subchecklists.forEach(subchecklist => {
                const li = document.createElement('li');
                li.dataset.id = subchecklist.id;
                li.innerHTML = `
                    <span>${subchecklist.name}</span>
                    <button class="edit-subchecklist-btn" onclick="renameSubchecklist('${subchecklist.id}')">Přejmenovat</button>
                    <button class="delete-subchecklist-btn" onclick="deleteSubchecklist('${subchecklist.id}')">Smazat</button>
                `;
                subchecklistList.appendChild(li);
                const option = document.createElement('option');
                option.value = subchecklist.id;
                option.textContent = subchecklist.name;
                subchecklistSelector.appendChild(option);
            });
            if (!subchecklistList.sortable) {
                subchecklistList.sortable = new Sortable(subchecklistList, {
                    animation: 150,
                    onEnd: updateSubchecklistOrder
                });
            }
            subchecklistList.classList.add('show');
        } else {
            subchecklistMenu.style.display = "none";
            subchecklistList.classList.remove('show');
            subchecklistSelector.style.display = "none";
        }
        loadTasks();
    }, err => {
        console.error("Chyba při načítání podchecklistů:", err);
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

async function updateSubchecklistOrder() {
    const items = Array.from(subchecklistList.children);
    const updates = {};
    items.forEach((item, index) => {
        const id = item.dataset.id;
        updates[`checklist/${currentChecklistId}/subchecklists/${id}/order`] = index;
    });
    try {
        await update(ref(database), updates);
        console.log("Pořadí podchecklistů aktualizováno");
    } catch (err) {
        console.error("Chyba při aktualizaci pořadí podchecklistů:", err);
    }
}

async function addTask() {
    console.log("Spouštím addTask, currentChecklistId:", currentChecklistId);
    const newTaskInput = document.getElementById('new-task');
    const subchecklistId = subchecklistSelector.value;
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
    const path = subchecklistId 
        ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks`
        : `checklist/${currentChecklistId}/tasks`;
    const tasksRef = ref(database, path);
    const snapshot = await get(tasksRef);
    const tasks = snapshot.val() || {};
    const orders = Object.values(tasks).map(t => t.order || 0);
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    const newOrder = maxOrder + 1;
    const newTaskRef = push(tasksRef);
    const newTaskId = newTaskRef.key;
    console.log("Přidávám úkol:", taskText, "do:", subchecklistId ? `podchecklistu ${subchecklistId}` : `hlavního checklistu ${currentChecklistId}`);
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

function editTask(taskId, currentText, subchecklistId) {
    const newText = prompt("Upravit úkol:", currentText);
    if (newText && newText.trim() !== '') {
        const path = subchecklistId 
            ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}`
            : `checklist/${currentChecklistId}/tasks/${taskId}`;
        const taskRef = ref(database, path);
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, text: newText.trim() })
                .catch(err => console.error("Chyba při úpravě úkolu:", err));
        }, { onlyOnce: true });
    }
}

function editSubtask(taskId, subtaskId, currentText, subchecklistId) {
    const newText = prompt("Upravit podúkol:", currentText);
    if (newText && newText.trim() !== '') {
        const path = subchecklistId 
            ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}/subtasks/${subtaskId}`
            : `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`;
        const subtaskRef = ref(database, path);
        onValue(subtaskRef, snapshot => {
            const subtaskData = snapshot.val();
            set(subtaskRef, { ...subtaskData, text: newText.trim() })
                .catch(err => console.error("Chyba při úpravě podúkolu:", err));
        }, { onlyOnce: true });
    }
}

async function addSubtask(taskId, subchecklistId) {
    console.log("Spouštím addSubtask pro taskId:", taskId, "subchecklistId:", subchecklistId);
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
    const path = subchecklistId 
        ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}/subtasks`
        : `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`;
    const subtasksRef = ref(database, path);
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

function deleteTask(taskId, subchecklistId) {
    const path = subchecklistId 
        ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}`
        : `checklist/${currentChecklistId}/tasks/${taskId}`;
    const taskRef = ref(database, path);
    console.log("Mažu úkol:", taskId, "z:", subchecklistId ? `podchecklistu ${subchecklistId}` : `hlavního checklistu ${currentChecklistId}`);
    remove(taskRef).catch(err => console.error("Chyba při mazání úkolu:", err));
}

function deleteSubtask(taskId, subtaskId, subchecklistId) {
    const path = subchecklistId 
        ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}/subtasks/${subtaskId}`
        : `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`;
    const subtaskRef = ref(database, path);
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

function setupCheckbox(taskId, subchecklistId) {
    const checkbox = document.getElementById(taskId);
    const path = subchecklistId 
        ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}`
        : `checklist/${currentChecklistId}/tasks/${taskId}`;
    const taskRef = ref(database, path);
    checkbox.addEventListener('change', function() {
        onValue(taskRef, snapshot => {
            const taskData = snapshot.val();
            set(taskRef, { ...taskData, checked: this.checked })
                .catch(err => console.error("Chyba při změně stavu úkolu:", err));
        }, { onlyOnce: true });
    });
}

function setupSubtaskCheckbox(taskId, subtaskId, subchecklistId) {
    const checkbox = document.getElementById(subtaskId);
    const path = subchecklistId 
        ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}/subtasks/${subtaskId}`
        : `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`;
    const subtaskRef = ref(database, path);
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
    console.log("Načítám úkoly pro checklist:", currentChecklistId);
    checklistItems.innerHTML = '';

    // Load main checklist tasks
    const mainTasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    onValue(mainTasksRef, snapshot => {
        if (snapshot.exists()) {
            const tasks = [];
            snapshot.forEach(childSnapshot => {
                const taskId = childSnapshot.key;
                const taskData = childSnapshot.val();
                tasks.push({ id: taskId, ...taskData, subchecklistId: null });
            });
            tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
            renderTasks(tasks);
        }
    }, err => {
        console.error("Chyba při načítání hlavních úkolů:", err);
    });

    // Load subchecklist tasks
    const subchecklistsRef = ref(database, `checklist/${currentChecklistId}/subchecklists`);
    onValue(subchecklistsRef, snapshot => {
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const subchecklistId = childSnapshot.key;
                const subchecklistData = childSnapshot.val();
                const tasksRef = ref(database, `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks`);
                onValue(tasksRef, tasksSnapshot => {
                    if (tasksSnapshot.exists()) {
                        const tasks = [];
                        tasksSnapshot.forEach(taskSnapshot => {
                            const taskId = taskSnapshot.key;
                            const taskData = taskSnapshot.val();
                            tasks.push({ id: taskId, ...taskData, subchecklistId });
                        });
                        tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
                        renderTasks(tasks, subchecklistData.name);
                    }
                }, err => {
                    console.error("Chyba při načítání úkolů podchecklistu:", err);
                });
            });
        }
    }, err => {
        console.error("Chyba při načítání podchecklistů pro úkoly:", err);
    });

    function renderTasks(tasks, subchecklistName = null) {
        tasks.forEach(taskData => {
            const taskId = taskData.id;
            const subchecklistId = taskData.subchecklistId;
            const hasSubtasks = taskData.subtasks && Object.keys(taskData.subtasks).length > 0;
            const newItem = document.createElement('div');
            newItem.className = 'checklist-item';
            newItem.dataset.id = taskId;
            newItem.dataset.subchecklistId = subchecklistId || '';
            let html = '';
            if (subchecklistName) {
                html += `<div class="subchecklist-header"><h4>${subchecklistName}</h4></div>`;
            }
            html += `
                <div class="task-header">
                    <input type="checkbox" id="${taskId}" ${taskData.checked ? "checked" : ""}>
                    <label for="${taskId}" class="${taskData.checked ? "completed" : ""}">${taskData.text}</label>
                    <button class="edit-btn" data-task-id="${taskId}" data-subchecklist-id="${subchecklistId || ''}">Upravit</button>
                    <button class="delete-btn" data-task-id="${taskId}" data-subchecklist-id="${subchecklistId || ''}">Smazat</button>
                    <button class="toggle-subtask-btn" data-task-id="${taskId}">${hasSubtasks ? '▼' : '▶'} Podúkoly</button>
                </div>
                <div class="subtask-menu" id="subtask-menu-${taskId}" style="display: ${hasSubtasks ? 'block' : 'none'};">
                    <div class="add-subtask" id="add-subtask-${taskId}">
                        <input type="text" id="subtask-input-${taskId}" placeholder="Zadejte nový podúkol">
                        <button class="add-subtask-btn" data-task-id="${taskId}" data-subchecklist-id="${subchecklistId || ''}">Přidat podúkol</button>
                    </div>
                    <div class="subtask-list" id="subtask-list-${taskId}"></div>
                </div>
            `;
            newItem.innerHTML = html;
            checklistItems.appendChild(newItem);
            setupCheckbox(taskId, subchecklistId);

            const editBtn = newItem.querySelector(`.edit-btn[data-task-id="${taskId}"]`);
            const deleteBtn = newItem.querySelector(`.delete-btn[data-task-id="${taskId}"]`);
            const toggleSubtaskBtn = newItem.querySelector(`.toggle-subtask-btn[data-task-id="${taskId}"]`);
            const addSubtaskBtn = newItem.querySelector(`.add-subtask-btn[data-task-id="${taskId}"]`);

            editBtn.addEventListener('click', () => editTask(taskId, taskData.text, subchecklistId));
            deleteBtn.addEventListener('click', () => deleteTask(taskId, subchecklistId));
            toggleSubtaskBtn.addEventListener('click', () => toggleSubtaskMenu(taskId));
            addSubtaskBtn.addEventListener('click', () => addSubtask(taskId, subchecklistId));

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
                        <button class="edit-subtask-btn" data-task-id="${taskId}" data-subtask-id="${subtaskId}" data-subchecklist-id="${subchecklistId || ''}">Upravit</button>
                        <button class="delete-subtask-btn" data-task-id="${taskId}" data-subtask-id="${subtaskId}" data-subchecklist-id="${subchecklistId || ''}">Smazat</button>
                    `;
                    subtaskList.appendChild(subtaskItem);
                    setupSubtaskCheckbox(taskId, subtaskId, subchecklistId);

                    const editSubtaskBtn = subtaskItem.querySelector(`.edit-subtask-btn[data-subtask-id="${subtaskId}"]`);
                    const deleteSubtaskBtn = subtaskItem.querySelector(`.delete-subtask-btn[data-subtask-id="${subtaskId}"]`);
                    editSubtaskBtn.addEventListener('click', () => editSubtask(taskId, subtaskId, subtaskData.text, subchecklistId));
                    deleteSubtaskBtn.addEventListener('click', () => deleteSubtask(taskId, subtaskId, subchecklistId));
                });
                if (!subtaskList.sortable) {
                    subtaskList.sortable = new Sortable(subtaskList, {
                        animation: 150,
                        onEnd: () => updateSubtaskOrder(taskId, subchecklistId)
                    });
                }
            }
        });

        if (!checklistItems.sortable) {
            checklistItems.sortable = new Sortable(checklistItems, {
                animation: 150,
                onEnd: () => updateTaskOrder()
            });
        }
    }
}

async function updateTaskOrder() {
    const items = Array.from(checklistItems.children);
    const updates = {};
    items.forEach((item, index) => {
        const taskId = item.dataset.id;
        const subchecklistId = item.dataset.subchecklistId;
        const path = subchecklistId 
            ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}/order`
            : `checklist/${currentChecklistId}/tasks/${taskId}/order`;
        updates[path] = index;
    });
    try {
        await update(ref(database), updates);
        console.log("Pořadí úkolů aktualizováno");
    } catch (err) {
        console.error("Chyba při aktualizaci pořadí úkolů:", err);
    }
}

async function updateSubtaskOrder(taskId, subchecklistId) {
    const subtaskList = document.getElementById(`subtask-list-${taskId}`);
    const items = Array.from(subtaskList.children);
    const updates = {};
    items.forEach((item, index) => {
        const subtaskId = item.dataset.id;
        const path = subchecklistId 
            ? `checklist/${currentChecklistId}/subchecklists/${subchecklistId}/tasks/${taskId}/subtasks/${subtaskId}/order`
            : `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}/order`;
        updates[path] = index;
    });
    try {
        await update(ref(database), updates);
        console.log("Pořadí podúkolů aktualizováno pro úkol:", taskId);
    } catch (err) {
        console.error("Chyba při aktualizaci pořadí podúkolů:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const newChecklistBtn = document.getElementById('new-checklist-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const toggleChecklistBtn = document.getElementById('toggle-checklist-btn');
    const newSubchecklistBtn = document.getElementById('new-subchecklist-btn');

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

    if (newSubchecklistBtn) {
        newSubchecklistBtn.addEventListener('click', createNewSubchecklist);
    } else {
        console.error("Tlačítko s id='new-subchecklist-btn' nenalezeno!");
    }
});

window.switchChecklist = switchChecklist;
window.renameChecklist = renameChecklist;
window.deleteChecklist = deleteChecklist;
window.renameSubchecklist = renameSubchecklist;
window.deleteSubchecklist = deleteSubchecklist;
