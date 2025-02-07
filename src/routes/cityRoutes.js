const express = require("express");
const {
  createCity,
  getAllCities,
  getCityById,
  deleteCity,
  updateReportTypesByCity,
  updateMenuByCity,
  updateModulesByCity,
} = require("../controllers/cityController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");

const router = express.Router();

// Criar uma nova cidade
router.post("/createCity", createCity);

// Buscar todas as cidades (com paginação)
router.get("/getAllCities", paginationMiddleware, getAllCities);

// Buscar cidade por ID
router.get("/getCityById/:id", getCityById);

// Deletar cidade
router.delete("/deleteCity/:id", deleteCity);

// Atualizar tipos de denúncias da cidade
router.put("/updateReportTypesByCity/:id", updateReportTypesByCity);

// Atualizar menu da cidade
router.put("/updateMenuByCity/:id", updateMenuByCity);

// Atualizar módulos da cidade
router.put("/updateModulesByCity/:id", updateModulesByCity);

module.exports = router;
