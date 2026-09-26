const mongoose = require("mongoose");

const interventionSchema = new mongoose.Schema(
    {
        serviceCenter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ServiceCenter",
            required: true
        },

        counter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Counter",
            required: true
        },

        action: {
            type: String,
            required: true,
            trim: true
        },

        reason: {
            type: String,
            default: ""
        },

        expectedImpact: {
            type: String,
            default: ""
        },

        durationMinutes: {
            type: Number,
            default: 60
        },

        // -------------------------------------------------
        // actionType drives what the approval handler does
        // to the affected Counter.
        //
        // "add_staff"       → staffCount += 1 (atomic $inc)
        // "reduce_arrivals" → no counter mutation (arrival
        //                     routing is outside this system)
        // null              → approval is a flag-flip only
        //                     (backward-compatible default)
        // -------------------------------------------------

        actionType: {
            type: String,
            enum: ["add_staff", "reduce_arrivals", null],
            default: null
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "completed"],
            default: "pending"
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        approvedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Intervention", interventionSchema);