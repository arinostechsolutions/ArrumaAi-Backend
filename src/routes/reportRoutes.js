// src/routes/reportRoutes.js
const express = require("express");
const {
  createReport,
  getAllReports,
  getReportById,
  deleteReport,
} = require("../controllers/reportController");

const router = express.Router();

router.post("/createReport", createReport);
router.get("/getAllReports", getAllReports);
router.get("/getReportById/:id", getReportById);
router.delete("/deleteReport/:id", deleteReport);

module.exports = router;
