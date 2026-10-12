const { z } = require('zod');

/** ID numérico positivo en params (:id) */
const idParam = z.object({
  id: z.coerce.number({ error: 'ID inválido' }).int('ID inválido').positive('ID inválido')
});

/** user_id en params (:user_id) */
const userIdParam = z.object({
  user_id: z.coerce.number({ error: 'user_id inválido' }).int('ID inválido').positive('ID inválido')
});

/** ID numérico positivo en body */
const id = z.coerce.number({ error: 'ID inválido' }).int('ID inválido').positive('ID inválido');

/** Rutas anidadas /posts/:postId/comments y /posts/:postId/comments/:id */
const postIdParam = z.object({ postId: id });
const postCommentParams = z.object({ postId: id, id });

/**
 * Texto opcional: acepta que falte, null o string vacío (los dos últimos se guardan como null).
 * El front manda `null` en los campos que el usuario deja vacíos.
 */
const optionalText = (max, label) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z
      .string({ error: `${label} debe ser texto` })
      .trim()
      .max(max, `${label} no puede superar ${max} caracteres`)
      .nullable()
      .optional()
  );

module.exports = { idParam, userIdParam, id, postIdParam, postCommentParams, optionalText };
