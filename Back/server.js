require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const categoriesRoutes = require('./routes/categories.routes');
const postsRoutes = require('./routes/posts.routes');
const commentsRoutes = require('./routes/comments.routes');
const votesRoutes = require('./routes/votes.routes');
const tagsRoutes = require('./routes/tags.routes');
const adminRoutes = require('./routes/admin.routes');
const reportsRoutes = require('./routes/reports.routes');
const bansRoutes = require('./routes/bans.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'Front')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/posts/:postId/comments', commentsRoutes);
app.use('/api', votesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/bans', bansRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function migrate() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN bio TEXT AFTER avatar_url');
    console.log('Migracion: columna bio agregada exitosamente');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Migracion: columna bio ya existe');
    } else {
      console.log('Migracion:', err.message);
    }
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS bans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      reason TEXT NOT NULL,
      type ENUM('temporary', 'permanent') NOT NULL DEFAULT 'temporary',
      expires_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      banned_by INT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_bans (user_id),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      post_id INT,
      comment_id INT,
      reason ENUM('spam', 'abuso', 'contenido_inapropiado', 'off_topic', 'otro') NOT NULL,
      description TEXT,
      status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      resolved_by INT,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_status (status)
    ) ENGINE=InnoDB`
  ];

  for (const sql of tables) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.log('Migracion:', err.message);
      }
    }
  }
}

const PORT = process.env.PORT || 3000;

migrate().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});
