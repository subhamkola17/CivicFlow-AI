const express = require("express");
const mongoose = require("mongoose");

const Counter = require("../models/Counter");
const QueueSnapshot = require("../models/QueueSnapshot");
const Intervention = require("../models/Intervention");
const Monitoring = require("../models/Monitoring");

const router = express.Router();


// =====================================================
// GET ALL COUNTERS / QUEUES
// =====================================================

router.get("/", async (req, res) => {
    try {
        const counters = await Counter.find({ active: { $ne: false } })
            .populate("serviceCenter", "name location")
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            count: counters.length,
            counters
        });

    } catch (error) {
        console.error("Queue fetch error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch queues",
            error: error.message
        });
    }
});


// =====================================================
// CREATE NEW QUEUE / COUNTER
// =====================================================
//
// POST /api/queues
//
// Example:
//
// {
//   "serviceCenter": "SERVICE_CENTER_ID",
//   "name": "Biometric Verification",
//   "stage": "Biometric Verification",
//   "currentQueue": 15,
//   "processingTime": 8,
//   "staffCount": 2
// }
//
// =====================================================

router.post("/", async (req, res) => {
    try {

        const {
            serviceCenter,
            name,
            stage,
            currentQueue = 0,
            processingTime = 0,
            staffCount = 0
        } = req.body;


        if (!serviceCenter) {
            return res.status(400).json({
                success: false,
                message: "Service center ID is required"
            });
        }


        if (!mongoose.Types.ObjectId.isValid(serviceCenter)) {
            return res.status(400).json({
                success: false,
                message: "Invalid service center ID"
            });
        }


        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Queue name is required"
            });
        }


        if (!stage || !stage.trim()) {
            return res.status(400).json({
                success: false,
                message: "Queue stage is required"
            });
        }


        // -------------------------------------------------
        // Prevent duplicate counter name in the same centre
        // -------------------------------------------------

        const duplicate = await Counter.findOne({
            serviceCenter,
            name: name.trim()
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: `A counter named "${name.trim()}" already exists in this service centre`
            });
        }


        if (Number(currentQueue) < 0) {
            return res.status(400).json({
                success: false,
                message: "Current queue cannot be negative"
            });
        }


        if (Number(processingTime) < 0) {
            return res.status(400).json({
                success: false,
                message: "Processing time cannot be negative"
            });
        }


        if (Number(staffCount) < 0) {
            return res.status(400).json({
                success: false,
                message: "Staff count cannot be negative"
            });
        }


        const counter = await Counter.create({
            serviceCenter,
            name: name.trim(),
            stage: stage.trim(),
            currentQueue: Number(currentQueue),
            processingTime: Number(processingTime),
            staffCount: Number(staffCount),
            status: getQueueStatus(Number(currentQueue))
        });


        res.status(201).json({
            success: true,
            message: "Queue created successfully",
            counter
        });

    } catch (error) {

        console.error("Queue creation error:", error);

        res.status(400).json({
            success: false,
            message: "Failed to create queue",
            error: error.message
        });
    }
});


// =====================================================
// LIVE QUEUE UPDATE
// =====================================================
//
// POST
// /api/queues/live-update/:counterId
//
// This is the important new endpoint.
//
// It:
// 1. Updates current queue
// 2. Updates operational information
// 3. Creates a historical snapshot
// 4. Returns the new live state
//
// Example:
//
// {
//   "queueLength": 47,
//   "arrivalRate": 5.2,
//   "averageProcessingTime": 11,
//   "waitingTime": 35,
//   "staffAvailable": 2
// }
//
// =====================================================

