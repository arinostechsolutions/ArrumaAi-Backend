const { verifyToken } = require("../utils/jwt");

/**
 * Middleware de autenticação para rotas protegidas
 * Verifica o token JWT e adiciona os dados do usuário ao req.user
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Token não fornecido." });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2) {
      return res.status(401).json({ message: "Token mal formatado." });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return res.status(401).json({ message: "Token mal formatado." });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Token inválido ou expirado." });
    }

    // Adiciona os dados do usuário decodificados ao request
    req.user = decoded;

    return next();
  } catch (error) {
    console.error("❌ Erro no authMiddleware:", error);
    return res.status(401).json({ message: "Erro na autenticação." });
  }
};

module.exports = { authMiddleware };

