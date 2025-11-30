const mongoose = require("mongoose");

/**
 * Schema para documentos legais (Termos de Uso e Política de Privacidade)
 * Esses documentos são globais e aplicam-se a todas as cidades
 */
const legalDocumentSchema = new mongoose.Schema(
  {
    // Tipo do documento: 'terms' (Termos de Uso) ou 'privacy' (Política de Privacidade/LGPD)
    type: {
      type: String,
      enum: ["terms", "privacy"],
      required: true,
      unique: true,
    },
    // Título do documento
    title: {
      type: String,
      required: true,
    },
    // Conteúdo do documento (suporta markdown ou HTML)
    content: {
      type: String,
      required: true,
    },
    // Versão do documento (para controle de atualizações)
    version: {
      type: String,
      default: "1.0",
    },
    // Data da última atualização
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    // Admin que fez a última atualização
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Se o documento está ativo/publicado
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índice para busca rápida por tipo
legalDocumentSchema.index({ type: 1 });

module.exports = mongoose.model("LegalDocument", legalDocumentSchema);

