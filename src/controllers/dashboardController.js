const mongoose = require("mongoose");
const Report = require("../models/Report");
const City = require("../models/City");

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

function buildMatch(cityId, range = {}, allowedReportTypes = null) {
  const match = { "city.id": cityId };

  // Filtrar por reportTypes se houver restrição de secretaria
  // Se allowedReportTypes é um array vazio [], significa que não há tipos associados
  // e devemos aplicar um filtro que não retorna nada (usando um ID inexistente)
  if (Array.isArray(allowedReportTypes)) {
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

  // Verificar se range é um objeto válido antes de acessar suas propriedades
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

function toDictionary(entries) {
  return entries.reduce((acc, item) => {
    if (item && item._id !== null && item._id !== undefined) {
      acc[item._id] = item.total;
    } else {
      acc.undefined = (acc.undefined || 0) + item.total;
    }
    return acc;
  }, {});
}

async function resolveCityContext(req, res) {
  const admin = req.admin;

  if (!admin) {
    res.status(401).json({ message: "Contexto de administrador não encontrado." });
    return null;
  }

  const requestedCityId =
    req.query.cityId || req.body.cityId || req.params.cityId;

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
 * Função auxiliar para obter reportTypes permitidos para o admin
 * Se for super admin, retorna null (sem filtro)
 * Se tiver secretaria, retorna array de reportTypes da secretaria
 * Se for prefeito e tiver secretariaId no query, filtra por essa secretaria
 */
async function getAllowedReportTypes(cityId, admin, secretariaId = null) {
  
  // Super admins não têm filtro de reportTypes
  if (admin.isSuperAdmin) {
    return null; // Sem filtro
  }

  // Prefeitos podem filtrar por secretaria específica se fornecido
  if (admin.isMayor && secretariaId) {
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

  // Prefeitos sem filtro de secretaria não têm restrição
  if (admin.isMayor) {
    return null; // Sem filtro
  }

  // Admins de secretaria: filtrar apenas pelos reportTypes que criou OU que estão em allowedSecretarias
  if (!admin.secretaria) {
    return null;
  }

  const city = await City.findOne({ id: cityId }).select("secretarias modules.reports.reportTypes");
  if (!city) {
    return null;
  }

  // secretariaId é parâmetro da função, usar nome diferente
  const adminSecretariaId = admin.secretaria?.id || admin.secretaria;
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
        if (type.allowedSecretarias?.includes(adminSecretariaId)) {
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

exports.getOverview = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { startDate, endDate, secretariaId } = req.query;

    const range = resolveDateRange(startDate, endDate);
    
    // Filtrar por secretaria se não for super admin
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    const baseMatch = buildMatch(cityId, {}, allowedReportTypes);
    const periodMatch = buildMatch(cityId, range, allowedReportTypes);

    const last7DaysStart = new Date();
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);
    last7DaysStart.setUTCHours(0, 0, 0, 0);

    
    const [statusAggregation, engagementAggregation, createdInPeriodCount, recentActivity] =
      await Promise.all([
        Report.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: "$status",
              total: { $sum: 1 },
            },
          },
        ]),
        Report.aggregate([
          { $match: baseMatch },
          {
            $project: {
              likesCount: { $size: { $ifNull: ["$likes", []] } },
              viewsCount: { $size: { $ifNull: ["$views", []] } },
              sharesCount: { $size: { $ifNull: ["$shares", []] } },
            },
          },
          {
            $group: {
              _id: null,
              totalLikes: { $sum: "$likesCount" },
              totalViews: { $sum: "$viewsCount" },
              totalShares: { $sum: "$sharesCount" },
            },
          },
        ]),
        Report.countDocuments(periodMatch),
        Report.aggregate([
          {
            $match: {
              ...baseMatch,
              createdAt: { $gte: last7DaysStart },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              total: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const totalReports = statusAggregation.reduce((sum, item) => sum + item.total, 0);
    const totalByStatus = toDictionary(statusAggregation);
    const engagement = engagementAggregation[0] || {
      totalLikes: 0,
      totalViews: 0,
      totalShares: 0,
    };

    res.status(200).json({
      cityId,
      totalReports,
      totalByStatus,
      createdInPeriod: createdInPeriodCount,
      engagement,
      recentActivity: recentActivity.map((item) => ({
        date: item._id,
        total: item.total,
      })),
    });
  } catch (error) {
    console.error("❌ Erro ao obter overview do dashboard:", error);
    res.status(500).json({ message: "Erro interno ao obter overview do dashboard." });
  }
};

exports.getReportsSummary = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { startDate, endDate, secretariaId } = req.query;

    const range = resolveDateRange(startDate, endDate);

    if (!range.start && !range.end) {
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      defaultStart.setUTCHours(0, 0, 0, 0);
      range.start = defaultStart;
    }

    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    const match = buildMatch(cityId, range, allowedReportTypes);

    const [byStatus, byType, byNeighborhood, timeline] = await Promise.all([
      Report.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$status",
            total: { $sum: 1 },
          },
        },
      ]),
      Report.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$reportType",
            total: { $sum: 1 },
          },
        },
      ]),
      Report.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ["$bairro", "Sem bairro"] },
            total: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Report.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.status(200).json({
      cityId,
      range,
      byStatus: byStatus.map((item) => ({ status: item._id, total: item.total })),
      byType: byType.map((item) => ({ type: item._id, total: item.total })),
      byNeighborhood: byNeighborhood.map((item) => ({
        neighborhood: item._id,
        total: item.total,
      })),
      timeline: timeline.map((item) => ({ date: item._id, total: item.total })),
    });
  } catch (error) {
    console.error("❌ Erro ao obter resumo de reports:", error);
    res.status(500).json({ message: "Erro interno ao obter resumo de denúncias." });
  }
};

