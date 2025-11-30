const express = require("express");
const router = express.Router();
const mobileAuthController = require("../controllers/mobileAuthController");
const { authMiddleware } = require("../middlewares/authMiddleware");

/**
 * 📱 Rotas de Autenticação Mobile
 * Base: /api/mobile-auth
 */

// Rotas públicas (não requerem autenticação)
router.post("/check-user", mobileAuthController.checkUser);
router.post("/login", mobileAuthController.login);
router.post("/register", mobileAuthController.register);
router.post("/forgot-password", mobileAuthController.forgotPassword);
router.post("/reset-password", mobileAuthController.resetPassword);
router.post("/set-password", mobileAuthController.setPassword);

// Rotas protegidas (requerem autenticação)
router.get("/me", authMiddleware, mobileAuthController.getMe);

module.exports = router;

