// src/models/PositivePost.js
const mongoose = require("mongoose");

const PositivePostSchema = new mongoose.Schema(
  {
    // Título do post
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    
    // Descrição detalhada
    description: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    
    // Imagens do post (pode ter múltiplas)
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    
    // Data do evento/obra (quando aconteceu)
    eventDate: {
      type: Date,
      required: true,
    },
    
    // Localização
    location: {
      address: {
        type: String,
        required: true,
      },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: false,
        },
      },
      bairro: {
        type: String,
        required: false,
      },
      rua: {
        type: String,
        required: false,
      },
      referencia: {
        type: String,
        required: false,
      },
    },
    
    // Cidade associada
    city: {
      id: {
        type: String,
        required: true,
        index: true,
      },
      label: {
        type: String,
        required: true,
      },
    },
    
    // Categoria/tipo do post positivo
    category: {
      type: String,
      enum: [
        "obra_finalizada",
        "melhoria_urbana",
        "evento_cultural",
        "servico_publico",
        "infraestrutura",
        "outro",
      ],
      default: "outro",
      required: true,
    },
    
    // Admin que criou o post
    createdBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      adminName: {
        type: String,
        required: true,
      },
      secretaria: {
        type: String,
        required: false,
      },
    },
    
    // Status do post
    status: {
      type: String,
      enum: ["rascunho", "publicado", "arquivado"],
      default: "publicado",
      required: true,
      index: true,
    },
    
    // Métricas de engajamento (similar ao Report)
    likes: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    
    views: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
        duration: {
          type: Number,
          default: 0,
        },
      },
    ],
    
    shares: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    
    // Score de engajamento
    engagementScore: {
      type: Number,
      default: 0,
      index: true,
    },
    
    // Última atualização do score
    lastScoreUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Índices para consultas rápidas
PositivePostSchema.index({ "city.id": 1, status: 1, createdAt: -1 });
PositivePostSchema.index({ status: 1, createdAt: -1 });
PositivePostSchema.index({ category: 1, status: 1 });
PositivePostSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });
PositivePostSchema.index({ engagementScore: -1 });

const PositivePost = mongoose.model("PositivePost", PositivePostSchema);

// Remover índice antigo se existir (executa após conexão com MongoDB)
if (mongoose.connection.readyState === 1) {
  // Conectado, pode remover índice imediatamente
  PositivePost.collection.dropIndex("location_2dsphere").catch(() => {
    // Ignorar erro se índice não existir
  });
} else {
  // Aguardar conexão
  mongoose.connection.once("connected", () => {
    PositivePost.collection.dropIndex("location_2dsphere").catch(() => {
      // Ignorar erro se índice não existir
    });
  });
}

module.exports = PositivePost;

