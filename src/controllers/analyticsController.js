const mongoose = require("mongoose");
const Report = require("../models/Report");
const City = require("../models/City");

// Helper functions do dashboardController
function resolveDateRange(startDate, endDate) {
  const range = {};

  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      start.setUTCHours(0, 0, 0, 0);
      range.start = start;
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setUTCHours(23, 59, 59, 999);
      range.end = end;
    }
  }

  return range;
}

function buildMatch(cityId, range = {}, allowedReportTypes = null, bairro = null, reportType = null) {
  const match = { "city.id": cityId };

  // Filtro por bairro específico
  if (bairro) {
    match.bairro = bairro;
  }

  // Filtro por tipo de sugestão de melhoria específico
  // Se houver um tipo específico, usar ele
  // Caso contrário, usar allowedReportTypes se disponível
  if (reportType) {
    match.reportType = reportType;
  } else if (Array.isArray(allowedReportTypes)) {
    if (allowedReportTypes.length === 0) {
      // Array vazio: não mostrar nada (filtrar por um ID que não existe)
      match.reportType = { $in: ["__NO_REPORTS__"] };
    } else {
      // Array com tipos: filtrar por esses tipos
      match.reportType = { $in: allowedReportTypes };
    }
  } else if (allowedReportTypes && allowedReportTypes.length > 0) {
    // Fallback para compatibilidade (caso não seja array)
    match.reportType = { $in: allowedReportTypes };
  }

  if (range && typeof range === 'object' && (range.start || range.end)) {
    match.createdAt = {};
    if (range.start) {
      match.createdAt.$gte = range.start;
    }
    if (range.end) {
      match.createdAt.$lte = range.end;
    }
  }

  return match;
}

async function getAllowedReportTypes(cityId, admin, secretariaId = null) {
  if (admin.isSuperAdmin) {
    return null; // Sem filtro para super admin
  }

  if (admin.isMayor) {
    // Prefeito pode filtrar por secretaria se especificado
    if (secretariaId) {
      const City = require("../models/City");
      const city = await City.findOne({ id: cityId }).select("secretarias modules.reports.reportTypes");
      if (!city) {
        return null;
      }

      const secretaria = city.secretarias?.find((s) => s.id === secretariaId);
      if (!secretaria) {
        return null;
      }

      // Buscar todos os reportTypes da cidade
      const allReportTypes = city.modules?.reports?.reportTypes || [];
      
      // Coletar IDs de reportTypes associados à secretaria de três formas:
      // 1. Tipos diretamente associados na secretaria (campo reportTypes da secretaria)
      // 2. Tipos que têm a secretaria em allowedSecretarias
      // 3. Tipos que têm o campo secretaria igual ao secretariaId (tipos padrão associados)
      const associatedTypeIds = new Set();
      
      // Adicionar tipos diretamente associados
      if (secretaria.reportTypes && Array.isArray(secretaria.reportTypes)) {
        secretaria.reportTypes.forEach(typeId => {
          if (typeId && typeof typeId === 'string') {
            associatedTypeIds.add(typeId);
          }
        });
      }
      
      // Adicionar tipos que têm a secretaria em allowedSecretarias OU campo secretaria igual ao secretariaId
      // Usar a mesma lógica que é usada para secretários: incluir tipos padrão e tipos personalizados associados
      allReportTypes.forEach(type => {
        // Apenas tipos ativos
        if (type.isActive === false) return;
        
        const isCustom = type.isCustom === true;
        const isStandard = !type.isCustom || type.isCustom === false;
        
        // Tipos padrão sempre permitidos (mesma lógica para secretários)
        if (isStandard) {
          associatedTypeIds.add(type.id);
          return;
        }
        
        // Tipos personalizados: verificar se está em allowedSecretarias
        if (isCustom) {
          if (type.allowedSecretarias && Array.isArray(type.allowedSecretarias)) {
            if (type.allowedSecretarias.includes(secretariaId)) {
              associatedTypeIds.add(type.id);
            }
          }
        }
        
        // Verificar se o campo secretaria do tipo é igual ao secretariaId (para tipos padrão)
        if (type.secretaria && type.secretaria === secretariaId) {
          associatedTypeIds.add(type.id);
        }
      });
      
      const result = Array.from(associatedTypeIds);
      
      // Se não há tipos associados, retornar array vazio para não mostrar nada
      // Quando um prefeito seleciona uma secretaria, devemos mostrar apenas os dados dessa secretaria
      if (result.length === 0) {
        return [];
      }
      
      return result;
    }
    return null; // Sem filtro se não especificar secretaria
  }

  // Admin de secretaria: filtrar apenas pelos reportTypes que criou OU que estão em allowedSecretarias
  if (admin.secretaria) {
    const City = require("../models/City");
    const city = await City.findOne({ id: cityId });
    if (!city) return null;

    const secretariaId = admin.secretaria?.id || admin.secretaria;
    const allReportTypes = city.modules?.reports?.reportTypes || [];
    
    // Filtrar tipos que a secretaria criou OU que estão em allowedSecretarias
    const allowedTypes = allReportTypes
      .filter((type) => {
        // Apenas tipos ativos
        if (type.isActive === false) return false;
        
        // Tipos padrão sempre permitidos
        if (!type.isCustom || type.isCustom === false) return true;
        
        // Tipos personalizados: verificar se criou ou se está em allowedSecretarias
        if (type.isCustom === true) {
          // Se criou, pode ver
          if (type.createdBy?.adminId?.toString() === admin.userId?.toString()) {
            return true;
          }
          // Se está em allowedSecretarias, pode ver
          if (type.allowedSecretarias?.includes(secretariaId)) {
            return true;
          }
        }
        return false;
      })
      .map((type) => type.id);

    if (allowedTypes.length === 0) {
      return null;
    }

    return allowedTypes;
  }

  return null;
}

