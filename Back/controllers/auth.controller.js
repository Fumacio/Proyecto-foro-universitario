const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/connection');
const { sendMail } = require('../utils/mailer');
const { sendError } = require('../utils/response.utils');

const register = async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, age, commission, career, gender, bio } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos una mayúscula, un número y un símbolo' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'El username debe tener entre 3 y 30 caracteres' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'El username solo puede contener letras, números y guiones bajos' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'El formato del email no es válido' });
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
      'INSERT INTO users (username, email, password_hash, role_id, first_name, last_name, age, commission, career, gender, bio) VALUES (?, ?, ?, 3, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, hash, first_name || null, last_name || null, age || null, commission || null, career || null, gender || null, bio || null]
    );

    const token = jwt.sign(
      { id: result.insertId, username, role: 'alumno', token_version: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: result.insertId, username, email, role: 'alumno', first_name, last_name, age, commission, career, gender, bio: bio || null } });
  } catch (err) {
    sendError(res, err, 'Error al registrar usuario');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const [rows] = await pool.query(
      'SELECT u.id, u.username, u.email, u.password_hash, u.avatar_url, u.first_name, u.last_name, u.age, u.commission, u.career, u.gender, u.bio, u.token_version, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
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
      { id: user.id, username: user.username, role: user.role, token_version: user.token_version },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar_url: user.avatar_url, first_name: user.first_name, last_name: user.last_name, age: user.age, commission: user.commission, career: user.career, gender: user.gender, bio: user.bio } });
  } catch (err) {
    sendError(res, err, 'Error al iniciar sesión');
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username, email, current_password, new_password, first_name, last_name, age, commission, career, gender, bio } = req.body;
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

    const profileFields = ['first_name', 'last_name', 'age', 'commission', 'career', 'gender', 'bio'];
    for (const field of profileFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(req.body[field] || null);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const [updated] = await pool.query(
      'SELECT u.id, u.username, u.email, u.avatar_url, u.token_version, r.name AS role, u.first_name, u.last_name, u.age, u.commission, u.career, u.gender, u.bio FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [userId]
    );

    const updatedUser = updated[0];
    const token = jwt.sign(
      { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, token_version: updatedUser.token_version || 1 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, role: updatedUser.role, avatar_url: updatedUser.avatar_url, first_name: updatedUser.first_name, last_name: updatedUser.last_name, age: updatedUser.age, commission: updatedUser.commission, career: updatedUser.career, gender: updatedUser.gender, bio: updatedUser.bio } });
  } catch (err) {
    sendError(res, err, 'Error al actualizar perfil');
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es obligatorio' });
    }

    const [rows] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.json({ message: 'Si el email está registrado, recibirás un enlace de recuperación' });
    }

    const user = rows[0];

    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Recuperar contraseña - Foro UTN',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #F99B4A;">Recuperar contraseña</h2>
          <p>Recibiste este email porque solicitaste recuperar tu contraseña.</p>
          <p>Hacé click en el siguiente enlace para restablecer tu contraseña:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #F99B4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Restablecer contraseña</a>
          <p style="color: #707070; font-size: 13px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignorá este email.</p>
        </div>
      `
    });

    res.json({ message: 'Si el email está registrado, recibirás un enlace de recuperación' });
  } catch (err) {
    sendError(res, err, 'Error al procesar la solicitud');
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos una mayúscula, un número y un símbolo' });
    }

    const [rows] = await pool.query(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const reset = rows[0];

    if (reset.used) {
      return res.status(400).json({ error: 'El token ya fue utilizado' });
    }

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El token expiró. Solicitá uno nuevo' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, reset.user_id]);
    await pool.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    sendError(res, err, 'Error al restablecer la contraseña');
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es obligatoria para eliminar la cuenta' });
    }

    const [rows] = await pool.query('SELECT id, password_hash, role_id FROM users WHERE id = ?', [req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (rows[0].role_id === 1) {
      return res.status(403).json({ error: 'Los administradores no pueden eliminar su cuenta desde aquí' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña es incorrecta' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);

    res.json({ message: 'Cuenta eliminada correctamente' });
  } catch (err) {
    sendError(res, err, 'Error al eliminar la cuenta');
  }
};

const banStatus = async (req, res) => {
  try {
    const [bans] = await pool.query(
      `SELECT reason, type, expires_at FROM bans
       WHERE user_id = ? AND (
         type = 'permanent' OR
         (type = 'temporary' AND expires_at > NOW())
       ) ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (bans.length === 0) {
      return res.json({ banned: false });
    }

    const ban = bans[0];
    let hoursLeft = null;
    if (ban.type === 'temporary' && ban.expires_at) {
      const diff = new Date(ban.expires_at) - new Date();
      hoursLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
    }

    res.json({
      banned: true,
      reason: ban.reason,
      type: ban.type,
      expires_at: ban.expires_at,
      hours_left: hoursLeft
    });
  } catch (err) {
    sendError(res, err, 'Error al verificar estado de ban');
  }
};

module.exports = { register, login, updateProfile, forgotPassword, resetPassword, deleteAccount, banStatus };
