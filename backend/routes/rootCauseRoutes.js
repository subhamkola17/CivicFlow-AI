const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Counter = require("../models/Counter");
const QueueSnapshot = require("../models/QueueSnapshot");

// ============================================================
// ROOT CAUSE ANALYSIS
// ============================================================

router.post("/analyze", async (req, res) => {
    try {
        const { counter } = req.body;

        // ----------------------------------------------------
        // Validate counter ID
        // ----------------------------------------------------

        if (!counter) {
            return res.status(400).json({
                success: false,
                message: "Counter ID is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(counter)) {
            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }

        // ----------------------------------------------------
        // Get current counter
        // ----------------------------------------------------

        const selectedCounter = await Counter.findById(counter)
            .populate("serviceCenter", "name location");

        if (!selectedCounter) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }

        // ----------------------------------------------------
        // Get latest two real queue snapshots
        // ----------------------------------------------------

        const snapshots = await QueueSnapshot.find({
            counter: counter
        })
            .sort({ recordedAt: -1 })
            .limit(2);

        // ----------------------------------------------------
        // We need historical data to determine change
        // ----------------------------------------------------

        if (snapshots.length < 2) {
            return res.status(200).json({
                success: true,
                dataAvailable: false,

                message:
                    "Not enough historical queue snapshots available for root-cause analysis.",

                analysis: {
                    counter: {
                        id: selectedCounter._id,
                        name: selectedCounter.name,
                        stage: selectedCounter.stage,
                        currentQueue: selectedCounter.currentQueue,
                        processingTime: selectedCounter.processingTime,
                        staffCount: selectedCounter.staffCount,
                        status: selectedCounter.status
                    },

                    mainCause: "Insufficient historical data",

                    causes: [],

                    explanation:
                        "CivicFlow AI needs at least two queue snapshots to compare operational changes without using fabricated data.",

                    requiredHistoricalSnapshots: 2,

                    availableHistoricalSnapshots: snapshots.length
                }
            });
        }

        // ----------------------------------------------------
        // Latest snapshot = current operational state
        // Older snapshot = previous operational state
        // ----------------------------------------------------

        const currentSnapshot = snapshots[0];
        const previousSnapshot = snapshots[1];

        // ----------------------------------------------------
        // Extract real values
        // ----------------------------------------------------

        const currentQueue = Number(currentSnapshot.queueLength) || 0;
        const previousQueue = Number(previousSnapshot.queueLength) || 0;

        const currentArrivalRate = Number(currentSnapshot.arrivalRate) || 0;
        const previousArrivalRate = Number(previousSnapshot.arrivalRate) || 0;

        const currentProcessingTime =
            Number(currentSnapshot.averageProcessingTime) || 0;

        const previousProcessingTime =
            Number(previousSnapshot.averageProcessingTime) || 0;

        const currentStaff = Number(currentSnapshot.staffAvailable) || 0;
        const previousStaff = Number(previousSnapshot.staffAvailable) || 0;

        const currentWaitingTime =
            Number(currentSnapshot.waitingTime) || 0;

        const previousWaitingTime =
            Number(previousSnapshot.waitingTime) || 0;

        // ----------------------------------------------------
        // Calculate real operational changes
        // ----------------------------------------------------

        const arrivalChangePercent =
            previousArrivalRate > 0
                ? ((currentArrivalRate - previousArrivalRate) /
                      previousArrivalRate) *
                  100
                : 0;

        const processingChangePercent =
            previousProcessingTime > 0
                ? ((currentProcessingTime - previousProcessingTime) /
                      previousProcessingTime) *
                  100
                : 0;

        const queueChangePercent =
            previousQueue > 0
                ? ((currentQueue - previousQueue) /
                      previousQueue) *
                  100
                : 0;

        const waitingTimeChangePercent =
            previousWaitingTime > 0
                ? ((currentWaitingTime - previousWaitingTime) /
                      previousWaitingTime) *
                  100
                : 0;

        const staffChange = currentStaff - previousStaff;

        // ----------------------------------------------------
        // Build evidence-based causes
        // ----------------------------------------------------

        const causes = [];

        // Increased arrivals
        if (arrivalChangePercent >= 20) {
            causes.push({
                cause: "Increased citizen arrivals",
                impact: "High",

                evidence:
                    `Arrival rate increased from ${previousArrivalRate} ` +
                    `to ${currentArrivalRate} citizens per recorded interval ` +
                    `(${arrivalChangePercent.toFixed(1)}% increase).`
            });
        } else if (arrivalChangePercent > 5) {
            causes.push({
                cause: "Increased citizen arrivals",
                impact: "Medium",

                evidence:
                    `Arrival rate increased from ${previousArrivalRate} ` +
                    `to ${currentArrivalRate} ` +
                    `(${arrivalChangePercent.toFixed(1)}% increase).`
            });
        }

        // Slower processing
        if (processingChangePercent >= 20) {
            causes.push({
                cause: "Slower processing",
                impact: "High",

                evidence:
                    `Average processing time increased from ` +
                    `${previousProcessingTime} to ${currentProcessingTime} minutes ` +
                    `(${processingChangePercent.toFixed(1)}% increase).`
            });
        } else if (processingChangePercent > 5) {
            causes.push({
                cause: "Slower processing",
                impact: "Medium",

                evidence:
                    `Average processing time increased from ` +
                    `${previousProcessingTime} to ${currentProcessingTime} minutes ` +
                    `(${processingChangePercent.toFixed(1)}% increase).`
            });
        }

        // Staff reduction
        if (staffChange < 0) {
            causes.push({
                cause: "Reduced staff availability",
                impact: staffChange <= -2 ? "High" : "Medium",

                evidence:
                    `Available staff decreased from ${previousStaff} ` +
                    `to ${currentStaff}.`
            });
        }

        // Queue accumulation
        if (queueChangePercent >= 20) {
            causes.push({
                cause: "Queue accumulation",
                impact: "High",

                evidence:
                    `Queue increased from ${previousQueue} ` +
                    `to ${currentQueue} citizens ` +
                    `(${queueChangePercent.toFixed(1)}% increase).`
            });
        } else if (queueChangePercent > 5) {
            causes.push({
                cause: "Queue accumulation",
                impact: "Medium",

                evidence:
                    `Queue increased from ${previousQueue} ` +
                    `to ${currentQueue} citizens ` +
                    `(${queueChangePercent.toFixed(1)}% increase).`
            });
        }

        // Waiting time increase
        if (waitingTimeChangePercent >= 20) {
            causes.push({
                cause: "Increasing citizen waiting time",
                impact: "High",

                evidence:
                    `Average waiting time increased from ` +
                    `${previousWaitingTime} to ${currentWaitingTime} minutes ` +
                    `(${waitingTimeChangePercent.toFixed(1)}% increase).`
            });
        }

        // ----------------------------------------------------
        // Determine evidence-based main cause
        // ----------------------------------------------------

        let mainCause = "No significant operational change detected.";

        if (
            arrivalChangePercent >= 20 &&
            staffChange < 0
        ) {
            mainCause =
                "Increased arrivals combined with reduced staff availability";
        } else if (
            processingChangePercent >= 20 &&
            arrivalChangePercent >= 20
        ) {
            mainCause =
                "Increased arrivals combined with slower processing";
        } else if (staffChange < 0) {
            mainCause =
                "Reduced staff availability";
        } else if (processingChangePercent >= 20) {
            mainCause =
                "Increased processing time";
        } else if (arrivalChangePercent >= 20) {
            mainCause =
                "Increased citizen arrivals";
        } else if (queueChangePercent >= 20) {
            mainCause =
                "Rapid queue accumulation";
        } else if (waitingTimeChangePercent >= 20) {
            mainCause =
                "Increasing citizen waiting time";
        }

        // ----------------------------------------------------
        // Generate explanation
        // ----------------------------------------------------

        let explanation;

        if (causes.length === 0) {
            explanation =
                `No major operational change was detected between the ` +
                `latest two recorded snapshots for ${selectedCounter.name}.`;
        } else {
            explanation =
                `${mainCause} is contributing to the current ` +
                `${selectedCounter.status} condition at ` +
                `${selectedCounter.name}.`;
        }

        // ----------------------------------------------------
        // Return complete analysis
        // ----------------------------------------------------

        res.status(200).json({
            success: true,

            dataAvailable: true,

            analysis: {
                counter: {
                    id: selectedCounter._id,
                    name: selectedCounter.name,
                    stage: selectedCounter.stage,
                    currentQueue: currentQueue,
                    processingTime: currentProcessingTime,
                    staffCount: currentStaff,
                    waitingTime: currentWaitingTime,
                    status: selectedCounter.status
                },

                mainCause,

                factors: {
                    arrivalRate: {
                        previous: previousArrivalRate,
                        current: currentArrivalRate,
                        changePercent: Number(
                            arrivalChangePercent.toFixed(2)
                        )
                    },

                    processingTime: {
                        previous: previousProcessingTime,
                        current: currentProcessingTime,
                        changePercent: Number(
                            processingChangePercent.toFixed(2)
                        )
                    },

                    queue: {
                        previous: previousQueue,
                        current: currentQueue,
                        changePercent: Number(
                            queueChangePercent.toFixed(2)
                        )
                    },

                    staff: {
                        previous: previousStaff,
                        current: currentStaff,
                        change: staffChange
                    },

                    waitingTime: {
                        previous: previousWaitingTime,
                        current: currentWaitingTime,
                        changePercent: Number(
                            waitingTimeChangePercent.toFixed(2)
                        )
                    }
                },

                causes,

                historicalSnapshots: {
                    current: currentSnapshot.recordedAt,
                    previous: previousSnapshot.recordedAt
                },

                explanation
            }
        });

    } catch (error) {
        console.error(
            "Root cause analysis error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to analyze root cause",
            error: error.message
        });
    }
});

module.exports = router;