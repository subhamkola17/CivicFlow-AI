const express = require("express");
const router = express.Router();

const Counter = require("../models/Counter");

// GET current bottleneck
router.get("/", async (req, res) => {
    try {
        // Get all counters with real MongoDB data
        const counters = await Counter.find()
            .populate("serviceCenter", "name location");

        if (counters.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No counters found"
            });
        }

        /*
         * Calculate real processing throughput for every counter.
         *
         * processingTime = average minutes required for one citizen
         * staffCount      = number of active staff
         *
         * Higher staff + lower processing time = higher throughput.
         *
         * Formula:
         * throughput = staffCount / processingTime
         */
        const analyzedCounters = counters.map((counter) => {
            const processingTime = Number(counter.processingTime) || 1;
            const staffCount = Number(counter.staffCount) || 1;
            const currentQueue = Number(counter.currentQueue) || 0;

            const throughput = staffCount / processingTime;

            return {
                counter,
                throughput,
                processingTime,
                staffCount,
                currentQueue
            };
        });

        // Lowest throughput = bottleneck
        const bottleneckData = analyzedCounters.reduce(
            (worst, current) => {
                return current.throughput < worst.throughput
                    ? current
                    : worst;
            }
        );

        const bottleneck = bottleneckData.counter;

        // Determine severity from the actual queue
        let severity = "normal";

        if (bottleneckData.currentQueue >= 40) {
            severity = "critical";
        } else if (bottleneckData.currentQueue >= 20) {
            severity = "warning";
        }

        res.status(200).json({
            success: true,

            bottleneck: {
                counterId: bottleneck._id,

                serviceCenter: bottleneck.serviceCenter,

                name: bottleneck.name,

                stage: bottleneck.stage,

                currentQueue: bottleneckData.currentQueue,

                processingTime: bottleneckData.processingTime,

                staffCount: bottleneckData.staffCount,

                throughput: Number(
                    bottleneckData.throughput.toFixed(3)
                ),

                status: severity,

                reason: "Lowest processing throughput",

                explanation:
                    `${bottleneck.name} has the lowest processing throughput ` +
                    `among the active service counters based on current ` +
                    `processing time and available staff.`
            }
        });

    } catch (error) {
        console.error("Bottleneck detection error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to detect bottleneck",
            error: error.message
        });
    }
});

module.exports = router;