const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

/**
 * Valida el token y trae al usuario de la DB.
 * Devuelve { user } si la sesión es válida o { error } con el mensaje para el 401.
 * Los errores de DB se propagan (no son culpa del token: no hay que desloguear a nadie).
 */
async function resolveUser(header) {
  if (!header || !header.startsWith('Bearer ')) {
    return { error: 'Token no proporcionado' };
  }

  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch (err) {
    return { error: err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido' };
  }

  // El rol y el username se leen de la DB (no del JWT): si un admin le cambia el rol
  // a alguien, el cambio aplica en el próximo request y no recién cuando vuelva a loguearse.
  const [rows] = await pool.query(
    `SELECT u.username, u.token_version, r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [decoded.id]
  );

  if (rows.length === 0) {
    return { error: 'Usuario no encontrado' };
  }

  if (rows[0].token_version !== decoded.token_version) {
    return { error: 'Sesión expirada, iniciá sesión nuevamente' };
  }

  return { user: { id: decoded.id, username: rows[0].username, role: rows[0].role, token_version: rows[0].token_version } };
}

const auth = async (req, res, next) => {
  try {
    const { user, error } = await resolveUser(req.headers.authorization);
    if (error) {
      return res.status(401).json({ error });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Para rutas públicas que muestran algo extra si hay sesión (ej. qué votó el usuario).
 * Nunca corta el request: sin token o con token inválido sigue como anónimo.
 */
auth.optional = async (req, res, next) => {
  try {
    const { user } = await resolveUser(req.headers.authorization);
    if (user) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = auth;
