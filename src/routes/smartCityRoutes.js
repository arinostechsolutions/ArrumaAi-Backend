const express = require("express");
const {
  getSmartCityPOIs,
  createCustomPOI,
  updateCustomPOI,
  deleteCustomPOI,
  updatePOITypesConfig,
} = require("../controllers/smartCityController");

const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rota pública para buscar POIs
router.get("/pois/:cityId", getSmartCityPOIs);

// Rotas administrativas para gerenciar POIs
router.post("/pois/:cityId", isAdmin, createCustomPOI);
router.put("/pois/:cityId/:poiId", isAdmin, updateCustomPOI);
router.delete("/pois/:cityId/:poiId", isAdmin, deleteCustomPOI);
router.put("/pois-config/:cityId", isAdmin, updatePOITypesConfig);

module.exports = router;


