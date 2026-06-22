import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const state = { user: null, profile: null, projects: [], members: [] };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

onAuthStateChanged(auth, async user => {
  if (!user) return location.replace("./index.html");

  state.user = user;
  const snapshot = await getDoc(doc(db, "loindWorks_users", user.uid));

  if (!snapshot.exists() || snapshot.data().role !== "admin") {
    alert("관리자만 접근할 수 있습니다.");
    return location.replace("./work.html");
  }

  state.profile = snapshot.data();
  listenProjects();
  listenMembers();
});

function listenProjects() {
  onSnapshot(query(collection(db, "loindWorks_projects"), orderBy("updatedAt", "desc")), snapshot => {
    state.projects = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderProjects();
  });
}

function listenMembers() {
  onSnapshot(query(collection(db, "loindWorks_users"), orderBy("name")), snapshot => {
    state.members = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderMembers();
  });
}

function renderProjects() {
  $("#projectAdminList").innerHTML = state.projects.length
    ? state.projects.map(project => `
      <div class="admin-row grid grid-cols-[1.4fr_1fr_.8fr_.7fr_.7fr] gap-4 items-center px-5 py-4 border-b border-white/5 text-xs">
        <span><b class="block">${escapeHtml(project.title || "Untitled")}</b><small class="text-white/30">${escapeHtml(project.description || "")}</small></span>
        <span>${escapeHtml(project.client || "-")}</span>
        <span>${escapeHtml(project.ownerName || "-")}</span>
        <span class="text-emerald-300">${statusText(project.status)}</span>
        <span><button data-edit="${project.id}" class="border border-white/10 rounded-lg px-3 py-2 text-[10px]">EDIT</button></span>
      </div>`).join("")
    : '<p class="p-5 text-xs text-white/35">프로젝트가 없습니다.</p>';

  $$("[data-edit]").forEach(button => {
    button.onclick = () => {
      const project = state.projects.find(item => item.id === button.dataset.edit);
      openDialog(project);
    };
  });
}

function renderMembers() {
  $("#memberAdminList").innerHTML = state.members.length
    ? state.members.map(member => `
      <div class="admin-row grid grid-cols-[1fr_1.4fr_1fr_.7fr_.7fr] gap-4 items-center px-5 py-4 border-b border-white/5 text-xs">
        <span><b>${escapeHtml(member.name || "-")}</b></span>
        <span>${escapeHtml(member.email || "-")}</span>
        <span><input data-company="${member.id}" value="${escapeAttr(member.company || "")}" class="glass-input rounded-lg p-2 text-xs w-full"></span>
        <span><select data-role="${member.id}" class="glass-input rounded-lg p-2 text-xs w-full"><option value="client" ${member.role === "client" ? "selected" : ""}>client</option><option value="manager" ${member.role === "manager" ? "selected" : ""}>manager</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>admin</option></select></span>
        <span><button data-save-member="${member.id}" class="border border-white/10 rounded-lg px-3 py-2 text-[10px]">SAVE</button></span>
      </div>`).join("")
    : '<p class="p-5 text-xs text-white/35">회원이 없습니다.</p>';

  $$("[data-save-member]").forEach(button => {
    button.onclick = async () => {
      const userId = button.dataset.saveMember;
      await updateDoc(doc(db, "loindWorks_users", userId), {
        company: $(`[data-company="${userId}"]`).value.trim(),
        role: $(`[data-role="${userId}"]`).value,
        updatedAt: serverTimestamp()
      });
      button.textContent = "SAVED";
      setTimeout(() => button.textContent = "SAVE", 1000);
    };
  });
}

function openDialog(project = null) {
  $("#dialogTitle").textContent = project ? "프로젝트 수정" : "새 프로젝트";
  $("#projectId").value = project?.id || "";
  $("#title").value = project?.title || "";
  $("#client").value = project?.client || "";
  $("#ownerName").value = project?.ownerName || state.profile?.name || "";
  $("#dueDate").value = project?.dueDate || "";
  $("#status").value = project?.status || "planning";
  $("#progress").value = project?.progress ?? 0;
  $("#memberEmails").value = (project?.memberEmails || []).join(", ");
  $("#description").value = project?.description || "";
  $("#stages").value = (project?.stages || ["기획", "자료 수급", "제작", "검수", "승인", "납품"]).join(", ");
  $("#deleteProject").classList.toggle("hidden", !project);
  $("#projectDialog").showModal();
}

$("#projectForm").onsubmit = async event => {
  event.preventDefault();
  const projectId = $("#projectId").value;
  const stages = $("#stages").value.split(",").map(value => value.trim()).filter(Boolean);
  const progress = Number($("#progress").value || 0);

  const data = {
    title: $("#title").value.trim(),
    client: $("#client").value.trim(),
    ownerName: $("#ownerName").value.trim(),
    dueDate: $("#dueDate").value,
    status: $("#status").value,
    progress,
    memberEmails: $("#memberEmails").value.split(",").map(value => value.trim().toLowerCase()).filter(Boolean),
    description: $("#description").value.trim(),
    stages,
    currentStage: Math.min(Math.round(progress / 100 * Math.max(stages.length - 1, 0)), Math.max(stages.length - 1, 0)),
    updatedAt: serverTimestamp(),
    updatedBy: state.user.uid
  };

  if (projectId) {
    await updateDoc(doc(db, "loindWorks_projects", projectId), data);
  } else {
    await addDoc(collection(db, "loindWorks_projects"), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid,
      approval: { state: "waiting" }
    });
  }

  $("#projectDialog").close();
};

$("#deleteProject").onclick = async () => {
  const projectId = $("#projectId").value;
  if (!projectId || !confirm("프로젝트를 삭제할까요?")) return;
  await deleteDoc(doc(db, "loindWorks_projects", projectId));
  $("#projectDialog").close();
};

$("#newProject").onclick = () => openDialog();
$$("[data-close]").forEach(button => button.onclick = () => $("#projectDialog").close());
$("#logout").onclick = () => signOut(auth);

$$(".admin-tab").forEach(button => {
  button.onclick = () => {
    $$(".admin-tab").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    $$(".admin-view").forEach(view => view.classList.remove("active"));
    $(`#${button.dataset.view}View`).classList.add("active");
  };
});

function statusText(status) {
  return ({ planning: "설계 중", progress: "진행 중", review: "확인 요청", done: "완료" })[status] || "진행 중";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
