const City = require("../models/City");
const StreetBlockade = require("../models/StreetBlockade");
const Event = require("../models/Event");
const PositivePost = require("../models/PositivePost");
const EmergencyContact = require("../models/EmergencyContact");

// Buscar todos os POIs (Points of Interest) da cidade inteligente
exports.getSmartCityPOIs = async (req, res) => {
  try {
    const { cityId } = req.params;

    if (!cityId) {
      return res.status(400).json({ message: "ID da cidade é obrigatório." });
    }

    const city = await City.findOne({ id: cityId }).select("modules.smartCity");

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    if (!city.modules?.smartCity?.enabled) {
      return res.status(200).json({
        streetBlockades: [],
        events: [],
        healthUnits: [],
        customPOIs: [],
        achievements: [],
        emergencyContacts: [],
      });
    }

    const poiConfig = city.modules.smartCity.poiTypes || {
      showStreetBlockades: true,
      showEvents: true,
      showHealthUnits: true,
      showCustomPOIs: true,
      showEmergencyContacts: true,
    };

    const now = new Date();
    const results = {
      streetBlockades: [],
      events: [],
      healthUnits: [],
      customPOIs: [],
      achievements: [], // Conquistas
      emergencyContacts: [], // Telefones de emergência
    };

    // Buscar interdições de ruas ativas
    if (poiConfig.showStreetBlockades) {
      // Query para interdições ativas: status ativo/agendado E (sem endDate OU endDate no futuro)
      const blockades = await StreetBlockade.find({
        cityId,
        status: { $in: ["agendado", "ativo"] },
        startDate: { $lte: now },
        $or: [
          { endDate: { $exists: false } }, // Sem data de término
          { endDate: null }, // endDate é null
          { endDate: { $gte: now } }, // endDate no futuro
        ],
      })
        .select("route type reason startDate endDate status impact alternativeRoute")
        .lean();

      results.streetBlockades = blockades.map((blockade) => ({
        _id: blockade._id,
        type: "blockade",
        route: blockade.route,
        blockadeType: blockade.type,
        reason: blockade.reason,
        startDate: blockade.startDate,
        endDate: blockade.endDate || undefined, // Retornar undefined se não existir
        status: blockade.status,
        impact: blockade.impact,
        alternativeRoute: blockade.alternativeRoute,
      }));
    }

    // Buscar eventos ativos
    if (poiConfig.showEvents) {
      const events = await Event.find({
        "city.id": cityId,
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: true,
      })
        .select("title description startDate endDate images address")
        .lean();

      results.events = events
        .filter((event) => event.address?.coordinates?.latitude && event.address?.coordinates?.longitude)
        .map((event) => ({
          _id: event._id,
          type: "event",
          name: event.title,
          description: event.description,
          location: {
            lat: event.address.coordinates.latitude,
            lng: event.address.coordinates.longitude,
          },
          startDate: event.startDate,
          endDate: event.endDate,
          imageUrl: event.images && event.images.length > 0 ? event.images[0] : null,
          address: event.address?.street 
            ? `${event.address.street}${event.address.number ? `, ${event.address.number}` : ""}, ${event.address.neighborhood || ""}`
            : null,
        }));
    }

    // Buscar unidades de saúde (nota: unidades de saúde atualmente não têm location no modelo,
    // então só serão exibidas se tiverem endereço e geocodificação futura)
    // Por enquanto, retornamos array vazio - pode ser implementado futuramente com geocodificação
    if (poiConfig.showHealthUnits) {
      results.healthUnits = [];
      // TODO: Implementar geocodificação de endereços de unidades de saúde para obter coordenadas
      // Por enquanto, unidades de saúde só aparecem nos agendamentos, não no mapa da cidade inteligente
    }

    // Buscar POIs personalizados
    if (poiConfig.showCustomPOIs) {
      const customPOIs = city.modules.smartCity.customPOIs || [];
      
      results.customPOIs = customPOIs
        .filter((poi) => poi.isActive !== false)
        .map((poi) => ({
          _id: poi.id,
          type: "customPOI",
          poiType: poi.type,
          name: poi.name,
          description: poi.description,
          location: {
            lat: poi.location.lat,
            lng: poi.location.lng,
          },
          address: poi.address,
          phone: poi.phone,
          email: poi.email,
          website: poi.website,
          iconName: poi.iconName || "location",
          iconColor: poi.iconColor || "#007AFF",
        }));
    }

    // Buscar conquistas (posts positivos) com localização
    // As conquistas são controladas pelo showFeed no mobileConfig, então sempre buscamos se o Smart City estiver habilitado
    const achievements = await PositivePost.find({
      "city.id": cityId,
      status: "publicado",
      "location.coordinates.coordinates": { $exists: true, $ne: null },
    })
      .select("title description images eventDate location category createdAt")
      .sort({ createdAt: -1 })
      .limit(50) // Limitar a 50 conquistas mais recentes
      .lean();

    results.achievements = achievements
      .filter((achievement) => {
        // Verificar se tem coordenadas válidas
        const coords = achievement.location?.coordinates?.coordinates;
        return coords && Array.isArray(coords) && coords.length === 2 && 
               typeof coords[0] === 'number' && typeof coords[1] === 'number';
      })
      .map((achievement) => ({
        _id: achievement._id,
        type: "achievement",
        name: achievement.title,
        description: achievement.description,
        location: {
          lat: achievement.location.coordinates.coordinates[1], // latitude
          lng: achievement.location.coordinates.coordinates[0], // longitude
        },
        address: achievement.location.address,
        bairro: achievement.location.bairro,
        rua: achievement.location.rua,
        category: achievement.category,
        eventDate: achievement.eventDate,
        images: achievement.images || [],
        createdAt: achievement.createdAt,
      }));

    // Buscar telefones de emergência com localização
    if (poiConfig.showEmergencyContacts !== false) {
      const emergencyContacts = await EmergencyContact.find({
        "city.id": cityId,
        isActive: true,
        "location.coordinates.coordinates": { $exists: true, $ne: null },
      })
        .select("name type phone alternativePhone description location displayOrder")
        .sort({ displayOrder: 1, name: 1 })
        .lean();

      results.emergencyContacts = emergencyContacts
        .filter((contact) => {
          // Verificar se tem coordenadas válidas
          const coords = contact.location?.coordinates?.coordinates;
          return coords && Array.isArray(coords) && coords.length === 2 && 
                 typeof coords[0] === 'number' && typeof coords[1] === 'number';
        })
        .map((contact) => ({
          _id: contact._id,
          type: "emergencyContact",
          name: contact.name,
          phone: contact.phone,
          alternativePhone: contact.alternativePhone,
          description: contact.description,
          emergencyType: contact.type,
          location: {
            lat: contact.location.coordinates.coordinates[1], // latitude
            lng: contact.location.coordinates.coordinates[0], // longitude
          },
          address: contact.location.address,
          bairro: contact.location.bairro,
          rua: contact.location.rua,
          displayOrder: contact.displayOrder,
        }));
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Erro ao buscar POIs da cidade inteligente:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// CRUD de POIs personalizados
exports.createCustomPOI = async (req, res) => {
  try {
    const { cityId } = req.params;
    const {
      id,
      name,
      description,
      type,
      location,
      address,
      phone,
      email,
      website,
      iconName,
      iconColor,
    } = req.body;

    if (!cityId || !id || !name || !type || !location) {
      return res.status(400).json({
        message: "Campos obrigatórios: cityId, id, name, type, location.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    if (!city.modules?.smartCity) {
      city.modules = city.modules || {};
      city.modules.smartCity = {
        enabled: false,
        poiTypes: {
          showStreetBlockades: true,
          showEvents: true,
          showHealthUnits: true,
          showCustomPOIs: true,
        },
        customPOIs: [],
      };
    }

    // Verificar se já existe POI com esse ID
    const existingPOI = city.modules.smartCity.customPOIs.find((poi) => poi.id === id);
    if (existingPOI) {
      return res.status(400).json({
        message: "Já existe um POI com esse ID.",
      });
    }

    const newPOI = {
      id,
      name,
      description,
      type,
      location: {
        lat: location.lat,
        lng: location.lng,
      },
      address,
      phone,
      email,
      website,
      iconName: iconName || "location",
      iconColor: iconColor || "#007AFF",
      isActive: true,
      createdBy: {
        adminId: req.admin._id,
        adminName: req.admin.name || "Admin",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    city.modules.smartCity.customPOIs.push(newPOI);
    await city.save();

    res.status(201).json({
      message: "POI criado com sucesso!",
      poi: newPOI,
    });
  } catch (error) {
    console.error("Erro ao criar POI:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

exports.updateCustomPOI = async (req, res) => {
  try {
    const { cityId, poiId } = req.params;
    const updateData = req.body;

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const poi = city.modules?.smartCity?.customPOIs?.find((p) => p.id === poiId);

    if (!poi) {
      return res.status(404).json({ message: "POI não encontrado." });
    }

    // Atualizar campos
    if (updateData.name) poi.name = updateData.name;
    if (updateData.description !== undefined) poi.description = updateData.description;
    if (updateData.type) poi.type = updateData.type;
    if (updateData.location) {
      poi.location = {
        lat: updateData.location.lat,
        lng: updateData.location.lng,
      };
    }
    if (updateData.address !== undefined) poi.address = updateData.address;
    if (updateData.phone !== undefined) poi.phone = updateData.phone;
    if (updateData.email !== undefined) poi.email = updateData.email;
    if (updateData.website !== undefined) poi.website = updateData.website;
    if (updateData.iconName) poi.iconName = updateData.iconName;
    if (updateData.iconColor) poi.iconColor = updateData.iconColor;
    if (updateData.isActive !== undefined) poi.isActive = updateData.isActive;
    
    poi.updatedAt = new Date();

    city.markModified("modules.smartCity.customPOIs");
    await city.save();

    res.status(200).json({
      message: "POI atualizado com sucesso!",
      poi,
    });
  } catch (error) {
    console.error("Erro ao atualizar POI:", error);
    res.status(500).json({
      message: error.message || "Erro interno do servidor.",
    });
  }
};

exports.deleteCustomPOI = async (req, res) => {
  try {
    const { cityId, poiId } = req.params;

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const poiIndex = city.modules?.smartCity?.customPOIs?.findIndex((p) => p.id === poiId);

    if (poiIndex === -1 || poiIndex === undefined) {
      return res.status(404).json({ message: "POI não encontrado." });
    }

    city.modules.smartCity.customPOIs.splice(poiIndex, 1);
    city.markModified("modules.smartCity.customPOIs");
    await city.save();

    res.status(200).json({
      message: "POI removido com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao deletar POI:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

// Atualizar configuração de tipos de POIs
exports.updatePOITypesConfig = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { poiTypes } = req.body;

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    if (!city.modules?.smartCity) {
      city.modules = city.modules || {};
      city.modules.smartCity = {
        enabled: false,
        poiTypes: {
          showStreetBlockades: true,
          showEvents: true,
          showHealthUnits: true,
          showCustomPOIs: true,
        },
        customPOIs: [],
      };
    }

    if (poiTypes) {
      city.modules.smartCity.poiTypes = {
        showStreetBlockades: poiTypes.showStreetBlockades !== undefined ? poiTypes.showStreetBlockades : true,
        showEvents: poiTypes.showEvents !== undefined ? poiTypes.showEvents : true,
        showHealthUnits: poiTypes.showHealthUnits !== undefined ? poiTypes.showHealthUnits : true,
        showCustomPOIs: poiTypes.showCustomPOIs !== undefined ? poiTypes.showCustomPOIs : true,
      };
    }

    city.markModified("modules.smartCity");
    await city.save();

    res.status(200).json({
      message: "Configuração atualizada com sucesso!",
      poiTypes: city.modules.smartCity.poiTypes,
    });
  } catch (error) {
    console.error("Erro ao atualizar configuração de POIs:", error);
    res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
};

