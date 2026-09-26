const express = require("express");

const ServiceCenter = require("../models/ServiceCenter");
const Counter = require("../models/Counter");
const Prediction = require("../models/Prediction");
const Intervention = require("../models/Intervention");
const Monitoring = require("../models/Monitoring");
const QueueSnapshot = require("../models/QueueSnapshot");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        // --------------------------------------------------
        // 1. Get active service centre
        // --------------------------------------------------
        const serviceCenter = await ServiceCenter
            .findOne({ active: true })
            .lean();

        if (!serviceCenter) {
            return res.status(404).json({
                success: false,
                message: "No active service centre found"
            });
        }

        // --------------------------------------------------
        // 2. Get all counters from MongoDB
        // --------------------------------------------------
        const counters = await Counter
            .find({ serviceCenter: serviceCenter._id })
            .sort({ createdAt: 1 })
            .lean();

        if (counters.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No counters found for this service centre"
            });
        }

        // --------------------------------------------------
        // 3. Find current bottleneck dynamically.
        //
        // Primary signal: highest currentQueue (most citizens
        // actually waiting right now).
        // Tie-break: lowest processing throughput (staff /
        // processingTime) among counters that share the same
        // maximum queue length.
        // --------------------------------------------------
        const bottleneckCounter = [...counters].sort((a, b) => {
            // Prefer the counter with the most people waiting.
            const queueDiff = b.currentQueue - a.currentQueue;
            if (queueDiff !== 0) return queueDiff;

            // Tie-break on lowest throughput capacity.
            const throughputA =
                a.processingTime > 0
                    ? a.staffCount / a.processingTime
                    : Infinity;
            const throughputB =
                b.processingTime > 0
                    ? b.staffCount / b.processingTime
                    : Infinity;

            return throughputA - throughputB;
        })[0];

        // --------------------------------------------------
        // 4. Get latest prediction for the bottleneck counter.
        //
        // Predictions are generated on demand via
        // POST /api/predictions/run and are counter-specific.
        // We only use a prediction when it belongs to the current
        // bottleneck counter — using another counter's prediction
        // as a stand-in would misrepresent the forecast.
        //
        // When no prediction exists for the bottleneck counter,
        // we return predictionAvailable: false so the frontend
        // can display an honest "not yet generated" state.
        // --------------------------------------------------
        const latestPrediction = await Prediction
            .findOne({ counter: bottleneckCounter._id })
            .sort({ createdAt: -1 })
            .lean();

        // --------------------------------------------------
        // 5. Get latest recommendation for the current bottleneck.
        //
        // Only return an Intervention document whose `counter`
        // field matches the current bottleneck counter.  An
        // intervention targeting a previously-bottlenecked counter
        // must not be presented as the current recommendation —
        // that would mislead operators into approving an action
        // for the wrong queue.
        //
        // Historical interventions for other counters remain in
        // the database and are unaffected.
        // --------------------------------------------------
        const latestRecommendation = await Intervention
            .findOne({ counter: bottleneckCounter._id })
            .sort({ createdAt: -1 })
            .lean();

        // --------------------------------------------------
        // 6. Get latest monitoring result
        // --------------------------------------------------
        const latestMonitoring = await Monitoring
            .findOne({
                counter: bottleneckCounter._id
            })
            .sort({ checkedAt: -1 })
            .lean();

        // --------------------------------------------------
        // 7. Get queue snapshots for root-cause analysis.
        //
        // We fetch the most recent 20 snapshots and split them
        // into two meaningful reference points:
        //
        //   latestSnapshot  — the most recent record (current
        //                     operational state)
        //
        //   baselineSnapshot — the most recent snapshot whose
        //                     staffAvailable differs from the
        //                     latest snapshot, representing the
        //                     pre-intervention state.
        //                     If all snapshots share the same
        //                     staffAvailable, we fall back to the
        //                     oldest snapshot in the window so
        //                     we at least capture any arrival-rate
        //                     or processing-time trend.
        //
        // This avoids comparing two adjacent same-staff snapshots
        // (e.g. approval-baseline vs. post-event) which would
        // always produce staffChange = 0.
        // --------------------------------------------------
        const recentSnapshots = await QueueSnapshot
            .find({ counter: bottleneckCounter._id })
            .sort({ recordedAt: -1 })
            .limit(20)
            .lean();

        let rootCause = {
            arrivalIncrease: 0,
            processingTimeBefore: 0,
            processingTimeNow: bottleneckCounter.processingTime,
            staffChange: 0
        };

        if (recentSnapshots.length >= 2) {
            const latestSnapshot = recentSnapshots[0];

            // Find the most recent snapshot where staffAvailable
            // differs from the current state — that is the real
            // pre-intervention reference point.
            const currentStaff = Number(latestSnapshot.staffAvailable || 0);
            const baselineSnapshot =
                recentSnapshots.slice(1).find(
                    (s) => Number(s.staffAvailable) !== currentStaff
                ) || recentSnapshots[recentSnapshots.length - 1];

            let arrivalIncrease = 0;

            // Use the most recent snapshot that has a non-zero
            // arrivalRate as the arrival reference — adjacent
            // snapshots may both be 0 if they were captured in
            // rapid succession.
            const prevWithArrival = recentSnapshots
                .slice(1)
                .find((s) => Number(s.arrivalRate) > 0);

            if (prevWithArrival) {
                const latestArrival = Number(
                    recentSnapshots.find(
                        (s) => Number(s.arrivalRate) > 0
                    )?.arrivalRate || 0
                );
                const prevArrival = Number(prevWithArrival.arrivalRate);

                if (prevArrival > 0) {
                    arrivalIncrease = Math.round(
                        ((latestArrival - prevArrival) / prevArrival) * 100
                    );
                }
            }

            rootCause = {
                arrivalIncrease,
                processingTimeBefore:
                    baselineSnapshot.averageProcessingTime,
                processingTimeNow:
                    latestSnapshot.averageProcessingTime ||
                    bottleneckCounter.processingTime,
                staffChange:
                    currentStaff -
                    Number(baselineSnapshot.staffAvailable || 0)
            };
        }

        // --------------------------------------------------
        // 8. Build dynamic counter response
        // --------------------------------------------------
        const counterData = counters.map((counter) => ({
            id: counter._id,
            name: counter.name,
            stage: counter.stage,
            queue: counter.currentQueue,
            processingTime: counter.processingTime,
            staffCount: counter.staffCount,
            status: counter.status
        }));

        // --------------------------------------------------
        // 9. Dynamic prediction
        //
        // predictionAvailable: true  → real ML output exists for
        //                              the current bottleneck
        // predictionAvailable: false → no prediction has been run
        //                              for this counter yet; the
        //                              frontend must show an honest
        //                              "not yet generated" state
        // --------------------------------------------------
        const predictionData = latestPrediction
            ? {
                  available: true,
                  in30Minutes: latestPrediction.prediction30Min,
                  in60Minutes: latestPrediction.prediction60Min,
                  threshold: latestPrediction.threshold,
                  thresholdExceeded:
                      latestPrediction.thresholdExceeded,
                  confidence: latestPrediction.confidence,
                  predictedAt: latestPrediction.predictedAt
              }
            : {
                  available: false,
                  in30Minutes: null,
                  in60Minutes: null,
                  threshold: 60,
                  thresholdExceeded: false,
                  confidence: null,
                  predictedAt: null
              };

        // modelPerformance: only meaningful when a real prediction
        // exists for the bottleneck counter.
        const modelPerformanceData = {
            reliability: latestPrediction
                ? latestPrediction.confidence
                : null
        };

        // --------------------------------------------------
        // 10. Dynamic recommendation
        //
        // available: true  → a recommendation exists for the
        //                     current bottleneck counter
        // available: false → no recommendation has been created
        //                     for this counter yet; operators
        //                     should use POST /api/recommendations
        //                     to generate one
        //
        // bottleneckCounterId is always included so the frontend
        // can pre-populate the "Create recommendation" form.
        // --------------------------------------------------
        const recommendationData = latestRecommendation
            ? {
                  available: true,
                  id: latestRecommendation._id,
                  action: latestRecommendation.action,
                  reason: latestRecommendation.reason,
                  expectedImpact:
                      latestRecommendation.expectedImpact,
                  durationMinutes:
                      latestRecommendation.durationMinutes,
                  status: latestRecommendation.status,
                  approvedBy:
                      latestRecommendation.approvedBy,
                  approvedAt:
                      latestRecommendation.approvedAt,
                  bottleneckCounterId: bottleneckCounter._id
              }
            : {
                  available: false,
                  id: null,
                  action: null,
                  reason: null,
                  expectedImpact: null,
                  durationMinutes: 0,
                  status: "none",
                  approvedBy: null,
                  approvedAt: null,
                  bottleneckCounterId: bottleneckCounter._id
              };

        // --------------------------------------------------
        // 11. Dynamic monitoring
        // --------------------------------------------------
        const monitoringData = latestMonitoring
            ? {
                  id: latestMonitoring._id,
                  beforeQueue: latestMonitoring.beforeQueue,
                  afterQueue: latestMonitoring.afterQueue,
                  beforeWaitTime:
                      latestMonitoring.beforeWaitTime,
                  afterWaitTime:
                      latestMonitoring.afterWaitTime,
                  effectiveness:
                      latestMonitoring.effectiveness,
                  notes: latestMonitoring.notes,
                  checkedAt: latestMonitoring.checkedAt
              }
            : null;

        // --------------------------------------------------
        // 12. Final dashboard response
        // --------------------------------------------------
        res.json({
            success: true,

            serviceCenter: {
                id: serviceCenter._id,
                name: serviceCenter.name,
                location: serviceCenter.location,
                serviceType: serviceCenter.serviceType,
                totalStaff: serviceCenter.totalStaff,
                status: serviceCenter.active
                    ? "Active"
                    : "Inactive"
            },

            counters: counterData,

            prediction: predictionData,

            modelPerformance: modelPerformanceData,

            bottleneck: {
                counterId: bottleneckCounter._id,
                stage:
                    bottleneckCounter.stage ||
                    bottleneckCounter.name,
                reason: "Highest current queue"
            },

            rootCause: rootCause,

            recommendation: recommendationData,

            monitoring: monitoringData
        });
    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load dashboard",
            error: error.message
        });
    }
});

module.exports = router;