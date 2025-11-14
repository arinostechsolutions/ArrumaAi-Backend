const mongoose = require("mongoose");

const ObservationSchema = new mongoose.Schema(
  {
    cityId: {
      type: String,
      required: true,
    },
    secretariaId: {
      type: String,
      required: true,
    },
    secretariaLabel: {
      type: String,
      required: true,
    },
    mayorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mayorName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

ObservationSchema.index({ cityId: 1, secretariaId: 1, createdAt: -1 });
ObservationSchema.index({ mayorId: 1, createdAt: -1 });

module.exports = mongoose.model("Observation", ObservationSchema);

