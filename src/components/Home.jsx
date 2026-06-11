import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "react-toastify";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.warning("Please enter email and password");
      return;
    }

    setIsAuthLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Logged in successfully!");
      }
      setShowLoginModal(false);
      setEmail("");
      setPassword("");
      setIsSignUp(false);
    } catch (error) {
      console.error("Auth error:", error);
      if (error.code === "auth/user-not-found") {
        toast.error("User not found. Please sign up first.");
      } else if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password.");
      } else if (error.code === "auth/email-already-in-use") {
        toast.error("Email already in use. Please log in.");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters.");
      } else {
        toast.error(error.message || "Authentication failed");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to logout?")) return;

    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error logging out");
    }
  };

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <div className="home-page">

      <video
        className="intro-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>

      <div className="hero-buttons">
        {!user ? (
          <button 
            className="hero-btn login-btn"
            onClick={() => setShowLoginModal(true)}
          >
            🔐 Login
          </button>
        ) : (
          <>
            <Link to="/prescription" className="hero-btn green-btn">
              📝 New Prescription
            </Link>

            <Link to="/billing" className="hero-btn blue-btn">
              💰 Direct Billing
            </Link>

            <Link to="/followups" className="hero-btn orange-btn">
              📋 Followups
            </Link>

            <button 
              className="hero-btn logout-btn"
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </>
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-header">
              <h2>{isSignUp ? "Sign Up" : "Login"}</h2>
              <button
                className="modal-close"
                onClick={() => setShowLoginModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogin} className="login-modal-form">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isAuthLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isAuthLoading}
                  required
                />
              </div>

              <button
                type="submit"
                className="login-modal-btn"
                disabled={isAuthLoading}
              >
                {isAuthLoading ? "Processing..." : isSignUp ? "Sign Up" : "Login"}
              </button>
            </form>

            <div className="login-modal-footer">
              <p>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <button
                  type="button"
                  className="toggle-mode-btn"
                  onClick={() => setIsSignUp(!isSignUp)}
                  disabled={isAuthLoading}
                >
                  {isSignUp ? "Login here" : "Sign up here"}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}