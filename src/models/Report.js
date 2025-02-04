// src/models/Report.js
const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    reportType: { type: String, required: true },
    address: { type: String, required: true },
    imageUrl: { type: String, required: true }, // Armazena a imagem como Base64
    referencia: { type: String, required: false },
    rua: { type: String, required: false },
    status: { type: String, required: true },
    city: {
      id: { type: String, required: true },
      label: { type: String, required: true },
    },
  },
  { timestamps: true, collection: "reports" }
);

module.exports = mongoose.model("Report", ReportSchema);
