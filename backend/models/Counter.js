const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
    {
        serviceCenter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ServiceCenter",
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        stage: {
            type: String,
            required: true,
            trim: true
        },

        currentQueue: {
            type: Number,
            default: 0
        },

        processingTime: {
            type: Number,
            default: 0
        },

        staffCount: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: ["normal", "busy", "critical"],
            default: "normal"
        },

        // true  = counter is live and accepting queue events
        // false = counter is archived (soft-deleted, data preserved)
        active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Counter", counterSchema);