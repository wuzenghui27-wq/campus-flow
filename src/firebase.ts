import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7GUixwc6X-cxS0xsRbeMKGlCUeUaIrm8",
  authDomain: "compus-flow.firebaseapp.com",
  projectId: "compus-flow",
  storageBucket: "compus-flow.firebasestorage.app",
  messagingSenderId: "703259621882",
  appId: "1:703259621882:web:24ab19b56e58b6ba618c43",
};

// Reuse the app during development.
// 开发时复用已初始化的 Firebase 应用。
const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);