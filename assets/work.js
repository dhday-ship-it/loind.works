import { auth, db, storage } from "./firebase.js";
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
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const state = {
  user: null,
  profile: null,
  projects: [],
  selected: null,
  filter: "all",
  search: "",
  commentUnsubscribe: null,
  fileUnsubscribe: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("./index.html");
    return;
  }

  state.user = user;
  const profileSnapshot = await getDoc(doc(db, "loindWorks_users", user.uid));
  state.profile = profileSnapshot.exists()
    ? { id: profileSnapshot.id, ...profileSnapshot.data() }
    : { name: user.email, email: user.email, role: "client", company: "" };

  $("#signedUser").textContent = state.profile.name || user.email;
  if (state.profile.role === "admin") {
    $("#adminLink").classList.remove("hidden");
    $("#adminLink").classList.add("flex");
  }

  bindNavigation();
  listenProjects();
  listenActivity();
  listenPeople();
});

function isManager() {
  return ["manager", "admin"].includes(state.profile?.role);
}

function projectVisible(project) {
  if (isManager()) return true;
  const email = state.user.email.toLowerCase();
  return (project.memberEmails || []).map(value => value.toLowerCase()).includes(email)
    || project.createdBy === state.user.uid;
}

function listenProjects() {
  const projectQuery = query(
    collection(db, "loindWorks_projects"),
    orderBy("updatedAt", "desc")
  );

  onSnapshot(projectQuery, snapshot => {
    state.projects = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(projectVisible);

    updateCounts();
    renderProjectList();

    if (!state.selected && state.projects.length) {
      openProject(state.projects[0].id);
    } else if (state.selected) {
      const selectedProject = state.projects.find(project => project.id === state.selected);
      if (selectedProject) renderDetail(selectedProject);
    }
  }, error => {
    $("#projectList").innerHTML = `<p class="p-4 text-xs text-rose-300">${escapeHtml(error.message)}</p>`;
  });
}

function filteredProjects() {
  return state.projects.filter(project => {
    const type = normalizeType(project.status);
    const statusMatch = state.filter === "all" || type === state.filter;
    const text = `${project.title || ""} ${project.client || ""} ${project.ownerName || ""}`.toLowerCase();
    return statusMatch && text.includes(state.search);
  });
}

function renderProjectList() {
  const projects = filteredProjects();

  $("#projectList").innerHTML = projects.length
    ? projects.map((project, index) => `
      <button class="project-row ${project.id === state.selected ? "active" : ""} w-full p-4 rounded-xl border border-white/8 text-left transition flex items-center gap-4" data-id="${project.id}">
        <span class="w-9 h-9 rounded-lg bg-white/5 grid place-items-center text-[10px] font-mono text-white/40">${String(index + 1).padStart(2, "0")}</span>
        <span class="flex-1 min-w-0">
          <b class="block text-sm truncate">${escapeHtml(project.title || "Untitled")}</b>
          <small class="text-[11px] text-white/35">${escapeHtml(project.client || "-")} · ${escapeHtml(project.description || "프로젝트 진행 중")}</small>
        </span>
        <span class="hidden sm:block text-[10px] font-mono text-emerald-300/80">${statusText(project.status)}</span>
        <span class="text-[10px] text-white/30">${shortDate(project.dueDate)}</span>
      </button>
    `).join("")
    : '<p class="p-4 text-xs text-white/35">표시할 프로젝트가 없습니다.</p>';

  $$(".project-row").forEach(button => {
    button.onclick = () => openProject(button.dataset.id);
  });
}

function openProject(projectId) {
  state.selected = projectId;
  renderProjectList();

  const project = state.projects.find(item => item.id === projectId);
  if (!project) return;

  renderDetail(project);
  listenComments(projectId);
  listenFiles(projectId);
}

