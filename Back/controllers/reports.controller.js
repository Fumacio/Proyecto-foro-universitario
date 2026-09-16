const pool = require('../db/connection');
const { sendError } = require('../utils/response.utils');

const createReport = async (req, res) => {
  try {
    const { post_id, comment_id, reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'La razón del reporte es obligatoria' });
    }

    if (!post_id && !comment_id) {
      return res.status(400).json({ error: 'Debe especificar un post o comentario' });
    }

    if (post_id && comment_id) {
      return res.status(400).json({ error: 'Solo puede reportar un post o un comentario, no ambos' });
    }

    const validReasons = ['spam', 'abuso', 'contenido_inapropiado', 'off_topic', 'otro'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Razón inválida' });
    }

    if (post_id) {
      const [post] = await pool.query('SELECT id FROM posts WHERE id = ?', [post_id]);
      if (post.length === 0) {
        return res.status(404).json({ error: 'Post no encontrado' });
      }
    }

    if (comment_id) {
      const [comment] = await pool.query('SELECT id FROM comments WHERE id = ?', [comment_id]);
      if (comment.length === 0) {
        return res.status(404).json({ error: 'Comentario no encontrado' });
      }
    }

    const [existing] = await pool.query(
      `SELECT id FROM reports
       WHERE reporter_id = ? AND status = 'pending'
       AND (
         (post_id IS NOT NULL AND post_id = ?) OR
         (comment_id IS NOT NULL AND comment_id = ?)
       )`,
      [req.user.id, post_id || 0, comment_id || 0]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya reportaste este contenido y está pendiente de revisión' });
    }

    const [result] = await pool.query(
      'INSERT INTO reports (reporter_id, post_id, comment_id, reason, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, post_id || null, comment_id || null, reason, description || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Reporte enviado correctamente' });
  } catch (err) {
    sendError(res, err, 'Error al crear reporte');
  }
};

const getReports = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const [reports] = await pool.query(
      `SELECT r.*,
        u.username AS reporter_username,
        p.title AS post_title, p.user_id AS post_user_id,
        c.content AS comment_content, c.user_id AS comment_user_id,
        ru.username AS resolved_by_username
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      LEFT JOIN posts p ON r.post_id = p.id
      LEFT JOIN comments c ON r.comment_id = c.id
      LEFT JOIN users ru ON r.resolved_by = ru.id
      WHERE r.status = ?
      ORDER BY r.created_at DESC`,
      [status]
    );

    res.json(reports);
  } catch (err) {
    sendError(res, err, 'Error al obtener reportes');
  }
};

const getReportCounts = async (req, res) => {
  try {
    const [[pending]] = await pool.query("SELECT COUNT(*) AS total FROM reports WHERE status = 'pending'");
    const [[resolved]] = await pool.query("SELECT COUNT(*) AS total FROM reports WHERE status = 'resolved'");
    const [[dismissed]] = await pool.query("SELECT COUNT(*) AS total FROM reports WHERE status = 'dismissed'");
    res.json({ pending: pending.total, resolved: resolved.total, dismissed: dismissed.total });
  } catch (err) {
    sendError(res, err, 'Error al obtener conteo de reportes');
  }
};

const resolveReport = async (req, res) => {
  try {
    const { action } = req.body;
    const { id } = req.params;

    if (!['resolved', 'dismissed'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Use "resolved" o "dismissed"' });
    }

    const [report] = await pool.query('SELECT id, status FROM reports WHERE id = ?', [id]);
    if (report.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    if (report[0].status !== 'pending') {
      return res.status(400).json({ error: 'El reporte ya fue procesado' });
    }

    await pool.query(
      'UPDATE reports SET status = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ?',
      [action, req.user.id, id]
    );

    res.json({ message: `Reporte marcado como ${action}` });
  } catch (err) {
    sendError(res, err, 'Error al resolver reporte');
  }
};

module.exports = { createReport, getReports, getReportCounts, resolveReport };
