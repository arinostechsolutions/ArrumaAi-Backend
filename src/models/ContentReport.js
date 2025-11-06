const mongoose = require("mongoose");

const contentReportSchema = new mongoose.Schema(
  {
    // Denúncia original que está sendo reportada
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },
    
    // Usuário que está fazendo a denúncia
    reportedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      cpf: {
        type: String,
        required: true,
      },
    },
    
    // Motivo da denúncia
    reason: {
      type: String,
      required: true,
      enum: [
        "conteudo_improprio",
        "imagem_ofensiva",
        "informacao_falsa",
        "conteudo_adulto",
        "outro",
      ],
    },
    
    // Detalhes adicionais (opcional)
    details: {
      type: String,
      required: false,
      maxlength: 500,
    },
    
    // Status da análise
    status: {
      type: String,
      required: true,
      default: "pendente",
      enum: ["pendente", "analisando", "procedente", "improcedente", "resolvido"],
    },
    
    // Ação tomada (se houver)
    action: {
      type: String,
      required: false,
      enum: ["nenhuma", "advertencia", "remocao_conteudo", "banimento_usuario"],
    },
    
    // Notas do moderador (admin only)
    moderatorNotes: {
      type: String,
      required: false,
    },
    
    // Data de análise
    reviewedAt: {
      type: Date,
      required: false,
    },
    
    // IP do denunciante (segurança)
    ipAddress: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index para buscar denúncias por report
contentReportSchema.index({ reportId: 1, "reportedBy.userId": 1 });

// Index para buscar denúncias pendentes
contentReportSchema.index({ status: 1, createdAt: -1 });

const ContentReport = mongoose.model("ContentReport", contentReportSchema);

module.exports = ContentReport;

