const nodemailer = require("nodemailer");

/**
 * 📧 Serviço de E-mail
 * Configurado para usar SMTP do Gmail
 */

// Configuração do transporter
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn("⚠️ [Email] SMTP_USER ou SMTP_PASS não configurados. E-mails não serão enviados.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true para 465, false para outras portas
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

/**
 * Enviar e-mail de recuperação de senha
 * @param {string} to - E-mail do destinatário
 * @param {string} code - Código de 6 dígitos
 * @param {string} userName - Nome do usuário
 * @returns {Promise<boolean>} - true se enviado com sucesso
 */
exports.sendPasswordResetEmail = async (to, code, userName = "Cidadão") => {
  const transport = getTransporter();
  
  if (!transport) {
    console.log(`📧 [Email] Simulando envio para ${to}: Código ${code}`);
    return false;
  }

  const fromName = process.env.SMTP_FROM_NAME || "ArrumaAí";
  const fromEmail = process.env.SMTP_USER;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperação de Senha</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                    🔐 Recuperação de Senha
                  </h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Olá, <strong>${userName}</strong>!
                  </p>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Você solicitou a recuperação de senha do seu cadastro no <strong>${fromName}</strong>. 
                    Use o código abaixo para redefinir sua senha:
                  </p>
                  
                  <!-- Code Box -->
                  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 25px; text-align: center; margin: 0 0 30px 0;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                      Seu código de verificação
                    </p>
                    <p style="color: #1d4ed8; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                      ${code}
                    </p>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                    ⏱️ Este código expira em <strong>15 minutos</strong>.
                  </p>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                    Se você não solicitou esta recuperação de senha, ignore este e-mail. 
                    Sua senha permanecerá a mesma.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} ${fromName}. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `
Olá, ${userName}!

Você solicitou a recuperação de senha do seu cadastro no ${fromName}.

Seu código de verificação: ${code}

Este código expira em 15 minutos.

Se você não solicitou esta recuperação de senha, ignore este e-mail.

--
${fromName}
  `.trim();

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `🔐 Código de Recuperação de Senha - ${fromName}`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`📧 [Email] Enviado com sucesso para ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [Email] Erro ao enviar para ${to}:`, error.message);
    return false;
  }
};

/**
 * Enviar e-mail de verificação para alteração de e-mail
 * @param {string} to - Novo e-mail do destinatário
 * @param {string} code - Código de 6 dígitos
 * @param {string} userName - Nome do usuário
 * @returns {Promise<boolean>} - true se enviado com sucesso
 */
exports.sendEmailVerificationCode = async (to, code, userName = "Cidadão") => {
  const transport = getTransporter();
  
  if (!transport) {
    console.log(`📧 [Email] Simulando envio de verificação para ${to}: Código ${code}`);
    return false;
  }

  const fromName = process.env.SMTP_FROM_NAME || "ArrumaAí";
  const fromEmail = process.env.SMTP_USER;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verificação de E-mail</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                    📧 Verificação de E-mail
                  </h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Olá, <strong>${userName}</strong>!
                  </p>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Você solicitou a alteração do seu e-mail no <strong>${fromName}</strong>. 
                    Use o código abaixo para confirmar que este e-mail pertence a você:
                  </p>
                  
                  <!-- Code Box -->
                  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 25px; text-align: center; margin: 0 0 30px 0;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                      Seu código de verificação
                    </p>
                    <p style="color: #059669; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                      ${code}
                    </p>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                    ⏱️ Este código expira em <strong>15 minutos</strong>.
                  </p>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                    Se você não solicitou esta alteração, ignore este e-mail. 
                    Seu e-mail permanecerá o mesmo.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} ${fromName}. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `
Olá, ${userName}!

Você solicitou a alteração do seu e-mail no ${fromName}.

Seu código de verificação: ${code}

Este código expira em 15 minutos.

Se você não solicitou esta alteração, ignore este e-mail.

--
${fromName}
  `.trim();

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `📧 Código de Verificação de E-mail - ${fromName}`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`📧 [Email] Verificação enviada com sucesso para ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [Email] Erro ao enviar verificação para ${to}:`, error.message);
    return false;
  }
};

/**
 * Verificar conexão SMTP
 * @returns {Promise<boolean>}
 */
exports.verifyConnection = async () => {
  const transport = getTransporter();
  
  if (!transport) {
    return false;
  }

  try {
    await transport.verify();
    console.log("✅ [Email] Conexão SMTP verificada com sucesso");
    return true;
  } catch (error) {
    console.error("❌ [Email] Erro na verificação SMTP:", error.message);
    return false;
  }
};