exports.getTopReports = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { sort = "engagement", limit = 5, status, page = 1, secretariaId, startDate, endDate } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 5, 50);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    
    // Filtrar por secretaria se não for super admin
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    
    // Resolver filtro de data
    const range = resolveDateRange(startDate, endDate);
    
    // Construir match com filtros de cidade, data e secretaria
    const match = buildMatch(cityId, range, allowedReportTypes);

    // Filtrar por status (excluir resolvido se status for "all" ou não especificado)
    if (status && status !== "all") {
      match.status = status;
    } else if (!status || status === "all") {
      // Excluir resolvidos quando status é "all" ou não especificado
      match.status = { $ne: "resolvido" };
    }

    // Buscar reports com todos os campos necessários
    const reports = await Report.find(match)
      .select([
        "reportType",
        "status",
        "city",
        "bairro",
        "address",
        "createdAt",
        "engagementScore",
        "likes",
        "views",
        "shares",
        "imageUrl",
      ])
      .lean();

    // Calcular engagementScore dinamicamente sempre com a fórmula correta
    const reportsWithScore = reports.map((report) => {
      const likesCount = Array.isArray(report.likes) ? report.likes.length : 0;
      const viewsCount = Array.isArray(report.views) ? report.views.length : 0;
      const sharesCount = Array.isArray(report.shares) ? report.shares.length : 0;
      
      // Sempre recalcular o score com a fórmula simples e consistente
      // Fórmula: (Likes × 3) + (Views × 1) + (Shares × 5)
      const engagementScore = likesCount * 3 + viewsCount * 1 + sharesCount * 5;

      return {
        ...report,
        engagementScore,
        likesCount,
        viewsCount,
        sharesCount,
      };
    });

    // Ordenar os reports
    if (sort === "oldest") {
      reportsWithScore.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateA - dateB;
      });
    } else {
      // Ordenar por engagementScore (decrescente) e depois por createdAt (decrescente)
      reportsWithScore.sort((a, b) => {
        if (b.engagementScore !== a.engagementScore) {
          return b.engagementScore - a.engagementScore;
        }
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA;
      });
    }

    // Calcular paginação
    const total = reportsWithScore.length;
    const totalPages = Math.ceil(total / parsedLimit);
    const startIndex = (parsedPage - 1) * parsedLimit;
    const endIndex = startIndex + parsedLimit;

    // Limitar resultados com paginação
    const paginatedReports = reportsWithScore.slice(startIndex, endIndex);

    // Formatar resposta
    const formatted = paginatedReports.map((report) => ({
      id: report._id ? report._id.toString() : report._id,
      reportType: report.reportType,
      status: report.status,
      address: report.address,
      bairro: report.bairro || null,
      createdAt: report.createdAt,
      engagementScore: report.engagementScore,
      likesCount: report.likesCount,
      viewsCount: report.viewsCount,
      sharesCount: report.sharesCount,
      imageUrl: report.imageUrl || null,
    }));

    res.status(200).json({
      cityId,
      sortBy: sort,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      results: formatted,
    });
  } catch (error) {
    console.error("❌ Erro ao obter reports de destaque:", error);
    res.status(500).json({ message: "Erro interno ao obter denúncias em destaque." });
  }
};

