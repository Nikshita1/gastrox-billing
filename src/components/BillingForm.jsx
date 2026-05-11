import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Receipt from "./Receipt";
import { fetchPatientByUID, findNextAvailableUIDForBilling, searchPatientsByName, searchPatientsByPhone } from "../utils/patientUtils";
import { exportToGoogleSheets } from "../utils/googleSheetsExport";
import heroImage from "../assets/hero.png";

export default function BillingForm() {
  const location = useLocation();
  const [showReceipt, setShowReceipt] = useState(false);
  const isDirectBilling = !location.state?.patient; // Direct billing if no patient from prescription

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
    date: getTodayDate(),
    paymentMode: "Cash",
    referral: "",
    address: "",
    consultation: false,
    consultationAmount: "",
    endoscopy: false,
    endoscopyAmount: "",
    fibroscan: false,
    fibroscanAmount: "",
    colonoscopy: false,
    colonoscopyAmount: "",
    other: "",
    otherAmount: "",
    discount: ""
  });

  const [loadingNextUID, setLoadingNextUID] = useState(false);
  const [loadingCheckUID, setLoadingCheckUID] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (location.state?.patient) {
      setFormData((prev) => ({ ...prev, ...location.state.patient }));
    }
  }, [location.state]);

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
          address: prev.address || patient.address,
          referral: prev.referral || patient.referral,
          date: prev.date || patient.date
        }));
      }
    };

    loadPatient();
  }, [formData.uid]);

