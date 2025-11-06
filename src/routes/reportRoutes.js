const express = require("express");
const {
  createReport,
  getAllReports,
  getReportById,
  deleteReport,
  getReportsByCity,
  getReportsByUser,
} = require("../controllers/reportController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { rateLimitMiddleware } = require("../middlewares/rateLimitMiddleware");
const { validateReport } = require("../middlewares/validationMiddleware");

const router = express.Router();

router.post("/createReport", validateReport, rateLimitMiddleware, createReport);
router.get("/getAllReports", paginationMiddleware, getAllReports);
router.get("/getReportById/:id", getReportById);
router.get("/getReportsByCity/:cityId", paginationMiddleware, getReportsByCity);
router.get("/getReportsByUser/:userId", getReportsByUser);
router.delete("/deleteReport/:id", deleteReport);

module.exports = router;
