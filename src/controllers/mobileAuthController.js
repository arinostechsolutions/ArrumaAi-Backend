const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const City = require("../models/City");
const { signAdminToken } = require("../utils/jwt");

/**
 * 📱 Controller de Autenticação Mobile
 * Gerencia login, registro e recuperação de senha para o app mobile
 */

// Gerar token JWT para usuário mobile
const signMobileToken = (payload = {}) => {
  const jwt = require("jsonwebtoken");
  const JWT_SECRET = process.env.JWT_SECRET || "resolveai-secret";
  const JWT_EXPIRES_IN = process.env.JWT_MOBILE_EXPIRES_IN || "30d"; // Token mobile dura mais
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * POST /api/mobile-auth/login
 * Login com CPF/Email e senha
 */
exports.login = async (req, res) => {
  try {
    const { email, cpf, password, cityId } = req.body;

    if ((!email && !cpf) || !password) {
      return res.status(400).json({
        message: "Informe e-mail ou CPF e a senha para fazer login.",
      });
    }

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    console.log("📱 [Mobile Auth] Tentativa de login:", {
      email: normalizedEmail ? `${normalizedEmail.slice(0, 3)}***` : null,
      cpf: normalizedCpf ? `${normalizedCpf.slice(0, 3)}***` : null,
      cityId,
    });

    // Buscar usuário
    let query = {};
    if (normalizedEmail) {
      query.email = normalizedEmail;
    } else if (normalizedCpf) {
      query.cpf = normalizedCpf;
    }

    // Se cityId fornecido, buscar a cidade primeiro
    if (cityId) {
      const city = await City.findOne({ id: cityId });
      if (city) {
        query.city = city._id;
      }
    }

    const user = await User.findOne(query).select("+passwordHash");

    if (!user) {
      console.log("📱 [Mobile Auth] Usuário não encontrado");
      return res.status(401).json({
        message: "Credenciais inválidas.",
      });
    }

    // Verificar se usuário tem senha cadastrada
    if (!user.passwordHash) {
      console.log("📱 [Mobile Auth] Usuário sem senha cadastrada");
      return res.status(401).json({
        message: "Você ainda não definiu uma senha. Use a opção 'Esqueci minha senha' para criar uma.",
        needsPasswordSetup: true,
      });
    }

    // Verificar senha
    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      console.log("📱 [Mobile Auth] Senha inválida");
      return res.status(401).json({
        message: "Credenciais inválidas.",
      });
    }

    // Gerar token
    const token = signMobileToken({
      userId: user._id.toString(),
      name: user.name,
      cpf: user.cpf,
      cityId: user.city?.toString(),
    });

    // Atualizar último login
    user.lastLoginAt = new Date();
    await user.save();

    console.log("📱 [Mobile Auth] Login bem-sucedido:", user._id);

    // Buscar dados da cidade
    const city = await City.findById(user.city);

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || null,
        cpf: user.cpf,
        phone: user.phone,
        birthDate: user.birthDate,
        profileImage: user.profileImage || null,
        address: user.address,
        isAdmin: user.isAdmin || false,
      },
      city: city ? {
        id: city.id,
        label: city.label,
        bairros: city.bairros || [],
      } : null,
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro no login:", error);
    return res.status(500).json({ message: "Erro interno ao autenticar." });
  }
};

/**
 * POST /api/mobile-auth/register
 * Registro com senha
 */