router.post("/live-update/:counterId", async (req, res) => {

    try {

        const { counterId } = req.params;

        const {
            queueLength,
            arrivalRate,
            averageProcessingTime,
            waitingTime,
            staffAvailable
        } = req.body;


        // -------------------------------------------------
        // Validate counter ID
        // -------------------------------------------------

        if (!mongoose.Types.ObjectId.isValid(counterId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }


        // -------------------------------------------------
        // Find counter
        // -------------------------------------------------

        const counter = await Counter.findById(counterId);

        if (!counter) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }


        // -------------------------------------------------
        // Queue is required
        // -------------------------------------------------

        if (
            queueLength === undefined ||
            queueLength === null ||
            Number(queueLength) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "queueLength must be a non-negative number"
            });
        }


        // -------------------------------------------------
        // Validate optional values
        // -------------------------------------------------

        if (
            arrivalRate !== undefined &&
            arrivalRate !== null &&
            Number(arrivalRate) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "arrivalRate cannot be negative"
            });
        }


        if (
            averageProcessingTime !== undefined &&
            averageProcessingTime !== null &&
            Number(averageProcessingTime) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "averageProcessingTime cannot be negative"
            });
        }


        if (
            waitingTime !== undefined &&
            waitingTime !== null &&
            Number(waitingTime) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "waitingTime cannot be negative"
            });
        }


        if (
            staffAvailable !== undefined &&
            staffAvailable !== null &&
            Number(staffAvailable) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "staffAvailable cannot be negative"
            });
        }


        // -------------------------------------------------
        // Convert values
        // -------------------------------------------------

        const newQueue = Number(queueLength);

        const newArrivalRate =
            arrivalRate !== undefined && arrivalRate !== null
                ? Number(arrivalRate)
                : 0;

        const newProcessingTime =
            averageProcessingTime !== undefined &&
            averageProcessingTime !== null
                ? Number(averageProcessingTime)
                : Number(counter.processingTime || 0);

        const newWaitingTime =
            waitingTime !== undefined && waitingTime !== null
                ? Number(waitingTime)
                : 0;

        const newStaff =
            staffAvailable !== undefined &&
            staffAvailable !== null
                ? Number(staffAvailable)
                : Number(counter.staffCount || 0);


        // -------------------------------------------------
        // Update Counter's LIVE state
        // -------------------------------------------------

        counter.currentQueue = newQueue;

        counter.processingTime = newProcessingTime;

        counter.staffCount = newStaff;

        counter.status = getQueueStatus(newQueue);

        await counter.save();


        // -------------------------------------------------
        // Save historical snapshot
        // -------------------------------------------------

        const snapshot = await QueueSnapshot.create({
            counter: counter._id,

            queueLength: newQueue,

            arrivalRate: newArrivalRate,

            averageProcessingTime: newProcessingTime,

            waitingTime: newWaitingTime,

            staffAvailable: newStaff
        });


        // -------------------------------------------------
        // Return live state
        // -------------------------------------------------

        res.status(200).json({

            success: true,

            message: "Live queue updated successfully",

            liveUpdate: {
                queue: counter.currentQueue,
                processingTime: counter.processingTime,
                staffCount: counter.staffCount,
                status: counter.status
            },

            snapshot

        });

    } catch (error) {

        console.error("Live queue update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update live queue",
            error: error.message
        });
    }
});


// =====================================================
// RECORD QUEUE SNAPSHOT
// =====================================================
//
// POST /api/queues/snapshot
//
// Kept for compatibility with the existing system.
//
// IMPORTANT:
// This version ALSO updates Counter.currentQueue.
// Therefore the dashboard and history stay synchronized.
//
// =====================================================

router.post("/snapshot", async (req, res) => {

    try {

        const {
            counter,
            queueLength,
            arrivalRate,
            averageProcessingTime,
            waitingTime,
            staffAvailable
        } = req.body;


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


        const counterExists = await Counter.findById(counter)
            .populate("serviceCenter", "name location");


        if (!counterExists) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }


        if (
            queueLength === undefined ||
            queueLength === null ||
            Number(queueLength) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "queueLength must be a non-negative number"
            });
        }


        const newQueue = Number(queueLength);

        const newArrivalRate =
            arrivalRate !== undefined &&
            arrivalRate !== null
                ? Number(arrivalRate)
                : 0;

        const newProcessingTime =
            averageProcessingTime !== undefined &&
            averageProcessingTime !== null
                ? Number(averageProcessingTime)
                : Number(counterExists.processingTime || 0);

        const newWaitingTime =
            waitingTime !== undefined &&
            waitingTime !== null
                ? Number(waitingTime)
                : 0;

        const newStaff =
            staffAvailable !== undefined &&
            staffAvailable !== null
                ? Number(staffAvailable)
                : Number(counterExists.staffCount || 0);


        // -------------------------------------------------
        // UPDATE CURRENT LIVE QUEUE
        // -------------------------------------------------

        counterExists.currentQueue = newQueue;

        counterExists.processingTime = newProcessingTime;

        counterExists.staffCount = newStaff;

        counterExists.status = getQueueStatus(newQueue);

        await counterExists.save();


        // -------------------------------------------------
        // CREATE HISTORY
        // -------------------------------------------------

        const snapshot = await QueueSnapshot.create({

            counter: counterExists._id,

            queueLength: newQueue,

            arrivalRate: newArrivalRate,

            averageProcessingTime: newProcessingTime,

            waitingTime: newWaitingTime,

            staffAvailable: newStaff

        });


        res.status(201).json({

            success: true,

            message: "Queue updated and snapshot recorded successfully",

            liveQueue: {
                queue: counterExists.currentQueue,
                processingTime: counterExists.processingTime,
                staffCount: counterExists.staffCount,
                status: counterExists.status
            },

            snapshot

        });

    } catch (error) {

        console.error("Queue snapshot error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update queue",
            error: error.message
        });
    }
});


