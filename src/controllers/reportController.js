const mongoose = require("mongoose");
const Report = require("../models/Report");
const City = require("../models/City");

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

    // Buscar a cidade associada à denúncia
    const cityData = await City.findOne({ id: city.id });

    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    let geoLocation = null;
    if (location && typeof location.lat === "number" && typeof location.lng === "number") {
      const { lat, lng, accuracy, collectedAt } = location;
      if (
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        geoLocation = {
          type: "Point",
          coordinates: [lng, lat],
          accuracy: typeof accuracy === "number" ? accuracy : undefined,
          collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
        };
      } else {
        return res.status(400).json({ message: "Coordenadas inválidas fornecidas." });
      }
    }

    // Criar o novo relatório
    const newReport = new Report({
      city,
      reportType,
      address,
      imageUrl,
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
    });

    if (geoLocation) {
      newReport.location = geoLocation;
    }

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

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    res.status(200).json(report);
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

    const reports = await Report.find({
      "city.id": cityId,
      location: { $exists: true, $ne: null },
      "location.coordinates": { $exists: true, $ne: null },
    })
      .select(
        "reportType address status bairro rua referencia location imageUrl createdAt updatedAt"
      )
      .sort({ createdAt: -1 });

    const formatted = reports
      .filter(
        (report) =>
          report.location &&
          Array.isArray(report.location.coordinates) &&
          report.location.coordinates.length === 2
      )
      .map((report) => ({
        _id: report._id,
        reportType: report.reportType,
        address: report.address,
        status: report.status,
        bairro: report.bairro,
        rua: report.rua,
        referencia: report.referencia,
        imageUrl: report.imageUrl,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        location: {
          lat: report.location.coordinates[1],
          lng: report.location.coordinates[0],
          accuracy: report.location.accuracy || null,
        },
      }));

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
