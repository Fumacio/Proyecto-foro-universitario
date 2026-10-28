import fsp from 'node:fs/promises';
import type { User } from '@prisma/client';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { removeStoredFiles } from '../lib/attachments.js';
import { forbidden, HttpError, notFound } from '../lib/errors.js';
import {
  attachmentUpload,
  contentDisposition,
  contentMatches,
  dailyQuotaBytes,
  extensionOf,
  fileTypeFor,
  MB,
  notAllowedError,
  sanitizeFilename,
  storedFilePath,
} from '../lib/files.js';
import { prisma } from '../lib/prisma.js';
import { toAttachment, type AttachmentRow } from '../lib/serializers.js';
import { parseId } from '../lib/validate.js';
import { authUser, isMod, requireAuth, requireWriter } from '../middleware/auth.js';
import { actionLimiter } from '../middleware/rateLimit.js';

const router = Router();
const NOT_FOUND = 'Ese archivo no existe o fue eliminado';
const DAY_MS = 24 * 60 * 60 * 1000;

async function usedQuota(userId: number): Promise<number> {
  const agg = await prisma.attachment.aggregate({
    where: { uploaderId: userId, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
    _sum: { size: true },
  });
  return agg._sum.size ?? 0;
}

const quotaError = () =>
  new HttpError(429, 'RATE_LIMIT', `Llegaste al límite de ${Math.round(dailyQuotaBytes() / MB)} MB de archivos por día. Probá de nuevo mañana.`);

/** Corta antes de recibir el archivo si la cuota del día ya está agotada. */
const quotaGuard: RequestHandler = async (req, _res, next) => {
  if ((await usedQuota(authUser(req).id)) >= dailyQuotaBytes()) throw quotaError();
  next();
};

// POST /attachments  (multipart, campo `file`)
router.post('/', requireWriter, actionLimiter, quotaGuard, attachmentUpload, async (req, res) => {
  const user = authUser(req);
  const file = req.file;
  if (!file) throw new HttpError(400, 'VALIDATION', 'Elegí un archivo para subir', { file: 'Elegí un archivo para subir' });
  try {
    const filename = sanitizeFilename(file.originalname);
    const type = fileTypeFor(filename);
    if (!type) throw notAllowedError();
    if (file.size === 0) throw new HttpError(400, 'VALIDATION', 'El archivo está vacío', { file: 'El archivo está vacío' });
    if (!(await contentMatches(file.path, type))) {
      const msg = `El contenido del archivo no corresponde a un .${extensionOf(filename)} válido`;
      throw new HttpError(400, 'VALIDATION', msg, { file: msg });
    }
    if ((await usedQuota(user.id)) + file.size > dailyQuotaBytes()) throw quotaError();
    const attachment = await prisma.attachment.create({
      data: {
        uploaderId: user.id,
        filename,
        storedName: file.filename,
        mimeType: type.mime,
        size: file.size,
        kind: type.kind,
      },
    });
    res.status(201).json({ attachment: toAttachment(attachment) });
  } catch (err) {
    await fsp.unlink(file.path).catch(() => undefined);
    throw err;
  }
});

// DELETE /attachments/:id  (quien lo subió o 🛡)
router.delete('/:id', requireAuth, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, NOT_FOUND);
  const attachment = await prisma.attachment.findUnique({ where: { id }, select: { uploaderId: true, storedName: true } });
  if (!attachment) throw notFound(NOT_FOUND);
  if (attachment.uploaderId !== user.id && !isMod(user)) throw forbidden('Solo quien subió el archivo puede borrarlo');
  await prisma.attachment.delete({ where: { id } });
  await removeStoredFiles([attachment.storedName]);
  res.status(204).end();
});

/** Reglas de acceso: DMs solo participantes (403); sueltos/borradores solo quien lo subió; el resto es público. */
async function accessibleAttachment(req: Request): Promise<AttachmentRow> {
  const id = parseId(req.params.id, NOT_FOUND);
  const user: User | undefined = req.user;
  const a = await prisma.attachment.findUnique({
    where: { id },
    include: { message: { select: { conversationId: true } }, comment: { select: { isDeleted: true } } },
  });
  if (!a) throw notFound(NOT_FOUND);
  if (a.message) {
    const participant = user
      ? await prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId: a.message.conversationId, userId: user.id } },
          select: { userId: true },
        })
      : null;
    if (!participant) throw forbidden('Solo los participantes de la conversación pueden ver este archivo');
  } else if (a.comment?.isDeleted) {
    throw notFound(NOT_FOUND);
  } else if (a.postId === null && a.commentId === null) {
    if (!user || a.uploaderId !== user.id) throw notFound(NOT_FOUND);
  }
  const { message: _m, comment: _c, ...row } = a;
  return row;
}

const SANDBOX = 'sandbox';
// El visor de PDF del navegador es un plugin: con `sandbox` Chrome no lo muestra. El PDF ya se verificó
// por magic bytes y va con nosniff, así que para verlo inline usamos una CSP restrictiva sin sandbox.
const PDF_INLINE_CSP = "default-src 'none'; object-src 'self'; img-src 'self' data: blob:; style-src 'unsafe-inline'; frame-ancestors 'self'";

async function sendStoredFile(res: Response, a: AttachmentRow, disposition: 'attachment' | 'inline'): Promise<void> {
  const file = storedFilePath(a.storedName);
  if (!file) throw notFound(NOT_FOUND);
  const contentType = a.kind === 'TEXT' ? 'text/plain; charset=utf-8' : a.mimeType.startsWith('text/') ? `${a.mimeType}; charset=utf-8` : a.mimeType;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDisposition(disposition, a.filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', disposition === 'inline' && a.kind === 'PDF' ? PDF_INLINE_CSP : SANDBOX);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  try {
    await new Promise<void>((resolve, reject) => {
      res.sendFile(file, { cacheControl: false, dotfiles: 'allow', lastModified: true, etag: true }, (err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (res.headersSent || code === 'ECONNABORTED' || code === 'ECANCELED') return;
    for (const h of ['Content-Type', 'Content-Disposition', 'Content-Security-Policy', 'Cache-Control']) res.removeHeader(h);
    if (code === 'ENOENT' || (err as { status?: number }).status === 404) throw notFound(NOT_FOUND);
    throw err;
  }
}

// GET /attachments/:id/download  (suma downloadCount)
router.get('/:id/download', async (req, res) => {
  const a = await accessibleAttachment(req);
  const range = req.headers.range;
  if (req.method === 'GET' && (!range || /^bytes=0-/.test(range))) {
    await prisma.attachment.updateMany({ where: { id: a.id }, data: { downloadCount: { increment: 1 } } });
  }
  await sendStoredFile(res, a, 'attachment');
});

// GET /attachments/:id/view  (solo IMAGE y PDF, inline)
router.get('/:id/view', async (req, res) => {
  const a = await accessibleAttachment(req);
  if (a.kind !== 'IMAGE' && a.kind !== 'PDF') throw notFound('Este tipo de archivo no tiene vista previa');
  await sendStoredFile(res, a, 'inline');
});

export default router;
