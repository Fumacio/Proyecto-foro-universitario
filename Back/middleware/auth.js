const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

// Cache con TTL corto para token_version (reduce queries a DB)
const tokenVersionCache = new Map();
const CACHE_TTL = 30000; // 30 segundos

const auth = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar cache primero
    const cached = tokenVersionCache.get(decoded.id);
    let dbVersion;

    if (cached && Date.now() - cached.time < CACHE_TTL) {
      dbVersion = cached.version;
    } else {
      const [rows] = await pool.query(
        'SELECT token_version FROM users WHERE id = ?',
        [decoded.id]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      dbVersion = rows[0].token_version;
      tokenVersionCache.set(decoded.id, { version: dbVersion, time: Date.now() });
    }

    if (dbVersion !== decoded.token_version) {
      tokenVersionCache.delete(decoded.id);
      return res.status(401).json({ error: 'Sesión expirada, iniciá sesión nuevamente' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = auth;
