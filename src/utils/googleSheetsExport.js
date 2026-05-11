// Helper function to export bill data to Google Sheets
export const exportToGoogleSheets = async (billData, type = "bill") => {
  const webhookUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("Google Sheets webhook URL not configured");
    return; // Silently fail - Firestore save is the priority
  }

  try {
    const payload = {
      type, // "bill" or "prescription"
      data: {
        uid: billData.uid || "",
        name: billData.name || "",
        mobile: billData.mobile || "",
        age: billData.age || "",
        sex: billData.sex || "",
        address: billData.address || "",
        date: billData.date || "",
        referral: billData.referral || "",
        // Bill-specific fields
        ...(type === "bill" && {
          consultation: billData.consultation ? `Yes (₹${billData.consultationAmount || 0})` : "No",
          endoscopy: billData.endoscopy ? `Yes (₹${billData.endoscopyAmount || 0})` : "No",
          fibroscan: billData.fibroscan ? `Yes (₹${billData.fibroscanAmount || 0})` : "No",
          colonoscopy: billData.colonoscopy ? `Yes (₹${billData.colonoscopyAmount || 0})` : "No",
          other: billData.other || "",
          paymentMode: billData.paymentMode || "",
          total: billData.total || 0,
          discount: billData.discount || 0,
          finalAmount: billData.finalAmount || 0
        }),
        // Prescription-specific fields
        ...(type === "prescription" && {
          weight: billData.weight || "",
          prescription: billData.prescription || "",
          notes: billData.notes || ""
        }),
        timestamp: new Date().toISOString()
      }
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn("Failed to export to Google Sheets:", response.statusText);
    } else {
      console.log("Data exported to Google Sheets successfully");
    }
  } catch (error) {
    console.warn("Google Sheets export error:", error);
    // Don't throw - Firestore save should not be blocked by Google Sheets export
  }
};
