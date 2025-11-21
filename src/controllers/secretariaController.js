const mongoose = require("mongoose");
const City = require("../models/City");
const User = require("../models/User");

/**
 * Middleware para verificar se é super admin
 */
const requireSuperAdmin = (req, res, next) => {
  // Prefeitos também têm acesso completo (mas apenas à sua cidade)
  if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
    return res.status(403).json({
      message: "Acesso negado. Apenas super administradores e prefeitos podem realizar esta ação.",
    });
  }
  next();
};

/**
 * POST /api/admin/cities/:cityId/secretarias
 * Criar uma nova secretaria para uma cidade
 */
exports.createSecretaria = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { id, label, reportTypes = [] } = req.body;

    if (!id || !label) {
      return res.status(400).json({
        message: "Campos obrigatórios: id e label.",
      });
    }

    // Validar formato do ID (deve ser slug válido)
    const idRegex = /^[a-z0-9_-]+$/;
    if (!idRegex.test(id)) {
      return res.status(400).json({
        message: "ID da secretaria deve conter apenas letras minúsculas, números, traços e underscore.",
      });
    }

    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Prefeitos só podem criar secretarias na sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId && cityId !== mayorCityId) {
        return res.status(403).json({
          message: "Você só pode criar secretarias na sua cidade.",
        });
      }
    }

    // Verificar se já existe secretaria com mesmo ID
    const existingSecretaria = city.secretarias?.find((s) => s.id === id);
    if (existingSecretaria) {
      return res.status(409).json({
        message: "Já existe uma secretaria com este ID nesta cidade.",
      });
    }

    // Validar reportTypes (devem existir na cidade)
    if (reportTypes.length > 0) {
      const validReportTypes = city.modules?.reports?.reportTypes || [];
      const validIds = validReportTypes.map((rt) => rt.id);
      const invalidIds = reportTypes.filter((rtId) => !validIds.includes(rtId));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `Tipos de report inválidos: ${invalidIds.join(", ")}`,
        });
      }
    }

    // Adicionar secretaria
    if (!city.secretarias) {
      city.secretarias = [];
    }

    city.secretarias.push({
      id,
      label,
      reportTypes: Array.isArray(reportTypes) ? reportTypes : [],
      createdAt: new Date(),
    });

    // Atualizar reportTypes para associar à secretaria
    if (reportTypes.length > 0 && city.modules?.reports?.reportTypes) {
      city.modules.reports.reportTypes.forEach((rt) => {
        if (reportTypes.includes(rt.id)) {
          rt.secretaria = id;
        }
      });
    }

    await city.save();

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "secretaria_create",
        description: `Secretaria "${label}" criada`,
        details: {
          secretariaId: id,
          secretariaLabel: label,
          reportTypes,
        },
        entityType: "secretaria",
        entityId: id,
        cityId,
        req,
      });
    }

    return res.status(201).json({
      message: "Secretaria criada com sucesso.",
      secretaria: {
        id,
        label,
        reportTypes,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao criar secretaria:", error);
    return res.status(500).json({ message: "Erro interno ao criar secretaria." });
  }
};

/**
 * GET /api/admin/cities/:cityId/secretarias
 * Listar todas as secretarias de uma cidade
 */
exports.getSecretarias = async (req, res) => {
  try {
    const { cityId } = req.params;

    const city = await City.findOne({ id: cityId }).select("secretarias modules.reports.reportTypes");
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const secretarias = (city.secretarias || []).map((secretaria) => {
      // Contar quantos admins existem para esta secretaria
      return {
        id: secretaria.id,
        label: secretaria.label,
        reportTypes: secretaria.reportTypes || [],
        createdAt: secretaria.createdAt,
      };
    });

    // Buscar contagem de admins por secretaria
    const secretariasWithCounts = await Promise.all(
      secretarias.map(async (secretaria) => {
        const adminCount = await User.countDocuments({
          isAdmin: true,
          secretaria: secretaria.id,
          adminCities: { $in: [cityId] },
        });

        return {
          ...secretaria,
          adminCount,
        };
      })
    );

    return res.status(200).json({
      cityId,
      secretarias: secretariasWithCounts,
    });
  } catch (error) {
    console.error("❌ Erro ao listar secretarias:", error);
    return res.status(500).json({ message: "Erro interno ao listar secretarias." });
  }
};

/**
 * PUT /api/admin/cities/:cityId/secretarias/:secretariaId
 * Atualizar uma secretaria
 */
exports.updateSecretaria = async (req, res) => {
  try {
    const { cityId, secretariaId } = req.params;
    const { label, reportTypes } = req.body;

    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Prefeitos só podem editar secretarias da sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId && cityId !== mayorCityId) {
        return res.status(403).json({
          message: "Você só pode editar secretarias da sua cidade.",
        });
      }
    }

    const secretariaIndex = city.secretarias?.findIndex((s) => s.id === secretariaId);
    if (secretariaIndex === -1 || secretariaIndex === undefined) {
      return res.status(404).json({ message: "Secretaria não encontrada." });
    }

    // Validar reportTypes se fornecidos
    if (reportTypes !== undefined) {
      const validReportTypes = city.modules?.reports?.reportTypes || [];
      const validIds = validReportTypes.map((rt) => rt.id);
      const invalidIds = reportTypes.filter((rtId) => !validIds.includes(rtId));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `Tipos de report inválidos: ${invalidIds.join(", ")}`,
        });
      }

      // Remover associação antiga dos reportTypes
      const oldReportTypes = city.secretarias[secretariaIndex].reportTypes || [];
      if (city.modules?.reports?.reportTypes) {
        city.modules.reports.reportTypes.forEach((rt) => {
          if (oldReportTypes.includes(rt.id)) {
            rt.secretaria = undefined;
          }
        });
      }

      // Atualizar secretaria
      if (label) {
        city.secretarias[secretariaIndex].label = label;
      }
      city.secretarias[secretariaIndex].reportTypes = Array.isArray(reportTypes) ? reportTypes : [];

      // Associar novos reportTypes à secretaria
      if (city.modules?.reports?.reportTypes) {
        city.modules.reports.reportTypes.forEach((rt) => {
          if (reportTypes.includes(rt.id)) {
            rt.secretaria = secretariaId;
          }
        });
      }
    } else if (label) {
      city.secretarias[secretariaIndex].label = label;
    }

    await city.save();

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "secretaria_update",
        description: `Secretaria "${city.secretarias[secretariaIndex].label}" atualizada`,
        details: {
          secretariaId,
          secretariaLabel: city.secretarias[secretariaIndex].label,
          reportTypes: city.secretarias[secretariaIndex].reportTypes,
          labelChanged: Boolean(label),
        },
        entityType: "secretaria",
        entityId: secretariaId,
        cityId,
        req,
      });
    }

    return res.status(200).json({
      message: "Secretaria atualizada com sucesso.",
      secretaria: city.secretarias[secretariaIndex],
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar secretaria:", error);
    return res.status(500).json({ message: "Erro interno ao atualizar secretaria." });
  }
};

