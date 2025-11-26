const express = require("express");
const {
  createBlockade,
  getActiveBlockadesForMap,
  getActiveBlockades,
  getAllBlockades,
  getBlockadeById,
  updateBlockade,
  updateBlockadeStatus,
  deleteBlockade,
  updateExpiredBlockades,
  removeProblematicIndex,
} = require("../controllers/streetBlockadeController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rotas públicas (mobile)
router.get("/map/:cityId", getActiveBlockadesForMap);
router.get("/active/:cityId", paginationMiddleware, getActiveBlockades);

// Rotas administrativas
router.get("/all/:cityId", isAdmin, paginationMiddleware, getAllBlockades);
router.get("/:id", isAdmin, getBlockadeById);
router.post("/create", isAdmin, createBlockade);
router.put("/:id", isAdmin, updateBlockade);
router.patch("/:id/status", isAdmin, updateBlockadeStatus);
router.delete("/:id", isAdmin, deleteBlockade);

// Job para atualizar status (pode ser chamado por cron)
router.post("/update-expired", isAdmin, updateExpiredBlockades);

// Rota temporária para remover índice problemático (pode ser removida depois)
router.post("/remove-problematic-index", isAdmin, removeProblematicIndex);

module.exports = router;

