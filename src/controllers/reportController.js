const mongoose = require("mongoose");
const Report = require("../models/Report");
const City = require("../models/City");
const { processAndUploadImage } = require("../services/imageProcessingService");

// Criar uma nova denúncia e associá-la à cidade
exports.createReport = async (req, res) => {
  try {
    const {
      reportType,
      address,
      imageUrl,
      city,
      referencia,
      rua,
      bairro,
      status,
      user,
      location,
    } = req.body;

    console.log("📦 Dados da denúncia recebidos:", JSON.stringify(req.body, null, 2));

    if (!reportType || !address || !city || !status || !user?.userId) {
      return res
        .status(400)
        .json({ message: "Todos os campos obrigatórios devem ser preenchidos (incluindo usuário)." });
    }

    // Processar imagem para compliance LGPD (aplicar blur em rostos e placas)
    let processedImageUrl = imageUrl;
    if (imageUrl && process.env.ENABLE_IMAGE_ANONYMIZATION === "true") {
      try {
        console.log("🔒 Processando imagem para compliance LGPD...");
        processedImageUrl = await processAndUploadImage(imageUrl);
        console.log("✅ Imagem processada:", processedImageUrl);
      } catch (error) {
        console.error("⚠️ Erro ao processar imagem, usando original:", error.message);
        // Continua com imagem original em caso de erro
        processedImageUrl = imageUrl;
      }
    }

    // Buscar a cidade associada à denúncia
    const cityData = await City.findOne({ id: city.id });

    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Valida e prepara a localização geográfica (opcional)
    let geoLocation = null;
    if (location && location.lat !== undefined && location.lng !== undefined) {
      const lat = parseFloat(location.lat);
      const lng = parseFloat(location.lng);
      
      // Verifica se são números válidos
      if (!isNaN(lat) && !isNaN(lng)) {
        // Valida o range das coordenadas
        if (
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          geoLocation = {
            type: "Point",
            coordinates: [lng, lat], // MongoDB usa [longitude, latitude]
            accuracy: typeof location.accuracy === "number" ? location.accuracy : undefined,
            collectedAt: location.collectedAt ? new Date(location.collectedAt) : new Date(),
          };
        } else {
          console.warn("⚠️ Coordenadas fora do range válido:", { lat, lng });
          // Não retorna erro, apenas ignora a localização inválida
        }
      } else {
        console.warn("⚠️ Coordenadas inválidas (não são números):", location);
        // Não retorna erro, apenas ignora a localização inválida
      }
    }

    // Criar o novo relatório
    const reportData = {
      city,
      reportType,
      address,
      imageUrl: processedImageUrl, // Usar imagem processada
      referencia,
      rua,
      bairro,
      status,
      user: {
        userId: user.userId,
        name: user.name,
        cpf: user.cpf,
        phone: user.phone || null,
      },
      declarationAccepted: {
        accepted: true,
        acceptedAt: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
      },
    };

    // Só adiciona location se houver coordenadas válidas
    if (geoLocation && geoLocation.coordinates && geoLocation.coordinates.length === 2) {
      reportData.location = geoLocation;
    }

    const newReport = new Report(reportData);

    console.log("✅ Nova denúncia:", JSON.stringify(newReport, null, 2));

    await newReport.save();

    // Adicionar o ID da denúncia ao reportList da cidade
    cityData.modules.reports.reportList.push(newReport._id);
    await cityData.save();

    res.status(201).json({
      message: "Denúncia criada com sucesso!",
      report: newReport,
    });
  } catch (error) {
    console.error("Erro ao criar denúncia:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar todas as denúncias
exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find();
    res.status(200).json(reports);
  } catch (error) {
    console.error("Erro ao listar denúncias:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar denúncias por usuário
exports.getReportsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    console.log("🔎 Buscando denúncias do usuário:", userId);

    const reports = await Report.find({ "user.userId": userId })
      .sort({ createdAt: -1 }); // Mais recentes primeiro

    console.log(`✅ Encontradas ${reports.length} denúncias do usuário`);

    res.status(200).json(reports);
  } catch (error) {
    console.error("Erro ao buscar denúncias do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar denúncia por ID
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    // Busca o report completo com todos os dados populados
    const report = await Report.findById(id)
      .populate("user.userId", "name profileImage cpf phone"); // Popula dados completos do usuário

    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Formata a resposta para incluir métricas de engajamento
    const formattedReport = {
      ...report.toObject(),
      likesCount: report.likes ? report.likes.length : 0,
      viewsCount: report.views ? report.views.length : 0,
      sharesCount: report.shares ? report.shares.length : 0,
      // Formata location se existir
      location: report.location && report.location.coordinates ? {
        lat: report.location.coordinates[1],
        lng: report.location.coordinates[0],
        accuracy: report.location.accuracy || null,
        collectedAt: report.location.collectedAt || null,
      } : null,
    };

    res.status(200).json(formattedReport);
  } catch (error) {
    console.error("Erro ao buscar denúncia por ID:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar denúncia e removê-la do reportList da cidade
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const report = await Report.findByIdAndDelete(id);

    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Remover o ID da denúncia do reportList da cidade associada
    await City.findOneAndUpdate(
      { id: report.city.id },
      { $pull: { "modules.reports.reportList": id } }
    );

    res.status(200).json({ message: "Denúncia deletada com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar denúncia:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.getReportsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;

    if (!cityId) {
      return res.status(400).json({ message: "ID da cidade é obrigatório." });
    }

    const cityData = await City.findOne({ id: cityId }).populate(
      "modules.reports.reportList"
    );

    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res.status(200).json(cityData.modules.reports.reportList);
  } catch (error) {
    console.error("Erro ao buscar denúncias por cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.getReportsForMap = async (req, res) => {
  try {
    const { cityId } = req.params;

    if (!cityId) {
      return res.status(400).json({ message: "ID da cidade é obrigatório." });
    }

    // Busca todos os reports com localização válida, incluindo todos os campos necessários
    const reports = await Report.find({
      "city.id": cityId,
      location: { $exists: true, $ne: null },
      "location.coordinates": { $exists: true, $ne: null },
    })
      .populate("user.userId", "name profileImage") // Popula dados do usuário para a modal
      .sort({ createdAt: -1 });

    const formatted = reports
      .filter(
        (report) =>
          report.location &&
          Array.isArray(report.location.coordinates) &&
          report.location.coordinates.length === 2
      )
      .map((report) => {
        // Retorna todos os dados necessários para a modal funcionar corretamente
        const formattedReport = {
          _id: report._id,
          reportType: report.reportType,
          address: report.address,
          status: report.status,
          bairro: report.bairro,
          rua: report.rua,
          referencia: report.referencia,
          imageUrl: report.imageUrl,
          city: report.city,
          user: report.user,
          declarationAccepted: report.declarationAccepted,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          // Métricas de engajamento (necessárias para a modal)
          likesCount: report.likes ? report.likes.length : 0,
          viewsCount: report.views ? report.views.length : 0,
          sharesCount: report.shares ? report.shares.length : 0,
          engagementScore: report.engagementScore || 0,
          // Localização formatada para o mapa
          location: {
            lat: report.location.coordinates[1],
            lng: report.location.coordinates[0],
            accuracy: report.location.accuracy || null,
            collectedAt: report.location.collectedAt || null,
          },
        };

        // Adiciona arrays de likes, views e shares se necessário (para verificar se usuário já interagiu)
        if (report.likes && report.likes.length > 0) {
          formattedReport.likes = report.likes.map(like => ({
            userId: like.userId,
            likedAt: like.likedAt,
          }));
        }

        return formattedReport;
      });

    return res.status(200).json({
      cityId,
      total: formatted.length,
      reports: formatted,
    });
  } catch (error) {
    console.error("Erro ao buscar denúncias para o mapa:", error);
    return res
      .status(500)
      .json({ message: "Erro interno do servidor ao carregar o mapa." });
  }
};
