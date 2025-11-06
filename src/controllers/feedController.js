// src/controllers/feedController.js
const Report = require("../models/Report");
const User = require("../models/User");
const mongoose = require("mongoose");

// 🔥 ALGORITMO DE FEED ESTILO INSTAGRAM
// Baseado em engajamento, recência e interações do usuário

/**
 * Calcula o score de engajamento de uma denúncia
 * 
 * Fórmula inspirada no algoritmo do Instagram:
 * Score = (Likes * 3 + Views * 0.5 + AvgWatchTime * 2 + Shares * 10) * DecayFactor * RecencyBoost
 * 
 * Pesos:
 * - Likes: 3 (alto engajamento)
 * - Views: 0.5 (engajamento passivo)
 * - Tempo médio de visualização: 2 (forte indicador de interesse)
 * - Shares: 10 (máximo engajamento, viralização)
 * 
 * DecayFactor: Reduz o score de posts antigos (half-life de 7 dias)
 * RecencyBoost: Posts com menos de 24h ganham boost de 2x
 */
function calculateEngagementScore(report) {
  const now = new Date();
  const createdAt = new Date(report.createdAt);
  const ageInHours = (now - createdAt) / (1000 * 60 * 60);
  const ageInDays = ageInHours / 24;

  // Contadores de métricas
  const likesCount = report.likes ? report.likes.length : 0;
  const viewsCount = report.views ? report.views.length : 0;
  const sharesCount = report.shares ? report.shares.length : 0;

  // Tempo médio de visualização (em segundos)
  let avgWatchTime = 0;
  if (report.views && report.views.length > 0) {
    const totalWatchTime = report.views.reduce((sum, view) => sum + (view.duration || 0), 0);
    avgWatchTime = totalWatchTime / report.views.length;
  }

  // 🎯 PESOS (ajustáveis para otimizar o algoritmo)
  const LIKE_WEIGHT = 3;
  const VIEW_WEIGHT = 0.5;
  const WATCH_TIME_WEIGHT = 2;
  const SHARE_WEIGHT = 10;

  // Score base de engajamento
  const baseScore = 
    (likesCount * LIKE_WEIGHT) +
    (viewsCount * VIEW_WEIGHT) +
    (avgWatchTime * WATCH_TIME_WEIGHT) +
    (sharesCount * SHARE_WEIGHT);

  // 📉 DECAY FACTOR (Half-life de 7 dias)
  // Posts perdem 50% de relevância a cada 7 dias
  const HALF_LIFE_DAYS = 7;
  const decayFactor = Math.pow(0.5, ageInDays / HALF_LIFE_DAYS);

  // 🚀 RECENCY BOOST (Posts novos ganham boost)
  // Posts com menos de 24h ganham boost de 2x
  // Posts entre 24h e 48h ganham boost de 1.5x
  let recencyBoost = 1;
  if (ageInHours < 24) {
    recencyBoost = 2;
  } else if (ageInHours < 48) {
    recencyBoost = 1.5;
  }

  // 🎯 SCORE FINAL
  const finalScore = baseScore * decayFactor * recencyBoost;

  return Math.round(finalScore * 100) / 100; // Arredonda para 2 casas decimais
}

/**
 * GET /api/feed/city/:cityId
 * Retorna o feed ordenado por algoritmo de engajamento
 */
