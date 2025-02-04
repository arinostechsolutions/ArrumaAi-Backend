const City = require("../models/Cities");

// Criar uma cidade
exports.createCity = async (req, res) => {
  try {
    const { id, label, bairros, reportTypes, users } = req.body;

    if (!id || !label || !bairros || !reportTypes) {
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    }

    const newCity = new City({ id, label, bairros, reportTypes, users });

    await newCity.save();
    res
      .status(201)
      .json({ message: "Cidade criada com sucesso!", city: newCity });
  } catch (error) {
    console.error("Erro ao criar cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar todas as cidades
exports.getAllCities = async (req, res) => {
  try {
    const cities = await City.find();
    res.status(200).json(cities);
  } catch (error) {
    console.error("Erro ao buscar cidades:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar cidade por ID
exports.getCityById = async (req, res) => {
  try {
    const { id } = req.params;
    const city = await City.findOne({ id });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res.status(200).json(city);
  } catch (error) {
    console.error("Erro ao buscar cidade por ID:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar cidade
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;
    const city = await City.findOneAndDelete({ id });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res.status(200).json({ message: "Cidade deletada com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.updateReportTypes = async (req, res) => {
  try {
    const { id } = req.params;
    const { reportTypes } = req.body;

    if (!reportTypes || !Array.isArray(reportTypes)) {
      return res
        .status(400)
        .json({ message: "reportTypes deve ser um array válido." });
    }

    const updatedCity = await City.findOneAndUpdate(
      { id },
      { $set: { reportTypes } },
      { new: true }
    );

    if (!updatedCity) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res.status(200).json({
      message: "Tipos de denúncia atualizados com sucesso!",
      city: updatedCity,
    });
  } catch (error) {
    console.error("Erro ao atualizar reportTypes:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
