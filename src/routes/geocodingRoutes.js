const express = require("express");
const router = express.Router();
const { reverseGeocode } = require("../controllers/geocodingController");

// GET /api/geocoding/reverse?lat=xxx&lng=xxx
router.get("/reverse", reverseGeocode);

module.exports = router;