// =====================================================
// GET ARCHIVED COUNTERS
// =====================================================
//
// GET /api/queues/archived
//
// Returns only counters where active === false.
// Historical data (snapshots, predictions, etc.) is
// untouched. This route MUST appear before any
// /:counterId param routes so Express matches it first.
//
// =====================================================

router.get("/archived", async (req, res) => {
    try {
        const counters = await Counter.find({ active: false })
            .populate("serviceCenter", "name location")
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            count: counters.length,
            counters
        });

    } catch (error) {
        console.error("Archived queue fetch error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch archived queues",
            error: error.message
        });
    }
});


// =====================================================
// GET HISTORICAL SNAPSHOTS
// =====================================================
//
// GET
// /api/queues/snapshots/:counterId
//
// =====================================================

router.get("/snapshots/:counterId", async (req, res) => {

    try {

        const { counterId } = req.params;


        if (!mongoose.Types.ObjectId.isValid(counterId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }


        const counter = await Counter.findById(counterId)
            .populate("serviceCenter", "name location");


        if (!counter) {

            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }


        const snapshots = await QueueSnapshot.find({
            counter: counterId
        })
            .sort({ recordedAt: -1 })
            .limit(100);


        res.json({

            success: true,

            counter: {
                id: counter._id,
                name: counter.name,
                stage: counter.stage,
                currentQueue: counter.currentQueue,
                processingTime: counter.processingTime,
                staffCount: counter.staffCount,
                status: counter.status,
                serviceCenter: counter.serviceCenter
            },

            count: snapshots.length,

            snapshots

        });

    } catch (error) {

        console.error(
            "Historical snapshot fetch error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch historical queue snapshots",
            error: error.message
        });
    }
});


// =====================================================
// UPDATE COUNTER / QUEUE INFORMATION
// =====================================================

router.put("/:id", async (req, res) => {

    try {

        const {
            name,
            stage,
            currentQueue,
            processingTime,
            staffCount,
            status
        } = req.body;


        const updateData = {};


        if (name !== undefined) {
            updateData.name = name;
        }

        if (stage !== undefined) {
            updateData.stage = stage;
        }

        if (currentQueue !== undefined) {
            updateData.currentQueue = Number(currentQueue);
            updateData.status = getQueueStatus(Number(currentQueue));
        }

        if (processingTime !== undefined) {
            updateData.processingTime = Number(processingTime);
        }

        if (staffCount !== undefined) {
            updateData.staffCount = Number(staffCount);
        }

        if (status !== undefined && currentQueue === undefined) {
            updateData.status = status;
        }


        const counter = await Counter.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                returnDocument: "after",
                runValidators: true
            }
        );


        if (!counter) {

            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }


        res.json({

            success: true,

            message: "Queue updated successfully",

            counter

        });

    } catch (error) {

        console.error("Queue update error:", error);

        res.status(400).json({
            success: false,
            message: "Failed to update queue",
            error: error.message
        });
    }
});


