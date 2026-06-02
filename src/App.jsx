import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Home from "./components/Home";
import BillingForm from "./components/BillingForm";
import Prescription from "./components/Prescription";
import History from "./components/History";
import FollowupTracker from "./components/FollowupTracker";
import ProtectedRoute from "./components/ProtectedRoute";
import "./index.css";

export default function App() {
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
        <Route path="/billing" element={<BillingForm />} />
        <Route path="/prescription" element={<Prescription />} />
        <Route path="/followups" element={<FollowupTracker />} />
        <Route path="/history" element={<ProtectedRoute component={History} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}