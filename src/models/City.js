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
    },
  },
  { timestamps: true, collection: "cities" }
);

module.exports = mongoose.model("City", CitySchema);
