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
    email: {
      type: String,
      required: false,
    },
    profileImage: {
      type: String,
      required: false,
      default: null,
    },
    susCard: {
      type: String,
      sparse: true,
    },
    address: {
      bairro: {
        type: String,
        required: true,
      },
      rua: {
        type: String,
        required: false,
      },
      numero: {
        type: String,
        required: false,
      },
      complemento: {
        type: String,
        required: false,
      },
    },
    lgpdConsent: {
      accepted: {
        type: Boolean,
        required: true,
        default: false,
      },
      acceptedAt: {
        type: Date,
      },
      ipAddress: {
        type: String,
      },
    },
    termsAccepted: {
      accepted: {
        type: Boolean,
        required: true,
        default: false,
      },
      acceptedAt: {
        type: Date,
      },
      ipAddress: {
        type: String,
      },
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
    // Posts ocultos pelo usuário (não aparecem no feed)
    hiddenPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Report",
      },
    ],
    // 🔐 Permissões de administrador
    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    adminCities: {
      type: [String],
      default: [],
    },
    passwordHash: {
      type: String,
      required: function () {
        return this.isAdmin;
      },
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
    adminInviteToken: {
      token: {
        type: String,
        required: false,
      },
      expiresAt: {
        type: Date,
        required: false,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
