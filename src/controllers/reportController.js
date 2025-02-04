// src/controllers/reportController.js
const mongoose = require("mongoose");
const Report = require("../models/Report");

// Função para criar uma nova denúncia
exports.createReport = async (req, res) => {
  try {
    const { reportType, address, imageUrl, city, referencia, rua, status } =
      req.body;

    if (!reportType || !address || !city || !status) {
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    }

    const newReport = new Report({
      city,
      reportType,
      address,
      imageUrl,
      referencia,
      rua,
      status,
    });

    await newReport.save();

    res.status(201).json({
      message: "Denúncia criada com sucesso!",
      report: {
        _id: newReport._id,
        city: newReport.city,
        reportType: newReport.reportType,
        address: newReport.address,
        imageUrl: newReport.imageUrl,
        createdAt: newReport.createdAt,
        referencia: newReport.referencia,
        rua: newReport.rua,
        status: newReport.status,
      },
    });
  } catch (error) {
    console.error("Erro ao criar denúncia:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find();
    res.status(200).json(reports);
  } catch (error) {
    console.error("Erro ao listar denúncias:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

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

exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o ID é válido
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const report = await Report.findByIdAndDelete(id);

    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    res.status(200).json({ message: "Denúncia deletada com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar denúncia:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
