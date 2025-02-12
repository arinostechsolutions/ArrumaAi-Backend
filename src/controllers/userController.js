const User = require("../models/User");
const City = require("../models/City");
const { getUserInfoFromCPF } = require("../services/cpfService");

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
      return res.status(200).json({ exists: true, user });
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
    const { cityId, cpf, birthDate, phone } = req.body;

    if (!cityId || !cpf || !birthDate || !phone) {
      console.log("⚠️ Campos obrigatórios faltando:", {
        cityId,
        cpf,
        birthDate,
        phone,
      });
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
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

    console.log("🔍 Consultando Infosimples...");
    const userInfoResponse = await getUserInfoFromCPF(normalizedCpf, birthDate);

    if (
      !userInfoResponse ||
      !userInfoResponse.data ||
      userInfoResponse.data.length === 0
    ) {
      console.log("❌ Erro: Infosimples não retornou dados válidos.");
      return res
        .status(400)
        .json({ message: "Não foi possível obter os dados do usuário." });
    }

    const userInfo = userInfoResponse.data[0];
    console.log("✅ Dados obtidos da Receita Federal:", userInfo);

    const formattedBirthDate = new Date(
      birthDate.split("/").reverse().join("-")
    );
    const formattedPhone = phone.replace(/\D/g, "");

    const newUser = new User({
      name: userInfo.nome || "Nome não encontrado",
      cpf: normalizedCpf,
      birthDate: formattedBirthDate,
      phone: formattedPhone,
      city: city._id,
    });

    if (userInfo.cns && userInfo.cns.trim() !== "") {
      newUser.susCard = userInfo.cns;
    } else {
      newUser.susCard = null;
    }

    console.log("📝 Salvando usuário no banco de dados...");
    try {
      await newUser.save();
      console.log("🎉 Usuário salvo com sucesso!");
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

exports.deleteUser = async (req, res) => {
  try {
    const { cpf } = req.params;

    const user = await User.findOneAndDelete({ cpf });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    await City.updateOne({ users: user._id }, { $pull: { users: user._id } });

    return res.status(200).json({ message: "Usuário deletado com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao deletar usuário:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};