function renderDetail(project) {
  const stages = project.stages?.length
    ? project.stages
    : ["기획", "자료 수급", "제작", "검수", "승인", "납품"];
  const current = Number(project.currentStage || 0);
  const files = project._files || [];
  const comments = project._comments || [];

  $("#projectDetail").innerHTML = `
    <div class="flex justify-between gap-5 border-b border-white/8 pb-5">
      <div>
        <p class="font-mono text-[9px] tracking-[.2em] text-emerald-400">PROJECT FILE / ${escapeHtml(project.id.slice(0, 8).toUpperCase())}</p>
        <h2 class="text-2xl font-bold mt-2">${escapeHtml(project.title || "Untitled")}</h2>
        <p class="text-xs text-white/35 mt-1">${escapeHtml(project.client || "-")} · 담당 ${escapeHtml(project.ownerName || "-")}</p>
      </div>
      <span class="h-fit px-3 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-[10px] font-mono text-emerald-300">${statusText(project.status)}</span>
    </div>

    <div class="grid grid-cols-3 gap-3 my-5">
      <div class="glass-panel rounded-xl p-3"><small class="text-[9px] text-white/30 font-mono">DUE</small><b class="block text-xs mt-1">${escapeHtml(project.dueDate || "-")}</b></div>
      <div class="glass-panel rounded-xl p-3"><small class="text-[9px] text-white/30 font-mono">OWNER</small><b class="block text-xs mt-1">${escapeHtml(project.ownerName || "-")}</b></div>
      <div class="glass-panel rounded-xl p-3"><small class="text-[9px] text-white/30 font-mono">PROGRESS</small><b class="block text-xs mt-1">${Number(project.progress || 0)}%</b></div>
    </div>

    <div class="h-1 bg-white/8 rounded-full overflow-hidden"><div class="h-full bg-emerald-400" style="width:${Number(project.progress || 0)}%"></div></div>

    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 my-6">
      ${stages.map((stage, index) => `
        <div class="rounded-lg p-2 border ${index === current ? "border-emerald-400/40 bg-emerald-400/10" : index < current ? "border-white/10 bg-white/5" : "border-white/5"}">
          <span class="block text-[9px] text-white/25">${String(index + 1).padStart(2, "0")}</span>
          <b class="text-[10px]">${escapeHtml(stage)}</b>
        </div>
      `).join("")}
    </div>

    <div class="glass-panel rounded-xl p-4 mb-4">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <small class="text-[9px] font-mono text-white/30">LATEST FILE</small>
          <b class="block text-sm mt-1 truncate">${files.length ? escapeHtml(files[0].name) : "업로드된 파일 없음"}</b>
        </div>
        <div class="flex gap-2">
          ${files.length ? `<a href="${files[0].url}" target="_blank" rel="noopener" class="px-3 py-2 rounded-lg border border-white/10 text-[10px] hover:bg-white/10"><i class="fa-solid fa-download mr-1"></i> 내려받기</a>` : ""}
          ${isManager() ? `<label class="px-3 py-2 rounded-lg border border-emerald-400/20 text-[10px] text-emerald-300 cursor-pointer">업로드<input id="projectFileInput" type="file" class="hidden"></label>` : ""}
        </div>
      </div>
      <div id="uploadState" class="hidden text-[10px] text-emerald-300 mt-3"></div>
    </div>

    <div class="glass-panel rounded-xl p-4">
      <small class="text-[9px] font-mono text-emerald-400">REVIEW NOTE</small>
      <div id="commentItems" class="space-y-3 mt-3">
        ${comments.length ? comments.map(commentMarkup).join("") : '<p class="text-xs text-white/35">아직 등록된 피드백이 없습니다.</p>'}
      </div>
      <form id="commentForm" class="comment-form mt-4 flex gap-2">
        <input id="commentInput" class="glass-input rounded-lg px-3 py-2 text-xs outline-none flex-1" placeholder="피드백을 입력하세요">
        <button class="rounded-lg bg-white text-slate-950 px-4 text-[10px] font-bold">등록</button>
      </form>
    </div>`;

  $("#commentForm").onsubmit = addComment;
  const fileInput = $("#projectFileInput");
  if (fileInput) fileInput.onchange = event => uploadFile(event.target.files[0], project);
}

function listenComments(projectId) {
  state.commentUnsubscribe?.();
  const commentQuery = query(
    collection(db, "loindWorks_projects", projectId, "comments"),
    orderBy("createdAt", "asc")
  );

  state.commentUnsubscribe = onSnapshot(commentQuery, snapshot => {
    const project = state.projects.find(item => item.id === projectId);
    if (!project) return;

    project._comments = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(comment => isManager() || !comment.internalOnly);

    if (state.selected === projectId) renderDetail(project);
  });
}

function listenFiles(projectId) {
  state.fileUnsubscribe?.();
  const fileQuery = query(
    collection(db, "loindWorks_projects", projectId, "files"),
    orderBy("createdAt", "desc")
  );

  state.fileUnsubscribe = onSnapshot(fileQuery, snapshot => {
    const project = state.projects.find(item => item.id === projectId);
    if (!project) return;

    project._files = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (state.selected === projectId) renderDetail(project);
  });
}

async function addComment(event) {
  event.preventDefault();
  const input = $("#commentInput");
  const text = input.value.trim();
  if (!text || !state.selected) return;

  await addDoc(collection(db, "loindWorks_projects", state.selected, "comments"), {
    text,
    authorId: state.user.uid,
    authorName: state.profile.name || state.user.email,
    role: state.profile.role,
    internalOnly: false,
    createdAt: serverTimestamp()
  });

  const project = state.projects.find(item => item.id === state.selected);
  await addActivity(project, `${state.profile.name || state.user.email}님이 피드백을 등록했습니다.`);
  input.value = "";
}

