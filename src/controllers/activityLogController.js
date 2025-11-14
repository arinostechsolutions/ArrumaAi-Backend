const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");
const mongoose = require("mongoose");

/**
 * GET /api/admin/activity-logs
 * Lista histórico de atividades (apenas super admin)
 */
exports.getActivityLogs = async (req, res) => {
  try {
    // Prefeitos também podem ver histórico (mas apenas da sua cidade)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem visualizar o histórico.",
      });
    }

    const {
      adminId,
      actionType,
      cityId,
      entityType,
      entityId,
      startDate,
      endDate,
      secretariaId,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtro
    const filter = {};

    // Prefeitos só podem ver histórico da sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId) {
        filter.cityId = mayorCityId;
      }
    } else if (cityId) {
      filter.cityId = cityId;
    }

    // Filtrar por secretaria se fornecido (para prefeitos)
    if (secretariaId && req.admin?.isMayor && !adminId) {
      // Buscar todos os admins que pertencem a essa secretaria
      const adminsWithSecretaria = await User.find({
        isAdmin: true,
        secretaria: secretariaId,
        adminCities: { $in: [filter.cityId] },
      }).select("_id").lean();
      
      const adminIds = adminsWithSecretaria.map((admin) => admin._id);
      if (adminIds.length > 0) {
        filter.adminId = { $in: adminIds };
      } else {
        // Se não houver admins com essa secretaria, retornar vazio
        filter.adminId = { $in: [] };
      }
    } else if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      filter.adminId = adminId;
    }

    if (actionType) {
      filter.actionType = actionType;
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    if (entityId) {
      filter.entityId = entityId;
    }

    // Filtro de data
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          start.setUTCHours(0, 0, 0, 0);
          filter.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setUTCHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await ActivityLog.countDocuments(filter);

    return res.status(200).json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + limitNum < total,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico de atividades:", error);
    return res.status(500).json({ message: "Erro interno ao buscar histórico." });
  }
};

/**
 * GET /api/admin/activity-logs/stats
 * Estatísticas do histórico (apenas super admin)
 */
exports.getActivityLogStats = async (req, res) => {
  try {
    // Prefeitos também podem ver estatísticas (mas apenas da sua cidade)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem visualizar estatísticas do histórico.",
      });
    }

    const { cityId, startDate, endDate } = req.query;

    const filter = {};

    // Prefeitos só podem ver estatísticas da sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId) {
        filter.cityId = mayorCityId;
      }
    } else if (cityId) {
      filter.cityId = cityId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          start.setUTCHours(0, 0, 0, 0);
          filter.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setUTCHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    const stats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$actionType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalLogs = await ActivityLog.countDocuments(filter);
    const uniqueAdmins = await ActivityLog.distinct("adminId", filter);

    return res.status(200).json({
      totalLogs,
      uniqueAdmins: uniqueAdmins.length,
      byActionType: stats,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas do histórico:", error);
    return res.status(500).json({ message: "Erro interno ao buscar estatísticas." });
  }
};

