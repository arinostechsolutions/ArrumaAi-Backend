const City = require("../models/City");

// Helper: Verificar permissões de cidade
const checkCityPermission = (admin, cityId) => {
  if (admin.isSuperAdmin) return true;
  if (admin.isMayor && admin.allowedCities.includes(cityId)) return true;
  if (admin.secretaria && admin.allowedCities.includes(cityId)) return true;
  return false;
};

// Listar exames de uma unidade de saúde
exports.getExams = async (req, res) => {
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

    const exams = service.availableExams || [];

    res.status(200).json({
      city: { id: city.id, label: city.label },
      service: { id: service.id, name: service.name },
      exams,
    });
  } catch (error) {
    console.error("Erro ao buscar exames:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Criar novo exame
exports.createExam = async (req, res) => {
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

    // Verificar se já existe exame com mesmo id
    const existingExam = healthServices[serviceIndex].availableExams.find(
      (e) => e.id === id
    );

    if (existingExam) {
      return res.status(400).json({
        message: "Já existe um exame com este ID nesta unidade.",
      });
    }

    // Criar novo exame
    const newExam = {
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

    if (!healthServices[serviceIndex].availableExams) {
      healthServices[serviceIndex].availableExams = [];
    }

    healthServices[serviceIndex].availableExams.push(newExam);
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(201).json({
      message: "Exame criado com sucesso!",
      exam: newExam,
    });
  } catch (error) {
    console.error("Erro ao criar exame:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar exame
exports.updateExam = async (req, res) => {
  try {
    const { cityId, serviceId, examId } = req.params;
    const { label, availableDays, morningLimit, afternoonLimit } = req.body;

    if (!cityId || !serviceId || !examId) {
      return res.status(400).json({
        message:
          "ID da cidade, ID da unidade e ID do exame são obrigatórios.",
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

    const exams = healthServices[serviceIndex].availableExams || [];

    const examIndex = exams.findIndex((e) => e.id === examId);

    if (examIndex === -1) {
      return res.status(404).json({
        message: "Exame não encontrado.",
      });
    }

    // Atualizar campos
    if (label) {
      exams[examIndex].label = label;
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

      exams[examIndex].operatingHours.availableDays = availableDays;
    }

    if (morningLimit !== undefined) {
      exams[examIndex].operatingHours.shifts.morning.dailyLimit =
        parseInt(morningLimit);
    }

    if (afternoonLimit !== undefined) {
      exams[examIndex].operatingHours.shifts.afternoon.dailyLimit =
        parseInt(afternoonLimit);
    }

    healthServices[serviceIndex].availableExams = exams;
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(200).json({
      message: "Exame atualizado com sucesso!",
      exam: exams[examIndex],
    });
  } catch (error) {
    console.error("Erro ao atualizar exame:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar exame
exports.deleteExam = async (req, res) => {
  try {
    const { cityId, serviceId, examId } = req.params;

    if (!cityId || !serviceId || !examId) {
      return res.status(400).json({
        message:
          "ID da cidade, ID da unidade e ID do exame são obrigatórios.",
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

    const exams = healthServices[serviceIndex].availableExams || [];

    const examIndex = exams.findIndex((e) => e.id === examId);

    if (examIndex === -1) {
      return res.status(404).json({
        message: "Exame não encontrado.",
      });
    }

    // Remover exame
    exams.splice(examIndex, 1);
    healthServices[serviceIndex].availableExams = exams;
    city.modules.healthAppointments.healthServices = healthServices;
    await city.save();

    res.status(200).json({
      message: "Exame deletado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar exame:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

