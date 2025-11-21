const express = require("express");
const {
  getExams,
  createExam,
  updateExam,
  deleteExam,
} = require("../controllers/healthExamController");

const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Todas as rotas requerem autenticação admin
router.get("/:cityId/:serviceId", isAdmin, getExams);
router.post("/:cityId/:serviceId", isAdmin, createExam);
router.put("/:cityId/:serviceId/:examId", isAdmin, updateExam);
router.delete("/:cityId/:serviceId/:examId", isAdmin, deleteExam);

module.exports = router;

