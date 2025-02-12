const axios = require("axios");
require("dotenv").config();

const getUserInfoFromCPF = async (cpf, birthDate) => {
  try {
    const response = await axios.post(process.env.INFOSIMPLES_API_URL, {
      cpf,
      birthdate: birthDate,
      token: process.env.INFOSIMPLES_TOKEN,
    });

    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Erro ao consultar CPF na Infosimples:",
      error.response?.data || error.message
    );
    throw new Error("Erro ao buscar informações do usuário");
  }
};

module.exports = { getUserInfoFromCPF };
