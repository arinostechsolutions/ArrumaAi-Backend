// src/app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const reportRoutes = require("./routes/reportRoutes");
const cityRoutes = require("./routes/cityRoutes");
const healthAppointmentRoutes = require("./routes/healthAppointmentRoutes");
const userRoutes = require("./routes/userRoutes");

dotenv.config();
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
