import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
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

// HTML prvky
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const contactInfo = document.getElementById("contact-info");
const taskControls = document.getElementById("task-controls");
const checklistControls = document.getElementById("checklist-controls");
const checklistContainer = document.getElementById("checklist-container");
const checklistItems = document.getElementById("checklist-items");
const deleteChecklistBtn = document.getElementById("delete-checklist-btn");

let currentChecklistId = null;

// ✅ Přihlášení/odhlášení
loginBtn.onclick = () => signInWithPopup(auth, provider).catch(err => alert("Chyba přihlášení: " + err.message));
logoutBtn.onclick = () => signOut(auth).catch(err => console.error("Chyba odhlášení:", err));

onAuthStateChanged(auth, user => {
  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userInfo.textContent = "Přihlášen jako: " + user.displayName;
    contactInfo.style.display = "none";
    taskControls.style.display = "block";
    checklistControls.style.display = "block";
    loadChecklists();
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.textContent = "";
    contactInfo.style.display = "block";
    taskControls.style.display = "none";
    checklistControls.style.display = "none";
    checklistContainer.innerHTML = "";
    checklistItems.innerHTML = "";
    currentChecklistId = null;
    deleteChecklistBtn.style.display = "none";
  }
});

// ✅ CRUD operace pro checklisty
window.createNewChecklist = function() {
  const name = prompt("Název nového checklistu:");
  if (!name) return;
  const id = `checklist-${Date.now()}`;
  set(ref(database, `checklist/metadata/${id}`), { name, order: Date.now() }).then(() => {
    switchChecklist(id);
    loadChecklists();
  });
};

window.renameChecklist = function() {
  if (!currentChecklistId) return;
  const newName = prompt("Nový název:");
  if (!newName) return;
  set(ref(database, `checklist/metadata/${currentChecklistId}`), { name: newName, order: Date.now() }).then(loadChecklists);
};

window.deleteChecklist = function() {
  if (!currentChecklistId) return;
  if (!confirm("Smazat checklist?")) return;
  remove(ref(database, `checklist/${currentChecklistId}`));
  remove(ref(database, `checklist/metadata/${currentChecklistId}`));
  currentChecklistId = null;
  checklistItems.innerHTML = "";
  deleteChecklistBtn.style.display = "none";
  loadChecklists();
};

function switchChecklist(id) {
  currentChecklistId = id;
  deleteChecklistBtn.style.display = "inline-block";
  loadTasks();
}

// ✅ Načtení checklistů
function loadChecklists() {
  const checklistsRef = ref(database, `checklist/metadata`);
  onValue(checklistsRef, snapshot => {
    checklistContainer.innerHTML = "";
    if (snapshot.exists()) {
      let checklists = [];
      snapshot.forEach(c => checklists.push({ id: c.key, ...c.val() }));
      checklists.sort((a, b) => a.order - b.order);

      checklists.forEach(c => {
        const div = document.createElement("div");
        div.className = "checklist-option";
        div.textContent = c.name;
        div.draggable = true;
        div.dataset.id = c.id;
        if (c.id === currentChecklistId) div.classList.add("active");
        div.onclick = () => switchChecklist(c.id);
        checklistContainer.appendChild(div);
      });

      setupChecklistDragAndDrop();
      if (!currentChecklistId && checklists.length > 0) switchChecklist(checklists[0].id);
    }
  });
}

// ✅ Drag&Drop pro checklisty
function setupChecklistDragAndDrop() {
  const options = checklistContainer.querySelectorAll(".checklist-option");
  options.forEach(opt => {
    opt.addEventListener("dragstart", e => e.dataTransfer.setData("id", opt.dataset.id));
    opt.addEventListener("dragover", e => { e.preventDefault(); opt.classList.add("drag-over"); });
    opt.addEventListener("dragleave", () => opt.classList.remove("drag-over"));
    opt.addEventListener("drop", e => {
      e.preventDefault();
      opt.classList.remove("drag-over");
      const draggedId = e.dataTransfer.getData("id");
      reorderChecklists(draggedId, opt.dataset.id);
    });
  });
}

function reorderChecklists(draggedId, targetId) {
  const refMeta = ref(database, `checklist/metadata`);
  onValue(refMeta, snapshot => {
    let checklists = [];
    snapshot.forEach(c => checklists.push({ id: c.key, ...c.val() }));
    checklists.sort((a, b) => a.order - b.order);

    const draggedIndex = checklists.findIndex(c => c.id === draggedId);
    const targetIndex = checklists.findIndex(c => c.id === targetId);
    const [dragged] = checklists.splice(draggedIndex, 1);
    checklists.splice(targetIndex, 0, dragged);

    const updates = {};
    checklists.forEach((c, i) => updates[`checklist/metadata/${c.id}/order`] = i);
    update(ref(database), updates);
  }, { onlyOnce: true });
}

// ✅ Úkoly a podúkoly
window.addTask = function() {
  const input = document.getElementById("new-task");
  if (!input.value.trim() || !currentChecklistId) return;
  const taskRef = push(ref(database, `checklist/${currentChecklistId}/tasks`));
  set(taskRef, { text: input.value.trim(), checked: false, order: Date.now() });
  input.value = "";
};

window.deleteTask = taskId => remove(ref(database, `checklist/${currentChecklistId}/tasks/${taskId}`));
window.deleteSubtask = (taskId, subtaskId) => remove(ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${subtaskId}`));

window.addSubtask = function(taskId) {
  const input = document.getElementById(`subtask-input-${taskId}`);
  if (!input.value.trim()) return;
  const subRef = push(ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`));
  set(subRef, { text: input.value.trim(), checked: false, order: Date.now() });
  input.value = "";
};

