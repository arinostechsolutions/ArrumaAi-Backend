const mongoose = require("mongoose");

const CitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    bairros: { type: [String], required: true },

    modules: {
      healthAppointments: {
        healthServices: [
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            address: { type: String, required: true },
            availableSpecialties: [
              {
                id: { type: String, required: true },
                label: { type: String, required: true },
              },
            ],
            availableExams: [
              {
                id: { type: String, required: true },
                label: { type: String, required: true },
              },
            ],
          },
        ],
      },

      iptu: {
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
          },
        ],
        reportList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],
      },
    },

    users: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },

    menu: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        bgColor: { type: String, required: true },
        iconName: { type: String, required: true },
      },
    ],
  },
  { timestamps: true, collection: "cities" }
);

module.exports = mongoose.model("City", CitySchema);
