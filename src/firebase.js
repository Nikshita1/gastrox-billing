import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAX5XY1HiIf0nuBTEZF19supnkR9byu6-o",
  authDomain: "clinic-billing.firebaseapp.com",
  projectId: "clinic-billing",
  storageBucket: "clinic-billing.firebasestorage.app",
  messagingSenderId: "375073544481",
  appId: "1:375073544481:web:648738a93535f09b468660"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);