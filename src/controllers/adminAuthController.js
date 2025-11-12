const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signAdminToken } = require("../utils/jwt");

exports.login = async (req, res) => {
  try {
    const { email, cpf, password } = req.body;

    if ((!email && !cpf) || !password) {
      return res.status(400).json({
        message: "Informe e-mail ou CPF e a senha para acessar o dashboard.",
      });
    }

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null;

    const user = await User.findOne(
      email
        ? { email: email.toLowerCase(), isAdmin: true }
        : { cpf: normalizedCpf, isAdmin: true },
    ).select("+passwordHash");

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        message: "Credenciais inválidas.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({
        message: "Credenciais inválidas.",
      });
    }

    const allowedCities = Array.isArray(user.adminCities)
      ? user.adminCities.filter((city) => typeof city === "string" && city.trim() !== "")
      : [];

    const token = signAdminToken({
      userId: user._id.toString(),
      name: user.name,
      allowedCities,
      isSuperAdmin: allowedCities.length === 0,
    });

    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      token,
      admin: {
        userId: user._id,
        name: user.name,
        email: user.email || null,
        cpf: user.cpf,
        allowedCities,
        isSuperAdmin: allowedCities.length === 0,
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

    if (!bootstrapSecret) {
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
      return res.status(403).json({
        message: "Token de bootstrap inválido.",
      });
    }

    const existingSuperAdmin = await User.findOne({
      isAdmin: true,
      adminCities: { $size: 0 },
    });

    if (existingSuperAdmin) {
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
      return res.status(400).json({
        message: "Campos obrigatórios: name, email e password.",
      });
    }

    if (!phone || !birthDate || !address?.bairro) {
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


