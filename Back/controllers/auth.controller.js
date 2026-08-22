const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'El email o username ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, 3)',
      [username, email, hash]
    );

    const token = jwt.sign(
      { id: result.insertId, username, role: 'alumno' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, user: { id: result.insertId, username, email, role: 'alumno' } });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const [rows] = await pool.query(
      'SELECT u.*, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar_url: user.avatar_url } });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username, email, current_password, new_password } = req.body;
    const userId = req.user.id;

    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = existing[0];

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Debés ingresar tu contraseña actual para cambiarla' });
      }
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
      }
    }

    const fields = [];
    const values = [];

    if (username && username !== user.username) {
      const [taken] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (taken.length > 0) {
        return res.status(409).json({ error: 'El username ya está en uso' });
      }
      fields.push('username = ?');
      values.push(username);
    }

    if (email && email !== user.email) {
      const [taken] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (taken.length > 0) {
        return res.status(409).json({ error: 'El email ya está en uso' });
      }
      fields.push('email = ?');
      values.push(email);
    }

    if (new_password) {
      const hash = await bcrypt.hash(new_password, 10);
      fields.push('password_hash = ?');
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const updated = await pool.query(
      'SELECT u.id, u.username, u.email, u.avatar_url, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [userId]
    );

    const updatedUser = updated[0];
    const token = jwt.sign(
      { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, role: updatedUser.role, avatar_url: updatedUser.avatar_url } });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

module.exports = { register, login, updateProfile };
