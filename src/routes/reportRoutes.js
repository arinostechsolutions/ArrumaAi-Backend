const express = require("express");
const {
  createReport,
  getAllReports,
  getReportById,
  deleteReport,
  getReportsByCity,
} = require("../controllers/reportController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { rateLimitMiddleware } = require("../middlewares/rateLimitMiddleware");
const { validateReport } = require("../middlewares/validationMiddleware");

const router = express.Router();

// Criar uma nova denúncia (somente se o módulo estiver ativado)
router.post("/createReport", validateReport, rateLimitMiddleware, createReport);

// Buscar todas as denúncias (com paginação)
router.get("/getAllReports", paginationMiddleware, getAllReports);

// Buscar denúncia por ID
router.get("/getReportById/:id", getReportById);

// Buscar denúncias de uma cidade específica
router.get("/getReportsByCity/:cityId", paginationMiddleware, getReportsByCity);

// Deletar denúncia e removê-la da cidade
router.delete("/deleteReport/:id", deleteReport);

module.exports = router;
