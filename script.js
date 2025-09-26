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

let currentChecklistId = "automatizace"; // Výchozí je "Automatizace"

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
        loadTasks();
    } else {
        console.log("Uživatel odhlášen");
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        contactInfo.style.display = "block";
        taskControls.style.display = "none";
        checklistControls.style.display = "none";
        checklistSelect.innerHTML = '<option value="automatizace">Automatizace</option>';
        checklistItems.innerHTML = "";
        currentChecklistId = "automatizace";
        deleteChecklistBtn.style.display = "inline-block";
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
    if (!confirm(`Opravdu chcete smazat checklist '${checklistSelect.selectedOptions[0].text}'?`)) {
        return;
    }
    const checklistRef = ref(database, currentChecklistId === "automatizace" ? `checklist` : `checklist/${currentChecklistId}`);
    const metadataRef = ref(database, `checklist/metadata/${currentChecklistId}`);
    console.log("Mažu checklist:", currentChecklistId);
    Promise.all([
        remove(checklistRef),
        remove(metadataRef)
    ])
        .then(() => {
            console.log("Checklist úspěšně smazán:", currentChecklistId);
            // Najít jiný checklist nebo vytvořit nový výchozí
            const checklistsRef = ref(database, `checklist/metadata`);
            onValue(checklistsRef, snapshot => {
                if (snapshot.exists()) {
                    const firstChecklistId = Object.keys(snapshot.val())[0];
                    switchChecklist(firstChecklistId);
                } else {
                    // Pokud žádné checklisty nejsou, vytvořit nový "Automatizace"
                    set(ref(database, `checklist/metadata/automatizace`), { name: "Automatizace" })
                        .then(() => switchChecklist("automatizace"))
                        .catch(err => console.error("Chyba při vytváření výchozího checklistu:", err));
                }
            }, { onlyOnce: true });
        })
        .catch(err => {
            console.error("Chyba při mazání checklistu:", err);
            alert("Chyba při mazání checklistu: " + err.message);
        });
};

window.switchChecklist = function(checklistId) {
    if (checklistId === "") {
        console.log("Žádný checklist nevybrán");
        return;
    }
    console.log("Přepínám na checklist:", checklistId);
    currentChecklistId = checklistId;
    deleteChecklistBtn.style.display = "inline-block"; // Vždy zobrazené, protože můžeme mazat i Automatizaci
    loadTasks();
    updateChecklistSelect();
};

function loadChecklists() {
    const checklistsRef = ref(database, `checklist/metadata`);
    console.log("Načítám checklisty");
    onValue(checklistsRef, snapshot => {
        checklistSelect.innerHTML = '';
        if (!snapshot.exists()) {
            console.log("Žádné checklisty nenalezeny, vytvářím výchozí Automatizace");
            set(ref(database, `checklist/metadata/automatizace`), { name: "Automatizace" })
                .then(() => {
                    checklistSelect.innerHTML = '<option value="automatizace">Automatizace</option>';
                    switchChecklist("automatizace");
                });
        } else {
            let hasAutomatizace = false;
            snapshot.forEach(childSnapshot => {
                const checklistId = childSnapshot.key;
                const checklistData = childSnapshot.val();
                if (checklistId === "automatizace") hasAutomatizace = true;
                const option = document.createElement('option');
                option.value = checklistId;
                option.textContent = checklistData.name;
                if (checklistId === currentChecklistId) option.selected = true;
                checklistSelect.appendChild(option);
            });
            if (!hasAutomatizace) {
                console.log("Automatizace nenalezena, přidávám do metadat");
                set(ref(database, `checklist/metadata/automatizace`), { name: "Automatizace" })
                    .then(() => {
                        const option = document.createElement('option');
                        option.value = "automatizace";
                        option.textContent = "Automatizace";
                        checklistSelect.appendChild(option);
                    });
            }
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
    let tasksRef;
    if (currentChecklistId === "automatizace") {
        tasksRef = ref(database, 'checklist');
    } else {
        tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
    }
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
        let taskRef;
        if (currentChecklistId === "automatizace") {
            taskRef = ref(database, `checklist/${taskId}`);
        } else {
            taskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`);
        }
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
    let subtaskRef;
    if (currentChecklistId === "automatizace") {
        subtaskRef = ref(database, `checklist/${taskId}/subtasks`);
    } else {
        subtaskRef = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
    }
    const newSubtaskRef = push(subtaskRef);
    set(newSubtaskRef, { text: subtaskText, checked: false })
        .then(() => {
            subtaskInput.value = '';
        })
        .catch(err => console.error("Chyba při přidávání podúkolu:", err));
};

window
