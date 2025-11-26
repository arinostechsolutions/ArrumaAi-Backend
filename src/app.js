// src/app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const os = require("os");
const connectDB = require("./config/db");

const reportRoutes = require("./routes/reportRoutes");
const cityRoutes = require("./routes/cityRoutes");
const healthAppointmentRoutes = require("./routes/healthAppointmentRoutes");
const eventRoutes = require("./routes/eventRoutes");
const iptuRoutes = require("./routes/iptuRoutes");
const healthServiceRoutes = require("./routes/healthServiceRoutes");
const healthSpecialtyRoutes = require("./routes/healthSpecialtyRoutes");
const healthExamRoutes = require("./routes/healthExamRoutes");
const userRoutes = require("./routes/userRoutes");
const feedRoutes = require("./routes/feedRoutes");
const contentReportRoutes = require("./routes/contentReportRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminRoutes = require("./routes/adminRoutes");
const secretariaRoutes = require("./routes/secretariaRoutes");
const geocodingRoutes = require("./routes/geocodingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const mayorRoutes = require("./routes/mayorRoutes");
const messageRoutes = require("./routes/messageRoutes");
const positivePostRoutes = require("./routes/positivePostRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const streetBlockadeRoutes = require("./routes/streetBlockadeRoutes");
const smartCityRoutes = require("./routes/smartCityRoutes");
const emergencyContactRoutes = require("./routes/emergencyContactRoutes");
const newsRoutes = require("./routes/newsRoutes");

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

// Configuração do CORS para aceitar requisições de qualquer origem (desenvolvimento local)
// Para desenvolvimento local, permitimos todas as origens
app.use(
  cors({
    origin: true, // Permite todas as origens e define automaticamente o Access-Control-Allow-Origin
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Admin-Bootstrap-Token",
    ],
    credentials: true,
  })
);
app.options("*", cors());

// Middleware para log de requisições (útil para debug)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} - IP: ${req.ip || req.connection.remoteAddress}`);
  next();
});

// Rota de health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor está rodando",
    timestamp: new Date().toISOString(),
  });
});

// Rotas
app.use("/api/reports", reportRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/health", healthAppointmentRoutes);
app.use("/api/health/services", healthServiceRoutes);
app.use("/api/health/specialties", healthSpecialtyRoutes);
app.use("/api/health/exams", healthExamRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/iptu", iptuRoutes);
app.use("/api/user", userRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/content-report", contentReportRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", secretariaRoutes);
app.use("/api/mayor", mayorRoutes);
app.use("/api/geocoding", geocodingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/positive-posts", positivePostRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/street-blockades", streetBlockadeRoutes);
app.use("/api/smart-city", smartCityRoutes);
app.use("/api/emergency-contacts", emergencyContactRoutes);
app.use("/api/news", newsRoutes);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Função para obter o IP local da máquina
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignora endereços IPv6 e endereços internos não válidos
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

app.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`\n🚀 Servidor iniciado com sucesso!`);
  console.log(`📍 Acesse localmente: http://localhost:${PORT}`);
  console.log(`🌐 Acesse na rede local: http://${localIP}:${PORT}`);
  console.log(`📡 Servidor escutando em: ${HOST}:${PORT}\n`);
  console.log(`✅ Rotas disponíveis:`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /api/cities/getAllCities`);
  console.log(`   - GET  /api/cities/getCityById/:id`);
  console.log(`   - POST /api/cities/createCity`);
  console.log(`\n💡 Dicas para conexão na rede local:`);
  console.log(`   1. Certifique-se de que o firewall permite conexões na porta ${PORT}`);
  console.log(`   2. Use o IP mostrado acima no frontend: http://${localIP}:${PORT}`);
  console.log(`   3. Para Android Emulator, use: http://10.0.2.2:${PORT}`);
  console.log(`   4. Teste a conexão acessando: http://${localIP}:${PORT}/health\n`);
});
