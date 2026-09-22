const { z } = require('zod');
const { id } = require('./common');

const createReportSchema = z
  .object({
    post_id: id.nullable().optional(),
    comment_id: id.nullable().optional(),
    reason: z.enum(['spam', 'abuso', 'contenido_inapropiado', 'off_topic', 'otro'], {
      error: 'Razón inválida (spam | abuso | contenido_inapropiado | off_topic | otro)'
    }),
    description: z.string().trim().max(1000, 'La descripción no puede superar 1000 caracteres').optional()
  })
  .superRefine((data, ctx) => {
    const hasPost = data.post_id != null;
    const hasComment = data.comment_id != null;

    if (!hasPost && !hasComment) {
      ctx.addIssue({ code: 'custom', path: ['post_id'], message: 'Debe especificar un post o comentario' });
    }
    if (hasPost && hasComment) {
      ctx.addIssue({ code: 'custom', path: ['post_id'], message: 'Solo puede reportar un post o un comentario, no ambos' });
    }
  });

const listReportsQuery = z.object({
  status: z
    .enum(['pending', 'resolved', 'dismissed'], { error: 'Status inválido (pending | resolved | dismissed)' })
    .optional()
});

const resolveReportSchema = z.object({
  action: z.enum(['resolved', 'dismissed'], { error: 'Acción inválida (resolved | dismissed)' })
});

module.exports = { createReportSchema, listReportsQuery, resolveReportSchema };
