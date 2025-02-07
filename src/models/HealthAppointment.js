const mongoose = require("mongoose");

const HealthAppointmentSchema = new mongoose.Schema(
  {
    city: {
      id: { type: String, required: true }, // Ex: "iguaba_grande"
      label: { type: String, required: true }, // Ex: "Iguaba Grande"
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Quem agendou
    unit: {
      id: { type: String, required: true }, // ID da unidade de saúde
      name: { type: String, required: true }, // Nome da unidade
    },
    type: { type: String, enum: ["consulta", "exame"], required: true }, // Tipo do agendamento
    specialty: { type: String, required: false }, // Ex: "Cardiologia" (para consultas)
    exam: { type: String, required: false }, // Ex: "Raio-X" (para exames)
    date: { type: Date, required: true }, // Data do agendamento
    status: {
      type: String,
      enum: ["pendente", "confirmado", "cancelado"],
      default: "pendente",
    }, // Status do agendamento
  },
  { timestamps: true, collection: "healthAppointments" }
);

module.exports = mongoose.model("HealthAppointment", HealthAppointmentSchema);
