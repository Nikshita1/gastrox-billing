import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export async function fetchPatientByUID(uid) {
  if (!uid) return null;

  try {
    // Search in prescriptions collection first (most recent data)
    const prescriptionQuery = query(
      collection(db, "prescriptions"),
      where("uid", "==", uid)
    );
    const prescriptionSnapshot = await getDocs(prescriptionQuery);
    
    if (!prescriptionSnapshot.empty) {
      // Sort by createdAt in descending order to get most recent
      const docs = prescriptionSnapshot.docs.sort((a, b) => {
        const timeA = a.data().createdAt?.toMillis?.() || 0;
        const timeB = b.data().createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      const data = docs[0].data();
      return {
        uid: data.uid || "",
        name: data.name || "",
        age: data.age || "",
        mobile: data.mobile || "",
        sex: data.sex || "",
        address: data.address || "",
        referral: data.referral || "",
        date: data.date || ""
      };
    }

    // If not found in prescriptions, search in bills collection
    const billQuery = query(
      collection(db, "bills"),
      where("uid", "==", uid)
    );
    const billSnapshot = await getDocs(billQuery);
    
    if (billSnapshot.empty) {
      return null;
    }

    // Sort by createdAt in descending order to get most recent
    const docs = billSnapshot.docs.sort((a, b) => {
      const timeA = a.data().createdAt?.toMillis?.() || 0;
      const timeB = b.data().createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    const data = docs[0].data();
    return {
      uid: data.uid || "",
      name: data.name || "",
      age: data.age || "",
      mobile: data.mobile || "",
      sex: data.sex || "",
      address: data.address || "",
      referral: data.referral || "",
      date: data.date || ""
    };
  } catch (error) {
    console.error("Error fetching patient by UID:", error);
    return null;
  }
}

export async function findNextAvailableUID(currentUID) {
  try {
    // Trim whitespace from input
    const trimmedUID = currentUID ? currentUID.trim() : "";
    
    // If currentUID is provided and not default, increment it
    if (trimmedUID && trimmedUID !== "GX-000") {
      return incrementUID(trimmedUID);
    }
    
    // Otherwise, find the highest used UID and return the next one
    const billSnapshot = await getDocs(collection(db, "bills"));
    const prescriptionSnapshot = await getDocs(collection(db, "prescriptions"));
    
    const allRecords = [
      ...billSnapshot.docs.map(doc => doc.data()),
      ...prescriptionSnapshot.docs.map(doc => doc.data())
    ];

    // Extract UID numbers for "GX-" prefix
    let maxNum = 0;
    allRecords.forEach(record => {
      const uid = record.uid || "";
      if (uid.startsWith("GX-")) {
        const num = parseInt(uid.substring(3), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    // Return the next UID after the highest used one
    const nextNum = (maxNum + 1).toString().padStart(3, "0");
    return "GX-" + nextNum;
  } catch (error) {
    console.error("Error finding next UID:", error);
    // Fallback: start from GX-001 if something goes wrong
    return "GX-001";
  }
}

function incrementUID(uid) {
  // Handle format: PREFIX-NUMBERS (e.g., "GX-001" -> "GX-002")
  // Regex captures: (prefix)(digits)(suffix)
  // Using non-greedy prefix match to handle dashes and special chars
  const match = uid.match(/^(.*?)(\d+)([^\d]*)$/);
  
  if (match) {
    const prefix = match[1];           // "GX-"
    const numericPart = parseInt(match[2], 10);  // 1
    const suffix = match[3];           // ""
    const numDigits = match[2].length; // 3 (to preserve zero-padding)
    const nextNum = (numericPart + 1).toString().padStart(numDigits, "0");
    return prefix + nextNum + suffix;  // "GX-002"
  }

  // If no numeric part found, append increment (e.g., "ABC" -> "ABC1")
  return uid + "1";
}

export async function findNextAvailableUIDForBilling(currentUID, uidPrefix = "GXO") {
  if (!currentUID && uidPrefix === "GXO") {
    return "GXO-001";
  }
  if (!currentUID) {
    return "GX-001";
  }

  try {
    let nextUID = incrementUID(currentUID);
    let maxAttempts = 50; // Search up to 50 UIDs ahead
    let attempts = 0;

    // Search for the next UID that doesn't have patient data (empty slot)
    while (attempts < maxAttempts) {
      const patient = await fetchPatientByUID(nextUID);
      if (!patient) {
        // Found an empty UID - return it as the next available
        return nextUID;
      }
      // Has patient data, continue searching
      nextUID = incrementUID(nextUID);
      attempts++;
    }

    // If no empty UID found in the range, return the last checked UID
    return nextUID;
  } catch (error) {
    console.error("Error finding next UID:", error);
    return incrementUID(currentUID);
  }
}

export async function searchPatientsByName(searchName) {
  if (!searchName || searchName.trim().length === 0) return [];

  try {
    // Get all bills
    const billSnapshot = await getDocs(collection(db, "bills"));
    const allBills = billSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get all prescriptions
    const prescriptionSnapshot = await getDocs(collection(db, "prescriptions"));
    const allPrescriptions = prescriptionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Combine both collections
    const allRecords = [...allBills, ...allPrescriptions];

    // Filter by name (case-insensitive partial match)
    const searchLower = searchName.toLowerCase();
    const matchingRecords = allRecords.filter((record) =>
      (record.name || "").toLowerCase().includes(searchLower)
    );

    // Deduplicate by UID and get most recent record for each patient
    const uniquePatients = new Map();
    matchingRecords.forEach((record) => {
      const uid = record.uid || record.id;
      const existing = uniquePatients.get(uid);
      if (!existing || (record.createdAt?.toMillis?.() || 0) > (existing.createdAt?.toMillis?.() || 0)) {
        uniquePatients.set(uid, record);
      }
    });

    return Array.from(uniquePatients.values());
  } catch (error) {
    console.error("Error searching patients by name:", error);
    return [];
  }
}

export async function searchPatientsByPhone(phoneNumber) {
  if (!phoneNumber || phoneNumber.trim().length === 0) return [];

  try {
    // Get all bills
    const billSnapshot = await getDocs(collection(db, "bills"));
    const allBills = billSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get all prescriptions
    const prescriptionSnapshot = await getDocs(collection(db, "prescriptions"));
    const allPrescriptions = prescriptionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Combine both collections
    const allRecords = [...allBills, ...allPrescriptions];

    // Filter by phone number (exact match in string)
    const matchingRecords = allRecords.filter((record) =>
      (record.mobile || "").includes(phoneNumber)
    );

    // Deduplicate by UID and get most recent record for each patient
    const uniquePatients = new Map();
    matchingRecords.forEach((record) => {
      const uid = record.uid || record.id;
      const existing = uniquePatients.get(uid);
      if (!existing || (record.createdAt?.toMillis?.() || 0) > (existing.createdAt?.toMillis?.() || 0)) {
        uniquePatients.set(uid, record);
      }
    });

    return Array.from(uniquePatients.values());
  } catch (error) {
    console.error("Error searching patients by phone:", error);
    return [];
  }
}
