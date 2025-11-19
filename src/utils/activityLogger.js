const ActivityLog = require("../models/ActivityLog");

/**
 * Registra uma ação no histórico de atividades
 * @param {Object} options - Opções para registro
 * @param {Object} options.admin - Dados do admin (req.admin)
 * @param {String} options.actionType - Tipo da ação
 * @param {String} options.description - Descrição da ação
 * @param {Object} options.details - Detalhes adicionais (opcional)
 * @param {String} options.entityType - Tipo da entidade (opcional)
 * @param {String|ObjectId} options.entityId - ID da entidade (opcional)
 * @param {String} options.cityId - ID da cidade (opcional)
 * @param {Object} options.req - Request object para extrair IP e User-Agent (opcional)
 */
async function logActivity({
  admin,
  actionType,
  description,
  details = {},
  entityType = null,
  entityId = null,
  cityId = null,
  req = null,
}) {
  try {
    if (!admin || !admin.userId) {
      console.warn("⚠️ Tentativa de log sem admin válido");
      return;
    }

    const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.get?.("user-agent") || req?.headers?.["user-agent"] || null;

    const logEntry = new ActivityLog({
      adminId: admin.userId,
      adminName: admin.name || "Admin Desconhecido",
      adminEmail: admin.email || null,
      adminCpf: admin.cpf || null,
      secretaria: admin.secretaria || null,
      isSuperAdmin: admin.isSuperAdmin || false,
      actionType,
      description,
      details,
      entityType,
      entityId,
      cityId,
      ipAddress,
      userAgent,
    });

    await logEntry.save();
    console.log(`📝 Log registrado: ${actionType} - ${description}`);
  } catch (error) {
    // Não queremos que erros de log quebrem a aplicação
    console.error("❌ Erro ao registrar log de atividade:", error);
  }
}

module.exports = { logActivity };