// =====================================================
// PATCH COUNTER STATUS — archive / restore
// =====================================================
//
// PATCH /api/queues/:counterId/status
//
// Body: { "active": false }  →  archive
//       { "active": true  }  →  restore
//
// Only updates the active field.
// Never deletes data.
// Must appear BEFORE PATCH /:counterId so Express
// does not swallow the /status segment as :counterId.
//
// =====================================================

router.patch("/:counterId/status", async (req, res) => {

    try {

        const { counterId } = req.params;
        const { active } = req.body;


        // -------------------------------------------------
        // Validate counter ID
        // -------------------------------------------------

        if (!mongoose.Types.ObjectId.isValid(counterId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }


        // -------------------------------------------------
        // Validate active is a boolean
        // -------------------------------------------------

        if (typeof active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "active must be a boolean (true or false)"
            });
        }


        // -------------------------------------------------
        // Load current counter to check existing state
        // -------------------------------------------------

        const existing = await Counter.findById(counterId);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }


        // -------------------------------------------------
        // Idempotency guards — avoid meaningless updates
        // -------------------------------------------------

        if (active === false && existing.active === false) {
            return res.status(409).json({
                success: false,
                message: "Counter is already archived"
            });
        }

        if (active === true && existing.active !== false) {
            return res.status(409).json({
                success: false,
                message: "Counter is already active"
            });
        }


        // -------------------------------------------------
        // Apply the status change — ONLY active field
        // -------------------------------------------------

        const counter = await Counter.findByIdAndUpdate(
            counterId,
            { active },
            { returnDocument: "after", runValidators: false }
        );


        // -------------------------------------------------
        // Response
        // -------------------------------------------------

        const action = active ? "restored" : "archived";

        res.json({
            success: true,
            message: `Counter ${action} successfully`,
            counter
        });

    } catch (error) {

        console.error("Counter status update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update counter status",
            error: error.message
        });
    }
});


// =====================================================
// PATCH COUNTER — partial update
// =====================================================
//
// PATCH /api/queues/:counterId
//
// Accepts any subset of:
//   name, stage, currentQueue, processingTime, staffCount
//
// Does not require every field.
// Recalculates status when currentQueue changes.
//
// =====================================================

router.patch("/:counterId", async (req, res) => {

    try {

        if (!mongoose.Types.ObjectId.isValid(req.params.counterId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }

        const {
            name,
            stage,
            currentQueue,
            processingTime,
            staffCount
        } = req.body;

        const updateData = {};

        if (name !== undefined) {
            updateData.name = name;
        }

        if (stage !== undefined) {
            updateData.stage = stage;
        }

        if (currentQueue !== undefined) {
            const q = Number(currentQueue);
            if (!Number.isFinite(q) || q < 0) {
                return res.status(400).json({
                    success: false,
                    message: "currentQueue must be a non-negative number"
                });
            }
            updateData.currentQueue = q;
            updateData.status = getQueueStatus(q);
        }

        if (processingTime !== undefined) {
            const pt = Number(processingTime);
            if (!Number.isFinite(pt) || pt < 0) {
                return res.status(400).json({
                    success: false,
                    message: "processingTime must be a non-negative number"
                });
            }
            updateData.processingTime = pt;
        }

        if (staffCount !== undefined) {
            const sc = Number(staffCount);
            if (!Number.isFinite(sc) || sc < 0) {
                return res.status(400).json({
                    success: false,
                    message: "staffCount must be a non-negative number"
                });
            }
            updateData.staffCount = sc;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided to update"
            });
        }

        const counter = await Counter.findByIdAndUpdate(
            req.params.counterId,
            updateData,
            { returnDocument: "after", runValidators: true }
        );

        if (!counter) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }

        res.json({
            success: true,
            message: "Counter updated successfully",
            counter
        });

    } catch (error) {

        console.error("Counter patch error:", error);

        res.status(400).json({
            success: false,
            message: "Failed to update counter",
            error: error.message
        });
    }
});


// =====================================================
// QUEUE EVENT — ARRIVAL / SERVED
// =====================================================
//
// POST /api/queues/event/:counterId
//
// Atomically increments or decrements currentQueue by 1.
// Uses MongoDB $inc so concurrent events cannot overwrite
// each other.
//
// Body: { "event": "arrival" }  →  currentQueue += 1
//       { "event": "served"  }  →  currentQueue -= 1 (floor 0)
//
// =====================================================

