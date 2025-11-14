const express = require("express");
const {
  createSecretaria,
  getSecretarias,
  updateSecretaria,
  deleteSecretaria,
  getReportTypes,
} = require("../controllers/secretariaController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Middleware para verificar se é super admin ou prefeito
const requireSuperAdmin = (req, res, next) => {
  // Prefeitos também têm acesso completo (mas apenas à sua cidade)
  if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
    return res.status(403).json({
      message: "Acesso negado. Apenas super administradores e prefeitos podem realizar esta ação.",
    });
  }
  next();
};

// Todas as rotas exigem autenticação de admin
router.use(isAdmin);
// Todas as rotas exigem ser super admin
router.use(requireSuperAdmin);

// Rotas de secretarias
router.post("/cities/:cityId/secretarias", createSecretaria);
router.get("/cities/:cityId/secretarias", getSecretarias);
router.put("/cities/:cityId/secretarias/:secretariaId", updateSecretaria);
router.delete("/cities/:cityId/secretarias/:secretariaId", deleteSecretaria);

// Rota para listar reportTypes disponíveis
router.get("/cities/:cityId/reportTypes", getReportTypes);

module.exports = router;

