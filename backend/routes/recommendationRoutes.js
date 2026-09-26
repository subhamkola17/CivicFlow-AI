const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Intervention = require("../models/Intervention");
const Counter = require("../models/Counter");
const QueueSnapshot = require("../models/QueueSnapshot");


// =====================================================
// QUEUE STATUS HELPER
// (mirrors the identical logic in queueRoutes.js)
// =====================================================

function getQueueStatus(queueLength) {
    const queue = Number(queueLength || 0);

    if (queue >= 40) {
        return "critical";
    }

    if (queue >= 20) {
        return "busy";
    }

    return "normal";
}


// =====================================================
// GET ALL RECOMMENDATIONS
// =====================================================

router.get("/", async (req, res) => {
    try {
        const recommendations = await Intervention.find()
            .populate("serviceCenter")
            .populate("counter")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: recommendations.length,
            recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch recommendations",
            error: error.message
        });
    }
});


// =====================================================
// CREATE RECOMMENDATION
// =====================================================
//
// Body fields:
//   serviceCenter   (ObjectId, required)
//   counter         (ObjectId, required)
//   action          (String,   required)
//   reason          (String)
//   expectedImpact  (String)
//   expectedDuration (Number)
//   actionType      ("add_staff" | "reduce_arrivals" | null)
//
// actionType is optional. Omitting it stores null and the
// approval handler will treat this as a flag-flip only
// (backward compatible with all existing documents).
//
// =====================================================

router.post("/", async (req, res) => {
    try {
        const {
            serviceCenter,
            counter,
            action,
            reason,
            priority,
            expectedImpact,
            expectedDuration,
            actionType = null
        } = req.body;


        // -------------------------------------------------
        // Validate actionType if provided
        // -------------------------------------------------

        const validActionTypes = ["add_staff", "reduce_arrivals", null];

        if (!validActionTypes.includes(actionType)) {
            return res.status(400).json({
                success: false,
                message: "actionType must be \"add_staff\", \"reduce_arrivals\", or null"
            });
        }


        const recommendation = await Intervention.create({
            serviceCenter,
            counter,
            action,
            reason,
            priority,
            expectedImpact,
            expectedDuration,
            actionType,
            status: "pending"
        });

        res.status(201).json({
            success: true,
            message: "Recommendation created successfully",
            recommendation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to create recommendation",
            error: error.message
        });
    }
});


// =====================================================
// APPROVE RECOMMENDATION
// =====================================================
//
// POST /api/recommendations/:id/approve
// Body: { "approvedBy": "<userId>" }
//
// State transitions allowed:
//   pending → approved   (normal path)
//
// Transitions blocked:
//   approved → approved  (already approved — returns 409)
//   rejected → approved  (cannot approve a rejection — returns 409)
//
// For actionType === "add_staff":
//   1. Counter.staffCount is atomically incremented by 1.
//   2. Counter.status is recalculated from the existing
//      queue-status thresholds.
//   3. currentQueue is NOT modified.
//   4. A QueueSnapshot is created to record the counter's
//      live operational state at the moment of approval.
//      This snapshot is the real baseline for any future
//      monitoring comparison. It is NOT a Monitoring record
//      — Monitoring must only be created when a genuine
//      before/after comparison is available.
//
// For actionType === "reduce_arrivals" or null:
//   The Intervention status is updated and approvedBy/At
//   are set. No counter mutation occurs.
//
// =====================================================

