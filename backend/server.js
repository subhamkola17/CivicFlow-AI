const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

const dashboardRoutes = require("./routes/dashboardRoutes");
const queueRoutes = require("./routes/queueRoutes");
const serviceCenterRoutes = require("./routes/serviceCenterRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const bottleneckRoutes = require("./routes/bottleneckRoutes");
const rootCauseRoutes = require("./routes/rootCauseRoutes");
const simulationRoutes = require("./routes/simulationRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Dashboard API
app.use("/api/dashboard", dashboardRoutes);

// Queue API
app.use("/api/queues", queueRoutes);

// Service Center API
app.use("/api/service-centers", serviceCenterRoutes);

// Prediction API
app.use("/api/predictions", predictionRoutes);
// Bottleneck API
app.use("/api/bottlenecks", bottleneckRoutes);
// Root Cause API
app.use("/api/root-causes", rootCauseRoutes);
// Simulation API
app.use("/api/simulation", simulationRoutes);
// Recommendation API
app.use("/api/recommendations", recommendationRoutes);
//Monitoring API
app.use("/api/monitoring", monitoringRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({
        message: "CivicFlow AI Backend is running",
        status: "OK"
    });
});

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`CivicFlow AI server running on port ${PORT}`);
});