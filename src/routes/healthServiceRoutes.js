const express = require("express");
const {
  getHealthServices,
  createHealthService,
  updateHealthService,
  deleteHealthService,
} = require("../controllers/healthServiceController");

const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Todas as rotas requerem autenticação admin
router.get("/:cityId", isAdmin, getHealthServices);
router.post("/:cityId", isAdmin, createHealthService);
router.put("/:cityId/:serviceId", isAdmin, updateHealthService);
router.delete("/:cityId/:serviceId", isAdmin, deleteHealthService);

module.exports = router;




