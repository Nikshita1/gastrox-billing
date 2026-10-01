import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { playExport } from "../utils/soundEffects";

const parseBillDate = (value) => {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) return directDate;

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

const getMonthKey = (value) => {
  const parsed = parseBillDate(value);
  if (!parsed) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthLabel = (monthKey) => {
  if (!monthKey) return "No date";

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
};

export default function History({ onBack }) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate("/billing"));
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");

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

      const sorted = [...data].sort((a, b) => {
        const aDate = parseBillDate(a.date)?.getTime?.() ?? 0;
        const bDate = parseBillDate(b.date)?.getTime?.() ?? 0;
        return bDate - aDate;
      });

      setBills(sorted);
      const latestMonth = sorted
        .map((bill) => getMonthKey(bill.date))
        .filter(Boolean)
        .sort()
        .at(-1);

      if (latestMonth) {
        setSelectedMonth((current) => current === "all" ? latestMonth : current);
      }
    } catch (error) {
      console.error("Error fetching bills:", error);
    }
  };

  const monthOptions = useMemo(() => {
    const unique = new Set(
      bills
        .map((bill) => getMonthKey(bill.date))
        .filter(Boolean)
    );

    return [...unique].sort((a, b) => b.localeCompare(a));
  }, [bills]);

  const filteredByMonth = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") {
      return bills;
    }

    return bills.filter((bill) => getMonthKey(bill.date) === selectedMonth);
  }, [bills, selectedMonth]);

  const filteredBills = useMemo(() =>
    filteredByMonth.filter((bill) => {
      const searchValue = search.trim().toLowerCase();
      if (!searchValue) return true;

      return (
        (bill.uid || "").toLowerCase().includes(searchValue) ||
        (bill.name || "").toLowerCase().includes(searchValue) ||
        (bill.mobile || "").toLowerCase().includes(searchValue)
      );
    }),
    [filteredByMonth, search]
  );

  const uniquePatientCount = new Set(
    filteredBills.map((bill) => bill.uid || bill.id)
  ).size;

  const totalRevenue = filteredBills.reduce(
    (sum, bill) => sum + Number(bill.finalAmount || 0),
    0
  );

  const monthlySummary = useMemo(() => {
    const summaryMap = new Map();

    bills.forEach((bill) => {
      const monthKey = getMonthKey(bill.date);
      if (!monthKey) return;

      const current = summaryMap.get(monthKey) || { revenue: 0, patients: new Set() };
      current.revenue += Number(bill.finalAmount || 0);
      current.patients.add(bill.uid || bill.id);
      summaryMap.set(monthKey, current);
    });

    return [...summaryMap.entries()]
      .map(([monthKey, value]) => ({
        monthKey,
        label: getMonthLabel(monthKey),
        revenue: value.revenue,
        patients: value.patients.size
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [bills]);

  const currentMonthSummary = monthlySummary.find((item) => item.monthKey === selectedMonth) || {
    label: selectedMonth === "all" ? "All time" : getMonthLabel(selectedMonth),
    revenue: totalRevenue,
    patients: uniquePatientCount
  };

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
    if (bill.sigmoidoscopy) {
      services.push(`Sigmoidoscopy ₹${bill.sigmoidoscopyAmount || 0}`);
    }
    if (bill.ecg) {
      services.push(`ECG ₹${bill.ecgAmount || 0}`);
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

    if (!exportData.length) {
      alert("No data available to export for the selected month.");
      return;
    }

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers.map((header) => {
          const value = row[header];
          return typeof value === "string" && value.includes(",")
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinic_bills_${selectedMonth === "all" ? "all" : selectedMonth}.csv`;
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

        <select
          className="history-month-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          <option value="all">All Months</option>
          {monthOptions.map((monthKey) => (
            <option key={monthKey} value={monthKey}>
              {getMonthLabel(monthKey)}
            </option>
          ))}
        </select>

        <button className="primary-btn export-btn" onClick={exportToGoogleSheets}>
          📥 Export to CSV
        </button>
      </div>

      <div className="history-stats">
        <div className="stat-card">
          <span>{selectedMonth === "all" ? "Total Unique Patients" : `${getMonthLabel(selectedMonth)} Patients`}</span>
          <strong>{uniquePatientCount}</strong>
        </div>
        <div className="stat-card">
          <span>{selectedMonth === "all" ? "Total Revenue" : `${getMonthLabel(selectedMonth)} Revenue`}</span>
          <strong>₹{totalRevenue}</strong>
        </div>
      </div>

      <div className="month-breakdown">
        {monthlySummary.slice(0, 6).map((month) => (
          <button
            key={month.monthKey}
            type="button"
            className={`month-pill ${selectedMonth === month.monthKey ? "active" : ""}`}
            onClick={() => setSelectedMonth(month.monthKey)}
          >
            <span>{month.label}</span>
            <strong>₹{month.revenue}</strong>
          </button>
        ))}
      </div>

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
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan="11" className="empty-table-state">
                  No billing records found for this month and search filter.
                </td>
              </tr>
            ) : (
              filteredBills.map((bill) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="monthly-summary-footer">
        <span>{currentMonthSummary.label}</span>
        <strong>₹{currentMonthSummary.revenue}</strong>
        <small>{currentMonthSummary.patients} patients</small>
      </div>
    </div>
  );
}