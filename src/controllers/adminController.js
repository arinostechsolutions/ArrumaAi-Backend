const mongoose = require("mongoose");
const User = require("../models/User");
const Report = require("../models/Report");
const ContentReport = require("../models/ContentReport");
const City = require("../models/City");

/**
 * GET /api/admin/stats
 * Retorna estatísticas gerais do app
 */
exports.getStats = async (req, res) => {
  try {
    console.log("📊 Admin solicitou estatísticas gerais");

    const [
      totalUsers,
      totalReports,
      totalContentReports,
      pendingContentReports,
      totalCities,
    ] = await Promise.all([
      User.countDocuments(),
      Report.countDocuments(),
      ContentReport.countDocuments(),
      ContentReport.countDocuments({ status: "pendente" }),
      City.countDocuments(),
    ]);

    // Estatísticas de engajamento
    const engagementStats = await Report.aggregate([
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
    ]);

    const stats = {
      users: {
        total: totalUsers,
      },
      reports: {
        total: totalReports,
      },
      contentReports: {
        total: totalContentReports,
        pending: pendingContentReports,
      },
      cities: {
        total: totalCities,
      },
      engagement: engagementStats[0] || {
        totalLikes: 0,
        totalViews: 0,
        totalShares: 0,
      },
    };

    console.log("✅ Estatísticas calculadas:", stats);
    return res.status(200).json(stats);

  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/content-reports/pending
 * Lista denúncias de conteúdo pendentes (já existe no contentReportController, mas vamos manter aqui também)
 */
exports.getPendingContentReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`📋 Admin buscando denúncias pendentes (página ${page})`);

    const reports = await ContentReport.find({ status: "pendente" })
      .populate({
        path: "reportId",
        populate: {
          path: "user.userId",
          select: "name cpf",
        },
      })
      .populate("reportedBy.userId", "name email cpf")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filtrar denúncias onde o reportId foi deletado (null)
    const validReports = reports.filter(report => report.reportId !== null);

    const total = await ContentReport.countDocuments({ status: "pendente" });

    console.log(`✅ ${validReports.length} denúncias pendentes válidas encontradas (de ${reports.length} total)`);

    // Se há denúncias com reportId null, deletá-las automaticamente
    const orphanReports = reports.filter(report => report.reportId === null);
    if (orphanReports.length > 0) {
      console.log(`🗑️ Deletando ${orphanReports.length} denúncias órfãs (reportId null)...`);
      await ContentReport.deleteMany({
        _id: { $in: orphanReports.map(r => r._id) }
      });
    }

    return res.status(200).json({
      reports: validReports,
      page,
      limit,
      total: total - orphanReports.length,
      hasMore: skip + limit < total,
    });

  } catch (error) {
    console.error("❌ Erro ao buscar denúncias pendentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * DELETE /api/admin/report/:reportId
 * Deleta um post denunciado
 */
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { reason } = req.body; // Motivo da exclusão

    console.log(`🗑️ Admin deletando report: ${reportId}`);
    console.log(`📝 Motivo: ${reason}`);

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "ID de report inválido." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Remove da lista de reports da cidade
    await City.findOneAndUpdate(
      { id: report.city.id },
      { $pull: { "modules.reports.reportList": reportId } }
    );

    // Deleta o report
    await Report.findByIdAndDelete(reportId);

    // Atualiza todas as denúncias de conteúdo relacionadas
    await ContentReport.updateMany(
      { reportId: reportId },
      {
        status: "resolvido",
        action: "remocao_conteudo",
        moderatorNotes: reason || "Post removido pelo administrador.",
        reviewedAt: new Date(),
      }
    );

    console.log(`✅ Report ${reportId} deletado com sucesso`);

    return res.status(200).json({
      message: "Post deletado com sucesso.",
      reportId,
    });

  } catch (error) {
    console.error("❌ Erro ao deletar report:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/admin/user/:userId/ban
 * Bane um usuário (por enquanto, apenas marca como banido)
 */
exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // Motivo do banimento

    console.log(`🚫 Admin banindo usuário: ${userId}`);
    console.log(`📝 Motivo: ${reason}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Não permite banir outro admin
    if (user.isAdmin) {
      return res.status(403).json({
        message: "Não é possível banir outro administrador.",
      });
    }

    // Por enquanto, vamos apenas deletar o usuário
    // No futuro, você pode adicionar um campo "isBanned" ao modelo User
    await User.findByIdAndDelete(userId);

    // Remove usuário da cidade
    await City.updateOne(
      { users: userId },
      { $pull: { users: userId } }
    );

    // Atualiza denúncias de conteúdo feitas por este usuário
    await ContentReport.updateMany(
      { "reportedBy.userId": userId },
      {
        moderatorNotes: `Usuário banido. Motivo: ${reason || "Não especificado"}`,
      }
    );

    console.log(`✅ Usuário ${userId} banido e deletado com sucesso`);

    return res.status(200).json({
      message: "Usuário banido com sucesso.",
      userId,
    });

  } catch (error) {
    console.error("❌ Erro ao banir usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PATCH /api/admin/content-report/:contentReportId/resolve
 * Marca uma denúncia de conteúdo como resolvida
 */
exports.resolveContentReport = async (req, res) => {
  try {
    const { contentReportId } = req.params;
    const { action, moderatorNotes } = req.body;

    console.log(`✅ Admin resolvendo denúncia: ${contentReportId}`);
    console.log(`🔧 Ação: ${action}`);

    if (!mongoose.Types.ObjectId.isValid(contentReportId)) {
      return res.status(400).json({ message: "ID de denúncia inválido." });
    }

    const contentReport = await ContentReport.findById(contentReportId);
    if (!contentReport) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Atualiza a denúncia
    contentReport.status = action === "nenhuma" ? "improcedente" : "procedente";
    contentReport.action = action || "nenhuma";
    contentReport.moderatorNotes = moderatorNotes || "";
    contentReport.reviewedAt = new Date();

    await contentReport.save();

    console.log(`✅ Denúncia ${contentReportId} resolvida como ${contentReport.status}`);

    return res.status(200).json({
      message: "Denúncia resolvida com sucesso.",
      contentReport,
    });

  } catch (error) {
    console.error("❌ Erro ao resolver denúncia:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/users/recent
 * Lista usuários mais recentes
 */
exports.getRecentUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`👥 Admin buscando ${limit} usuários mais recentes`);

    const users = await User.find()
      .select("name cpf email phone city createdAt")
      .populate("city", "label")
      .sort({ createdAt: -1 })
      .limit(limit);

    console.log(`✅ ${users.length} usuários encontrados`);

    return res.status(200).json({ users });

  } catch (error) {
    console.error("❌ Erro ao buscar usuários recentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/reports/recent
 * Lista denúncias mais recentes
 */
exports.getRecentReports = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📋 Admin buscando ${limit} denúncias mais recentes`);

    const reports = await Report.find()
      .populate("user.userId", "name cpf")
      .sort({ createdAt: -1 })
      .limit(limit);

    console.log(`✅ ${reports.length} denúncias encontradas`);

    return res.status(200).json({ reports });

  } catch (error) {
    console.error("❌ Erro ao buscar denúncias recentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