exports.getFeed = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { userId } = req.query; // ID do usuário para personalização futura
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // 🔒 Validação: cityId é obrigatório
    if (!cityId || cityId.trim() === "") {
      return res.status(400).json({ message: "cityId é obrigatório." });
    }

    // 🔒 Validação adicional: verifica se a cidade existe (opcional, mas recomendado)
    const City = require("../models/City");
    const cityExists = await City.findOne({ id: cityId }).lean();
    if (!cityExists) {
      console.log(`🚫 Tentativa de buscar feed de cidade inexistente: ${cityId}`);
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    console.log(`📱 Buscando feed da cidade: ${cityId} (página ${page})`);

    // 🙈 Busca posts ocultos do usuário (se userId foi passado)
    let hiddenPostIds = [];
    if (userId) {
      const user = await User.findById(userId).select("hiddenPosts").lean();
      if (user && user.hiddenPosts) {
        hiddenPostIds = user.hiddenPosts.map(id => id.toString());
        console.log(`🙈 Usuário ${userId} tem ${hiddenPostIds.length} posts ocultos`);
      }
    }

    // 🔒 Busca APENAS denúncias da cidade especificada (isolamento garantido)
    const reports = await Report.find({ "city.id": cityId })
      .populate("user.userId", "name profileImage") // Popula dados do usuário
      .lean();

    // 🔒 Validação adicional: filtra qualquer report que não pertença à cidade (segurança extra)
    const filteredReports = reports.filter(report => report.city?.id === cityId);

    if (filteredReports.length === 0) {
      return res.status(200).json({
        reports: [],
        hasMore: false,
        page,
        total: 0,
      });
    }

    // 🙈 Filtra posts ocultos pelo usuário
    const visibleReports = filteredReports.filter(report => 
      !hiddenPostIds.includes(report._id.toString())
    );

    console.log(`👁️ ${filteredReports.length} posts totais da cidade ${cityId}, ${visibleReports.length} visíveis para o usuário`);

    if (visibleReports.length === 0) {
      return res.status(200).json({
        reports: [],
        hasMore: false,
        page,
        total: 0,
      });
    }

    // Calcula o score de engajamento para cada denúncia
    const reportsWithScore = visibleReports.map(report => ({
      ...report,
      engagementScore: calculateEngagementScore(report),
      // Dados agregados para o frontend
      likesCount: report.likes ? report.likes.length : 0,
      viewsCount: report.views ? report.views.length : 0,
      sharesCount: report.shares ? report.shares.length : 0,
      // Verifica se o usuário já curtiu/visualizou/compartilhou (se userId foi passado)
      isLikedByUser: userId && report.likes 
        ? report.likes.some(like => like.userId.toString() === userId) 
        : false,
      isViewedByUser: userId && report.views
        ? report.views.some(view => view.userId.toString() === userId)
        : false,
      isSharedByUser: userId && report.shares
        ? report.shares.some(share => share.userId.toString() === userId)
        : false,
    }));

    // Ordena pelo engagementScore (maior para menor)
    reportsWithScore.sort((a, b) => b.engagementScore - a.engagementScore);

    // Paginação
    const paginatedReports = reportsWithScore.slice(skip, skip + limit);
    const hasMore = skip + limit < reportsWithScore.length;

    console.log(`✅ ${reportsWithScore.length} denúncias encontradas, retornando ${paginatedReports.length}`);

    return res.status(200).json({
      reports: paginatedReports,
      hasMore,
      page,
      total: reportsWithScore.length,
    });

  } catch (error) {
    console.error("❌ Erro ao buscar feed:", error);
    return res.status(500).json({ message: "Erro ao carregar o feed." });
  }
};

/**
 * POST /api/feed/like/:reportId
 * Adiciona ou remove like de uma denúncia
 */
exports.toggleLike = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId, cityId } = req.body; // cityId para validação de isolamento

    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // 🔒 Validação de isolamento: verifica se o report pertence à cidade do usuário
    if (cityId && report.city.id !== cityId) {
      console.log(`🚫 Tentativa de like em report de outra cidade - Report: ${reportId}, User City: ${cityId}, Report City: ${report.city.id}`);
      return res.status(403).json({ 
        message: "Você não pode interagir com posts de outras cidades." 
      });
    }

    // Verifica se o usuário já curtiu
    const likeIndex = report.likes.findIndex(
      like => like.userId.toString() === userId
    );

    let action = "";
    if (likeIndex > -1) {
      // Remove o like (descurtir)
      report.likes.splice(likeIndex, 1);
      action = "removed";
    } else {
      // Adiciona o like
      report.likes.push({
        userId: userId, // Mongoose converte string para ObjectId automaticamente
        likedAt: new Date(),
      });
      action = "added";
    }

    // Recalcula o score de engajamento
    report.engagementScore = calculateEngagementScore(report);
    report.lastScoreUpdate = new Date();

    await report.save();

    console.log(`❤️ Like ${action} - Report: ${reportId}, User: ${userId}`);

    return res.status(200).json({
      message: `Like ${action === "added" ? "adicionado" : "removido"} com sucesso.`,
      likesCount: report.likes.length,
      isLiked: action === "added",
    });

  } catch (error) {
    console.error("❌ Erro ao processar like:", error);
    return res.status(500).json({ message: "Erro ao processar like." });
  }
};