const handleProceed = async () => {
  if (!validateFormFields()) {
    return;
  }

  const total = calculateTotal();
  const finalAmount = total - Number(formData.discount || 0);

  try {
    const billData = {
      ...formData,
      total,
      finalAmount,
      createdAt: new Date()
    };

    await addDoc(collection(db, "bills"), billData);
    
    // Also export to Google Sheets
    await exportToGoogleSheets(billData, "bill");

    setShowReceipt(true);
  } catch (error) {
    console.error("Error saving bill:", error);
  }
};
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Allow only numeric values for age and mobile
    if ((name === "age" || name === "mobile") && value !== "" && type !== "checkbox") {
      if (!/^\d+$/.test(value)) {
        return; // Ignore non-numeric input
      }
    }

    const nextValue = type === "checkbox" ? checked : value;

    setFormData({
      ...formData,
      [name]: nextValue
    });
  };

  const validateFormFields = () => {
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
        setFormData((prev) => ({
          ...prev,
          name: "",
          age: "",
          mobile: "",
          sex: "",
          address: "",
          date: ""
        }));
      }
    } catch (error) {
      console.error("Error checking UID:", error);
      alert("Error checking UID. Please try again.");
    } finally {
      setLoadingCheckUID(false);
    }
  };

  const handleNextUID = async () => {
    setLoadingNextUID(true);
    try {
      const currentUID = formData.uid || "GXO-000";
      const nextUID = await findNextAvailableUIDForBilling(currentUID);
      if (nextUID) {
        setFormData((prev) => ({
          ...prev,
          uid: nextUID,
          name: "",
          age: "",
          mobile: "",
          sex: "",
          address: "",
          date: getTodayDate()
        }));
      }
    } catch (error) {
      console.error("Error finding next UID:", error);
      alert("Error finding next UID");
    } finally {
      setLoadingNextUID(false);
    }
  };

  const handleSearchByName = async () => {
    if (!formData.name || formData.name.trim().length === 0) {
      alert("Please enter a patient name to search");
      return;
    }

    setLoadingSearch(true);
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

  const calculateTotal = () => {
    let total = 0;
    if (formData.consultation) {
      total += Number(formData.consultationAmount || 0);
    }
    if (formData.endoscopy) {
      total += Number(formData.endoscopyAmount || 0);
    }
    if (formData.fibroscan) {
      total += Number(formData.fibroscanAmount || 0);
    }
    if (formData.colonoscopy) {
      total += Number(formData.colonoscopyAmount || 0);
    }
    total += Number(formData.otherAmount || 0);
    return total;
  };

  const handleReset = () => {
    setFormData({
      uid: "",
      name: "",
      age: "",
      mobile: "",
      sex: "",
      date: getTodayDate(),
      paymentMode: "Cash",
      referral: "",
      consultation: false,
      consultationAmount: "",
      endoscopy: false,
      endoscopyAmount: "",
      fibroscan: false,
      fibroscanAmount: "",
      colonoscopy: false,
      colonoscopyAmount: "",
      other: "",
      otherAmount: "",
      discount: ""
    });
  };

  const total = calculateTotal();
  const finalAmount = total - Number(formData.discount || 0);

  if (showReceipt) {
    return (
      <Receipt
        formData={formData}
        total={total}
        finalAmount={finalAmount}
        onBack={() => setShowReceipt(false)}
      />
    );
  }

  return (
    <div className="form-container">
      <div className="prescription-header-wrapper">
        <img src={heroImage} alt="GastroX Digestive Care logo" className="clinic-logo" />
        <Link to="/" className="home-link-header" title="Home">
          🏠
        </Link>
      </div>

      <div className="clinic-header">
        <div>
          <h1>Billing Form</h1>
          <p>Fill out patient and service details.</p>
        </div>
        <Link to="/prescription" className="nav-btn">
          Go to Prescription
        </Link>
      </div>

      <div className="form-grid">
        {isDirectBilling ? (
          <>
            <div className="uid-input-group">
              <input type="text" name="uid" placeholder="UID (GXO-001)" value={formData.uid} onChange={handleChange} />
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
                title="Find next available UID"
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
          </>
        ) : (
          <>
            <input type="text" name="uid" placeholder="UID" value={formData.uid} onChange={handleChange} />
            <input type="text" name="name" placeholder="Patient Name" value={formData.name} onChange={handleChange} />
          </>
        )}
        <input type="text" name="age" placeholder="Age" value={formData.age} onChange={handleChange} />
        {isDirectBilling ? (
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
        ) : (
          <input type="text" name="mobile" placeholder="Mobile Number" value={formData.mobile} onChange={handleChange} />
        )}
        <input type="text" name="address" placeholder="Address" value={formData.address} onChange={handleChange} />
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
        />
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

      <div className="section-title">Medical Record</div>

      <div className="service-table">
        <div className="service-table-header">
          <div className="service-col-check"></div>
          <div className="service-col-name">Service</div>
          <div className="service-col-amount">Amount</div>
        </div>

        <div className="service-item">
          <input type="checkbox" name="consultation" checked={formData.consultation} onChange={handleChange} />
          <label>Consultation</label>
          <input type="number" name="consultationAmount" value={formData.consultationAmount} placeholder="₹ 0" onChange={handleChange} />
        </div>

        <div className="service-item">
          <input type="checkbox" name="endoscopy" checked={formData.endoscopy} onChange={handleChange} />
          <label>Endoscopy</label>
          <input type="number" name="endoscopyAmount" value={formData.endoscopyAmount} placeholder="₹ 0" onChange={handleChange} />
        </div>

        <div className="service-item">
          <input type="checkbox" name="fibroscan" checked={formData.fibroscan} onChange={handleChange} />
          <label>Fibroscan</label>
          <input type="number" name="fibroscanAmount" value={formData.fibroscanAmount} placeholder="₹ 0" onChange={handleChange} />
        </div>

        <div className="service-item">
          <input type="checkbox" name="colonoscopy" checked={formData.colonoscopy} onChange={handleChange} />
          <label>Colonoscopy</label>
          <input type="number" name="colonoscopyAmount" value={formData.colonoscopyAmount} placeholder="₹ 0" onChange={handleChange} />
        </div>

        <div className="service-item">
          <span></span>
          <input type="text" name="other" value={formData.other} placeholder="Other Service" onChange={handleChange} />
          <input type="number" name="otherAmount" value={formData.otherAmount} placeholder="₹ 0" onChange={handleChange} />
        </div>
      </div>

      <div className="payment-grid">
        <div className="payment-panel">
          <span>Payment Mode</span>
          <div className="payment-options">
            <label>
              <input type="radio" name="paymentMode" value="Cash" checked={formData.paymentMode === "Cash"} onChange={handleChange} /> Cash
            </label>
            <label>
              <input type="radio" name="paymentMode" value="Online" checked={formData.paymentMode === "Online"} onChange={handleChange} /> Online
            </label>
            <label>
              <input type="radio" name="paymentMode" value="Both" checked={formData.paymentMode === "Both"} onChange={handleChange} /> Both
            </label>
          </div>
        </div>
        <input type="text" name="referral" placeholder="Referral Name" value={formData.referral} onChange={handleChange} />
      </div>

      <div className="discount-row">
        <input type="number" name="discount" placeholder="Discount" value={formData.discount} onChange={handleChange} />
      </div>

            <div className="total-box">
        <div>Total</div>
        <div>₹{total}</div>
      </div>

      <div className="total-box">
        <div>Discount</div>
        <div>₹{Number(formData.discount || 0)}</div>
      </div>

      <div className="total-box">
        <div>Final Amount</div>
        <div>₹{finalAmount}</div>
      </div>

            <div className="button-group">
        <button className="reset-btn" onClick={handleReset}>
          Reset Form
        </button>

        <button className="proceed-btn" onClick={handleProceed}>
          Proceed To Receipt
        </button>
      </div>

      <div className="history-button">
        <Link to="/history" className="history-btn">
          View History
        </Link>
      </div>

      {/* Search Results Modal - Only for Direct Billing */}
      {isDirectBilling && showSearchModal && (
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
