import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';
import { renderEmail } from './emailTemplates.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** link principal del mail (solo para el log de desarrollo) */
  link?: string;
}

/** En NODE_ENV=test los mails quedan acá en lugar de enviarse. */
export const testOutbox: MailMessage[] = [];

export type MailTransport = (message: MailMessage) => Promise<void>;

let override: MailTransport | null = null;

/** Reemplaza el envío (tests/espías). `null` vuelve al comportamiento normal. */
export function setMailTransport(transport: MailTransport | null): void {
  override = transport;
}

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
  if (override) {
    await override(message);
    return;
  }
  if (env.isTest) {
    testOutbox.push(message);
    return;
  }
  const t = getTransporter();
  if (!t) {
    console.info(`[mail] → ${message.to}: ${message.subject}${message.link ? ` (${message.link})` : ''}`);
    return;
  }
  const { link: _link, ...mail } = message;
  await t.sendMail({ from: env.SMTP.from, ...mail });
}

export function resetPasswordLink(token: string): string {
  return `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(to: string, username: string, token: string): Promise<void> {
  const link = resetPasswordLink(token);
  if (!env.SMTP.host && !env.isTest) {
    console.info(`[auth] Link para restablecer la contraseña de @${username}: ${link}`);
  }
  const { html, text } = renderEmail({
    preheader: 'Restablecé tu contraseña del Foro UTN (el link vence en 1 hora).',
    title: 'Restablecé tu contraseña',
    paragraphs: [
      `Hola @${username}:`,
      'Recibimos un pedido para restablecer tu contraseña del Foro UTN. El link vence en 1 hora.',
    ],
    button: { label: 'Restablecer contraseña', url: link },
    note: 'Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia.',
  });
  await sendMail({ to, subject: 'Restablecé tu contraseña — Foro UTN', text, html, link });
}
