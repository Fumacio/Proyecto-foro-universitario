const { z } = require('zod');
const { id } = require('./common');

const banUserSchema = z
  .object({
    user_id: id,
    reason: z
      .string({ error: 'La razón del ban es obligatoria' })
      .trim()
      .min(1, 'La razón del ban es obligatoria')
      .max(500, 'La razón no puede superar 500 caracteres'),
    type: z.enum(['temporary', 'permanent'], { error: 'Tipo de ban inválido (temporary | permanent)' }).optional(),
    duration_hours: z
      .coerce
      .number({ error: 'duration_hours debe ser un número' })
      .int('duration_hours debe ser entero')
      .positive('duration_hours debe ser mayor a 0')
      .max(8760, 'duration_hours máximo 8760 (1 año)')
      .optional()
  })
  .superRefine((data, ctx) => {
    const type = data.type || 'temporary';
    if (type === 'temporary' && data.duration_hours === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_hours'],
        message: 'Los bans temporales requieren duration_hours'
      });
    }
  });

const unbanUserSchema = z.object({ user_id: id });

module.exports = { banUserSchema, unbanUserSchema };
