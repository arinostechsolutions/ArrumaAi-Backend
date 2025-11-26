const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema(
  {
    cityId: { type: String, required: true, ref: "City" },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    summary: { type: String, required: false }, // Resumo curto da notícia
    imageUrl: { type: String, required: false },
    status: {
      type: String,
      enum: ["rascunho", "publicado", "arquivado"],
      default: "rascunho",
      required: true,
    },
    publishedAt: { type: Date, required: false }, // Data de publicação
    category: {
      type: String,
      enum: ["geral", "saude", "educacao", "infraestrutura", "eventos", "servicos", "outro"],
      default: "geral",
    },
    tags: [{ type: String }], // Tags para categorização
    views: { type: Number, default: 0 }, // Contador de visualizações
    isHighlighted: { type: Boolean, default: false }, // Destaque na lista
    createdBy: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      adminName: { type: String, required: true },
      role: { type: String, enum: ["super_admin", "mayor", "secretaria"], default: "mayor" },
    },
  },
  { timestamps: true, collection: "news" }
);

// Index para buscas rápidas
NewsSchema.index({ cityId: 1, status: 1 });
NewsSchema.index({ cityId: 1, publishedAt: -1 });
NewsSchema.index({ cityId: 1, isHighlighted: 1, publishedAt: -1 });
NewsSchema.index({ title: "text", content: "text" }); // Busca de texto

module.exports = mongoose.model("News", NewsSchema);


