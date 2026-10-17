// Google 로그인 + Firebase(Firestore) 동기화
// 노트 데이터 위치: users/{로그인한 사용자 uid}/notes/{YYYY-MM-DD}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDocs, onSnapshot, setDoc, deleteDoc, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCARlGMvRV8IUAGoIk9913JzCmf5U4eJk",
  authDomain: "ten-core-note.firebaseapp.com",
  projectId: "ten-core-note",
  storageBucket: "ten-core-note.firebasestorage.app",
  messagingSenderId: "1040402473785",
  appId: "1:1040402473785:web:fa6efc1e313db207fc7ee8",
};
// Firebase 호스팅 주소에서 열면 같은 주소로 로그인 처리 (아이폰 사파리 로그인 문제 방지)
if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) firebaseConfig.authDomain = location.hostname;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 오프라인에서도 쓰고, 다시 연결되면 자동 업로드
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const $ = (id) => document.getElementById(id);
const statusEl = $("syncStatus");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");

// 권한 오류 등은 이후 오프라인 표시로 덮이지 않게 유지
let blockingError = false;
const permissionMsg = "접근 거부 — Firestore 규칙이 게시됐는지 확인하세요";

function setStatus(text, state = "") {
  if (blockingError && state !== "error") return;
  statusEl.textContent = text;
  statusEl.dataset.state = state;
}

let unsubscribe = null;
let notesCol = null;

// app.js가 수정된 날짜를 넘겨주면 서버에 저장
window.TenCoreCloud = {
  active: false,
  push(changes) {
    if (!notesCol) return;
    changes.forEach(({ key, data }) => {
      const ref = doc(notesCol, key);
      const job = data ? setDoc(ref, { ...data, updatedAt: serverTimestamp() }) : deleteDoc(ref);
      job.catch((err) => {
        console.error(err);
        setStatus("동기화 오류 — 잠시 후 다시 시도됩니다", "error");
      });
    });
  },
};

// 처음 로그인한 기기라면 이 기기에 있던 기록을 서버에 올림 (서버에 이미 있는 날짜는 건드리지 않음)
async function uploadLocalOnce(uid) {
  const flag = `tencore-uploaded-${uid}`;
  try { if (localStorage.getItem(flag)) return; } catch {}
  const local = window.TenCore.localNotes();
  const keys = Object.keys(local);
  if (keys.length) {
    const remote = new Set((await getDocs(notesCol)).docs.map((d) => d.id));
    const todo = keys.filter((k) => !remote.has(k));
    for (let i = 0; i < todo.length; i += 400) {
      const batch = writeBatch(db);
      todo.slice(i, i + 400).forEach((k) => batch.set(doc(notesCol, k), { ...local[k], updatedAt: serverTimestamp() }));
      await batch.commit();
    }
  }
  try { localStorage.setItem(flag, "1"); } catch {}
}

const strip = (data) => {
  const { updatedAt, ...rest } = data;
  return rest;
};

onAuthStateChanged(auth, async (user) => {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  window.TenCoreCloud.active = false;
  notesCol = null;
  blockingError = false;

  if (!user) {
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    setStatus("로그인하면 폰·노트북이 연동됩니다", "off");
    return;
  }

  loginBtn.hidden = true;
  logoutBtn.hidden = false;
  setStatus("동기화 준비 중…", "busy");
  notesCol = collection(db, "users", user.uid, "notes");

  try {
    await uploadLocalOnce(user.uid);
  } catch (err) {
    console.error(err);
    setStatus(err.code === "permission-denied" ? permissionMsg : "기존 기록 업로드 실패 — 새로고침 후 다시 시도하세요", "error");
    blockingError = true;
  }

  window.TenCoreCloud.active = true;
  window.TenCore.pushDirty(); // 로그인 전에 쓴 내용 전송

  let synced = false;
  // includeMetadataChanges: 내용이 같아도 '서버 연결됨' 상태 변화를 받기 위함
  unsubscribe = onSnapshot(notesCol, { includeMetadataChanges: true }, (snap) => {
    if (!synced && !snap.metadata.fromCache) {
      // 서버와 처음 연결됐을 때 전체를 서버 기준으로 맞춤
      synced = true;
      const remote = {};
      snap.docs.forEach((d) => { remote[d.id] = strip(d.data()); });
      window.TenCore.replaceAll(remote);
    } else {
      const changes = snap.docChanges()
        .filter((ch) => !ch.doc.metadata.hasPendingWrites) // 이 기기에서 보낸 변경은 제외
        .map((ch) => ({ key: ch.doc.id, data: ch.type === "removed" ? null : strip(ch.doc.data()) }));
      window.TenCore.applyRemote(changes);
    }
    const who = user.email || user.displayName || "";
    setStatus(snap.metadata.fromCache ? "오프라인 — 연결되면 자동 업로드" : `동기화됨 · ${who}`,
      snap.metadata.fromCache ? "busy" : "on");
  }, (err) => {
    console.error(err);
    setStatus(err.code === "permission-denied" ? permissionMsg : "동기화 오류 — " + err.code, "error");
    blockingError = true;
  });
});

loginBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // 팝업이 막힌 경우(일부 모바일 브라우저) 페이지 이동 방식으로 로그인
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(err.code)) {
      await signInWithRedirect(auth, provider);
    } else if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
      console.error(err);
      setStatus("로그인 실패: " + err.code, "error");
    }
  }
});

logoutBtn.addEventListener("click", () => {
  if (confirm("로그아웃할까요? 이 기기의 기록은 그대로 남습니다.")) signOut(auth);
});

getRedirectResult(auth).catch((err) => {
  console.error(err);
  setStatus("로그인 실패: " + err.code, "error");
});
