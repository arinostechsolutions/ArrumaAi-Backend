const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const City = require("../models/City");

/**
 * POST /api/mayor/register
 * Cadastro público do prefeito (rota pública)
 */
exports.registerMayor = async (req, res) => {
  try {
    const {
      name,
      email,
      cpf,
      phone,
      birthDate,
      address,
      password,
      cityId,
      verificationCode, // Código de verificação fornecido pelo super admin
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
        message: `Já existe um prefeito cadastrado para esta cidade.`,
      });
    }

    // TODO: Implementar validação de código de verificação se necessário
    // Por enquanto, permitimos cadastro direto (pode ser restringido depois)

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

    console.log(`✅ Prefeito "${newMayor.name}" cadastrado para a cidade ${cityId}`);

    return res.status(201).json({
      message: "Prefeito cadastrado com sucesso.",
      mayor: {
        userId: newMayor._id,
        name: newMayor.name,
        email: newMayor.email,
        cityId,
        isMayor: true,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao cadastrar prefeito:", error);
    return res.status(500).json({ message: "Erro interno ao cadastrar prefeito." });
  }
};






