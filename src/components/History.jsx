import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { playExport } from "../utils/soundEffects";

export default function History({ onBack }) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate("/billing"));
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const snapshot = await getDocs(collection(db, "bills"));

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      setBills(data);
    } catch (error) {
      console.error("Error fetching bills:", error);
    }
  };

  // 🔍 Filter
  const filteredBills = bills.filter((bill) =>
    (bill.uid || "").toLowerCase().includes(search.toLowerCase()) ||
    (bill.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (bill.mobile || "").includes(search)
  );

  const uniquePatientCount = new Set(
    filteredBills.map((bill) => bill.uid || bill.id)
  ).size;

  // 💰 Total revenue
  const totalRevenue = filteredBills.reduce(
    (sum, bill) => sum + Number(bill.finalAmount || 0),
    0
  );

  const getServiceDetails = (bill) => {
    const services = [];

    if (bill.consultation) {
      services.push(`Consultation ₹${bill.consultationAmount || 0}`);
    }
    if (bill.endoscopy) {
      services.push(`Endoscopy ₹${bill.endoscopyAmount || 0}`);
    }
    if (bill.fibroscan) {
      services.push(`Fibroscan ₹${bill.fibroscanAmount || 0}`);
    }
    if (bill.colonoscopy) {
      services.push(`Colonoscopy ₹${bill.colonoscopyAmount || 0}`);
    }
    if (bill.other) {
      services.push(`${bill.other} ₹${bill.otherAmount || 0}`);
    }

    return services.length > 0 ? services.join(", ") : "None";
  };

  const exportToGoogleSheets = async () => {
    const exportData = filteredBills.map((bill) => ({
      UID: bill.uid || "N/A",
      Name: bill.name || "N/A",
      Mobile: bill.mobile || "N/A",
      Age: bill.age || "N/A",
      Date: bill.date || "N/A",
      Referral: bill.referral || "N/A",
      Services: getServiceDetails(bill),
      PaymentMode: bill.paymentMode || "N/A",
      Total: bill.total || 0,
      Discount: bill.discount || 0,
      FinalAmount: bill.finalAmount || 0
    }));

    // Create CSV content
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers.map((header) => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          return typeof value === "string" && value.includes(",")
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(",")
      )
    ].join("\n");

    // Download CSV file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinic_bills_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    playExport();
    alert("Bills exported to CSV successfully!");
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <div>
          <button className="history-back-btn" onClick={handleBack}>
            Back to Form
          </button>
          <Link to="/" className="home-link" title="Home">
            🏠
          </Link>
          <h1 className="history-title">Clinic Admin Dashboard</h1>
        </div>
      </div>

      <div className="history-controls">
        <input
          className="history-search"
          type="text"
          placeholder="Search by UID, name or mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="primary-btn export-btn" onClick={exportToGoogleSheets}>
          📥 Export to CSV
        </button>
      </div>

      <div className="history-stats">
        <div className="stat-card">
          <span>Total Unique Patients</span>
          <strong>{uniquePatientCount}</strong>
        </div>
        <div className="stat-card">
          <span>Total Revenue</span>
          <strong>₹{totalRevenue}</strong>
        </div>
      </div>

      {/* 📋 Table */}
      <div className="history-table-wrapper">
      <table className="history-table" width="100%" border="1" cellPadding="10">
        <thead style={{ background: "#f2f2f2" }}>
          <tr>
            <th>UID</th>
            <th>Name</th>
            <th>Mobile</th>
            <th>Age</th>
            <th>Date</th>
            <th>Referral</th>
            <th>Services</th>
            <th>Payment</th>
            <th>Total</th>
            <th>Discount</th>
            <th>Final Amount</th>
          </tr>
        </thead>

        <tbody>
          {filteredBills.map((bill) => (
            <tr key={bill.id}>
              <td>{bill.uid || "N/A"}</td>
              <td>{bill.name}</td>
              <td>{bill.mobile}</td>
              <td>{bill.age}</td>
              <td>{bill.date || "N/A"}</td>
              <td>{bill.referral || "N/A"}</td>
              <td>{getServiceDetails(bill)}</td>
              <td>{bill.paymentMode}</td>
              <td>₹{bill.total}</td>
              <td>₹{bill.discount || 0}</td>
              <td>₹{bill.finalAmount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

    </div>
  );
}