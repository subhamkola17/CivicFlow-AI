import { useEffect, useState } from "react";
import "./App.css";

import { getDashboard } from "./lib/api";

import Sidebar from "./components/civicflow/Sidebar.jsx";
import Login from "./components/civicflow/Login.jsx";
import LiveQueues from "./components/civicflow/LiveQueues.jsx";
import Analytics from "./components/civicflow/Analytics.jsx";
import Settings from "./components/civicflow/Settings.jsx";


function Metric({ label, value, description, icon, danger = false }) {
  return (
    <section className={`card metric-card ${danger ? "danger-card" : ""}`}>
      <div className="metric-header">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>

      <div className="metric-value">{value}</div>

      <div className="metric-description">
        {description}
      </div>
    </section>
  );
}


function QueueCard({
  counter,
  name,
  queue,
  description,
  percentage,
  danger = false,
}) {
  return (
    <div className={`queue-card ${danger ? "queue-danger" : ""}`}>
      <div className="queue-card-top">
        <div>
          <div className="counter-label">
            COUNTER {counter}
          </div>

          <h3>{name}</h3>
        </div>

        {danger && (
          <span className="bottleneck-badge">
            ⚠ BOTTLENECK
          </span>
        )}
      </div>

      <div className="queue-number">
        {queue}
        <span> people</span>
      </div>

      <div className="queue-description">
        {description}
      </div>

      <div className="queue-progress">
        <div
          className="queue-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [activePage, setActivePage] =
    useState("dashboard");

  const [selectedScenario, setSelectedScenario] =
    useState(null);

  const [simulationData, setSimulationData] =
    useState(null);

  const [simulationLoading, setSimulationLoading] =
    useState(false);

  const [simulationError, setSimulationError] =
    useState("");

  const [interventionStatus, setInterventionStatus] =
    useState("pending");

  const [recommendationActionLoading, setRecommendationActionLoading] =
    useState(false);

  const [recommendationActionError, setRecommendationActionError] =
    useState("");

  // =====================================================
  // BACKEND DASHBOARD CONNECTION
  // =====================================================

  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = async (showLoading = true) => {
    try {
      if (showLoading) {
        setDashboardLoading(true);
      }

      setDashboardError("");

      const data = await getDashboard();

      console.log("CivicFlow Dashboard API:", data);

      if (data.success) {
        setDashboardData(data);
      } else {
        setDashboardError("Failed to load dashboard data.");
      }
    } catch (error) {
      console.error("Dashboard API error:", error);

      setDashboardError(
        error.message || "Unable to connect to backend."
      );
    } finally {
      if (showLoading) {
        setDashboardLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDashboard(true);

    // Keep the dashboard synchronized with the backend.
    const refreshInterval = setInterval(() => {
      loadDashboard(false);
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);


  useEffect(() => {
    const status = dashboardData?.recommendation?.status;
    // "none" means no recommendation exists for the current bottleneck.
    if (status === "approved" || status === "rejected" || status === "pending") {
      setInterventionStatus(status);
    } else if (status === "none" || dashboardData?.recommendation?.available === false) {
      setInterventionStatus("pending"); // no matching recommendation — reset action buttons
    }
  }, [dashboardData?.recommendation?.status, dashboardData?.recommendation?.available]);

  // =====================================================
  // BACKEND DATA HELPERS
  // =====================================================

  const serviceCenter = dashboardData?.serviceCenter || {};
  const counters = Array.isArray(dashboardData?.counters) ? dashboardData.counters : [];
  const prediction = dashboardData?.prediction || {};
  const bottleneck = dashboardData?.bottleneck || {};
  const rootCause = dashboardData?.rootCause || {};
  const recommendation = dashboardData?.recommendation || {};
  const monitoring = dashboardData?.monitoring || {};

  const totalCurrentQueue = counters.reduce(
    (total, counter) => total + Number(counter.queue || 0),
    0
  );

  const bottleneckCounter =
    counters.find((counter) => counter.id === bottleneck.counterId) ||
    counters.find((counter) => counter.stage === bottleneck.stage) ||
    counters.find((counter) => counter.status === "critical") ||
    counters[0] ||
    {};

  const currentBottleneckQueue = Number(bottleneckCounter.queue || 0);

  // prediction.available === false means the ML model has not yet been run
  // for the current bottleneck counter.  Use null-safe access so the
  // chart/KPI cards can render an honest "unavailable" state.
  const predictionAvailable = prediction.available !== false;
  const predicted30 = predictionAvailable ? Number(prediction.in30Minutes ?? 0) : null;
  const predicted60 = predictionAvailable ? Number(prediction.in60Minutes ?? 0) : null;
  const threshold = Number(prediction.threshold ?? 60);

  // ML model performance — only valid when a prediction exists for the
  // current bottleneck counter.
  const modelPerformance = dashboardData?.modelPerformance || {};
  const modelReliability =
    predictionAvailable
      ? Number(modelPerformance.reliability ?? prediction.confidence ?? 0)
      : null;

  const chartMax = Math.max(
    threshold,
    currentBottleneckQueue,
    predicted30 ?? 0,
    predicted60 ?? 0,
    1
  );

  const chartY = (value) => {
    const safeValue = Math.max(0, Number(value || 0));
    return 190 - (Math.min(safeValue, chartMax) / chartMax) * 150;
  };

  const queuePercentage = (queue) =>
    Math.min(100, Math.max(0, (Number(queue || 0) / Math.max(threshold, 1)) * 100));

  const formatNumber = (value, decimals = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return decimals > 0 ? number.toFixed(decimals) : Math.round(number);
  };

  const formatPercent = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    if (number === 0) return "→ No change";
    return `${number >= 0 ? "↑" : "↓"} ${Math.abs(number).toFixed(0)}%`;
  };

  const processingBefore = Number(rootCause.processingTimeBefore ?? 0);
  const processingNow = Number(rootCause.processingTimeNow ?? 0);
  const processingChange = processingBefore > 0
    ? ((processingNow - processingBefore) / processingBefore) * 100
    : 0;

  const staffChange = Number(rootCause.staffChange ?? 0);
  const arrivalIncrease = Number(rootCause.arrivalIncrease ?? 0);

  const likelyCause =
    arrivalIncrease > 0 && staffChange < 0
      ? "Increased arrivals + reduced staff availability"
      : arrivalIncrease > 0 && processingChange > 0
        ? "Increased arrivals + slower processing"
        : staffChange < 0
          ? "Reduced staff availability"
          : processingChange > 0
            ? "Increased processing time"
            : "Operational conditions are driving queue pressure";

  const monitoringBeforeQueue = Number(monitoring.beforeQueue ?? 0);
  const monitoringAfterQueue = Number(monitoring.afterQueue ?? 0);
  const monitoringBeforeWait = Number(monitoring.beforeWaitTime ?? 0);
  const monitoringAfterWait = Number(monitoring.afterWaitTime ?? 0);

  const queueReduction = monitoringBeforeQueue > 0
    ? ((monitoringBeforeQueue - monitoringAfterQueue) / monitoringBeforeQueue) * 100
    : 0;

  const waitReduction = monitoringBeforeWait > 0
    ? ((monitoringBeforeWait - monitoringAfterWait) / monitoringBeforeWait) * 100
    : 0;

  // =====================================================
  // BACKEND WHAT-IF SIMULATION
  // =====================================================

  // const API_BASE_URL =
   // import.meta.env.VITE_API_URL || "http://localhost:5000";
   
    const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://civicflow-ai-production.up.railway.app";

  const scenarios = {
    "Add Officer": {
      result: simulationData
        ? `${formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Add 1 officer"
            )?.estimatedWaitTime
          )} min`
        : "—",
      queue: simulationData
        ? formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Add 1 officer"
            )?.estimatedQueueAfter60Min
          )
        : "—",
      impact:
        simulationData?.simulations?.find(
          (item) => item.scenario === "Add 1 officer"
        )?.action ||
        "Increase verification capacity",
      type: "positive",
    },

    "Move Officer": {
      result: simulationData
        ? `${formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Move 1 officer"
            )?.estimatedWaitTime
          )} min`
        : "—",
      queue: simulationData
        ? formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Move 1 officer"
            )?.estimatedQueueAfter60Min
          )
        : "—",
      impact:
        simulationData?.simulations?.find(
          (item) => item.scenario === "Move 1 officer"
        )?.action ||
        "Reallocate available staff",
      type: "positive",
    },

    "Route Simple Cases Online": {
      result: simulationData
        ? `${formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Route simple cases online"
            )?.estimatedWaitTime
          )} min`
        : "—",
      queue: simulationData
        ? formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Route simple cases online"
            )?.estimatedQueueAfter60Min
          )
        : "—",
      impact:
        simulationData?.simulations?.find(
          (item) => item.scenario === "Route simple cases online"
        )?.action ||
        "Reduce physical queue demand",
      type: "positive",
    },

    "Do Nothing": {
      result: simulationData
        ? `${formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Do nothing"
            )?.estimatedWaitTime
          )} min`
        : "—",
      queue: simulationData
        ? formatNumber(
            simulationData.simulations?.find(
              (item) => item.scenario === "Do nothing"
            )?.estimatedQueueAfter60Min
          )
        : "—",
      impact:
        simulationData?.simulations?.find(
          (item) => item.scenario === "Do nothing"
        )?.action ||
        "Continue with current staffing and queue",
      type: "danger",
    },
  };

  const handleScenario = async (scenario) => {
    setSelectedScenario(scenario);
    setInterventionStatus("pending");
    setSimulationLoading(true);
    setSimulationError("");

    try {
      if (!bottleneckCounter?.id) {
        throw new Error("Bottleneck counter is not available.");
      }

      // Find the latest real queue snapshot so the simulation uses
      // the current arrival rate instead of a hard-coded value.
      const snapshotResponse = await fetch(
        `${API_BASE_URL}/api/queues/snapshots/${bottleneckCounter.id}`
      );

      if (!snapshotResponse.ok) {
        throw new Error(
          `Unable to load queue history (${snapshotResponse.status}).`
        );
      }

      const snapshotData = await snapshotResponse.json();
      const latestSnapshot = snapshotData?.snapshots?.[0];

      if (!latestSnapshot) {
        throw new Error(
          "No queue snapshot is available for this bottleneck yet."
        );
      }

      const sourceCounter = counters
        .filter((counter) => counter.id !== bottleneckCounter.id)
        .find((counter) => Number(counter.staffCount) > 1);

      const simulationResponse = await fetch(
        `${API_BASE_URL}/api/simulation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentQueue: currentBottleneckQueue,
            processingTime: Number(
              bottleneckCounter.processingTime ||
                latestSnapshot.averageProcessingTime ||
                1
            ),
            staffCount: Number(
              bottleneckCounter.staffCount ||
                latestSnapshot.staffAvailable ||
                1
            ),
            arrivalRate: Number(latestSnapshot.arrivalRate || 0),
            sourceCounterName:
              sourceCounter?.name || "another counter",
            sourceStaffCount: Number(sourceCounter?.staffCount || 0),
            onlineReductionPercent: 25,
          }),
        }
      );

      const result = await simulationResponse.json();

      if (!simulationResponse.ok || !result.success) {
        throw new Error(
          result.message || "What-if simulation failed."
        );
      }

      console.log("CivicFlow Simulation API:", result);
      setSimulationData(result);
    } catch (error) {
      console.error("Simulation API error:", error);
      setSimulationData(null);
      setSimulationError(
        error.message || "Unable to run the simulation."
      );
    } finally {
      setSimulationLoading(false);
    }
  };



  // =====================================================
  // BACKEND RECOMMENDATION ACTIONS
  // =====================================================

  const APPROVER_ID =
    import.meta.env.VITE_APPROVER_ID ||
    "6ab50a7229ef51f07e60784f";

  const getRecommendationId = () =>
    recommendation?.id ||
    recommendation?._id ||
    recommendation?.recommendationId ||
    "";

  const handleApprove = async () => {
    const recommendationId = getRecommendationId();

    if (!recommendationId) {
      setRecommendationActionError(
        "No recommendation ID is available from the backend."
      );
      return;
    }

    if (!APPROVER_ID) {
      setRecommendationActionError(
        "Approver ID is missing. Add VITE_APPROVER_ID to the frontend environment."
      );
      return;
    }

    try {
      setRecommendationActionLoading(true);
      setRecommendationActionError("");

      const response = await fetch(
        `${API_BASE_URL}/api/recommendations/${recommendationId}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approvedBy: APPROVER_ID,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to approve the recommendation."
        );
      }

      setInterventionStatus("approved");

      // Reload the real backend state so the dashboard reflects
      // the approved recommendation instead of only changing local UI state.
      await loadDashboard(false);
    } catch (error) {
      console.error("Approve recommendation API error:", error);

      setRecommendationActionError(
        error.message || "Unable to approve the recommendation."
      );
    } finally {
      setRecommendationActionLoading(false);
    }
  };


  const handleReject = async () => {
    const recommendationId = getRecommendationId();

    if (!recommendationId) {
      setRecommendationActionError(
        "No recommendation ID is available from the backend."
      );
      return;
    }

    try {
      setRecommendationActionLoading(true);
      setRecommendationActionError("");

      const response = await fetch(
        `${API_BASE_URL}/api/recommendations/${recommendationId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to reject the recommendation."
        );
      }

      setInterventionStatus("rejected");

      // Reload the real backend state after rejection.
      await loadDashboard(false);
    } catch (error) {
      console.error("Reject recommendation API error:", error);

      setRecommendationActionError(
        error.message || "Unable to reject the recommendation."
      );
    } finally {
      setRecommendationActionLoading(false);
    }
  };


  if (!isLoggedIn) {
    return (
      <Login
        onLogin={() => setIsLoggedIn(true)}
      />
    );
  }


  // =====================================================
  // BACKEND LOADING STATE
  // =====================================================

  if (dashboardLoading) {
    return (
      <div className="civic-app">
        <div
          style={{
            padding: "40px",
            color: "white",
          }}
        >
          Connecting to CivicFlow AI backend...
        </div>
      </div>
    );
  }


  // =====================================================
  // BACKEND ERROR STATE
  // =====================================================

  if (dashboardError) {
    return (
      <div className="civic-app">
        <div
          style={{
            padding: "40px",
            color: "#ff6b6b",
          }}
        >
          Backend connection error: {dashboardError}
        </div>
      </div>
    );
  }


  return (
    <div className="civic-app">

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />


      {/* =====================================================
          DASHBOARD
      ===================================================== */}

      {activePage === "dashboard" && (
        <main className="main">

          {/* HEADER */}

          <header className="dashboard-header">

            <div>
              <div className="dashboard-eyebrow">
                CIVICFLOW AI
              </div>

              <h1>
                Predictive Queue &amp;
                <br />
                Bottleneck Management
              </h1>

              <p>
                Monitor government service delivery
                and identify bottlenecks before they
                become critical.
              </p>
            </div>


            {/* PREMIUM LIVE STATUS */}

            <div className="premium-live-status">

              <span className="premium-live-dot"></span>

              <div>
                <strong>
                  LIVE OPERATIONS
                </strong>

                <span>
                  Predictive monitoring active
                </span>
              </div>

            </div>

          </header>


          {/* =================================================
              PREMIUM WORKSPACE NAVIGATION
          ================================================= */}

          <div className="workspace-nav">

            <button
              className="workspace-nav-item active"
              onClick={() =>
                setActivePage("dashboard")
              }
            >
              <span className="workspace-nav-icon">
                ▦
              </span>

              <span>
                <strong>Dashboard</strong>
                <small>Overview</small>
              </span>
            </button>


            <button
              className="workspace-nav-item"
              onClick={() =>
                setActivePage("live")
              }
            >
              <span className="workspace-nav-icon">
                ⌁
              </span>

              <span>
                <strong>Live Queues</strong>
                <small>Real-time monitoring</small>
              </span>
            </button>


            <button
              className="workspace-nav-item"
              onClick={() =>
                setActivePage("analytics")
              }
            >
              <span className="workspace-nav-icon">
                ▥
              </span>

              <span>
                <strong>Analytics</strong>
                <small>Performance insights</small>
              </span>
            </button>


            <button
              className="workspace-nav-item"
              onClick={() =>
                setActivePage("settings")
              }
            >
              <span className="workspace-nav-icon">
                ⚙
              </span>

              <span>
                <strong>Settings</strong>
                <small>System configuration</small>
              </span>
            </button>

          </div>


          {/* SERVICE CENTRE */}

          <section className="service-centre">
            <div>
              <span className="service-label">
                GOVERNMENT SERVICE CENTRE
              </span>
              <h2>
                {serviceCenter.name || "Government Service Centre"}
              </h2>
            </div>
            <div className="live-indicator">
              <span></span>
              LIVE
            </div>
          </section>

          {/* KPI CARDS */}

          <section className="metrics-grid">
            <Metric
              label="CURRENT QUEUE"
              value={formatNumber(totalCurrentQueue)}
              description="Citizens currently waiting"
              icon="↗"
            />

            <Metric
              label="PREDICTED · 60 MIN"
              value={
                predictionAvailable
                  ? formatNumber(predicted60, 2)
                  : "—"
              }
              description={
                predictionAvailable
                  ? `Expected queue at ${bottleneck.stage || bottleneckCounter.name || "bottleneck"}`
                  : "Prediction not yet generated for this counter"
              }
              icon="⌁"
            />

            <Metric
              label="BOTTLENECK"
              value={bottleneck.stage || bottleneckCounter.name || "None detected"}
              description={prediction.thresholdExceeded ? "⚠ Capacity threshold exceeded" : "Within safe operating threshold"}
              icon="!"
              danger={Boolean(prediction.thresholdExceeded)}
            />

            <Metric
              label="AI MODEL RELIABILITY"
              value={
                modelReliability !== null
                  ? `${formatNumber(modelReliability, 2)}%`
                  : "—"
              }
              description={
                modelReliability !== null
                  ? "Validation-based prediction reliability"
                  : "Run a prediction for this counter to see reliability"
              }
              icon="AI"
            />
          </section>


          {/* LIVE QUEUE STATUS */}

          <section className="dashboard-section">

            <div className="section-heading">

              <div>
                <span>
                  REAL-TIME OPERATIONS
                </span>

                <h2>
                  Live Queue Status
                </h2>
              </div>

              <div className="updated">
                ● Updated just now
              </div>

            </div>


            <div className="queue-grid">
              {counters.map((counter, index) => {
                const isBottleneck =
                  counter.id === bottleneck.counterId ||
                  counter.stage === bottleneck.stage ||
                  counter.status === "critical";

                const statusDescription =
                  counter.status === "critical"
                    ? "Processing capacity exceeded"
                    : counter.status === "busy"
                      ? "High operational load"
                      : "Normal processing";

                return (
                  <QueueCard
                    key={counter.id || `${counter.name}-${index}`}
                    counter={String(index + 1).padStart(2, "0")}
                    name={counter.name || counter.stage || `Counter ${index + 1}`}
                    queue={formatNumber(counter.queue)}
                    description={statusDescription}
                    percentage={queuePercentage(counter.queue)}
                    danger={isBottleneck}
                  />
                );
              })}
            </div>

          </section>


          {/* =================================================
              FORECAST + BOTTLENECK
          ================================================= */}

          <section className="dashboard-two-column">

            {/* FORECAST */}

            <section className="card forecast-card">

              <div className="card-heading">

                <div>
                  <span>
                    AI PREDICTION
                  </span>

                  <h2>
                    Queue Forecast
                  </h2>
                </div>

                <div className="forecast-warning">
                  ⚠ Threshold: {formatNumber(threshold)}
                </div>

              </div>


              {predictionAvailable ? (
                <>
                  <div className="forecast-chart">

                    <div className="chart-grid-line line-1"></div>
                    <div className="chart-grid-line line-2"></div>
                    <div className="chart-grid-line line-3"></div>

                    <div className="threshold-line">
                      <span>
                        THRESHOLD {formatNumber(threshold)}
                      </span>
                    </div>

                    <svg
                      className="forecast-svg"
                      viewBox="0 0 600 220"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22dfff" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#22dfff" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="forecastLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22dfff" />
                          <stop offset="70%" stopColor="#22dfff" />
                          <stop offset="100%" stopColor="#ffae61" />
                        </linearGradient>
                      </defs>

                      <path
                        d={`M 40 ${chartY(currentBottleneckQueue)} C 150 ${chartY(currentBottleneckQueue) - 8}, 230 ${chartY(predicted30) + 8}, 330 ${chartY(predicted30)} C 430 ${chartY(predicted60) + 18}, 500 ${chartY(predicted60) + 6}, 560 ${chartY(predicted60)} L 560 220 L 40 220 Z`}
                        fill="url(#forecastArea)"
                      />
                      <path
                        d={`M 40 ${chartY(currentBottleneckQueue)} C 150 ${chartY(currentBottleneckQueue) - 8}, 230 ${chartY(predicted30) + 8}, 330 ${chartY(predicted30)} C 430 ${chartY(predicted60) + 18}, 500 ${chartY(predicted60) + 6}, 560 ${chartY(predicted60)}`}
                        fill="none"
                        stroke="url(#forecastLine)"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>

                    <div className="forecast-data point-now">
                      <div className="forecast-dot"></div>
                      <strong>{formatNumber(currentBottleneckQueue)}</strong>
                      <span>NOW</span>
                    </div>

                    <div className="forecast-data point-30">
                      <div className="forecast-dot"></div>
                      <strong>{formatNumber(predicted30, 2)}</strong>
                      <span>30 MIN</span>
                    </div>

                    <div className="forecast-data point-60">
                      <div className="forecast-dot critical"></div>
                      <strong>{formatNumber(predicted60, 2)}</strong>
                      <span>60 MIN</span>
                    </div>

                  </div>

                  <div className="forecast-summary">
                    <div>
                      <span>NOW</span>
                      <strong>{formatNumber(currentBottleneckQueue)}</strong>
                    </div>
                    <div className="forecast-arrow">→</div>
                    <div>
                      <span>30 MIN</span>
                      <strong>{formatNumber(predicted30, 2)}</strong>
                    </div>
                    <div className="forecast-arrow">→</div>
                    <div className="critical-summary">
                      <span>60 MIN</span>
                      <strong>{formatNumber(predicted60, 2)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="forecast-unavailable">
                  <div className="forecast-unavailable-icon">⌁</div>
                  <strong>Prediction not yet generated</strong>
                  <p>
                    No ML prediction exists for{" "}
                    {bottleneck.stage || bottleneckCounter.name || "this counter"} yet.
                    Use <strong>POST /api/predictions/run</strong> with this counter's
                    current queue, processing time, staff count and arrival rate to
                    generate a forecast.
                  </p>
                </div>
              )}

              <div className="model-performance-strip">
                <div>
                  <span>MODEL RELIABILITY</span>
                  <strong>
                    {modelReliability !== null
                      ? `${formatNumber(modelReliability, 2)}%`
                      : "—"}
                  </strong>
                </div>
              </div>

            </section>


            {/* BOTTLENECK */}

            <section className="card bottleneck-card">

              <div className="card-heading">

                <div>
                  <span>
                    DETECTED ISSUE
                  </span>

                  <h2>
                    Bottleneck Alert
                  </h2>
                </div>

                <div className="alert-symbol">
                  !
                </div>

              </div>


              <div className="bottleneck-content">

                <div className="critical-label">
                  ⚠ CRITICAL PREDICTION
                </div>

                <strong>
                  {bottleneck.stage || bottleneckCounter.name || "No bottleneck detected"}
                </strong>

                <p>
                  The {bottleneck.stage || bottleneckCounter.name || "bottleneck"} queue is predicted
                  to exceed the safe operating threshold
                  within the next 60 minutes.
                </p>


                <div className="bottleneck-progress">

                  <div className="progress-label">

                    <span>
                      Current load
                    </span>

                    <strong>
                      {formatNumber(currentBottleneckQueue)} / {formatNumber(threshold)}
                    </strong>

                  </div>


                  <div className="bottleneck-progress-bar">

                    <div
                      style={{
                        width: `${queuePercentage(currentBottleneckQueue)}%`,
                      }}
                    />

                  </div>

                </div>


                <div className="bottleneck-meta">

                  <span>
                    Current
                    <b>{formatNumber(currentBottleneckQueue)}</b>
                  </span>

                  <span>
                    Predicted
                    <b className="orange-text">
                      {formatNumber(predicted60, 2)}
                    </b>
                  </span>

                  <span>
                    Threshold
                    <b>{formatNumber(threshold)}</b>
                  </span>

                </div>

              </div>

            </section>

          </section>


          {/* ROOT CAUSE */}

          <section className="card root-cause-card">
            <div className="card-heading">
              <div>
                <span>INTELLIGENCE LAYER</span>
                <h2>Why is this happening?</h2>
              </div>
              <span className="analysis-badge">AI ANALYSIS</span>
            </div>

            <div className="cause-grid">
              <div className="cause-item">
                <strong>{formatPercent(arrivalIncrease)}</strong>
                <span>Arrivals</span>
              </div>
              <div className="cause-item">
                <strong>{formatPercent(processingChange)}</strong>
                <span>Processing time</span>
              </div>
              <div className="cause-item">
                <strong>{staffChange < 0 ? "↓" : staffChange > 0 ? "↑" : "→"} {Math.abs(staffChange)}</strong>
                <span>Officer available</span>
              </div>
            </div>

            <div className="likely-cause">
              <span>LIKELY CAUSE</span>
              <strong>{likelyCause}</strong>
            </div>
          </section>


          {/* WHAT-IF SIMULATION */}

          <section className="card simulation-card">

            <div className="card-heading">

              <div>

                <span>
                  DECISION SUPPORT
                </span>

                <h2>
                  What-If Simulation
                </h2>

              </div>

              <div className="simulation-badge">
                SIMULATE
              </div>

            </div>


            <div className="simulation-intro">

              <div>

                <span>
                  CURRENT {String(bottleneck.stage || bottleneckCounter.name || "BOTTLENECK").toUpperCase()} QUEUE
                </span>

                <strong>
                  {formatNumber(currentBottleneckQueue)}
                </strong>

                <small>
                  people waiting
                </small>

              </div>


              <div className="simulation-arrow">
                →
              </div>


              <div className="simulation-question">

                <strong>
                  What should we do?
                </strong>

                <span>
                  Compare possible interventions before
                  taking action.
                </span>

              </div>

            </div>


            <div className="scenario-grid">

              <button
                className={`scenario-button ${
                  selectedScenario === "Add Officer"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleScenario("Add Officer")
                }
              >

                <span className="scenario-number">
                  01
                </span>

                <div>
                  <strong>
                    Add Officer
                  </strong>

                  <small>
                    Increase verification capacity
                  </small>
                </div>

                <span className="scenario-arrow">
                  →
                </span>

              </button>


              <button
                className={`scenario-button ${
                  selectedScenario === "Move Officer"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleScenario("Move Officer")
                }
              >

                <span className="scenario-number">
                  02
                </span>

                <div>
                  <strong>
                    Move Officer
                  </strong>

                  <small>
                    Reallocate existing staff
                  </small>
                </div>

                <span className="scenario-arrow">
                  →
                </span>

              </button>


              <button
                className={`scenario-button ${
                  selectedScenario ===
                  "Route Simple Cases Online"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleScenario(
                    "Route Simple Cases Online"
                  )
                }
              >

                <span className="scenario-number">
                  03
                </span>

                <div>
                  <strong>
                    Route Simple Cases Online
                  </strong>

                  <small>
                    Reduce physical queue demand
                  </small>
                </div>

                <span className="scenario-arrow">
                  →
                </span>

              </button>


              <button
                className={`scenario-button scenario-danger ${
                  selectedScenario === "Do Nothing"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleScenario("Do Nothing")
                }
              >

                <span className="scenario-number">
                  04
                </span>

                <div>
                  <strong>
                    Do Nothing
                  </strong>

                  <small>
                    Continue current operations
                  </small>
                </div>

                <span className="scenario-arrow">
                  →
                </span>

              </button>

            </div>


            {simulationLoading && (
              <div className="simulation-result">
                <div className="result-label">RUNNING SIMULATION</div>
                <div className="result-main">
                  <div>
                    <span>Backend AI decision support</span>
                    <strong>Calculating live scenario outcomes...</strong>
                  </div>
                </div>
              </div>
            )}

            {simulationError && (
              <div className="simulation-result result-danger">
                <div className="result-label">SIMULATION ERROR</div>
                <div className="result-main">
                  <div>
                    <span>Backend response</span>
                    <strong>{simulationError}</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedScenario && simulationData && !simulationLoading && (

              <div
                className={`simulation-result ${
                  scenarios[selectedScenario].type ===
                  "danger"
                    ? "result-danger"
                    : ""
                }`}
              >

                <div className="result-label">
                  SIMULATION RESULT
                </div>


                <div className="result-main">

                  <div>

                    <span>
                      Selected scenario
                    </span>

                    <strong>
                      {selectedScenario}
                    </strong>

                  </div>


                  <div className="result-metric">

                    <span>
                      Expected outcome
                    </span>

                    <strong>
                      {
                        scenarios[selectedScenario]
                          .result
                      }
                    </strong>

                  </div>


                  <div className="result-metric">

                    <span>
                      Projected queue
                    </span>

                    <strong>
                      {
                        scenarios[selectedScenario]
                          .queue
                      }
                    </strong>

                  </div>

                </div>


                <div className="result-impact">

                  <span>
                    EXPECTED EFFECT
                  </span>

                  <strong>
                    {
                      scenarios[selectedScenario]
                        .impact
                    }
                  </strong>

                </div>

                <div className="result-impact">
                  <span>SIMULATION SOURCE</span>
                  <strong>Live queue data + backend What-If engine</strong>
                </div>

              </div>

            )}

          </section>


          {/* AI RECOMMENDATION */}

          <section className="card recommendation-card">

            <div className="card-heading">

              <div>

                <span>
                  AI DECISION SUPPORT
                </span>

                <h2>
                  Recommended Action
                </h2>

              </div>

              <div className="recommendation-status">
                AI RECOMMENDATION
              </div>

            </div>


            <div className="recommendation-content">

              <div className="recommendation-icon">
                ✦
              </div>


              <div className="recommendation-main">

                {recommendation.available === false ? (
                  <>
                    <div className="recommendation-alert" style={{ background: "rgba(255,174,97,0.08)", color: "#ffae61", borderColor: "rgba(255,174,97,0.18)" }}>
                      ⚠ AWAITING RECOMMENDATION
                    </div>

                    <h3 style={{ color: "#8fa3b0" }}>
                      No recommendation for {bottleneck.stage || bottleneckCounter.name || "this counter"} yet
                    </h3>

                    <p style={{ color: "#607d89" }}>
                      The current bottleneck is{" "}
                      <strong style={{ color: "#c8d8e4" }}>
                        {bottleneck.stage || bottleneckCounter.name}
                      </strong>
                      . Use <strong>POST /api/recommendations</strong> to create
                      a recommendation targeting this counter, then approve it to
                      trigger intervention monitoring.
                    </p>

                    <div className="recommendation-details">
                      <div>
                        <span>BOTTLENECK COUNTER</span>
                        <strong>{bottleneck.stage || bottleneckCounter.name || "—"}</strong>
                      </div>
                      <div>
                        <span>CURRENT QUEUE</span>
                        <strong>{formatNumber(currentBottleneckQueue)}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="recommendation-alert">
                      🚨 BOTTLENECK ALERT
                    </div>

                    <h3>
                      {recommendation.action}
                    </h3>

                    <p>
                      {recommendation.reason ||
                        bottleneck.reason ||
                        `${likelyCause} are contributing to the predicted queue growth.`}
                    </p>

                    <div className="recommendation-details">

                      <div>
                        <span>PRIMARY CAUSE</span>
                        <strong>{rootCause.reason || likelyCause}</strong>
                      </div>

                      <div>
                        <span>EXPECTED EFFECT</span>
                        <strong>
                          {recommendation.expectedImpact || "Reduce predicted queue growth"}
                        </strong>
                      </div>

                    </div>
                  </>
                )}


                {/* ---- APPROVED state ---- */}
                {interventionStatus === "approved" && (
                  <div className="recommendation-approved-state">
                    <div className="approved-badge-row">
                      <span className="approved-checkmark">✓</span>
                      <span className="approved-badge-label">APPROVED</span>
                    </div>

                    <div className="decision-message approved-message">
                      <span>✓</span>
                      <div>
                        <strong>Intervention approved</strong>
                        <small>
                          {recommendation.approvedAt
                            ? `Approved on ${new Date(recommendation.approvedAt).toLocaleString()}`
                            : "Monitoring intervention effectiveness…"}
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- REJECTED state ---- */}
                {interventionStatus === "rejected" && (
                  <div className="decision-message rejected-message">
                    <span>!</span>
                    <div>
                      <strong>Recommendation rejected</strong>
                      <small>No intervention has been applied.</small>
                    </div>
                  </div>
                )}

                {/* ---- PENDING state — show action buttons only when a recommendation exists ---- */}
                {interventionStatus === "pending" && recommendation.available !== false && (
                  <div className="recommendation-actions">
                    <button
                      className="approve-button"
                      onClick={handleApprove}
                      disabled={recommendationActionLoading}
                    >
                      {recommendationActionLoading
                        ? "PROCESSING..."
                        : "✓ APPROVE"}
                    </button>

                    <button
                      className="reject-button"
                      onClick={handleReject}
                      disabled={recommendationActionLoading}
                    >
                      {recommendationActionLoading
                        ? "PROCESSING..."
                        : "✕ REJECT"}
                    </button>
                  </div>
                )}

                {recommendationActionError && (
                  <div className="decision-message rejected-message">
                    <span>!</span>
                    <div>
                      <strong>Action failed</strong>
                      <small>{recommendationActionError}</small>
                    </div>
                  </div>
                )}

                {/* monitoring effectiveness banner (approved path) */}
                {interventionStatus === "approved" && monitoring?.effectiveness && (
                  <div className="decision-message approved-message" style={{ marginTop: "8px" }}>
                    <span>✓</span>
                    <div>
                      <strong>Monitoring active</strong>
                      <small>Comparing queue conditions before and after the intervention.</small>
                    </div>
                  </div>
                )}

              </div>

            </div>

          </section>


          {/* INTERVENTION MONITORING */}

          {(interventionStatus === "approved" || monitoring?.effectiveness) && (

            <section className="card monitoring-card">

              <div className="card-heading">

                <div>

                  <span>
                    CONTINUOUS MONITORING
                  </span>

                  <h2>
                    Intervention Monitor
                  </h2>

                </div>


                <div className="monitoring-live">

                  <span></span>

                  MONITORING

                </div>

              </div>


              <div className="monitoring-banner">

                <div className="monitoring-icon">
                  ✓
                </div>


                <div>

                  <strong>
                    {monitoring.effectiveness === "positive"
                      ? "Intervention is producing a positive effect"
                      : "Intervention effectiveness is being monitored"}
                  </strong>

                  <p>
                    {monitoring.notes ||
                      "The system is comparing queue and waiting-time conditions before and after the intervention."}
                  </p>

                </div>

              </div>


              <div className="before-after-grid">

                <div className="monitor-column">

                  <div className="monitor-label">
                    BEFORE
                  </div>


                  <div className="monitor-metric">

                    <span>
                      Queue
                    </span>

                    <strong>
                      {formatNumber(monitoringBeforeQueue)}
                    </strong>

                    <small>
                      people
                    </small>

                  </div>


                  <div className="monitor-metric">

                    <span>
                      Wait time
                    </span>

                    <strong>
                      {formatNumber(monitoringBeforeWait)}
                    </strong>

                    <small>
                      minutes
                    </small>

                  </div>

                </div>


                <div className="monitor-arrow">
                  →
                </div>


                <div className="monitor-column after-column">

                  <div className="monitor-label">
                    AFTER
                  </div>


                  <div className="monitor-metric">

                    <span>
                      Queue
                    </span>

                    <strong>
                      {formatNumber(monitoringAfterQueue)}
                    </strong>

                    <small>
                      people
                    </small>

                  </div>


                  <div className="monitor-metric">

                    <span>
                      Wait time
                    </span>

                    <strong>
                      {formatNumber(monitoringAfterWait)}
                    </strong>

                    <small>
                      minutes
                    </small>

                  </div>

                </div>

              </div>


              <div className="effectiveness">

                <div>

                  <span>
                    INTERVENTION EFFECTIVENESS
                  </span>

                  <strong>
                    {monitoring.effectiveness === "positive" ? "✓ POSITIVE" : String(monitoring.effectiveness || "MONITORING").toUpperCase()}
                  </strong>

                </div>


                <div className="effectiveness-bar">
                  <div></div>
                </div>


                <small>
                  Queue reduced by {formatNumber(queueReduction)}% · Wait time reduced by {formatNumber(waitReduction)}%
                </small>

              </div>


              <div className="monitor-footer">

                <span>
                  ● LIVE MONITORING
                </span>

                <span>
                  Last updated just now
                </span>

              </div>

            </section>

          )}

        </main>
      )}


      {/* =====================================================
          OTHER PAGES
      ===================================================== */}

      {activePage === "live" && (
        <LiveQueues
          dashboardData={dashboardData}
          serviceCenter={serviceCenter}
          counters={counters}
          bottleneck={bottleneck}
        />
      )}

      {activePage === "analytics" && (
        <Analytics
          dashboardData={dashboardData}
          serviceCenter={serviceCenter}
          counters={counters}
          bottleneck={bottleneck}
          prediction={prediction}
          rootCause={rootCause}
          recommendation={recommendation}
          monitoring={monitoring}
        />
      )}

      {activePage === "settings" && (
        <Settings />
      )}

    </div>
  );
}


export default App;