const express = require("express");
const {
  getOverview,
  getReportsSummary,
  getTopReports,
  getMapData,
  getReportStatusOptions,
  getReportsList,
  updateReportStatus,
} = require("../controllers/dashboardController");
const {
  getByNeighborhood,
  getByType,
  getTrends,
  getComparison,
} = require("../controllers/analyticsController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

router.use(isAdmin);

router.get("/overview", getOverview);
router.get("/reports/summary", getReportsSummary);
router.get("/reports/top", getTopReports);
router.get("/reports/status-options", getReportStatusOptions);
router.get("/reports/list", getReportsList);
router.patch("/reports/:reportId/status", updateReportStatus);
router.get("/map", getMapData);

// Analytics routes
router.get("/analytics/by-neighborhood", getByNeighborhood);
router.get("/analytics/by-type", getByType);
router.get("/analytics/trends", getTrends);
router.get("/analytics/comparison", getComparison);

module.exports = router;

