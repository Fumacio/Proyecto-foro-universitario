const pool = require('../db/connection');
const { buildTree } = require('../utils/tree.utils');
const { sendError } = require('../utils/response.utils');

const getByPost = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));

    // Se traen todos los comentarios del post y se pagina por hilo (comentario raíz).
    // Paginar las filas sueltas cortaba los árboles: una respuesta cuyo padre quedaba
    // en otra página desaparecía.
    const [rows] = await pool.query(
      `SELECT cm.*, u.username, u.avatar_url,
        (SELECT CAST(COALESCE(SUM(v.value), 0) AS SIGNED) FROM votes v WHERE v.comment_id = cm.id) AS vote_count,
        COALESCE((SELECT mv.value FROM votes mv WHERE mv.comment_id = cm.id AND mv.user_id = ?), 0) AS my_vote
      FROM comments cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.post_id = ?
      ORDER BY cm.created_at ASC, cm.id ASC`,
      [req.user ? req.user.id : 0, req.params.postId]
    );

    const threads = buildTree(rows, null);
    const offset = (pageNum - 1) * limitNum;

    res.json({
      data: threads.slice(offset, offset + limitNum),
      total: threads.length,
      total_comments: rows.length,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(threads.length / limitNum)
    });
  } catch (err) {
    sendError(res, err, 'Error al obtener comentarios');
  }
};

const create = async (req, res) => {
  try {
    const { content, parent_id } = req.body;
    const { postId } = req.params;

    const [post] = await pool.query('SELECT id FROM posts WHERE id = ?', [postId]);
    if (post.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    if (parent_id) {
      const [parent] = await pool.query('SELECT post_id FROM comments WHERE id = ?', [parent_id]);
      if (parent.length === 0 || parent[0].post_id !== postId) {
        return res.status(400).json({ error: 'El comentario al que respondés no existe en este post' });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [postId, req.user.id, content, parent_id || null]
    );

    res.status(201).json({ id: result.insertId, post_id: postId, content, parent_id: parent_id || null });
  } catch (err) {
    sendError(res, err, 'Error al crear comentario');
  }
};

const update = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT user_id FROM comments WHERE id = ? AND post_id = ?', [req.params.id, req.params.postId]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tenés permiso para editar este comentario' });
    }

    const { content } = req.body;
    await pool.query('UPDATE comments SET content = ? WHERE id = ?', [content, req.params.id]);
    res.json({ message: 'Comentario actualizado' });
  } catch (err) {
    sendError(res, err, 'Error al actualizar comentario');
  }
};

const remove = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT user_id FROM comments WHERE id = ? AND post_id = ?', [req.params.id, req.params.postId]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tenés permiso para eliminar este comentario' });
    }

    await pool.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Comentario eliminado' });
  } catch (err) {
    sendError(res, err, 'Error al eliminar comentario');
  }
};

module.exports = { getByPost, create, update, remove };