/**
 * DELETE /api/admin/cities/:cityId/secretarias/:secretariaId
 * Deletar uma secretaria
 */
exports.deleteSecretaria = async (req, res) => {
  try {
    const { cityId, secretariaId } = req.params;

    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Prefeitos só podem deletar secretarias da sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId && cityId !== mayorCityId) {
        return res.status(403).json({
          message: "Você só pode deletar secretarias da sua cidade.",
        });
      }
    }

    const secretariaIndex = city.secretarias?.findIndex((s) => s.id === secretariaId);
    if (secretariaIndex === -1 || secretariaIndex === undefined) {
      return res.status(404).json({ message: "Secretaria não encontrada." });
    }

    // Verificar se há admins associados a esta secretaria
    const adminCount = await User.countDocuments({
      isAdmin: true,
      secretaria: secretariaId,
      adminCities: { $in: [cityId] },
    });

    if (adminCount > 0) {
      return res.status(400).json({
        message: `Não é possível deletar a secretaria. Existem ${adminCount} administrador(es) associado(s) a ela.`,
      });
    }

    // Remover associação dos reportTypes
    const reportTypes = city.secretarias[secretariaIndex].reportTypes || [];
    if (city.modules?.reports?.reportTypes) {
      city.modules.reports.reportTypes.forEach((rt) => {
        if (reportTypes.includes(rt.id)) {
          rt.secretaria = undefined;
        }
      });
    }

    // Remover secretaria
    const deletedSecretariaLabel = city.secretarias[secretariaIndex].label;
    city.secretarias.splice(secretariaIndex, 1);
    await city.save();

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "secretaria_delete",
        description: `Secretaria "${deletedSecretariaLabel}" deletada`,
        details: {
          secretariaId,
          secretariaLabel: deletedSecretariaLabel,
        },
        entityType: "secretaria",
        entityId: secretariaId,
        cityId,
        req,
      });
    }

    return res.status(200).json({
      message: "Secretaria deletada com sucesso.",
    });
  } catch (error) {
    console.error("❌ Erro ao deletar secretaria:", error);
    return res.status(500).json({ message: "Erro interno ao deletar secretaria." });
  }
};

/**
 * GET /api/admin/cities/:cityId/reportTypes
 * Listar reportTypes disponíveis da cidade (para associar a secretarias)
 */
exports.getReportTypes = async (req, res) => {
  try {
    const { cityId } = req.params;

    const city = await City.findOne({ id: cityId }).select("modules.reports.reportTypes secretarias");
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const reportTypes = (city.modules?.reports?.reportTypes || []).map((rt) => ({
      id: rt.id,
      label: rt.label,
      secretaria: rt.secretaria || null,
    }));

    return res.status(200).json({
      cityId,
      reportTypes,
    });
  } catch (error) {
    console.error("❌ Erro ao listar reportTypes:", error);
    return res.status(500).json({ message: "Erro interno ao listar tipos de report." });
  }
};