router.post("/event/:counterId", async (req, res) => {

    try {

        const { counterId } = req.params;
        const { event } = req.body;


        // -------------------------------------------------
        // Validate counter ID
        // -------------------------------------------------

        if (!mongoose.Types.ObjectId.isValid(counterId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid counter ID"
            });
        }


        // -------------------------------------------------
        // Validate event value
        // -------------------------------------------------

        if (event !== "arrival" && event !== "served") {
            return res.status(400).json({
                success: false,
                message: "event must be \"arrival\" or \"served\""
            });
        }


        // -------------------------------------------------
        // Guard: reject events on archived counters.
        // We do a pre-check before the atomic $inc so that
        // archived counters are never modified.
        // -------------------------------------------------

        const preCheck = await Counter.findById(counterId);

        if (!preCheck) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }

        if (preCheck.active === false) {
            return res.status(400).json({
                success: false,
                message: "Counter is archived and cannot receive live queue events"
            });
        }


        // -------------------------------------------------
        // Atomic increment
        //
        // For "served" we must not go below 0.
        // Approach:
        //   1. Try the $inc unconditionally, then clamp in
        //      a second update if the result went negative.
        //
        //   Alternatively, for "served" add a query filter
        //   { currentQueue: { $gt: 0 } } so the decrement
        //   only fires when there is someone to serve.
        //   If no document matches (queue already 0) we do
        //   a second findById to confirm the counter exists.
        // -------------------------------------------------

        let counter;

        if (event === "arrival") {

            // Simple increment — no floor needed
            counter = await Counter.findByIdAndUpdate(
                counterId,
                { $inc: { currentQueue: 1 } },
                { returnDocument: "after", runValidators: false }
            );

        } else {

            // Decrement only if queue > 0
            counter = await Counter.findOneAndUpdate(
                {
                    _id: counterId,
                    currentQueue: { $gt: 0 }
                },
                { $inc: { currentQueue: -1 } },
                { returnDocument: "after", runValidators: false }
            );

            // If no update matched, check whether the counter
            // exists at all (queue may simply already be 0)
            if (!counter) {
                const exists = await Counter.findById(counterId);

                if (!exists) {
                    return res.status(404).json({
                        success: false,
                        message: "Counter not found"
                    });
                }

                // Counter exists but queue is already 0 — return
                // current state without changing anything
                counter = exists;
            }
        }


        // -------------------------------------------------
        // 404 for arrival path (counter not found)
        // -------------------------------------------------

        if (!counter) {
            return res.status(404).json({
                success: false,
                message: "Counter not found"
            });
        }


        // -------------------------------------------------
        // Recalculate and persist status
        // -------------------------------------------------

        const newStatus = getQueueStatus(counter.currentQueue);

        if (counter.status !== newStatus) {
            counter.status = newStatus;
            await counter.save();
        }


        // -------------------------------------------------
        // Create historical snapshot
        //
        // arrivalRate: derived from the previous snapshot for
        //   this counter.  We look at the queue-length INCREASE
        //   between that snapshot and now.  Only "arrival" events
        //   can increase the queue, so:
        //
        //     net arrivals = max(0, currentQueue - prevQueueLength)
        //     elapsed minutes = (now - prevRecordedAt) / 60 000
        //
        //   If elapsed time is too short (<1 s) or no previous
        //   snapshot exists we store 0 (insufficient data) rather
        //   than dividing by zero or fabricating a value.
        //
        // waitingTime: calculated from current counter state.
        //   waitingTime = floor((currentQueue × processingTime) / staffCount)
        //   Falls back to 0 when staff is 0.
        // -------------------------------------------------

        const staff    = Number(counter.staffCount   || 0);
        const procTime = Number(counter.processingTime || 0);
        const curQueue = Number(counter.currentQueue  || 0);

        // waitingTime — always derivable from current state
        const waitingTime =
            staff > 0
                ? Math.round((curQueue * procTime) / staff)
                : 0;

        // arrivalRate — requires a previous snapshot to compare
        let arrivalRate = 0;

        const prevSnapshot = await QueueSnapshot
            .findOne({ counter: counter._id })
            .sort({ recordedAt: -1 })
            .lean();

        if (prevSnapshot && prevSnapshot.recordedAt) {
            const elapsedMs =
                Date.now() - new Date(prevSnapshot.recordedAt).getTime();

            // Only calculate when at least 1 second has elapsed
            // (avoids near-zero division from rapid burst events).
            if (elapsedMs >= 1000) {
                const elapsedMinutes = elapsedMs / 60000;
                const netArrivals =
                    Math.max(0, curQueue - Number(prevSnapshot.queueLength || 0));

                arrivalRate = Number(
                    (netArrivals / elapsedMinutes).toFixed(4)
                );
            }
        }

        const snapshot = await QueueSnapshot.create({
            counter:               counter._id,
            queueLength:           curQueue,
            arrivalRate,
            averageProcessingTime: procTime,
            waitingTime,
            staffAvailable:        staff
        });


        // -------------------------------------------------
        // Monitoring integration
        //
        // After a successful queue event, check whether this
        // counter has an approved intervention with a baseline
        // snapshot. If so, evaluate the current state against
        // that baseline and create/update a Monitoring record.
        //
        // This runs in a try/catch that is ISOLATED from the
        // main event response — a monitoring failure never
        // prevents the queue event from being recorded.
        // -------------------------------------------------

        let monitoringResult = null;

        try {

            // Find the most recent approved intervention for
            // this counter.
            const intervention = await Intervention.findOne({
                counter: counter._id,
                status: "approved"
            }).sort({ approvedAt: -1 });

            if (intervention && intervention.approvedAt) {

                // Find the baseline snapshot created at approval time.
                const baseline = await QueueSnapshot.findOne({
                    counter: counter._id,
                    recordedAt: { $gte: intervention.approvedAt }
                }).sort({ recordedAt: 1 });

                if (baseline) {

                    const beforeQueue   = Number(baseline.queueLength);
                    const beforeWait    = Number(baseline.waitingTime);
                    const afterQueue    = Number(counter.currentQueue);
                    const staff         = Number(counter.staffCount) || 1;
                    const procTime      = Number(counter.processingTime) || 0;

                    const afterWait =
                        staff > 0
                            ? Math.round((afterQueue * procTime) / staff)
                            : 0;

                    // Only write a monitoring record when the queue has
                    // actually changed from the baseline — avoid creating
                    // a record where before === after with no real data.
                    if (afterQueue !== beforeQueue || afterWait !== beforeWait) {

                        const queueImproved = afterQueue < beforeQueue;
                        const waitImproved  = afterWait  < beforeWait;

                        let effectiveness;

                        if (queueImproved && waitImproved) {
                            effectiveness = "positive";
                        } else if (!queueImproved && !waitImproved) {
                            effectiveness = "negative";
                        } else {
                            effectiveness = "insufficient";
                        }

                        monitoringResult = await Monitoring.create({
                            intervention: intervention._id,
                            counter:      counter._id,
                            beforeQueue,
                            afterQueue,
                            beforeWaitTime: beforeWait,
                            afterWaitTime:  afterWait,
                            effectiveness,
                            notes: `Auto-evaluated after "${event}" event on ${counter.name}`
                        });
                    }
                }
            }

        } catch (monErr) {
            // Log but never surface to caller — the queue event succeeded.
            console.error("Queue event monitoring evaluation error:", monErr);
        }


        // -------------------------------------------------
        // Response
        // -------------------------------------------------

        res.status(200).json({
            success: true,
            message: `Queue event "${event}" recorded`,
            event,
            counter: {
                id: counter._id,
                name: counter.name,
                stage: counter.stage,
                currentQueue: counter.currentQueue,
                processingTime: counter.processingTime,
                staffCount: counter.staffCount,
                status: counter.status
            },
            snapshot,
            ...(monitoringResult && { monitoring: monitoringResult })
        });

    } catch (error) {

        console.error("Queue event error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to process queue event",
            error: error.message
        });
    }
});


// =====================================================
// QUEUE STATUS HELPER
// =====================================================
//
// This is intentionally simple for the prototype.
//
// 0-19   = normal
// 20-39  = busy
// 40+    = critical
//
// The AI prediction is still responsible for future
// congestion detection.
//
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
// EXPORT
// =====================================================

module.exports = router;