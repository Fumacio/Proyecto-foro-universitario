/**
 * Plantilla de mail responsive (tablas + estilos inline, compatible con Gmail/Outlook/Apple Mail)
 * con su alternativa en texto plano. Marca: índigo/violeta.
 */
import { env } from '../env.js';

const BRAND = '#6d5dfc';
const BRAND_DARK = '#5446e0';
const BRAND_VIOLET = '#8b5cf6';
const INK = '#1f2033';
const MUTED = '#6b6f86';
const BG = '#f4f3ff';

export interface EmailContent {
  /** texto corto que muestran los clientes de mail junto al asunto */
  preheader: string;
  title: string;
  /** párrafos en texto plano; `**así**` va en negrita */
  paragraphs: string[];
  quote?: { text: string; caption?: string };
  button: { label: string; url: string };
  note?: string;
  /** link a la configuración de avisos en el footer (default true) */
  showPreferencesLink?: boolean;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const inline = (s: string) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};">$1</strong>`);
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');

export const preferencesUrl = () => `${env.FRONTEND_URL}/settings?tab=notifications`;

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const showPrefs = c.showPreferencesLink !== false;
  const prefs = preferencesUrl();
  const button = escapeHtml(c.button.url);

  const paragraphs = c.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK};">${inline(p)}</p>`)
    .join('\n');

  const quote = c.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;">
        <tr><td style="border-left:4px solid ${BRAND};background:#f6f5ff;border-radius:0 10px 10px 0;padding:14px 16px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#33364d;white-space:pre-line;">${escapeHtml(c.quote.text)}</p>
          ${c.quote.caption ? `<p style="margin:8px 0 0;font-size:13px;color:${MUTED};">${escapeHtml(c.quote.caption)}</p>` : ''}
        </td></tr>
      </table>`
    : '';

  const note = c.note ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">${inline(c.note)}</p>` : '';

  const footerPrefs = showPrefs
    ? `<p style="margin:0 0 6px;">¿Demasiados mails? <a href="${escapeHtml(prefs)}" style="color:${BRAND_DARK};text-decoration:underline;">Elegí qué avisos recibir</a>.</p>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.title)}</title>
<style>
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .btn a { display: block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td class="px" style="background:${BRAND};background-image:linear-gradient(135deg,${BRAND} 0%,${BRAND_VIOLET} 100%);border-radius:16px 16px 0 0;padding:22px 32px;">
        <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:rgba(255,255,255,0.18);font-size:18px;vertical-align:middle;">🎓</span>
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;vertical-align:middle;margin-left:10px;">Foro UTN</span>
      </td></tr>
      <tr><td class="px" style="background:#ffffff;padding:32px 32px 28px;border-radius:0 0 16px 16px;box-shadow:0 8px 30px rgba(52,40,160,0.08);">
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${escapeHtml(c.title)}</h1>
        ${paragraphs}
        ${quote}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:8px 0 4px;">
          <tr><td align="center" bgcolor="${BRAND}" style="border-radius:10px;background:${BRAND};">
            <a href="${button}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(c.button.label)}</a>
          </td></tr>
        </table>
        ${note}
        <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">Si el botón no funciona, copiá y pegá este link en el navegador:<br><a href="${button}" style="color:${BRAND_DARK};word-break:break-all;">${button}</a></p>
      </td></tr>
      <tr><td class="px" align="center" style="padding:20px 32px 0;font-size:12px;line-height:1.6;color:${MUTED};">
        ${footerPrefs}
        <p style="margin:0;">Foro UTN · la comunidad de estudiantes y docentes de la UTN FRT</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const lines = [
    'Foro UTN',
    '',
    c.title,
    '',
    ...c.paragraphs.map(plain).flatMap((p) => [p, '']),
    ...(c.quote ? [...c.quote.text.split('\n').map((l) => `> ${l}`), ...(c.quote.caption ? [`  — ${c.quote.caption}`] : []), ''] : []),
    `${c.button.label}: ${c.button.url}`,
    ...(c.note ? ['', plain(c.note)] : []),
    '',
    '—',
    ...(showPrefs ? [`Elegí qué avisos recibir: ${prefs}`] : []),
    'Foro UTN · UTN FRT',
  ];
  return { html, text: `${lines.join('\n')}\n` };
}
