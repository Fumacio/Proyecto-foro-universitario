function errorHandler(err, req, res, _next) {
  const errorId = Date.now().toString(36);
  if (process.env.NODE_ENV === 'production') {
    console.error(`[UNHANDLED ERROR] id=${errorId} message=${err.message}`);
  } else {
    console.error(`[UNHANDLED ERROR] id=${errorId}`, err);
  }
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
