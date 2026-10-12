/**
 * Helper de respuesta de error.
 * Loguea de forma segura (sin volcar el objeto err completo en producción)
 * y responde con el status indicado.
 *
 * Errores conocidos de MySQL se traducen a algo útil para el cliente en vez de un 500:
 * - ER_DUP_ENTRY (choque con un UNIQUE, ej. dos registros simultáneos con el mismo email) → 409
 * - ER_NO_REFERENCED_ROW_2 (FK a algo que no existe, ej. un tag borrado) → 400
 */
const sendError = (res, err, message, status = 500) => {
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }
  if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Alguno de los datos referenciados no existe' });
  }

  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    // Solo message, sin stack ni internals (evita fuga de queries/paths)
    console.error(`[ERROR] ${message}${err && err.message ? ` — ${err.message}` : ''}`);
  } else {
    console.error(message, err);
  }

  res.status(status).json({ error: message });
};

module.exports = { sendError };
