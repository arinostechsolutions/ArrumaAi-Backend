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
    isMayor: {
      type: Boolean,
      required: true,
      default: false,
    },
    adminCities: {
      type: [String],
      default: [],
    },
    secretaria: {
      type: String,
      required: function () {
        // Obrigatório apenas para admins que não são super admin nem prefeito
        return (
          this.isAdmin &&
          !this.isMayor &&
          this.adminCities &&
          this.adminCities.length > 0
        );
      },
    },
    passwordHash: {
      type: String,
      required: false, // Opcional - usuários podem ter ou não senha
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
    // 📱 Campos para recuperação de senha mobile
    passwordResetCode: {
      code: {
        type: String,
        required: false,
      },
      expiresAt: {
        type: Date,
        required: false,
      },
    },
    // 📧 Verificação de email
    emailVerification: {
      code: {
        type: String,
        required: false,
      },
      newEmail: {
        type: String,
        required: false,
      },
      expiresAt: {
        type: Date,
        required: false,
      },
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    // 📱 Verificação de telefone
    phoneVerification: {
      code: {
        type: String,
        required: false,
      },
      newPhone: {
        type: String,
        required: false,
      },
      expiresAt: {
        type: Date,
        required: false,
      },
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
