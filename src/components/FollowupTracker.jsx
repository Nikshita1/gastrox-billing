import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function FollowupTracker() {
  const [followups, setFollowups] = useState({
    today: [],
    tomorrow: [],
    upcoming: [],
    completed: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState({
    isDone: false,
    comment: "",
    rescheduleDate: ""
  });

  useEffect(() => {
    fetchFollowups();
  }, []);

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const next10Days = new Date(today);
      next10Days.setDate(next10Days.getDate() + 10);

      console.log("Fetching followups...");
      console.log("Today:", today.toISOString());
      console.log("Tomorrow:", tomorrow.toISOString());
      console.log("Next 10 Days:", next10Days.toISOString());

      // Query prescriptions with followup
      const prescriptionsSnapshot = await getDocs(
        query(
          collection(db, "prescriptions"),
          where("followupRequired", "==", true)
        )
      );

      console.log("Prescriptions with followup:", prescriptionsSnapshot.docs.length);
      prescriptionsSnapshot.docs.forEach(doc => {
        console.log("Prescription doc:", doc.id, doc.data());
      });

      // Query bills with followup
      const billsSnapshot = await getDocs(
        query(
          collection(db, "bills"),
          where("followupRequired", "==", true)
        )
      );

      console.log("Bills with followup:", billsSnapshot.docs.length);
      billsSnapshot.docs.forEach(doc => {
        console.log("Bill doc:", doc.id, doc.data());
      });

      const allRecords = [
        ...prescriptionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, type: "prescription" })),
        ...billsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, type: "bill" }))
      ];

      console.log("Total records with followup:", allRecords.length);

      const todayFollowups = [];
      const tomorrowFollowups = [];
      const upcomingFollowups = [];
      const completedFollowups = [];

      allRecords.forEach(record => {
        if (!record.followupDate) {
          console.log("Record missing followupDate:", record);
          return;
        }

        // Separate completed from pending
        if (record.followupStatus === "completed") {
          completedFollowups.push(record);
          console.log("Added to COMPLETED");
          return;
        }

        const followupDate = new Date(record.followupDate);
        followupDate.setHours(0, 0, 0, 0);

        console.log("Processing followup for", record.name, "- Date:", followupDate.toISOString());

        if (followupDate.getTime() === today.getTime()) {
          todayFollowups.push(record);
          console.log("Added to TODAY");
        } else if (followupDate.getTime() === tomorrow.getTime()) {
          tomorrowFollowups.push(record);
          console.log("Added to TOMORROW");
        } else if (followupDate > tomorrow && followupDate <= next10Days) {
          upcomingFollowups.push(record);
          console.log("Added to UPCOMING");
        }
      });

      console.log("Final counts - Today:", todayFollowups.length, "Tomorrow:", tomorrowFollowups.length, "Upcoming:", upcomingFollowups.length, "Completed:", completedFollowups.length);

      setFollowups({
        today: todayFollowups.sort((a, b) => new Date(a.followupDate) - new Date(b.followupDate)),
        tomorrow: tomorrowFollowups.sort((a, b) => new Date(a.followupDate) - new Date(b.followupDate)),
        upcoming: upcomingFollowups.sort((a, b) => new Date(a.followupDate) - new Date(b.followupDate)),
        completed: completedFollowups.sort((a, b) => new Date(b.lastUpdated || b.createdAt) - new Date(a.lastUpdated || a.createdAt))
      });
    } catch (err) {
      console.error("Error fetching followups:", err);
      setError("Failed to load followups");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const openFollowupModal = (record) => {
    setActiveModal(record);
    setModalData({
      isDone: record.followupStatus === "completed",
      comment: record.followupComments || "",
      rescheduleDate: ""
    });
  };

  const closeFollowupModal = () => {
    setActiveModal(null);
    setModalData({
      isDone: false,
      comment: "",
      rescheduleDate: ""
    });
  };

  const handleSaveFollowup = async () => {
    if (!activeModal) return;

    try {
      const followupUpdateData = {
        followupStatus: modalData.isDone ? "completed" : "pending",
        followupComments: modalData.comment,
        lastUpdated: new Date(),
        lastUpdatedComment: modalData.comment
      };

      // If rescheduling, update the followup date
      if (modalData.rescheduleDate) {
        followupUpdateData.followupDate = modalData.rescheduleDate;
        followupUpdateData.rescheduledFrom = activeModal.followupDate;
      }

      // Update the document
      const collectionName = activeModal.type === "prescription" ? "prescriptions" : "bills";
      const docRef = doc(db, collectionName, activeModal.id);
      await updateDoc(docRef, followupUpdateData);

      // Refresh the followups list
      await fetchFollowups();
      closeFollowupModal();

      console.log("Followup updated successfully");
    } catch (err) {
      console.error("Error updating followup:", err);
      alert("Failed to update followup. Please try again.");
    }
  };

  const deleteFollowup = async (record) => {
    if (!confirm(`Delete followup for ${record.name}?`)) return;

    try {
      const collectionName = record.type === "prescription" ? "prescriptions" : "bills";
      const docRef = doc(db, collectionName, record.id);
      
      // Remove followup fields instead of deleting entire document
      await updateDoc(docRef, {
        followupRequired: false,
        followupDate: null,
        followupReason: null,
        followupStatus: null,
        followupComments: null
      });

      await fetchFollowups();
      console.log("Followup deleted successfully");
    } catch (err) {
      console.error("Error deleting followup:", err);
      alert("Failed to delete followup. Please try again.");
    }
  };

  const clearAllCompleted = async () => {
    if (!confirm(`Clear all ${followups.completed.length} completed followups? This cannot be undone.`)) return;

    try {
      const deletePromises = followups.completed.map(record => {
        const collectionName = record.type === "prescription" ? "prescriptions" : "bills";
        const docRef = doc(db, collectionName, record.id);
        return updateDoc(docRef, {
          followupRequired: false,
          followupDate: null,
          followupReason: null,
          followupStatus: null,
          followupComments: null
        });
      });

      await Promise.all(deletePromises);
      await fetchFollowups();
      console.log("All completed followups cleared");
    } catch (err) {
      console.error("Error clearing completed followups:", err);
      alert("Failed to clear followups. Please try again.");
    }
  };

  const FollowupCard = ({ record, isCompleted }) => (
    <div className="followup-card">
      <div className="followup-header">
        <div className="followup-patient">
          <h3>{record.name}</h3>
          <span className="followup-uid">UID: {record.uid}</span>
        </div>
        <span className={`followup-type ${record.type}`}>
          {record.type === "prescription" ? "📋 Rx" : "💵 Bill"}
        </span>
      </div>
      <div className="followup-body">
        <p><strong>📞 Mobile:</strong> {record.mobile}</p>
        <p><strong>👤 Age:</strong> {record.age} | <strong>♀/♂:</strong> {record.sex}</p>
        <p><strong>📍 Address:</strong> {record.address}</p>
        {record.followupReason && (
          <p><strong>📝 Reason:</strong> {record.followupReason}</p>
        )}
        {record.followupComments && (
          <p><strong>💬 Comments:</strong> {record.followupComments}</p>
        )}
      </div>
      <div className="followup-footer">
        <span className="followup-date">📅 {formatDate(record.followupDate)}</span>
        <div className="followup-actions">
          <button 
            className="followup-action-btn"
            onClick={() => openFollowupModal(record)}
            title="Mark as done, add comments, or reschedule"
          >
            ✏️ Action
          </button>
          {isCompleted && (
            <button 
              className="followup-clear-btn"
              onClick={() => deleteFollowup(record)}
              title="Clear this followup"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="followup-container">
        <div className="loading">Loading followups...</div>
      </div>
    );
  }

  return (
    <div className="followup-container">
    
      <div className="clinic-header">
        <div>
          <h1>📋 Followup Tracker</h1>
          <p>Track patient followups for today and upcoming dates.</p>
        </div>
        <Link to="/" className="nav-btn">
          🏠 Home
        </Link>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="followups-grid">
        {/* Today's Followups */}
        <div className="followup-section-card">
          <div className="section-header today">
            <span>🔴 Today's Followups</span>
            <span className="count">{followups.today.length}</span>
          </div>
          <div className="followups-list">
            {followups.today.length === 0 ? (
              <p className="no-data">No followups scheduled for today</p>
            ) : (
              followups.today.map(record => (
                <FollowupCard key={record.id} record={record} />
              ))
            )}
          </div>
        </div>

        {/* Tomorrow's Followups */}
        <div className="followup-section-card">
          <div className="section-header tomorrow">
            <span>🟡 Tomorrow's Followups</span>
            <span className="count">{followups.tomorrow.length}</span>
          </div>
          <div className="followups-list">
            {followups.tomorrow.length === 0 ? (
              <p className="no-data">No followups scheduled for tomorrow</p>
            ) : (
              followups.tomorrow.map(record => (
                <FollowupCard key={record.id} record={record} />
              ))
            )}
          </div>
        </div>

        {/* Upcoming Followups */}
        <div className="followup-section-card">
          <div className="section-header upcoming">
            <span>🟢 Upcoming Followups (Next 10 days)</span>
            <span className="count">{followups.upcoming.length}</span>
          </div>
          <div className="followups-list">
            {followups.upcoming.length === 0 ? (
              <p className="no-data">No upcoming followups in the next 10 days</p>
            ) : (
              followups.upcoming.map(record => (
                <FollowupCard key={record.id} record={record} />
              ))
            )}
          </div>
        </div>

        {/* Completed Followups */}
        <div className="followup-section-card">
          <div className="section-header completed">
            <span>✅ Completed Followups</span>
            <span className="count">{followups.completed.length}</span>
            {followups.completed.length > 0 && (
              <button 
                className="clear-all-btn"
                onClick={clearAllCompleted}
                title="Clear all completed followups"
              >
                🗑️ Clear All
              </button>
            )}
          </div>
          <div className="followups-list">
            {followups.completed.length === 0 ? (
              <p className="no-data">No completed followups yet</p>
            ) : (
              followups.completed.map(record => (
                <FollowupCard key={record.id} record={record} isCompleted={true} />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="refresh-section">
        <button className="refresh-btn" onClick={fetchFollowups}>
          🔄 Refresh
        </button>
      </div>

      {/* Followup Action Modal */}
      {activeModal && (
        <div className="modal-overlay" onClick={closeFollowupModal}>
          <div className="modal-content-followup" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-followup">
              <h2>Followup Action</h2>
              <button 
                type="button" 
                className="modal-close" 
                onClick={closeFollowupModal}
              >
                ✕
              </button>
            </div>
            <div className="modal-body-followup">
              <p className="patient-info"><strong>{activeModal.name}</strong> (UID: {activeModal.uid})</p>

              <label className="followup-checkbox">
                <input 
                  type="checkbox" 
                  checked={modalData.isDone}
                  onChange={(e) => setModalData({ ...modalData, isDone: e.target.checked })}
                />
                Mark as Done
              </label>

              <div className="form-group">
                <label>Comments</label>
                <textarea 
                  value={modalData.comment}
                  onChange={(e) => setModalData({ ...modalData, comment: e.target.value })}
                  placeholder="Add any comments or notes about the followup..."
                  rows="4"
                  className="comment-textarea"
                />
              </div>

              <div className="form-group">
                <label>Reschedule Date (Optional)</label>
                <input 
                  type="date" 
                  value={modalData.rescheduleDate}
                  onChange={(e) => setModalData({ ...modalData, rescheduleDate: e.target.value })}
                  className="reschedule-input"
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-cancel"
                  onClick={closeFollowupModal}
                >
                  Cancel
                </button>
                <button 
                  className="btn-save"
                  onClick={handleSaveFollowup}
                >
                  💾 Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
