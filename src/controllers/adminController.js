const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Report = require("../models/Report");
const ContentReport = require("../models/ContentReport");
const City = require("../models/City");

exports.createAdminUser = async (req, res) => {
  try {
    // Prefeitos também podem criar administradores (mas apenas para sua cidade)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem criar novos acessos.",
      });
    }

    const {
      name,
      email,
      cpf,
      phone,
      birthDate,
      address,
      password,
      adminCities = [],
      isSuperAdmin = false,
      secretaria,
    } = req.body;

    const superAdminFlag =
      isSuperAdmin === true ||
      isSuperAdmin === "true" ||
      isSuperAdmin === 1 ||
      isSuperAdmin === "1";

    // Prefeitos não podem criar super admins
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin && superAdminFlag) {
      return res.status(403).json({
        message: "Prefeitos não podem criar super administradores.",
      });
    }

    if (!name || !password || (!email && !cpf)) {
      return res.status(400).json({
        message: "Campos obrigatórios: name, password e email ou cpf.",
      });
    }

    if (!phone || !birthDate || !address?.bairro) {
      return res.status(400).json({
        message:
          "Informe telefone, data de nascimento e bairro para cadastro do administrador.",
      });
    }

    const sanitizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const sanitizedPhone = phone.replace(/\D/g, "");
    const normalizedEmail = email ? email.toLowerCase() : null;

    const existingUser = await User.findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(sanitizedCpf ? [{ cpf: sanitizedCpf }] : []),
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Já existe um usuário com este e-mail ou CPF.",
      });
    }

    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      return res.status(400).json({
        message: "birthDate inválida. Use um formato reconhecido (YYYY-MM-DD).",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Prefeitos só podem criar admins para sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId) {
        // Forçar adminCities para a cidade do prefeito
        if (!Array.isArray(adminCities) || adminCities.length === 0) {
          adminCities = [mayorCityId];
        } else {
          // Validar que todas as cidades são da cidade do prefeito
          const invalidCities = adminCities.filter((city) => city !== mayorCityId);
          if (invalidCities.length > 0) {
            return res.status(403).json({
              message: "Prefeitos só podem criar administradores para sua própria cidade.",
            });
          }
        }
      }
    }

    let allowedCities = [];
    if (!superAdminFlag) {
      if (!Array.isArray(adminCities) || adminCities.length === 0) {
        return res.status(400).json({
          message:
            "Informe ao menos um município em adminCities ou marque isSuperAdmin como true.",
        });
      }

      allowedCities = Array.from(
        new Set(
          adminCities
            .filter((city) => typeof city === "string" && city.trim() !== "")
            .map((city) => city.trim()),
        ),
      );

      if (allowedCities.length === 0) {
        return res.status(400).json({
          message:
            "Nenhum município válido informado. Verifique os valores em adminCities.",
        });
      }

      // Se secretaria foi informada, validar que existe na cidade
      if (secretaria) {
        if (allowedCities.length > 1) {
          return res.status(400).json({
            message: "Secretaria só pode ser associada quando há apenas uma cidade.",
          });
        }

        const city = await City.findOne({ id: allowedCities[0] });
        if (!city) {
          return res.status(404).json({ message: "Cidade não encontrada." });
        }

        const secretariaExists = city.secretarias?.some((s) => s.id === secretaria);
        if (!secretariaExists) {
          return res.status(404).json({
            message: "Secretaria não encontrada nesta cidade.",
          });
        }
      }
    }

    const newAdmin = await User.create({
      name,
      email: normalizedEmail,
      cpf: sanitizedCpf,
      phone: sanitizedPhone,
      birthDate: parsedBirthDate,
      address: {
        bairro: address.bairro,
        rua: address.rua || null,
        numero: address.numero || null,
        complemento: address.complemento || null,
      },
      isAdmin: true,
      isMayor: false,
      adminCities: superAdminFlag ? [] : allowedCities,
      secretaria: superAdminFlag ? undefined : secretaria || undefined,
      passwordHash: hashedPassword,
    });

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "admin_create",
        description: `Administrador "${newAdmin.name}" criado`,
        details: {
          createdAdminId: newAdmin._id.toString(),
          createdAdminName: newAdmin.name,
          createdAdminEmail: newAdmin.email,
          adminCities: newAdmin.adminCities,
          secretaria: newAdmin.secretaria || null,
          isSuperAdmin: superAdminFlag,
        },
        entityType: "admin",
        entityId: newAdmin._id,
        cityId: allowedCities.length === 1 ? allowedCities[0] : null,
        req,
      });
    }

    return res.status(201).json({
      message: "Administrador criado com sucesso.",
      admin: {
        userId: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        cpf: newAdmin.cpf,
        phone: newAdmin.phone,
        adminCities: newAdmin.adminCities,
        isSuperAdmin: superAdminFlag,
        secretaria: newAdmin.secretaria || null,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao criar administrador:", error);
    return res.status(500).json({ message: "Erro interno ao criar administrador." });
  }
};

/**
 * GET /api/admin/stats
 * Retorna estatísticas gerais do app
 */
exports.getStats = async (req, res) => {
  try {
    console.log("📊 Admin solicitou estatísticas gerais");

    const [
      totalUsers,
      totalReports,
      totalContentReports,
      pendingContentReports,
      totalCities,
    ] = await Promise.all([
      User.countDocuments(),
      Report.countDocuments(),
      ContentReport.countDocuments(),
      ContentReport.countDocuments({ status: "pendente" }),
      City.countDocuments(),
    ]);

    // Estatísticas de engajamento
    const engagementStats = await Report.aggregate([
      {
        $project: {
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          viewsCount: { $size: { $ifNull: ["$views", []] } },
          sharesCount: { $size: { $ifNull: ["$shares", []] } },
        },
      },
      {
        $group: {
          _id: null,
          totalLikes: { $sum: "$likesCount" },
          totalViews: { $sum: "$viewsCount" },
          totalShares: { $sum: "$sharesCount" },
        },
      },
    ]);

    const stats = {
      users: {
        total: totalUsers,
      },
      reports: {
        total: totalReports,
      },
      contentReports: {
        total: totalContentReports,
        pending: pendingContentReports,
      },
      cities: {
        total: totalCities,
      },
      engagement: engagementStats[0] || {
        totalLikes: 0,
        totalViews: 0,
        totalShares: 0,
      },
    };

    console.log("✅ Estatísticas calculadas:", stats);
    return res.status(200).json(stats);

  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/content-reports/pending
 * Lista denúncias de conteúdo pendentes (já existe no contentReportController, mas vamos manter aqui também)
 */
exports.getPendingContentReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`📋 Admin buscando denúncias pendentes (página ${page})`);

    const reports = await ContentReport.find({ status: "pendente" })
      .populate({
        path: "reportId",
        populate: {
          path: "user.userId",
          select: "name cpf",
        },
      })
      .populate("reportedBy.userId", "name email cpf")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filtrar denúncias onde o reportId foi deletado (null)
    const validReports = reports.filter(report => report.reportId !== null);

    const total = await ContentReport.countDocuments({ status: "pendente" });

    console.log(`✅ ${validReports.length} denúncias pendentes válidas encontradas (de ${reports.length} total)`);

    // Se há denúncias com reportId null, deletá-las automaticamente
    const orphanReports = reports.filter(report => report.reportId === null);
    if (orphanReports.length > 0) {
      console.log(`🗑️ Deletando ${orphanReports.length} denúncias órfãs (reportId null)...`);
      await ContentReport.deleteMany({
        _id: { $in: orphanReports.map(r => r._id) }
      });
    }

    return res.status(200).json({
      reports: validReports,
      page,
      limit,
      total: total - orphanReports.length,
      hasMore: skip + limit < total,
    });

  } catch (error) {
    console.error("❌ Erro ao buscar denúncias pendentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * DELETE /api/admin/report/:reportId
 * Deleta um post denunciado
 */
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { reason } = req.body; // Motivo da exclusão

    console.log(`🗑️ Admin deletando report: ${reportId}`);
    console.log(`📝 Motivo: ${reason}`);

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "ID de report inválido." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Remove da lista de reports da cidade
    await City.findOneAndUpdate(
      { id: report.city.id },
      { $pull: { "modules.reports.reportList": reportId } }
    );

    // Deleta o report
    await Report.findByIdAndDelete(reportId);

    // Atualiza todas as denúncias de conteúdo relacionadas
    await ContentReport.updateMany(
      { reportId: reportId },
      {
        status: "resolvido",
        action: "remocao_conteudo",
        moderatorNotes: reason || "Post removido pelo administrador.",
        reviewedAt: new Date(),
      }
    );

    console.log(`✅ Report ${reportId} deletado com sucesso`);

    return res.status(200).json({
      message: "Post deletado com sucesso.",
      reportId,
    });

  } catch (error) {
    console.error("❌ Erro ao deletar report:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/admin/user/:userId/ban
 * Bane um usuário (por enquanto, apenas marca como banido)
 */
exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // Motivo do banimento

    console.log(`🚫 Admin banindo usuário: ${userId}`);
    console.log(`📝 Motivo: ${reason}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Não permite banir outro admin
    if (user.isAdmin) {
      return res.status(403).json({
        message: "Não é possível banir outro administrador.",
      });
    }

    // Por enquanto, vamos apenas deletar o usuário
    // No futuro, você pode adicionar um campo "isBanned" ao modelo User
    await User.findByIdAndDelete(userId);

    // Remove usuário da cidade
    await City.updateOne(
      { users: userId },
      { $pull: { users: userId } }
    );

    // Atualiza denúncias de conteúdo feitas por este usuário
    await ContentReport.updateMany(
      { "reportedBy.userId": userId },
      {
        moderatorNotes: `Usuário banido. Motivo: ${reason || "Não especificado"}`,
      }
    );

    console.log(`✅ Usuário ${userId} banido e deletado com sucesso`);

    return res.status(200).json({
      message: "Usuário banido com sucesso.",
      userId,
    });

  } catch (error) {
    console.error("❌ Erro ao banir usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PATCH /api/admin/content-report/:contentReportId/resolve
 * Marca uma denúncia de conteúdo como resolvida
 */
exports.resolveContentReport = async (req, res) => {
  try {
    const { contentReportId } = req.params;
    const { action, moderatorNotes } = req.body;

    console.log(`✅ Admin resolvendo denúncia: ${contentReportId}`);
    console.log(`🔧 Ação: ${action}`);

    if (!mongoose.Types.ObjectId.isValid(contentReportId)) {
      return res.status(400).json({ message: "ID de denúncia inválido." });
    }

    const contentReport = await ContentReport.findById(contentReportId);
    if (!contentReport) {
      return res.status(404).json({ message: "Denúncia não encontrada." });
    }

    // Atualiza a denúncia
    contentReport.status = action === "nenhuma" ? "improcedente" : "procedente";
    contentReport.action = action || "nenhuma";
    contentReport.moderatorNotes = moderatorNotes || "";
    contentReport.reviewedAt = new Date();

    await contentReport.save();

    console.log(`✅ Denúncia ${contentReportId} resolvida como ${contentReport.status}`);

    return res.status(200).json({
      message: "Denúncia resolvida com sucesso.",
      contentReport,
    });

  } catch (error) {
    console.error("❌ Erro ao resolver denúncia:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/users/recent
 * Lista usuários mais recentes
 */
exports.getRecentUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`👥 Admin buscando ${limit} usuários mais recentes`);

    const users = await User.find()
      .select("name cpf email phone city createdAt")
      .populate("city", "label")
      .sort({ createdAt: -1 })
      .limit(limit);

    console.log(`✅ ${users.length} usuários encontrados`);

    return res.status(200).json({ users });

  } catch (error) {
    console.error("❌ Erro ao buscar usuários recentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/reports/recent
 * Lista denúncias mais recentes
 */
exports.getRecentReports = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📋 Admin buscando ${limit} denúncias mais recentes`);

    const reports = await Report.find()
      .populate("user.userId", "name cpf")
      .sort({ createdAt: -1 })
      .limit(limit);

    console.log(`✅ ${reports.length} denúncias encontradas`);

    return res.status(200).json({ reports });

  } catch (error) {
    console.error("❌ Erro ao buscar denúncias recentes:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/admin/users/admins
 * Lista todos os administradores (apenas super admin)
 */
exports.getAdminUsers = async (req, res) => {
  try {
    // Prefeitos também podem listar admins (mas apenas da sua cidade)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem listar administradores.",
      });
    }

    const { cityId, secretaria } = req.query;

    const filter = { isAdmin: true };

    // Prefeitos só podem ver admins da sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId) {
        filter.adminCities = { $in: [mayorCityId] };
      }
    }

    // Filtrar por cidade se informada
    if (cityId) {
      filter.adminCities = { $in: [cityId] };
    }

    // Filtrar por secretaria se informada
    if (secretaria) {
      filter.secretaria = secretaria;
    }

    const admins = await User.find(filter)
      .select("name email cpf phone birthDate address adminCities secretaria isAdmin isMayor createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const formattedAdmins = admins.map((admin) => ({
      userId: admin._id,
      name: admin.name,
      email: admin.email || null,
      cpf: admin.cpf || null,
      phone: admin.phone || null,
      birthDate: admin.birthDate || null,
      address: admin.address || null,
      adminCities: admin.adminCities || [],
      secretaria: admin.secretaria || null,
      isSuperAdmin: !admin.isMayor && (!admin.adminCities || admin.adminCities.length === 0),
      isMayor: admin.isMayor || false,
      createdAt: admin.createdAt,
    }));

    return res.status(200).json({
      admins: formattedAdmins,
      total: formattedAdmins.length,
    });
  } catch (error) {
    console.error("❌ Erro ao listar administradores:", error);
    return res.status(500).json({ message: "Erro interno ao listar administradores." });
  }
};

