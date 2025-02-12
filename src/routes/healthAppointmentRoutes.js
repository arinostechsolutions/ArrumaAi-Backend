const express = require("express");
const {
  createAppointment,
  getAllAppointments,
  getAppointmentsByCity,
  updateAppointmentStatus,
  deleteAppointment,
  getRemainingAppointments,
  getAppointmentsCountByCity,
} = require("../controllers/healthAppointmentController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { rateLimitMiddleware } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

router.post("/createAppointment", rateLimitMiddleware, createAppointment);

router.get("/getAllAppointments", paginationMiddleware, getAllAppointments);

router.get(
  "/getAppointmentsByCity/:cityId",
  paginationMiddleware,
  getAppointmentsByCity
);

router.put("/updateAppointmentStatus/:id", updateAppointmentStatus);

router.delete("/deleteAppointment/:id", deleteAppointment);

router.get("/getRemainingAppointments", getRemainingAppointments);

router.get("/getAppointmentsCountByCity/:cityId", getAppointmentsCountByCity);

module.exports = router;
