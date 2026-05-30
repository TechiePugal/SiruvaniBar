import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyClbuD1ZMDvqX3aH0MkU0VZi1Ih-XpAjEY",
  authDomain: "erpbars.firebaseapp.com",
  projectId: "erpbars",
  storageBucket: "erpbars.firebasestorage.app",
  messagingSenderId: "594795595377",
  appId: "1:594795595377:web:6a20cce971c57a2c1d3dd0",
  measurementId: "G-464LVF2GLD"
};

const app = initializeApp(firebaseConfig);

/* ──────────────────────────────────────────────────────────────────
   Initialize Auth with LOCAL persistence baked in from the start.
   browserLocalPersistence keeps the user signed in across page
   refreshes and browser restarts — the session only ends when the
   user explicitly clicks "Sign Out". This is the most reliable way
   to guarantee a refresh never logs the user out.
────────────────────────────────────────────────────────────────── */
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
