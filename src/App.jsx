import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/Home";
import BillingForm from "./components/BillingForm";
import Prescription from "./components/Prescription";
import History from "./components/History";
import ProtectedRoute from "./components/ProtectedRoute";
import "./index.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/billing" element={<BillingForm />} />
      <Route path="/prescription" element={<Prescription />} />
      <Route path="/history" element={<ProtectedRoute component={History} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}