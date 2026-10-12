const pool = require('../db/connection');
const { sendError } = require('../utils/response.utils');

// column y table vienen de este archivo, nunca del request
const TARGETS = {
  post: { table: 'posts', column: 'post_id', notFound: 'Post no encontrado' },
  comment: { table: 'comments', column: 'comment_id', notFound: 'Comentario no encontrado' }
};

async function getVoteCount(column, targetId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(value), 0) AS total FROM votes WHERE ${column} = ?`,
    [targetId]
  );
  return Number(rows[0].total);
}

/**
 * Votar funciona como toggle: el mismo voto otra vez lo quita, el voto contrario lo da vuelta.
 * Devuelve también my_vote (1, -1 o 0) para que el front marque el botón.
 */
const vote = (type) => async (req, res) => {
  const { table, column, notFound } = TARGETS[type];

  try {
    const { id } = req.params;
    const { value } = req.body;

    const [target] = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);
    if (target.length === 0) {
      return res.status(404).json({ error: notFound });
    }

    const [existing] = await pool.query(
      `SELECT id, value FROM votes WHERE ${column} = ? AND user_id = ?`,
      [id, req.user.id]
    );

    let myVote = value;
    if (existing.length > 0) {
      if (existing[0].value === value) {
        await pool.query('DELETE FROM votes WHERE id = ?', [existing[0].id]);
        myVote = 0;
      } else {
        await pool.query('UPDATE votes SET value = ? WHERE id = ?', [value, existing[0].id]);
      }
    } else {
      // ON DUPLICATE KEY cubre el doble click (dos requests simultáneos del mismo usuario)
      await pool.query(
        `INSERT INTO votes (user_id, ${column}, value) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [req.user.id, id, value]
      );
    }

    res.json({
      message: myVote === 0 ? 'Voto eliminado' : 'Voto registrado',
      vote_count: await getVoteCount(column, id),
      my_vote: myVote
    });
  } catch (err) {
    sendError(res, err, 'Error al votar');
  }
};

module.exports = { votePost: vote('post'), voteComment: vote('comment') };
