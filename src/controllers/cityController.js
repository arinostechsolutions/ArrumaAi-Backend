const City = require("../models/City");
const Report = require("../models/Report");

// Criar uma cidade com módulos configuráveis
exports.createCity = async (req, res) => {
  try {
    const { id, label, bairros, menu, modules } = req.body;

    if (!id || !label || !bairros || !menu || !modules) {
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    }

    const newCity = new City({
      id,
      label,
      bairros,
      menu,
      modules: {
        healthAppointments: modules.healthAppointments || {
          healthServices: [],
        },
        iptu: modules.iptu || {},
        reports: modules.reports || { reportTypes: [], reportList: [] },
      },
    });

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

// Buscar cidade por ID e populando a lista de denúncias
exports.getCityById = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findOne({ id }).populate(
      "modules.reports.reportList"
    );

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res.status(200).json(city);
  } catch (error) {
    console.error("Erro ao buscar cidade por ID:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar o menu de uma cidade
exports.updateMenuByCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { menu } = req.body;

    if (!menu || !Array.isArray(menu)) {
      return res
        .status(400)
        .json({ message: "Menu deve ser um array válido." });
    }

    const updatedCity = await City.findOneAndUpdate(
      { id },
      { $set: { menu } },
      { new: true }
    );

    if (!updatedCity) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res
      .status(200)
      .json({ message: "Menu atualizado com sucesso", city: updatedCity });
  } catch (error) {
    console.error("Erro ao atualizar menu:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar os tipos de denúncia dentro do módulo de reports
exports.updateReportTypesByCity = async (req, res) => {
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
      { $set: { "modules.reports.reportTypes": reportTypes } },
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

// Atualizar módulos da cidade
exports.updateModulesByCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { modules } = req.body;

    if (!modules) {
      return res.status(400).json({ message: "Os módulos são obrigatórios." });
    }

    const updatedCity = await City.findOneAndUpdate(
      { id },
      { $set: { modules } },
      { new: true }
    );

    if (!updatedCity) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res
      .status(200)
      .json({ message: "Módulos atualizados com sucesso!", city: updatedCity });
  } catch (error) {
    console.error("Erro ao atualizar módulos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar cidade e remover todas as denúncias associadas
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar a cidade para remover os relatórios associados
    const city = await City.findOne({ id });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Remover todos os relatórios dessa cidade
    await Report.deleteMany({ "city.id": id });

    // Remover a cidade do banco de dados
    await City.findOneAndDelete({ id });

    res.status(200).json({
      message: "Cidade e denúncias associadas removidas com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
