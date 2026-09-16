const pool = require('../db/connection');
const { sendError } = require('../utils/response.utils');

const checkBan = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const [bans] = await pool.query(
      `SELECT id, reason, type, expires_at FROM bans
       WHERE user_id = ? AND (
         type = 'permanent' OR
         (type = 'temporary' AND expires_at > NOW())
       )`,
      [req.user.id]
    );

    if (bans.length > 0) {
      const ban = bans[0];
      const msg = ban.type === 'permanent'
        ? `Tu cuenta está baneada permanentemente. Razón: ${ban.reason}`
        : `Tu cuenta está baneada temporalmente hasta el ${new Date(ban.expires_at).toLocaleDateString('es-AR')}. Razón: ${ban.reason}`;
      return res.status(403).json({ error: msg });
    }

    next();
  } catch (err) {
    sendError(res, err, 'Error al verificar estado de cuenta');
  }
};

module.exports = checkBan;
