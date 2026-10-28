import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { FILES_DIR, removeStoredFiles } from './files.js';
import { prisma } from './prisma.js';
import { idSchema } from './validate.js';

type Tx = Prisma.TransactionClient;

export const MAX_ATTACHMENTS = { post: 10, comment: 5, message: 5, draft: 10 } as const;

/** `attachmentIds` opcional, sin repetidos, con máximo. */
export const attachmentIdsSchema = (max: number) =>
  z
    .array(idSchema, { error: 'Los adjuntos tienen que ser una lista de ids' })
    .max(max, `Podés adjuntar hasta ${max} archivos`)
    .transform((ids) => [...new Set(ids)]);

export type AttachmentTarget = { postId: number } | { commentId: number } | { messageId: number } | { draftId: number };

/** Sin dueño: no está en ningún post, comentario, mensaje ni borrador. */
export const LOOSE: Prisma.AttachmentWhereInput = { postId: null, commentId: null, messageId: null, draftId: null };

const UNLINKED = { postId: null, commentId: null, messageId: null, draftId: null };

/**
 * Asocia `ids` al destino dentro de la transacción. Cada id tiene que ser un adjunto suelto del usuario
 * o ya pertenecer a ese mismo destino (o a `alsoAllow`, p. ej. el borrador que se publica); si no → 400.
 * Con `replace`, los adjuntos que tenía el destino y no vienen en la lista se borran.
 * Devuelve los archivos a borrar del disco (después del commit, con `removeStoredFiles`).
 */
export async function linkAttachments(
  tx: Tx,
  opts: { ids: number[]; userId: number; target: AttachmentTarget; replace?: boolean; alsoAllow?: Prisma.AttachmentWhereInput },
): Promise<string[]> {
  const ids = [...new Set(opts.ids)];
  if (ids.length > 0) {
    const allowed: Prisma.AttachmentWhereInput[] = [{ uploaderId: opts.userId, ...LOOSE }, opts.target];
    if (opts.alsoAllow) allowed.push(opts.alsoAllow);
    // Un solo UPDATE condicional: si otro request se lo llevó antes, el conteo no coincide y se revierte todo.
    const { count } = await tx.attachment.updateMany({
      where: { id: { in: ids }, OR: allowed },
      data: { ...UNLINKED, ...opts.target },
    });
    if (count !== ids.length) {
      throw new HttpError(400, 'VALIDATION', 'Algún archivo adjunto no existe, no es tuyo o ya está en uso', {
        attachmentIds: 'Adjunto inválido',
      });
    }
  }
  if (!opts.replace) return [];
  return deleteAttachmentsWhere(tx, { ...opts.target, id: { notIn: ids } });
}

/** Borra filas de adjuntos y devuelve sus archivos (para borrarlos del disco después del commit). */
export async function deleteAttachmentsWhere(tx: Tx, where: Prisma.AttachmentWhereInput): Promise<string[]> {
  const rows = await tx.attachment.findMany({ where, select: { storedName: true } });
  if (rows.length === 0) return [];
  await tx.attachment.deleteMany({ where });
  return rows.map((r) => r.storedName);
}

/** Archivos que se van a ir por cascada (p. ej. antes de borrar un post o una comunidad). */
export async function storedNamesWhere(where: Prisma.AttachmentWhereInput, client: Tx = prisma): Promise<string[]> {
  const rows = await client.attachment.findMany({ where, select: { storedName: true } });
  return rows.map((r) => r.storedName);
}

/** Adjuntos de un post y de todos sus comentarios. */
export const postAttachmentsWhere = (postId: number): Prisma.AttachmentWhereInput => ({
  OR: [{ postId }, { comment: { postId } }],
});

export { removeStoredFiles };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Limpieza periódica: adjuntos sueltos con más de 24 h, archivos huérfanos en disco
 * (sin fila en la DB, con más de 1 h) y registros viejos del anti-spam de mails.
 */
export async function cleanupAttachments(now = Date.now()): Promise<{ loose: number; orphans: number }> {
  const stale = await prisma.attachment.findMany({
    where: { ...LOOSE, createdAt: { lt: new Date(now - DAY_MS) } },
    select: { id: true, storedName: true },
  });
  if (stale.length > 0) {
    await prisma.attachment.deleteMany({ where: { id: { in: stale.map((a) => a.id) } } });
    await removeStoredFiles(stale.map((a) => a.storedName));
  }

  let orphans = 0;
  const names = await fsp.readdir(FILES_DIR).catch(() => [] as string[]);
  if (names.length > 0) {
    const known = new Set(
      (await prisma.attachment.findMany({ where: { storedName: { in: names } }, select: { storedName: true } })).map((a) => a.storedName),
    );
    for (const name of names) {
      if (known.has(name)) continue;
      const file = path.join(FILES_DIR, name);
      const stat = await fsp.stat(file).catch(() => null);
      if (!stat?.isFile() || now - stat.mtimeMs < 60 * 60 * 1000) continue;
      await fsp.unlink(file).catch(() => undefined);
      orphans++;
    }
  }

  await prisma.emailLog.deleteMany({ where: { createdAt: { lt: new Date(now - 2 * DAY_MS) } } });
  return { loose: stale.length, orphans };
}

/** Arranca la tarea horaria (desde src/index.ts; no en tests). */
export function startAttachmentCleanup(intervalMs = 60 * 60 * 1000): () => void {
  const run = () => {
    cleanupAttachments()
      .then(({ loose, orphans }) => {
        if (loose + orphans > 0) console.info(`[cleanup] adjuntos sueltos borrados: ${loose}, archivos huérfanos: ${orphans}`);
      })
      .catch((err) => console.error('[cleanup] error limpiando adjuntos', err));
  };
  const first = setTimeout(run, 30_000);
  const timer = setInterval(run, intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
