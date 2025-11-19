const mongoose = require("mongoose");
const PositivePost = require("../models/PositivePost");
const City = require("../models/City");

/**
 * Criar um novo post positivo
 * POST /api/positive-posts/create
 */
exports.createPositivePost = async (req, res) => {
  try {
    const {
      title,
      description,
      images,
      eventDate,
      location,
      city,
      category,
      status,
    } = req.body;

    // Obter informações do admin que está criando
    const adminId = req.admin?.userId;
    const adminName = req.admin?.name || "Administrador";
    const secretaria = req.admin?.secretaria || null;

    if (!adminId) {
      return res.status(401).json({
        message: "Acesso negado. Admin não identificado.",
      });
    }

    // Validações
    if (!title || !description || !images || !eventDate || !location || !city) {
      return res.status(400).json({
        message: "Campos obrigatórios: title, description, images, eventDate, location e city.",
      });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        message: "É necessário pelo menos uma imagem.",
      });
    }

    // Validar formato das imagens
    const validImages = images.map((img, index) => ({
      url: typeof img === "string" ? img : img.url,
      order: typeof img === "object" && img.order !== undefined ? img.order : index,
    }));

    // Buscar a cidade
    const cityData = await City.findOne({ id: city.id });
    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Preparar localização geográfica (opcional)
    let geoLocation = null;
    if (location.coordinates && location.coordinates.lat !== undefined && location.coordinates.lng !== undefined) {
      const lat = parseFloat(location.coordinates.lat);
      const lng = parseFloat(location.coordinates.lng);

      if (!isNaN(lat) && !isNaN(lng)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          geoLocation = {
            type: "Point",
            coordinates: [lng, lat],
          };
        }
      }
    }

    // Criar o post
    const postData = {
      title: title.trim(),
      description: description.trim(),
      images: validImages,
      eventDate: new Date(eventDate),
      location: {
        address: location.address,
        bairro: location.bairro || null,
        rua: location.rua || null,
        referencia: location.referencia || null,
        // Adicionar coordenadas apenas se válidas (para índice geoespacial sparse)
        ...(geoLocation && { coordinates: geoLocation }),
      },
      city: {
        id: city.id,
        label: city.label,
      },
      category: category || "outro",
      status: status || "publicado",
      createdBy: {
        adminId,
        adminName,
        secretaria,
      },
    };

    const newPost = new PositivePost(postData);
    await newPost.save();

    // Popular dados do admin
    await newPost.populate("createdBy.adminId", "name");

    res.status(201).json({
      message: "Post positivo criado com sucesso!",
      data: newPost,
    });
  } catch (error) {
    console.error("Erro ao criar post positivo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Listar posts positivos (feed)
 * GET /api/positive-posts/feed/:cityId
 */
exports.getPositivePostsFeed = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { page = 1, limit = 20, status = "publicado", category } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = {
      "city.id": cityId,
      status: status,
    };

    if (category) {
      filter.category = category;
    }

    const [posts, total] = await Promise.all([
      PositivePost.find(filter)
        .populate("createdBy.adminId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      PositivePost.countDocuments(filter),
    ]);

    // Calcular métricas de engajamento
    const userId = req.query.userId; // Para verificar se o usuário já interagiu
    const postsWithMetrics = posts.map((post) => {
      // Extrair apenas os IDs dos arrays de engajamento para verificar se o usuário já interagiu
      const likesIds = (post.likes || []).map((like) => 
        typeof like === 'object' && like.userId ? like.userId.toString() : like.toString()
      );
      const viewsIds = (post.views || []).map((view) => 
        typeof view === 'object' && view.userId ? view.userId.toString() : view.toString()
      );
      const sharesIds = (post.shares || []).map((share) => 
        typeof share === 'object' && share.userId ? share.userId.toString() : share.toString()
      );
      
      return {
        ...post,
        likes: likesIds,
        views: viewsIds,
        shares: sharesIds,
        likesCount: likesIds.length,
        viewsCount: viewsIds.length,
        sharesCount: sharesIds.length,
        location: post.location?.coordinates
          ? {
              lat: post.location.coordinates[1],
              lng: post.location.coordinates[0],
              address: post.location.address,
              bairro: post.location.bairro,
              rua: post.location.rua,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / parsedLimit);
    const hasMore = parsedPage < totalPages;

    res.status(200).json({
      cityId,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasMore,
      posts: postsWithMetrics,
    });
  } catch (error) {
    console.error("Erro ao buscar feed de posts positivos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Buscar post positivo por ID
 * GET /api/positive-posts/:id
 */
exports.getPositivePostById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const post = await PositivePost.findById(id)
      .populate("createdBy.adminId", "name")
      .lean();

    if (!post) {
      return res.status(404).json({ message: "Post não encontrado." });
    }

    const formattedPost = {
      ...post,
      likesCount: post.likes ? post.likes.length : 0,
      viewsCount: post.views ? post.views.length : 0,
      sharesCount: post.shares ? post.shares.length : 0,
      location: post.location?.coordinates
        ? {
            lat: post.location.coordinates[1],
            lng: post.location.coordinates[0],
            address: post.location.address,
            bairro: post.location.bairro,
            rua: post.location.rua,
            referencia: post.location.referencia,
          }
        : null,
    };

    res.status(200).json(formattedPost);
  } catch (error) {
    console.error("Erro ao buscar post positivo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Atualizar post positivo
 * PUT /api/positive-posts/:id
 */
exports.updatePositivePost = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      images,
      eventDate,
      location,
      category,
      status,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    // Buscar o post
    const post = await PositivePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post não encontrado." });
    }

    // Verificar se o admin tem permissão (criador ou super admin)
    const adminId = req.admin?.userId;
    const isSuperAdmin = req.admin?.isSuperAdmin;
    const isCreator = post.createdBy.adminId.toString() === adminId?.toString();

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        message: "Você não tem permissão para editar este post.",
      });
    }

    // Preparar atualizações
    const updates = {};

    if (title) updates.title = title.trim();
    if (description) updates.description = description.trim();
    if (images && Array.isArray(images) && images.length > 0) {
      updates.images = images.map((img, index) => ({
        url: typeof img === "string" ? img : img.url,
        order: typeof img === "object" && img.order !== undefined ? img.order : index,
      }));
    }
    if (eventDate) updates.eventDate = new Date(eventDate);
    if (category) updates.category = category;
    if (status) updates.status = status;

    if (location) {
      // Preparar objeto location completo (evitar conflito entre location e location.coordinates)
      const locationUpdate = {
        address: location.address || post.location?.address || "",
        bairro: location.bairro !== undefined ? location.bairro : post.location?.bairro || null,
        rua: location.rua !== undefined ? location.rua : post.location?.rua || null,
        referencia: location.referencia !== undefined ? location.referencia : post.location?.referencia || null,
      };

      // Adicionar coordenadas se fornecidas
      if (location.coordinates && location.coordinates.lat !== undefined && location.coordinates.lng !== undefined) {
        const lat = parseFloat(location.coordinates.lat);
        const lng = parseFloat(location.coordinates.lng);

        if (!isNaN(lat) && !isNaN(lng)) {
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            locationUpdate.coordinates = {
              type: "Point",
              coordinates: [lng, lat],
            };
          }
        }
      } else if (post.location?.coordinates) {
        // Manter coordenadas existentes se não foram fornecidas novas
        locationUpdate.coordinates = post.location.coordinates;
      }

      updates.location = locationUpdate;
    }

    const updatedPost = await PositivePost.findByIdAndUpdate(id, updates, {
      new: true,
    })
      .populate("createdBy.adminId", "name");

    res.status(200).json({
      message: "Post atualizado com sucesso!",
      data: updatedPost,
    });
  } catch (error) {
    console.error("Erro ao atualizar post positivo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Deletar post positivo
 * DELETE /api/positive-posts/:id
 */
exports.deletePositivePost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    // Buscar o post
    const post = await PositivePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post não encontrado." });
    }

    // Verificar permissão
    const adminId = req.admin?.userId;
    const isSuperAdmin = req.admin?.isSuperAdmin;
    const isCreator = post.createdBy.adminId.toString() === adminId?.toString();

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        message: "Você não tem permissão para deletar este post.",
      });
    }

    await PositivePost.findByIdAndDelete(id);

    res.status(200).json({ message: "Post deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar post positivo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Listar posts positivos por cidade (para admin)
 * GET /api/positive-posts/city/:cityId
 */
exports.getPositivePostsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { page = 1, limit = 20, status, category } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = { "city.id": cityId };

    if (status) filter.status = status;
    if (category) filter.category = category;

    const [posts, total] = await Promise.all([
      PositivePost.find(filter)
        .populate("createdBy.adminId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      PositivePost.countDocuments(filter),
    ]);

    const postsWithMetrics = posts.map((post) => ({
      ...post,
      likesCount: post.likes ? post.likes.length : 0,
      viewsCount: post.views ? post.views.length : 0,
      sharesCount: post.shares ? post.shares.length : 0,
    }));

    res.status(200).json({
      cityId,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
      posts: postsWithMetrics,
    });
  } catch (error) {
    console.error("Erro ao buscar posts por cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Buscar posts positivos próximos (por localização)
 * GET /api/positive-posts/nearby
 */
exports.getNearbyPositivePosts = async (req, res) => {
  try {
    const { lat, lng, radius = 5000, cityId, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Parâmetros obrigatórios: lat e lng.",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistance = parseInt(radius, 10) || 5000; // metros
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ message: "Coordenadas inválidas." });
    }

    const filter = {
      "location.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistance,
        },
      },
      status: "publicado",
    };

    if (cityId) {
      filter["city.id"] = cityId;
    }

    const posts = await PositivePost.find(filter)
      .populate("createdBy.adminId", "name")
      .limit(parsedLimit)
      .lean();

    const postsWithMetrics = posts.map((post) => ({
      ...post,
      likesCount: post.likes ? post.likes.length : 0,
      viewsCount: post.views ? post.views.length : 0,
      sharesCount: post.shares ? post.shares.length : 0,
      location: post.location?.coordinates
        ? {
            lat: post.location.coordinates[1],
            lng: post.location.coordinates[0],
            address: post.location.address,
          }
        : null,
    }));

    res.status(200).json({
      center: { lat: latitude, lng: longitude },
      radius: maxDistance,
      total: posts.length,
      posts: postsWithMetrics,
    });
  } catch (error) {
    console.error("Erro ao buscar posts próximos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/positive-posts/:id/like
 * Adiciona/remove like em um post positivo
 */
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, cityId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." });
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    const post = await PositivePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post não encontrado." });
    }

    // Validação de isolamento: verifica se o post pertence à cidade do usuário
    if (cityId && post.city.id !== cityId) {
      return res.status(403).json({
        message: "Você não pode interagir com posts de outras cidades.",
      });
    }

    // Verifica se o usuário já curtiu
    const likeIndex = post.likes.findIndex(
      (like) => like.userId.toString() === userId
    );

    let action = "";
    if (likeIndex > -1) {
      // Remove o like (descurtir)
      post.likes.splice(likeIndex, 1);
      action = "removed";
    } else {
      // Adiciona o like (formato do schema: { userId, likedAt })
      post.likes.push({
        userId: userId,
        likedAt: new Date(),
      });
      action = "added";
    }

    await post.save();

    return res.status(200).json({
      message: `Like ${action === "added" ? "adicionado" : "removido"} com sucesso.`,
      likesCount: post.likes.length,
      isLiked: action === "added",
    });
  } catch (error) {
    console.error("❌ Erro ao processar like:", error);
    return res.status(500).json({ message: "Erro ao processar like." });
  }
};

