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
            switchChecklist(checklistId); // Přepneme na nový checklist
            loadChecklists(); // Aktualizujeme dropdown
        })
        .catch(err => {
            console.error("Chyba při vytváření checklistu:", err);
            alert("Chyba při vytváření checklistu: " + err.message);
        });
};

window.renameChecklist = function() {
    if (!currentChecklistId) {
        alert("Není vybrán žádný checklist k přejmenování!");
        return;
    }
    const currentName = checklistSelect.selectedOptions[0].text;
    const newName = prompt("Zadejte nový název checklistu:", currentName);
    if (!newName || newName.trim() === "") {
        alert("Název checklistu nemůže být prázdný!");
        return;
    }
    const checklistRef = ref(database, `checklist/metadata/${currentChecklistId}`);
    console.log("Přejmenovávám checklist:", currentChecklistId, "na:", newName);
    set(checklistRef, { name: newName.trim() })
        .then(() => {
            console.log("Checklist úspěšně přejmenován:", currentChecklistId);
            loadChecklists(); // Znovu načteme checklisty pro aktualizaci dropdownu
        })
        .catch(err => {
            console.error("Chyba při přejmenování checklistu:", err);
            alert("Chyba při přejmenování checklistu: " + err.message);
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
            loadChecklists(); // Znovu načteme checklisty
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
        checklistSelect.innerHTML = ''; // Vymažeme obsah dropdownu
        let firstChecklistId = null;
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const checklistId = childSnapshot.key;
                const checklistData = childSnapshot.val();
                const option = document.createElement('option');
                option.value = checklistId;
                option.textContent = checklistData.name;
                if (!firstChecklistId) firstChecklistId = checklistId; // Uložíme ID prvního checklistu
                if (checklistId === currentChecklistId) option.selected = true;
                checklistSelect.appendChild(option);
            });
            // Pokud není žádný checklist vybrán a existuje alespoň jeden, automaticky vybereme první
            if (!currentChecklistId && firstChecklistId) {
                switchChecklist(firstChecklistId);
            }
        } else {
            // Pokud neexistují žádné checklisty, zobrazíme "Vyberte checklist"
            checklistSelect.innerHTML = '<option value="">Vyberte checklist</option>';
            currentChecklistId = null;
            checklistItems.innerHTML = "";
            deleteChecklistBtn.style.display = "none";
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

window.addTask = async function() {
    const newTaskInput = document.getElementById('new-task');
    const taskText = newTaskInput.value.trim();
    if (taskText === '' || !currentChecklistId) {
        console.log("Prázdný úkol nebo žádný checklist nevybrán");
        return;
    }
    const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    // Najdeme maximální order
    const snapshot = await get(tasksRef);
    let maxOrder = 0;
    if (snapshot.exists()) {
        snapshot.forEach(child => {
            const order = child.val().order || 0;
            if (order > maxOrder) maxOrder = order;
        });
    }
    const newTaskRef = push(tasksRef);
    const newTaskId = newTaskRef.key;
    console.log("Přidávám úkol:", taskText, "do checklistu:", currentChecklistId, "s order:", maxOrder + 1);
    set(newTaskRef, { text: taskText, checked: false, subtasks: {}, order: maxOrder + 1 })
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

window.addSubtask = async function(taskId) {
    const subtaskInput = document.getElementById(`subtask-input-${taskId}`);
    const subtaskText = subtaskInput.value.trim();
    if (subtaskText === '' || !currentChecklistId) {
        console.log("Prázdný podúkol nebo žádný checklist nevybrán");
        return;
    }
    const subtasksRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
    // Najdeme maximální order pro podúkoly
    const snapshot = await get(subtasksRef);
    let maxOrder = 0;
    if (snapshot.exists()) {
        snapshot.forEach(child => {
            const order = child.val().order || 0;
            if (order > maxOrder) maxOrder = order;
        });
    }
    const newSubtaskRef = push(subtasksRef);
    set(newSubtaskRef, { text: subtaskText, checked: false, order: maxOrder + 1 })
        .then(() => {
            subtaskInput.value = '';
            toggleSubtaskMenu(taskId, true);
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

window.toggleSubtaskMenu = function(taskId) {
    const subtaskMenu = document.getElementById(`subtask-menu-${taskId}`);
    const isHidden = subtaskMenu.style.display === 'none';
    subtaskMenu.style.display = isHidden ? 'block' : 'none';
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

async function migrateOrders(tasksRef) {
    const snapshot = await get(tasksRef);
    if (snapshot.exists()) {
        const tasks = [];
        snapshot.forEach(child => {
            tasks.push({ id: child.key, data: child.val() });
        });
        // Pokud některý nemá order, přiřadíme na základě aktuálního pořadí (podle klíčů)
        const needsMigration = tasks.some(task => task.data.order === undefined);
        if (needsMigration) {
            tasks.sort((a, b) => a.id.localeCompare(b.id)); // Řadíme podle push ID (časově)
            const updates = {};
            tasks.forEach((task, index) => {
                updates[`${task.id}/order`] = index + 1;
            });
            await update(tasksRef, updates);
        }
    }
}

async function migrateSubtaskOrders(taskId, subtasks) {
    const subtasksRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
    const snapshot = await get(subtasksRef);
    if (snapshot.exists()) {
        const subtaskList = [];
        snapshot.forEach(child => {
            subtaskList.push({ id: child.key, data: child.val() });
        });
        const needsMigration = subtaskList.some(st => st.data.order === undefined);
        if (needsMigration) {
            subtaskList.sort((a, b) => a.id.localeCompare(b.id));
            const updates = {};
            subtaskList.forEach((st, index) => {
                updates[`${st.id}/order`] = index + 1;
            });
            await update(subtasksRef, updates);
        }
    }
}

function setupTaskDragAndDrop() {
    const checklistItems = document.getElementById('checklist-items');
    checklistItems.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('checklist-item')) {
            e.target.classList.add('dragging');
        }
    });

    checklistItems.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('checklist-item')) {
            e.target.classList.remove('dragging');
        }
    });

    checklistItems.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (dragging) {
            const afterElement = getDragAfterElement(checklistItems, e.clientY, 'checklist-item');
            if (afterElement == null) {
                checklistItems.appendChild(dragging);
            } else {
                checklistItems.insertBefore(dragging, afterElement);
            }
        }
    });

    checklistItems.addEventListener('drop', async (e) => {
        e.preventDefault();
        // Aktualizujeme order v DB na základě nového DOM pořadí
        const items = Array.from(checklistItems.querySelectorAll('.checklist-item'));
        const updates = {};
        items.forEach((item, index) => {
            const taskId = item.querySelector('input[type="checkbox"]').id;
            updates[`${taskId}/order`] = index + 1;
        });
        const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
        await update(tasksRef, updates);
    });
}

