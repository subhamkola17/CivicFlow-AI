import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../lib/api";

function LiveQueues() {
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tracks which counter+event combination is currently in-flight.
  const [pendingEvents, setPendingEvents] = useState({});

  // Add Queue modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    stage: "",
    currentQueue: "",
    processingTime: "",
    staffCount: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  // Archive state
  const [archivedQueues, setArchivedQueues] = useState([]);
  const [archiveConfirm, setArchiveConfirm] = useState(null); // counter object being confirmed
  const [restoreConfirm, setRestoreConfirm] = useState(null); // counter object being confirmed
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState(""); // success/error banner

  // Fetch active queues from backend
  const fetchQueues = async () => {
    try {
      setError("");

      const response = await fetch(`${API_BASE_URL}/queues`);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.counters)) {
        throw new Error("Invalid queue data received from backend");
      }

      setQueues(data.counters);

      // Automatically select the first queue if nothing is selected
      setSelectedQueueId((currentSelectedId) => {
        const stillExists = data.counters.some(
          (item) => item._id === currentSelectedId
        );

        if (stillExists) {
          return currentSelectedId;
        }

        return data.counters.length > 0 ? data.counters[0]._id : null;
      });
    } catch (err) {
      console.error("Failed to fetch queues:", err);
      setError(err.message || "Failed to load queue data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch archived queues
  const fetchArchivedQueues = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/queues/archived`);

      if (!response.ok) return;

      const data = await response.json();

      if (data.success && Array.isArray(data.counters)) {
        setArchivedQueues(data.counters);
      }
    } catch (err) {
      console.error("Failed to fetch archived queues:", err);
    }
  };

  // Refresh both lists together
  const refreshAll = async () => {
    await Promise.all([fetchQueues(), fetchArchivedQueues()]);
  };

  // Fire a +1 arrival or -1 served event for a specific counter
  const fireEvent = async (counterId, event) => {
    const key = `${counterId}-${event}`;

    // Prevent duplicate in-flight clicks
    if (pendingEvents[key]) return;

    setPendingEvents((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/queues/event/${counterId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data?.message || `Event "${event}" failed (${response.status})`
        );
      }

      // Confirmed — immediately refresh queue list from backend
      await fetchQueues();
    } catch (err) {
      console.error(`Queue event error [${event}]:`, err);
      setError(err.message || `Failed to record "${event}" event`);
    } finally {
      setPendingEvents((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Initial load + automatic refresh
  useEffect(() => {
    refreshAll();

    const interval = setInterval(() => {
      refreshAll();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------
  // Add Queue handlers (unchanged)
  // ---------------------------------------------------------

  const openAddModal = () => {
    setAddForm({
      name: "",
      stage: "",
      currentQueue: "",
      processingTime: "",
      staffCount: "",
    });
    setAddError("");
    setAddSuccess("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddError("");
    setAddSuccess("");
  };

  const handleAddFormChange = (e) => {
    setAddForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddQueue = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");

    if (!addForm.name.trim()) {
      setAddError("Queue / Counter Name is required.");
      return;
    }
    if (!addForm.stage.trim()) {
      setAddError("Service Stage is required.");
      return;
    }
    const queueVal = Number(addForm.currentQueue);
    if (addForm.currentQueue === "" || !Number.isFinite(queueVal) || queueVal < 0) {
      setAddError("People Waiting must be 0 or more.");
      return;
    }
    const procVal = Number(addForm.processingTime);
    if (addForm.processingTime === "" || !Number.isFinite(procVal) || procVal < 0) {
      setAddError("Processing Time must be 0 or more.");
      return;
    }
    const staffVal = Number(addForm.staffCount);
    if (addForm.staffCount === "" || !Number.isFinite(staffVal) || staffVal < 0) {
      setAddError("Staff Available must be 0 or more.");
      return;
    }

    let serviceCenterId = null;

    if (queues.length > 0 && queues[0].serviceCenter) {
      serviceCenterId =
        typeof queues[0].serviceCenter === "object"
          ? queues[0].serviceCenter._id
          : queues[0].serviceCenter;
    }

    if (!serviceCenterId) {
      try {
        const scRes = await fetch(`${API_BASE_URL}/service-centers`);
        const scData = await scRes.json();
        if (scData.success && scData.serviceCenters?.length > 0) {
          serviceCenterId = scData.serviceCenters[0]._id;
        }
      } catch (_) {
        // ignore
      }
    }

    if (!serviceCenterId) {
      setAddError("Could not determine the service centre. Please ensure the backend is running.");
      return;
    }

    setAddLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCenter: serviceCenterId,
          name: addForm.name.trim(),
          stage: addForm.stage.trim(),
          currentQueue: queueVal,
          processingTime: procVal,
          staffCount: staffVal,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Failed to create queue.");
      }

      const newId = data.counter?._id;

      await refreshAll();

      if (newId) {
        setSelectedQueueId(newId);
      }

      setAddSuccess(`"${addForm.name.trim()}" was added successfully.`);

      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess("");
      }, 1500);
    } catch (err) {
      console.error("Add queue error:", err);
      setAddError(err.message || "Failed to add queue.");
    } finally {
      setAddLoading(false);
    }
  };

  // ---------------------------------------------------------
  // Archive / Restore handlers
  // ---------------------------------------------------------

  const confirmArchive = (item) => {
    setArchiveMessage("");
    setArchiveConfirm(item);
  };

  const confirmRestore = (item) => {
    setArchiveMessage("");
    setRestoreConfirm(item);
  };

  const cancelArchiveConfirm = () => setArchiveConfirm(null);
  const cancelRestoreConfirm = () => setRestoreConfirm(null);

  const executeArchive = async () => {
    if (!archiveConfirm) return;

    const { id, name } = archiveConfirm;
    setArchiveConfirm(null);
    setArchiveLoading(true);
    setArchiveMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/queues/${id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Archive failed.");
      }

      await refreshAll();

      // Deselect if the archived counter was selected
      setSelectedQueueId((prev) => (prev === id ? null : prev));

      setArchiveMessage(`success:${name} has been archived. Historical data is preserved.`);
    } catch (err) {
      console.error("Archive error:", err);
      setArchiveMessage(`error:${err.message || "Failed to archive counter."}`);
    } finally {
      setArchiveLoading(false);
    }
  };

  const executeRestore = async () => {
    if (!restoreConfirm) return;

    const { id, name } = restoreConfirm;
    setRestoreConfirm(null);
    setArchiveLoading(true);
    setArchiveMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/queues/${id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Restore failed.");
      }

      await refreshAll();

      setArchiveMessage(`success:${name} has been restored to active operations.`);
    } catch (err) {
      console.error("Restore error:", err);
      setArchiveMessage(`error:${err.message || "Failed to restore counter."}`);
    } finally {
      setArchiveLoading(false);
    }
  };

  // Parse the archiveMessage into type + text
  const archiveMsgType = archiveMessage.startsWith("success:") ? "success"
    : archiveMessage.startsWith("error:") ? "error"
    : null;
  const archiveMsgText = archiveMsgType
    ? archiveMessage.slice(archiveMsgType.length + 1)
    : "";

  // Convert backend counter into frontend display data
  const formattedQueues = useMemo(() => {
    return queues.map((item, index) => {
      const queue = Number(item.currentQueue) || 0;
      const processingTime = Number(item.processingTime) || 0;
      const staffCount = Number(item.staffCount) || 1;

      const load = Math.min(100, Math.round((queue / 60) * 100));

      const estimatedWaitMinutes =
        staffCount > 0
          ? Math.max(0, Math.round((queue * processingTime) / staffCount))
          : 0;

      let waitText = "0 min";

      if (estimatedWaitMinutes >= 60) {
        const hours = Math.floor(estimatedWaitMinutes / 60);
        const minutes = estimatedWaitMinutes % 60;
        waitText = minutes > 0 ? `${hours}h ${minutes} min` : `${hours}h`;
      } else {
        waitText = `${estimatedWaitMinutes} min`;
      }

      let status = "Normal";
      if (item.status === "critical") {
        status = "Bottleneck";
      } else if (item.status === "busy") {
        status = "Busy";
      } else if (item.status === "normal") {
        status = "Normal";
      }

      return {
        id: item._id,
        counter: String(index + 1).padStart(2, "0"),
        name: item.name || `Counter ${index + 1}`,
        stage: item.stage || "",
        queue,
        load,
        wait: waitText,
        status,
        processingTime,
        staffCount,
        rawStatus: item.status,
      };
    });
  }, [queues]);

  // Selected queue
  const selected = formattedQueues.find(
    (queue) => queue.id === selectedQueueId
  );

  return (
    <main className="main">
      {/* HEADER */}
      <header className="dashboard-header">
        <div>
          <div className="dashboard-eyebrow">
            CIVICFLOW AI
          </div>

          <h1>
            Live Queue
            <br />
            Operations
          </h1>

          <p>
            Monitor active government service queues
            and identify operational pressure in real time.
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot"></span>

          <div>
            <strong>LIVE</strong>
            <span>Real-time monitoring</span>
          </div>
        </div>
      </header>

      {/* SERVICE */}
      <section className="service-centre">
        <div>
          <span className="service-label">
            GOVERNMENT SERVICE CENTRE
          </span>

          <h2>
            Regional Passport Seva Kendra
          </h2>
        </div>

        <div className="live-indicator">
          <span></span>
          LIVE
        </div>
      </section>

      {/* ARCHIVE ACTION MESSAGE */}
      {archiveMsgType && (
        <div
          className={`archive-banner ${archiveMsgType === "success" ? "archive-banner-success" : "archive-banner-error"}`}
        >
          <span>{archiveMsgType === "success" ? "✓" : "!"}</span>
          <span>{archiveMsgText}</span>
          <button
            type="button"
            className="archive-banner-close"
            onClick={() => setArchiveMessage("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <section className="dashboard-section">
          <div className="card">
            <div className="card-heading">
              <div>
                <span>LOADING</span>
                <h2>Fetching live queue data...</h2>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ERROR */}
      {!loading && error && (
        <section className="dashboard-section">
          <div className="card">
            <div className="card-heading">
              <div>
                <span>CONNECTION ERROR</span>

                <h2>
                  Unable to load live queues
                </h2>

                <p style={{ marginTop: "8px" }}>
                  {error}
                </p>

                <button
                  type="button"
                  onClick={fetchQueues}
                  style={{
                    marginTop: "16px",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ACTIVE QUEUE LIST */}
      {!loading && !error && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span>REAL-TIME OPERATIONS</span>

              <h2>
                Active Service Counters
              </h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="updated">
                ● Updated just now
              </div>

              <button
                type="button"
                className="add-queue-btn"
                onClick={openAddModal}
              >
                + Add Queue
              </button>
            </div>
          </div>

          {formattedQueues.length === 0 ? (
            <div className="card">
              <div className="card-heading">
                <div>
                  <span>NO ACTIVE QUEUES</span>
                  <h2>No service counters found</h2>
                </div>
              </div>
            </div>
          ) : (
            <div className="live-queue-list">
              {formattedQueues.map((item) => {
                const arrivalKey = `${item.id}-arrival`;
                const servedKey  = `${item.id}-served`;
                const arrivalBusy = !!pendingEvents[arrivalKey];
                const servedBusy  = !!pendingEvents[servedKey];

                return (
                  <div
                    key={item.id}
                    className={`live-queue-item ${
                      selectedQueueId === item.id ? "active" : ""
                    }`}
                    style={{ cursor: "default" }}
                    onClick={() => setSelectedQueueId(item.id)}
                  >
                    <div className="live-counter">
                      {item.counter}
                    </div>

                    <div className="live-queue-info">
                      <strong>{item.name}</strong>
                      <span>Counter {item.counter}</span>
                    </div>

                    <div className="live-queue-number">
                      <strong>{item.queue}</strong>
                      <span>waiting</span>
                    </div>

                    <div className="live-queue-load">
                      <div className="load-label">
                        {item.load}% load
                      </div>

                      <div className="load-bar">
                        <div style={{ width: `${item.load}%` }} />
                      </div>
                    </div>

                    <div
                      className={`queue-status ${
                        item.status === "Bottleneck" ? "status-danger" : ""
                      }`}
                    >
                      {item.status}
                    </div>

                    {/* Event buttons */}
                    <div
                      className="queue-event-buttons"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="queue-event-btn queue-event-arrival"
                        disabled={arrivalBusy || servedBusy || archiveLoading}
                        onClick={() => fireEvent(item.id, "arrival")}
                        title="Record arrival (+1)"
                      >
                        {arrivalBusy ? "…" : "+ Arrival"}
                      </button>

                      <button
                        type="button"
                        className="queue-event-btn queue-event-served"
                        disabled={servedBusy || arrivalBusy || archiveLoading}
                        onClick={() => fireEvent(item.id, "served")}
                        title="Record served (−1)"
                      >
                        {servedBusy ? "…" : "− Served"}
                      </button>

                      {/* Archive button */}
                      <button
                        type="button"
                        className="queue-event-btn queue-archive-btn"
                        disabled={archiveLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmArchive(item);
                        }}
                        title="Archive this counter"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SELECTED QUEUE DETAIL */}
      {!loading && !error && selected && (
        <section className="dashboard-two-column">
          <section className="card">
            <div className="card-heading">
              <div>
                <span>SELECTED COUNTER</span>
                <h2>{selected.name}</h2>
              </div>
              <span className="analysis-badge">LIVE DATA</span>
            </div>

            <div className="queue-detail-grid">
              <div>
                <span>CURRENT QUEUE</span>
                <strong>{selected.queue}</strong>
                <small>citizens waiting</small>
              </div>

              <div>
                <span>COUNTER LOAD</span>
                <strong>{selected.load}%</strong>
                <small>current capacity</small>
              </div>

              <div>
                <span>EST. WAIT</span>
                <strong>{selected.wait}</strong>
                <small>calculated from queue, processing time &amp; staff</small>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-heading">
              <div>
                <span>OPERATIONAL STATUS</span>
                <h2>Queue Health</h2>
              </div>
            </div>

            <div className="queue-health">
              <div className="health-row">
                <span>Processing time</span>
                <strong>{selected.processingTime} min</strong>
              </div>

              <div className="health-row">
                <span>Staff available</span>
                <strong>{selected.staffCount}</strong>
              </div>

              <div className="health-row">
                <span>Capacity utilization</span>
                <strong>{selected.load}%</strong>
              </div>

              <div className="health-row">
                <span>AI status</span>
                <strong className="green-text">Monitoring</strong>
              </div>
            </div>
          </section>
        </section>
      )}

      {/* ARCHIVED COUNTERS */}
      {!loading && !error && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span>LIFECYCLE MANAGEMENT</span>
              <h2>Archived Counters</h2>
            </div>

            <div className="updated">
              {archivedQueues.length} archived
            </div>
          </div>

          {archivedQueues.length === 0 ? (
            <div className="archived-empty">
              No counters are currently archived.
            </div>
          ) : (
            <div className="archived-list">
              {archivedQueues.map((item) => (
                <div key={item._id} className="archived-item">
                  <div className="archived-badge">ARCHIVED</div>

                  <div className="archived-info">
                    <strong>{item.name}</strong>
                    <span>{item.stage}</span>
                  </div>

                  <div className="archived-meta">
                    <div>
                      <span>STAFF</span>
                      <strong>{item.staffCount}</strong>
                    </div>

                    <div>
                      <span>PROCESSING</span>
                      <strong>{item.processingTime} min</strong>
                    </div>

                    <div>
                      <span>LAST QUEUE</span>
                      <strong>{item.currentQueue}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="restore-btn"
                    disabled={archiveLoading}
                    onClick={() =>
                      confirmRestore({ id: item._id, name: item.name })
                    }
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ARCHIVE CONFIRMATION DIALOG */}
      {archiveConfirm && (
        <div
          className="aq-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelArchiveConfirm();
          }}
        >
          <div className="aq-modal" style={{ maxWidth: "420px" }}>
            <div className="aq-modal-header">
              <div>
                <span className="aq-eyebrow">CIVICFLOW AI</span>
                <h2 className="aq-title">Archive this counter?</h2>
              </div>
            </div>

            <p className="confirm-dialog-body">
              <strong>{archiveConfirm.name}</strong> will be removed from active
              operations, but its historical data will be preserved.
            </p>

            <div className="aq-actions">
              <button
                type="button"
                className="aq-submit confirm-archive-btn"
                onClick={executeArchive}
              >
                Archive Counter
              </button>

              <button
                type="button"
                className="aq-cancel"
                onClick={cancelArchiveConfirm}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION DIALOG */}
      {restoreConfirm && (
        <div
          className="aq-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelRestoreConfirm();
          }}
        >
          <div className="aq-modal" style={{ maxWidth: "420px" }}>
            <div className="aq-modal-header">
              <div>
                <span className="aq-eyebrow">CIVICFLOW AI</span>
                <h2 className="aq-title">Restore this counter?</h2>
              </div>
            </div>

            <p className="confirm-dialog-body">
              <strong>{restoreConfirm.name}</strong> will be restored to active
              operations with its existing configuration intact.
            </p>

            <div className="aq-actions">
              <button
                type="button"
                className="aq-submit"
                onClick={executeRestore}
              >
                Restore Counter
              </button>

              <button
                type="button"
                className="aq-cancel"
                onClick={cancelRestoreConfirm}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD QUEUE MODAL */}
      {showAddModal && (
        <div
          className="aq-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <div className="aq-modal">
            <div className="aq-modal-header">
              <div>
                <span className="aq-eyebrow">CIVICFLOW AI</span>
                <h2 className="aq-title">Add Service Counter</h2>
              </div>

              <button
                type="button"
                className="aq-close"
                onClick={closeAddModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQueue} noValidate>
              <div className="aq-field">
                <label htmlFor="aq-name">Queue / Counter Name</label>
                <input
                  id="aq-name"
                  name="name"
                  type="text"
                  placeholder="e.g. Biometric Verification"
                  value={addForm.name}
                  onChange={handleAddFormChange}
                  autoComplete="off"
                />
              </div>

              <div className="aq-field">
                <label htmlFor="aq-stage">Service Stage</label>
                <input
                  id="aq-stage"
                  name="stage"
                  type="text"
                  placeholder="e.g. Biometric"
                  value={addForm.stage}
                  onChange={handleAddFormChange}
                  autoComplete="off"
                />
              </div>

              <div className="aq-field-row">
                <div className="aq-field">
                  <label htmlFor="aq-queue">People Waiting</label>
                  <input
                    id="aq-queue"
                    name="currentQueue"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={addForm.currentQueue}
                    onChange={handleAddFormChange}
                  />
                </div>

                <div className="aq-field">
                  <label htmlFor="aq-proc">Processing Time (min)</label>
                  <input
                    id="aq-proc"
                    name="processingTime"
                    type="number"
                    min="0"
                    placeholder="5"
                    value={addForm.processingTime}
                    onChange={handleAddFormChange}
                  />
                </div>

                <div className="aq-field">
                  <label htmlFor="aq-staff">Staff Available</label>
                  <input
                    id="aq-staff"
                    name="staffCount"
                    type="number"
                    min="0"
                    placeholder="2"
                    value={addForm.staffCount}
                    onChange={handleAddFormChange}
                  />
                </div>
              </div>

              {addError && (
                <div className="aq-error">{addError}</div>
              )}

              {addSuccess && (
                <div className="aq-success">✓ {addSuccess}</div>
              )}

              <div className="aq-actions">
                <button
                  type="submit"
                  className="aq-submit"
                  disabled={addLoading}
                >
                  {addLoading ? "Adding…" : "Add Queue"}
                </button>

                <button
                  type="button"
                  className="aq-cancel"
                  onClick={closeAddModal}
                  disabled={addLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default LiveQueues;
