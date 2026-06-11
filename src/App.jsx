import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { onAuthStateChanged } from "firebase/auth";
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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