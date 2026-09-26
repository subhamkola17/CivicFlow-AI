const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const Monitoring = require("../models/Monitoring");
const Intervention = require("../models/Intervention");
const Counter = require("../models/Counter");
const QueueSnapshot = require("../models/QueueSnapshot");

// ---------------------------------------------------------
// HELPER — Calculate current waiting time
// ---------------------------------------------------------

function calculateWaitTime(queue, processingTime, staffCount) {
    if (staffCount <= 0) {
        return 0;
    }

    return Math.round(
        (queue * processingTime) / staffCount
    );
}

// ---------------------------------------------------------
// GET ALL MONITORING RECORDS
// ---------------------------------------------------------

router.get("/", async (req, res) => {
    try {
        const monitoring = await Monitoring.find()
            .populate("intervention")
            .populate("counter")
            .sort({ checkedAt: -1 });

        res.status(200).json({
            success: true,
            count: monitoring.length,
            monitoring
        });

    } catch (error) {
        console.error("Fetch monitoring error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch monitoring records",
            error: error.message
        });
    }
});

// ---------------------------------------------------------
// CREATE MONITORING CHECK
//
// Preferred request:
//
// POST /api/monitoring/check
//
// {
//   "intervention": "<interventionId>",
//   "counter": "<counterId>"
// }
//
// The backend automatically gets:
//
// beforeQueue
// beforeWaitTime
// afterQueue
// afterWaitTime
//
// from the database.
// ---------------------------------------------------------

router.post("/check", async (req, res) => {
    try {

        const {
            intervention: interventionId,
            counter: counterId,
            notes
        } = req.body;

        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (!interventionId || !counterId) {
            return res.status(400).json({
                success: false,
                message:
                    "intervention and counter are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(interventionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid intervention ID"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(counterId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }

        // -------------------------------------------------
        // LOAD INTERVENTION
        // -------------------------------------------------

        const intervention =
            await Intervention.findById(interventionId);

        if (!intervention) {
            return res.status(404).json({
                success: false,
                message: "Intervention not found"
            });
        }

        if (intervention.status !== "approved") {
            return res.status(400).json({
                success: false,
                message:
                    "Monitoring can only be performed for an approved intervention"
            });
        }

        // -------------------------------------------------
        // LOAD CURRENT COUNTER
        // -------------------------------------------------

        const counter =
            await Counter.findById(counterId);

        if (!counter) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }

        // Make sure the monitoring counter is actually
        // the counter affected by the intervention.
        if (
            intervention.counter &&
            intervention.counter.toString() !==
            counter._id.toString()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Counter does not match the approved intervention"
            });
        }

        // -------------------------------------------------
        // FIND APPROVAL BASELINE
        //
        // The approval route creates a QueueSnapshot
        // immediately after applying the intervention.
        //
        // We find the first snapshot recorded after
        // intervention.approvedAt.
        // -------------------------------------------------

        const baselineSnapshot =
            await QueueSnapshot.findOne({
                counter: counter._id,
                recordedAt: {
                    $gte: intervention.approvedAt
                }
            }).sort({
                recordedAt: 1
            });

        if (!baselineSnapshot) {
            return res.status(404).json({
                success: false,
                message:
                    "Monitoring baseline not found. Approve the intervention first so a baseline snapshot can be created."
            });
        }

        // -------------------------------------------------
        // REAL BEFORE VALUES
        // -------------------------------------------------

        const beforeQueue =
            Number(baselineSnapshot.queueLength);

        const beforeWaitTime =
            Number(baselineSnapshot.waitingTime);

        // -------------------------------------------------
        // REAL CURRENT / AFTER VALUES
        // -------------------------------------------------

        const afterQueue =
            Number(counter.currentQueue);

        const afterWaitTime =
            calculateWaitTime(
                afterQueue,
                Number(counter.processingTime),
                Number(counter.staffCount)
            );

        // -------------------------------------------------
        // CALCULATE EFFECTIVENESS
        // -------------------------------------------------

        let effectiveness = "neutral";

        const queueImproved =
            afterQueue < beforeQueue;

        const waitImproved =
            afterWaitTime < beforeWaitTime;

        if (queueImproved && waitImproved) {

            effectiveness = "positive";

        } else if (
            !queueImproved &&
            !waitImproved
        ) {

            effectiveness = "negative";

        } else {

            effectiveness = "insufficient";
        }

        // -------------------------------------------------
        // CREATE MONITORING RECORD
        // -------------------------------------------------

        const monitoring =
            await Monitoring.create({

                intervention: intervention._id,

                counter: counter._id,

                beforeQueue,

                afterQueue,

                beforeWaitTime,

                afterWaitTime,

                effectiveness,

                notes:
                    notes ||
                    `Monitoring evaluated using the approval baseline and current live queue state for ${counter.name}.`
            });

        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        res.status(201).json({

            success: true,

            message:
                "Monitoring check completed using live counter data",

            monitoring,

            comparison: {

                before: {
                    queue: beforeQueue,
                    waitTime: beforeWaitTime
                },

                after: {
                    queue: afterQueue,
                    waitTime: afterWaitTime
                },

                queueChange:
                    afterQueue - beforeQueue,

                waitTimeChange:
                    afterWaitTime - beforeWaitTime,

                effectiveness
            }

        });

    } catch (error) {

        console.error(
            "Monitoring check error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to create monitoring check",
            error: error.message
        });
    }
});

// ---------------------------------------------------------
// GET MONITORING RECORD BY ID
// ---------------------------------------------------------

router.get("/:id", async (req, res) => {

    try {

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid monitoring ID"
            });
        }

        const monitoring =
            await Monitoring.findById(
                req.params.id
            )
                .populate("intervention")
                .populate("counter");

        if (!monitoring) {

            return res.status(404).json({
                success: false,
                message:
                    "Monitoring record not found"
            });
        }

        res.status(200).json({
            success: true,
            monitoring
        });

    } catch (error) {

        console.error(
            "Fetch monitoring record error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to fetch monitoring record",
            error: error.message
        });
    }
});

module.exports = router;