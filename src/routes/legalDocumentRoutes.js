const express = require("express");
const router = express.Router();
const legalDocumentController = require("../controllers/legalDocumentController");
const { isAdmin } = require("../middlewares/adminMiddleware");

/**
 * 📄 Rotas de Documentos Legais
 * Base: /api/legal
 */

// Rotas protegidas (usadas pelo dashboard admin) - DEVEM VIR PRIMEIRO
router.get("/all", isAdmin, legalDocumentController.getAllDocuments);
router.put("/:type", isAdmin, legalDocumentController.upsertDocument);

// Rotas públicas (usadas pelo mobile)
router.get("/:type", legalDocumentController.getDocument);

module.exports = router;
