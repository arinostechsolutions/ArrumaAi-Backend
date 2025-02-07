const express = require("express");
const {
  createAppointment,
  getAllAppointments,
  getAppointmentsByCity,
  updateAppointmentStatus,
  deleteAppointment,
} = require("../controllers/healthAppointmentController");

const { paginationMiddleware } = require("../middlewares/paginationMiddleware");
const { rateLimitMiddleware } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

// Criar um agendamento (consulta ou exame) - verifica se o módulo está ativo
router.post("/createAppointment", rateLimitMiddleware, createAppointment);

// Buscar todos os agendamentos (com paginação)
router.get("/getAllAppointments", paginationMiddleware, getAllAppointments);

// Buscar agendamentos de uma cidade específica (com paginação)
router.get(
  "/getAppointmentsByCity/:cityId",
  paginationMiddleware,
  getAppointmentsByCity
);

// Atualizar status de um agendamento (exemplo: confirmar ou cancelar)
router.put("/updateAppointmentStatus/:id", updateAppointmentStatus);

// Deletar um agendamento
router.delete("/deleteAppointment/:id", deleteAppointment);

module.exports = router;
