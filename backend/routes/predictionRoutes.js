const express = require("express");
const router = express.Router();

const { spawn } = require("child_process");
const path = require("path");

const Prediction = require("../models/Prediction");


// =====================================================
// GET ALL PREDICTIONS
// GET /api/predictions
// =====================================================

router.get("/", async (req, res) => {
    try {
        const predictions = await Prediction.find()
            .populate("counter")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: predictions.length,
            predictions
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch predictions",
            error: error.message
        });
    }
});


// =====================================================
// RUN ML PREDICTION
// POST /api/predictions/run
// =====================================================

router.post("/run", async (req, res) => {
    try {

        const {
            counter,
            arrivalRate,
            currentQueue,
            processingTime,
            staffCount,
            threshold = 60
        } = req.body;


        // =================================================
        // VALIDATION
        // =================================================

        if (!counter) {
            return res.status(400).json({
                success: false,
                message: "Counter ID is required"
            });
        }

        if (
            currentQueue === undefined ||
            arrivalRate === undefined ||
            processingTime === undefined ||
            staffCount === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "currentQueue, arrivalRate, processingTime and staffCount are required"
            });
        }


        // =================================================
        // CONVERT INPUTS TO NUMBERS
        // =================================================

        const numericCurrentQueue = Number(currentQueue);
        const numericArrivalRate = Number(arrivalRate);
        const numericProcessingTime = Number(processingTime);
        const numericStaffCount = Number(staffCount);
        const numericThreshold = Number(threshold);


        // =================================================
        // VALIDATE NUMERIC INPUTS
        // =================================================

        if (
            !Number.isFinite(numericCurrentQueue) ||
            !Number.isFinite(numericArrivalRate) ||
            !Number.isFinite(numericProcessingTime) ||
            !Number.isFinite(numericStaffCount) ||
            !Number.isFinite(numericThreshold)
        ) {
            return res.status(400).json({
                success: false,
                message: "All prediction inputs must be valid numbers"
            });
        }


        // =================================================
        // DATA FOR PYTHON ML MODEL
        // =================================================

        const inputData = JSON.stringify({
            currentQueue: numericCurrentQueue,
            arrivalRate: numericArrivalRate,
            processingTime: numericProcessingTime,
            staffCount: numericStaffCount
        });


        // =================================================
        // PYTHON SCRIPT PATH
        // =================================================

        const pythonScript = path.join(
            __dirname,
            "../ml/predict.py"
        );


        // =================================================
        // RUN PYTHON ML MODEL
        // =================================================

        const pythonProcess = spawn(
            "python",
            [pythonScript],
            {
                cwd: path.join(__dirname, "..")
            }
        );


        let output = "";
        let errorOutput = "";


        // =================================================
        // RECEIVE PYTHON OUTPUT
        // =================================================

        pythonProcess.stdout.on("data", (data) => {
            output += data.toString();
        });


        pythonProcess.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });


        // =================================================
        // PYTHON PROCESS COMPLETED
        // =================================================

        pythonProcess.on("close", async (code) => {

            if (code !== 0) {

                console.error(
                    "Python ML Error:",
                    errorOutput
                );

                return res.status(500).json({
                    success: false,
                    message: "Python ML prediction failed",
                    error: errorOutput
                });
            }


            try {

                // =================================================
                // READ PYTHON RESULT
                // =================================================

                const result = JSON.parse(output);


                // =================================================
                // CHECK PYTHON SUCCESS
                // =================================================

                if (result.success === false) {
                    return res.status(500).json({
                        success: false,
                        message:
                            result.error ||
                            "Python ML model returned an error"
                    });
                }


                // =================================================
                // READ ML PREDICTIONS
                // =================================================

                const prediction30Min =
                    Number(result.predictedQueueAfter30Min);

                const prediction60Min =
                    Number(result.predictedQueueAfter60Min);


                // =================================================
                // READ MODEL VALIDATION METRICS
                // =================================================

                const reliability =
                    Number(result.reliability);

                const mae =
                    Number(result.mae);

                const r2 =
                    Number(result.r2);


                // =================================================
                // VALIDATE ML OUTPUT
                // =================================================

                if (
                    !Number.isFinite(prediction30Min) ||
                    !Number.isFinite(prediction60Min)
                ) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Invalid prediction returned by ML model"
                    });
                }


                if (
                    !Number.isFinite(reliability) ||
                    !Number.isFinite(mae) ||
                    !Number.isFinite(r2)
                ) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Invalid model validation metrics returned by ML model"
                    });
                }


                // =================================================
                // CHECK THRESHOLD
                // =================================================

                const thresholdExceeded =
                    prediction30Min > numericThreshold ||
                    prediction60Min > numericThreshold;


                // =================================================
                // SAVE PREDICTION TO MONGODB
                // =================================================
                //
                // IMPORTANT:
                // The Prediction model currently has a field
                // called "confidence".
                //
                // We are storing the validated model reliability
                // there so the existing frontend/database structure
                // continues to work.
                //
                // This is NOT a fake 85%/90% confidence value.
                // It comes from the model's validation R².
                // =================================================

                const prediction = await Prediction.create({

                    counter,

                    prediction30Min,

                    prediction60Min,

                    threshold: numericThreshold,

                    thresholdExceeded,

                    confidence: reliability

                });


                // =================================================
                // RESPONSE
                // =================================================

                return res.status(201).json({

                    success: true,

                    message:
                        "ML prediction generated successfully",


                    // =================================================
                    // INPUT DATA
                    // =================================================

                    input: {

                        currentQueue:
                            numericCurrentQueue,

                        arrivalRate:
                            numericArrivalRate,

                        processingTime:
                            numericProcessingTime,

                        staffCount:
                            numericStaffCount

                    },


                    // =================================================
                    // ML PREDICTION
                    // =================================================

                    prediction: {

                        prediction30Min,

                        prediction60Min,

                        threshold:
                            numericThreshold,

                        thresholdExceeded

                    },


                    // =================================================
                    // MODEL PERFORMANCE
                    // =================================================

                    modelPerformance: {

                        reliability,

                        mae,

                        r2

                    },


                    // =================================================
                    // DATABASE RECORD
                    // =================================================

                    databaseRecord: prediction

                });


            } catch (parseError) {

                console.error(
                    "Python output parsing error:",
                    parseError
                );

                console.error(
                    "Python output:",
                    output
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Failed to parse Python ML result",

                    error:
                        parseError.message

                });
            }
        });


        // =================================================
        // SEND DATA TO PYTHON
        // =================================================

        pythonProcess.stdin.write(inputData);

        pythonProcess.stdin.end();


    } catch (error) {

        res.status(500).json({

            success: false,

            message:
                "ML prediction failed",

            error:
                error.message

        });
    }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;