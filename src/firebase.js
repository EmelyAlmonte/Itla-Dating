import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDlB-yywyHqW_rcyyzhrUNa94HpeLaVjuE",
  authDomain: "itla-dating.firebaseapp.com",
  projectId: "itla-dating",
  storageBucket: "itla-dating.firebasestorage.app",
  messagingSenderId: "22535740539",
  appId: "1:22535740539:web:2ce5cada47770d36c296de",
  measurementId: "G-GV7T7E3NQK"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);