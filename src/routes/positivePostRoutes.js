const express = require("express");
const {
  createPositivePost,
  getPositivePostsFeed,
  getPositivePostById,
  updatePositivePost,
  deletePositivePost,
  getPositivePostsByCity,
  getNearbyPositivePosts,
  toggleLike,
  registerView,
  registerShare,
} = require("../controllers/positivePostController");
const { isAdmin } = require("../middlewares/adminMiddleware");
const { paginationMiddleware } = require("../middlewares/paginationMiddleware");

const router = express.Router();

// Criar post positivo (apenas admin)
router.post("/create", isAdmin, createPositivePost);

// Feed público de posts positivos por cidade
router.get("/feed/:cityId", paginationMiddleware, getPositivePostsFeed);

// Buscar posts próximos (por localização) - DEVE VIR ANTES DE /:id
router.get("/nearby", getNearbyPositivePosts);

// Listar posts por cidade (admin) - DEVE VIR ANTES DE /:id
router.get("/city/:cityId", isAdmin, paginationMiddleware, getPositivePostsByCity);

// Buscar post por ID (deve ser a última rota GET com parâmetro)
router.get("/:id", getPositivePostById);

// Engajamento (like, view, share) - DEVE VIR ANTES DE PUT/DELETE
router.post("/:id/like", toggleLike);
router.post("/:id/view", registerView);
router.post("/:id/share", registerShare);

// Atualizar post (apenas admin - criador ou super admin)
router.put("/:id", isAdmin, updatePositivePost);

// Deletar post (apenas admin - criador ou super admin)
router.delete("/:id", isAdmin, deletePositivePost);

module.exports = router;

