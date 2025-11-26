const express = require("express");
const {
  createCity,
  getAllCities,
  getCityById,
  deleteCity,
  updateReportTypesByCity,
  updateMenuByCity,
  updateModulesByCity,
  getMobileConfig,
  updateMobileConfig,
  getAllReportTypes,
  createCustomReportType,
  updateCustomReportType,
  toggleReportTypeStatus,
  deactivateMultipleReportTypes,
  activateMultipleReportTypes,
  deleteReportType,
} = require("../controllers/cityController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { isAdmin } = require("../middlewares/adminMiddleware");

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

// Atualizar menu da cidade (apenas super admins)
router.put("/updateMenuByCity/:id", isAdmin, updateMenuByCity);

// Atualizar módulos da cidade
router.put("/updateModulesByCity/:id", updateModulesByCity);

// Buscar configuração mobile de uma cidade
router.get("/mobile-config/:id", getMobileConfig);

// Atualizar configuração mobile de uma cidade (apenas prefeitos e super admins)
router.put("/mobile-config/:id", isAdmin, updateMobileConfig);

// ==================== TIPOS DE REPORTS (PADRÃO + PERSONALIZADOS) ====================
// Listar TODOS os tipos (padrão + personalizados)
router.get("/report-types/:id", isAdmin, getAllReportTypes);

// Criar tipo personalizado
router.post("/report-types/:id", isAdmin, createCustomReportType);

// Atualizar tipo (padrão ou personalizado)
router.put("/report-types/:id/:typeId", isAdmin, updateCustomReportType);

// Desativar/Ativar um tipo
router.patch("/report-types/:id/:typeId/status", isAdmin, toggleReportTypeStatus);

// Desativar múltiplos tipos
router.post("/report-types/:id/deactivate-multiple", isAdmin, deactivateMultipleReportTypes);

// Ativar múltiplos tipos
router.post("/report-types/:id/activate-multiple", isAdmin, activateMultipleReportTypes);

// Deletar tipo (padrão ou personalizado)
router.delete("/report-types/:id/:typeId", isAdmin, deleteReportType);

module.exports = router;
