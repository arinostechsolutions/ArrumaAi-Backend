const City = require("../models/City");

// Helper: Verificar permissões de cidade
const checkCityPermission = (admin, cityId) => {
  if (admin.isSuperAdmin) return true;
  if (admin.isMayor && admin.allowedCities.includes(cityId)) return true;
  if (admin.secretaria && admin.allowedCities.includes(cityId)) return true;
  return false;
};

// Listar todas as unidades de saúde de uma cidade
exports.getHealthServices = async (req, res) => {
  try {
    const { cityId } = req.params;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    // Verificar permissão
    if (!checkCityPermission(req.admin, cityId)) {
      return res.status(403).json({
        message: "Acesso negado. Você não tem permissão para acessar esta cidade.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const healthServices =
      city.modules?.healthAppointments?.healthServices || [];

    res.status(200).json({
      city: {
        id: city.id,
        label: city.label,
      },
      healthServices,
    });
  } catch (error) {
    console.error("Erro ao buscar unidades de saúde:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Criar nova unidade de saúde
exports.createHealthService = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { id, name, address } = req.body;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    if (!id || !name || !address) {
      return res.status(400).json({
        message: "Campos obrigatórios: id, name, address.",
      });
    }

    // Verificar permissão
    if (!checkCityPermission(req.admin, cityId)) {
      return res.status(403).json({
        message: "Acesso negado. Você não tem permissão para modificar esta cidade.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Inicializar módulo se não existir
    if (!city.modules.healthAppointments) {
      city.modules.healthAppointments = { healthServices: [] };
    }

    if (!city.modules.healthAppointments.healthServices) {
      city.modules.healthAppointments.healthServices = [];
    }

    // Verificar se já existe unidade com mesmo id
    const existingService = city.modules.healthAppointments.healthServices.find(
      (s) => s.id === id
    );

    if (existingService) {
      return res.status(400).json({
        message: "Já existe uma unidade de saúde com este ID.",
      });
    }

    // Criar nova unidade
    const newService = {
      id,
      name,
      address,
      availableSpecialties: [],
      availableExams: [],
    };

    city.modules.healthAppointments.healthServices.push(newService);
    await city.save();

    res.status(201).json({
      message: "Unidade de saúde criada com sucesso!",
      healthService: newService,
    });
  } catch (error) {
    console.error("Erro ao criar unidade de saúde:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar unidade de saúde
exports.updateHealthService = async (req, res) => {
  try {
    const { cityId, serviceId } = req.params;
    const { name, address } = req.body;

    if (!cityId || !serviceId) {
      return res.status(400).json({
        message: "ID da cidade e ID da unidade são obrigatórios.",
      });
    }

    // Verificar permissão
    if (!checkCityPermission(req.admin, cityId)) {
      return res.status(403).json({
        message: "Acesso negado. Você não tem permissão para modificar esta cidade.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const healthServices =
      city.modules?.healthAppointments?.healthServices || [];

    const serviceIndex = healthServices.findIndex((s) => s.id === serviceId);

    if (serviceIndex === -1) {
      return res.status(404).json({
        message: "Unidade de saúde não encontrada.",
      });
    }

    // Atualizar campos
    if (name) {
      healthServices[serviceIndex].name = name;
    }

    if (address) {
      healthServices[serviceIndex].address = address;
    }

    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(200).json({
      message: "Unidade de saúde atualizada com sucesso!",
      healthService: healthServices[serviceIndex],
    });
  } catch (error) {
    console.error("Erro ao atualizar unidade de saúde:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar unidade de saúde
exports.deleteHealthService = async (req, res) => {
  try {
    const { cityId, serviceId } = req.params;

    if (!cityId || !serviceId) {
      return res.status(400).json({
        message: "ID da cidade e ID da unidade são obrigatórios.",
      });
    }

    // Verificar permissão
    if (!checkCityPermission(req.admin, cityId)) {
      return res.status(403).json({
        message: "Acesso negado. Você não tem permissão para modificar esta cidade.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const healthServices =
      city.modules?.healthAppointments?.healthServices || [];

    const serviceIndex = healthServices.findIndex((s) => s.id === serviceId);

    if (serviceIndex === -1) {
      return res.status(404).json({
        message: "Unidade de saúde não encontrada.",
      });
    }

    // Remover unidade
    healthServices.splice(serviceIndex, 1);
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(200).json({
      message: "Unidade de saúde deletada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar unidade de saúde:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};