router.post("/:id/approve", async (req, res) => {
    try {

        const { approvedBy } = req.body;


        // -------------------------------------------------
        // Validate intervention ID
        // -------------------------------------------------

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid intervention ID"
            });
        }


        // -------------------------------------------------
        // Require approvedBy
        // -------------------------------------------------

        if (!approvedBy) {
            return res.status(400).json({
                success: false,
                message: "approvedBy is required"
            });
        }


        // -------------------------------------------------
        // Load the intervention before changing it so we
        // can read its current status and actionType.
        // -------------------------------------------------

        const existing = await Intervention.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Recommendation not found"
            });
        }


        // -------------------------------------------------
        // Guard: prevent double-approval and rejected→approved
        // -------------------------------------------------

        if (existing.status === "approved") {
            return res.status(409).json({
                success: false,
                message: "Recommendation has already been approved"
            });
        }

        if (existing.status === "rejected") {
            return res.status(409).json({
                success: false,
                message: "A rejected recommendation cannot be approved"
            });
        }


        // -------------------------------------------------
        // Mark the intervention as approved
        // -------------------------------------------------

        const recommendation = await Intervention.findByIdAndUpdate(
            req.params.id,
            {
                status: "approved",
                approvedBy,
                approvedAt: new Date()
            },
            {
                returnDocument: "after"
            }
        );


        // -------------------------------------------------
        // Apply operational effect for "add_staff"
        // -------------------------------------------------

        let updatedCounter = null;
        let baseline = null;

        if (existing.actionType === "add_staff" && existing.counter) {

            // Validate the counter ObjectId stored on the intervention
            if (!mongoose.Types.ObjectId.isValid(existing.counter)) {
                return res.status(400).json({
                    success: false,
                    message: "Intervention references an invalid counter ID"
                });
            }


            // Atomically increment staffCount by 1.
            // The filter {_id} is a plain equality match — if the
            // counter does not exist, findOneAndUpdate returns null.
            updatedCounter = await Counter.findOneAndUpdate(
                { _id: existing.counter },
                { $inc: { staffCount: 1 } },
                { returnDocument: "after", runValidators: false }
            );

            if (!updatedCounter) {
                return res.status(404).json({
                    success: false,
                    message: "Counter linked to this recommendation was not found"
                });
            }


            // Recalculate status from the new staffCount+currentQueue
            const newStatus = getQueueStatus(updatedCounter.currentQueue);

            if (updatedCounter.status !== newStatus) {
                updatedCounter.status = newStatus;
                await updatedCounter.save();
            }


            // Capture the real live state as a baseline snapshot.
            // This records what the counter looked like at the moment
            // the intervention was approved (after staffCount +1).
            // A Monitoring record must NOT be created here — there is
            // no "after" yet. The snapshot is available for a future
            // monitoring check to use as its beforeQueue reference.
            const staffForWait = Number(updatedCounter.staffCount) || 1;
            const queueForWait = Number(updatedCounter.currentQueue) || 0;
            const procTime     = Number(updatedCounter.processingTime) || 0;

            const baselineWaitTime =
                staffForWait > 0
                    ? Math.round((queueForWait * procTime) / staffForWait)
                    : 0;

            baseline = await QueueSnapshot.create({
                counter:                updatedCounter._id,
                queueLength:            queueForWait,
                arrivalRate:            0,
                averageProcessingTime:  procTime,
                waitingTime:            baselineWaitTime,
                staffAvailable:         staffForWait
            });
        }


        // -------------------------------------------------
        // Response
        // -------------------------------------------------

        res.status(200).json({
            success: true,
            message: "Recommendation approved successfully",
            recommendation,
            ...(updatedCounter && { updatedCounter }),
            ...(baseline       && { baseline })
        });

    } catch (error) {

        console.error("Approve recommendation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to approve recommendation",
            error: error.message
        });
    }
});


// =====================================================
// REJECT RECOMMENDATION
// =====================================================

router.post("/:id/reject", async (req, res) => {
    try {

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid intervention ID"
            });
        }

        const recommendation = await Intervention.findByIdAndUpdate(
            req.params.id,
            {
                status: "rejected"
            },
            {
                returnDocument: "after"
            }
        );

        if (!recommendation) {
            return res.status(404).json({
                success: false,
                message: "Recommendation not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Recommendation rejected successfully",
            recommendation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to reject recommendation",
            error: error.message
        });
    }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;
