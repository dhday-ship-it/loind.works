import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const loginView = document.querySelector("#loginView");
const contactView = document.querySelector("#contactView");
const loginForm = document.querySelector("#loginForm");
const loginId = document.querySelector("#loginId");
const loginPw = document.querySelector("#loginPw");
const loginError = document.querySelector("#loginError");
const loginButton = loginForm.querySelector("button[type='submit']");

document.querySelector("#openContact").onclick = () => {
  loginView.classList.remove("active");
  contactView.classList.add("active");
};

document.querySelector("#backLogin").onclick = () => {
  contactView.classList.remove("active");
  loginView.classList.add("active");
};

document.querySelectorAll(".category").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".category").forEach(item => {
      item.classList.remove("border-emerald-400", "bg-emerald-400/10");
    });
    button.classList.add("border-emerald-400", "bg-emerald-400/10");
  };
});

onAuthStateChanged(auth, user => {
  if (user) location.replace("./work.html");
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = loginId.value.trim();
  const password = loginPw.value;
  loginError.classList.add("hidden");

  if (!email || !password) {
    showError("이메일과 비밀번호를 모두 입력해 주세요.");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "로그인 중…";

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureProfile(credential.user);
    location.replace("./work.html");
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
      "auth/too-many-requests": "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
      "auth/network-request-failed": "네트워크 연결을 확인해 주세요."
    };
    showError(messages[error.code] || "로그인에 실패했습니다.");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "로그인";
  }
});

async function ensureProfile(user) {
  const ref = doc(db, "loindWorks_users", user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      name: user.displayName || user.email.split("@")[0],
      email: user.email,
      company: "",
      role: "client",
      createdAt: serverTimestamp()
    });
  }
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

const resetButton = document.createElement("button");
resetButton.type = "button";
resetButton.className = "text-[10px] text-white/35 hover:text-emerald-300 underline underline-offset-4";
resetButton.textContent = "비밀번호 재설정";
loginForm.appendChild(resetButton);

resetButton.onclick = async () => {
  const email = loginId.value.trim();
  if (!email) {
    showError("비밀번호를 재설정할 이메일을 먼저 입력해 주세요.");
    loginId.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showError("비밀번호 재설정 메일을 보냈습니다.");
  } catch {
    showError("비밀번호 재설정 메일을 보내지 못했습니다.");
  }
};

document.querySelector("#contactForm").onsubmit = event => {
  event.preventDefault();
  alert("프로젝트 의뢰가 접수되었습니다.");
  event.target.reset();
  document.querySelector("#backLogin").click();
};
