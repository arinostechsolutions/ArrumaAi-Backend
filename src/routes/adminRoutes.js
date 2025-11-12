const express = require("express");
const {
  getStats,
  getPendingContentReports,
  deleteReport,
  banUser,
  resolveContentReport,
  getRecentUsers,
  getRecentReports,
  createAdminUser,
} = require("../controllers/adminController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Todas as rotas admin exigem autenticação de admin
router.use(isAdmin);

// Criar administradores (super-admin)
router.post("/users", createAdminUser);

// Estatísticas gerais
router.get("/stats", getStats);

// Denúncias de conteúdo pendentes
router.get("/content-reports/pending", getPendingContentReports);

// Resolver denúncia de conteúdo
router.patch("/content-report/:contentReportId/resolve", resolveContentReport);

// Deletar post denunciado
router.delete("/report/:reportId", deleteReport);

// Banir usuário
router.post("/user/:userId/ban", banUser);

// Usuários recentes
router.get("/users/recent", getRecentUsers);

// Denúncias recentes
router.get("/reports/recent", getRecentReports);

module.exports = router;