function loadTasks() {
  if (!currentChecklistId) return;
  const tasksRef = ref(database, `checklist/${currentChecklistId}/tasks`);
  onValue(tasksRef, snapshot => {
    checklistItems.innerHTML = "";
    if (snapshot.exists()) {
      let tasks = [];
      snapshot.forEach(c => tasks.push({ id: c.key, ...c.val() }));
      tasks.sort((a, b) => a.order - b.order);

      tasks.forEach(t => {
        const div = document.createElement("div");
        div.className = "checklist-item";
        div.draggable = true;
        div.dataset.id = t.id;
        div.innerHTML = `
          <div class="task-header">
            <input type="checkbox" ${t.checked ? "checked" : ""}>
            <label class="${t.checked ? "completed" : ""}">${t.text}</label>
            <button onclick="deleteTask('${t.id}')">Smazat</button>
            <button onclick="toggleSubtaskMenu('${t.id}')">Podúkoly</button>
          </div>
          <div class="subtask-menu" id="subtask-menu-${t.id}" style="display:none;">
            <input type="text" id="subtask-input-${t.id}" placeholder="Nový podúkol">
            <button onclick="addSubtask('${t.id}')">Přidat</button>
            <div class="subtask-list" id="subtask-list-${t.id}"></div>
          </div>
        `;
        checklistItems.appendChild(div);

        if (t.subtasks) {
          const list = div.querySelector(`#subtask-list-${t.id}`);
          let subs = Object.entries(t.subtasks).map(([id, val]) => ({ id, ...val }));
          subs.sort((a, b) => a.order - b.order);
          subs.forEach(s => {
            const sdiv = document.createElement("div");
            sdiv.className = "subtask-item";
            sdiv.draggable = true;
            sdiv.dataset.id = s.id;
            sdiv.innerHTML = `
              <input type="checkbox" ${s.checked ? "checked" : ""}>
              <label class="${s.checked ? "completed" : ""}">${s.text}</label>
              <button onclick="deleteSubtask('${t.id}','${s.id}')">Smazat</button>
            `;
            list.appendChild(sdiv);
          });
          setupSubtaskDragAndDrop(t.id);
        }
      });
      setupTaskDragAndDrop();
    }
  });
}

// ✅ Drag&Drop pro úkoly
function setupTaskDragAndDrop() {
  const items = checklistItems.querySelectorAll(".checklist-item");
  items.forEach(it => {
    it.addEventListener("dragstart", e => e.dataTransfer.setData("id", it.dataset.id));
    it.addEventListener("dragover", e => { e.preventDefault(); it.classList.add("drag-over"); });
    it.addEventListener("dragleave", () => it.classList.remove("drag-over"));
    it.addEventListener("drop", e => {
      e.preventDefault();
      it.classList.remove("drag-over");
      reorderTasks(e.dataTransfer.getData("id"), it.dataset.id);
    });
  });
}

function reorderTasks(draggedId, targetId) {
  const refTasks = ref(database, `checklist/${currentChecklistId}/tasks`);
  onValue(refTasks, snapshot => {
    let tasks = [];
    snapshot.forEach(c => tasks.push({ id: c.key, ...c.val() }));
    tasks.sort((a, b) => a.order - b.order);
    const dIndex = tasks.findIndex(t => t.id === draggedId);
    const tIndex = tasks.findIndex(t => t.id === targetId);
    const [dragged] = tasks.splice(dIndex, 1);
    tasks.splice(tIndex, 0, dragged);
    const updates = {};
    tasks.forEach((t, i) => updates[`checklist/${currentChecklistId}/tasks/${t.id}/order`] = i);
    update(ref(database), updates);
  }, { onlyOnce: true });
}

// ✅ Drag&Drop pro podúkoly
function setupSubtaskDragAndDrop(taskId) {
  const items = document.querySelectorAll(`#subtask-list-${taskId} .subtask-item`);
  items.forEach(it => {
    it.addEventListener("dragstart", e => e.dataTransfer.setData("id", it.dataset.id));
    it.addEventListener("dragover", e => { e.preventDefault(); it.classList.add("drag-over"); });
    it.addEventListener("dragleave", () => it.classList.remove("drag-over"));
    it.addEventListener("drop", e => {
      e.preventDefault();
      it.classList.remove("drag-over");
      reorderSubtasks(taskId, e.dataTransfer.getData("id"), it.dataset.id);
    });
  });
}

function reorderSubtasks(taskId, draggedId, targetId) {
  const refSubs = ref(database, `checklist/${currentChecklistId}/tasks/${taskId}/subtasks`);
  onValue(refSubs, snapshot => {
    let subs = [];
    snapshot.forEach(c => subs.push({ id: c.key, ...c.val() }));
    subs.sort((a, b) => a.order - b.order);
    const dIndex = subs.findIndex(s => s.id === draggedId);
    const tIndex = subs.findIndex(s => s.id === targetId);
    const [dragged] = subs.splice(dIndex, 1);
    subs.splice(tIndex, 0, dragged);
    const updates = {};
    subs.forEach((s, i) => updates[`checklist/${currentChecklistId}/tasks/${taskId}/subtasks/${s.id}/order`] = i);
    update(ref(database), updates);
  }, { onlyOnce: true });
}

// ✅ Toggle subtask menu
window.toggleSubtaskMenu = id => {
  const el = document.getElementById(`subtask-menu-${id}`);
  el.style.display = el.style.display === "none" ? "block" : "none";
};
