const express = require("express");
const {
  createMessage,
  getMessagesByUser,
  getMessagesByReport,
  markAsRead,
  getUnreadMessagesByUser,
  deleteMessage,
} = require("../controllers/messageController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Criar mensagem (apenas admin)
router.post("/create", isAdmin, createMessage);

// Buscar mensagens por usuário
router.get("/user/:userId", getMessagesByUser);

// Buscar mensagens não lidas por usuário
router.get("/user/:userId/unread", getUnreadMessagesByUser);

// Buscar mensagens por report
router.get("/report/:reportId", getMessagesByReport);

// Marcar mensagem como lida
router.patch("/:messageId/read", markAsRead);

// Deletar mensagem (apenas admin)
router.delete("/:messageId", isAdmin, deleteMessage);

module.exports = router;

