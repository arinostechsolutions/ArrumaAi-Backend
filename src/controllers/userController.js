const mongoose = require("mongoose");
const User = require("../models/User");
const City = require("../models/City");
const { sendEmailVerificationCode } = require("../services/emailService");

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

// ==========================================
// 📧 ATUALIZAÇÃO DE EMAIL COM VERIFICAÇÃO
// ==========================================

/**
 * Gera código de 6 dígitos
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/user/request-email-change
 * Solicita alteração de email - envia código de verificação para o novo email
 */
exports.requestEmailChange = async (req, res) => {
  try {
    const { userId, newEmail } = req.body;

    if (!userId || !newEmail) {
      return res.status(400).json({ message: "userId e newEmail são obrigatórios." });
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ message: "Formato de e-mail inválido." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Verificar se o novo email já está em uso por outro usuário
    const existingUser = await User.findOne({ 
      email: newEmail.toLowerCase(), 
      _id: { $ne: userId } 
    });
    if (existingUser) {
      return res.status(400).json({ message: "Este e-mail já está em uso." });
    }

    // Gerar código de verificação
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salvar código no usuário
    user.emailVerification = {
      code: verificationCode,
      newEmail: newEmail.toLowerCase(),
      expiresAt,
    };
    await user.save();

    // Enviar email com o código
    console.log(`📧 [Email Change] Enviando código de verificação para ${newEmail}...`);
    const emailSent = await sendEmailVerificationCode(newEmail, verificationCode, user.name);

    if (!emailSent) {
      console.log(`📧 [Email Change] Email não configurado - código: ${verificationCode}`);
    }

    return res.status(200).json({
      message: "Código de verificação enviado para o novo e-mail.",
      // Em dev (ou se email não configurado), retornar o código para testes
      ...(!emailSent && { devCode: verificationCode }),
    });

  } catch (error) {
    console.error("❌ Erro ao solicitar alteração de email:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/user/confirm-email-change
 * Confirma alteração de email com código de verificação
 */
exports.confirmEmailChange = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ message: "userId e código são obrigatórios." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Verificar se há solicitação pendente
    if (!user.emailVerification?.code || !user.emailVerification?.newEmail) {
      return res.status(400).json({ message: "Nenhuma solicitação de alteração de e-mail pendente." });
    }

    // Verificar se o código expirou
    if (new Date() > new Date(user.emailVerification.expiresAt)) {
      user.emailVerification = undefined;
      await user.save();
      return res.status(400).json({ message: "Código expirado. Solicite um novo código." });
    }

    // Verificar código
    if (user.emailVerification.code !== code) {
      return res.status(400).json({ message: "Código inválido." });
    }

    // Atualizar email
    const oldEmail = user.email;
    user.email = user.emailVerification.newEmail;
    user.emailVerified = true;
    user.emailVerification = undefined;
    await user.save();

    console.log(`✅ [Email Change] Email alterado de ${oldEmail} para ${user.email}`);

    return res.status(200).json({
      message: "E-mail atualizado com sucesso!",
      email: user.email,
    });

  } catch (error) {
    console.error("❌ Erro ao confirmar alteração de email:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// ==========================================
// 📱 ATUALIZAÇÃO DE TELEFONE COM VERIFICAÇÃO
// ==========================================

/**
 * POST /api/user/request-phone-change
 * Solicita alteração de telefone - envia código de verificação via SMS
 */
exports.requestPhoneChange = async (req, res) => {
  try {
    const { userId, newPhone } = req.body;

    if (!userId || !newPhone) {
      return res.status(400).json({ message: "userId e newPhone são obrigatórios." });
    }

    // Normalizar telefone (remover formatação)
    const normalizedPhone = newPhone.replace(/\D/g, "");

    // Validar formato do telefone (11 dígitos para celular brasileiro)
    if (normalizedPhone.length !== 11) {
      return res.status(400).json({ message: "Telefone deve ter 11 dígitos (DDD + número)." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Verificar se o novo telefone já está em uso por outro usuário
    const existingUser = await User.findOne({ 
      phone: normalizedPhone, 
      _id: { $ne: userId } 
    });
    if (existingUser) {
      return res.status(400).json({ message: "Este telefone já está em uso." });
    }

    // Gerar código de verificação
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salvar código no usuário
    user.phoneVerification = {
      code: verificationCode,
      newPhone: normalizedPhone,
      expiresAt,
    };
    await user.save();

    // TODO: Enviar SMS com o código
    // Por enquanto, em desenvolvimento, retornamos o código
    console.log(`📱 [Phone Change] Código de verificação para ${normalizedPhone}: ${verificationCode}`);

    // Em produção, enviar SMS real via Twilio, AWS SNS, etc.
    // await sendVerificationSMS(normalizedPhone, verificationCode);

    return res.status(200).json({
      message: "Código de verificação enviado para o novo telefone.",
      // Em dev, retornar o código para testes
      ...(process.env.NODE_ENV === "development" && { devCode: verificationCode }),
    });

  } catch (error) {
    console.error("❌ Erro ao solicitar alteração de telefone:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * POST /api/user/confirm-phone-change
 * Confirma alteração de telefone com código de verificação
 */
exports.confirmPhoneChange = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ message: "userId e código são obrigatórios." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Verificar se há solicitação pendente
    if (!user.phoneVerification?.code || !user.phoneVerification?.newPhone) {
      return res.status(400).json({ message: "Nenhuma solicitação de alteração de telefone pendente." });
    }

    // Verificar se o código expirou
    if (new Date() > new Date(user.phoneVerification.expiresAt)) {
      user.phoneVerification = undefined;
      await user.save();
      return res.status(400).json({ message: "Código expirado. Solicite um novo código." });
    }

    // Verificar código
    if (user.phoneVerification.code !== code) {
      return res.status(400).json({ message: "Código inválido." });
    }

    // Atualizar telefone
    const oldPhone = user.phone;
    user.phone = user.phoneVerification.newPhone;
    user.phoneVerified = true;
    user.phoneVerification = undefined;
    await user.save();

    console.log(`✅ [Phone Change] Telefone alterado de ${oldPhone} para ${user.phone}`);

    return res.status(200).json({
      message: "Telefone atualizado com sucesso!",
      phone: user.phone,
    });

  } catch (error) {
    console.error("❌ Erro ao confirmar alteração de telefone:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/user/profile/:userId
 * Retorna os dados do perfil do usuário
 */
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate("city", "id label");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      cpf: user.cpf,
      email: user.email || null,
      emailVerified: user.emailVerified || false,
      phone: user.phone,
      phoneVerified: user.phoneVerified || false,
      birthDate: user.birthDate,
      profileImage: user.profileImage,
      address: user.address,
      city: user.city,
      isAdmin: user.isAdmin,
    });

  } catch (error) {
    console.error("❌ Erro ao buscar perfil:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};
