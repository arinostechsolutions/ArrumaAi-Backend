/**
 * 🔔 Serviço de Notificações
 * Responsável por criar notificações broadcast para todos os usuários de uma cidade
 */

const Message = require("../models/Message");
const User = require("../models/User");
const City = require("../models/City");

/**
 * Cria notificações broadcast para todos os usuários de uma cidade
 * @param {Object} params
 * @param {string} params.cityId - ID da cidade (formato string, ex: "araruama")
 * @param {string} params.title - Título da notificação
 * @param {string} params.message - Mensagem da notificação
 * @param {string} params.type - Tipo: "evento", "interdicao", "obra_concluida", "noticia"
 * @param {Object} params.navigationData - Dados para navegação
 * @param {Object} params.sentBy - Quem enviou (adminId, adminName, secretaria)
 * @returns {Promise<{success: boolean, count: number}>}
 */
async function createBroadcastNotification({
  cityId,
  title,
  message,
  type,
  navigationData,
  sentBy,
}) {
  try {
    console.log(`🔔 [NotificationService] Criando notificação broadcast para cidade ${cityId}...`);

    // Buscar a cidade pelo ID string para obter o ObjectId
    const city = await City.findOne({ id: cityId });
    if (!city) {
      console.warn(`⚠️ [NotificationService] Cidade não encontrada: ${cityId}`);
      return { success: false, count: 0, error: "Cidade não encontrada" };
    }

    // Buscar todos os usuários da cidade
    const users = await User.find({ city: city._id }).select("_id").lean();

    if (users.length === 0) {
      console.log(`ℹ️ [NotificationService] Nenhum usuário encontrado na cidade ${cityId}`);
      return { success: true, count: 0 };
    }

    console.log(`📬 [NotificationService] Enviando para ${users.length} usuários...`);

    // Criar notificações em batch
    const notifications = users.map((user) => ({
      userId: user._id,
      cityId,
      title,
      message,
      type,
      navigationData,
      sentBy: sentBy || { adminName: "Sistema" },
      status: "não_lida",
      isBroadcast: true,
    }));

    // Inserir todas de uma vez
    await Message.insertMany(notifications);

    console.log(`✅ [NotificationService] ${notifications.length} notificações criadas com sucesso!`);

    return { success: true, count: notifications.length };
  } catch (error) {
    console.error("❌ [NotificationService] Erro ao criar notificações:", error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Cria notificação para um novo evento
 */
async function notifyNewEvent(event, adminInfo) {
  const title = `🎉 Novo Evento: ${event.title}`;
  const message = `${event.description?.substring(0, 100) || "Confira os detalhes do evento!"}...`;

  return createBroadcastNotification({
    cityId: event.cityId,
    title,
    message,
    type: "evento",
    navigationData: {
      targetType: "event",
      targetId: event._id?.toString(),
      coordinates: event.location?.coordinates
        ? { lat: event.location.coordinates[1], lng: event.location.coordinates[0] }
        : null,
    },
    sentBy: adminInfo,
  });
}

/**
 * Cria notificação para nova interdição
 */
async function notifyNewBlockade(blockade, adminInfo) {
  const typeLabels = {
    evento: "Evento",
    obra: "Obra",
    emergencia: "Emergência",
    manutencao: "Manutenção",
    outro: "Interdição",
  };

  const typeLabel = typeLabels[blockade.type] || "Interdição";
  const title = `🚧 ${typeLabel}: ${blockade.route?.streetName || "Via interditada"}`;
  const message = blockade.reason?.substring(0, 100) || "Confira os detalhes da interdição.";

  return createBroadcastNotification({
    cityId: blockade.cityId,
    title,
    message,
    type: "interdicao",
    navigationData: {
      targetType: "blockade",
      targetId: blockade._id?.toString(),
      coordinates: blockade.route?.coordinates?.[0]
        ? { lat: blockade.route.coordinates[0].lat, lng: blockade.route.coordinates[0].lng }
        : null,
    },
    sentBy: adminInfo,
  });
}

/**
 * Cria notificação para obra concluída (quando interdição é encerrada)
 */
async function notifyBlockadeCompleted(blockade, adminInfo) {
  const title = `✅ Obra Concluída: ${blockade.route?.streetName || "Via liberada"}`;
  const message = `A interdição em ${blockade.route?.streetName || "via"} foi encerrada. O trânsito está liberado.`;

  return createBroadcastNotification({
    cityId: blockade.cityId,
    title,
    message,
    type: "obra_concluida",
    navigationData: {
      targetType: "smart_city",
      targetId: blockade._id?.toString(),
      coordinates: blockade.route?.coordinates?.[0]
        ? { lat: blockade.route.coordinates[0].lat, lng: blockade.route.coordinates[0].lng }
        : null,
    },
    sentBy: adminInfo,
  });
}

/**
 * Cria notificação para nova notícia
 */
async function notifyNewNews(news, adminInfo) {
  const title = `📰 ${news.title}`;
  const message = news.summary?.substring(0, 100) || news.content?.substring(0, 100) || "Confira a nova notícia!";

  return createBroadcastNotification({
    cityId: news.cityId,
    title,
    message,
    type: "noticia",
    navigationData: {
      targetType: "news",
      targetId: news._id?.toString(),
    },
    sentBy: adminInfo,
  });
}

module.exports = {
  createBroadcastNotification,
  notifyNewEvent,
  notifyNewBlockade,
  notifyBlockadeCompleted,
  notifyNewNews,
};

