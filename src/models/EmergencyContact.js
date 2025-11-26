// src/models/EmergencyContact.js
const mongoose = require("mongoose");

const EmergencyContactSchema = new mongoose.Schema(
  {
    // Nome do serviço (ex: "Polícia Militar", "Bombeiros", "Disk Denúncia")
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    
    // Tipo/categoria do serviço
    type: {
      type: String,
      enum: [
        "policia",
        "bombeiro",
        "defesa_civil",
        "disk_denuncia",
        "violencia_mulher",
        "samu",
        "outro",
      ],
      required: true,
      default: "outro",
    },
    
    // Telefone principal (obrigatório)
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Telefone alternativo (opcional)
    alternativePhone: {
      type: String,
      required: false,
      trim: true,
    },
    
    // Descrição/informações adicionais
    description: {
      type: String,
      required: false,
      maxlength: 1000,
      trim: true,
    },
    
    // Localização (opcional)
    location: {
      address: {
        type: String,
        required: false,
        trim: true,
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
    
    // Admin que criou o contato
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
    
    // Status (ativo/inativo)
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Ordem de exibição (para ordenar na lista)
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, collection: "emergencycontacts" }
);

// Índices para consultas rápidas
EmergencyContactSchema.index({ "city.id": 1, isActive: 1, displayOrder: 1 });
EmergencyContactSchema.index({ type: 1, isActive: 1 });
EmergencyContactSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });

const EmergencyContact = mongoose.model("EmergencyContact", EmergencyContactSchema);

module.exports = EmergencyContact;


