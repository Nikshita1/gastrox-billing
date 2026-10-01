import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection } from "firebase/firestore";
import { toast } from "react-toastify";
import { db } from "../firebase";
import { fetchPatientByUID, findNextAvailableUIDForBilling } from "../utils/patientUtils";
import { exportToGoogleSheets } from "../utils/googleSheetsExport";

const serviceOptions = [
  { key: "consultation", label: "Consultation" },
  { key: "endoscopy", label: "Endoscopy" },
  { key: "fibroscan", label: "Fibroscan" },
  { key: "colonoscopy", label: "Colonoscopy" },
  { key: "sigmoidoscopy", label: "Sigmoidoscopy" },
  { key: "ecg", label: "ECG" }
];

const getTodayDate = () => {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const createInitialForm = () => ({
  uid: "",
  name: "",
  mobile: "",
  age: "",
  date: getTodayDate(),
  referral: "",
  paymentMode: "Cash",
  discount: "",
  other: "",
  otherAmount: "",
  ...Object.fromEntries(serviceOptions.flatMap(({ key }) => [[key, false], [`${key}Amount`, ""]]))
});

export default function DataEntry() {
  const [formData, setFormData] = useState(createInitialForm);
  const [isCheckingUID, setIsCheckingUID] = useState(false);
  const [isLoadingUID, setIsLoadingUID] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const uid = formData.uid.trim();
    if (!uid) return undefined;

    let isCurrent = true;
    const loadPatient = async () => {
      const patient = await fetchPatientByUID(uid);
      if (!patient || !isCurrent) return;

      setFormData((current) => ({
        ...current,
        name: current.name || patient.name || "",
        mobile: current.mobile || patient.mobile || "",
        age: current.age || patient.age || "",
        referral: current.referral || patient.referral || ""
      }));
    };

    loadPatient();
    return () => {
      isCurrent = false;
    };
  }, [formData.uid]);

  const total = serviceOptions.reduce((sum, { key }) => (
    sum + (formData[key] ? Number(formData[`${key}Amount`] || 0) : 0)
  ), 0) + Number(formData.otherAmount || 0);
  const discount = Number(formData.discount || 0);
  const finalAmount = Math.max(0, total - discount);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    if ((name === "age" || name === "mobile") && value && !/^\d+$/.test(value)) return;
    setFormData((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const loadPatient = async () => {
    const uid = formData.uid.trim();
    if (!uid) {
      toast.warning("Enter a UID first.");
      return;
    }

    setIsCheckingUID(true);
    try {
      const patient = await fetchPatientByUID(uid);
      if (!patient) {
        toast.info("No saved patient found for this UID. You can enter the details manually.");
        return;
      }

      setFormData((current) => ({
        ...current,
        name: patient.name || "",
        mobile: patient.mobile || "",
        age: patient.age || "",
        referral: patient.referral || current.referral
      }));
      toast.success("Patient details loaded.");
    } catch (error) {
      console.error("Error loading patient:", error);
      toast.error("Unable to load patient details.");
    } finally {
      setIsCheckingUID(false);
    }
  };

  const handleNextUID = async () => {
    setIsLoadingUID(true);
    try {
      const nextUID = await findNextAvailableUIDForBilling(formData.uid || "", "GXO");
      setFormData((current) => ({ ...current, uid: nextUID }));
    } catch (error) {
      console.error("Error finding next UID:", error);
      toast.error("Unable to find the next UID.");
    } finally {
      setIsLoadingUID(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = ["uid", "name", "mobile", "age", "date"];
    if (requiredFields.some((field) => !String(formData[field] || "").trim())) {
      toast.warning("Fill in UID, name, mobile, age, and date.");
      return;
    }
    if (discount > total) {
      toast.warning("Discount cannot be greater than the total.");
      return;
    }

    setIsSaving(true);
    try {
      const billData = {
        ...formData,
        uid: formData.uid.trim(),
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        age: Number(formData.age),
        referral: formData.referral.trim(),
        discount,
        total,
        finalAmount,
        createdAt: new Date()
      };
      await addDoc(collection(db, "bills"), billData);
      await exportToGoogleSheets(billData, "bill");
      toast.success("Record saved and added to History.");
      setFormData(createInitialForm());
    } catch (error) {
      console.error("Error saving data-entry bill:", error);
      toast.error("Could not save the record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="form-container">
      <div className="clinic-header">
        <div>
          <h1>Patient Data Entry</h1>
          <p>Enter patient and payment details. Totals update automatically.</p>
        </div>
        <Link to="/" className="nav-btn">Home</Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="uid-input-group">
            <input name="uid" value={formData.uid} onChange={handleChange} placeholder="UID (GXO-001)" required />
            <button type="button" className="check-uid-btn" onClick={loadPatient} disabled={isCheckingUID || !formData.uid}>
              {isCheckingUID ? "Checking..." : "Find"}
            </button>
            <button type="button" className="next-uid-btn" onClick={handleNextUID} disabled={isLoadingUID}>
              {isLoadingUID ? "Loading..." : "Next UID"}
            </button>
          </div>
          <input name="name" value={formData.name} onChange={handleChange} placeholder="Name" required />
          <input name="mobile" value={formData.mobile} onChange={handleChange} placeholder="Mobile" inputMode="numeric" required />
          <input name="age" type="number" min="0" value={formData.age} onChange={handleChange} placeholder="Age" required />
          <input name="date" type="date" value={formData.date} onChange={handleChange} required />
          <input name="referral" value={formData.referral} onChange={handleChange} placeholder="Referral" />
        </div>

        <div className="section-title">Services</div>
        <div className="service-table">
          <div className="service-table-header">
            <div className="service-col-check"></div>
            <div className="service-col-name">Service</div>
            <div className="service-col-amount">Amount</div>
          </div>
          {serviceOptions.map(({ key, label }) => (
            <div className="service-item" key={key}>
              <input type="checkbox" name={key} checked={formData[key]} onChange={handleChange} aria-label={`Include ${label}`} />
              <label htmlFor={key}>{label}</label>
              <input type="number" min="0" name={`${key}Amount`} value={formData[`${key}Amount`]} onChange={handleChange} placeholder="₹ 0" aria-label={`${label} amount`} />
            </div>
          ))}
          <div className="service-item">
            <span></span>
            <input name="other" value={formData.other} onChange={handleChange} placeholder="Other service" aria-label="Other service name" />
            <input type="number" min="0" name="otherAmount" value={formData.otherAmount} onChange={handleChange} placeholder="₹ 0" aria-label="Other service amount" />
          </div>
        </div>

        <div className="payment-grid">
          <div className="payment-panel">
            <span>Payment Mode</span>
            <div className="payment-options">
              {["Cash", "Online", "Both"].map((mode) => (
                <label key={mode}>
                  <input type="radio" name="paymentMode" value={mode} checked={formData.paymentMode === mode} onChange={handleChange} /> {mode}
                </label>
              ))}
            </div>
          </div>
          <input type="number" min="0" name="discount" value={formData.discount} onChange={handleChange} placeholder="Discount" />
        </div>

        <div className="total-box"><div>Total</div><div>₹{total}</div></div>
        <div className="total-box"><div>Discount</div><div>₹{discount}</div></div>
        <div className="total-box"><div>Final Amount</div><div>₹{finalAmount}</div></div>

        <div className="button-group">
          <button type="button" className="reset-btn" onClick={() => setFormData(createInitialForm())}>Reset Form</button>
          <button type="submit" className="proceed-btn" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Record"}
          </button>
        </div>
      </form>

      <div className="history-button">
        <Link to="/history" className="history-btn">View History</Link>
      </div>
    </div>
  );
}