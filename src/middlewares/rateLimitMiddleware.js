const rateLimit = require("express-rate-limit");

exports.rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP
  message: "Muitas requisições. Tente novamente mais tarde.",
});
