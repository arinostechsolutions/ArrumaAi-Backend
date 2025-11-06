// src/models/Report.js
const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    reportType: { type: String, required: true },
    address: { type: String, required: true },
    imageUrl: { type: String, required: true },
    referencia: { type: String, required: false },
    rua: { type: String, required: false },
    bairro: { type: String, required: false },
    status: { type: String, required: true },
    city: {
      id: { type: String, required: true },
      label: { type: String, required: true },
    },
    user: {
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true 
      },
      name: { type: String, required: true },
      cpf: { type: String, required: true },
      phone: { type: String, required: false },
    },
    declarationAccepted: {
      accepted: {
        type: Boolean,
        required: true,
        default: false,
      },
      acceptedAt: {
        type: Date,
        required: true,
      },
      ipAddress: {
        type: String,
      },
    },
    // 🔥 MÉTRICAS DO FEED (Algoritmo estilo Instagram)
    likes: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true 
      },
      likedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    views: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true 
      },
      viewedAt: {
        type: Date,
        default: Date.now,
      },
      duration: {
        type: Number, // Tempo em segundos que o usuário ficou vendo
        default: 0,
      },
    }],
    shares: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true 
      },
      sharedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Score de engajamento (calculado pelo algoritmo)
    engagementScore: {
      type: Number,
      default: 0,
      index: true, // Index para queries rápidas
    },
    // Última vez que o score foi atualizado
    lastScoreUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: "reports" }
);

module.exports = mongoose.model("Report", ReportSchema);
