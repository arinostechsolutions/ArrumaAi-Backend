const HealthAppointment = require("../models/HealthAppointment");
const City = require("../models/City");

// Criar um agendamento
exports.createAppointment = async (req, res) => {
  try {
    const { city, user, unit, type, specialty, exam, date } = req.body;

    if (!city || !user || !unit || !type || !date) {
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    }

    const cityData = await City.findOne({ id: city.id });

    if (!cityData) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Verificar se o módulo de saúde está ativo na cidade
    if (!cityData.modules.healthAppointments.enabled) {
      return res.status(403).json({
        message: "Este município não possui o módulo de agendamentos ativo.",
      });
    }

    const newAppointment = new HealthAppointment({
      city,
      user,
      unit,
      type,
      specialty,
      exam,
      date,
      status: "pendente",
    });

    await newAppointment.save();

    res.status(201).json({
      message: "Agendamento criado com sucesso!",
      appointment: newAppointment,
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

    res.status(200).json({ message: "Agendamento deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
