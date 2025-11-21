const moment = require("moment-timezone");
const Event = require("../models/Event");
const City = require("../models/City");

// Criar evento
exports.createEvent = async (req, res) => {
  try {
    const {
      cityId,
      title,
      description,
      startDate,
      endDate,
      images,
      address,
      sponsors,
      schedule,
    } = req.body;

    // Validações básicas
    if (!cityId || !title || !description || !startDate || !endDate) {
      return res.status(400).json({
        message: "Campos obrigatórios: cityId, title, description, startDate, endDate",
      });
    }

    // Validar datas
    const start = moment.tz(startDate, "America/Sao_Paulo");
    const end = moment.tz(endDate, "America/Sao_Paulo");

    if (end.isBefore(start)) {
      return res.status(400).json({
        message: "A data de término deve ser posterior à data de início.",
      });
    }

    // Verificar se cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Criar evento
    const newEvent = new Event({
      city: {
        id: city.id,
        label: city.label,
      },
      title,
      description,
      startDate: start.toDate(),
      endDate: end.toDate(),
      images: images || [],
      address: address || {},
      sponsors: sponsors || [],
      schedule: schedule || [],
      isActive: true,
      createdBy: {
        adminId: req.admin?.userId,
        adminName: req.admin?.name,
      },
    });

    await newEvent.save();

    res.status(201).json({
      message: "Evento criado com sucesso!",
      event: newEvent,
    });
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Listar eventos por cidade
exports.getEventsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { includeFinished, page = 1, limit = 20 } = req.query;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    // Construir query
    const query = { "city.id": cityId, isActive: true };

    // Se não incluir finalizados, filtrar apenas eventos futuros ou em andamento
    if (includeFinished !== "true") {
      const now = moment.tz("America/Sao_Paulo").startOf("day").toDate();
      query.endDate = { $gte: now };
    }

    // Paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const events = await Event.find(query)
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar evento por ID
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    res.status(200).json(event);
  } catch (error) {
    console.error("Erro ao buscar evento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar evento
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startDate,
      endDate,
      images,
      address,
      sponsors,
      schedule,
      isActive,
    } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    // Validar datas se fornecidas
    if (startDate && endDate) {
      const start = moment.tz(startDate, "America/Sao_Paulo");
      const end = moment.tz(endDate, "America/Sao_Paulo");

      if (end.isBefore(start)) {
        return res.status(400).json({
          message: "A data de término deve ser posterior à data de início.",
        });
      }
    }

    // Atualizar campos
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (startDate !== undefined)
      event.startDate = moment.tz(startDate, "America/Sao_Paulo").toDate();
    if (endDate !== undefined)
      event.endDate = moment.tz(endDate, "America/Sao_Paulo").toDate();
    if (images !== undefined) event.images = images;
    if (address !== undefined) event.address = address;
    if (sponsors !== undefined) event.sponsors = sponsors;
    if (schedule !== undefined) event.schedule = schedule;
    if (isActive !== undefined) event.isActive = isActive;

    await event.save();

    res.status(200).json({
      message: "Evento atualizado com sucesso!",
      event,
    });
  } catch (error) {
    console.error("Erro ao atualizar evento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar evento (soft delete)
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    // Soft delete
    event.isActive = false;
    await event.save();

    res.status(200).json({
      message: "Evento deletado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar evento:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Listar todos os eventos (admin - com finalizados)
exports.getAllEvents = async (req, res) => {
  try {
    const { cityId, page = 1, limit = 20 } = req.query;

    const query = {};
    if (cityId) {
      query["city.id"] = cityId;
    }

    // Paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const events = await Event.find(query)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Erro ao listar eventos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

