// src/routes/feedRoutes.js
const express = require("express");
const router = express.Router();
const {
  getFeed,
  toggleLike,
  registerView,
  registerShare,
} = require("../controllers/feedController");

// GET /api/feed/city/:cityId - Busca o feed ordenado por engajamento
router.get("/city/:cityId", getFeed);

// POST /api/feed/like/:reportId - Adiciona/remove like
router.post("/like/:reportId", toggleLike);

// POST /api/feed/view/:reportId - Registra visualização
router.post("/view/:reportId", registerView);

// POST /api/feed/share/:reportId - Registra compartilhamento
router.post("/share/:reportId", registerShare);

module.exports = router;