async function resolveCityContext(req, res) {
  const admin = req.admin;

  if (!admin) {
    res.status(401).json({ message: "Contexto de administrador não encontrado." });
    return null;
  }

  const requestedCityId = req.query.cityId;

  if (requestedCityId) {
    // Prefeitos só podem acessar sua cidade
    if (admin.isMayor && !admin.isSuperAdmin) {
      const mayorCityId = admin.allowedCities?.[0];
      if (mayorCityId && requestedCityId !== mayorCityId) {
        res.status(403).json({
          message: "Você só pode acessar os dados da sua cidade.",
        });
        return null;
      }
      return mayorCityId || requestedCityId;
    }
    
    if (!admin.isSuperAdmin && !admin.isMayor && !admin.allowedCities.includes(requestedCityId)) {
      res.status(403).json({
        message: "Você não tem permissão para acessar os dados deste município.",
      });
      return null;
    }
    return requestedCityId;
  }

  // Prefeitos sempre usam sua cidade
  if (admin.isMayor && !admin.isSuperAdmin) {
    const mayorCityId = admin.allowedCities?.[0];
    if (mayorCityId) {
      return mayorCityId;
    }
  }

  if (admin.isSuperAdmin) {
    res.status(400).json({
      message: "cityId é obrigatório para administradores globais.",
    });
    return null;
  }

  if (admin.allowedCities.length === 1) {
    return admin.allowedCities[0];
  }

  res.status(400).json({
    message: "Informe o cityId desejado.",
    allowedCities: admin.allowedCities,
  });
  return null;
}

/**
 * GET /api/dashboard/analytics/by-neighborhood
 * Retorna sugestões de melhorias agrupadas por bairro
 */
exports.getByNeighborhood = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { secretariaId, startDate, endDate } = req.query;

    const range = resolveDateRange(startDate, endDate);
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    const match = buildMatch(cityId, range, allowedReportTypes);

    const results = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$bairro",
          total: { $sum: 1 },
          pendente: {
            $sum: { $cond: [{ $eq: ["$status", "pendente"] }, 1, 0] },
          },
          em_andamento: {
            $sum: { $cond: [{ $eq: ["$status", "em_andamento"] }, 1, 0] },
          },
          resolvido: {
            $sum: { $cond: [{ $eq: ["$status", "resolvido"] }, 1, 0] },
          },
          totalLikes: {
            $sum: { $size: { $ifNull: ["$likes", []] } },
          },
          totalViews: {
            $sum: { $size: { $ifNull: ["$views", []] } },
          },
          totalShares: {
            $sum: { $size: { $ifNull: ["$shares", []] } },
          },
        },
      },
      {
        $project: {
          bairro: { $ifNull: ["$_id", "Não informado"] },
          total: 1,
          pendente: 1,
          em_andamento: 1,
          resolvido: 1,
          totalLikes: 1,
          totalViews: 1,
          totalShares: 1,
          engagementScore: {
            $add: [
              { $multiply: ["$totalLikes", 3] },
              { $multiply: ["$totalViews", 1] },
              { $multiply: ["$totalShares", 5] },
            ],
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]);

    res.status(200).json({ results });
  } catch (error) {
    console.error("❌ Erro ao obter dados por bairro:", error);
    res.status(500).json({ message: "Erro interno ao obter dados por bairro." });
  }
};

