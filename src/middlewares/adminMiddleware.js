const User = require("../models/User");

/**
 * Middleware para verificar se o usuário é admin
 * Deve ser usado após algum tipo de autenticação (por enquanto, verificamos via userId no body/params)
 */
exports.isAdmin = async (req, res, next) => {
  try {
    // Busca userId do body, params ou query (dependendo da requisição)
    const userId = req.body.adminUserId || req.params.adminUserId || req.query.adminUserId;

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

    console.log(`✅ Acesso admin concedido - User: ${userId} (${user.name})`);
    
    // Adiciona informações do admin ao request para uso posterior
    req.admin = {
      userId: user._id,
      name: user.name,
      cpf: user.cpf,
    };

    next();
  } catch (error) {
    console.error("❌ Erro no middleware de admin:", error);
    return res.status(500).json({
      message: "Erro ao verificar permissões de administrador.",
    });
  }
};

