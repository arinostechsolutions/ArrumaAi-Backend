const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    cpf: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    susCard: {
      type: String,
      sparse: true,
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
    },
    medicalAppointments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HealthAppointment",
      },
    ],
    examAppointments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HealthAppointment",
      },
    ],
    vaccines: [
      {
        vaccineName: { type: String, required: true },
        dateReceived: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
