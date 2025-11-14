const Observation = require("../models/Observation");
const City = require("../models/City");
const { logActivity } = require("../utils/activityLogger");

/**
 * POST /api/admin/observations
 * Prefeito cria uma observação para uma secretaria
 */
exports.createObservation = async (req, res) => {
  try {
    const admin = req.admin;

    // Apenas prefeitos podem criar observações
    if (!admin.isMayor || admin.isSuperAdmin) {
      return res.status(403).json({
        message: "Apenas prefeitos podem criar observações para secretarias.",
      });
    }

    const { secretariaId, message } = req.body;

    if (!secretariaId || !message || !message.trim()) {
      return res.status(400).json({
        message: "secretariaId e message são obrigatórios.",
      });
    }

    const cityId = admin.allowedCities?.[0];
    if (!cityId) {
      return res.status(400).json({
        message: "Prefeito deve estar associado a uma cidade.",
      });
    }

    // Verificar se a secretaria existe na cidade
    const city = await City.findOne({ id: cityId }).select("secretarias");
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const secretaria = city.secretarias?.find((s) => s.id === secretariaId);
    if (!secretaria) {
      return res.status(404).json({ message: "Secretaria não encontrada." });
    }

    const observation = await Observation.create({
      cityId,
      secretariaId,
      secretariaLabel: secretaria.label,
      mayorId: admin.userId,
      mayorName: admin.name,
      message: message.trim(),
    });

    // Registrar atividade
    await logActivity({
      admin,
      actionType: "content_report_resolve", // Usando tipo existente, pode criar um novo depois
      description: `Observação enviada para secretaria "${secretaria.label}"`,
      details: {
        secretariaId,
        secretariaLabel: secretaria.label,
        observationId: observation._id,
      },
      entityType: "secretaria",
      entityId: secretariaId,
      cityId,
      req,
    });

    res.status(201).json({
      message: "Observação criada com sucesso!",
      observation,
    });
  } catch (error) {
    console.error("❌ Erro ao criar observação:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/observations
 * Lista observações (prefeito vê todas que enviou, secretaria vê as recebidas)
 */
exports.getObservations = async (req, res) => {
  try {
    const admin = req.admin;
    const { secretariaId, read } = req.query;

    const cityId = admin.allowedCities?.[0];

    let query = {};

    if (admin.isMayor && !admin.isSuperAdmin) {
      // Prefeito vê todas as observações que ele criou
      query.mayorId = admin.userId;
      if (secretariaId) {
        query.secretariaId = secretariaId;
      }
    } else if (admin.secretaria) {
      // Secretaria vê apenas as observações destinadas a ela
      // Garantir que o secretariaId seja uma string e corresponda exatamente
      const adminSecretariaId = String(admin.secretaria).trim();
      query.secretariaId = adminSecretariaId;
      if (cityId) {
        query.cityId = String(cityId).trim();
      }
      console.log(`🔍 [Observations] Secretaria filtro - admin.secretaria: ${adminSecretariaId}, cityId: ${cityId}`);
    } else {
      return res.status(403).json({
        message: "Apenas prefeitos e secretarias podem visualizar observações.",
      });
    }

    if (read !== undefined) {
      query.read = read === "true";
    }

    console.log(`🔍 [Observations] Query executada:`, JSON.stringify(query, null, 2));
    
    const observations = await Observation.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📊 [Observations] Total encontrado: ${observations.length} observações`);

    res.status(200).json({
      observations,
      total: observations.length,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar observações:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PUT /api/admin/observations/:observationId/read
 * Marca uma observação como lida (para secretarias)
 */
exports.markAsRead = async (req, res) => {
  try {
    const admin = req.admin;
    const { observationId } = req.params;

    if (!admin.secretaria) {
      return res.status(403).json({
        message: "Apenas secretarias podem marcar observações como lidas.",
      });
    }

    const observation = await Observation.findById(observationId);
    if (!observation) {
      return res.status(404).json({ message: "Observação não encontrada." });
    }

    // Verificar se a observação é para esta secretaria
    if (observation.secretariaId !== admin.secretaria) {
      return res.status(403).json({
        message: "Você não tem permissão para marcar esta observação como lida.",
      });
    }

    observation.read = true;
    observation.readAt = new Date();
    await observation.save();

    res.status(200).json({
      message: "Observação marcada como lida.",
      observation,
    });
  } catch (error) {
    console.error("❌ Erro ao marcar observação como lida:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

