import { Link } from "react-router-dom";

export default function Home() {
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
        <Link to="/prescription" className="hero-btn green-btn">
          New Prescription
        </Link>

        <Link to="/billing" className="hero-btn blue-btn">
          Direct Billing
        </Link>

        <Link to="/followups" className="hero-btn orange-btn">
          📋 Followups
        </Link>
      </div>

    </div>
  );
}