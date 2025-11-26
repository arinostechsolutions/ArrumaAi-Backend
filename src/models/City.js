const mongoose = require("mongoose");

const CitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    bairros: { type: [String], required: true },

    modules: {
      healthAppointments: {
        enabled: { type: Boolean, default: false },
        healthServices: [
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            address: { type: String, required: true },
            availableSpecialties: [
              {
                id: { type: String, required: true },
                label: { type: String, required: true },
                operatingHours: {
                  availableDays: [{ type: String, required: true }],
                  shifts: {
                    morning: { dailyLimit: { type: Number, default: 0 } },
                    afternoon: { dailyLimit: { type: Number, default: 0 } },
                  },
                },
              },
            ],
            availableExams: [
              {
                id: { type: String, required: true },
                label: { type: String, required: true },
                operatingHours: {
                  availableDays: [{ type: String, required: true }],
                  shifts: {
                    morning: { dailyLimit: { type: Number, default: 0 } },
                    afternoon: { dailyLimit: { type: Number, default: 0 } },
                  },
                },
              },
            ],
          },
        ],
      },

      iptu: {
        enabled: { type: Boolean, default: false },
        paymentURL: { type: String, required: false },
        queryMethods: [
          { type: String, enum: ["CPF", "CNPJ", "INSCRICAO"], required: true },
        ],
      },

      reports: {
        reportTypes: [
          {
            id: { type: String, required: true },
            label: { type: String, required: true },
            secretaria: { type: String, required: false }, // ID da secretaria responsável
            // Campos para tipos personalizados
            isCustom: { type: Boolean, default: false }, // Indica se é um tipo personalizado
            createdBy: {
              adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
              adminName: { type: String },
              role: { type: String, enum: ["super_admin", "mayor", "secretaria"], default: "mayor" },
            },
            allowedSecretarias: [{ type: String }], // IDs das secretarias que podem usar este tipo
            isActive: { type: Boolean, default: true }, // Para soft delete
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          },
        ],
        reportList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],
      },

      smartCity: {
        enabled: { type: Boolean, default: false },
        // Configuração de quais tipos de POIs mostrar
        poiTypes: {
          showStreetBlockades: { type: Boolean, default: true }, // Interdições de ruas
          showEvents: { type: Boolean, default: true }, // Eventos
          showHealthUnits: { type: Boolean, default: true }, // Unidades de saúde
          showCustomPOIs: { type: Boolean, default: true }, // POIs personalizados
          showEmergencyContacts: { type: Boolean, default: true }, // Telefones de emergência
        },
        // POIs personalizados (ponto de interesse)
        customPOIs: [
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            description: { type: String },
            type: { 
              type: String, 
              enum: ["hospital", "escola", "biblioteca", "parque", "praca", "outro"],
              required: true 
            },
            location: {
              lat: { type: Number, required: true },
              lng: { type: Number, required: true },
            },
            address: { type: String },
            phone: { type: String },
            email: { type: String },
            website: { type: String },
            iconName: { type: String, default: "location" }, // Nome do ícone
            iconColor: { type: String, default: "#007AFF" }, // Cor do ícone
            isActive: { type: Boolean, default: true },
            createdBy: {
              adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
              adminName: { type: String },
            },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          },
        ],
      },

      emergencies: {
        enabled: { type: Boolean, default: false },
      },
    },

    // 🏛️ Secretarias da cidade
    secretarias: [
      {
        id: { type: String, required: true }, // ex: "obras", "meio_ambiente"
        label: { type: String, required: true }, // ex: "Secretaria de Obras"
        reportTypes: [{ type: String }], // IDs dos reportTypes associados
        createdAt: { type: Date, default: Date.now },
      },
    ],

    users: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },

    menu: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          bgColor: { type: String, required: true },
          iconName: { type: String, required: true },
          description: { type: String, required: false, default: undefined },
        },
      ],
      default: [],
    },

    // 📱 Configurações Mobile
    mobileConfig: {
      showFeed: { type: Boolean, default: true },
      showMap: { type: Boolean, default: true },
      showHealthAppointments: { type: Boolean, default: false },
      showEvents: { type: Boolean, default: false },
      showSmartCity: { type: Boolean, default: false },
      showEmergencies: { type: Boolean, default: false },
      showNews: { type: Boolean, default: false },
    },
  },
  { timestamps: true, collection: "cities" }
);

module.exports = mongoose.model("City", CitySchema);
