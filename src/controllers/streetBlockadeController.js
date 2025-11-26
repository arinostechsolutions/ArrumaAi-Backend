const moment = require("moment-timezone");
const StreetBlockade = require("../models/StreetBlockade");
const City = require("../models/City");

// Criar uma nova interdição de rua
exports.createBlockade = async (req, res) => {
  try {
    const {
      cityId,
      route,
      type,
      reason,
      startDate,
      endDate,
      alternativeRoute,
      impact,
      internalNotes,
    } = req.body;

    if (!cityId || !route || !type || !reason || !startDate) {
      return res.status(400).json({
        message: "Todos os campos obrigatórios devem ser preenchidos.",
      });
    }

    // Validar coordenadas mínimas
    if (!route.coordinates || route.coordinates.length < 2) {
      return res.status(400).json({
        message: "É necessário pelo menos 2 pontos para definir um trecho interditado.",
      });
    }

    // Validar datas
    const start = new Date(startDate);
    let end = null;
    
    if (endDate) {
      end = new Date(endDate);
      if (end <= start) {
        return res.status(400).json({
          message: "Data de término deve ser posterior à data de início.",
        });
      }
    }

    // Verificar se a cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Verificar se há admin autenticado
    if (!req.admin || !req.admin.userId) {
      console.error("❌ Erro: req.admin não encontrado ou userId ausente");
      console.error("req.admin:", req.admin);
      return res.status(401).json({
        message: "Acesso negado. Autenticação de administrador necessária.",
      });
    }

    console.log("✅ Admin autenticado:", {
      userId: req.admin.userId,
      name: req.admin.name,
      isSuperAdmin: req.admin.isSuperAdmin,
      isMayor: req.admin.isMayor,
      secretaria: req.admin.secretaria,
    });

    // Criar interdição
    const newBlockade = new StreetBlockade({
      cityId,
      route: {
        coordinates: route.coordinates.map((coord, index) => ({
          lat: coord.lat,
          lng: coord.lng,
          order: coord.order !== undefined ? coord.order : index,
        })),
        streetName: route.streetName,
        neighborhood: route.neighborhood,
        description: route.description,
      },
      type,
      reason,
      startDate: start,
      endDate: end || undefined, // endDate é opcional
      alternativeRoute: alternativeRoute
        ? {
            coordinates: alternativeRoute.coordinates?.map((coord, index) => ({
              lat: coord.lat,
              lng: coord.lng,
              order: coord.order !== undefined ? coord.order : index,
            })),
            description: alternativeRoute.description,
          }
        : undefined,
      impact: impact || { level: "medio" },
      internalNotes,
      createdBy: {
        adminId: req.admin.userId, // userId já é o _id do User
        adminName: req.admin.name || "Admin",
        secretaria: req.admin.secretaria || null,
      },
    });

    await newBlockade.save();

    res.status(201).json({
      message: "Interdição criada com sucesso!",
      blockade: newBlockade,
    });
  } catch (error) {
    console.error("Erro ao criar interdição:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

// Buscar interdições ativas para o mapa (público)
exports.getActiveBlockadesForMap = async (req, res) => {
  try {
    const { cityId } = req.params;

    if (!cityId) {
      return res.status(400).json({ message: "ID da cidade é obrigatório." });
    }

    const now = new Date();
    const blockades = await StreetBlockade.find({
      cityId,
      status: { $in: ["agendado", "ativo"] },
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate("createdBy.adminId", "name")
      .sort({ startDate: 1 })
      .lean();

    // Formatar para o mapa
    const formatted = blockades.map((blockade) => ({
      _id: blockade._id,
      cityId: blockade.cityId,
      route: {
        coordinates: blockade.route.coordinates.map((coord) => ({
          lat: coord.lat,
          lng: coord.lng,
        })),
        streetName: blockade.route.streetName,
        neighborhood: blockade.route.neighborhood,
        description: blockade.route.description,
      },
      type: blockade.type,
      reason: blockade.reason,
      startDate: blockade.startDate,
      endDate: blockade.endDate,
      status: blockade.status,
      alternativeRoute: blockade.alternativeRoute,
      impact: blockade.impact,
    }));

    res.status(200).json({
      cityId,
      total: formatted.length,
      blockades: formatted,
    });
  } catch (error) {
    console.error("Erro ao buscar interdições para o mapa:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao carregar interdições.",
    });
  }
};

// Buscar todas as interdições ativas (público - lista)
exports.getActiveBlockades = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!cityId) {
      return res.status(400).json({ message: "ID da cidade é obrigatório." });
    }

    const now = new Date();
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [blockades, total] = await Promise.all([
      StreetBlockade.find({
        cityId,
        status: { $in: ["agendado", "ativo"] },
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .populate("createdBy.adminId", "name")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StreetBlockade.countDocuments({
        cityId,
        status: { $in: ["agendado", "ativo"] },
        startDate: { $lte: now },
        endDate: { $gte: now },
      }),
    ]);

    res.status(200).json({
      blockades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar interdições ativas:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// Buscar todas as interdições (admin - com histórico)
exports.getAllBlockades = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    if (!cityId) {
      return res.status(400).json({ message: "ID da cidade é obrigatório." });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { cityId };

    if (status) {
      query.status = status;
    }

    const [blockades, total] = await Promise.all([
      StreetBlockade.find(query)
        .populate("createdBy.adminId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StreetBlockade.countDocuments(query),
    ]);

    res.status(200).json({
      blockades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar interdições:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// Buscar interdição por ID
exports.getBlockadeById = async (req, res) => {
  try {
    const { id } = req.params;

    const blockade = await StreetBlockade.findById(id)
      .populate("createdBy.adminId", "name")
      .lean();

    if (!blockade) {
      return res.status(404).json({ message: "Interdição não encontrada." });
    }

    res.status(200).json(blockade);
  } catch (error) {
    console.error("Erro ao buscar interdição:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// Atualizar interdição
exports.updateBlockade = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      route,
      type,
      reason,
      startDate,
      endDate,
      alternativeRoute,
      impact,
      internalNotes,
    } = req.body;

    const blockade = await StreetBlockade.findById(id);

    if (!blockade) {
      return res.status(404).json({ message: "Interdição não encontrada." });
    }

    // Validar coordenadas se fornecidas
    if (route?.coordinates && route.coordinates.length < 2) {
      return res.status(400).json({
        message: "É necessário pelo menos 2 pontos para definir um trecho interditado.",
      });
    }

    // Validar datas se fornecidas
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end <= start) {
        return res.status(400).json({
          message: "Data de término deve ser posterior à data de início.",
        });
      }
    }

    // Atualizar campos
    if (route) {
      blockade.route = {
        coordinates: route.coordinates.map((coord, index) => ({
          lat: coord.lat,
          lng: coord.lng,
          order: coord.order !== undefined ? coord.order : index,
        })),
        streetName: route.streetName,
        neighborhood: route.neighborhood,
        description: route.description,
      };
    }

    if (type) blockade.type = type;
    if (reason) blockade.reason = reason;
    if (startDate) blockade.startDate = new Date(startDate);
    if (endDate !== undefined) {
      // Permitir remover endDate enviando null ou string vazia
      if (endDate === null || endDate === "") {
        blockade.endDate = undefined;
      } else {
        blockade.endDate = new Date(endDate);
      }
    }
    if (impact) blockade.impact = impact;
    if (internalNotes !== undefined) blockade.internalNotes = internalNotes;

    if (alternativeRoute) {
      blockade.alternativeRoute = {
        coordinates: alternativeRoute.coordinates?.map((coord, index) => ({
          lat: coord.lat,
          lng: coord.lng,
          order: coord.order !== undefined ? coord.order : index,
        })),
        description: alternativeRoute.description,
      };
    }

    await blockade.save();

    res.status(200).json({
      message: "Interdição atualizada com sucesso!",
      blockade,
    });
  } catch (error) {
    console.error("Erro ao atualizar interdição:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

// Atualizar status da interdição
exports.updateBlockadeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["agendado", "ativo", "encerrado", "cancelado"].includes(status)) {
      return res.status(400).json({
        message: "Status inválido.",
      });
    }

    const blockade = await StreetBlockade.findById(id);

    if (!blockade) {
      return res.status(404).json({ message: "Interdição não encontrada." });
    }

    blockade.status = status;
    await blockade.save();

    res.status(200).json({
      message: "Status da interdição atualizado com sucesso!",
      blockade,
    });
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// Deletar interdição
exports.deleteBlockade = async (req, res) => {
  try {
    const { id } = req.params;

    const blockade = await StreetBlockade.findByIdAndDelete(id);

    if (!blockade) {
      return res.status(404).json({ message: "Interdição não encontrada." });
    }

    res.status(200).json({
      message: "Interdição removida com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar interdição:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// Rota temporária para remover índice problemático (pode ser removida depois)
exports.removeProblematicIndex = async (req, res) => {
  try {
    const StreetBlockade = require("../models/StreetBlockade");
    const indexes = await StreetBlockade.collection.getIndexes();
    
    console.log("📋 Índices existentes:", Object.keys(indexes));
    
    const problematicIndexes = Object.keys(indexes).filter(name => 
      name.includes('2dsphere') || (name.includes('coordinates') && name.includes('2dsphere'))
    );
    
    if (problematicIndexes.length === 0) {
      return res.status(200).json({
        message: "Nenhum índice problemático encontrado.",
        indexes: Object.keys(indexes),
      });
    }
    
    const removed = [];
    for (const indexName of problematicIndexes) {
      try {
        await StreetBlockade.collection.dropIndex(indexName);
        removed.push(indexName);
        console.log(`✅ Índice removido: ${indexName}`);
      } catch (error) {
        console.error(`❌ Erro ao remover ${indexName}:`, error.message);
      }
    }
    
    res.status(200).json({
      message: "Índices problemáticos removidos com sucesso!",
      removed,
      remainingIndexes: Object.keys(await StreetBlockade.collection.getIndexes()),
    });
  } catch (error) {
    console.error("❌ Erro ao remover índices:", error);
    res.status(500).json({
      message: "Erro ao remover índices.",
      error: error.message,
    });
  }
};

// Job para atualizar status automaticamente (pode ser chamado por cron)
exports.updateExpiredBlockades = async (req, res) => {
  try {
    const now = new Date();
    
    // Encerrar interdições que passaram da data de término
    const result = await StreetBlockade.updateMany(
      {
        status: { $in: ["agendado", "ativo"] },
        endDate: { $lt: now },
      },
      {
        $set: { status: "encerrado" },
      }
    );

    // Ativar interdições agendadas que já começaram
    await StreetBlockade.updateMany(
      {
        status: "agendado",
        startDate: { $lte: now },
        endDate: { $gte: now },
      },
      {
        $set: { status: "ativo" },
      }
    );

    res.status(200).json({
      message: "Status das interdições atualizados com sucesso!",
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("Erro ao atualizar interdições expiradas:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