exports.getMapData = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { status, reportType, secretariaId, reportId } = req.query;

    const match = {
      "city.id": cityId,
      location: { $exists: true, $ne: null },
      "location.coordinates": { $exists: true, $ne: null },
    };

    // Filtrar por secretaria se não for super admin
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    if (Array.isArray(allowedReportTypes)) {
      if (allowedReportTypes.length === 0) {
        // Array vazio: não mostrar nada (filtrar por um ID que não existe)
        match.reportType = { $in: ["__NO_REPORTS__"] };
      } else {
        // Array com tipos: filtrar por esses tipos
        match.reportType = { $in: allowedReportTypes };
      }
    } else if (reportType) {
      match.reportType = reportType;
    }

    if (status && status !== "all") {
      match.status = status;
    }

    const reports = await Report.find(match)
      .select([
        "reportType",
        "status",
        "address",
        "bairro",
        "rua",
        "referencia",
        "imageUrl",
        "location",
        "createdAt",
        "engagementScore",
      ])
      .sort({ createdAt: -1 })
      .lean();

    // Se reportId foi fornecido, buscar o report específico e incluí-lo mesmo que não passe pelos filtros
    let focusedReport = null;
    if (reportId) {
      try {
        const focused = await Report.findById(reportId)
          .select([
            "reportType",
            "status",
            "address",
            "bairro",
            "rua",
            "referencia",
            "imageUrl",
            "location",
            "createdAt",
            "engagementScore",
            "city.id",
          ])
          .lean();

        // Verificar se o report pertence à cidade e tem localização
        if (
          focused &&
          focused["city.id"] === cityId &&
          focused.location &&
          Array.isArray(focused.location.coordinates) &&
          focused.location.coordinates.length === 2
        ) {
          focusedReport = focused;
        }
      } catch (error) {
        console.error("Erro ao buscar report focado:", error);
      }
    }

    const formatted = reports
      .filter(
        (report) =>
          report.location &&
          Array.isArray(report.location.coordinates) &&
          report.location.coordinates.length === 2
      )
      .map((report) => ({
        id: report._id.toString(),
        reportType: report.reportType,
        status: report.status,
        address: report.address,
        bairro: report.bairro || null,
        rua: report.rua || null,
        referencia: report.referencia || null,
        imageUrl: report.imageUrl || null,
        createdAt: report.createdAt,
        engagementScore: report.engagementScore || 0,
        location: {
          lat: report.location.coordinates[1],
          lng: report.location.coordinates[0],
          accuracy: report.location.accuracy || null,
          collectedAt: report.location.collectedAt || null,
        },
      }));

    // Adicionar o report focado se não estiver na lista
    if (focusedReport) {
      const focusedId = focusedReport._id.toString();
      const alreadyIncluded = formatted.some((r) => r.id === focusedId);
      
      if (!alreadyIncluded) {
        formatted.unshift({
          id: focusedId,
          reportType: focusedReport.reportType,
          status: focusedReport.status,
          address: focusedReport.address,
          bairro: focusedReport.bairro || null,
          rua: focusedReport.rua || null,
          referencia: focusedReport.referencia || null,
          imageUrl: focusedReport.imageUrl || null,
          createdAt: focusedReport.createdAt,
          engagementScore: focusedReport.engagementScore || 0,
          location: {
            lat: focusedReport.location.coordinates[1],
            lng: focusedReport.location.coordinates[0],
            accuracy: focusedReport.location.accuracy || null,
            collectedAt: focusedReport.location.collectedAt || null,
          },
        });
      }
    }

    res.status(200).json({
      cityId,
      status: status || "all",
      reportType: reportType || null,
      total: formatted.length,
      reports: formatted,
    });
  } catch (error) {
    console.error("❌ Erro ao obter dados do mapa:", error);
    res.status(500).json({ message: "Erro interno ao obter dados georreferenciados." });
  }
};

