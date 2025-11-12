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

module.exports = router;