function setupSubtaskDragAndDrop(taskId) {
    const subtaskList = document.getElementById(`subtask-list-${taskId}`);
    subtaskList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('subtask-item')) {
            e.target.classList.add('dragging');
        }
    });

    subtaskList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('subtask-item')) {
            e.target.classList.remove('dragging');
        }
    });

    subtaskList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = subtaskList.querySelector('.dragging');
        if (dragging) {
            const afterElement = getDragAfterElement(subtaskList, e.clientY, 'subtask-item');
            if (afterElement == null) {
                subtaskList.appendChild(dragging);
            } else {
                subtaskList.insertBefore(dragging, afterElement);
            }
        }
    });

    subtaskList.addEventListener('drop', async (e) => {
        e.preventDefault();
        // Aktualizujeme order v DB
        const items = Array.from(subtaskList.querySelectorAll('.subtask-item'));
        const updates = {};
        items.forEach((item, index) => {
            const subtaskId = item.querySelector('input[type="checkbox"]').id;
            updates[`${subtaskId}/order`] = index + 1;
        });
        const subtasksRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
        await update(subtasksRef, updates);
    });
}

function getDragAfterElement(container, y, className) {
    const draggableElements = [...container.querySelectorAll(`.${className}:not(.dragging)`)];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function loadTasks() {
    if (!currentChecklistId) {
        console.log("Žádný checklist nevybrán, čistím seznam úkolů");
        checklistItems.innerHTML = '';
        return;
    }
    const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    console.log("Načítám úkoly pro checklist:", currentChecklistId);
    // Nejprve migrujeme orders, pokud je třeba
    migrateOrders(tasksRef).then(() => {
        onValue(tasksRef, snapshot => {
            const tasks = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    tasks.push({ id: childSnapshot.key, data: childSnapshot.val() });
                });
                // Seřadíme podle order
                tasks.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
            }
            checklistItems.innerHTML = '';
            tasks.forEach(task => {
                const taskId = task.id;
                const taskData = task.data;
                const hasSubtasks = taskData.subtasks && Object.keys(taskData.subtasks).length > 0;
                const newItem = document.createElement('div');
                newItem.className = 'checklist-item';
                newItem.draggable = true;
                newItem.innerHTML = `
                    <div class="task-header">
                        <input type="checkbox" id="${taskId}" ${taskData.checked ? "checked" : ""}>
                        <label for="${taskId}" class="${taskData.checked ? "completed" : ""}">${taskData.text}</label>
                        <button class="edit-btn" onclick="editTask('${taskId}', '${taskData.text}')">Upravit</button>
                        <button class="delete-btn" onclick="deleteTask('${taskId}')">Smazat</button>
                        <button class="toggle-subtask-btn" onclick="toggleSubtaskMenu('${taskId}')">${hasSubtasks ? '▼' : '▶'} Podúkoly</button>
                    </div>
                    <div class="subtask-menu" id="subtask-menu-${taskId}" style="display: ${hasSubtasks ? 'block' : 'none'};">
                        <div class="add-subtask" id="add-subtask-${taskId}">
                            <input type="text" id="subtask-input-${taskId}" placeholder="Zadejte nový podúkol">
                            <button onclick="addSubtask('${taskId}')">Přidat podúkol</button>
                        </div>
                        <div class="subtask-list" id="subtask-list-${taskId}"></div>
                    </div>
                `;
                checklistItems.appendChild(newItem);
                setupCheckbox(taskId);

                if (taskData.subtasks) {
                    migrateSubtaskOrders(taskId, taskData.subtasks).
