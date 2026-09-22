const { AppError } = require('../utils/errors');

/**
 * Loguea el error de forma segura:
 * - En producción: solo message + status (sin stack ni objetos internos).
 * - En desarrollo: stack completo para depurar.
 */
function logError(err, req) {
  const isProd = process.env.NODE_ENV === 'production';
  const meta = `${req.method} ${req.originalUrl}`;

  if (isProd) {
    const status = err.status || 500;
    console.error(`[ERROR] ${status} ${meta} — ${err.message}`);
    if (!(err instanceof AppError) && err.stack) {
      // stack solo como primera línea, sin variables ni queries
      const firstLine = String(err.stack).split('\n')[0];
      console.error(`  ${firstLine}`);
    }
    return;
  }

  console.error(`[ERROR] ${meta}`, {
    status: err.status || 500,
    message: err.message,
    name: err.name,
    stack: err.stack,
    details: err.details
  });
}

function errorHandler(err, req, res, _next) {
  // Si ya se respondió, delegar a Express
  if (res.headersSent) {
    return _next(err);
  }

  logError(err, req);

  // Errores tipados de la app → su status y mensaje
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Errores conocidos de Express/body-parser
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cuerpo de la petición demasiado grande' });
  }

  // Cualquier otro error → 500 genérico (sin exponer detalles)
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