/**
 * POST /api/feed/view/:reportId
 * Registra uma visualização (apenas 1 por usuário)
 */
exports.registerView = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId, duration, cityId } = req.body; // duration em segundos, cityId para validação

    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // 🔒 Validação de isolamento: verifica se o report pertence à cidade do usuário
    if (cityId && report.city.id !== cityId) {
      console.log(`🚫 Tentativa de view em report de outra cidade - Report: ${reportId}, User City: ${cityId}, Report City: ${report.city.id}`);
      return res.status(403).json({ 
        message: "Você não pode interagir com posts de outras cidades." 
      });
    }

    // Verifica se o usuário já visualizou
    const existingView = report.views.find(
      view => view.userId.toString() === userId
    );

    if (existingView) {
      // Atualiza o tempo de visualização se for maior
      if (duration && duration > existingView.duration) {
        existingView.duration = duration;
        existingView.viewedAt = new Date(); // Atualiza timestamp
      }
    } else {
      // Adiciona nova visualização
      report.views.push({
        userId: userId, // Mongoose converte string para ObjectId automaticamente
        viewedAt: new Date(),
        duration: duration || 0,
      });
    }

    // Recalcula o score de engajamento
    report.engagementScore = calculateEngagementScore(report);
    report.lastScoreUpdate = new Date();

    await report.save();

    console.log(`👁️ View registrada - Report: ${reportId}, User: ${userId}, Duration: ${duration}s`);

    return res.status(200).json({
      message: "Visualização registrada com sucesso.",
      viewsCount: report.views.length,
    });

  } catch (error) {
    console.error("❌ Erro ao registrar visualização:", error);
    return res.status(500).json({ message: "Erro ao registrar visualização." });
  }
};

/**
 * POST /api/feed/share/:reportId
 * Registra compartilhamento (apenas 1 por usuário)
 */
exports.registerShare = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId, cityId } = req.body; // cityId para validação de isolamento

    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // 🔒 Validação de isolamento: verifica se o report pertence à cidade do usuário
    if (cityId && report.city.id !== cityId) {
      console.log(`🚫 Tentativa de share em report de outra cidade - Report: ${reportId}, User City: ${cityId}, Report City: ${report.city.id}`);
      return res.status(403).json({ 
        message: "Você não pode interagir com posts de outras cidades." 
      });
    }

    // Verifica se o usuário já compartilhou
    const alreadyShared = report.shares.some(
      share => share.userId.toString() === userId
    );

    if (alreadyShared) {
      return res.status(200).json({
        message: "Você já compartilhou esta denúncia.",
        sharesCount: report.shares.length,
        alreadyShared: true,
      });
    }

    // Adiciona o compartilhamento
    report.shares.push({
      userId: userId,
      sharedAt: new Date(),
    });

    // Recalcula o score de engajamento
    report.engagementScore = calculateEngagementScore(report);
    report.lastScoreUpdate = new Date();

    await report.save();

    console.log(`📤 Share registrado - Report: ${reportId}, User: ${userId}, Total: ${report.shares.length}`);

    return res.status(200).json({
      message: "Compartilhamento registrado com sucesso.",
      sharesCount: report.shares.length,
      alreadyShared: false,
    });

  } catch (error) {
    console.error("❌ Erro ao registrar compartilhamento:", error);
    return res.status(500).json({ message: "Erro ao registrar compartilhamento." });
  }
};

