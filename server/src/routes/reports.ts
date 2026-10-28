import { Router } from 'express';
import { z } from 'zod';
import { deleteAttachmentsWhere, postAttachmentsWhere, removeStoredFiles } from '../lib/attachments.js';
import { HttpError, notFound } from '../lib/errors.js';
import { notify } from '../lib/notify.js';
import { refreshCommentCount } from '../lib/posts.js';
import { prisma } from '../lib/prisma.js';
import { reportInclude, toReport } from '../lib/serializers.js';
import type { ReportReason } from '../lib/types.js';
import { idSchema, pageSchema, limitSchema, paginate, parse, parseId } from '../lib/validate.js';
import { authUser, requireMod, requireWriter } from '../middleware/auth.js';
import { actionLimiter } from '../middleware/rateLimit.js';

const router = Router();

const REASONS = ['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OFF_TOPIC', 'OTHER'] as const;
const REASON_LABEL: Record<ReportReason, string> = {
  SPAM: 'spam',
  HARASSMENT: 'acoso',
  INAPPROPRIATE: 'contenido inapropiado',
  OFF_TOPIC: 'fuera de tema',
  OTHER: 'incumplir las reglas',
};

const createSchema = z
  .object({
    postId: idSchema.optional(),
    commentId: idSchema.optional(),
    reason: z.enum(REASONS, { error: 'Elegí un motivo' }),
    details: z
      .union([z.string().trim().max(500, 'Los detalles pueden tener hasta 500 caracteres'), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((d) => (d.postId === undefined) !== (d.commentId === undefined), {
    message: 'Indicá qué querés reportar: un post o un comentario',
    path: ['postId'],
  });

router.post('/', requireWriter, actionLimiter, async (req, res) => {
  const user = authUser(req);
  const data = parse(createSchema, req.body);
  if (data.postId !== undefined) {
    const exists = await prisma.post.findUnique({ where: { id: data.postId }, select: { id: true } });
    if (!exists) throw notFound('El post no existe o fue eliminado');
  } else if (data.commentId !== undefined) {
    const exists = await prisma.comment.findUnique({ where: { id: data.commentId }, select: { isDeleted: true } });
    if (!exists || exists.isDeleted) throw notFound('El comentario no existe o fue eliminado');
  }
  const target = data.postId !== undefined ? { postId: data.postId } : { commentId: data.commentId! };
  // Un reporte pendiente por usuario y contenido.
  const duplicate = await prisma.report.findFirst({ where: { reporterId: user.id, status: 'PENDING', ...target }, select: { id: true } });
  if (!duplicate) {
    await prisma.report.create({ data: { reporterId: user.id, reason: data.reason, details: data.details, ...target } });
  }
  res.status(201).json({ ok: true });
});

router.get('/', requireMod, async (req, res) => {
  const { status, page, limit } = parse(
    z.object({
      status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).default('PENDING'),
      page: pageSchema,
      limit: limitSchema(),
    }),
    req.query,
  );
  const where = { status };
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: status === 'PENDING' ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ resolvedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: reportInclude,
    }),
    prisma.report.count({ where }),
  ]);
  res.json(paginate(rows.map(toReport), page, limit, total));
});

router.patch('/:id', requireMod, requireWriter, async (req, res) => {
  const mod = authUser(req);
  const id = parseId(req.params.id, 'Ese reporte no existe');
  const { status, deleteContent } = parse(
    z.object({
      status: z.enum(['RESOLVED', 'DISMISSED'], { error: 'El estado tiene que ser RESOLVED o DISMISSED' }),
      deleteContent: z.boolean().optional().default(false),
    }),
    req.body,
  );
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      post: { select: { id: true, title: true, authorId: true } },
      comment: { select: { id: true, postId: true, authorId: true, isDeleted: true, post: { select: { title: true, acceptedCommentId: true } } } },
    },
  });
  if (!report) throw notFound('Ese reporte no existe');
  if (deleteContent && status !== 'RESOLVED') {
    throw new HttpError(400, 'VALIDATION', 'Para borrar el contenido el reporte tiene que quedar resuelto', { deleteContent: 'Solo con RESOLVED' });
  }

  const now = new Date();
  const reason = REASON_LABEL[report.reason];
  let removedFor: { userId: number; message: string; postId: number | null } | null = null;
  const files: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.report.update({ where: { id }, data: { status, resolvedById: mod.id, resolvedAt: now } });
    if (!deleteContent) return;
    if (report.post) {
      // Todos los reportes pendientes del mismo post (y sus comentarios) quedan resueltos.
      await tx.report.updateMany({
        where: { status: 'PENDING', OR: [{ postId: report.post.id }, { comment: { postId: report.post.id } }] },
        data: { status: 'RESOLVED', resolvedById: mod.id, resolvedAt: now },
      });
      files.push(...(await deleteAttachmentsWhere(tx, postAttachmentsWhere(report.post.id))));
      await tx.post.delete({ where: { id: report.post.id } });
      if (report.post.authorId) {
        removedFor = {
          userId: report.post.authorId,
          postId: null,
          message: `Tu post «${report.post.title}» fue eliminado por moderación (motivo: ${reason}).`,
        };
      }
    } else if (report.comment && !report.comment.isDeleted) {
      const c = report.comment;
      await tx.report.updateMany({
        where: { status: 'PENDING', commentId: c.id },
        data: { status: 'RESOLVED', resolvedById: mod.id, resolvedAt: now },
      });
      await tx.comment.update({ where: { id: c.id }, data: { isDeleted: true } });
      files.push(...(await deleteAttachmentsWhere(tx, { commentId: c.id })));
      if (c.post.acceptedCommentId === c.id) await tx.post.update({ where: { id: c.postId }, data: { acceptedCommentId: null } });
      await refreshCommentCount(tx, c.postId);
      if (c.authorId) {
        removedFor = {
          userId: c.authorId,
          postId: c.postId,
          message: `Tu comentario en «${c.post.title}» fue eliminado por moderación (motivo: ${reason}).`,
        };
      }
    }
  });

  await removeStoredFiles(files);
  const removal = removedFor as { userId: number; message: string; postId: number | null } | null;
  // Las notificaciones de moderación no exponen qué moderador actuó (actor null).
  if (removal && removal.userId !== mod.id) {
    await notify({ userId: removal.userId, type: 'MOD', postId: removal.postId, message: removal.message });
  }
  const updated = await prisma.report.findUniqueOrThrow({ where: { id }, include: reportInclude });
  res.json({ report: toReport(updated) });
});

export default router;
