const express = require("express");
const {
  createEvent,
  getEventsByCity,
  getEventById,
  updateEvent,
  deleteEvent,
  getAllEvents,
} = require("../controllers/eventController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rotas públicas (mobile)
router.get("/getEventsByCity/:cityId", getEventsByCity);
router.get("/getEventById/:id", getEventById);

// Rotas administrativas (dashboard)
router.post("/createEvent", isAdmin, createEvent);
router.get("/getAllEvents", isAdmin, paginationMiddleware, getAllEvents);
router.put("/updateEvent/:id", isAdmin, updateEvent);
router.delete("/deleteEvent/:id", isAdmin, deleteEvent);

module.exports = router;

