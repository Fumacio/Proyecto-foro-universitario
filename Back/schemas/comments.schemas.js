const { z } = require('zod');
const { id } = require('./common');

const listCommentsQuery = z.object({
  page: z.coerce.number({ error: 'page inválido' }).int('page inválido').min(1, 'page mínimo 1').optional(),
  limit: z.coerce
    .number({ error: 'limit inválido' })
    .int('limit inválido')
    .min(1, 'limit mínimo 1')
    .max(200, 'limit máximo 200')
    .optional()
});

const createCommentSchema = z.object({
  content: z
    .string({ error: 'El contenido es obligatorio' })
    .trim()
    .min(1, 'El contenido es obligatorio')
    .max(10000, 'El contenido no puede superar 10000 caracteres'),
  parent_id: id.nullable().optional()
});

const updateCommentSchema = z.object({
  content: z
    .string({ error: 'El contenido es obligatorio' })
    .trim()
    .min(1, 'El contenido es obligatorio')
    .max(10000, 'El contenido no puede superar 10000 caracteres')
});

module.exports = { listCommentsQuery, createCommentSchema, updateCommentSchema };
