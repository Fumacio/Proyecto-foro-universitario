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

module.exports = { idParam, userIdParam, id };
