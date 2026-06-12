import { useEffect, useState, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import "react-toastify/dist/ReactToastify.css";
import Home from "./components/Home";
import BillingForm from "./components/BillingForm";
import Prescription from "./components/Prescription";
import History from "./components/History";
import FollowupTracker from "./components/FollowupTracker";
import Receipt from "./components/Receipt";
import "./index.css";

// Protected Route Component
function ProtectedRoute({ component: Component }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return user ? <Component /> : <Navigate to="/" />;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const logoutTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Auto-logout after 30 minutes (in ms)
    const TIMEOUT = 30 * 60 * 1000;

    const clearLogoutTimer = () => {
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
        logoutTimer.current = null;
      }
    };

    const startLogoutTimer = () => {
      clearLogoutTimer();
      logoutTimer.current = setTimeout(async () => {
        try {
          if (auth.currentUser) {
            await signOut(auth);
            toast.info("Logged out due to 30 minutes of inactivity.");
            navigate("/");
          }
        } catch (err) {
          console.error("Auto-logout failed:", err);
        }
      }, TIMEOUT);
    };

    const resetTimer = () => {
      // Only start/reset timer if someone is signed in
      if (auth.currentUser) startLogoutTimer();
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));

    // Start the timer initially if user is signed in
    if (auth.currentUser) startLogoutTimer();

    return () => {
      clearLogoutTimer();
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [navigate]);

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <>
      <ToastContainer 
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/billing" element={<ProtectedRoute component={BillingForm} />} />
        <Route path="/prescription" element={<ProtectedRoute component={Prescription} />} />
        <Route path="/followups" element={<ProtectedRoute component={FollowupTracker} />} />
        <Route path="/history" element={<ProtectedRoute component={History} />} />
        <Route path="/receipt" element={<ProtectedRoute component={Receipt} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}