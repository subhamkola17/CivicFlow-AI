const mongoose = require("mongoose");

const monitoringSchema = new mongoose.Schema(
    {
        intervention: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Intervention",
            required: true
        },

        counter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Counter",
            required: true
        },

        beforeQueue: {
            type: Number,
            default: 0
        },

        afterQueue: {
            type: Number,
            default: 0
        },

        beforeWaitTime: {
            type: Number,
            default: 0
        },

        afterWaitTime: {
            type: Number,
            default: 0
        },

        effectiveness: {
            type: String,
            enum: ["positive", "neutral", "negative", "insufficient"],
            default: "neutral"
        },

        notes: {
            type: String,
            default: ""
        },

        checkedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Monitoring", monitoringSchema);