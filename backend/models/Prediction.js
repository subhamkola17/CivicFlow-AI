const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema(
    {
        counter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Counter",
            required: true
        },

        prediction30Min: {
            type: Number,
            default: 0
        },

        prediction60Min: {
            type: Number,
            default: 0
        },

        threshold: {
            type: Number,
            default: 60
        },

        thresholdExceeded: {
            type: Boolean,
            default: false
        },

        confidence: {
            type: Number,
            default: 0
        },

        predictedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Prediction", predictionSchema);