function errorHandler(err, req, res, _next) {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
