const mongoose = require("mongoose");
const ContentReport = require("../models/ContentReport");
const Report = require("../models/Report");

/**
 * POST /api/content-report/create
 * Cria uma denúncia de conteúdo impróprio
 */
exports.createContentReport = async (req, res) => {
  try {
    const { reportId, reportedBy, reason, details } = req.body;

    console.log("🚨 Nova denúncia de conteúdo:", JSON.stringify(req.body, null, 2));

    // Validações
    if (!reportId || !reportedBy?.userId || !reason) {
      return res.status(400).json({
        message: "Campos obrigatórios: reportId, reportedBy.userId, reason",
      });
    }

    // Verifica se o report existe
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // 🔒 Validação de isolamento: verifica se o report pertence à cidade do usuário (se cityId foi fornecido)
    const { cityId } = req.body;
    if (cityId && report.city.id !== cityId) {
      console.log(`🚫 Tentativa de reportar conteúdo de outra cidade - Report: ${reportId}, User City: ${cityId}, Report City: ${report.city.id}`);
      return res.status(403).json({
        message: "Você não pode reportar conteúdo de outras cidades.",
      });
    }

    // ⚠️ NÃO permite que o usuário denuncie a própria denúncia
    if (report.user.userId.toString() === reportedBy.userId) {
      console.log(`⚠️ Usuário tentou denunciar a própria denúncia - Report: ${reportId}, User: ${reportedBy.userId}`);
      return res.status(400).json({
        message: "Você não pode denunciar sua própria denúncia.",
      });
    }

    // ⚠️ Verifica se o usuário já denunciou este conteúdo
    // Uma vez reportado, o post fica oculto permanentemente para o usuário (hiddenPosts)
    // Então não faz sentido permitir reportar novamente, mesmo que tenha sido "improcedente"
    const existingReport = await ContentReport.findOne({
      reportId: reportId,
      "reportedBy.userId": reportedBy.userId,
    });

    if (existingReport) {
      console.log(`⚠️ Usuário já denunciou este conteúdo - Report: ${reportId}, User: ${reportedBy.userId}, Status: ${existingReport.status}`);
      return res.status(400).json({
        message: "Você já reportou este conteúdo anteriormente. Este post não aparecerá mais no seu feed.",
        alreadyReported: true,
      });
    }

    // Cria a denúncia de conteúdo
    const newContentReport = new ContentReport({
      reportId,
      reportedBy: {
        userId: reportedBy.userId,
        name: reportedBy.name,
        cpf: reportedBy.cpf,
      },
      reason,
      details: details || null,
      status: "pendente",
      ipAddress: req.ip || req.connection.remoteAddress,
    });

    await newContentReport.save();

    console.log(`✅ Denúncia de conteúdo registrada: ${newContentReport._id}`);

    return res.status(201).json({
      message: "Denúncia registrada com sucesso. Nossa equipe analisará em breve.",
      contentReportId: newContentReport._id,
    });

  } catch (error) {
    console.error("❌ Erro ao criar denúncia de conteúdo:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/content-report/pending
 * Lista todas as denúncias pendentes (admin only - futuro)
 */
exports.getPendingReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`📋 Buscando denúncias de conteúdo pendentes (página ${page})`);

    const reports = await ContentReport.find({ status: "pendente" })
      .populate("reportId")
      .populate("reportedBy.userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ContentReport.countDocuments({ status: "pendente" });

    console.log(`✅ ${reports.length} denúncias pendentes encontradas`);

    return res.status(200).json({
      reports,
      page,
      limit,
      total,
      hasMore: skip + limit < total,
    });

  } catch (error) {
    console.error("❌ Erro ao buscar denúncias pendentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/content-report/by-report/:reportId
 * Retorna quantas denúncias um report específico recebeu
 */
exports.getReportCount = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const count = await ContentReport.countDocuments({
      reportId: reportId,
      status: { $ne: "improcedente" }, // Não conta improcedentes
    });

    console.log(`📊 Report ${reportId} tem ${count} denúncias`);

    return res.status(200).json({
      reportId,
      reportCount: count,
    });

  } catch (error) {
    console.error("❌ Erro ao contar denúncias:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PATCH /api/content-report/review/:contentReportId
 * Atualiza o status de uma denúncia (admin only - futuro)
 */
exports.reviewContentReport = async (req, res) => {
  try {
    const { contentReportId } = req.params;
    const { status, action, moderatorNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(contentReportId)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const contentReport = await ContentReport.findById(contentReportId);
    if (!contentReport) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Atualiza os campos
    contentReport.status = status || contentReport.status;
    contentReport.action = action || contentReport.action;
    contentReport.moderatorNotes = moderatorNotes || contentReport.moderatorNotes;
    contentReport.reviewedAt = new Date();

    await contentReport.save();

    console.log(`✅ Denúncia ${contentReportId} atualizada: ${status}`);

    return res.status(200).json({
      message: "Denúncia atualizada com sucesso.",
      contentReport,
    });

  } catch (error) {
    console.error("❌ Erro ao revisar denúncia:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