/**
 * GET /api/dashboard/analytics/by-type
 * Retorna sugestões de melhorias agrupadas por tipo
 */
exports.getByType = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { secretariaId, startDate, endDate } = req.query;

    const range = resolveDateRange(startDate, endDate);
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    const match = buildMatch(cityId, range, allowedReportTypes);

    const results = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$reportType",
          total: { $sum: 1 },
          pendente: {
            $sum: { $cond: [{ $eq: ["$status", "pendente"] }, 1, 0] },
          },
          em_andamento: {
            $sum: { $cond: [{ $eq: ["$status", "em_andamento"] }, 1, 0] },
          },
          resolvido: {
            $sum: { $cond: [{ $eq: ["$status", "resolvido"] }, 1, 0] },
          },
          totalLikes: {
            $sum: { $size: { $ifNull: ["$likes", []] } },
          },
          totalViews: {
            $sum: { $size: { $ifNull: ["$views", []] } },
          },
          totalShares: {
            $sum: { $size: { $ifNull: ["$shares", []] } },
          },
        },
      },
      {
        $project: {
          reportType: "$_id",
          total: 1,
          pendente: 1,
          em_andamento: 1,
          resolvido: 1,
          totalLikes: 1,
          totalViews: 1,
          totalShares: 1,
          engagementScore: {
            $add: [
              { $multiply: ["$totalLikes", 3] },
              { $multiply: ["$totalViews", 1] },
              { $multiply: ["$totalShares", 5] },
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.status(200).json({ results });
  } catch (error) {
    console.error("❌ Erro ao obter dados por tipo:", error);
    res.status(500).json({ message: "Erro interno ao obter dados por tipo." });
  }
};

/**
 * GET /api/dashboard/analytics/trends
 * Retorna tendências temporais (por dia, semana, mês)
 */
exports.getTrends = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { secretariaId, startDate, endDate, groupBy = "day", bairro, reportType } = req.query;

    const range = resolveDateRange(startDate, endDate);
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    const match = buildMatch(cityId, range, allowedReportTypes, bairro, reportType);

    let dateFormat;
    let dateGroup;

    switch (groupBy) {
      case "week":
        dateFormat = {
          $dateToString: {
            format: "%Y-W%V",
            date: "$createdAt",
          },
        };
        dateGroup = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        break;
      case "month":
        dateFormat = {
          $dateToString: {
            format: "%Y-%m",
            date: "$createdAt",
          },
        };
        dateGroup = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
      default: // day
        dateFormat = {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
          },
        };
        dateGroup = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
    }

    const results = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: dateGroup,
          date: { $first: dateFormat },
          total: { $sum: 1 },
          pendente: {
            $sum: { $cond: [{ $eq: ["$status", "pendente"] }, 1, 0] },
          },
          em_andamento: {
            $sum: { $cond: [{ $eq: ["$status", "em_andamento"] }, 1, 0] },
          },
          resolvido: {
            $sum: { $cond: [{ $eq: ["$status", "resolvido"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ results });
  } catch (error) {
    console.error("❌ Erro ao obter tendências:", error);
    res.status(500).json({ message: "Erro interno ao obter tendências." });
  }
};

/**
 * GET /api/dashboard/analytics/comparison
 * Retorna comparação entre bairros e tipos
 */
exports.getComparison = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { secretariaId, startDate, endDate, compareBy = "neighborhood" } = req.query;

    const range = resolveDateRange(startDate, endDate);
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    const match = buildMatch(cityId, range, allowedReportTypes);

    const groupField = compareBy === "type" ? "$reportType" : "$bairro";

    const results = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupField,
          label: { $first: { $ifNull: [groupField, "Não informado"] } },
          total: { $sum: 1 },
          avgEngagement: {
            $avg: {
              $add: [
                { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 3] },
                { $multiply: [{ $size: { $ifNull: ["$views", []] } }, 1] },
                { $multiply: [{ $size: { $ifNull: ["$shares", []] } }, 5] },
              ],
            },
          },
          resolutionRate: {
            $avg: {
              $cond: [{ $eq: ["$status", "resolvido"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          label: 1,
          total: 1,
          avgEngagement: { $round: ["$avgEngagement", 2] },
          resolutionRate: { $multiply: [{ $round: ["$resolutionRate", 4] }, 100] },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 15 },
    ]);

    res.status(200).json({ results });
  } catch (error) {
    console.error("❌ Erro ao obter comparação:", error);
    res.status(500).json({ message: "Erro interno ao obter comparação." });
  }
};

