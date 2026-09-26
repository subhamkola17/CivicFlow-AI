const express = require("express");
const router = express.Router();

// POST /api/simulation
router.post("/", async (req, res) => {
    try {
        const {
            currentQueue = 0,
            processingTime = 1,
            staffCount = 1,
            arrivalRate = 0,
            sourceCounterName = "another counter",
            sourceStaffCount = 0,
            onlineReductionPercent = 25
        } = req.body;

        const queue = Number(currentQueue);
        const processTime = Number(processingTime);
        const staff = Number(staffCount);
        const arrivalsPerHour = Number(arrivalRate);
        const sourceStaff = Number(sourceStaffCount);
        const onlineReduction = Number(onlineReductionPercent);

        if (
            !Number.isFinite(queue) ||
            !Number.isFinite(processTime) ||
            !Number.isFinite(staff) ||
            !Number.isFinite(arrivalsPerHour) ||
            !Number.isFinite(sourceStaff) ||
            !Number.isFinite(onlineReduction) ||
            queue < 0 ||
            processTime <= 0 ||
            staff <= 0 ||
            arrivalsPerHour < 0 ||
            sourceStaff < 0 ||
            onlineReduction < 0 ||
            onlineReduction > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid simulation inputs. Queue and arrival rate must be >= 0, processing time and staff must be > 0, and online reduction must be between 0 and 100."
            });
        }

        // -------------------------------------------------
        // BASELINE
        // -------------------------------------------------

        const processingCapacityPerOfficer = 60 / processTime;

        const currentCapacityPerHour =
            staff * processingCapacityPerOfficer;

        const arrivalsNext60Min = arrivalsPerHour;

        const queueAfter60Min = Math.max(
            0,
            Math.round(
                queue +
                arrivalsNext60Min -
                currentCapacityPerHour
            )
        );

        const currentWaitTime = Math.round(
            (queue / currentCapacityPerHour) * 60
        );

        // -------------------------------------------------
        // SCENARIO 1 — ADD 1 OFFICER
        // -------------------------------------------------

        const addedStaff = staff + 1;

        const addedOfficerCapacity =
            addedStaff * processingCapacityPerOfficer;

        const queueAfterAddingOfficer = Math.max(
            0,
            Math.round(
                queue +
                arrivalsNext60Min -
                addedOfficerCapacity
            )
        );

        const waitAfterAddingOfficer = Math.round(
            (queue / addedOfficerCapacity) * 60
        );

        // -------------------------------------------------
        // SCENARIO 2 — MOVE 1 OFFICER
        // -------------------------------------------------

        const transferableOfficer = sourceStaff > 1 ? 1 : 0;
        const movedStaff = staff + transferableOfficer;

        const movedOfficerCapacity =
            movedStaff * processingCapacityPerOfficer;

        const queueAfterMovingOfficer = Math.max(
            0,
            Math.round(
                queue +
                arrivalsNext60Min -
                movedOfficerCapacity
            )
        );

        const waitAfterMovingOfficer = Math.round(
            (queue / movedOfficerCapacity) * 60
        );

        const moveAvailable = transferableOfficer === 1;

        // -------------------------------------------------
        // SCENARIO 3 — ROUTE SIMPLE CASES ONLINE
        // -------------------------------------------------

        const reducedArrivalRate =
            arrivalsPerHour * (1 - onlineReduction / 100);

        const reducedArrivalsNext60Min =
            reducedArrivalRate;

        const queueAfterOnlineRouting = Math.max(
            0,
            Math.round(
                queue +
                reducedArrivalsNext60Min -
                currentCapacityPerHour
            )
        );

        const waitAfterOnlineRouting = Math.round(
            (queue / currentCapacityPerHour) * 60
        );

        // -------------------------------------------------
        // DETERMINE LOWEST-PREDICTED-QUEUE SCENARIO
        // -------------------------------------------------

        const scenarioResults = [
            {
                scenario: "Add 1 officer",
                queueAfter60Min: queueAfterAddingOfficer,
                estimatedWaitTime: waitAfterAddingOfficer
            },
            {
                scenario: "Move 1 officer",
                queueAfter60Min: queueAfterMovingOfficer,
                estimatedWaitTime: waitAfterMovingOfficer
            },
            {
                scenario: "Route simple cases online",
                queueAfter60Min: queueAfterOnlineRouting,
                estimatedWaitTime: waitAfterOnlineRouting
            },
            {
                scenario: "Do nothing",
                queueAfter60Min: queueAfter60Min,
                estimatedWaitTime: currentWaitTime
            }
        ];

        const bestScenario = scenarioResults.reduce(
            (best, current) =>
                current.queueAfter60Min < best.queueAfter60Min
                    ? current
                    : best
        );

        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        const simulations = [
            {
                scenario: "Add 1 officer",
                action: "Temporarily add 1 qualified officer",
                estimatedProcessingTime: Number(
                    (processTime * (staff / addedStaff)).toFixed(1)
                ),
                estimatedWaitTime: waitAfterAddingOfficer,
                estimatedQueueAfter60Min: queueAfterAddingOfficer,
                impact:
                    queueAfterAddingOfficer < queueAfter60Min
                        ? "High"
                        : "Low",
                recommendation:
                    bestScenario.scenario === "Add 1 officer"
            },

            {
                scenario: "Move 1 officer",
                action: moveAvailable
                    ? `Move 1 available officer from ${sourceCounterName} to the bottleneck`
                    : `No transferable officer is currently available at ${sourceCounterName}`,

                estimatedProcessingTime: Number(
                    (processTime * (staff / movedStaff)).toFixed(1)
                ),

                estimatedWaitTime: waitAfterMovingOfficer,

                estimatedQueueAfter60Min:
                    queueAfterMovingOfficer,

                impact: moveAvailable
                    ? queueAfterMovingOfficer < queueAfter60Min
                        ? "High"
                        : "Medium"
                    : "Unavailable",

                recommendation:
                    moveAvailable &&
                    bestScenario.scenario === "Move 1 officer"
            },

            {
                scenario: "Route simple cases online",

                action:
                    `Route approximately ${onlineReduction}% of eligible simple cases online`,

                estimatedProcessingTime: processTime,

                estimatedWaitTime:
                    waitAfterOnlineRouting,

                estimatedQueueAfter60Min:
                    queueAfterOnlineRouting,

                impact:
                    queueAfterOnlineRouting < queueAfter60Min
                        ? "High"
                        : "Medium",

                recommendation:
                    bestScenario.scenario ===
                    "Route simple cases online"
            },

            {
                scenario: "Do nothing",

                action:
                    "Continue with current staffing and queue",

                estimatedProcessingTime:
                    processTime,

                estimatedWaitTime:
                    currentWaitTime,

                estimatedQueueAfter60Min:
                    queueAfter60Min,

                impact:
                    queueAfter60Min > queue
                        ? "Negative"
                        : "Neutral",

                recommendation: false
            }
        ];

        res.status(200).json({
            success: true,

            input: {
                currentQueue: queue,
                processingTime: processTime,
                staffCount: staff,
                arrivalRatePerHour: arrivalsPerHour,
                sourceCounterName,
                sourceStaffCount: sourceStaff,
                onlineReductionPercent: onlineReduction
            },

            calculations: {
                processingCapacityPerOfficerPerHour:
                    Number(
                        processingCapacityPerOfficer.toFixed(2)
                    ),

                currentCapacityPerHour:
                    Number(
                        currentCapacityPerHour.toFixed(2)
                    ),

                expectedArrivalsNext60Min:
                    Math.round(arrivalsNext60Min),

                currentEstimatedWaitTime:
                    currentWaitTime,

                predictedQueueIfNothingChanges:
                    queueAfter60Min
            },

            simulations,

            recommendedAction: {
                scenario:
                    bestScenario.scenario,

                predictedQueueAfter60Min:
                    bestScenario.queueAfter60Min,

                predictedWaitTime:
                    bestScenario.estimatedWaitTime,

                reason:
                    "This scenario produces the lowest predicted queue under the current conditions."
            }
        });

    } catch (error) {

        console.error(
            "Simulation error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Simulation failed",
            error: error.message
        });
    }
});

module.exports = router;