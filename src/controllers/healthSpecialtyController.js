const City = require("../models/City");

// Helper: Verificar permissões de cidade
const checkCityPermission = (admin, cityId) => {
  if (admin.isSuperAdmin) return true;
  if (admin.isMayor && admin.allowedCities.includes(cityId)) return true;
  if (admin.secretaria && admin.allowedCities.includes(cityId)) return true;
  return false;
};

// Listar especialidades de uma unidade de saúde
exports.getSpecialties = async (req, res) => {
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
        message: "Acesso negado. Você não tem permissão para acessar esta cidade.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const healthServices =
      city.modules?.healthAppointments?.healthServices || [];

    const service = healthServices.find((s) => s.id === serviceId);

    if (!service) {
      return res.status(404).json({
        message: "Unidade de saúde não encontrada.",
      });
    }

    const specialties = service.availableSpecialties || [];

    res.status(200).json({
      city: { id: city.id, label: city.label },
      service: { id: service.id, name: service.name },
      specialties,
    });
  } catch (error) {
    console.error("Erro ao buscar especialidades:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Criar nova especialidade
exports.createSpecialty = async (req, res) => {
  try {
    const { cityId, serviceId } = req.params;
    const { id, label, availableDays, morningLimit, afternoonLimit } = req.body;

    if (!cityId || !serviceId) {
      return res.status(400).json({
        message: "ID da cidade e ID da unidade são obrigatórios.",
      });
    }

    if (!id || !label || !availableDays || !Array.isArray(availableDays)) {
      return res.status(400).json({
        message:
          "Campos obrigatórios: id, label, availableDays (array). Opcionais: morningLimit, afternoonLimit.",
      });
    }

    // Validar dias da semana
    const validDays = [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
    ];

    const invalidDays = availableDays.filter(
      (day) => !validDays.includes(day)
    );

    if (invalidDays.length > 0) {
      return res.status(400).json({
        message: `Dias inválidos: ${invalidDays.join(", ")}. Use: ${validDays.join(", ")}.`,
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

    // Verificar se já existe especialidade com mesmo id
    const existingSpecialty = healthServices[
      serviceIndex
    ].availableSpecialties.find((s) => s.id === id);

    if (existingSpecialty) {
      return res.status(400).json({
        message: "Já existe uma especialidade com este ID nesta unidade.",
      });
    }

    // Criar nova especialidade
    const newSpecialty = {
      id,
      label,
      operatingHours: {
        availableDays,
        shifts: {
          morning: {
            dailyLimit: morningLimit !== undefined ? parseInt(morningLimit) : 0,
          },
          afternoon: {
            dailyLimit:
              afternoonLimit !== undefined ? parseInt(afternoonLimit) : 0,
          },
        },
      },
    };

    if (!healthServices[serviceIndex].availableSpecialties) {
      healthServices[serviceIndex].availableSpecialties = [];
    }

    healthServices[serviceIndex].availableSpecialties.push(newSpecialty);
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(201).json({
      message: "Especialidade criada com sucesso!",
      specialty: newSpecialty,
    });
  } catch (error) {
    console.error("Erro ao criar especialidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar especialidade
exports.updateSpecialty = async (req, res) => {
  try {
    const { cityId, serviceId, specialtyId } = req.params;
    const { label, availableDays, morningLimit, afternoonLimit } = req.body;

    if (!cityId || !serviceId || !specialtyId) {
      return res.status(400).json({
        message:
          "ID da cidade, ID da unidade e ID da especialidade são obrigatórios.",
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

    const specialties =
      healthServices[serviceIndex].availableSpecialties || [];

    const specialtyIndex = specialties.findIndex((s) => s.id === specialtyId);

    if (specialtyIndex === -1) {
      return res.status(404).json({
        message: "Especialidade não encontrada.",
      });
    }

    // Atualizar campos
    if (label) {
      specialties[specialtyIndex].label = label;
    }

    if (availableDays && Array.isArray(availableDays)) {
      const validDays = [
        "domingo",
        "segunda",
        "terça",
        "quarta",
        "quinta",
        "sexta",
        "sábado",
      ];

      const invalidDays = availableDays.filter(
        (day) => !validDays.includes(day)
      );

      if (invalidDays.length > 0) {
        return res.status(400).json({
          message: `Dias inválidos: ${invalidDays.join(", ")}.`,
        });
      }

      specialties[specialtyIndex].operatingHours.availableDays =
        availableDays;
    }

    if (morningLimit !== undefined) {
      specialties[specialtyIndex].operatingHours.shifts.morning.dailyLimit =
        parseInt(morningLimit);
    }

    if (afternoonLimit !== undefined) {
      specialties[specialtyIndex].operatingHours.shifts.afternoon.dailyLimit =
        parseInt(afternoonLimit);
    }

    healthServices[serviceIndex].availableSpecialties = specialties;
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(200).json({
      message: "Especialidade atualizada com sucesso!",
      specialty: specialties[specialtyIndex],
    });
  } catch (error) {
    console.error("Erro ao atualizar especialidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar especialidade
exports.deleteSpecialty = async (req, res) => {
  try {
    const { cityId, serviceId, specialtyId } = req.params;

    if (!cityId || !serviceId || !specialtyId) {
      return res.status(400).json({
        message:
          "ID da cidade, ID da unidade e ID da especialidade são obrigatórios.",
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

    const specialties =
      healthServices[serviceIndex].availableSpecialties || [];

    const specialtyIndex = specialties.findIndex((s) => s.id === specialtyId);

    if (specialtyIndex === -1) {
      return res.status(404).json({
        message: "Especialidade não encontrada.",
      });
    }

    // Remover especialidade
    specialties.splice(specialtyIndex, 1);
    healthServices[serviceIndex].availableSpecialties = specialties;
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(200).json({
      message: "Especialidade deletada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar especialidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};




