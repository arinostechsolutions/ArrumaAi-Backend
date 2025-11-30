const LegalDocument = require("../models/LegalDocument");

/**
 * 📄 Controller para Documentos Legais
 * Gerencia Termos de Uso e Política de Privacidade
 */

/**
 * GET /api/legal/:type
 * Obter documento legal por tipo (terms ou privacy)
 * Rota pública - usada pelo mobile
 */
exports.getDocument = async (req, res) => {
  try {
    const { type } = req.params;

    if (!["terms", "privacy"].includes(type)) {
      return res.status(400).json({
        message: "Tipo inválido. Use 'terms' ou 'privacy'.",
      });
    }

    const document = await LegalDocument.findOne({ type, isActive: true });

    if (!document) {
      // Retorna documento padrão se não existir no banco
      const defaultContent = getDefaultContent(type);
      return res.status(200).json({
        type,
        title: defaultContent.title,
        content: defaultContent.content,
        version: "1.0",
        lastUpdatedAt: new Date(),
        isDefault: true,
      });
    }

    return res.status(200).json({
      type: document.type,
      title: document.title,
      content: document.content,
      version: document.version,
      lastUpdatedAt: document.lastUpdatedAt,
      isDefault: false,
    });
  } catch (error) {
    console.error("❌ [LegalDocument] Erro ao buscar documento:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * GET /api/legal
 * Listar todos os documentos legais
 * Rota protegida - usada pelo dashboard admin
 */
exports.getAllDocuments = async (req, res) => {
  try {
    const documents = await LegalDocument.find()
      .populate("lastUpdatedBy", "name email")
      .sort({ type: 1 });

    // Se não existirem documentos, retorna os padrões
    const types = ["terms", "privacy"];
    const result = types.map((type) => {
      const doc = documents.find((d) => d.type === type);
      if (doc) {
        return {
          _id: doc._id,
          type: doc.type,
          title: doc.title,
          content: doc.content,
          version: doc.version,
          lastUpdatedAt: doc.lastUpdatedAt,
          lastUpdatedBy: doc.lastUpdatedBy,
          isActive: doc.isActive,
          isDefault: false,
        };
      }
      const defaultContent = getDefaultContent(type);
      return {
        type,
        title: defaultContent.title,
        content: defaultContent.content,
        version: "1.0",
        lastUpdatedAt: null,
        lastUpdatedBy: null,
        isActive: true,
        isDefault: true,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [LegalDocument] Erro ao listar documentos:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * PUT /api/legal/:type
 * Criar ou atualizar documento legal
 * Rota protegida - usada pelo dashboard admin
 */
exports.upsertDocument = async (req, res) => {
  try {
    const { type } = req.params;
    const { title, content, version } = req.body;
    const adminId = req.user?.userId || req.admin?._id;

    if (!["terms", "privacy"].includes(type)) {
      return res.status(400).json({
        message: "Tipo inválido. Use 'terms' ou 'privacy'.",
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        message: "Título e conteúdo são obrigatórios.",
      });
    }

    const document = await LegalDocument.findOneAndUpdate(
      { type },
      {
        type,
        title,
        content,
        version: version || "1.0",
        lastUpdatedAt: new Date(),
        lastUpdatedBy: adminId,
        isActive: true,
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`✅ [LegalDocument] Documento '${type}' atualizado por admin ${adminId}`);

    return res.status(200).json({
      message: "Documento atualizado com sucesso!",
      document: {
        type: document.type,
        title: document.title,
        content: document.content,
        version: document.version,
        lastUpdatedAt: document.lastUpdatedAt,
      },
    });
  } catch (error) {
    console.error("❌ [LegalDocument] Erro ao atualizar documento:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Retorna conteúdo padrão para documentos legais
 */
function getDefaultContent(type) {
  if (type === "terms") {
    return {
      title: "Termos de Uso",
      content: `# Termos de Uso do ResolveAi

## 1. Aceitação dos Termos

Ao acessar e usar o aplicativo ResolveAi, você concorda em cumprir e estar vinculado a estes Termos de Uso.

## 2. Descrição do Serviço

O ResolveAi é uma plataforma que permite aos cidadãos reportar problemas urbanos e sugestões de melhorias para a administração municipal.

## 3. Cadastro e Conta

Para utilizar o aplicativo, você deve fornecer informações verdadeiras e manter seus dados atualizados.

## 4. Uso Adequado

Você concorda em usar o aplicativo apenas para fins legítimos e de acordo com as leis aplicáveis.

## 5. Conteúdo do Usuário

Você é responsável pelo conteúdo que publica, incluindo fotos e descrições de problemas.

## 6. Privacidade

O uso de suas informações pessoais está sujeito à nossa Política de Privacidade.

## 7. Modificações

Reservamo-nos o direito de modificar estes termos a qualquer momento.

## 8. Contato

Para dúvidas sobre estes termos, entre em contato conosco.

---

*Última atualização: ${new Date().toLocaleDateString("pt-BR")}*`,
    };
  }

  return {
    title: "Política de Privacidade (LGPD)",
    content: `# Política de Privacidade - LGPD

## 1. Introdução

Esta Política de Privacidade descreve como o ResolveAi coleta, usa e protege suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).

## 2. Dados Coletados

Coletamos os seguintes dados pessoais:
- Nome completo
- CPF
- E-mail
- Telefone
- Data de nascimento
- Endereço (bairro, rua, número)
- Localização geográfica (para relatórios)
- Fotos anexadas aos relatórios

## 3. Finalidade do Tratamento

Seus dados são utilizados para:
- Identificação e autenticação no aplicativo
- Processamento de relatórios e solicitações
- Comunicação sobre o andamento das demandas
- Melhoria dos serviços públicos municipais

## 4. Base Legal

O tratamento de dados é realizado com base no seu consentimento expresso e para execução de políticas públicas.

## 5. Compartilhamento de Dados

Seus dados podem ser compartilhados com:
- Secretarias municipais responsáveis
- Órgãos públicos competentes

## 6. Seus Direitos

Você tem direito a:
- Acessar seus dados pessoais
- Corrigir dados incompletos ou inexatos
- Solicitar a exclusão de seus dados
- Revogar o consentimento

## 7. Segurança

Implementamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado.

## 8. Retenção de Dados

Seus dados são mantidos enquanto sua conta estiver ativa ou conforme necessário para cumprir obrigações legais.

## 9. Contato do Encarregado (DPO)

Para exercer seus direitos ou esclarecer dúvidas, entre em contato conosco.

---

*Última atualização: ${new Date().toLocaleDateString("pt-BR")}*`,
  };
}

module.exports = exports;

