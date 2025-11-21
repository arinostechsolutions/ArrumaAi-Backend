const express = require("express");
const {
  updateIptuConfig,
  getIptuConfig,
} = require("../controllers/iptuController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Rotas públicas (mobile)
router.get("/getIptuConfig/:cityId", getIptuConfig);

// Rotas administrativas (dashboard)
router.put("/updateIptuConfig/:cityId", isAdmin, updateIptuConfig);

module.exports = router;

