const pool = require('../db/connection');

const banUser = async (req, res) => {
  try {
    const { user_id, reason, type = 'temporary', duration_hours } = req.body;

    if (!user_id || !reason) {
      return res.status(400).json({ error: 'user_id y reason son obligatorios' });
    }

    if (!['temporary', 'permanent'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de ban inválido' });
    }

    if (type === 'temporary' && !duration_hours) {
      return res.status(400).json({ error: 'Los bans temporales requieren duration_hours' });
    }

    const [user] = await pool.query('SELECT id, role_id FROM users WHERE id = ?', [user_id]);
    if (user.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user[0].role_id === 1) {
      return res.status(403).json({ error: 'No se puede banear a un administrador' });
    }

    const [existingBan] = await pool.query(
      `SELECT id FROM bans WHERE user_id = ? AND (
        type = 'permanent' OR (type = 'temporary' AND expires_at > NOW())
      )`,
      [user_id]
    );

    if (existingBan.length > 0) {
      return res.status(409).json({ error: 'El usuario ya está baneado' });
    }

    const expiresAt = type === 'temporary'
      ? new Date(Date.now() + duration_hours * 60 * 60 * 1000)
      : null;

    const [result] = await pool.query(
      'INSERT INTO bans (user_id, reason, type, expires_at, banned_by) VALUES (?, ?, ?, ?, ?)',
      [user_id, reason, type, expiresAt, req.user.id]
    );

    res.status(201).json({
      id: result.insertId,
      message: type === 'permanent'
        ? 'Usuario baneado permanentemente'
        : `Usuario baneado por ${duration_hours} horas`
    });
  } catch {
    res.status(500).json({ error: 'Error al banear usuario' });
  }
};

const unbanUser = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id es obligatorio' });
    }

    const [result] = await pool.query(
      `DELETE FROM bans WHERE user_id = ? AND (
        type = 'permanent' OR (type = 'temporary' AND expires_at > NOW())
      )`,
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'El usuario no está baneado' });
    }

    res.json({ message: 'Usuario desbaneado correctamente' });
  } catch {
    res.status(500).json({ error: 'Error al desbanear usuario' });
  }
};

const getBans = async (req, res) => {
  try {
    const [bans] = await pool.query(
      `SELECT b.*, u.username, bu.username AS banned_by_username
      FROM bans b
      JOIN users u ON b.user_id = u.id
      JOIN users bu ON b.banned_by = bu.id
      ORDER BY b.created_at DESC`
    );

    const active = bans.filter(b =>
      b.type === 'permanent' || new Date(b.expires_at) > new Date()
    );
    const expired = bans.filter(b =>
      b.type === 'temporary' && new Date(b.expires_at) <= new Date()
    );

    res.json({ active, expired });
  } catch {
    res.status(500).json({ error: 'Error al obtener bans' });
  }
};

const getBanStatus = async (req, res) => {
  try {
    const { user_id } = req.params;

    const [bans] = await pool.query(
      `SELECT id, reason, type, expires_at, created_at FROM bans
       WHERE user_id = ? AND (
         type = 'permanent' OR (type = 'temporary' AND expires_at > NOW())
       )`,
      [user_id]
    );

    res.json({ banned: bans.length > 0, ban: bans[0] || null });
  } catch {
    res.status(500).json({ error: 'Error al obtener estado de ban' });
  }
};

module.exports = { banUser, unbanUser, getBans, getBanStatus };
