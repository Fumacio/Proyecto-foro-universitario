const { z } = require('zod');
const { id } = require('./common');

const listPostsQuery = z.object({
  category_id: id.optional(),
  tag_id: id.optional(),
  q: z.string().trim().max(100, 'La búsqueda no puede superar 100 caracteres').optional(),
  sort: z.enum(['recent', 'votes'], { error: 'Orden inválido (recent | votes)' }).optional(),
  page: z.coerce.number({ error: 'page inválido' }).int('page inválido').min(1, 'page mínimo 1').optional(),
  limit: z.coerce
    .number({ error: 'limit inválido' })
    .int('limit inválido')
    .min(1, 'limit mínimo 1')
    .max(100, 'limit máximo 100')
    .optional()
});

const tagIds = z
  .array(id, { error: 'tag_ids debe ser un array de IDs' })
  .max(10, 'Máximo 10 tags por post')
  .optional();

const createPostSchema = z.object({
  title: z
    .string({ error: 'El título es obligatorio' })
    .trim()
    .min(1, 'El título es obligatorio')
    .max(200, 'El título no puede superar 200 caracteres'),
  content: z
    .string({ error: 'El contenido es obligatorio' })
    .trim()
    .min(1, 'El contenido es obligatorio')
    .max(20000, 'El contenido no puede superar 20000 caracteres'),
  category_id: id,
  image_url: z.string().trim().max(500, 'URL de imagen inválida').optional(),
  tag_ids: tagIds
});

const updatePostSchema = z
  .object({
    title: z.string().trim().min(1, 'El título no puede estar vacío').max(200).optional(),
    content: z.string().trim().min(1, 'El contenido no puede estar vacío').max(20000).optional(),
    tag_ids: z.array(id, { error: 'tag_ids debe ser un array de IDs' }).max(10, 'Máximo 10 tags por post').optional()
  })
  .refine((data) => data.title !== undefined || data.content !== undefined || data.tag_ids !== undefined, {
    error: 'No hay campos para actualizar'
  });

module.exports = { listPostsQuery, createPostSchema, updatePostSchema };
