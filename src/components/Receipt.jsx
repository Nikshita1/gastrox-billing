export default function Receipt({ formData, total, finalAmount, onBack }) {
  const formatDate = (value) => {
    if (!value) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, "0");
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return value;
  };

  return (
    <div className="receipt-container">
      <div className="receipt-header">
        <img src="/receipt-header.png" alt="GastroX Digestive Care Receipt Header" className="receipt-logo" />
      </div>

      <div className="receipt-info-grid">
        <div>
          <p><strong>Name:</strong> {formData.name || "-"}</p>
          <p><strong>Gender:</strong> {formData.sex || "-"}</p>
          <p><strong>Consultant:</strong> Dr. Purna Chandra Sethy</p>
          <p><strong>Referred By:</strong> {formData.referral || "-"}</p>
        </div>
        <div>
          <p><strong>Age:</strong> {formData.age || "-"}</p>
          <p><strong>Contact:</strong> {formData.mobile || "-"}</p>
          <p><strong>UID:</strong> {formData.uid || "-"}</p>
          <p><strong>Date:</strong> {formatDate(formData.date)}</p>
        </div>
      </div>

      <div className="receipt-services">
        <div className="services-header">
          <div className="service-col-name">Service Details</div>
          <div className="service-col-price">Price (₹)</div>
        </div>

        {formData.consultation && (
          <div className="service-line">
            <div className="service-col-name">Consultation</div>
            <div className="service-col-price">{formData.consultationAmount || 0}</div>
          </div>
        )}

        {formData.endoscopy && (
          <div className="service-line">
            <div className="service-col-name">Endoscopy</div>
            <div className="service-col-price">{formData.endoscopyAmount || 0}</div>
          </div>
        )}

        {formData.fibroscan && (
          <div className="service-line">
            <div className="service-col-name">Fibroscan</div>
            <div className="service-col-price">{formData.fibroscanAmount || 0}</div>
          </div>
        )}

        {formData.colonoscopy && (
          <div className="service-line">
            <div className="service-col-name">Colonoscopy</div>
            <div className="service-col-price">{formData.colonoscopyAmount || 0}</div>
          </div>
        )}

        {formData.other && (
          <div className="service-line">
            <div className="service-col-name">{formData.other}</div>
            <div className="service-col-price">{formData.otherAmount || 0}</div>
          </div>
        )}
      </div>

      <div className="receipt-summary">
        {formData.discount && Number(formData.discount) > 0 && (
          <div>
            <p><strong>Discount:</strong> ₹{Number(formData.discount)}</p>
          </div>
        )}
        <div>
          <p><strong>Total:</strong> ₹{total}</p>
          <p className="final-amount">Final Amount: ₹{finalAmount}</p>
        </div>
      </div>

      <div className="receipt-signature">
        <div className="signature-label">Issued by, signature:</div>
        <div className="signature-placeholder">
          <img src="/signature.png" alt="Doctor's Signature" />
        </div>
      </div>

      <div className="receipt-actions">
        <button className="back-btn" onClick={onBack}>
          Back to Form
        </button>
        <button className="print-btn" onClick={() => window.print()}>
          Print Receipt
        </button>
      </div>
    </div>
  );
}
