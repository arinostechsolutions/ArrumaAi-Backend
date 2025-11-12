const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

/**
 * Middleware para verificar se o usuário é admin
 * Deve ser usado após algum tipo de autenticação (por enquanto, verificamos via userId no body/params)
 */
exports.isAdmin = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace(/Bearer\s+/i, "").trim();
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({
          message: "Token inválido ou expirado.",
        });
      }

      const user = await User.findById(decoded.userId);

      if (!user || !user.isAdmin) {
        return res.status(403).json({
          message: "Acesso negado. Usuário não é administrador.",
        });
      }

      const allowedCities = Array.isArray(user.adminCities)
        ? user.adminCities.filter((city) => typeof city === "string" && city.trim() !== "")
        : [];

      req.admin = {
        userId: user._id,
        name: user.name,
        cpf: user.cpf,
        allowedCities,
        isSuperAdmin: allowedCities.length === 0,
      };

      return next();
    }

    // Busca userId do header (preferencial), body, params ou query
    const userId =
      req.headers["x-admin-user-id"] ||
      req.body.adminUserId ||
      req.params.adminUserId ||
      req.query.adminUserId;

    if (!userId) {
      return res.status(401).json({
        message: "Acesso negado. ID de administrador não fornecido.",
      });
    }

    // Busca o usuário no banco
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    // Verifica se é admin
    if (!user.isAdmin) {
      console.log(`⚠️ Tentativa de acesso admin negada - User: ${userId}`);
      return res.status(403).json({
        message: "Acesso negado. Você não tem permissões de administrador.",
      });
    }

    const allowedCities = Array.isArray(user.adminCities)
      ? user.adminCities.filter((city) => typeof city === "string" && city.trim() !== "")
      : [];

    console.log(
      `✅ Acesso admin concedido - User: ${userId} (${user.name}) - Cidades: ${
        allowedCities.length > 0 ? allowedCities.join(", ") : "todas"
      }`,
    );
    
    // Adiciona informações do admin ao request para uso posterior
    req.admin = {
      userId: user._id,
      name: user.name,
      cpf: user.cpf,
      allowedCities,
      isSuperAdmin: allowedCities.length === 0,
    };

    next();
  } catch (error) {
    console.error("❌ Erro no middleware de admin:", error);
    return res.status(500).json({
      message: "Erro ao verificar permissões de administrador.",
    });
  }
};

