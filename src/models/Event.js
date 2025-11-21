const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    city: {
      id: { type: String, required: true },
      label: { type: String, required: true },
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    images: [{ type: String }], // URLs das imagens
    address: {
      street: { type: String, required: false },
      number: { type: String, required: false },
      neighborhood: { type: String, required: false },
      city: { type: String, required: false },
      state: { type: String, required: false },
      zipCode: { type: String, required: false },
      coordinates: {
        latitude: { type: Number, required: false },
        longitude: { type: Number, required: false },
      },
    },
    sponsors: [
      {
        name: { type: String, required: true },
        logo: { type: String, required: false }, // URL do logo
      },
    ],
    schedule: [
      {
        date: { type: Date, required: true },
        title: { type: String, required: true },
        subtitle: { type: String, required: false },
      },
    ],
    isActive: { type: Boolean, default: true },
    createdBy: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      adminName: { type: String },
    },
  },
  { timestamps: true, collection: "events" }
);

module.exports = mongoose.model("Event", EventSchema);

