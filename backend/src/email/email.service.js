const nodemailer = require('nodemailer');

function criarTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function scoreLabel(s) {
  if (s >= 80) return 'Seguro';
  if (s >= 60) return 'Bom';
  if (s >= 40) return 'Atenção';
  if (s >= 20) return 'Em risco';
  return 'Crítico';
}

function scoreColor(s) {
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#34D399';
  if (s >= 40) return '#F59E0B';
  if (s >= 20) return '#F97316';
  return '#EF4444';
}

async function enviarNotificacaoAnalise(userEmail, userName, repo, analysis) {
  const transporter = criarTransporter();
  if (!transporter) return;

  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const cor = scoreColor(analysis.score);

  const html = `
<div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #0B0F19; padding: 24px 28px;">
    <span style="color: #F1F5F9; font-size: 17px; font-weight: 700;">🛡️ CodeSentinel</span>
  </div>
  <div style="padding: 28px;">
    <p style="font-size: 15px; color: #0F172A; margin: 0 0 8px;">Olá, ${userName}</p>
    <p style="font-size: 14px; color: #64748B; margin: 0 0 24px;">Nova análise concluída para <strong>${repo.fullName}</strong></p>

    <div style="background: #F8FAFC; border-radius: 10px; padding: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px;">
      <span style="font-size: 42px; font-weight: 800; color: ${cor};">${analysis.score}</span>
      <div>
        <div style="font-weight: 600; color: #0F172A;">${scoreLabel(analysis.score)}</div>
        <div style="font-size: 13px; color: #64748B;">${analysis.totalFindings} problema(s) encontrado(s)</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px; text-align: center; background: #FEF2F2; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 800; color: #EF4444;">${analysis.criticalCount}</div>
          <div style="font-size: 11px; color: #94A3B8;">Crítica</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 8px; text-align: center; background: #FFF7ED; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 800; color: #F97316;">${analysis.highCount}</div>
          <div style="font-size: 11px; color: #94A3B8;">Alta</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 8px; text-align: center; background: #FFFBEB; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 800; color: #F59E0B;">${analysis.mediumCount}</div>
          <div style="font-size: 11px; color: #94A3B8;">Média</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 8px; text-align: center; background: #F0FDF4; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 800; color: #10B981;">${analysis.lowCount}</div>
          <div style="font-size: 11px; color: #94A3B8;">Baixa</div>
        </td>
      </tr>
    </table>

    <a href="${appUrl}/analyses/${analysis.id}" style="display: block; background: #6366F1; color: white; text-align: center; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
      Ver relatório completo →
    </a>
  </div>
  <div style="padding: 16px 28px; background: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center;">
    CodeSentinel · <a href="${appUrl}" style="color: #6366F1;">acessar plataforma</a>
  </div>
</div>`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'CodeSentinel <noreply@codesentinel.dev>',
      to: userEmail,
      subject: `[CodeSentinel] ${repo.name} — score ${analysis.score}/100`,
      html,
    });
    console.log(`e-mail enviado: ${userEmail}`);
  } catch (err) {
    console.error('falha ao enviar e-mail:', err.message);
  }
}

module.exports = { enviarNotificacaoAnalise };
