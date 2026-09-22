/**
 * Helper de respuesta de error.
 * Loguea de forma segura (sin volcar el objeto err completo en producción)
 * y responde con el status indicado.
 */
const sendError = (res, err, message, status = 500) => {
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
