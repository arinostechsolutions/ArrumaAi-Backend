const express = require("express");
const router = express.Router();
const { reverseGeocode, searchAddresses } = require("../controllers/geocodingController");

// GET /api/geocoding/reverse?lat=xxx&lng=xxx
router.get("/reverse", reverseGeocode);

// GET /api/geocoding/search?q=xxx&limit=5
router.get("/search", searchAddresses);

module.exports = router;








