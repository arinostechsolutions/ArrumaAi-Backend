// src/app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

const reportRoutes = require("./routes/reportRoutes");
const cityRoutes = require("./routes/cityRoutes");
const healthAppointmentRoutes = require("./routes/healthAppointmentRoutes");
const userRoutes = require("./routes/userRoutes");
const feedRoutes = require("./routes/feedRoutes");
const contentReportRoutes = require("./routes/contentReportRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Carrega o arquivo .env baseado no NODE_ENV
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

// Tenta carregar o arquivo específico do ambiente, se não existir, carrega o .env padrão
dotenv.config({ path: envPath });
if (!process.env.MONGO_URI) {
  console.log(`Arquivo ${envFile} não encontrado, carregando .env padrão`);
  dotenv.config();
}

console.log(`🚀 Ambiente: ${nodeEnv}`);
connectDB();

const app = express();

app.use(express.json({ limit: "10mb" }));

// Ativa o CORS
app.use(cors());

// Rotas
app.use("/api/reports", reportRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/health", healthAppointmentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/content-report", contentReportRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