/**
 * POST /api/positive-posts/:id/view
 * Registra uma visualização (apenas 1 por usuário)
 */
exports.registerView = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, duration, cityId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." });
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    const post = await PositivePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post não encontrado." });
    }

    // Validação de isolamento
    if (cityId && post.city.id !== cityId) {
      return res.status(403).json({
        message: "Você não pode interagir com posts de outras cidades.",
      });
    }

    // Verifica se o usuário já visualizou
    const existingView = post.views.find(
      (view) => view.userId.toString() === userId
    );

    if (!existingView) {
      // Adiciona nova visualização (formato do schema: { userId, viewedAt, duration })
      post.views.push({
        userId: userId,
        viewedAt: new Date(),
        duration: duration || 0,
      });
      await post.save();
    }

    return res.status(200).json({
      message: "Visualização registrada com sucesso.",
      viewsCount: post.views.length,
    });
  } catch (error) {
    console.error("❌ Erro ao registrar visualização:", error);
    return res.status(500).json({ message: "Erro ao registrar visualização." });
  }
};

/**
 * POST /api/positive-posts/:id/share
 * Registra compartilhamento (apenas 1 por usuário)
 */
exports.registerShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, cityId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." });
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    const post = await PositivePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post não encontrado." });
    }

    // Validação de isolamento
    if (cityId && post.city.id !== cityId) {
      return res.status(403).json({
        message: "Você não pode interagir com posts de outras cidades.",
      });
    }

    // Verifica se o usuário já compartilhou
    const existingShare = post.shares.find(
      (share) => share.userId.toString() === userId
    );

    if (existingShare) {
      return res.status(200).json({
        message: "Você já compartilhou este post.",
        sharesCount: post.shares.length,
        alreadyShared: true,
      });
    }

    // Adiciona novo compartilhamento (formato do schema: { userId, sharedAt })
    post.shares.push({
      userId: userId,
      sharedAt: new Date(),
    });
    await post.save();

    return res.status(200).json({
      message: "Compartilhamento registrado com sucesso.",
      sharesCount: post.shares.length,
      alreadyShared: false,
    });
  } catch (error) {
    console.error("❌ Erro ao registrar compartilhamento:", error);
    return res.status(500).json({ message: "Erro ao registrar compartilhamento." });
  }
};

