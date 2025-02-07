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
      status,
      description,
    } = req.body;

    if (!reportType || !address || !city || !status) {
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    }

    // Buscar a cidade associada à denúncia
    const cityData = await City.findOne({ id: city.id });

    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Criar o novo relatório
    const newReport = new Report({
      city,
      reportType,
      address,
      imageUrl,
      referencia,
      rua,
      status,
      description,
    });

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

// Buscar todas as denúncias de uma cidade
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

    if (!cityData.modules.reports.enabled) {
      return res.status(403).json({
        message: "Este município não possui o módulo de denúncias ativo.",
      });
    }

    res.status(200).json(cityData.modules.reports.reportList);
  } catch (error) {
    console.error("Erro ao buscar denúncias por cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
