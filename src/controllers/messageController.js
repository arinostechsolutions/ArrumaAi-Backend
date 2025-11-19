const mongoose = require("mongoose");
const Message = require("../models/Message");
const Report = require("../models/Report");
const User = require("../models/User");

// Criar uma nova mensagem para o usuário relacionada a um report
exports.createMessage = async (req, res) => {
  try {
    const { reportId, title, message, type } = req.body;
    
    // Obter informações do admin que está enviando (do middleware adminMiddleware)
    const adminId = req.admin?.userId;
    const adminName = req.admin?.name || "Administrador";
    
    if (!adminId) {
      return res.status(401).json({ 
        message: "Acesso negado. Admin não identificado." 
      });
    }

    if (!reportId || !title || !message) {
      return res.status(400).json({ 
        message: "Campos obrigatórios: reportId, title e message." 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "ID do report inválido." });
    }

    // Buscar o report para obter o userId
    const report = await Report.findById(reportId);
    
    if (!report) {
      return res.status(404).json({ message: "Report não encontrado." });
    }

    // Verificar se o userId existe no report
    if (!report.user || !report.user.userId) {
      return res.status(400).json({ 
        message: "Report não possui usuário associado." 
      });
    }

    const userId = report.user.userId;

    // Verificar se o usuário existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Criar a mensagem
    const newMessage = new Message({
      userId,
      reportId,
      title,
      message,
      type: type || "feedback",
      sentBy: {
        adminId,
        adminName,
      },
      status: "não_lida",
    });

    await newMessage.save();

    // Popular dados do report e usuário para retornar
    await newMessage.populate([
      { path: "userId", select: "name cpf phone email" },
      { path: "reportId", select: "reportType address status" },
    ]);

    res.status(201).json({
      message: "Mensagem enviada com sucesso!",
      data: newMessage,
    });
  } catch (error) {
    console.error("Erro ao criar mensagem:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar todas as mensagens de um usuário
exports.getMessagesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const [messages, total] = await Promise.all([
      Message.find({ userId })
        .populate("reportId", "reportType address status")
        .populate("sentBy.adminId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ userId }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    res.status(200).json({
      total,
      page,
      limit,
      totalPages,
      hasMore,
      messages,
    });
  } catch (error) {
    console.error("Erro ao buscar mensagens do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar todas as mensagens relacionadas a um report
exports.getMessagesByReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "ID do report inválido." });
    }

    const messages = await Message.find({ reportId })
      .populate("userId", "name cpf phone")
      .populate("sentBy.adminId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      total: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Erro ao buscar mensagens do report:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Marcar mensagem como lida
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "ID da mensagem inválido." });
    }

    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        status: "lida",
        readAt: new Date(),
      },
      { new: true }
    )
      .populate("reportId", "reportType address status")
      .populate("sentBy.adminId", "name");

    if (!message) {
      return res.status(404).json({ message: "Mensagem não encontrada." });
    }

    res.status(200).json({
      message: "Mensagem marcada como lida.",
      data: message,
    });
  } catch (error) {
    console.error("Erro ao marcar mensagem como lida:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Buscar mensagens não lidas de um usuário (útil para notificações)
exports.getUnreadMessagesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const messages = await Message.find({ 
      userId, 
      status: "não_lida" 
    })
      .populate("reportId", "reportType address status")
      .populate("sentBy.adminId", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Retornar array diretamente para compatibilidade com o mobile
    res.status(200).json(messages);
  } catch (error) {
    console.error("Erro ao buscar mensagens não lidas:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// Deletar mensagem (apenas admin)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "ID da mensagem inválido." });
    }

    const message = await Message.findByIdAndDelete(messageId);

    if (!message) {
      return res.status(404).json({ message: "Mensagem não encontrada." });
    }

    res.status(200).json({ message: "Mensagem deletada com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar mensagem:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

