const moment = require("moment-timezone");
const HealthAppointment = require("../models/HealthAppointment");
const City = require("../models/City");
const User = require("../models/User");

// Criar um agendamento
exports.createAppointment = async (req, res) => {
  try {
    const { city, user, unit, type, specialty, exam, date, shift } = req.body;

    if (!city || !user || !unit || !type || !date || !shift) {
      return res.status(400).json({
        message: "Todos os campos obrigatórios devem ser preenchidos.",
      });
    }

    const cityData = await City.findOne({ id: city.id });
    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const healthUnit = cityData.modules.healthAppointments.healthServices.find(
      (u) => u.id === unit.id
    );

    if (!healthUnit) {
      return res
        .status(404)
        .json({ message: "Unidade de saúde não encontrada." });
    }

    const selectedItem =
      type === "consulta"
        ? healthUnit.availableSpecialties.find((s) => s.id === specialty)
        : healthUnit.availableExams.find((e) => e.id === exam);

    if (!selectedItem) {
      return res
        .status(404)
        .json({ message: "Especialidade ou exame não encontrado." });
    }

    const dailyLimit = selectedItem.operatingHours.shifts[shift].dailyLimit;

    // Contagem de agendamentos existentes no turno especificado
    const existingAppointments = await HealthAppointment.countDocuments({
      "city.id": city.id,
      "unit.id": unit.id,
      type,
      date: new Date(date),
      shift,
      $or: [{ specialty }, { exam }],
    });

    if (existingAppointments >= dailyLimit) {
      return res
        .status(400)
        .json({ message: "Limite de vagas atingido para esse turno." });
    }

    const newAppointment = new HealthAppointment({
      city,
      user,
      unit,
      type,
      specialty,
      exam,
      date,
      shift, // 🔹 Salvando o turno
      status: "pendente",
    });

    await newAppointment.save();

    res.status(201).json({
      message: "Agendamento criado com sucesso!",
      appointment: newAppointment,
      remainingSlots: dailyLimit - existingAppointments - 1, // 🔹 Agora desconta do turno correto
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar todos os agendamentos
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await HealthAppointment.find();
    res.status(200).json(appointments);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar agendamentos por cidade
exports.getAppointmentsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;

    const appointments = await HealthAppointment.find({ "city.id": cityId });

    if (!appointments.length) {
      return res
        .status(404)
        .json({ message: "Nenhum agendamento encontrado para esta cidade." });
    }

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Erro ao buscar agendamentos por cidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar status de um agendamento (exemplo: confirmar ou cancelar)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pendente", "confirmado", "cancelado"].includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    const updatedAppointment = await HealthAppointment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: "Agendamento não encontrado." });
    }

    res.status(200).json({
      message: "Status atualizado com sucesso!",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Erro ao atualizar status do agendamento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar agendamento
exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await HealthAppointment.findByIdAndDelete(id);

    if (!appointment) {
      return res.status(404).json({ message: "Agendamento não encontrado." });
    }

    res.status(200).json({
      message: "Agendamento deletado com sucesso! Vaga liberada.",
    });
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.getRemainingAppointments = async (req, res) => {
  try {
    let { cityId, unitId, type, selectedId, dates, shift } = req.query;

    if (!cityId || !unitId || !type || !selectedId || !dates || !shift) {
      return res.status(400).json({
        message:
          "Parâmetros inválidos. Certifique-se de enviar cityId, unitId, type, selectedId, dates e shift (morning/afternoon).",
      });
    }

    if (typeof dates === "string") {
      dates = dates.split(",");
    }

    if (!Array.isArray(dates)) {
      return res.status(400).json({
        message: "O parâmetro 'dates' deve ser um array.",
      });
    }

    const cityData = await City.findOne({ id: cityId });
    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const healthUnit = cityData.modules.healthAppointments.healthServices.find(
      (unit) => unit.id === unitId
    );

    if (!healthUnit) {
      return res
        .status(404)
        .json({ message: "Unidade de saúde não encontrada." });
    }

    // Buscar especialidade ou exame
    const selectedItem =
      type === "consulta"
        ? healthUnit.availableSpecialties.find((s) => s.id === selectedId)
        : healthUnit.availableExams.find((e) => e.id === selectedId);

    if (!selectedItem) {
      return res
        .status(404)
        .json({ message: "Especialidade ou exame não encontrado." });
    }

    const selectedService = selectedItem.toObject();

    const getFormattedDayOfWeek = (date) => {
      const weekDayMap = {
        sunday: "domingo",
        monday: "segunda",
        tuesday: "terça",
        wednesday: "quarta",
        thursday: "quinta",
        friday: "sexta",
        saturday: "sábado",
      };
      const dayOfWeek = moment
        .tz(date, "America/Sao_Paulo")
        .format("dddd")
        .toLowerCase();
      return weekDayMap[dayOfWeek] || dayOfWeek;
    };

    dates = dates.filter((date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.warn(`⚠️ Data inválida ignorada: ${date}`);
        return false;
      }
      const dayOfWeek = getFormattedDayOfWeek(date);
      return selectedService.operatingHours.availableDays.includes(dayOfWeek);
    });

    let availability = {};

    for (let date of dates) {
      const dayOfWeek = getFormattedDayOfWeek(date);

      // Verifica se há limite para esse turno
      const shiftLimit =
        selectedService.operatingHours.shifts[shift]?.dailyLimit || 0;

      const existingAppointments = await HealthAppointment.countDocuments({
        "city.id": cityId,
        "unit.id": unitId,
        type,
        date: new Date(date),
        shift,
        $or: [{ specialty: selectedId }, { exam: selectedId }],
      });

      const remainingSlots = Math.max(shiftLimit - existingAppointments, 0);
      availability[date] = remainingSlots;
    }

    res.status(200).json(availability);
  } catch (error) {
    console.error("❌ Erro ao verificar disponibilidade:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.getAppointmentsCountByCity = async (req, res) => {
  try {
    const { cityId } = req.params;

    console.log(
      `🔎 Buscando contagem de consultas e exames para a cidade: ${cityId}`
    );

    // Verifica se a cidade existe
    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Contagem de consultas
    const consultationsCount = await HealthAppointment.countDocuments({
      "city.id": cityId,
      type: "consulta",
    });

    // Contagem de exames
    const examsCount = await HealthAppointment.countDocuments({
      "city.id": cityId,
      type: "exame",
    });

    console.log(
      `✅ Total de consultas: ${consultationsCount}, Total de exames: ${examsCount}`
    );

    return res.status(200).json({
      city: {
        id: city.id,
        label: city.label,
      },
      totalConsultations: consultationsCount,
      totalExams: examsCount,
    });
  } catch (error) {
    console.error("❌ Erro ao obter contagem de agendamentos:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};
