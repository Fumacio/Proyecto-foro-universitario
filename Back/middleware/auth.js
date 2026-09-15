const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

const auth = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el token_version del JWT coincida con el de la DB
    const [rows] = await pool.query(
      'SELECT token_version FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (rows[0].token_version !== decoded.token_version) {
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
