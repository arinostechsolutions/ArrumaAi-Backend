const mongoose = require("mongoose");
const Report = require("../models/Report");

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

function buildMatch(cityId, range = {}) {
  const match = { "city.id": cityId };

  if (range.start || range.end) {
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

function resolveCityContext(req, res) {
  const admin = req.admin;

  if (!admin) {
    res.status(401).json({ message: "Contexto de administrador não encontrado." });
    return null;
  }

  const requestedCityId =
    req.query.cityId || req.body.cityId || req.params.cityId;

  if (requestedCityId) {
    if (!admin.isSuperAdmin && !admin.allowedCities.includes(requestedCityId)) {
      res.status(403).json({
        message: "Você não tem permissão para acessar os dados deste município.",
      });
      return null;
    }
    return requestedCityId;
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

exports.getOverview = async (req, res) => {
  try {
    const cityId = resolveCityContext(req, res);
    if (!cityId) return;

    const { startDate, endDate } = req.query;

    const range = resolveDateRange(startDate, endDate);
    const baseMatch = buildMatch(cityId);
    const periodMatch = buildMatch(cityId, range);

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
    const cityId = resolveCityContext(req, res);
    if (!cityId) return;

    const { startDate, endDate } = req.query;

    const range = resolveDateRange(startDate, endDate);

    if (!range.start && !range.end) {
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      defaultStart.setUTCHours(0, 0, 0, 0);
      range.start = defaultStart;
    }

    const match = buildMatch(cityId, range);

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
    const cityId = resolveCityContext(req, res);
    if (!cityId) return;

    const { sort = "engagement", limit = 5, status } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 5, 50);
    const match = { "city.id": cityId };

    if (status && status !== "all") {
      match.status = status;
    }

    const query = Report.find(match)
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

    if (sort === "oldest") {
      query.sort({ createdAt: 1 });
    } else {
      query.sort({ engagementScore: -1, createdAt: -1 });
    }

    const reports = await query.limit(parsedLimit);

    const formatted = reports.map((report) => ({
      id: report._id,
      reportType: report.reportType,
      status: report.status,
      address: report.address,
      bairro: report.bairro || null,
      createdAt: report.createdAt,
      engagementScore: report.engagementScore || 0,
      likesCount: Array.isArray(report.likes) ? report.likes.length : 0,
      viewsCount: Array.isArray(report.views) ? report.views.length : 0,
      sharesCount: Array.isArray(report.shares) ? report.shares.length : 0,
      imageUrl: report.imageUrl || null,
    }));

    res.status(200).json({
      cityId,
      sortBy: sort,
      limit: parsedLimit,
      results: formatted,
    });
  } catch (error) {
    console.error("❌ Erro ao obter reports de destaque:", error);
    res.status(500).json({ message: "Erro interno ao obter denúncias em destaque." });
  }
};

exports.getMapData = async (req, res) => {
  try {
    const cityId = resolveCityContext(req, res);
    if (!cityId) return;

    const { status, reportType } = req.query;

    const match = {
      "city.id": cityId,
      location: { $exists: true, $ne: null },
      "location.coordinates": { $exists: true, $ne: null },
    };

    if (status && status !== "all") {
      match.status = status;
    }

    if (reportType) {
      match.reportType = reportType;
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

    const formatted = reports
      .filter(
        (report) =>
          report.location &&
          Array.isArray(report.location.coordinates) &&
          report.location.coordinates.length === 2
      )
      .map((report) => ({
        id: report._id,
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
    const cityId = resolveCityContext(req, res);
    if (!cityId) return;

    const statuses = await Report.distinct("status", { "city.id": cityId });
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
    const cityId = resolveCityContext(req, res);
    if (!cityId) return;

    const {
      status = "all",
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {
      "city.id": cityId,
    };

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
    const cityId = resolveCityContext(req, res);
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

    report.status = normalizedStatus;
    await report.save();

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


