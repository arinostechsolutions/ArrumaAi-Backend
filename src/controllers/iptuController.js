const City = require("../models/City");

// Atualizar configuração do IPTU
exports.updateIptuConfig = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { paymentURL, enabled } = req.body;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    // Verificar se cidade existe
    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Preparar objeto de atualização
    const updateData = {};
    if (paymentURL !== undefined) {
      updateData["modules.iptu.paymentURL"] = paymentURL;
    }
    if (typeof enabled === "boolean") {
      updateData["modules.iptu.enabled"] = enabled;
    }

    // Se módulo iptu não existir, inicializar
    if (!city.modules?.iptu) {
      updateData["modules.iptu"] = {
        enabled: typeof enabled === "boolean" ? enabled : false,
        paymentURL: paymentURL || "",
        queryMethods: [],
      };
    }

    const updatedCity = await City.findOneAndUpdate(
      { id: cityId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedCity) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    res.status(200).json({
      message: "Configuração de IPTU atualizada com sucesso!",
      iptu: {
        enabled: updatedCity.modules?.iptu?.enabled || false,
        paymentURL: updatedCity.modules?.iptu?.paymentURL || "",
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar configuração de IPTU:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar configuração do IPTU
exports.getIptuConfig = async (req, res) => {
  try {
    const { cityId } = req.params;

    if (!cityId) {
      return res.status(400).json({
        message: "ID da cidade é obrigatório.",
      });
    }

    const city = await City.findOne({ id: cityId });
    if (!city) {
      return res.status(404).json({ message: "Cidade não encontrada." });
    }

    // Retornar apenas se estiver habilitado (para mobile)
    const enabled = city.modules?.iptu?.enabled || false;
    const paymentURL = enabled ? (city.modules?.iptu?.paymentURL || "") : "";

    res.status(200).json({
      enabled,
      paymentURL,
    });
  } catch (error) {
    console.error("Erro ao buscar configuração de IPTU:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

