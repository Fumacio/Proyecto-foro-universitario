const pool = require('../db/connection');

const getByPost = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query(
      `SELECT cm.*, u.username,
        (SELECT COALESCE(SUM(v.value), 0) FROM votes v WHERE v.comment_id = cm.id) AS vote_count
      FROM comments cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.post_id = ?
      ORDER BY cm.created_at ASC
      LIMIT ? OFFSET ?`,
      [req.params.postId, limitNum, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM comments WHERE post_id = ?',
      [req.params.postId]
    );
    const total = countResult[0].total;

    const nested = buildTree(rows, null);
    res.json({
      data: nested,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
};

function buildTree(items, parentId) {
  return items
    .filter(item => item.parent_id === parentId)
    .map(item => ({
      ...item,
      replies: buildTree(items, item.id)
    }));
}

const create = async (req, res) => {
  try {
    const { content, parent_id } = req.body;
    const { postId } = req.params;

    if (!content) {
      return res.status(400).json({ error: 'El contenido es obligatorio' });
    }

    const [post] = await pool.query('SELECT id FROM posts WHERE id = ?', [postId]);
    if (post.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const [result] = await pool.query(
      'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [postId, req.user.id, content, parent_id || null]
    );

    res.status(201).json({ id: result.insertId, post_id: Number(postId), content, parent_id });
  } catch {
    res.status(500).json({ error: 'Error al crear comentario' });
  }
};

const update = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tenés permiso para editar este comentario' });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'El contenido es obligatorio' });
    }

    await pool.query('UPDATE comments SET content = ? WHERE id = ?', [content, req.params.id]);
    res.json({ message: 'Comentario actualizado' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar comentario' });
  }
};

const remove = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tenés permiso para eliminar este comentario' });
    }

    await pool.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Comentario eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
};

module.exports = { getByPost, create, update, remove };
