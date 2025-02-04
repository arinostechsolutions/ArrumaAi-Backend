const mongoose = require("mongoose");

const CitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // Ex: "iguaba_grande"
    label: { type: String, required: true }, // Ex: "Iguaba Grande"
    bairros: { type: [String], required: true }, // Lista de bairros
    reportTypes: [
      {
        id: { type: String, required: true }, // Ex: "esgoto_vazando"
        label: { type: String, required: true }, // Ex: "Esgoto vazando"
      },
    ],
    users: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] }, // Lista de usuários (caso necessário no futuro)
  },
  { timestamps: true, collection: "cities" }
);

module.exports = mongoose.model("City", CitySchema);
