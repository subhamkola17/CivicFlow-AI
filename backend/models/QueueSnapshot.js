const mongoose = require("mongoose");

const queueSnapshotSchema = new mongoose.Schema(
    {
        counter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Counter",
            required: true
        },

        queueLength: {
            type: Number,
            required: true,
            min: 0
        },

        arrivalRate: {
            type: Number,
            default: 0
        },

        averageProcessingTime: {
            type: Number,
            default: 0
        },

        waitingTime: {
            type: Number,
            default: 0
        },

        staffAvailable: {
            type: Number,
            default: 0
        },

        recordedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("QueueSnapshot", queueSnapshotSchema);