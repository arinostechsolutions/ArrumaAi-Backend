const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Admin que realizou a ação
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    adminEmail: {
      type: String,
      required: false,
    },
    adminCpf: {
      type: String,
      required: false,
    },
    secretaria: {
      type: String,
      required: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    // Tipo de ação
    actionType: {
      type: String,
      required: true,
      enum: [
        "login", // Login no sistema
        "logout", // Logout do sistema
        "report_status_update", // Alteração de status de irregularidade
        "admin_create", // Criação de administrador
        "admin_update", // Edição de administrador
        "admin_delete", // Deleção de administrador
        "secretaria_create", // Criação de secretaria
        "secretaria_update", // Edição de secretaria
        "secretaria_delete", // Deleção de secretaria
        "report_delete", // Deleção de irregularidade
        "user_ban", // Banimento de usuário
        "content_report_resolve", // Resolução de denúncia de conteúdo
      ],
    },

    // Descrição da ação
    description: {
      type: String,
      required: true,
    },

    // Detalhes adicionais (JSON)
    details: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    // Entidade relacionada (opcional)
    entityType: {
      type: String,
      required: false,
      enum: ["report", "user", "admin", "secretaria", "content_report"],
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    // IP do admin (segurança)
    ipAddress: {
      type: String,
      required: false,
    },

    // User agent (navegador)
    userAgent: {
      type: String,
      required: false,
    },

    // Cidade relacionada (se aplicável)
    cityId: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Índices para busca eficiente
activityLogSchema.index({ adminId: 1, createdAt: -1 });
activityLogSchema.index({ actionType: 1, createdAt: -1 });
activityLogSchema.index({ cityId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);

