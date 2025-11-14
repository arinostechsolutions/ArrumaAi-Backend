const express = require("express");
const { registerMayor } = require("../controllers/mayorController");

const router = express.Router();

// Rota pública para cadastro do prefeito
router.post("/register", registerMayor);

module.exports = router;

