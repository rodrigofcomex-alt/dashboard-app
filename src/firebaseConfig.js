import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBDNtMjdV9HvSq6myB4qqRXPfnX8PlKkZE",
  authDomain: "emphasis-dashboard.firebaseapp.com",
  projectId: "emphasis-dashboard",
  storageBucket: "emphasis-dashboard.firebasestorage.app",
  messagingSenderId: "328977617315",
  appId: "1:328977617315:web:9def6365c3d732b2428a16"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