exports.register = async (req, res) => {
  try {
    const { 
      cityId, 
      cpf, 
      name, 
      birthDate, 
      phone, 
      email, 
      password,
      address 
    } = req.body;

    console.log("📱 [Mobile Auth] Tentativa de registro:", {
      cityId,
      cpf: cpf ? `${cpf.slice(0, 3)}***` : null,
      email: email ? `${email.slice(0, 3)}***` : null,
    });

    // Validações
    const bairro = address?.bairro;

    if (!cityId || !cpf || !name || !birthDate || !phone || !bairro || !password) {
      return res.status(400).json({
        message: "Todos os campos obrigatórios devem ser preenchidos (incluindo senha).",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 6 caracteres.",
      });
    }

    // Buscar cidade
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    const normalizedCpf = cpf.replace(/\D/g, "");
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Verificar se usuário já existe
    const existingUser = await User.findOne({
      $or: [
        { cpf: normalizedCpf, city: city._id },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Já existe um usuário com este CPF ou e-mail.",
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Formatar dados
    const formattedBirthDate = new Date(birthDate.includes("/") 
      ? birthDate.split("/").reverse().join("-") 
      : birthDate
    );
    const formattedPhone = phone.replace(/\D/g, "");

    // Criar usuário
    const newUser = new User({
      name,
      cpf: normalizedCpf,
      birthDate: formattedBirthDate,
      phone: formattedPhone,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      address: {
        bairro,
        rua: address.rua || null,
        numero: address.numero || null,
        complemento: address.complemento || null,
      },
      city: city._id,
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

    await newUser.save();

    // Adicionar usuário à cidade
    city.users.push(newUser._id);
    await city.save();

    // Gerar token
    const token = signMobileToken({
      userId: newUser._id.toString(),
      name: newUser.name,
      cpf: newUser.cpf,
      cityId: city._id.toString(),
    });

    console.log("📱 [Mobile Auth] Registro bem-sucedido:", newUser._id);

    return res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email || null,
        cpf: newUser.cpf,
        phone: newUser.phone,
        birthDate: newUser.birthDate,
        profileImage: null,
        address: newUser.address,
        isAdmin: false,
      },
      city: {
        id: city.id,
        label: city.label,
        bairros: city.bairros || [],
      },
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro no registro:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Usuário já cadastrado no sistema.",
      });
    }
    
    return res.status(500).json({ message: "Erro interno ao registrar." });
  }
};

/**
 * POST /api/mobile-auth/forgot-password
 * Solicitar recuperação de senha
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email, cpf, cityId } = req.body;

    if (!email && !cpf) {
      return res.status(400).json({
        message: "Informe seu e-mail ou CPF para recuperar a senha.",
      });
    }

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    console.log("📱 [Mobile Auth] Solicitação de recuperação de senha:", {
      email: normalizedEmail ? `${normalizedEmail.slice(0, 3)}***` : null,
      cpf: normalizedCpf ? `${normalizedCpf.slice(0, 3)}***` : null,
    });

    // Buscar usuário
    let query = {};
    if (normalizedEmail) {
      query.email = normalizedEmail;
    } else if (normalizedCpf) {
      query.cpf = normalizedCpf;
    }

    if (cityId) {
      const city = await City.findOne({ id: cityId });
      if (city) {
        query.city = city._id;
      }
    }

    const user = await User.findOne(query);

    if (!user) {
      // Por segurança, não revelamos se o usuário existe ou não
      return res.status(200).json({
        message: "Se o usuário existir, um código de recuperação será enviado.",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        message: "Este usuário não possui e-mail cadastrado. Entre em contato com o suporte.",
      });
    }

    // Gerar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salvar código no usuário
    user.passwordResetCode = {
      code: resetCode,
      expiresAt: resetCodeExpires,
    };
    await user.save();

    // TODO: Enviar e-mail com o código
    // Por enquanto, vamos logar o código (em produção, enviar por e-mail)
    console.log(`📧 [Mobile Auth] Código de recuperação para ${user.email}: ${resetCode}`);

    // Em desenvolvimento, retornar o código (remover em produção!)
    const isDev = process.env.NODE_ENV !== "production";

    return res.status(200).json({
      message: "Um código de recuperação foi enviado para seu e-mail.",
      email: `${user.email.slice(0, 3)}***@${user.email.split("@")[1]}`,
      ...(isDev && { devCode: resetCode }), // Apenas em desenvolvimento
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro na recuperação de senha:", error);
    return res.status(500).json({ message: "Erro interno ao processar solicitação." });
  }
};

/**
 * POST /api/mobile-auth/reset-password
 * Redefinir senha com código
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, cpf, code, newPassword, cityId } = req.body;

    if ((!email && !cpf) || !code || !newPassword) {
      return res.status(400).json({
        message: "Informe e-mail ou CPF, o código e a nova senha.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 6 caracteres.",
      });
    }

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Buscar usuário
    let query = {};
    if (normalizedEmail) {
      query.email = normalizedEmail;
    } else if (normalizedCpf) {
      query.cpf = normalizedCpf;
    }

    if (cityId) {
      const city = await City.findOne({ id: cityId });
      if (city) {
        query.city = city._id;
      }
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({
        message: "Código inválido ou expirado.",
      });
    }

    // Verificar código
    if (
      !user.passwordResetCode ||
      user.passwordResetCode.code !== code ||
      new Date() > new Date(user.passwordResetCode.expiresAt)
    ) {
      return res.status(400).json({
        message: "Código inválido ou expirado.",
      });
    }

    // Atualizar senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashedPassword;
    user.passwordResetCode = undefined; // Limpar código usado
    await user.save();

    console.log("📱 [Mobile Auth] Senha redefinida com sucesso:", user._id);

    return res.status(200).json({
      message: "Senha redefinida com sucesso! Você já pode fazer login.",
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro ao redefinir senha:", error);
    return res.status(500).json({ message: "Erro interno ao redefinir senha." });
  }
};

/**
 * POST /api/mobile-auth/set-password
 * Definir senha para usuário existente (que ainda não tem senha)
 */
exports.setPassword = async (req, res) => {
  try {
    const { cpf, email, password, cityId } = req.body;

    if ((!cpf && !email) || !password) {
      return res.status(400).json({
        message: "Informe CPF ou e-mail e a nova senha.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 6 caracteres.",
      });
    }

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Buscar usuário
    let query = {};
    if (normalizedCpf) {
      query.cpf = normalizedCpf;
    } else if (normalizedEmail) {
      query.email = normalizedEmail;
    }

    if (cityId) {
      const city = await City.findOne({ id: cityId });
      if (city) {
        query.city = city._id;
      }
    }

    const user = await User.findOne(query).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    if (user.passwordHash) {
      return res.status(400).json({
        message: "Este usuário já possui uma senha. Use a opção 'Esqueci minha senha' para redefinir.",
      });
    }

    // Definir senha
    const hashedPassword = await bcrypt.hash(password, 10);
    user.passwordHash = hashedPassword;
    await user.save();

    console.log("📱 [Mobile Auth] Senha definida com sucesso:", user._id);

    // Gerar token
    const token = signMobileToken({
      userId: user._id.toString(),
      name: user.name,
      cpf: user.cpf,
      cityId: user.city?.toString(),
    });

    // Buscar cidade
    const city = await City.findById(user.city);

    return res.status(200).json({
      message: "Senha definida com sucesso!",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || null,
        cpf: user.cpf,
        phone: user.phone,
        birthDate: user.birthDate,
        profileImage: user.profileImage || null,
        address: user.address,
        isAdmin: user.isAdmin || false,
      },
      city: city ? {
        id: city.id,
        label: city.label,
        bairros: city.bairros || [],
      } : null,
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro ao definir senha:", error);
    return res.status(500).json({ message: "Erro interno ao definir senha." });
  }
};

/**
 * POST /api/mobile-auth/check-user
 * Verificar se usuário existe e se tem senha
 */
exports.checkUser = async (req, res) => {
  try {
    const { cpf, cityId } = req.body;

    if (!cpf) {
      return res.status(400).json({
        message: "CPF é obrigatório.",
      });
    }

    const normalizedCpf = cpf.replace(/\D/g, "");

    console.log("📱 [Mobile Auth] Verificando usuário:", {
      cpf: `${normalizedCpf.slice(0, 3)}***`,
      cityId,
    });

    // Buscar cidade se fornecida
    let query = { cpf: normalizedCpf };
    if (cityId) {
      const city = await City.findOne({ id: cityId });
      if (city) {
        query.city = city._id;
      }
    }

    const user = await User.findOne(query).select("+passwordHash");

    if (!user) {
      console.log("📱 [Mobile Auth] Usuário não encontrado");
      return res.status(200).json({
        exists: false,
        hasPassword: false,
        message: "Usuário não encontrado.",
      });
    }

    const hasPassword = !!user.passwordHash;

    console.log("📱 [Mobile Auth] Usuário encontrado:", {
      exists: true,
      hasPassword,
      userId: user._id,
    });

    return res.status(200).json({
      exists: true,
      hasPassword,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || null,
      },
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro ao verificar usuário:", error);
    return res.status(500).json({ message: "Erro interno." });
  }
};

/**
 * GET /api/mobile-auth/me
 * Obter dados do usuário autenticado
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const city = await City.findById(user.city);

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || null,
        cpf: user.cpf,
        phone: user.phone,
        birthDate: user.birthDate,
        profileImage: user.profileImage || null,
        address: user.address,
        isAdmin: user.isAdmin || false,
      },
      city: city ? {
        id: city.id,
        label: city.label,
        bairros: city.bairros || [],
      } : null,
    });
  } catch (error) {
    console.error("❌ [Mobile Auth] Erro ao buscar usuário:", error);
    return res.status(500).json({ message: "Erro interno." });
  }
};

