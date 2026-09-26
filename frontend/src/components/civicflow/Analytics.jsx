/* =========================================================
   CIVICFLOW AI — ANALYTICS PAGE
   Backend-driven analytics
========================================================= */

function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return decimals > 0 ? number.toFixed(decimals) : Math.round(number);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (number === 0) return "→ No change";
  return `${number >= 0 ? "↑" : "↓"} ${Math.abs(number).toFixed(0)}%`;
}

function Analytics({
  dashboardData = {},
  serviceCenter = {},
  counters = [],
  bottleneck = {},
  prediction = {},
  rootCause = {},
  recommendation = {},
  monitoring = {},
}) {
  const safeCounters = Array.isArray(counters) ? counters : [];

  /*
   * The backend currently provides the latest live counter state and
   * the latest prediction. It does not provide an 8-hour historical
   * series, so this page intentionally does NOT invent historical data.
   */
  const totalQueue = safeCounters.reduce(
    (sum, counter) => sum + Number(counter.queue || 0),
    0
  );

  const averageQueue =
    safeCounters.length > 0 ? totalQueue / safeCounters.length : 0;

  const bottleneckCounter =
    safeCounters.find((counter) => counter.id === bottleneck.counterId) ||
    safeCounters.find((counter) => counter.stage === bottleneck.stage) ||
    safeCounters.find((counter) => counter.status === "critical") ||
    safeCounters.reduce(
      (highest, counter) =>
        Number(counter.queue || 0) > Number(highest?.queue || 0)
          ? counter
          : highest,
      safeCounters[0]
    ) ||
    {};

  const threshold = Number(prediction.threshold ?? 60);
  const currentBottleneckQueue = Number(bottleneckCounter.queue || 0);
  const predicted30 = Number(prediction.in30Minutes ?? 0);
  const predicted60 = Number(prediction.in60Minutes ?? 0);

  /*
   * Counter model:
   * queue pressure is derived from current queue vs the configured
   * prediction threshold. This is a pressure indicator, not a claim
   * that the backend has supplied a true historical utilization metric.
   */
  const getPressure = (counter) => {
    const queue = Number(counter.queue || 0);
    return Math.min(
      100,
      Math.max(0, (queue / Math.max(threshold, 1)) * 100)
    );
  };

  const getEstimatedWait = (counter) => {
    const queue = Number(counter.queue || 0);
    const processingTime = Number(counter.processingTime || 0);
    const staff = Math.max(1, Number(counter.staffCount || 1));

    if (!processingTime) return 0;

    return (queue * processingTime) / staff;
  };

  const averageWait =
    safeCounters.length > 0
      ? safeCounters.reduce(
          (sum, counter) => sum + getEstimatedWait(counter),
          0
        ) / safeCounters.length
      : 0;

  const peakPressure = safeCounters.length
    ? Math.max(...safeCounters.map(getPressure))
    : 0;

  const arrivalIncrease = Number(rootCause.arrivalIncrease ?? 0);
  const processingBefore = Number(rootCause.processingTimeBefore ?? 0);
  const processingNow = Number(rootCause.processingTimeNow ?? 0);
  const processingChange =
    processingBefore > 0
      ? ((processingNow - processingBefore) / processingBefore) * 100
      : 0;
  const staffChange = Number(rootCause.staffChange ?? 0);

  const likelyCause =
    rootCause.reason ||
    (arrivalIncrease > 0 && staffChange < 0
      ? "Increased arrivals + reduced staff availability"
      : arrivalIncrease > 0 && processingChange > 0
        ? "Increased arrivals + slower processing"
        : staffChange < 0
          ? "Reduced staff availability"
          : processingChange > 0
            ? "Increased processing time"
            : "Operational conditions are driving queue pressure");

  const bottleneckName =
    bottleneck.stage ||
    bottleneckCounter.name ||
    "No bottleneck detected";

  const bottleneckIsCritical =
    Boolean(prediction.thresholdExceeded) ||
    bottleneckCounter.status === "critical";

  const queueReduction =
    Number(monitoring.beforeQueue || 0) > 0
      ? ((Number(monitoring.beforeQueue) - Number(monitoring.afterQueue || 0)) /
          Number(monitoring.beforeQueue)) *
        100
      : 0;

  const waitReduction =
    Number(monitoring.beforeWaitTime || 0) > 0
      ? ((Number(monitoring.beforeWaitTime) -
          Number(monitoring.afterWaitTime || 0)) /
          Number(monitoring.beforeWaitTime)) *
        100
      : 0;

  /*
   * A compact live forecast instead of fabricated historical values.
   * The first point is the current bottleneck queue, followed by the
   * actual backend prediction horizons.
   */
  const queueTrend = [
    { label: "NOW", queue: currentBottleneckQueue },
    { label: "30 MIN", queue: predicted30 },
    { label: "60 MIN", queue: predicted60 },
  ];

  const maxQueue = Math.max(
    threshold,
    ...queueTrend.map((item) => Number(item.queue || 0)),
    1
  );

  const scenarioRows = safeCounters.map((counter, index) => ({
    ...counter,
    number: String(index + 1).padStart(2, "0"),
    pressure: getPressure(counter),
    estimatedWait: getEstimatedWait(counter),
    displayStatus:
      counter.status === "critical"
        ? "Bottleneck"
        : counter.status === "busy"
          ? "Busy"
          : "Normal",
  }));

  return (
    <main className="main analytics-page">

      {/* HEADER */}
      <header className="dashboard-header">
        <div>
          <div className="dashboard-eyebrow">CIVICFLOW AI</div>

          <h1>
            Operational
            <br />
            Analytics
          </h1>

          <p>
            Understand queue behaviour, counter performance and
            bottleneck patterns using live service-centre data.
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot"></span>

          <div>
            <strong>LIVE</strong>
            <span>Analytics updated from backend</span>
          </div>
        </div>
      </header>

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

      {/* ANALYTICS SUMMARY */}
      <section className="analytics-summary-grid">

        <div className="card analytics-stat-card">
          <span className="analytics-stat-label">
            AVERAGE QUEUE
          </span>

          <strong>{formatNumber(averageQueue)}</strong>

          <small>
            people · {safeCounters.length} active counter
            {safeCounters.length === 1 ? "" : "s"}
          </small>

          <span className="analytics-stat-change">
            Current total: {formatNumber(totalQueue)}
          </span>
        </div>

        <div className="card analytics-stat-card">
          <span className="analytics-stat-label">
            ESTIMATED AVERAGE WAIT
          </span>

          <strong>
            {formatNumber(averageWait)}
            <small> min</small>
          </strong>

          <small>
            calculated from live queue, processing time and staff
          </small>

          <span className="analytics-stat-change">
            Backend-derived estimate
          </span>
        </div>

        <div className="card analytics-stat-card">
          <span className="analytics-stat-label">
            PEAK QUEUE PRESSURE
          </span>

          <strong>{formatNumber(peakPressure)}%</strong>

          <small>
            {bottleneckName}
          </small>

          <span
            className={
              bottleneckIsCritical
                ? "analytics-stat-warning"
                : "analytics-stat-change"
            }
          >
            {bottleneckIsCritical
              ? "⚠ Above safe capacity"
              : "Within configured threshold"}
          </span>
        </div>

        <div className="card analytics-stat-card">
          <span className="analytics-stat-label">
            ACTIVE BOTTLENECKS
          </span>

          <strong>
            {bottleneckName === "No bottleneck detected" ? 0 : 1}
          </strong>

          <small>
            currently detected by the backend
          </small>

          <span className="analytics-stat-warning">
            {bottleneckName}
          </span>
        </div>

      </section>

      {/* QUEUE FORECAST */}
      <section className="card analytics-chart-card">

        <div className="card-heading">
          <div>
            <span>LIVE FORECAST ANALYSIS</span>
            <h2>Queue Forecast</h2>
          </div>

          <div className="analytics-chart-legend">
            <span className="legend-dot"></span>
            Backend prediction
          </div>
        </div>

        <div className="analytics-chart">

          <div className="analytics-y-axis">
            <span>{formatNumber(maxQueue)}</span>
            <span>{formatNumber(maxQueue * 0.75)}</span>
            <span>{formatNumber(maxQueue * 0.5)}</span>
            <span>{formatNumber(maxQueue * 0.25)}</span>
            <span>0</span>
          </div>

          <div className="analytics-chart-area">

            <div className="analytics-grid-line"></div>
            <div className="analytics-grid-line"></div>
            <div className="analytics-grid-line"></div>
            <div className="analytics-grid-line"></div>
            <div className="analytics-grid-line"></div>

            <div className="analytics-bars">
              {queueTrend.map((item, index) => (
                <div
                  className="analytics-bar-column"
                  key={item.label}
                >
                  <div
                    className="analytics-bar"
                    style={{
                      height: `${Math.max(
                        4,
                        (Number(item.queue || 0) / maxQueue) * 100
                      )}%`,
                    }}
                  >
                    <span>{formatNumber(item.queue, 2)}</span>
                  </div>

                  <small>{item.label}</small>
                </div>
              ))}
            </div>

          </div>
        </div>

        <div className="analytics-insight">
          <span>AI INSIGHT</span>

          <p>
            {predicted60 > currentBottleneckQueue
              ? `${bottleneckName} is projected to grow from ${formatNumber(
                  currentBottleneckQueue
                )} to ${formatNumber(
                  predicted60,
                  2
                )} people within 60 minutes.`
              : `${bottleneckName} is not currently projected to grow over the next 60 minutes.`}
          </p>
        </div>

      </section>

      {/* LIVE FLOW ANALYSIS */}
      <section className="analytics-two-column">

        <section className="card analytics-rate-card">

          <div className="card-heading">
            <div>
              <span>FLOW ANALYSIS</span>
              <h2>Operational Pressure</h2>
            </div>
          </div>

          <div className="rate-comparison">

            <div className="rate-item">
              <div className="rate-top">
                <span>ARRIVAL PRESSURE</span>
                <strong>{formatPercent(arrivalIncrease)}</strong>
              </div>

              <div className="rate-bar">
                <div
                  className="rate-fill arrival-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, Math.abs(arrivalIncrease))
                    )}%`,
                  }}
                ></div>
              </div>

              <small>
                Change in arrival rate between the latest root-cause snapshots
              </small>
            </div>

            <div className="rate-item">
              <div className="rate-top">
                <span>PROCESSING TIME CHANGE</span>
                <strong>{formatPercent(processingChange)}</strong>
              </div>

              <div className="rate-bar">
                <div
                  className="rate-fill processing-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, Math.abs(processingChange))
                    )}%`,
                  }}
                ></div>
              </div>

              <small>
                {processingBefore > 0
                  ? `${formatNumber(processingBefore)} → ${formatNumber(
                      processingNow
                    )} minutes`
                  : "Processing history not available"}
              </small>
            </div>

          </div>

          <div className="rate-warning">
            <span>⚠</span>

            <div>
              <strong>{likelyCause}</strong>

              <small>
                Staff change:{" "}
                {staffChange > 0
                  ? `+${staffChange}`
                  : staffChange}
                · Current bottleneck: {bottleneckName}
              </small>
            </div>
          </div>

        </section>

        {/* CURRENT DEMAND */}
        <section className="card peak-hours-card">

          <div className="card-heading">
            <div>
              <span>DEMAND PATTERN</span>
              <h2>Current Queue Distribution</h2>
            </div>
          </div>

          <div className="peak-list">
            {scenarioRows.length === 0 ? (
              <div className="peak-row">
                <span>No counters available</span>
                <div>
                  <i style={{ width: "0%" }}></i>
                </div>
                <strong>0</strong>
              </div>
            ) : (
              scenarioRows.map((counter) => (
                <div
                  className={`peak-row ${
                    counter.id === bottleneck.counterId ||
                    counter.stage === bottleneck.stage ||
                    counter.status === "critical"
                      ? "peak-active"
                      : ""
                  }`}
                  key={counter.id || counter.number}
                >
                  <span>{counter.name}</span>

                  <div>
                    <i
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, counter.pressure)
                        )}%`,
                      }}
                    ></i>
                  </div>

                  <strong>{formatNumber(counter.queue)}</strong>
                </div>
              ))
            )}
          </div>

        </section>

      </section>

      {/* COUNTER UTILIZATION */}
      <section className="card analytics-counter-card">

        <div className="card-heading">
          <div>
            <span>COUNTER PERFORMANCE</span>
            <h2>Live Counter Pressure</h2>
          </div>

          <div className="analytics-live-badge">
            ● LIVE DATA
          </div>
        </div>

        <div className="counter-analytics-list">

          {scenarioRows.length === 0 ? (
            <div className="counter-analytics-row">
              <div className="counter-identity">
                <span>--</span>
                <div>
                  <strong>No counter data</strong>
                  <small>Waiting for backend data</small>
                </div>
              </div>
            </div>
          ) : (
            scenarioRows.map((counter) => {

              const isBottleneck =
                counter.id === bottleneck.counterId ||
                counter.stage === bottleneck.stage ||
                counter.status === "critical";

              return (
                <div
                  className={`counter-analytics-row ${
                    isBottleneck ? "counter-row-danger" : ""
                  }`}
                  key={counter.id || counter.number}
                >

                  <div className="counter-identity">
                    <span>{counter.number}</span>

                    <div>
                      <strong>
                        {counter.name || counter.stage}
                      </strong>

                      <small>
                        Queue: {formatNumber(counter.queue)} people
                        · Staff: {formatNumber(counter.staffCount)}
                      </small>
                    </div>
                  </div>

                  <div className="counter-utilization">

                    <div className="utilization-header">
                      <span>QUEUE PRESSURE</span>

                      <strong>
                        {formatNumber(counter.pressure)}%
                      </strong>
                    </div>

                    <div className="utilization-track">
                      <div
                        className="utilization-fill"
                        style={{
                          width: `${counter.pressure}%`,
                        }}
                      ></div>
                    </div>

                  </div>

                  <div className="counter-wait">
                    <span>EST. WAIT</span>

                    <strong>
                      {formatNumber(counter.estimatedWait)} min
                    </strong>
                  </div>

                  <div
                    className={`counter-status ${
                      isBottleneck ? "status-danger" : ""
                    }`}
                  >
                    {counter.displayStatus}
                  </div>

                </div>
              );
            })
          )}

        </div>
      </section>

      {/* BOTTLENECK ANALYSIS */}
      <section className="card bottleneck-analytics-card">

        <div className="card-heading">
          <div>
            <span>ROOT CAUSE ANALYSIS</span>
            <h2>Bottleneck Analysis</h2>
          </div>

          <div className="analytics-chart-legend">
            Current backend state
          </div>
        </div>

        <div className="bottleneck-table">

          <div className="bottleneck-table-header">
            <span>SERVICE</span>
            <span>QUEUE</span>
            <span>IMPACT</span>
            <span>LIKELY CAUSE</span>
          </div>

          {scenarioRows.map((counter) => {

            const isBottleneck =
              counter.id === bottleneck.counterId ||
              counter.stage === bottleneck.stage ||
              counter.status === "critical";

            return (
              <div
                className="bottleneck-table-row"
                key={counter.id || counter.number}
              >

                <strong>
                  {counter.name || counter.stage}
                </strong>

                <span>
                  {formatNumber(counter.queue)}
                </span>

                <span
                  className={`impact-${
                    isBottleneck
                      ? "high"
                      : counter.status === "busy"
                        ? "medium"
                        : "low"
                  }`}
                >
                  {isBottleneck
                    ? "High"
                    : counter.status === "busy"
                      ? "Medium"
                      : "Low"}
                </span>

                <span>
                  {isBottleneck
                    ? likelyCause
                    : counter.status === "busy"
                      ? "Elevated operational load"
                      : "Normal operating pressure"}
                </span>

              </div>
            );
          })}

        </div>

        <div className="bottleneck-insight">

          <div className="bottleneck-insight-icon">
            !
          </div>

          <div>
            <span>SYSTEM INSIGHT</span>

            <strong>
              {bottleneckIsCritical
                ? `${bottleneckName} is the current operational bottleneck.`
                : "No critical bottleneck is currently detected."}
            </strong>

            <p>
              {likelyCause}. The backend is using the latest
              service-centre state and prediction data to identify
              operational pressure.
            </p>
          </div>

        </div>
      </section>

      {/* RECOMMENDATION / MONITORING */}
      <section className="analytics-two-column">

        <section className="card analytics-rate-card">

          <div className="card-heading">
            <div>
              <span>AI DECISION SUPPORT</span>
              <h2>Recommended Action</h2>
            </div>

            <div className="analytics-live-badge">
              BACKEND
            </div>
          </div>

          <div className="rate-warning">
            <span>✦</span>

            <div>
              <strong>
                {recommendation.action ||
                  `Temporarily assign 1 qualified officer to ${bottleneckName}`}
              </strong>

              <small>
                {recommendation.reason ||
                  bottleneck.reason ||
                  likelyCause}
              </small>
            </div>
          </div>

          <div className="analytics-insight">
            <span>EXPECTED EFFECT</span>

            <p>
              {recommendation.expectedImpact ||
                "Reduce predicted queue growth at the current bottleneck."}
            </p>
          </div>

        </section>

        <section className="card peak-hours-card">

          <div className="card-heading">
            <div>
              <span>CONTINUOUS MONITORING</span>
              <h2>Intervention Result</h2>
            </div>
          </div>

          {monitoring.effectiveness ? (
            <div className="peak-list">

              <div className="peak-row">
                <span>Queue</span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          Number(monitoring.beforeQueue || 0) > 0
                            ? (Number(monitoring.afterQueue || 0) /
                                Number(monitoring.beforeQueue || 0)) *
                                100
                            : 0
                        )
                      )}%`,
                    }}
                  ></i>
                </div>
                <strong>
                  {formatNumber(monitoring.afterQueue)}
                </strong>
              </div>

              <div className="peak-row">
                <span>Wait time</span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          Number(monitoring.beforeWaitTime || 0) > 0
                            ? (Number(monitoring.afterWaitTime || 0) /
                                Number(monitoring.beforeWaitTime || 0)) *
                                100
                            : 0
                        )
                      )}%`,
                    }}
                  ></i>
                </div>
                <strong>
                  {formatNumber(monitoring.afterWaitTime)} min
                </strong>
              </div>

              <div className="peak-row">
                <span>Effectiveness</span>
                <div>
                  <i
                    style={{
                      width:
                        monitoring.effectiveness === "positive"
                          ? "100%"
                          : "50%",
                    }}
                  ></i>
                </div>
                <strong>
                  {String(
                    monitoring.effectiveness
                  ).toUpperCase()}
                </strong>
              </div>

            </div>
          ) : (
            <div className="analytics-insight">
              <span>MONITORING STATUS</span>
              <p>
                No intervention monitoring result is currently
                available from the backend.
              </p>
            </div>
          )}

          {monitoring.effectiveness && (
            <div className="analytics-insight">
              <span>IMPACT</span>

              <p>
                Queue reduced by {formatNumber(queueReduction)}%
                · Wait time reduced by {formatNumber(waitReduction)}%.
              </p>
            </div>
          )}

        </section>

      </section>

      {/* FOOTER STATUS */}
      <div className="analytics-footer">
        <span>● ANALYTICS ENGINE ACTIVE</span>

        <span>
          {serviceCenter.name || "Service centre"} · Live backend data
        </span>
      </div>

    </main>
  );
}

export default Analytics;
