// src/models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    // Usuário que receberá a mensagem (obtido do report ou null para broadcast)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Agora opcional para notificações broadcast
      index: true,
    },

    // Cidade relacionada (para notificações broadcast)
    cityId: {
      type: String,
      required: false,
      index: true,
    },
    
    // Report relacionado à mensagem (opcional)
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: false, // Agora opcional
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
        required: false, // Opcional para notificações automáticas do sistema
      },
      adminName: {
        type: String,
        required: false,
        default: "Sistema",
      },
      secretaria: {
        type: String,
        required: false,
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
    
    // Tipo de notificação
    type: {
      type: String,
      enum: [
        "feedback",        // Feedback de report
        "atualizacao",     // Atualização de report
        "solicitacao",     // Solicitação
        "evento",          // Novo evento
        "interdicao",      // Nova interdição
        "obra_concluida",  // Obra concluída
        "noticia",         // Nova notícia
        "outro",           // Outro
      ],
      default: "feedback",
    },

    // Dados de navegação (para onde levar o usuário ao clicar)
    navigationData: {
      // Tipo de destino
      targetType: {
        type: String,
        enum: ["report", "event", "blockade", "news", "smart_city"],
        required: false,
      },
      // ID do item de destino
      targetId: {
        type: String,
        required: false,
      },
      // Coordenadas para centralizar mapa (se aplicável)
      coordinates: {
        lat: { type: Number, required: false },
        lng: { type: Number, required: false },
      },
    },

    // Se é uma notificação broadcast (para todos da cidade)
    isBroadcast: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Índices para consultas rápidas
MessageSchema.index({ userId: 1, createdAt: -1 });
MessageSchema.index({ cityId: 1, createdAt: -1 });
MessageSchema.index({ reportId: 1 });
MessageSchema.index({ status: 1, createdAt: -1 });
MessageSchema.index({ isBroadcast: 1, cityId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);





