const pool = require('../db/connection');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.commission, u.career, u.gender, u.email, u.avatar_url, u.bio, r.name AS role, u.created_at FROM users u JOIN roles r ON u.role_id = r.id'
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.username, u.email, u.avatar_url, r.name AS role, u.first_name, u.last_name, u.age, u.commission, u.career, u.gender, u.bio, u.created_at FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const isOwn = req.user && req.user.id === user.id;
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isOwn && !isAdmin) {
      delete user.email;
    }

    res.json(user);
  } catch {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

const update = async (req, res) => {
  try {
    const { username, email, role_id } = req.body;
    const fields = [];
    const values = [];

    if (username) { fields.push('username = ?'); values.push(username); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (role_id) { fields.push('role_id = ?'); values.push(role_id); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Usuario actualizado' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);

    res.json({ avatar_url: avatarUrl });
  } catch {
    res.status(500).json({ error: 'Error al subir avatar' });
  }
};

const getStats = async (req, res) => {
  try {
    const userId = req.params.id;

    const [[postsRow]] = await pool.query('SELECT COUNT(*) AS total FROM posts WHERE user_id = ?', [userId]);
    const [[commentsRow]] = await pool.query('SELECT COUNT(*) AS total FROM comments WHERE user_id = ?', [userId]);
    const [[karmaRow]] = await pool.query(
      `SELECT COALESCE(SUM(v.value), 0) AS total FROM votes v
       LEFT JOIN posts p ON v.post_id = p.id
       LEFT JOIN comments c ON v.comment_id = c.id
       WHERE p.user_id = ? OR c.user_id = ?`,
      [userId, userId]
    );

    res.json({
      posts: postsRow.total,
      comments: commentsRow.total,
      karma: Number(karmaRow.total)
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

module.exports = { getAll, getById, update, remove, uploadAvatar, getStats };
