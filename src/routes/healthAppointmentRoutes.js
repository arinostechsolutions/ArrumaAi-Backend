const express = require("express");
const {
  createAppointment,
  getAppointmentsByUser,
  getAllAppointments,
  getAppointmentsByCity,
  updateAppointmentStatus,
  deleteAppointment,
  getRemainingAppointments,
  getAppointmentsCountByCity,
  getHealthAnalytics,
} = require("../controllers/healthAppointmentController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { rateLimitMiddleware } = require("../middlewares/rateLimitMiddleware");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rotas públicas (mobile)
router.post("/createAppointment", rateLimitMiddleware, createAppointment);
router.get("/getAppointmentsByUser/:userId", getAppointmentsByUser);
router.get("/getRemainingAppointments", getRemainingAppointments);

// Rotas administrativas (dashboard)
router.get("/getAllAppointments", isAdmin, paginationMiddleware, getAllAppointments);
router.get(
  "/getAppointmentsByCity/:cityId",
  isAdmin,
  paginationMiddleware,
  getAppointmentsByCity
);
router.put("/updateAppointmentStatus/:id", isAdmin, updateAppointmentStatus);
router.delete("/deleteAppointment/:id", isAdmin, deleteAppointment);
router.get("/getAppointmentsCountByCity/:cityId", isAdmin, getAppointmentsCountByCity);
router.get("/getHealthAnalytics/:cityId", isAdmin, getHealthAnalytics);

module.exports = router;
