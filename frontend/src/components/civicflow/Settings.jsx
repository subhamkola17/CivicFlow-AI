/* =========================================================
   CIVICFLOW AI — SETTINGS PAGE
========================================================= */

import { useState } from "react";

function Settings() {
  const [queueThreshold, setQueueThreshold] = useState(60);
  const [predictionWindow, setPredictionWindow] = useState("60");
  const [refreshInterval, setRefreshInterval] = useState("30");

  const [bottleneckAlerts, setBottleneckAlerts] = useState(true);
  const [queueAlerts, setQueueAlerts] = useState(true);
  const [interventionAlerts, setInterventionAlerts] = useState(true);

  const [predictiveMonitoring, setPredictiveMonitoring] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);
  const [humanApproval, setHumanApproval] = useState(true);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <main className="main settings-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="dashboard-header">

        <div>
          <div className="dashboard-eyebrow">
            CIVICFLOW AI
          </div>

          <h1>
            System
            <br />
            Settings
          </h1>

          <p>
            Configure service-centre monitoring, prediction
            thresholds and operator controls.
          </p>
        </div>

        <div className="settings-system-status">

          <span className="status-dot"></span>

          <div>
            <strong>SYSTEM ACTIVE</strong>
            <span>Configuration ready</span>
          </div>

        </div>

      </header>


      {/* =====================================================
          SERVICE CENTRE
      ===================================================== */}

      <section className="card settings-section">

        <div className="settings-section-heading">

          <div>
            <span>
              SERVICE CENTRE
            </span>

            <h2>
              Centre Configuration
            </h2>
          </div>

          <div className="settings-configured">
            CONFIGURED
          </div>

        </div>


        <div className="settings-info-grid">

          <div className="settings-info-item">

            <span>
              SERVICE CENTRE
            </span>

            <strong>
              Regional Passport Seva Kendra
            </strong>

          </div>


          <div className="settings-info-item">

            <span>
              OPERATING STATUS
            </span>

            <strong className="settings-active-text">
              ● Operational
            </strong>

          </div>


          <div className="settings-info-item">

            <span>
              ACTIVE COUNTERS
            </span>

            <strong>
              4
            </strong>

          </div>


          <div className="settings-info-item">

            <span>
              MONITORING MODE
            </span>

            <strong>
              Predictive
            </strong>

          </div>

        </div>

      </section>


      {/* =====================================================
          QUEUE CONFIGURATION
      ===================================================== */}

      <section className="card settings-section">

        <div className="settings-section-heading">

          <div>
            <span>
              QUEUE MANAGEMENT
            </span>

            <h2>
              Prediction & Thresholds
            </h2>
          </div>

        </div>


        <div className="settings-controls-grid">

          {/* Queue threshold */}

          <div className="settings-control">

            <div className="settings-control-label">

              <div>
                <strong>
                  Warning Threshold
                </strong>

                <small>
                  Trigger an operational warning when the
                  overall queue reaches this value.
                </small>
              </div>

              <span className="settings-value">
                {queueThreshold}
              </span>

            </div>


            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={queueThreshold}
              onChange={(event) =>
                setQueueThreshold(event.target.value)
              }
              className="settings-range"
            />


            <div className="settings-range-labels">
              <span>20</span>
              <span>60</span>
              <span>100</span>
            </div>

          </div>


          {/* Prediction window */}

          <div className="settings-control">

            <div className="settings-control-label">

              <div>
                <strong>
                  Prediction Window
                </strong>

                <small>
                  Time horizon used for queue forecasting.
                </small>
              </div>

            </div>


            <select
              value={predictionWindow}
              onChange={(event) =>
                setPredictionWindow(event.target.value)
              }
              className="settings-select"
            >
              <option value="30">
                30 minutes
              </option>

              <option value="60">
                60 minutes
              </option>

              <option value="120">
                120 minutes
              </option>
            </select>

          </div>


          {/* Refresh interval */}

          <div className="settings-control">

            <div className="settings-control-label">

              <div>
                <strong>
                  Monitoring Refresh
                </strong>

                <small>
                  Frequency of frontend monitoring updates.
                </small>
              </div>

            </div>


            <select
              value={refreshInterval}
              onChange={(event) =>
                setRefreshInterval(event.target.value)
              }
              className="settings-select"
            >
              <option value="15">
                Every 15 seconds
              </option>

              <option value="30">
                Every 30 seconds
              </option>

              <option value="60">
                Every 60 seconds
              </option>
            </select>

          </div>

        </div>


        <div className="settings-note">

          <span>i</span>

          <p>
            These values currently control the frontend
            prototype only. They can later be connected
            to the prediction engine through an API.
          </p>

        </div>

      </section>


      {/* =====================================================
          NOTIFICATIONS
      ===================================================== */}

      <section className="card settings-section">

        <div className="settings-section-heading">

          <div>
            <span>
              OPERATOR ALERTS
            </span>

            <h2>
              Notification Controls
            </h2>
          </div>

        </div>


        <div className="settings-toggle-list">

          <div className="settings-toggle-row">

            <div>
              <strong>
                Bottleneck Alerts
              </strong>

              <small>
                Alert the operator when a counter enters
                bottleneck conditions.
              </small>
            </div>

            <button
              className={`settings-toggle ${
                bottleneckAlerts ? "enabled" : ""
              }`}
              onClick={() =>
                setBottleneckAlerts(!bottleneckAlerts)
              }
              aria-label="Toggle bottleneck alerts"
            >
              <span></span>
            </button>

          </div>


          <div className="settings-toggle-row">

            <div>
              <strong>
                Queue Threshold Alerts
              </strong>

              <small>
                Alert when the overall queue crosses the
                configured threshold.
              </small>
            </div>

            <button
              className={`settings-toggle ${
                queueAlerts ? "enabled" : ""
              }`}
              onClick={() =>
                setQueueAlerts(!queueAlerts)
              }
              aria-label="Toggle queue threshold alerts"
            >
              <span></span>
            </button>

          </div>


          <div className="settings-toggle-row">

            <div>
              <strong>
                Intervention Updates
              </strong>

              <small>
                Show updates after an approved intervention
                begins.
              </small>
            </div>

            <button
              className={`settings-toggle ${
                interventionAlerts ? "enabled" : ""
              }`}
              onClick={() =>
                setInterventionAlerts(!interventionAlerts)
              }
              aria-label="Toggle intervention updates"
            >
              <span></span>
            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          AI CONTROLS
      ===================================================== */}

      <section className="card settings-section">

        <div className="settings-section-heading">

          <div>
            <span>
              AI OPERATIONS
            </span>

            <h2>
              Predictive Decision Controls
            </h2>
          </div>

          <div className="settings-ai-badge">
            AI READY
          </div>

        </div>


        <div className="settings-toggle-list">

          <div className="settings-toggle-row">

            <div>
              <strong>
                Predictive Monitoring
              </strong>

              <small>
                Continuously analyse queue trends and identify
                potential bottlenecks.
              </small>
            </div>

            <button
              className={`settings-toggle ${
                predictiveMonitoring ? "enabled" : ""
              }`}
              onClick={() =>
                setPredictiveMonitoring(!predictiveMonitoring)
              }
              aria-label="Toggle predictive monitoring"
            >
              <span></span>
            </button>

          </div>


          <div className="settings-toggle-row">

            <div>
              <strong>
                AI Recommendations
              </strong>

              <small>
                Generate recommended interventions from
                detected bottleneck conditions.
              </small>
            </div>

            <button
              className={`settings-toggle ${
                aiRecommendations ? "enabled" : ""
              }`}
              onClick={() =>
                setAiRecommendations(!aiRecommendations)
              }
              aria-label="Toggle AI recommendations"
            >
              <span></span>
            </button>

          </div>


          <div className="settings-toggle-row">

            <div>
              <strong>
                Human Approval Required
              </strong>

              <small>
                Require an operator to approve recommendations
                before an intervention is activated.
              </small>
            </div>

            <button
              className={`settings-toggle ${
                humanApproval ? "enabled" : ""
              }`}
              onClick={() =>
                setHumanApproval(!humanApproval)
              }
              aria-label="Toggle human approval"
            >
              <span></span>
            </button>

          </div>

        </div>


        <div className="settings-human-loop">

          <div className="settings-human-loop-icon">
            H
          </div>

          <div>
            <span>
              HUMAN-IN-THE-LOOP
            </span>

            <strong>
              Operator approval is enabled
            </strong>

            <p>
              CivicFlow AI can recommend actions, but the
              final operational decision remains with the
              authorised service-centre operator.
            </p>
          </div>

        </div>

      </section>


      {/* =====================================================
          SAVE
      ===================================================== */}

      <div className="settings-actions">

        {saved && (
          <span className="settings-saved">
            ✓ Configuration updated
          </span>
        )}

        <button
          className="settings-save-button"
          onClick={handleSave}
        >
          Save Configuration
        </button>

      </div>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div className="settings-footer">

        <span>
          CIVICFLOW AI · FRONTEND CONFIGURATION
        </span>

        <span>
          Secure operator environment
        </span>

      </div>

    </main>
  );
}

export default Settings;