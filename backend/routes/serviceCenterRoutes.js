const express = require("express");
const ServiceCenter = require("../models/ServiceCenter");

const router = express.Router();

// GET all service centers
router.get("/", async (req, res) => {
    try {
        const serviceCenters = await ServiceCenter.find();

        res.json({
            success: true,
            count: serviceCenters.length,
            serviceCenters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to load service centers",
            error: error.message
        });
    }
});

// POST create a service center
router.post("/", async (req, res) => {
    try {
        const serviceCenter = await ServiceCenter.create(req.body);

        res.status(201).json({
            success: true,
            message: "Service center created successfully",
            serviceCenter
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to create service center",
            error: error.message
        });
    }
});

module.exports = router;