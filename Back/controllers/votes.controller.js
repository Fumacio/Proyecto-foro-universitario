const pool = require('../db/connection');

const votePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    if (!value || ![1, -1].includes(value)) {
      return res.status(400).json({ error: 'El valor debe ser 1 o -1' });
    }

    const [post] = await pool.query('SELECT id FROM posts WHERE id = ?', [id]);
    if (post.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const [existing] = await pool.query(
      'SELECT id, value FROM votes WHERE post_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (existing.length > 0) {
      if (existing[0].value === value) {
        await pool.query('DELETE FROM votes WHERE id = ?', [existing[0].id]);
        return res.json({ message: 'Voto eliminado', vote_count: await getPostVoteCount(id) });
      }
      await pool.query('UPDATE votes SET value = ? WHERE id = ?', [value, existing[0].id]);
    } else {
      await pool.query(
        'INSERT INTO votes (user_id, post_id, value) VALUES (?, ?, ?)',
        [req.user.id, id, value]
      );
    }

    res.json({ message: 'Voto registrado', vote_count: await getPostVoteCount(id) });
  } catch {
    res.status(500).json({ error: 'Error al votar' });
  }
};

const voteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    if (!value || ![1, -1].includes(value)) {
      return res.status(400).json({ error: 'El valor debe ser 1 o -1' });
    }

    const [comment] = await pool.query('SELECT id FROM comments WHERE id = ?', [id]);
    if (comment.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    const [existing] = await pool.query(
      'SELECT id, value FROM votes WHERE comment_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (existing.length > 0) {
      if (existing[0].value === value) {
        await pool.query('DELETE FROM votes WHERE id = ?', [existing[0].id]);
        return res.json({ message: 'Voto eliminado', vote_count: await getCommentVoteCount(id) });
      }
      await pool.query('UPDATE votes SET value = ? WHERE id = ?', [value, existing[0].id]);
    } else {
      await pool.query(
        'INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)',
        [req.user.id, id, value]
      );
    }

    res.json({ message: 'Voto registrado', vote_count: await getCommentVoteCount(id) });
  } catch {
    res.status(500).json({ error: 'Error al votar' });
  }
};

async function getPostVoteCount(postId) {
  const [rows] = await pool.query(
    'SELECT COALESCE(SUM(value), 0) AS total FROM votes WHERE post_id = ?',
    [postId]
  );
  return rows[0].total;
}

async function getCommentVoteCount(commentId) {
  const [rows] = await pool.query(
    'SELECT COALESCE(SUM(value), 0) AS total FROM votes WHERE comment_id = ?',
    [commentId]
  );
  return rows[0].total;
}

module.exports = { votePost, voteComment };
