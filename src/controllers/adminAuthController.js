const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signAdminToken } = require("../utils/jwt");

const maskEmail = (email) => {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return `${local.slice(0, 2)}***`;
  return `${local.slice(0, 2)}***@${domain}`;
};

const maskCpf = (cpf) => {
  if (!cpf) return null;
  const numericCpf = cpf.replace(/\D/g, "");
  if (numericCpf.length < 4) return "***";
  return `${numericCpf.slice(0, 3)}***${numericCpf.slice(-2)}`;
};

const maskToken = (token) => {
  if (!token) return null;
  if (token.length <= 6) return "***";
  return `${token.slice(0, 3)}***${token.slice(-3)}`;
};

const logContext = (message, context = {}, level = "log") => {
  const logger = console[level] || console.log;
  logger(`[admin-auth] ${message}`, context);
};

exports.login = async (req, res) => {
  try {
    const { email, cpf, password } = req.body;

    if ((!email && !cpf) || !password) {
      return res.status(400).json({
        message: "Informe e-mail ou CPF e a senha para acessar o dashboard.",
      });
    }

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;

    logContext("Tentativa de login recebida", {
      email: maskEmail(email),
      cpf: maskCpf(normalizedCpf),
    });

    const user = await User.findOne(
      email
        ? { email: email.toLowerCase(), isAdmin: true }
        : { cpf: normalizedCpf, isAdmin: true },
    ).select("+passwordHash");

    if (!user || !user.passwordHash) {
      logContext(
        "Login rejeitado: usuário não encontrado ou sem senha cadastrada",
        {
          email: maskEmail(email),
          cpf: maskCpf(normalizedCpf),
          userFound: Boolean(user),
          hasPassword: Boolean(user?.passwordHash),
        },
        "warn",
      );
      return res.status(401).json({
        message: "Credenciais inválidas.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      logContext(
        "Login rejeitado: senha inválida",
        {
          email: maskEmail(email),
          cpf: maskCpf(normalizedCpf),
          userId: user._id,
        },
        "warn",
      );
      return res.status(401).json({
        message: "Credenciais inválidas.",
      });
    }

    const allowedCities = Array.isArray(user.adminCities)
      ? user.adminCities.filter((city) => typeof city === "string" && city.trim() !== "")
      : [];

    const isMayor = user.isMayor === true;
    const isSuperAdmin = !isMayor && allowedCities.length === 0;

    const token = signAdminToken({
      userId: user._id.toString(),
      name: user.name,
      allowedCities,
      isSuperAdmin,
      isMayor,
      secretaria: user.secretaria || null,
    });

    user.lastLoginAt = new Date();
    await user.save();

    // Registrar login no histórico
    const { logActivity } = require("../utils/activityLogger");
    await logActivity({
      admin: {
        userId: user._id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        secretaria: user.secretaria || null,
        isSuperAdmin: isSuperAdmin,
        isMayor: isMayor,
      },
      actionType: "login",
      description: "Login realizado no dashboard",
      details: {
        allowedCities,
        isSuperAdmin: isSuperAdmin,
        isMayor: isMayor,
      },
      cityId: allowedCities.length === 1 ? allowedCities[0] : null,
      req,
    });

    logContext(
      "Login aceito",
      {
        userId: user._id,
        email: maskEmail(user.email),
        allowedCitiesCount: allowedCities.length,
        isSuperAdmin: allowedCities.length === 0,
      },
      "info",
    );

    return res.status(200).json({
      token,
      admin: {
        userId: user._id,
        name: user.name,
        email: user.email || null,
        cpf: user.cpf,
        allowedCities,
        isSuperAdmin: isSuperAdmin,
        isMayor: isMayor,
        secretaria: user.secretaria || null,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("❌ Erro no login admin:", error);
    return res.status(500).json({ message: "Erro interno ao autenticar." });
  }
};

exports.bootstrapSuperAdmin = async (req, res) => {
  try {
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_TOKEN;

    logContext(
      "Requisição de bootstrap recebida",
      {
        hasEnvToken: Boolean(bootstrapSecret),
        tokenHeader: maskToken(req.headers["x-admin-bootstrap-token"]),
        tokenBody: maskToken(req.body?.bootstrapToken),
        tokenQuery: maskToken(req.query?.bootstrapToken),
      },
      "info",
    );

    if (!bootstrapSecret) {
      logContext(
        "Bootstrap bloqueado: ADMIN_BOOTSTRAP_TOKEN ausente no ambiente",
        {},
        "error",
      );
      return res.status(500).json({
        message:
          "ADMIN_BOOTSTRAP_TOKEN não configurado. Defina a variável de ambiente para habilitar o bootstrap.",
      });
    }

    const providedToken =
      req.headers["x-admin-bootstrap-token"] ||
      req.body?.bootstrapToken ||
      req.query?.bootstrapToken;

    if (!providedToken || providedToken !== bootstrapSecret) {
      logContext(
        "Bootstrap bloqueado: token inválido",
        {
          providedToken: maskToken(providedToken),
          matchesSecret: providedToken === bootstrapSecret,
        },
        "warn",
      );
      return res.status(403).json({
        message: "Token de bootstrap inválido.",
      });
    }

    const existingSuperAdmin = await User.findOne({
      isAdmin: true,
      adminCities: { $size: 0 },
    });

    if (existingSuperAdmin) {
      logContext(
        "Bootstrap interrompido: super-admin já existe",
        { existingSuperAdminId: existingSuperAdmin._id },
        "warn",
      );
      return res.status(409).json({
        message:
          "Já existe um super-admin cadastrado. Use o login padrão ou remova o usuário existente.",
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
    } = req.body || {};

    if (!name || !email || !password) {
      logContext(
        "Bootstrap rejeitado: campos obrigatórios ausentes",
        {
          hasName: Boolean(name),
          hasEmail: Boolean(email),
          hasPassword: Boolean(password),
        },
        "warn",
      );
      return res.status(400).json({
        message: "Campos obrigatórios: name, email e password.",
      });
    }

    if (!phone || !birthDate || !address?.bairro) {
      logContext(
        "Bootstrap rejeitado: campos de contato ausentes",
        {
          hasPhone: Boolean(phone),
          hasBirthDate: Boolean(birthDate),
          hasBairro: Boolean(address?.bairro),
        },
        "warn",
      );
      return res.status(400).json({
        message:
          "Informe telefone, data de nascimento e bairro para o cadastro do super-admin.",
      });
    }

    const normalizedEmail = email.toLowerCase();
    const sanitizedCpf = cpf ? cpf.replace(/\D/g, "") : null;
    const sanitizedPhone = phone.replace(/\D/g, "");

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(sanitizedCpf ? [{ cpf: sanitizedCpf }] : []),
      ],
    });

    if (existingUser) {
      logContext(
        "Bootstrap rejeitado: usuário já existe",
        {
          email: maskEmail(normalizedEmail),
          cpf: maskCpf(sanitizedCpf),
          existingUserId: existingUser._id,
        },
        "warn",
      );
      return res.status(409).json({
        message: "Já existe um usuário com este e-mail ou CPF.",
      });
    }

    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      logContext(
        "Bootstrap rejeitado: birthDate inválida",
        { birthDate },
        "warn",
      );
      return res.status(400).json({
        message: "birthDate inválida. Use um formato reconhecido (YYYY-MM-DD).",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newSuperAdmin = await User.create({
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
      adminCities: [],
      passwordHash: hashedPassword,
    });

    logContext(
      "Bootstrap concluído com sucesso",
      {
        newSuperAdminId: newSuperAdmin._id,
        email: maskEmail(newSuperAdmin.email),
        cpf: maskCpf(newSuperAdmin.cpf),
      },
      "info",
    );

    return res.status(201).json({
      message: "Super-admin criado com sucesso.",
      admin: {
        userId: newSuperAdmin._id,
        name: newSuperAdmin.name,
        email: newSuperAdmin.email,
        cpf: newSuperAdmin.cpf,
        phone: newSuperAdmin.phone,
        isSuperAdmin: true,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao executar bootstrap de super-admin:", error);
    return res
      .status(500)
      .json({ message: "Erro interno ao criar super-admin." });
  }
};

