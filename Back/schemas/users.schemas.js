const { z } = require('zod');

const findByEmailQuery = z.object({
  email: z
    .string({ error: 'Email requerido' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Email inválido' }).max(100, 'El email no puede superar 100 caracteres'))
});

const updateUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'El username debe tener al menos 3 caracteres')
      .max(30, 'El username no puede superar 30 caracteres')
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'Email inválido' }).max(100))
      .optional(),
    role_id: z
      .coerce
      .number({ error: 'role_id debe ser un número' })
      .int('role_id debe ser entero')
      .min(1, 'role_id inválido')
      .max(3, 'role_id inválido')
      .optional()
  })
  .refine((data) => data.username !== undefined || data.email !== undefined || data.role_id !== undefined, {
    error: 'No hay campos para actualizar'
  });

module.exports = { findByEmailQuery, updateUserSchema };
