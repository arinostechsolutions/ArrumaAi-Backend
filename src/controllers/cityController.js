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

    // Filtrar apenas tipos ativos para o mobile (se não for admin)
    // Admin vê todos os tipos (incluindo inativos) via getAllReportTypes
    const isAdminRequest = req.headers.authorization || req.headers.Authorization;
    
    if (!isAdminRequest && city.modules?.reports?.reportTypes) {
      // Para requests não autenticados (mobile), filtrar apenas tipos ativos
      const activeTypes = city.modules.reports.reportTypes.filter(
        (type) => type.isActive !== false
      );
      city.modules.reports.reportTypes = activeTypes;
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

// Buscar configuração mobile de uma cidade
exports.getMobileConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findOne({ id }).select("mobileConfig");

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Retornar com valores padrão se não existir
    const mobileConfig = city.mobileConfig || {
      showFeed: true,
      showMap: true,
    };

    res.status(200).json(mobileConfig);
  } catch (error) {
    console.error("Erro ao buscar configuração mobile:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar configuração mobile de uma cidade (apenas prefeitos e super admins)
exports.updateMobileConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { showFeed, showMap } = req.body;

    // Verificar se é prefeito ou super admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    if (!req.admin.isMayor && !req.admin.isSuperAdmin) {
      return res.status(403).json({
        message: "Acesso negado. Apenas prefeitos e super administradores podem alterar esta configuração.",
      });
    }

    // Verificar se a cidade existe
    const city = await City.findOne({ id });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Verificar se prefeito tem acesso à cidade (se não for super admin)
    if (req.admin.isMayor && !req.admin.isSuperAdmin) {
      const userCity = await City.findOne({ id: req.admin.allowedCities?.[0] || "" });
      if (!userCity || userCity.id !== id) {
        return res.status(403).json({
          message: "Acesso negado. Você só pode alterar a configuração da sua cidade.",
        });
      }
    }

    // Preparar objeto de atualização
    const updateData = {};
    if (typeof showFeed === "boolean") {
      updateData["mobileConfig.showFeed"] = showFeed;
    }
    if (typeof showMap === "boolean") {
      updateData["mobileConfig.showMap"] = showMap;
    }

    // Se mobileConfig não existir, criar com valores padrão
    if (!city.mobileConfig) {
      updateData["mobileConfig"] = {
        showFeed: typeof showFeed === "boolean" ? showFeed : true,
        showMap: typeof showMap === "boolean" ? showMap : true,
      };
    }

    const updatedCity = await City.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true }
    );

    if (!updatedCity) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const mobileConfig = updatedCity.mobileConfig || {
      showFeed: true,
      showMap: true,
    };

    res.status(200).json({
      message: "Configuração mobile atualizada com sucesso!",
      mobileConfig,
    });
  } catch (error) {
    console.error("Erro ao atualizar configuração mobile:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// ==================== TIPOS PERSONALIZADOS DE REPORTS ====================

// Listar TODOS os tipos de report de uma cidade (padrão + personalizados)
exports.getAllReportTypes = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se é admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    const city = await City.findOne({ id });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Buscar TODOS os tipos (padrão + personalizados)
    const allTypes = city.modules?.reports?.reportTypes || [];

    // Filtrar por permissões baseado no tipo de admin
    let filteredTypes = allTypes;

    // Super Admin: vê todos os tipos (incluindo inativos)
    if (req.admin.isSuperAdmin) {
      filteredTypes = allTypes;
    }
    // Prefeito: vê todos os tipos da sua cidade (incluindo inativos)
    else if (req.admin.isMayor) {
      filteredTypes = allTypes;
    }
    // Secretaria: vê apenas tipos que têm permissão OU tipos padrão (sem isCustom ou isCustom false)
    // E apenas tipos ATIVOS
    else if (req.admin.secretaria) {
      filteredTypes = allTypes.filter((type) => {
        // Apenas tipos ativos para secretarias
        if (type.isActive === false) {
          return false;
        }
        // Tipos padrão sempre visíveis (se ativos)
        if (!type.isCustom || type.isCustom === false) {
          return true;
        }
        // Tipos personalizados: verificar se a secretaria tem permissão
        if (type.isCustom === true) {
          // Se não tem allowedSecretarias ou está vazio, todas podem ver
          if (!type.allowedSecretarias || type.allowedSecretarias.length === 0) {
            return true;
          }
          // Verificar se a secretaria está na lista
          return type.allowedSecretarias.includes(req.admin.secretaria);
        }
        return false;
      });
    }

    // Ordenar: tipos ativos primeiro, depois inativos, depois por tipo (padrão/personalizado), depois por label
    filteredTypes.sort((a, b) => {
      // Tipos ativos primeiro
      const aActive = a.isActive !== false;
      const bActive = b.isActive !== false;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      // Tipos padrão primeiro
      if (!a.isCustom && b.isCustom) return -1;
      if (a.isCustom && !b.isCustom) return 1;
      // Depois ordenar por label
      return a.label.localeCompare(b.label);
    });

    res.status(200).json(filteredTypes);
  } catch (error) {
    console.error("Erro ao buscar tipos de report:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Criar tipo personalizado
exports.createCustomReportType = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, allowedSecretarias } = req.body;

    // Verificar se é prefeito ou super admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    if (!req.admin.isMayor && !req.admin.isSuperAdmin) {
      return res.status(403).json({
        message: "Acesso negado. Apenas prefeitos e super administradores podem criar tipos personalizados.",
      });
    }

    // Verificar se a cidade existe
    const city = await City.findOne({ id });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Verificar se prefeito tem acesso à cidade
    if (req.admin.isMayor && !req.admin.isSuperAdmin) {
      if (!req.admin.allowedCities?.includes(id)) {
        return res.status(403).json({
          message: "Acesso negado. Você só pode criar tipos para a sua cidade.",
        });
      }
    }

    if (!label || typeof label !== "string" || label.trim() === "") {
      return res.status(400).json({
        message: "O label é obrigatório e deve ser uma string não vazia.",
      });
    }

    // Gerar ID único baseado no label
    const baseId = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Verificar se já existe um tipo com esse ID ou label
    const existingTypes = city.modules?.reports?.reportTypes || [];
    let newId = baseId;
    let counter = 1;
    while (existingTypes.some((t) => t.id === newId)) {
      newId = `${baseId}-${counter}`;
      counter++;
    }

    // Criar novo tipo
    const newType = {
      id: newId,
      label: label.trim(),
      isCustom: true,
      createdBy: {
        adminId: req.admin.userId,
        adminName: req.admin.name,
        role: req.admin.isSuperAdmin ? "super_admin" : "mayor",
      },
      allowedSecretarias: Array.isArray(allowedSecretarias)
        ? allowedSecretarias.filter((s) => typeof s === "string" && s.trim() !== "")
        : [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Adicionar ao array de reportTypes
    if (!city.modules) city.modules = {};
    if (!city.modules.reports) city.modules.reports = {};
    if (!city.modules.reports.reportTypes) city.modules.reports.reportTypes = [];

    city.modules.reports.reportTypes.push(newType);
    await city.save();

    res.status(201).json({
      message: "Tipo personalizado criado com sucesso!",
      reportType: newType,
    });
  } catch (error) {
    console.error("Erro ao criar tipo personalizado:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Atualizar tipo (padrão ou personalizado)
exports.updateCustomReportType = async (req, res) => {
  try {
    const { id: cityId, typeId } = req.params;
    const { label, allowedSecretarias, isActive } = req.body;

    // Verificar se é admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const reportTypes = city.modules?.reports?.reportTypes || [];
    const typeIndex = reportTypes.findIndex((t) => t.id === typeId);

    if (typeIndex === -1) {
      return res.status(404).json({
        message: "Tipo não encontrado.",
      });
    }

    const existingType = reportTypes[typeIndex];

    // Verificar permissões baseado no tipo
    if (existingType.isCustom === true) {
      // Tipo personalizado: prefeitos e super admins podem editar
      if (!req.admin.isMayor && !req.admin.isSuperAdmin) {
        return res.status(403).json({
          message: "Acesso negado. Apenas prefeitos e super administradores podem atualizar tipos personalizados.",
        });
      }

      // Prefeito só pode editar os que criou
      if (
        req.admin.isMayor &&
        !req.admin.isSuperAdmin &&
        existingType.createdBy?.adminId?.toString() !== req.admin.userId?.toString()
      ) {
        return res.status(403).json({
          message: "Acesso negado. Você só pode atualizar tipos que você criou.",
        });
      }

      // Verificar se prefeito tem acesso à cidade
      if (req.admin.isMayor && !req.admin.isSuperAdmin) {
        if (!req.admin.allowedCities?.includes(cityId)) {
          return res.status(403).json({
            message: "Acesso negado. Você só pode atualizar tipos da sua cidade.",
          });
        }
      }
    } else {
      // Tipo padrão: apenas super admin pode editar
      if (!req.admin.isSuperAdmin) {
        return res.status(403).json({
          message: "Acesso negado. Apenas super administradores podem atualizar tipos padrão.",
        });
      }
    }

    // Atualizar campos
    if (label !== undefined) {
      if (typeof label !== "string" || label.trim() === "") {
        return res.status(400).json({
          message: "O label deve ser uma string não vazia.",
        });
      }
      reportTypes[typeIndex].label = label.trim();
    }

    // allowedSecretarias só pode ser atualizado em tipos personalizados
    if (allowedSecretarias !== undefined && existingType.isCustom === true) {
      reportTypes[typeIndex].allowedSecretarias = Array.isArray(allowedSecretarias)
        ? allowedSecretarias.filter((s) => typeof s === "string" && s.trim() !== "")
        : [];
    }

    if (typeof isActive === "boolean") {
      reportTypes[typeIndex].isActive = isActive;
    }

    // Atualizar updatedAt se for tipo personalizado
    if (existingType.isCustom === true) {
      reportTypes[typeIndex].updatedAt = new Date();
    }

    city.markModified("modules.reports.reportTypes");
    await city.save();

    res.status(200).json({
      message: "Tipo atualizado com sucesso!",
      reportType: reportTypes[typeIndex],
    });
  } catch (error) {
    console.error("Erro ao atualizar tipo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Desativar/Ativar tipo (soft delete - sempre preserva o tipo)
exports.toggleReportTypeStatus = async (req, res) => {
  try {
    const { id: cityId, typeId } = req.params;
    const { isActive } = req.body;

    // Verificar se é admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const reportTypes = city.modules?.reports?.reportTypes || [];
    const typeIndex = reportTypes.findIndex((t) => t.id === typeId);

    if (typeIndex === -1) {
      return res.status(404).json({
        message: "Tipo não encontrado.",
      });
    }

    const existingType = reportTypes[typeIndex];

    // Verificar permissões baseado no tipo
    if (existingType.isCustom === true) {
      // Tipo personalizado: apenas prefeitos e super admins podem desativar
      if (!req.admin.isMayor && !req.admin.isSuperAdmin) {
        return res.status(403).json({
          message: "Acesso negado. Apenas prefeitos e super administradores podem desativar tipos personalizados.",
        });
      }

      // Prefeito só pode desativar os que criou
      if (
        req.admin.isMayor &&
        !req.admin.isSuperAdmin &&
        existingType.createdBy?.adminId?.toString() !== req.admin.userId?.toString()
      ) {
        return res.status(403).json({
          message: "Acesso negado. Você só pode desativar tipos que você criou.",
        });
      }

      // Verificar se prefeito tem acesso à cidade
      if (req.admin.isMayor && !req.admin.isSuperAdmin) {
        if (!req.admin.allowedCities?.includes(cityId)) {
          return res.status(403).json({
            message: "Acesso negado. Você só pode desativar tipos da sua cidade.",
          });
        }
      }
    } else {
      // Tipo padrão: apenas super admin pode desativar
      if (!req.admin.isSuperAdmin) {
        return res.status(403).json({
          message: "Acesso negado. Apenas super administradores podem desativar tipos padrão.",
        });
      }
    }

    // Atualizar status (desativar ou reativar)
    const newStatus = typeof isActive === "boolean" ? isActive : !existingType.isActive;
    reportTypes[typeIndex].isActive = newStatus;
    
    // Atualizar updatedAt se for tipo personalizado
    if (existingType.isCustom === true) {
      reportTypes[typeIndex].updatedAt = new Date();
    }

    city.markModified("modules.reports.reportTypes");
    await city.save();

    res.status(200).json({
      message: newStatus ? "Tipo reativado com sucesso!" : "Tipo desativado com sucesso!",
      reportType: reportTypes[typeIndex],
    });
  } catch (error) {
    console.error("Erro ao alterar status do tipo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Desativar múltiplos tipos
exports.deactivateMultipleReportTypes = async (req, res) => {
  try {
    const { id: cityId } = req.params;
    const { typeIds } = req.body;

    if (!Array.isArray(typeIds) || typeIds.length === 0) {
      return res.status(400).json({
        message: "typeIds deve ser um array não vazio.",
      });
    }

    // Verificar se é admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const reportTypes = city.modules?.reports?.reportTypes || [];
    let deactivatedCount = 0;
    let errors = [];

    for (const typeId of typeIds) {
      const typeIndex = reportTypes.findIndex((t) => t.id === typeId);

      if (typeIndex === -1) {
        errors.push(`Tipo ${typeId} não encontrado`);
        continue;
      }

      const existingType = reportTypes[typeIndex];

      // Verificar permissões
      if (existingType.isCustom === true) {
        // Tipo personalizado
        if (!req.admin.isMayor && !req.admin.isSuperAdmin) {
          errors.push(`Sem permissão para desativar ${existingType.label}`);
          continue;
        }

        if (
          req.admin.isMayor &&
          !req.admin.isSuperAdmin &&
          existingType.createdBy?.adminId?.toString() !== req.admin.userId?.toString()
        ) {
          errors.push(`Sem permissão para desativar ${existingType.label} (não foi criado por você)`);
          continue;
        }
      } else {
        // Tipo padrão: apenas super admin
        if (!req.admin.isSuperAdmin) {
          errors.push(`Sem permissão para desativar tipo padrão ${existingType.label}`);
          continue;
        }
      }

      // Desativar (soft delete - sempre preserva)
      reportTypes[typeIndex].isActive = false;
      if (existingType.isCustom === true) {
        reportTypes[typeIndex].updatedAt = new Date();
      }
      deactivatedCount++;
    }

    city.markModified("modules.reports.reportTypes");
    await city.save();

    res.status(200).json({
      message: `${deactivatedCount} tipo(s) desativado(s) com sucesso!`,
      deactivatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Erro ao desativar múltiplos tipos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Ativar múltiplos tipos
exports.activateMultipleReportTypes = async (req, res) => {
  try {
    const { id: cityId } = req.params;
    const { typeIds } = req.body;

    if (!Array.isArray(typeIds) || typeIds.length === 0) {
      return res.status(400).json({
        message: "typeIds deve ser um array não vazio.",
      });
    }

    // Verificar se é admin
    if (!req.admin) {
      return res.status(401).json({
        message: "Acesso negado. Autenticação necessária.",
      });
    }

    const city = await City.findOne({ id: cityId });

    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const reportTypes = city.modules?.reports?.reportTypes || [];
    let activatedCount = 0;
    let errors = [];

    for (const typeId of typeIds) {
      const typeIndex = reportTypes.findIndex((t) => t.id === typeId);

      if (typeIndex === -1) {
        errors.push(`Tipo ${typeId} não encontrado`);
        continue;
      }

      const existingType = reportTypes[typeIndex];

      // Verificar permissões
      if (existingType.isCustom === true) {
        // Tipo personalizado
        if (!req.admin.isMayor && !req.admin.isSuperAdmin) {
          errors.push(`Sem permissão para ativar ${existingType.label}`);
          continue;
        }

        if (
          req.admin.isMayor &&
          !req.admin.isSuperAdmin &&
          existingType.createdBy?.adminId?.toString() !== req.admin.userId?.toString()
        ) {
          errors.push(`Sem permissão para ativar ${existingType.label} (não foi criado por você)`);
          continue;
        }
      } else {
        // Tipo padrão: apenas super admin
        if (!req.admin.isSuperAdmin) {
          errors.push(`Sem permissão para ativar tipo padrão ${existingType.label}`);
          continue;
        }
      }

      // Ativar
      reportTypes[typeIndex].isActive = true;
      if (existingType.isCustom === true) {
        reportTypes[typeIndex].updatedAt = new Date();
      }
      activatedCount++;
    }

    city.markModified("modules.reports.reportTypes");
    await city.save();

    res.status(200).json({
      message: `${activatedCount} tipo(s) ativado(s) com sucesso!`,
      activatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Erro ao ativar múltiplos tipos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
