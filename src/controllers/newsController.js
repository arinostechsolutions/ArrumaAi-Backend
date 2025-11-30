const News = require("../models/News");
const City = require("../models/City");
const mongoose = require("mongoose");
const { notifyNewNews } = require("../services/notificationService");

/**
 * POST /api/news
 * Criar nova notícia
 */
exports.createNews = async (req, res) => {
  try {
    const {
      cityId,
      title,
      content,
      summary,
      imageUrl,
      status,
      category,
      tags,
      isHighlighted,
      publishedAt,
    } = req.body;

    // Validações
    if (!cityId || !title || !content) {
      return res.status(400).json({
        message: "Campos obrigatórios: cityId, title, content",
      });
    }

    // Verificar se a cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Definir publishedAt automaticamente na criação (data/hora atual)
    // Se não foi fornecido, usa a data/hora atual
    let finalPublishedAt = publishedAt ? new Date(publishedAt) : new Date();

    const newNews = new News({
      cityId,
      title: title.trim(),
      content,
      summary: summary?.trim() || null,
      imageUrl: imageUrl || null,
      status: status || "rascunho",
      category: category || "geral",
      tags: tags || [],
      isHighlighted: isHighlighted || false,
      publishedAt: finalPublishedAt || null,
      createdBy: {
        adminId: req.admin.userId,
        adminName: req.admin.name || "Admin",
        role: req.admin.isSuperAdmin ? "super_admin" : req.admin.isMayor ? "mayor" : "secretaria",
      },
    });

    await newNews.save();

    // Se a notícia foi publicada, enviar notificação para os usuários
    if (newNews.status === "publicado") {
      notifyNewNews(newNews, {
        adminId: req.admin.userId,
        adminName: req.admin.name || "Prefeitura",
        secretaria: req.admin.secretaria,
      }).catch((err) => {
        console.error("❌ Erro ao enviar notificações de notícia:", err);
      });
    }

    res.status(201).json({
      message: "Notícia criada com sucesso!",
      news: newNews,
    });
  } catch (error) {
    console.error("Erro ao criar notícia:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

/**
 * GET /api/news/city/:cityId
 * Listar notícias de uma cidade
 */
exports.getNewsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { status, category, page = 1, limit = 20, includeDrafts } = req.query;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    // Construir query
    const query = { cityId };

    // Se for admin, pode ver rascunhos se includeDrafts=true
    if (req.admin && includeDrafts === "true") {
      // Admin pode ver tudo
    } else {
      // Público só vê publicadas
      query.status = "publicado";
    }

    // Filtros opcionais
    if (status && status !== "all") {
      query.status = status;
    }

    if (category && category !== "all") {
      query.category = category;
    }

    // Paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await News.countDocuments(query);

    const news = await News.find(query)
      .sort({ isHighlighted: -1, publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      news,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/news/:id
 * Buscar notícia por ID
 */
exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const news = await News.findById(id).lean();

    if (!news) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    // Se não for admin e notícia não estiver publicada, retornar erro
    if (!req.admin && news.status !== "publicado") {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    // Incrementar contador de visualizações (apenas para publicadas)
    if (news.status === "publicado") {
      await News.findByIdAndUpdate(id, { $inc: { views: 1 } });
      news.views = (news.views || 0) + 1;
    }

    res.status(200).json(news);
  } catch (error) {
    console.error("Erro ao buscar notícia:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PUT /api/news/:id
 * Atualizar notícia
 */
exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      summary,
      imageUrl,
      status,
      category,
      tags,
      isHighlighted,
      publishedAt,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const news = await News.findById(id);
    if (!news) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    // Verificar permissões
    const adminId = req.admin?.userId;
    const isSuperAdmin = req.admin?.isSuperAdmin;
    const isCreator = news.createdBy.adminId.toString() === adminId?.toString();

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        message: "Você não tem permissão para editar esta notícia.",
      });
    }

    // Atualizar campos
    if (title !== undefined) news.title = title.trim();
    if (content !== undefined) news.content = content;
    if (summary !== undefined) news.summary = summary?.trim() || null;
    if (imageUrl !== undefined) news.imageUrl = imageUrl || null;
    if (status !== undefined) {
      news.status = status;
      // Se mudando para publicado e não tem publishedAt, definir agora
      if (status === "publicado" && !news.publishedAt) {
        news.publishedAt = new Date();
      }
      // Se mudando de publicado para outro status, manter publishedAt
    }
    if (category !== undefined) news.category = category;
    if (tags !== undefined) news.tags = tags;
    if (isHighlighted !== undefined) news.isHighlighted = isHighlighted;
    if (publishedAt !== undefined) {
      news.publishedAt = publishedAt || null;
    }

    await news.save();

    res.status(200).json({
      message: "Notícia atualizada com sucesso!",
      news,
    });
  } catch (error) {
    console.error("Erro ao atualizar notícia:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

/**
 * DELETE /api/news/:id
 * Deletar notícia
 */
exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const news = await News.findById(id);
    if (!news) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    // Verificar permissões
    const adminId = req.admin?.userId;
    const isSuperAdmin = req.admin?.isSuperAdmin;
    const isCreator = news.createdBy.adminId.toString() === adminId?.toString();

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        message: "Você não tem permissão para deletar esta notícia.",
      });
    }

    await News.findByIdAndDelete(id);

    res.status(200).json({
      message: "Notícia removida com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar notícia:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};


