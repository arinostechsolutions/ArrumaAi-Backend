// src/controllers/emergencyContactController.js
const EmergencyContact = require("../models/EmergencyContact");
const City = require("../models/City");
const mongoose = require("mongoose");

/**
 * POST /api/emergency-contacts/create
 * Criar novo telefone de emergência
 */
exports.createEmergencyContact = async (req, res) => {
  try {
    const {
      name,
      type,
      phone,
      alternativePhone,
      description,
      location,
      cityId,
      displayOrder,
    } = req.body;

    // Validações
    if (!name || !type || !phone || !cityId) {
      return res.status(400).json({
        message: "Campos obrigatórios: name, type, phone, cityId.",
      });
    }

    // Verificar se a cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Preparar dados de localização se fornecidos
    let locationData = null;
    if (location) {
      locationData = {
        address: location.address || "",
        bairro: location.bairro || null,
        rua: location.rua || null,
      };

      // Adicionar coordenadas se fornecidas (aceita location.lat/lng ou location.coordinates.lat/lng)
      let lat, lng;
      if (location.lat !== undefined && location.lng !== undefined) {
        lat = parseFloat(location.lat);
        lng = parseFloat(location.lng);
      } else if (location.coordinates && location.coordinates.lat !== undefined && location.coordinates.lng !== undefined) {
        lat = parseFloat(location.coordinates.lat);
        lng = parseFloat(location.coordinates.lng);
      }

      if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          locationData.coordinates = {
            type: "Point",
            coordinates: [lng, lat], // MongoDB usa [longitude, latitude]
          };
        }
      }
    }

    const newContact = new EmergencyContact({
      name,
      type,
      phone,
      alternativePhone: alternativePhone || null,
      description: description || null,
      location: locationData,
      city: {
        id: cityId,
        label: city.label,
      },
      createdBy: {
        adminId: req.admin.userId,
        adminName: req.admin.name || "Admin",
        secretaria: req.admin.secretaria?.id || req.admin.secretaria || null,
      },
      displayOrder: displayOrder || 0,
      isActive: true,
    });

    await newContact.save();

    res.status(201).json({
      message: "Telefone de emergência criado com sucesso!",
      contact: newContact,
    });
  } catch (error) {
    console.error("Erro ao criar telefone de emergência:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

/**
 * GET /api/emergency-contacts/city/:cityId
 * Listar telefones de emergência de uma cidade
 */
exports.getEmergencyContactsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { includeInactive } = req.query; // Para admin ver inativos também

    const filter = {
      "city.id": cityId,
    };

    // Se não for admin ou não solicitar inativos, filtrar apenas ativos
    if (!req.admin || includeInactive !== "true") {
      filter.isActive = true;
    }

    const contacts = await EmergencyContact.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Formatar localização para o frontend
    const formattedContacts = contacts.map((contact) => {
      // Verificar se há coordenadas (formato: location.coordinates.coordinates = [lng, lat])
      const coords = contact.location?.coordinates?.coordinates;
      const hasCoordinates = Array.isArray(coords) && coords.length === 2;
      
      return {
        ...contact,
        location: hasCoordinates
          ? {
              lat: coords[1], // latitude é o segundo elemento
              lng: coords[0], // longitude é o primeiro elemento
              address: contact.location.address || null,
              bairro: contact.location.bairro || null,
              rua: contact.location.rua || null,
            }
          : contact.location?.address
          ? {
              address: contact.location.address,
              bairro: contact.location.bairro || null,
              rua: contact.location.rua || null,
            }
          : null,
      };
    });

    res.status(200).json(formattedContacts);
  } catch (error) {
    console.error("Erro ao buscar telefones de emergência:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/emergency-contacts/:id
 * Buscar telefone de emergência por ID
 */
exports.getEmergencyContactById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const contact = await EmergencyContact.findById(id).lean();

    if (!contact) {
      return res.status(404).json({ message: "Telefone de emergência não encontrado." });
    }

    // Formatar localização
    const coords = contact.location?.coordinates?.coordinates;
    const hasCoordinates = Array.isArray(coords) && coords.length === 2;
    
    const formattedContact = {
      ...contact,
      location: hasCoordinates
        ? {
            lat: coords[1], // latitude é o segundo elemento
            lng: coords[0], // longitude é o primeiro elemento
            address: contact.location.address || null,
            bairro: contact.location.bairro || null,
            rua: contact.location.rua || null,
          }
        : contact.location?.address
        ? {
            address: contact.location.address,
            bairro: contact.location.bairro || null,
            rua: contact.location.rua || null,
          }
        : null,
    };

    res.status(200).json(formattedContact);
  } catch (error) {
    console.error("Erro ao buscar telefone de emergência:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PUT /api/emergency-contacts/:id
 * Atualizar telefone de emergência
 */
exports.updateEmergencyContact = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      phone,
      alternativePhone,
      description,
      location,
      displayOrder,
      isActive,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const contact = await EmergencyContact.findById(id);
    if (!contact) {
      return res.status(404).json({ message: "Telefone de emergência não encontrado." });
    }

    // Verificar permissões
    const adminId = req.admin?.userId;
    const isSuperAdmin = req.admin?.isSuperAdmin;
    const isCreator = contact.createdBy.adminId.toString() === adminId?.toString();

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        message: "Você não tem permissão para editar este contato.",
      });
    }

    // Atualizar campos
    if (name) contact.name = name.trim();
    if (type) contact.type = type;
    if (phone) contact.phone = phone.trim();
    if (alternativePhone !== undefined) contact.alternativePhone = alternativePhone?.trim() || null;
    if (description !== undefined) contact.description = description?.trim() || null;
    if (typeof displayOrder === "number") contact.displayOrder = displayOrder;
    if (typeof isActive === "boolean") contact.isActive = isActive;

    // Atualizar localização
    if (location !== undefined) {
      const hasCoordinates = (location.lat !== undefined && location.lng !== undefined) || 
                             (location.coordinates && location.coordinates.lat !== undefined && location.coordinates.lng !== undefined);
      
      if (!location || (!location.address && !hasCoordinates)) {
        // Se location for null ou vazio, remover
        contact.location = null;
      } else {
        contact.location = {
          address: location.address || contact.location?.address || "",
          bairro: location.bairro !== undefined ? location.bairro : contact.location?.bairro || null,
          rua: location.rua !== undefined ? location.rua : contact.location?.rua || null,
        };

        // Atualizar coordenadas se fornecidas (aceita location.lat/lng ou location.coordinates.lat/lng)
        let lat, lng;
        if (location.lat !== undefined && location.lng !== undefined) {
          lat = parseFloat(location.lat);
          lng = parseFloat(location.lng);
        } else if (location.coordinates && location.coordinates.lat !== undefined && location.coordinates.lng !== undefined) {
          lat = parseFloat(location.coordinates.lat);
          lng = parseFloat(location.coordinates.lng);
        }

        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            contact.location.coordinates = {
              type: "Point",
              coordinates: [lng, lat],
            };
          }
        } else if (contact.location.coordinates) {
          // Se não forneceu coordenadas mas já existem, manter
          // Não fazer nada
        }
      }
    }

    await contact.save();

    res.status(200).json({
      message: "Telefone de emergência atualizado com sucesso!",
      contact,
    });
  } catch (error) {
    console.error("Erro ao atualizar telefone de emergência:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

/**
 * DELETE /api/emergency-contacts/:id
 * Deletar telefone de emergência
 */
exports.deleteEmergencyContact = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const contact = await EmergencyContact.findById(id);
    if (!contact) {
      return res.status(404).json({ message: "Telefone de emergência não encontrado." });
    }

    // Verificar permissões
    const adminId = req.admin?.userId;
    const isSuperAdmin = req.admin?.isSuperAdmin;
    const isCreator = contact.createdBy.adminId.toString() === adminId?.toString();

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        message: "Você não tem permissão para deletar este contato.",
      });
    }

    await EmergencyContact.findByIdAndDelete(id);

    res.status(200).json({
      message: "Telefone de emergência removido com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar telefone de emergência:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

