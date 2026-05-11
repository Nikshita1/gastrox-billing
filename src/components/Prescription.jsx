import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { fetchPatientByUID, findNextAvailableUID, searchPatientsByName, searchPatientsByPhone } from "../utils/patientUtils";
import { exportToGoogleSheets } from "../utils/googleSheetsExport";

export default function Prescription() {
  const navigate = useNavigate();

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    uid: "",
    name: "",
    age: "",
    mobile: "",
    sex: "",
    weight: "",
    address: "",
    date: getTodayDate(),
    prescription: "",
    notes: ""
  });
  const [loadingNextUID, setLoadingNextUID] = useState(false);
  const [loadingCheckUID, setLoadingCheckUID] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchType, setSearchType] = useState(""); // "name" or "phone"

  useEffect(() => {
    const loadPatient = async () => {
      if (!formData.uid) return;
      const patient = await fetchPatientByUID(formData.uid);
      if (patient) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || patient.name,
          age: prev.age || patient.age,
          mobile: prev.mobile || patient.mobile,
          sex: prev.sex || patient.sex,
          weight: prev.weight || "",
          address: prev.address || patient.address,
          referral: prev.referral || patient.referral,
          date: prev.date || patient.date
        }));
      }
    };

    loadPatient();
  }, [formData.uid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Allow only numeric values for age, weight, and mobile
    if ((name === "age" || name === "weight" || name === "mobile") && value !== "") {
      if (!/^\d+$/.test(value)) {
        return; // Ignore non-numeric input
      }
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validateForm = () => {
    const requiredFields = ["uid", "name", "age", "mobile", "sex", "address", "date"];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === "") {
        missingFields.push(field.charAt(0).toUpperCase() + field.slice(1));
      }
    }

    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields:\n${missingFields.join(", ")}`);
      return false;
    }
    return true;
  };

  const handleReset = () => {
    setFormData({
      uid: "",
      name: "",
      age: "",
      mobile: "",
      sex: "",
      weight: "",
      address: "",
      date: getTodayDate(),
      prescription: "",
      notes: ""
    });
  };

  const handleCheckUID = async () => {
    if (!formData.uid) {
      alert("Please enter a UID first");
      return;
    }

    setLoadingCheckUID(true);
    try {
      const patient = await fetchPatientByUID(formData.uid);
      if (patient) {
        setFormData((prev) => ({
          ...prev,
          name: patient.name || "",
          age: patient.age || "",
          mobile: patient.mobile || "",
          sex: patient.sex || "",
          address: patient.address || "",
          date: patient.date || ""
        }));
        alert("Patient details loaded successfully!");
      } else {
        alert("No existing patient data found for this UID. Ready for new patient entry.");
        // Clear form for new patient
        setFormData((prev) => ({
          ...prev,
          name: "",
          age: "",
          mobile: "",
          sex: "",
          weight: "",
          address: "",
          date: "",
          prescription: "",
          notes: ""
        }));
      }
    } catch (error) {
      console.error("Error checking UID:", error);
      alert("Error checking UID. Please try again.");
    } finally {
      setLoadingCheckUID(false);
    }
  };

  const handleSearchByName = async () => {
    if (!formData.name || formData.name.trim().length === 0) {
      alert("Please enter a patient name to search");
      return;
    }

    setLoadingSearch(true);
    setSearchType("name");
    try {
      const results = await searchPatientsByName(formData.name);
      setSearchResults(results);
      if (results.length === 0) {
        alert("No patients found with that name");
      } else {
        setShowSearchModal(true);
      }
    } catch (error) {
      console.error("Error searching by name:", error);
      alert("Error searching for patients");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearchByPhone = async () => {
    if (!formData.mobile || formData.mobile.trim().length === 0) {
      alert("Please enter a phone number to search");
      return;
    }

    setLoadingSearch(true);
    setSearchType("phone");
    try {
      const results = await searchPatientsByPhone(formData.mobile);
      setSearchResults(results);
      if (results.length === 0) {
        alert("No patients found with that phone number");
      } else {
        setShowSearchModal(true);
      }
    } catch (error) {
      console.error("Error searching by phone:", error);
      alert("Error searching for patients");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setFormData((prev) => ({
      ...prev,
      uid: patient.uid || "",
      name: patient.name || "",
      age: patient.age || "",
      mobile: patient.mobile || "",
      sex: patient.sex || "",
      address: patient.address || "",
      date: patient.date || ""
    }));
    setShowSearchModal(false);
    alert("Patient details loaded successfully!");
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return false;
    }

    try {
      await addDoc(collection(db, "prescriptions"), {
        ...formData,
        createdAt: new Date()
      });
      
      // Also export to Google Sheets
      await exportToGoogleSheets(formData, "prescription");
      
      alert("Prescription saved.");
      return true;
    } catch (error) {
      console.error("Error saving prescription:", error);
      return false;
    }
  };

  const handleContinueToBilling = () => {
    if (!validateForm()) {
      return;
    }
    navigate("/billing", { state: { patient: formData } });
  };

  const handleNextUID = async () => {
    setLoadingNextUID(true);
    try {
      const currentUID = formData.uid || "GX-000"; // Start from GX-000 if empty
      const nextUID = await findNextAvailableUID(currentUID);
      if (nextUID) {
        setFormData((prev) => ({
          ...prev,
          uid: nextUID,
          name: "",
          age: "",
          mobile: "",
          sex: "",
          weight: "",
          address: "",
          date: getTodayDate(),
          prescription: "",
          notes: ""
        }));
        // The useEffect will trigger automatically when uid changes and auto-populate if patient exists
      }
    } catch (error) {
      console.error("Error finding next UID:", error);
      alert("Error finding next UID");
    } finally {
      setLoadingNextUID(false);
    }
  };

  const formatPrintDate = (value) => {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleDateString("en-GB");
  };

  const printDate = formatPrintDate(formData.date);

  return (
    <div className="form-container">
      <div className="prescription-header-wrapper">
        <img src="/hero.png" alt="Clinic header" className="clinic-logo" />
        <Link to="/" className="home-link-header" title="Home">
          🏠
        </Link>
      </div>
      
      <div className="clinic-header">
        <div>
          <h1>Prescription</h1>
          <p>Fill out patient details.</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="uid-input-group">
          <input type="text" name="uid" placeholder="UID" value={formData.uid} onChange={handleChange} />
          <button 
            type="button" 
            className="check-uid-btn" 
            onClick={handleCheckUID}
            disabled={loadingCheckUID || !formData.uid}
            title="Check if patient exists and auto-fill details"
          >
            {loadingCheckUID ? "Checking..." : "Check"}
          </button>
          <button 
            type="button" 
            className="next-uid-btn" 
            onClick={handleNextUID}
            disabled={loadingNextUID}
            title="Find next available UID (auto-populates existing patient data)"
          >
            {loadingNextUID ? "Loading..." : "Next UID"}
          </button>
        </div>
        <div className="search-input-group">
          <input type="text" name="name" placeholder="Patient Name" value={formData.name} onChange={handleChange} />
          <button 
            type="button" 
            className="search-btn" 
            onClick={handleSearchByName}
            disabled={loadingSearch || !formData.name}
            title="Search by name"
          >
            🔍
          </button>
        </div>
        <input type="text" name="age" placeholder="Age" value={formData.age} onChange={handleChange} />
        <input type="text" name="weight" placeholder="Weight" value={formData.weight} onChange={handleChange} />
        <div className="search-input-group">
          <input type="text" name="mobile" placeholder="Mobile Number" value={formData.mobile} onChange={handleChange} />
          <button 
            type="button" 
            className="search-btn" 
            onClick={handleSearchByPhone}
            disabled={loadingSearch || !formData.mobile}
            title="Search by phone"
          >
            🔍
          </button>
        </div>
        <input type="text" name="address" placeholder="Address" value={formData.address} onChange={handleChange} />
        <input type="date" name="date" value={formData.date} onChange={handleChange} />

        <div className="radio-group">
          <label>
            <input type="radio" name="sex" value="Male" checked={formData.sex === "Male"} onChange={handleChange} /> Male
          </label>
          <label>
            <input type="radio" name="sex" value="Female" checked={formData.sex === "Female"} onChange={handleChange} /> Female
          </label>
          <label>
            <input type="radio" name="sex" value="Other" checked={formData.sex === "Other"} onChange={handleChange} /> Other
          </label>
        </div>
      </div>

      <div className="button-group">
        <button className="reset-btn" type="button" onClick={handleReset}>
          Reset
        </button>
        <button className="proceed-btn" type="button" onClick={async () => { const saved = await handleSave(); if (saved) { setTimeout(() => window.print(), 500); } }}>
          Save & Print
        </button>
        <button className="proceed-btn" type="button" onClick={handleContinueToBilling}>
          Continue to Billing
        </button>
      </div>

      <div className="prescription-print-layout">
        <div className="prescription-page">
          <img className="prescription-bg" src="/prescription-template.png" alt="Prescription template" />
          <div className="print-field print-name">
            <strong>{formData.name || ""}</strong>
          </div>
          <div className="print-field print-uid">
            <strong>{formData.uid || ""}</strong>
          </div>
          <div className="print-field print-phone">
            <strong>{formData.mobile || ""}</strong>
          </div>
          <div className="print-field print-age">
            <strong>{formData.age || ""}</strong>
          </div>
          <div className="print-field print-sex">
            <strong>{formData.sex || ""}</strong>
          </div>
          <div className="print-field print-weight">
            <strong>{formData.weight || ""}</strong>
          </div>
          <div className="print-field print-date">
            <strong>{printDate}</strong>
          </div>
          <div className="print-field print-address">
            <strong>{formData.address || ""}</strong>
          </div>
          <div className="print-field print-rx-text">
            <pre>{formData.prescription || ""}</pre>
          </div>
        </div>
      </div>

      {/* Search Results Modal */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Patient</h2>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setShowSearchModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {searchResults.length === 0 ? (
                <p>No patients found</p>
              ) : (
                <div className="search-results-list">
                  {searchResults.map((patient) => (
                    <div 
                      key={patient.id} 
                      className="search-result-item"
                      onClick={() => handleSelectPatient(patient)}
                    >
                      <div className="result-main">
                        <strong>{patient.name}</strong>
                        <span className="result-uid">{patient.uid}</span>
                      </div>
                      <div className="result-sub">
                        <span>📱 {patient.mobile}</span>
                        <span>👤 Age: {patient.age}</span>
                        <span>🏠 {patient.address}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