exports.getReportStatusOptions = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { secretariaId } = req.query;
    const match = { "city.id": cityId };
    
    // Filtrar por secretaria se não for super admin
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    if (Array.isArray(allowedReportTypes)) {
      if (allowedReportTypes.length === 0) {
        // Array vazio: não mostrar nada (filtrar por um ID que não existe)
        match.reportType = { $in: ["__NO_REPORTS__"] };
      } else {
        // Array com tipos: filtrar por esses tipos
        match.reportType = { $in: allowedReportTypes };
      }
    }

    const statuses = await Report.distinct("status", match);
    statuses.sort((a, b) =>
      String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" })
    );

    res.status(200).json({
      cityId,
      statuses,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar status disponíveis:", error);
    res.status(500).json({ message: "Erro interno ao buscar status disponíveis." });
  }
};

exports.getReportsList = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const {
      status = "all",
      page = 1,
      limit = 20,
      search,
      secretariaId,
    } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {
      "city.id": cityId,
    };

    // Filtrar por secretaria se não for super admin
    const allowedReportTypes = await getAllowedReportTypes(cityId, req.admin, secretariaId);
    if (Array.isArray(allowedReportTypes)) {
      if (allowedReportTypes.length === 0) {
        // Array vazio: não mostrar nada (filtrar por um ID que não existe)
        filter.reportType = { $in: ["__NO_REPORTS__"] };
      } else {
        // Array com tipos: filtrar por esses tipos
        filter.reportType = { $in: allowedReportTypes };
      }
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search && String(search).trim() !== "") {
      const escapedRaw = String(search).trim();
      const escaped = escapedRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { reportType: regex },
        { address: regex },
        { bairro: regex },
        { "city.label": regex },
        { referencia: regex },
      ];

      if (mongoose.Types.ObjectId.isValid(escapedRaw)) {
        filter.$or.push({ _id: new mongoose.Types.ObjectId(escapedRaw) });
      }
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
      Report.countDocuments(filter),
    ]);

    const results = reports.map((report) => ({
      id: report._id,
      reportType: report.reportType,
      status: report.status,
      address: report.address,
      bairro: report.bairro || null,
      referencia: report.referencia || null,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      imageUrl: report.imageUrl || null,
      city: report.city,
    }));

    res.status(200).json({
      cityId,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
      results,
    });
  } catch (error) {
    console.error("❌ Erro ao listar denúncias:", error);
    res.status(500).json({ message: "Erro interno ao listar denúncias." });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const cityId = await resolveCityContext(req, res);
    if (!cityId) return;

    const { reportId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "ID de denúncia inválido." });
    }

    if (typeof status !== "string" || status.trim() === "") {
      return res.status(400).json({ message: "Status é obrigatório." });
    }

    const normalizedStatus = status.trim();

    const report = await Report.findOne({
      _id: reportId,
      "city.id": cityId,
    });

    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada para este município." });
    }

    const oldStatus = report.status;
    report.status = normalizedStatus;
    await report.save();

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "report_status_update",
        description: `Status da sugestão de melhoria alterado de "${oldStatus}" para "${normalizedStatus}"`,
        details: {
          reportId: report._id.toString(),
          reportType: report.reportType,
          oldStatus,
          newStatus: normalizedStatus,
          address: report.address,
        },
        entityType: "report",
        entityId: report._id,
        cityId,
        req,
      });
    }

    res.status(200).json({
      message: "Status atualizado com sucesso.",
      report: {
        id: report._id,
        status: report.status,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar status da denúncia:", error);
    res.status(500).json({ message: "Erro interno ao atualizar status da denúncia." });
  }
};


