const express = require("express");
const {
  createNews,
  getNewsByCity,
  getNewsById,
  updateNews,
  deleteNews,
} = require("../controllers/newsController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rotas públicas (mobile)
router.get("/city/:cityId", getNewsByCity);
router.get("/:id", getNewsById);

// Rotas administrativas (dashboard)
router.post("/", isAdmin, createNews);
router.put("/:id", isAdmin, updateNews);
router.delete("/:id", isAdmin, deleteNews);

module.exports = router;