async function uploadFile(file, project) {
  if (!file || !isManager()) return;

  const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-가-힣]/g, "_")}`;
  const storageReference = ref(storage, `loind-works/projects/${project.id}/${safeName}`);
  const task = uploadBytesResumable(storageReference, file);
  const uploadState = $("#uploadState");

  uploadState.classList.remove("hidden");
  uploadState.textContent = "업로드 준비 중…";

  task.on("state_changed", snapshot => {
    const percent = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
    uploadState.textContent = `업로드 ${percent}%`;
  }, error => {
    uploadState.textContent = `업로드 실패: ${error.message}`;
  }, async () => {
    const url = await getDownloadURL(task.snapshot.ref);
    await addDoc(collection(db, "loindWorks_projects", project.id, "files"), {
      name: file.name,
      url,
      storagePath: task.snapshot.ref.fullPath,
      size: file.size,
      uploadedBy: state.user.uid,
      uploadedByName: state.profile.name || state.user.email,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "loindWorks_projects", project.id), {
      updatedAt: serverTimestamp()
    });
    await addActivity(project, `${file.name} 파일을 업로드했습니다.`);
    uploadState.textContent = "업로드 완료";
  });
}

function listenActivity() {
  const activityQuery = query(
    collection(db, "loindWorks_activity"),
    orderBy("createdAt", "desc"),
    limit(30)
  );

  onSnapshot(activityQuery, snapshot => {
    const items = snapshot.docs.map(item => item.data());
    $("#activityList").innerHTML = items.length
      ? items.map(item => `
        <div class="p-5 flex gap-4">
          <time class="font-mono text-[10px] text-white/25">${formatDate(item.createdAt)}</time>
          <div><p class="text-sm">${escapeHtml(item.message || "")}</p><small class="text-white/30">${escapeHtml(item.projectTitle || "")}</small></div>
        </div>`).join("")
      : '<p class="p-5 text-xs text-white/35">최근 활동이 없습니다.</p>';
  });
}

function listenPeople() {
  const peopleQuery = query(collection(db, "loindWorks_users"), orderBy("name"));
  onSnapshot(peopleQuery, snapshot => {
    let people = snapshot.docs.map(item => item.data());
    if (!isManager()) {
      people = people.filter(person => person.email === state.user.email || ["manager", "admin"].includes(person.role));
    }

    $("#peopleList").innerHTML = people.length
      ? people.map(person => `
        <article class="glass-card rounded-2xl p-5">
          <span class="text-[9px] font-mono text-emerald-400">${escapeHtml((person.role || "client").toUpperCase())}</span>
          <b class="block text-xl mt-5">${escapeHtml(person.name || "-")}</b>
          <p class="text-xs text-white/40 mt-1">${escapeHtml(person.company || person.email || "")}</p>
        </article>`).join("")
      : '<p class="text-xs text-white/35">표시할 참여자가 없습니다.</p>';
  });
}

async function addActivity(project, message) {
  await addDoc(collection(db, "loindWorks_activity"), {
    projectId: project.id,
    projectTitle: project.title,
    actorId: state.user.uid,
    actorName: state.profile.name || state.user.email,
    message,
    createdAt: serverTimestamp()
  });
}

function bindNavigation() {
  $$(".nav-btn").forEach(button => {
    button.onclick = () => {
      $$(".nav-btn").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      $$(".workspace-view").forEach(view => view.classList.add("hidden"));
      $(`#${button.dataset.view}View`).classList.remove("hidden");
    };
  });

  $$(".side-filter").forEach(button => {
    button.onclick = () => {
      $$(".side-filter").forEach(item => item.classList.remove("active", "bg-emerald-400/10", "border-emerald-400/20"));
      button.classList.add("active", "bg-emerald-400/10", "border-emerald-400/20");
      state.filter = button.dataset.filter;
      renderProjectList();
    };
  });

  $("#search").oninput = event => {
    state.search = event.target.value.trim().toLowerCase();
    renderProjectList();
  };

  $("#logout").onclick = () => signOut(auth);
}

function updateCounts() {
  $("#countAll").textContent = state.projects.length;
  $("#countReview").textContent = state.projects.filter(project => normalizeType(project.status) === "review").length;
  $("#countProgress").textContent = state.projects.filter(project => normalizeType(project.status) === "progress").length;
  $("#countDone").textContent = state.projects.filter(project => normalizeType(project.status) === "done").length;
}

function normalizeType(status) {
  if (status === "review") return "review";
  if (status === "done") return "done";
  return "progress";
}

function statusText(status) {
  return ({
    planning: "설계 중",
    progress: "진행 중",
    review: "확인 요청",
    done: "완료"
  })[status] || "진행 중";
}

function shortDate(value) {
  return value ? value.slice(5).replace("-", ".") : "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = value.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function commentMarkup(comment) {
  return `
    <div class="border-t border-white/5 pt-3">
      <div class="flex justify-between gap-3">
        <b class="text-xs">${escapeHtml(comment.authorName || "사용자")}</b>
        <time class="text-[9px] text-white/25">${formatDate(comment.createdAt)}</time>
      </div>
      <p class="text-sm leading-6 mt-1">${escapeHtml(comment.text || "")}</p>
    </div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}
