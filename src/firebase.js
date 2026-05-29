import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
