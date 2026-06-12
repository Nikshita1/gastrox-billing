import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, addDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { db } from "../firebase";
import { fetchPatientByUID, findNextAvailableUID, searchPatientsByName, searchPatientsByPhone } from "../utils/patientUtils";
import { exportToGoogleSheets } from "../utils/googleSheetsExport";
import { playSuccess, playError, playClick, playSave } from "../utils/soundEffects";

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
    notes: "",
    followupRequired: false,
    followupDate: "",
    followupReason: ""
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
      try {
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
          console.log("Patient data loaded for UID:", formData.uid);
        } else {
          console.log("No patient found for UID:", formData.uid);
        }
      } catch (error) {
        console.error("Error loading patient data:", error);
      }
    };

    loadPatient();
  }, [formData.uid]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Allow only numeric values for age, weight, and mobile
    if ((name === "age" || name === "weight" || name === "mobile") && value !== "") {
      if (!/^\d+$/.test(value)) {
        return; // Ignore non-numeric input
      }
    }
    
    // Handle checkboxes separately to get boolean value
    const nextValue = type === "checkbox" ? checked : value;

    setFormData({
      ...formData,
      [name]: nextValue
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
      notes: "",
      followupRequired: false,
      followupDate: "",
      followupReason: ""
    });
  };

  const handleCheckUID = async () => {
    if (!formData.uid) {
      toast.warning("Please enter a UID first");
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
        toast.success("Patient details loaded successfully!");
        
        // Check for pending followup
        if (patient.followupRequired && patient.followupDate) {
          const followupDate = new Date(patient.followupDate);
          const today = new Date();
          if (followupDate <= today) {
            toast.warning(`⚠️ Pending followup for ${patient.name}! Due: ${patient.followupDate}. Reason: ${patient.followupReason || "Not specified"}`);
          } else {
            toast.info(`📅 Followup scheduled for ${patient.followupDate}`);
          }
        }
      } else {
        toast.info("No existing patient data found for this UID. Ready for new patient entry.");
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
          notes: "",
          followupRequired: false,
          followupDate: "",
          followupReason: ""
        }));
      }
    } catch (error) {
      console.error("Error checking UID:", error);
      toast.error("Error checking UID. Please try again.");
    } finally {
      setLoadingCheckUID(false);
    }
  };

  const handleSearchByName = async () => {
    if (!formData.name || formData.name.trim().length === 0) {
      toast.warning("Please enter a patient name to search");
      return;
    }

    setLoadingSearch(true);
    setSearchType("name");
    try {
      const results = await searchPatientsByName(formData.name);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No patients found with that name");
      } else {
        setShowSearchModal(true);
        toast.info(`Found ${results.length} patient(s)`);
      }
    } catch (error) {
      console.error("Error searching by name:", error);
      toast.error("Error searching for patients");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearchByPhone = async () => {
    if (!formData.mobile || formData.mobile.trim().length === 0) {
      toast.warning("Please enter a phone number to search");
      return;
    }

    setLoadingSearch(true);
    setSearchType("phone");
    try {
      const results = await searchPatientsByPhone(formData.mobile);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No patients found with that phone number");
      } else {
        setShowSearchModal(true);
        toast.info(`Found ${results.length} patient(s)`);
      }
    } catch (error) {
      console.error("Error searching by phone:", error);
      toast.error("Error searching for patients");
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
    toast.success("Patient details loaded successfully!");
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return false;
    }

    try {
      const prescriptionData = {
        ...formData,
        // Ensure followupRequired is a proper boolean
        followupRequired: formData.followupRequired === true || formData.followupRequired === "on",
        createdAt: new Date()
      };

      console.log("=== PRESCRIPTION SAVE DEBUG ===");
      console.log("followupRequired:", prescriptionData.followupRequired);
      console.log("followupDate:", prescriptionData.followupDate);
      console.log("followupReason:", prescriptionData.followupReason);
      console.log("Full prescription data:", JSON.stringify(prescriptionData, null, 2));
      console.log("================================");
      
      const docRef = await addDoc(collection(db, "prescriptions"), prescriptionData);
      console.log("Prescription saved with ID:", docRef.id);
      
      // Also export to Google Sheets
      await exportToGoogleSheets(prescriptionData, "prescription");
      
      // Show followup toast if required, otherwise show generic success
      if (prescriptionData.followupRequired && prescriptionData.followupDate) {
        playSuccess();
        toast.success(`✅ Followup scheduled for ${prescriptionData.followupDate}`);
      } else {
        playSuccess();
        toast.success("✅ Prescription saved successfully!");
      }
      
      return true;
    } catch (error) {
      console.error("Error saving prescription:", error);
      playError();
      toast.error("❌ Error saving prescription. Please try again.");
      return false;
    }
  };

  const handleContinueToBilling = () => {
    if (!validateForm()) {
      return;
    }
    toast.info("Moving to billing form...");
    navigate("/billing", { state: { patient: formData } });
  };

  const handleNextUID = async () => {
    setLoadingNextUID(true);
    try {
      // Trim the current UID to ensure no whitespace issues
      const currentUID = (formData.uid && formData.uid.trim()) || "GX-000";
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
          notes: "",
          followupRequired: false,
          followupDate: "",
          followupReason: ""
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

      <div className="section-title">Followup (Optional)</div>
      <div className="followup-section">
        <label className="checkbox-label">
          <input 
            type="checkbox" 
            name="followupRequired" 
            checked={formData.followupRequired} 
            onChange={handleChange}
          />
          Followup Required
        </label>
        {formData.followupRequired && (
          <div className="followup-fields">
            <input 
              type="date" 
              name="followupDate" 
              value={formData.followupDate} 
              onChange={handleChange}
              className="followup-date-input"
            />
            <input 
              type="text" 
              name="followupReason" 
              placeholder="Reason for followup" 
              value={formData.followupReason} 
              onChange={handleChange}
              className="followup-reason-input"
            />
          </div>
        )}
      </div>

      <div className="button-group">
        <button className="reset-btn" type="button" onClick={handleReset}>
          Reset
        </button>
        <button className="proceed-btn" type="button" onClick={async () => { const saved = await handleSave(); if (saved) { setTimeout(() => window.print(), 800); } }}>
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
