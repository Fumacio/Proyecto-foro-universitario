const pool = require('../db/connection');

const getDashboard = async (req, res) => {
  try {
    const [[usersRow]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [[postsRow]] = await pool.query('SELECT COUNT(*) AS total FROM posts');
    const [[commentsRow]] = await pool.query('SELECT COUNT(*) AS total FROM comments');
    const [[categoriesRow]] = await pool.query('SELECT COUNT(*) AS total FROM categories');

    const [recentUsers] = await pool.query(
      'SELECT u.id, u.username, u.email, r.name AS role, u.created_at FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC LIMIT 5'
    );
    const [recentPosts] = await pool.query(
      'SELECT p.id, p.title, u.username, p.created_at FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5'
    );

    res.json({
      counts: { users: usersRow.total, posts: postsRow.total, comments: commentsRow.total, categories: categoriesRow.total },
      recentUsers,
      recentPosts
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
};

module.exports = { getDashboard };
