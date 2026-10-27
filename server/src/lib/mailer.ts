import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** En NODE_ENV=test los mails quedan acá en lugar de enviarse. */
export const testOutbox: MailMessage[] = [];

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP.host) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP.host,
    port: env.SMTP.port,
    secure: env.SMTP.port === 465,
    auth: env.SMTP.user ? { user: env.SMTP.user, pass: env.SMTP.pass } : undefined,
  });
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (env.isTest) {
    testOutbox.push(message);
    return;
  }
  const t = getTransporter();
  if (!t) {
    console.info(`\n[mail] (sin SMTP configurado) Para: ${message.to}\n[mail] Asunto: ${message.subject}\n${message.text}\n`);
    return;
  }
  await t.sendMail({ from: env.SMTP.from, ...message });
}

export function resetPasswordLink(token: string): string {
  return `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(to: string, username: string, token: string): Promise<void> {
  const link = resetPasswordLink(token);
  if (!env.SMTP.host && !env.isTest) {
    console.info(`[auth] Link para restablecer la contraseña de @${username}: ${link}`);
  }
  await sendMail({
    to,
    subject: 'Restablecé tu contraseña — Foro UTN',
    text:
      `Hola @${username}:\n\nRecibimos un pedido para restablecer tu contraseña del Foro UTN.\n` +
      `Entrá a este link (vence en 1 hora):\n\n${link}\n\n` +
      'Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia.',
    html:
      `<p>Hola <b>@${escapeHtml(username)}</b>:</p>` +
      '<p>Recibimos un pedido para restablecer tu contraseña del Foro UTN.</p>' +
      `<p><a href="${escapeHtml(link)}">Restablecer contraseña</a> (vence en 1 hora)</p>` +
      '<p>Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia.</p>',
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
