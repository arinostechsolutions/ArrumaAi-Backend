// src/app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const reportRoutes = require("./routes/reportRoutes");
const cityRoutes = require("./routes/cityRoutes");

dotenv.config();
connectDB();

const app = express();

app.use(express.json({ limit: "10mb" }));

// Ativa o CORS
app.use(cors());

// Rotas
app.use("/api/reports", reportRoutes);
app.use("/api/cities", cityRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
