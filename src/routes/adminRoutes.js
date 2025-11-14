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
  createMayor,
  getAdminUsers,
  getAdminUser,
  updateAdminUser,
  deleteAdminUser,
} = require("../controllers/adminController");
const {
  getActivityLogs,
  getActivityLogStats,
} = require("../controllers/activityLogController");
const {
  createObservation,
  getObservations,
  markAsRead,
} = require("../controllers/observationController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Todas as rotas admin exigem autenticação de admin
router.use(isAdmin);

// Criar administradores (super-admin)
router.post("/users", createAdminUser);
router.post("/users/mayor", createMayor);

// Gerenciar administradores (super-admin)
router.get("/users/admins", getAdminUsers);
router.get("/users/:userId", getAdminUser);
router.put("/users/:userId", updateAdminUser);
router.delete("/users/:userId", deleteAdminUser);

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

// Histórico de atividades (super-admin)
router.get("/activity-logs", getActivityLogs);
router.get("/activity-logs/stats", getActivityLogStats);

// Observações (prefeito e secretarias)
router.post("/observations", createObservation);
router.get("/observations", getObservations);
router.put("/observations/:observationId/read", markAsRead);

module.exports = router;

