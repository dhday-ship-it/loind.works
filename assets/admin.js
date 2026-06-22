import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
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

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  profile: null,
  projects: [],
  members: [],
  projectSearch: "",
  projectFilter: "all"
};

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("./index.html");
    return;
  }

  state.user = user;
  const profileSnap = await getDoc(doc(db, "loindWorks_users", user.uid));

  if (!profileSnap.exists() || profileSnap.data().role !== "admin") {
    alert("관리자만 접근할 수 있습니다.");
    location.replace("./work.html");
    return;
  }

  state.profile = { id: profileSnap.id, ...profileSnap.data() };
  qs("#adminUserName").textContent = `${state.profile.name} / ADMIN`;
  startProjectListener();
  startMemberListener();
});

function startProjectListener() {
  const projectQuery = query(
    collection(db, "loindWorks_projects"),
    orderBy("updatedAt", "desc")
  );

  onSnapshot(projectQuery, snapshot => {
    state.projects = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    updateCounts();
    renderProjects();
  }, error => {
    qs("#adminProjectList").innerHTML = `<p class="empty-list">${escapeHtml(error.message)}</p>`;
  });
}

function startMemberListener() {
  const memberQuery = query(
    collection(db, "loindWorks_users"),
    orderBy("name")
  );

  onSnapshot(memberQuery, snapshot => {
    state.members = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    updateCounts();
    renderMembers();
  }, error => {
    qs("#adminMemberList").innerHTML = `<p class="empty-list">${escapeHtml(error.message)}</p>`;
  });
}

function updateCounts() {
  qs("#projectCount").textContent = state.projects.length;
  qs("#memberCount").textContent = state.members.length;
  qs("#reviewCount").textContent = state.projects.filter(project => project.status === "review").length;
}

function filteredProjects() {
  return state.projects.filter(project => {
    const text = `${project.title || ""} ${project.client || ""} ${project.ownerName || ""}`.toLowerCase();
    const textMatch = text.includes(state.projectSearch);
    const statusMatch = state.projectFilter === "all" || project.status === state.projectFilter;
    return textMatch && statusMatch;
  });
}

function renderProjects() {
  const projects = filteredProjects();

  qs("#adminProjectList").innerHTML = projects.length
    ? projects.map(project => `
      <article class="admin-table-row project-admin-row">
        <span><b>${escapeHtml(project.title || "Untitled")}</b><small>${escapeHtml(project.type || "PROJECT")}</small></span>
        <span>${escapeHtml(project.client || "-")}</span>
        <span>${escapeHtml(project.ownerName || "-")}</span>
        <span><em class="admin-status status-${project.status || "planning"}">${statusLabel(project.status)}</em></span>
        <span>${escapeHtml(project.dueDate || "-")}</span>
        <span class="admin-actions">
          <button data-edit-project="${project.id}">EDIT</button>
          <a href="./work.html?project=${project.id}">OPEN ↗</a>
        </span>
      </article>
    `).join("")
    : `<p class="empty-list">표시할 프로젝트가 없습니다.</p>`;

  qsa("[data-edit-project]").forEach(button => {
    button.addEventListener("click", () => {
      const project = state.projects.find(item => item.id === button.dataset.editProject);
      if (project) openProjectDialog(project);
    });
  });
}

function renderMembers() {
  qs("#adminMemberList").innerHTML = state.members.length
    ? state.members.map(member => `
      <article class="admin-table-row member-admin-row">
        <span><b>${escapeHtml(member.name || "-")}</b></span>
        <span>${escapeHtml(member.email || "-")}</span>
        <span>
          <input class="member-company-input" data-company-user="${member.id}" value="${escapeAttribute(member.company || "")}">
        </span>
        <span>
          <select class="member-role-select" data-role-user="${member.id}">
            <option value="client" ${member.role === "client" ? "selected" : ""}>CLIENT</option>
            <option value="manager" ${member.role === "manager" ? "selected" : ""}>MANAGER</option>
            <option value="admin" ${member.role === "admin" ? "selected" : ""}>ADMIN</option>
          </select>
        </span>
        <span class="admin-actions">
          <button data-save-member="${member.id}">SAVE</button>
        </span>
      </article>
    `).join("")
    : `<p class="empty-list">회원이 없습니다.</p>`;

  qsa("[data-save-member]").forEach(button => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.saveMember;
      const role = qs(`[data-role-user="${userId}"]`).value;
      const company = qs(`[data-company-user="${userId}"]`).value.trim();

      if (userId === state.user.uid && role !== "admin") {
        const confirmed = confirm("현재 로그인한 본인의 관리자 권한을 해제하면 이 페이지에 다시 접근할 수 없습니다. 계속할까요?");
        if (!confirmed) return;
      }

      await updateDoc(doc(db, "loindWorks_users", userId), {
        role,
        company,
        updatedAt: serverTimestamp()
      });

      button.textContent = "SAVED";
      setTimeout(() => button.textContent = "SAVE", 1200);
    });
  });
}

