// src/models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    // Usuário que receberá a mensagem (obtido do report)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    // Report relacionado à mensagem
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
      index: true,
    },
    
    // Título da mensagem
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    
    // Conteúdo da mensagem
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    
    // Admin que enviou a mensagem
    sentBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      adminName: {
        type: String,
        required: true,
      },
    },
    
    // Status da mensagem
    status: {
      type: String,
      enum: ["não_lida", "lida"],
      default: "não_lida",
      required: true,
    },
    
    // Data em que a mensagem foi lida (opcional)
    readAt: {
      type: Date,
      required: false,
    },
    
    // Tipo de mensagem (para categorização futura)
    type: {
      type: String,
      enum: ["feedback", "atualizacao", "solicitacao", "outro"],
      default: "feedback",
    },
  },
  { timestamps: true }
);

// Índices para consultas rápidas
MessageSchema.index({ userId: 1, createdAt: -1 });
MessageSchema.index({ reportId: 1 });
MessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);


