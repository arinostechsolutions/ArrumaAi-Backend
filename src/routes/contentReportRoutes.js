const express = require("express");
const {
  createContentReport,
  getPendingReports,
  getReportCount,
  reviewContentReport,
} = require("../controllers/contentReportController");

const router = express.Router();

// Criar denúncia de conteúdo
router.post("/create", createContentReport);

// Listar denúncias pendentes (admin - futuro)
router.get("/pending", getPendingReports);

// Contar denúncias de um report específico
router.get("/by-report/:reportId", getReportCount);

// Revisar/atualizar denúncia (admin - futuro)
router.patch("/review/:contentReportId", reviewContentReport);

module.exports = router;

