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
      shift,
      status: "pendente",
    });

    await newAppointment.save();

    const userDoc = await User.findById(user);
    console.log({ userDoc });
    if (!userDoc) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (type === "consulta") {
      userDoc.medicalAppointments.push(newAppointment._id);
    } else if (type === "exame") {
      userDoc.examAppointments.push(newAppointment._id);
    }

    await userDoc.save();

    res.status(201).json({
      message: "Agendamento criado com sucesso!",
      appointment: newAppointment,
      remainingSlots: dailyLimit - existingAppointments - 1,
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await HealthAppointment.find();
    res.status(200).json(appointments);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

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

// Buscar agendamentos do usuário (para mobile)
exports.getAppointmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, type, page = 1, limit = 20 } = req.query;

    // Validar userId
    if (!userId) {
      return res.status(400).json({
        message: "ID do usuário é obrigatório.",
      });
    }

    // Verificar se usuário existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Construir query
    const query = { user: userId };

    if (status && ["pendente", "confirmado", "cancelado"].includes(status)) {
      query.status = status;
    }

    if (type && ["consulta", "exame"].includes(type)) {
      query.type = type;
    }

    // Paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const appointments = await HealthAppointment.find(query)
      .sort({ date: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name cpf phone");

    const total = await HealthAppointment.countDocuments(query);

    res.status(200).json({
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar agendamentos do usuário:", error);
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
      availability[date] = {
        remaining: remainingSlots,
        total: shiftLimit,
        booked: existingAppointments,
        available: remainingSlots > 0,
      };
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
    const { startDate, endDate } = req.query;

    console.log(
      `🔎 Buscando contagem de consultas e exames para a cidade: ${cityId}`
    );

    // Verifica se a cidade existe
    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Construir query base
    const baseQuery = { "city.id": cityId };

    // Adicionar filtro de data se fornecido
    if (startDate || endDate) {
      baseQuery.date = {};
      if (startDate) {
        baseQuery.date.$gte = new Date(startDate);
      }
      if (endDate) {
        // Adicionar 23:59:59 ao final do dia para incluir todo o dia
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        baseQuery.date.$lte = endDateTime;
      }
    }

    // Contagem de consultas
    const consultationsCount = await HealthAppointment.countDocuments({
      ...baseQuery,
      type: "consulta",
    });

    // Contagem de exames
    const examsCount = await HealthAppointment.countDocuments({
      ...baseQuery,
      type: "exame",
    });

    // Contagem por status
    const pendingCount = await HealthAppointment.countDocuments({
      ...baseQuery,
      status: "pendente",
    });

    const confirmedCount = await HealthAppointment.countDocuments({
      ...baseQuery,
      status: "confirmado",
    });

    const cancelledCount = await HealthAppointment.countDocuments({
      ...baseQuery,
      status: "cancelado",
    });

    const totalCount = consultationsCount + examsCount;

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
      byStatus: {
        pending: pendingCount,
        confirmed: confirmedCount,
        cancelled: cancelledCount,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao obter contagem de agendamentos:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Analytics de agendamentos por cidade
exports.getHealthAnalytics = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { startDate, endDate } = req.query;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    // Verifica se a cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Construir query base
    const baseQuery = { "city.id": cityId };

    // Adicionar filtro de data se fornecido
    if (startDate || endDate) {
      baseQuery.date = {};
      if (startDate) {
        baseQuery.date.$gte = new Date(startDate);
      }
      if (endDate) {
        baseQuery.date.$lte = new Date(endDate);
      }
    }

    // Agregações para analytics
    const [
      totalAppointments,
      consultationsCount,
      examsCount,
      byStatus,
      byType,
      byUnit,
      bySpecialty,
      byExam,
      byShift,
      byMonth,
      byWeek,
      byDayOfWeek,
      cancellationRates,
      efficiency,
    ] = await Promise.all([
      // Total de agendamentos
      HealthAppointment.countDocuments(baseQuery),
      
      // Consultas vs Exames
      HealthAppointment.countDocuments({ ...baseQuery, type: "consulta" }),
      HealthAppointment.countDocuments({ ...baseQuery, type: "exame" }),
      
      // Por status
      HealthAppointment.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      
      // Por tipo
      HealthAppointment.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      
      // Por unidade
      HealthAppointment.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$unit.name", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      
      // Por especialidade (consultas)
      HealthAppointment.aggregate([
        { $match: { ...baseQuery, type: "consulta", specialty: { $exists: true, $ne: null } } },
        { $group: { _id: "$specialty", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      
      // Por exame
      HealthAppointment.aggregate([
        { $match: { ...baseQuery, type: "exame", exam: { $exists: true, $ne: null } } },
        { $group: { _id: "$exam", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      
      // Por turno
      HealthAppointment.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$shift", count: { $sum: 1 } } },
      ]),
      
      // Por mês
      HealthAppointment.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      
      // Por semana (últimas 12 semanas)
      HealthAppointment.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              week: { $week: "$date" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
        { $limit: 12 },
      ]),
      
      // Por dia da semana
      HealthAppointment.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: { $dayOfWeek: "$date" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id": 1 } },
      ]),
      
      // Taxa de cancelamento por unidade
      HealthAppointment.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: "$unit.name",
            total: { $sum: 1 },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "cancelado"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            unit: "$_id",
            total: 1,
            cancelled: 1,
            cancellationRate: {
              $multiply: [
                { $divide: ["$cancelled", "$total"] },
                100,
              ],
            },
          },
        },
        { $sort: { cancellationRate: -1 } },
        { $limit: 10 },
      ]),
      
      // Eficiência: tempo médio entre criação e confirmação (em dias)
      HealthAppointment.aggregate([
        {
          $match: {
            ...baseQuery,
            status: "confirmado",
            createdAt: { $exists: true },
          },
        },
        {
          $project: {
            daysToConfirm: {
              $divide: [
                { $subtract: ["$updatedAt", "$createdAt"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgDays: { $avg: "$daysToConfirm" },
            minDays: { $min: "$daysToConfirm" },
            maxDays: { $max: "$daysToConfirm" },
          },
        },
      ]),
    ]);

    res.status(200).json({
      summary: {
        total: totalAppointments,
        consultations: consultationsCount,
        exams: examsCount,
      },
      byStatus: byStatus.map((item) => ({
        status: item._id,
        count: item.count,
      })),
      byType: byType.map((item) => ({
        type: item._id,
        count: item.count,
      })),
      byUnit: byUnit.map((item) => ({
        unit: item._id,
        count: item.count,
      })),
      bySpecialty: bySpecialty.map((item) => ({
        specialty: item._id,
        count: item.count,
      })),
      byExam: byExam.map((item) => ({
        exam: item._id,
        count: item.count,
      })),
      byShift: byShift.map((item) => ({
        shift: item._id,
        count: item.count,
      })),
      byMonth: byMonth.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        count: item.count,
        date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-01`,
      })),
      byWeek: byWeek.map((item) => ({
        year: item._id.year,
        week: item._id.week,
        count: item.count,
        label: `Semana ${item._id.week}/${item._id.year}`,
      })),
      byDayOfWeek: byDayOfWeek.map((item) => {
        const dayNames = ["", "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        return {
          day: item._id,
          dayName: dayNames[item._id] || `Dia ${item._id}`,
          count: item.count,
        };
      }),
      cancellationRates: cancellationRates.map((item) => ({
        unit: item.unit,
        total: item.total,
        cancelled: item.cancelled,
        cancellationRate: Math.round(item.cancellationRate * 100) / 100,
      })),
      efficiency: efficiency.length > 0 ? {
        avgDaysToConfirm: Math.round(efficiency[0].avgDays * 100) / 100,
        minDaysToConfirm: Math.round(efficiency[0].minDays * 100) / 100,
        maxDaysToConfirm: Math.round(efficiency[0].maxDays * 100) / 100,
      } : null,
    });
  } catch (error) {
    console.error("Erro ao buscar analytics de saúde:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
