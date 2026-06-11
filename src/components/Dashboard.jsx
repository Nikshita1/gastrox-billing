import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to logout?")) return;

    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error logging out");
    }
  };

  return (
    <div className="home-container">
      <div className="home-wrapper">
        <div className="hero-section">
          <img src="/hero.png" alt="Clinic header" className="hero-image" />
          <div className="hero-overlay">
            <h1>Welcome to Clinic Billing System</h1>
            <p>Manage prescriptions, billing, and patient followups</p>
          </div>
        </div>

        <div className="hero-buttons">
          <Link to="/prescription" className="hero-btn blue-btn">
            📝 New Prescription
          </Link>
          <Link to="/billing" className="hero-btn green-btn">
            💰 Direct Billing
          </Link>
          <Link to="/followups" className="hero-btn orange-btn">
            📋 Followups
          </Link>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