/**
 * GET /api/admin/users/:userId
 * Busca um administrador específico (apenas super admin)
 */
exports.getAdminUser = async (req, res) => {
  try {
    // Prefeitos também podem visualizar admins (mas apenas da sua cidade)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem visualizar administradores.",
      });
    }

    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const admin = await User.findById(userId)
      .select("name email cpf phone birthDate address adminCities secretaria isAdmin isMayor createdAt")
      .lean();

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ message: "Administrador não encontrado." });
    }

    // Prefeitos só podem ver admins da sua cidade
    if (req.admin?.isMayor && !req.admin?.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId && !admin.adminCities.includes(mayorCityId)) {
        return res.status(403).json({
          message: "Você só pode visualizar administradores da sua cidade.",
        });
      }
    }

    return res.status(200).json({
      admin: {
        userId: admin._id,
        name: admin.name,
        email: admin.email || null,
        cpf: admin.cpf || null,
        phone: admin.phone || null,
        birthDate: admin.birthDate || null,
        address: admin.address || null,
        adminCities: admin.adminCities || [],
        secretaria: admin.secretaria || null,
        isSuperAdmin: !admin.isMayor && (!admin.adminCities || admin.adminCities.length === 0),
        isMayor: admin.isMayor || false,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar administrador:", error);
    return res.status(500).json({ message: "Erro interno ao buscar administrador." });
  }
};

/**
 * PUT /api/admin/users/:userId
 * Atualiza um administrador (apenas super admin)
 */
exports.updateAdminUser = async (req, res) => {
  try {
    // Prefeitos também podem atualizar admins (mas apenas da sua cidade)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem atualizar administradores.",
      });
    }

    const { userId } = req.params;
    const {
      name,
      email,
      cpf,
      phone,
      birthDate,
      address,
      adminCities,
      secretaria,
      password,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const admin = await User.findById(userId);

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ message: "Administrador não encontrado." });
    }

    // Não permite editar outro super admin ou prefeito
    const isTargetSuperAdmin = !admin.isMayor && (!admin.adminCities || admin.adminCities.length === 0);
    const isTargetMayor = admin.isMayor === true;
    
    if ((isTargetSuperAdmin || isTargetMayor) && req.admin.userId.toString() !== userId) {
      // Prefeitos podem editar outros admins da sua cidade, mas não outros prefeitos ou super admins
      if (req.admin.isMayor && !req.admin.isSuperAdmin) {
        if (isTargetMayor || isTargetSuperAdmin) {
          return res.status(403).json({
            message: "Prefeitos não podem editar outros prefeitos ou super administradores.",
          });
        }
        // Verificar se o admin pertence à cidade do prefeito
        const mayorCityId = req.admin.allowedCities?.[0];
        if (mayorCityId && !admin.adminCities.includes(mayorCityId)) {
          return res.status(403).json({
            message: "Você só pode editar administradores da sua cidade.",
          });
        }
      } else if (isTargetSuperAdmin && req.admin.userId.toString() !== userId) {
        return res.status(403).json({
          message: "Não é possível editar outro super administrador.",
        });
      }
    }

    // Atualizar campos permitidos
    if (name) admin.name = name.trim();
    if (email !== undefined) admin.email = email ? email.toLowerCase().trim() : null;
    if (cpf !== undefined) {
      const sanitizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
      if (sanitizedCpf) {
        // Verificar se CPF já existe em outro usuário
        const existingUser = await User.findOne({
          cpf: sanitizedCpf,
          _id: { $ne: userId },
        });
        if (existingUser) {
          return res.status(409).json({
            message: "Já existe um usuário com este CPF.",
          });
        }
        admin.cpf = sanitizedCpf;
      } else {
        admin.cpf = null;
      }
    }
    if (phone !== undefined) admin.phone = phone ? phone.replace(/\D/g, "") : null;
    if (birthDate) {
      const parsedBirthDate = new Date(birthDate);
      if (!Number.isNaN(parsedBirthDate.getTime())) {
        admin.birthDate = parsedBirthDate;
      }
    }
    if (address) {
      if (address.bairro) admin.address.bairro = address.bairro.trim();
      if (address.rua !== undefined) admin.address.rua = address.rua ? address.rua.trim() : null;
      if (address.numero !== undefined) admin.address.numero = address.numero ? address.numero.trim() : null;
      if (address.complemento !== undefined) admin.address.complemento = address.complemento ? address.complemento.trim() : null;
    }

    // Atualizar permissões (apenas se não for super admin nem prefeito)
    if (!isTargetSuperAdmin && !isTargetMayor) {
      if (adminCities !== undefined) {
        if (Array.isArray(adminCities) && adminCities.length > 0) {
          admin.adminCities = Array.from(
            new Set(adminCities.filter((city) => typeof city === "string" && city.trim() !== "").map((city) => city.trim()))
          );
        } else {
          return res.status(400).json({
            message: "adminCities deve conter pelo menos uma cidade.",
          });
        }
      }

      if (secretaria !== undefined) {
        if (secretaria) {
          // Validar que a secretaria existe na cidade
          if (admin.adminCities.length > 1) {
            return res.status(400).json({
              message: "Secretaria só pode ser associada quando há apenas uma cidade.",
            });
          }

          const cityId = admin.adminCities[0];
          const City = require("../models/City");
          const city = await City.findOne({ id: cityId });
          if (!city) {
            return res.status(404).json({ message: "Cidade não encontrada." });
          }

          const secretariaExists = city.secretarias?.some((s) => s.id === secretaria);
          if (!secretariaExists) {
            return res.status(404).json({
              message: "Secretaria não encontrada nesta cidade.",
            });
          }

          admin.secretaria = secretaria;
        } else {
          admin.secretaria = undefined;
        }
      }
    }

    // Atualizar senha se fornecida
    if (password && password.trim().length >= 6) {
      const bcrypt = require("bcryptjs");
      admin.passwordHash = await bcrypt.hash(password, 10);
    }

    await admin.save();

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "admin_update",
        description: `Administrador "${admin.name}" atualizado`,
        details: {
          updatedAdminId: admin._id.toString(),
          updatedAdminName: admin.name,
          changes: {
            name: name ? "alterado" : null,
            email: email !== undefined ? "alterado" : null,
            cpf: cpf !== undefined ? "alterado" : null,
            phone: phone !== undefined ? "alterado" : null,
            secretaria: secretaria !== undefined ? "alterado" : null,
            password: password ? "alterado" : null,
          },
        },
        entityType: "admin",
        entityId: admin._id,
        cityId: admin.adminCities.length === 1 ? admin.adminCities[0] : null,
        req,
      });
    }

    return res.status(200).json({
      message: "Administrador atualizado com sucesso.",
      admin: {
        userId: admin._id,
        name: admin.name,
        email: admin.email,
        cpf: admin.cpf,
        phone: admin.phone,
        adminCities: admin.adminCities,
        secretaria: admin.secretaria || null,
        isSuperAdmin: !admin.isMayor && (!admin.adminCities || admin.adminCities.length === 0),
        isMayor: admin.isMayor || false,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar administrador:", error);
    return res.status(500).json({ message: "Erro interno ao atualizar administrador." });
  }
};

/**
 * POST /api/admin/users/mayor
 * Criar prefeito (apenas super admin)
 */
exports.createMayor = async (req, res) => {
  try {
    if (!req.admin?.isSuperAdmin) {
      return res.status(403).json({
        message: "Apenas super administradores podem criar prefeitos.",
      });
    }

    const {
      name,
      email,
      cpf,
      phone,
      birthDate,
      address,
      password,
      cityId,
    } = req.body;

    if (!name || !password || (!email && !cpf)) {
      return res.status(400).json({
        message: "Campos obrigatórios: name, password e email ou cpf.",
      });
    }

    if (!phone || !birthDate || !address?.bairro) {
      return res.status(400).json({
        message:
          "Informe telefone, data de nascimento e bairro para cadastro do prefeito.",
      });
    }

    if (!cityId) {
      return res.status(400).json({
        message: "cityId é obrigatório para criar um prefeito.",
      });
    }

    // Validar que a cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Verificar se já existe prefeito para esta cidade
    const existingMayor = await User.findOne({
      isMayor: true,
      adminCities: { $in: [cityId] },
    });

    if (existingMayor) {
      return res.status(409).json({
        message: `Já existe um prefeito cadastrado para a cidade ${city.label || cityId}.`,
      });
    }

    const sanitizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const sanitizedPhone = phone.replace(/\D/g, "");
    const normalizedEmail = email ? email.toLowerCase() : null;

    // Verificar se já existe usuário com mesmo email ou CPF
    const existingUser = await User.findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(sanitizedCpf ? [{ cpf: sanitizedCpf }] : []),
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Já existe um usuário com este e-mail ou CPF.",
      });
    }

    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      return res.status(400).json({
        message: "birthDate inválida. Use um formato reconhecido (YYYY-MM-DD).",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newMayor = await User.create({
      name,
      email: normalizedEmail,
      cpf: sanitizedCpf,
      phone: sanitizedPhone,
      birthDate: parsedBirthDate,
      address: {
        bairro: address.bairro,
        rua: address.rua || null,
        numero: address.numero || null,
        complemento: address.complemento || null,
      },
      isAdmin: true,
      isMayor: true,
      adminCities: [cityId],
      passwordHash: hashedPassword,
    });

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "admin_create",
        description: `Prefeito "${newMayor.name}" criado para a cidade ${city.label || cityId}`,
        details: {
          createdAdminId: newMayor._id.toString(),
          createdAdminName: newMayor.name,
          createdAdminEmail: newMayor.email,
          cityId,
          isMayor: true,
        },
        entityType: "admin",
        entityId: newMayor._id,
        cityId,
        req,
      });
    }

    return res.status(201).json({
      message: "Prefeito criado com sucesso.",
      mayor: {
        userId: newMayor._id,
        name: newMayor.name,
        email: newMayor.email,
        cpf: newMayor.cpf,
        phone: newMayor.phone,
        cityId,
        isMayor: true,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao criar prefeito:", error);
    return res.status(500).json({ message: "Erro interno ao criar prefeito." });
  }
};

/**
 * DELETE /api/admin/users/:userId
 * Deleta um administrador (apenas super admin)
 */
exports.deleteAdminUser = async (req, res) => {
  try {
    // Prefeitos também podem deletar admins (mas apenas da sua cidade e não outros prefeitos/super admins)
    if (!req.admin?.isSuperAdmin && !req.admin?.isMayor) {
      return res.status(403).json({
        message: "Apenas super administradores e prefeitos podem deletar administradores.",
      });
    }

    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    // Não permite deletar a si mesmo
    if (req.admin.userId.toString() === userId) {
      return res.status(400).json({
        message: "Você não pode deletar seu próprio usuário.",
      });
    }

    const admin = await User.findById(userId);

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ message: "Administrador não encontrado." });
    }

    // Não permite deletar outro super admin ou prefeito
    const isTargetSuperAdmin = !admin.isMayor && (!admin.adminCities || admin.adminCities.length === 0);
    const isTargetMayor = admin.isMayor === true;
    
    if (isTargetSuperAdmin || isTargetMayor) {
      // Prefeitos não podem deletar outros prefeitos ou super admins
      if (req.admin.isMayor && !req.admin.isSuperAdmin) {
        return res.status(403).json({
          message: "Prefeitos não podem deletar outros prefeitos ou super administradores.",
        });
      }
      // Super admins não podem deletar outros super admins
      if (isTargetSuperAdmin && req.admin.userId.toString() !== userId) {
        return res.status(403).json({
          message: "Não é possível deletar outro super administrador.",
        });
      }
    }
    
    // Prefeitos só podem deletar admins da sua cidade
    if (req.admin.isMayor && !req.admin.isSuperAdmin) {
      const mayorCityId = req.admin.allowedCities?.[0];
      if (mayorCityId && !admin.adminCities.includes(mayorCityId)) {
        return res.status(403).json({
          message: "Você só pode deletar administradores da sua cidade.",
        });
      }
    }

    const deletedAdminName = admin.name;
    const deletedAdminCities = admin.adminCities;

    await User.findByIdAndDelete(userId);

    console.log(`✅ Administrador ${userId} deletado com sucesso`);

    // Registrar ação no histórico
    if (req.admin) {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        admin: req.admin,
        actionType: "admin_delete",
        description: `Administrador "${deletedAdminName}" deletado`,
        details: {
          deletedAdminId: userId,
          deletedAdminName,
          deletedAdminCities,
        },
        entityType: "admin",
        entityId: userId,
        cityId: deletedAdminCities.length === 1 ? deletedAdminCities[0] : null,
        req,
      });
    }

    return res.status(200).json({
      message: "Administrador deletado com sucesso.",
      userId,
    });
  } catch (error) {
    console.error("❌ Erro ao deletar administrador:", error);
    return res.status(500).json({ message: "Erro interno ao deletar administrador." });
  }
};

