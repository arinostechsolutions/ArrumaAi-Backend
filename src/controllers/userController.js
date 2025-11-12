const mongoose = require("mongoose");
const User = require("../models/User");
const City = require("../models/City");

exports.checkUserByCPF = async (req, res) => {
  try {
    const { cityId, cpf } = req.query;

    if (!cityId || !cpf) {
      console.log("⚠️ Parâmetros obrigatórios ausentes:", { cityId, cpf });
      return res.status(400).json({ message: "Parâmetros inválidos." });
    }

    const normalizedCpf = cpf.replace(/\D/g, "");

    console.log("🔎 Verificando CPF:", { cityId, normalizedCpf });

    const city = await City.findOne({ id: cityId });
    if (!city) {
      console.log("❌ Cidade não encontrada:", cityId);
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const user = await User.findOne({ cpf: normalizedCpf, city: city._id });

    if (user) {
      console.log("✅ Usuário encontrado:", user);
      
      // Garantir que profileImage sempre exista no retorno (mesmo que null)
      const userResponse = {
        ...user.toObject(),
        profileImage: user.profileImage || null,
      };
      
      return res.status(200).json({ exists: true, user: userResponse });
    }

    console.log("⚠️ Usuário não encontrado.");
    return res
      .status(200)
      .json({ exists: false, message: "Usuário não encontrado nesta cidade." });
  } catch (error) {
    console.error("❌ Erro ao verificar usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { cityId, cpf, name, birthDate, phone, email, address } = req.body;

    console.log("📦 Dados recebidos no backend:", JSON.stringify(req.body, null, 2));
    console.log("🏠 Endereço recebido:", address);

    const bairro =
      address?.bairro ||
      address?.neighborhood ||
      address?.district ||
      address?.bairro?.trim?.();

    if (!cityId || !cpf || !name || !birthDate || !phone || !bairro) {
      console.log("⚠️ Campos obrigatórios faltando:", {
        cityId,
        cpf,
        name,
        birthDate,
        phone,
        bairro,
      });
      return res
        .status(400)
        .json({ message: "Todos os campos obrigatórios devem ser preenchidos (incluindo bairro)." });
    }

    console.log("🔎 Buscando cidade no banco de dados...");
    const city = await City.findOne({ id: cityId });
    if (!city) {
      console.log("❌ Cidade não encontrada:", cityId);
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const normalizedCpf = cpf.replace(/\D/g, "");

    console.log("🔎 Verificando se usuário já existe...");
    const existingUser = await User.findOne({
      cpf: normalizedCpf,
      city: city._id,
    });

    if (existingUser) {
      console.log("⚠️ Usuário já cadastrado:", existingUser);
      return res
        .status(400)
        .json({ message: "Usuário já cadastrado nesta cidade." });
    }

    // Formatar dados
    const formattedBirthDate = new Date(
      birthDate.split("/").reverse().join("-")
    );
    const formattedPhone = phone.replace(/\D/g, "");

    // Criar usuário com dados fornecidos pelo próprio usuário
    const newUser = new User({
      name: name,
      cpf: normalizedCpf,
      birthDate: formattedBirthDate,
      phone: formattedPhone,
      email: email || null,
      address: {
        bairro,
        rua: address.rua || null,
        numero: address.numero || null,
        complemento: address.complemento || null,
      },
      city: city._id,
      susCard: null, // Usuário pode adicionar depois se quiser
      lgpdConsent: {
        accepted: true,
        acceptedAt: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
      },
      termsAccepted: {
        accepted: true,
        acceptedAt: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
      },
    });

    console.log("✅ Dados do usuário antes de salvar:", {
      name,
      cpf: normalizedCpf,
      birthDate: formattedBirthDate,
      phone: formattedPhone,
      address: {
        bairro,
        rua: address.rua,
        numero: address.numero,
        complemento: address.complemento,
      },
    });

    console.log("📝 Salvando usuário no banco de dados...");
    console.log("🔍 Objeto newUser completo:", JSON.stringify(newUser, null, 2));
    try {
      const savedUser = await newUser.save();
      console.log("🎉 Usuário salvo com sucesso!");
      console.log("💾 Usuário salvo no banco:", JSON.stringify(savedUser, null, 2));
    } catch (error) {
      if (error.code === 11000) {
        console.error(
          "❌ Erro: Chave duplicada detectada no banco de dados.",
          error
        );
        return res
          .status(400)
          .json({ message: "Usuário já cadastrado no sistema." });
      }
      console.error("❌ Erro ao salvar usuário:", error);
      return res
        .status(500)
        .json({ message: "Erro ao salvar usuário no banco de dados." });
    }

    console.log("🔄 Adicionando usuário à cidade...");
    city.users.push(newUser._id);
    await city.save();

    console.log("✅ Novo usuário cadastrado com sucesso:", newUser);

    return res.status(201).json(newUser);
  } catch (error) {
    console.error("❌ Erro ao registrar usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { cpf } = req.params;
    const updates = req.body;

    const user = await User.findOneAndUpdate({ cpf }, updates, { new: true });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("❌ Erro ao atualizar usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

exports.updateProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { profileImage } = req.body;

    console.log("📸 Atualizando foto de perfil do usuário:", userId);
    console.log("🖼️ URL da imagem:", profileImage);

    if (!profileImage) {
      return res.status(400).json({ message: "URL da imagem é obrigatória." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage },
      { new: true }
    );

    if (!user) {
      console.log("❌ Usuário não encontrado:", userId);
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    console.log("✅ Foto de perfil atualizada com sucesso!");
    return res.status(200).json(user);
  } catch (error) {
    console.error("❌ Erro ao atualizar foto de perfil:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * DELETE /api/user/deleteUser/:userId
 * Deleta a conta do usuário e todos os dados relacionados (LGPD compliance)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    console.log(`🗑️ Iniciando exclusão completa da conta do usuário: ${userId}`);

    const Report = require("../models/Report");
    const ContentReport = require("../models/ContentReport");
    const HealthAppointment = require("../models/HealthAppointment");
    const City = require("../models/City");

    // 1. Buscar IDs dos reports antes de deletar (para remover das cidades)
    const userReports = await Report.find({ "user.userId": user._id }).select("_id");
    const reportIds = userReports.map(r => r._id);

    // 2. Deletar todos os Reports criados pelo usuário
    const reportsDeleted = await Report.deleteMany({ "user.userId": user._id });
    console.log(`📝 ${reportsDeleted.deletedCount} reports deletados`);

    // 3. Remover referências em reportList das cidades (reports deletados)
    if (reportIds.length > 0) {
      await City.updateMany(
        {},
        { $pull: { "modules.reports.reportList": { $in: reportIds } } }
      );
      console.log(`🏙️ Referências de reports removidas das cidades`);
    }

    // 4. Remover likes, views e shares do usuário de todos os reports
    await Report.updateMany(
      {},
      {
        $pull: {
          likes: { userId: user._id },
          views: { userId: user._id },
          shares: { userId: user._id },
        },
      }
    );
    console.log(`👍 Interações removidas de todos os reports`);

    // 5. Deletar ContentReports feitos pelo usuário
    const contentReportsDeleted = await ContentReport.deleteMany({
      "reportedBy.userId": user._id,
    });
    console.log(`🚨 ${contentReportsDeleted.deletedCount} denúncias de conteúdo deletadas`);

    // 6. Deletar HealthAppointments do usuário
    const appointmentsDeleted = await HealthAppointment.deleteMany({
      user: user._id,
    });
    console.log(`🏥 ${appointmentsDeleted.deletedCount} agendamentos de saúde deletados`);

    // 7. Remover usuário da cidade
    await City.updateOne({ users: user._id }, { $pull: { users: user._id } });
    console.log(`🏙️ Usuário removido da cidade`);

    // 8. Deletar o usuário
    await User.findByIdAndDelete(user._id);
    console.log(`✅ Usuário ${userId} deletado com sucesso`);

    return res.status(200).json({
      message: "Conta e todos os dados relacionados foram deletados com sucesso.",
      deleted: {
        reports: reportsDeleted.deletedCount,
        contentReports: contentReportsDeleted.deletedCount,
        appointments: appointmentsDeleted.deletedCount,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao deletar usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/user/hidePost
 * Oculta um post do feed do usuário
 */
exports.hidePost = async (req, res) => {
  try {
    const { userId, reportId } = req.body;

    console.log(`🙈 Ocultando post ${reportId} para usuário ${userId}`);

    if (!userId || !reportId) {
      return res.status(400).json({ message: "userId e reportId são obrigatórios." });
    }

    // Adiciona o reportId ao array hiddenPosts (se não existir)
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { hiddenPosts: reportId } }, // $addToSet evita duplicatas
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    console.log(`✅ Post ocultado com sucesso para usuário ${userId}`);
    return res.status(200).json({
      message: "Post ocultado com sucesso.",
      hiddenPostsCount: user.hiddenPosts.length,
    });

  } catch (error) {
    console.error("❌ Erro ao ocultar post:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/user/unhidePost
 * Exibe um post previamente oculto
 */
exports.unhidePost = async (req, res) => {
  try {
    const { userId, reportId } = req.body;

    console.log(`👁️ Exibindo post ${reportId} para usuário ${userId}`);

    if (!userId || !reportId) {
      return res.status(400).json({ message: "userId e reportId são obrigatórios." });
    }

    // Remove o reportId do array hiddenPosts
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { hiddenPosts: reportId } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    console.log(`✅ Post exibido novamente para usuário ${userId}`);
    return res.status(200).json({
      message: "Post exibido novamente.",
      hiddenPostsCount: user.hiddenPosts.length,
    });

  } catch (error) {
    console.error("❌ Erro ao exibir post:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};
