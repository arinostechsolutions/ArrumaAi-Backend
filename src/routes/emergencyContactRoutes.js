// src/routes/emergencyContactRoutes.js
const express = require("express");
const {
  createEmergencyContact,
  getEmergencyContactsByCity,
  getEmergencyContactById,
  updateEmergencyContact,
  deleteEmergencyContact,
} = require("../controllers/emergencyContactController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rotas públicas (para mobile)
router.get("/city/:cityId", getEmergencyContactsByCity);

// Rotas protegidas (admin)
router.post("/create", isAdmin, createEmergencyContact);
router.get("/:id", isAdmin, getEmergencyContactById);
router.put("/:id", isAdmin, updateEmergencyContact);
router.delete("/:id", isAdmin, deleteEmergencyContact);

module.exports = router;