function openProjectDialog(project = null) {
  qs("#adminDialogTitle").textContent = project ? "EDIT PROJECT" : "NEW PROJECT";
  qs("#adminProjectId").value = project?.id || "";
  qs("#adminTitle").value = project?.title || "";
  qs("#adminClient").value = project?.client || "";
  qs("#adminType").value = project?.type || "";
  qs("#adminOwner").value = project?.ownerName || state.profile?.name || "";
  qs("#adminDue").value = project?.dueDate || "";
  qs("#adminStatus").value = project?.status || "planning";
  qs("#adminProgress").value = project?.progress ?? 0;
  qs("#adminMemberEmails").value = (project?.memberEmails || []).join(", ");
  qs("#adminDescription").value = project?.description || "";
  qs("#adminStages").value = (project?.stages || ["기획","자료 수급","제작","내부 검수","외부 확인","납품"]).join(", ");
  qs("#deleteProjectButton").hidden = !project;
  qs("#adminProjectDialog").showModal();
}

async function saveProject(event) {
  event.preventDefault();

  const projectId = qs("#adminProjectId").value;
  const stages = qs("#adminStages").value
    .split(",").map(value => value.trim()).filter(Boolean);
  const progress = Number(qs("#adminProgress").value || 0);

  const data = {
    title: qs("#adminTitle").value.trim(),
    client: qs("#adminClient").value.trim(),
    type: qs("#adminType").value.trim(),
    ownerName: qs("#adminOwner").value.trim(),
    dueDate: qs("#adminDue").value,
    status: qs("#adminStatus").value,
    progress,
    memberEmails: qs("#adminMemberEmails").value
      .split(",").map(value => value.trim().toLowerCase()).filter(Boolean),
    description: qs("#adminDescription").value.trim(),
    stages,
    currentStage: Math.min(
      Math.max(Math.round((progress / 100) * Math.max(stages.length - 1, 0)), 0),
      Math.max(stages.length - 1, 0)
    ),
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

  qs("#adminProjectDialog").close();
  qs("#adminProjectForm").reset();
  qs("#adminProjectId").value = "";
}

async function deleteProject() {
  const projectId = qs("#adminProjectId").value;
  if (!projectId) return;

  const project = state.projects.find(item => item.id === projectId);
  const confirmed = confirm(
    `"${project?.title || "프로젝트"}"를 삭제할까요?\n\n주의: 프로젝트 문서는 삭제되지만 기존 하위 댓글·파일과 Storage 파일은 별도 정리가 필요합니다.`
  );
  if (!confirmed) return;

  await deleteDoc(doc(db, "loindWorks_projects", projectId));
  qs("#adminProjectDialog").close();
}

qsa("[data-admin-view]").forEach(button => {
  button.addEventListener("click", () => {
    qsa("[data-admin-view]").forEach(item => item.classList.remove("active"));
    qsa(".admin-view").forEach(view => view.classList.remove("active"));
    button.classList.add("active");
    qs(`#admin${button.dataset.adminView[0].toUpperCase()}${button.dataset.adminView.slice(1)}View`).classList.add("active");
  });
});

qs("#adminCreateProject").addEventListener("click", () => openProjectDialog());
qs("#adminProjectForm").addEventListener("submit", saveProject);
qs("#deleteProjectButton").addEventListener("click", deleteProject);
qsa("[data-admin-close]").forEach(button => button.addEventListener("click", () => qs("#adminProjectDialog").close()));
qs("#adminProjectSearch").addEventListener("input", event => {
  state.projectSearch = event.target.value.trim().toLowerCase();
  renderProjects();
});
qs("#adminProjectFilter").addEventListener("change", event => {
  state.projectFilter = event.target.value;
  renderProjects();
});
qs("#adminLogoutButton").addEventListener("click", () => signOut(auth));

function statusLabel(status) {
  return ({
    planning: "PLANNING",
    progress: "IN PROGRESS",
    review: "REVIEW",
    done: "DONE"
  })[status] || "PLANNING";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}
