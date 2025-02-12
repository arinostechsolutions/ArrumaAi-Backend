const mongoose = require("mongoose");

const HealthAppointmentSchema = new mongoose.Schema(
  {
    city: {
      id: { type: String, required: true },
      label: { type: String, required: true },
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    unit: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    type: { type: String, enum: ["consulta", "exame"], required: true },
    specialty: { type: String, required: false },
    exam: { type: String, required: false },
    date: { type: Date, required: true },
    shift: { type: String, enum: ["morning", "afternoon"], required: true },
    status: {
      type: String,
      enum: ["pendente", "confirmado", "cancelado"],
      default: "pendente",
    },
  },
  { timestamps: true, collection: "healthAppointments" }
);

module.exports = mongoose.model("HealthAppointment", HealthAppointmentSchema);
