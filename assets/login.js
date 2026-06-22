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
const openContactButton = document.querySelector("#openContact");
const backLoginButton = document.querySelector("#backLogin");
const contactForm = document.querySelector("#contactForm");

if (
  !loginView ||
  !contactView ||
  !loginForm ||
  !loginId ||
  !loginPw ||
  !loginError
) {
  throw new Error("로그인 화면에 필요한 HTML 요소를 찾을 수 없습니다.");
}

/*
  type="submit" 버튼이 없더라도
  로그인 폼 내부의 첫 번째 버튼을 대신 사용한다.
*/
const loginButton =
  loginForm.querySelector('button[type="submit"]') ||
  loginForm.querySelector("button");

if (!loginButton) {
  throw new Error("로그인 버튼을 찾을 수 없습니다.");
}

if (openContactButton) {
  openContactButton.addEventListener("click", () => {
    loginView.classList.remove("active");
    contactView.classList.add("active");
  });
}

if (backLoginButton) {
  backLoginButton.addEventListener("click", () => {
    contactView.classList.remove("active");
    loginView.classList.add("active");
  });
}

document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".category").forEach(item => {
      item.classList.remove(
        "border-emerald-400",
        "bg-emerald-400/10"
      );
    });

    button.classList.add(
      "border-emerald-400",
      "bg-emerald-400/10"
    );
  });
});

onAuthStateChanged(auth, user => {
  if (user) {
    location.replace("./work.html");
  }
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = loginId.value.trim();
  const password = loginPw.value;

  hideMessage();

  if (!email || !password) {
    showMessage(
      "이메일과 비밀번호를 모두 입력해 주세요.",
      "error"
    );
    return;
  }

  setLoginLoading(true);

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    await ensureProfile(credential.user);

    location.replace("./work.html");
  } catch (error) {
    console.error("Firebase login error:", error);

    const messages = {
      "auth/invalid-email":
        "이메일 형식이 올바르지 않습니다.",

      "auth/invalid-credential":
        "이메일 또는 비밀번호가 올바르지 않습니다.",

      "auth/user-disabled":
        "사용이 중지된 계정입니다.",

      "auth/too-many-requests":
        "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",

      "auth/network-request-failed":
        "네트워크 연결을 확인해 주세요.",

      "auth/operation-not-allowed":
        "Firebase에서 이메일/비밀번호 로그인을 활성화해 주세요."
    };

    showMessage(
      messages[error.code] ||
        `로그인에 실패했습니다. (${error.code || "unknown"})`,
      "error"
    );
  } finally {
    setLoginLoading(false);
  }
});

async function ensureProfile(user) {
  const userRef = doc(
    db,
    "loindWorks_users",
    user.uid
  );

  const userSnapshot = await getDoc(userRef);

  if (userSnapshot.exists()) {
    return;
  }

  await setDoc(userRef, {
    name:
      user.displayName ||
      user.email?.split("@")[0] ||
      "사용자",

    email: user.email || "",
    company: "",
    role: "client",
    createdAt: serverTimestamp()
  });
}

function setLoginLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading
    ? "로그인 중…"
    : "로그인";
}

function showMessage(message, type = "error") {
  loginError.textContent = message;
  loginError.classList.remove("hidden");

  if (type === "success") {
    loginError.classList.remove("text-rose-300");
    loginError.classList.add("text-emerald-300");
  } else {
    loginError.classList.remove("text-emerald-300");
    loginError.classList.add("text-rose-300");
  }
}

function hideMessage() {
  loginError.textContent = "";
  loginError.classList.add("hidden");
}

const resetButton = document.createElement("button");

resetButton.type = "button";
resetButton.className =
  "text-[10px] text-white/35 hover:text-emerald-300 underline underline-offset-4";

resetButton.textContent = "비밀번호 재설정";

loginForm.appendChild(resetButton);

resetButton.addEventListener("click", async () => {
  const email = loginId.value.trim();

  if (!email) {
    showMessage(
      "비밀번호를 재설정할 이메일을 먼저 입력해 주세요.",
      "error"
    );

    loginId.focus();
    return;
  }

  resetButton.disabled = true;
  resetButton.textContent = "전송 중…";

  try {
    await sendPasswordResetEmail(auth, email);

    showMessage(
      "비밀번호 재설정 메일을 보냈습니다.",
      "success"
    );
  } catch (error) {
    console.error("Password reset error:", error);

    showMessage(
      "비밀번호 재설정 메일을 보내지 못했습니다.",
      "error"
    );
  } finally {
    resetButton.disabled = false;
    resetButton.textContent = "비밀번호 재설정";
  }
});

if (contactForm) {
  contactForm.addEventListener("submit", event => {
    event.preventDefault();

    alert("프로젝트 의뢰가 접수되었습니다.");

    contactForm.reset();

    if (backLoginButton) {
      backLoginButton.click();
    }
  });
}
```
