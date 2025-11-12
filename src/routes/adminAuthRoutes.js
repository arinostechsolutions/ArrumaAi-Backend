const express = require("express");
const {
  login,
  bootstrapSuperAdmin,
} = require("../controllers/adminAuthController");

const router = express.Router();

router.post("/login", login);
router.post("/bootstrap", bootstrapSuperAdmin);

module.exports = router;


