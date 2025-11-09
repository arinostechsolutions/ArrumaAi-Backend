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
    location: {
      type: {
        type: String,
        enum: ["Point"],
        // Não tem default - só será definido quando houver coordenadas válidas
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false,
        validate: {
          validator: function (value) {
            // Se não há valor, é válido (campo opcional)
            if (!value || value.length === 0) return true;
            // Se há valor, deve ter exatamente 2 elementos
            return value.length === 2;
          },
          message: "Coordenadas inválidas. Use [longitude, latitude].",
        },
      },
      accuracy: {
        type: Number,
      },
      collectedAt: {
        type: Date,
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

// Índice geoespacial apenas se location existir e tiver coordenadas válidas
ReportSchema.index({ location: "2dsphere" }, { sparse: true });

// Middleware pré-save: remove location se não tiver coordenadas válidas
ReportSchema.pre("save", function (next) {
  // Se location existe mas não tem coordenadas válidas, remove o campo
  if (this.location && (!this.location.coordinates || this.location.coordinates.length !== 2)) {
    this.location = undefined;
  }
  // Se location existe mas não tem type, define como "Point"
  if (this.location && this.location.coordinates && this.location.coordinates.length === 2 && !this.location.type) {
    this.location.type = "Point";
  }
  next();
});

module.exports = mongoose.model("Report", ReportSchema);
