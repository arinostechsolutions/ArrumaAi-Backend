const express = require("express");
const {
  getSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
} = require("../controllers/healthSpecialtyController");

const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Todas as rotas requerem autenticação admin
router.get("/:cityId/:serviceId", isAdmin, getSpecialties);
router.post("/:cityId/:serviceId", isAdmin, createSpecialty);
router.put("/:cityId/:serviceId/:specialtyId", isAdmin, updateSpecialty);
router.delete("/:cityId/:serviceId/:specialtyId", isAdmin, deleteSpecialty);

module.exports = router;

