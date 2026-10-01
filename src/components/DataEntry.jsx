import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, getDocs } from "firebase/firestore";
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

const paymentOptions = [
  { key: "cash", label: "Cash" },
  { key: "sbi", label: "SBI" },
  { key: "bob", label: "BOB" }
];

const getDateKey = (value) => {
  if (!value) return "";
  const normalized = String(value).trim();
  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const getBillServices = (bill) => serviceOptions
  .filter(({ key }) => bill[key])
  .map(({ key, label }) => `${label} ₹${bill[`${key}Amount`] || 0}`)
  .concat(bill.other ? [`${bill.other} ₹${bill.otherAmount || 0}`] : [])
  .join(", ") || "None";

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
  paymentBreakdown: Object.fromEntries(paymentOptions.map(({ key }) => [key, { selected: false, amount: "" }])),
  discount: "",
  other: "",
  otherAmount: "",
  ...Object.fromEntries(serviceOptions.flatMap(({ key }) => [[key, false], [`${key}Amount`, ""]]))
});

export default function DataEntry() {
  const [formData, setFormData] = useState(createInitialForm);
  const [records, setRecords] = useState([]);
  const [isCheckingUID, setIsCheckingUID] = useState(false);
  const [isLoadingUID, setIsLoadingUID] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateMode, setDateMode] = useState("all");
  const [dateFilter, setDateFilter] = useState(getTodayDate);
  const [monthFilter, setMonthFilter] = useState(() => getTodayDate().slice(0, 7));
  const [yearFilter, setYearFilter] = useState(() => getTodayDate().slice(0, 4));
  const [uidPrefix, setUidPrefix] = useState("GXO");

  useEffect(() => {
    const loadRecords = async () => {
      try {
        const snapshot = await getDocs(collection(db, "bills"));
        const loadedRecords = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        loadedRecords.sort((first, second) => getDateKey(second.date).localeCompare(getDateKey(first.date)));
        setRecords(loadedRecords);
      } catch (error) {
        console.error("Error loading data-entry records:", error);
        toast.error("Could not load records.");
      } finally {
        setIsLoadingRecords(false);
      }
    };

    loadRecords();
  }, []);

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
  const selectedPaymentOptions = paymentOptions.filter(({ key }) => formData.paymentBreakdown[key].selected);
  const paymentTotal = selectedPaymentOptions.reduce((sum, { key }) => (
    sum + Number(formData.paymentBreakdown[key].amount || 0)
  ), 0);
  const paymentDifference = Math.round((finalAmount - paymentTotal) * 100) / 100;

  const filteredRecords = useMemo(() => records.filter((record) => {
    const recordDate = getDateKey(record.date);
    if (dateMode === "day" && recordDate !== dateFilter) return false;
    if (dateMode === "month" && !recordDate.startsWith(monthFilter)) return false;
    if (dateMode === "year" && !recordDate.startsWith(yearFilter)) return false;

    const query = search.trim().toLowerCase();
    return !query || [record.uid, record.name, record.mobile]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }), [records, dateMode, dateFilter, monthFilter, yearFilter, search]);

  const filteredRevenue = filteredRecords.reduce((sum, record) => sum + Number(record.finalAmount || 0), 0);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    if ((name === "age" || name === "mobile") && value && !/^\d+$/.test(value)) return;
    const nextValue = name === "uid" ? value.toUpperCase() : type === "checkbox" ? checked : value;
    if (name === "uid") {
      if (nextValue.startsWith("GXO-")) setUidPrefix("GXO");
      else if (nextValue.startsWith("GX-")) setUidPrefix("GX");
    }
    setFormData((current) => ({ ...current, [name]: nextValue }));
  };

  const handlePaymentChange = (key, field, value) => {
    setFormData((current) => ({
      ...current,
      paymentBreakdown: {
        ...current.paymentBreakdown,
        [key]: {
          ...current.paymentBreakdown[key],
          [field]: value
        }
      }
    }));
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
      const enteredUID = formData.uid.trim();
      const nextPrefix = enteredUID.startsWith("GXO-") ? "GXO" : enteredUID.startsWith("GX-") ? "GX" : uidPrefix;
      const nextUID = await findNextAvailableUIDForBilling(enteredUID, nextPrefix);
      setFormData((current) => ({ ...current, uid: nextUID }));
      setUidPrefix(nextPrefix);
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
    if (finalAmount > 0 && selectedPaymentOptions.length === 0) {
      toast.warning("Select at least one payment method.");
      return;
    }
    if (selectedPaymentOptions.some(({ key }) => Number(formData.paymentBreakdown[key].amount) <= 0)) {
      toast.warning("Enter an amount greater than zero for each selected payment method.");
      return;
    }
    if (Math.round(paymentTotal * 100) !== Math.round(finalAmount * 100)) {
      toast.warning(`Payment amounts must equal the final amount of ₹${finalAmount.toLocaleString("en-IN")}.`);
      return;
    }

    setIsSaving(true);
    try {
      const savedPaymentBreakdown = Object.fromEntries(selectedPaymentOptions.map(({ key, label }) => [
        key,
        { label, amount: Number(formData.paymentBreakdown[key].amount) }
      ]));
      const billData = {
        ...formData,
        uid: formData.uid.trim(),
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        age: Number(formData.age),
        referral: formData.referral.trim(),
        paymentMode: selectedPaymentOptions
          .map(({ key, label }) => `${label} ₹${Number(formData.paymentBreakdown[key].amount).toLocaleString("en-IN")}`)
          .join(", ") || "Unpaid",
        paymentBreakdown: savedPaymentBreakdown,
        discount,
        total,
        finalAmount,
        createdAt: new Date()
      };
      const document = await addDoc(collection(db, "bills"), billData);
      setRecords((current) => [{ id: document.id, ...billData }, ...current]);
      await exportToGoogleSheets(billData, "bill");
      toast.success("Record saved and added to History.");
      setFormData(createInitialForm());
      setIsEntryOpen(false);
    } catch (error) {
      console.error("Error saving data-entry bill:", error);
      toast.error("Could not save the record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="data-workspace">
      <header className="data-workspace-header">
        <div className="data-brandline">
          <Link to="/" className="data-home-link" aria-label="Home">Clinic</Link>
          <span> / </span>
          <strong>Patient records</strong>
        </div>
        <div className="data-workspace-actions">
          <Link to="/history" className="data-secondary-action">History</Link>
          <button type="button" className="data-add-action" onClick={() => setIsEntryOpen(true)}>＋ Add record</button>
        </div>
      </header>

      <section className="data-workspace-titlebar">
        <div>
          <h1>Patient records</h1>
          <p>Search and manage billing entries</p>
        </div>
        <div className="data-workspace-summary">
          <span>{filteredRecords.length} records</span>
          <strong>₹{filteredRevenue.toLocaleString("en-IN")}</strong>
          <small>collected in view</small>
        </div>
      </section>

      <section className="data-toolbar" aria-label="Record filters">
        <label className="data-search-control">
          <span>Search</span>
          <input type="search" placeholder="UID, patient name, mobile" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="data-filter-control">
          <span>Date range</span>
          <select value={dateMode} onChange={(event) => setDateMode(event.target.value)}>
            <option value="all">All dates</option>
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </label>
        {dateMode === "day" && (
          <input aria-label="Filter by day" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        )}
        {dateMode === "month" && (
          <input aria-label="Filter by month" type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
        )}
        {dateMode === "year" && (
          <input aria-label="Filter by year" type="number" min="2000" max="2100" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} />
        )}
        <button type="button" className="data-clear-action" onClick={() => { setSearch(""); setDateMode("all"); }}>Clear filters</button>
      </section>

      <section className="data-grid-frame" aria-label="Patient billing records">
        <div className="data-grid-scroll">
          <table className="data-grid-table">
            <thead>
              <tr>
                <th className="data-row-number">#</th>
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
                <th>Final amount</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRecords ? (
                <tr><td colSpan="12" className="data-grid-empty">Loading records...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="12" className="data-grid-empty">No records match these filters.</td></tr>
              ) : filteredRecords.map((record, index) => (
                <tr key={record.id}>
                  <td className="data-row-number">{index + 1}</td>
                  <td className="data-grid-uid">{record.uid || "—"}</td>
                  <td>{record.name || "—"}</td>
                  <td>{record.mobile || "—"}</td>
                  <td>{record.age || "—"}</td>
                  <td>{getDateKey(record.date) || "—"}</td>
                  <td>{record.referral || "—"}</td>
                  <td>{getBillServices(record)}</td>
                  <td>{record.paymentMode || "—"}</td>
                  <td>₹{Number(record.total || 0).toLocaleString("en-IN")}</td>
                  <td>₹{Number(record.discount || 0).toLocaleString("en-IN")}</td>
                  <td className="data-grid-final">₹{Number(record.finalAmount || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="data-grid-footer">
          <span>{filteredRecords.length} of {records.length} entries</span>
          <span>Sorted by date</span>
        </footer>
      </section>

      {isEntryOpen && (
        <div className="data-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsEntryOpen(false); }}>
          <section className="data-entry-modal" role="dialog" aria-modal="true" aria-labelledby="data-entry-title">
            <header className="data-modal-header">
              <div>
                <h2 id="data-entry-title">New patient record</h2>
                <p>Patient details and billing information</p>
              </div>
              <button type="button" className="data-modal-close" onClick={() => setIsEntryOpen(false)} aria-label="Close">×</button>
            </header>
            <form onSubmit={handleSubmit} className="data-modal-form">
              <div className="data-modal-patient-grid">
                <div className="data-uid-control">
                  <label htmlFor="entry-uid">UID</label>
                  <div className="data-uid-row">
                    <input id="entry-uid" name="uid" value={formData.uid} onChange={handleChange} placeholder="GX-001 or GXO-001" required />
                    <button type="button" onClick={loadPatient} disabled={isCheckingUID || !formData.uid}>{isCheckingUID ? "..." : "Find"}</button>
                    <select aria-label="UID prefix for next ID" value={uidPrefix} onChange={(event) => setUidPrefix(event.target.value)}>
                      <option value="GXO">GXO</option>
                      <option value="GX">GX</option>
                    </select>
                    <button type="button" onClick={handleNextUID} disabled={isLoadingUID}>{isLoadingUID ? "..." : "Next"}</button>
                  </div>
                </div>
                <label>Name<input name="name" value={formData.name} onChange={handleChange} required /></label>
                <label>Mobile<input name="mobile" value={formData.mobile} onChange={handleChange} inputMode="numeric" required /></label>
                <label>Age<input name="age" type="number" min="0" value={formData.age} onChange={handleChange} required /></label>
                <label>Date<input name="date" type="date" value={formData.date} onChange={handleChange} required /></label>
                <label>Referral<input name="referral" value={formData.referral} onChange={handleChange} /></label>
              </div>

              <div className="data-modal-section-heading">Services</div>
              <div className="data-service-grid">
                {serviceOptions.map(({ key, label }) => (
                  <label className="data-service-option" key={key}>
                    <span><input type="checkbox" name={key} checked={formData[key]} onChange={handleChange} /> {label}</span>
                    <input type="number" min="0" name={`${key}Amount`} value={formData[`${key}Amount`]} onChange={handleChange} placeholder="Amount" aria-label={`${label} amount`} />
                  </label>
                ))}
                <label className="data-service-option">
                  <input name="other" value={formData.other} onChange={handleChange} placeholder="Other service" aria-label="Other service name" />
                  <input type="number" min="0" name="otherAmount" value={formData.otherAmount} onChange={handleChange} placeholder="Amount" aria-label="Other service amount" />
                </label>
              </div>

              <div className="data-modal-payment-row">
                <div className="data-payments-panel">
                  <div className="data-payments-heading">
                    <strong>Payment split</strong>
                    <span>Amounts should equal final amount</span>
                  </div>
                  <div className="data-payment-options">
                    {paymentOptions.map(({ key, label }) => (
                      <label className="data-payment-method" key={key}>
                        <span>
                          <input
                            type="checkbox"
                            checked={formData.paymentBreakdown[key].selected}
                            onChange={(event) => handlePaymentChange(key, "selected", event.target.checked)}
                          />
                          {label}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.paymentBreakdown[key].amount}
                          onChange={(event) => handlePaymentChange(key, "amount", event.target.value)}
                          placeholder="₹ Amount"
                          aria-label={`${label} payment amount`}
                          disabled={!formData.paymentBreakdown[key].selected}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="data-payment-summary">
                    <span>Payment total</span>
                    <strong>₹{paymentTotal.toLocaleString("en-IN")} / ₹{finalAmount.toLocaleString("en-IN")}</strong>
                    <small className={paymentDifference === 0 ? "balanced" : "unbalanced"}>
                      {paymentDifference === 0
                        ? "Amounts match"
                        : paymentDifference > 0
                          ? `₹${paymentDifference.toLocaleString("en-IN")} remaining`
                          : `₹${Math.abs(paymentDifference).toLocaleString("en-IN")} over`}
                    </small>
                  </div>
                </div>
                <label>Discount
                  <input type="number" min="0" name="discount" value={formData.discount} onChange={handleChange} />
                </label>
                <div className="data-live-total"><span>Total</span><strong>₹{total.toLocaleString("en-IN")}</strong></div>
                <div className="data-live-total"><span>Final</span><strong>₹{finalAmount.toLocaleString("en-IN")}</strong></div>
              </div>

              <footer className="data-modal-actions">
                <button type="button" className="data-cancel-action" onClick={() => setFormData(createInitialForm())}>Clear form</button>
                <button type="submit" className="data-add-action" disabled={isSaving}>{isSaving ? "Saving..." : "Save record"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}