const pool = require('../db/connection');
const { saveTags, tagsExist, getTagsByPostIds, escapeLike } = require('../utils/post.utils');
const { sendError } = require('../utils/response.utils');

const getAll = async (req, res) => {
  try {
    const { category_id, tag_id, q, sort = 'recent', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = 'SELECT COUNT(*) AS total FROM posts p JOIN categories c ON p.category_id = c.id';
    let query = `
      SELECT p.*, u.username, u.avatar_url, c.name AS category_name,
        (SELECT CAST(COALESCE(SUM(v.value), 0) AS SIGNED) FROM votes v WHERE v.post_id = p.id) AS vote_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count,
        (SELECT mv.value FROM votes mv WHERE mv.post_id = p.id AND mv.user_id = ?) AS my_vote
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN categories c ON p.category_id = c.id
    `;
    const viewerId = req.user ? req.user.id : 0;
    const params = [];
    const conditions = [];

    if (category_id) {
      // Una categoría padre muestra también los posts de sus subcategorías
      conditions.push('(p.category_id = ? OR c.parent_id = ?)');
      params.push(category_id, category_id);
    }

    if (tag_id) {
      conditions.push('p.id IN (SELECT post_id FROM post_tags WHERE tag_id = ?)');
      params.push(tag_id);
    }

    if (q) {
      conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
      const search = `%${escapeLike(q)}%`;
      params.push(search, search);
    }

    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      query += where;
      countQuery += where;
    }

    if (sort === 'votes') {
      query += ' ORDER BY vote_count DESC, p.created_at DESC';
    } else {
      query += ' ORDER BY p.created_at DESC';
    }
    query += ' LIMIT ? OFFSET ?';

    const [rows] = await pool.query(query, [viewerId, ...params, limitNum, offset]);
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const postIds = rows.map(p => p.id);
    const tagsMap = await getTagsByPostIds(postIds);
    const data = rows.map(p => ({ ...p, my_vote: p.my_vote || 0, tags: tagsMap[p.id] || [] }));

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    sendError(res, err, 'Error al obtener posts');
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.username, u.avatar_url, c.name AS category_name,
        (SELECT CAST(COALESCE(SUM(v.value), 0) AS SIGNED) FROM votes v WHERE v.post_id = p.id) AS vote_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count,
        (SELECT mv.value FROM votes mv WHERE mv.post_id = p.id AND mv.user_id = ?) AS my_vote
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?`,
      [req.user ? req.user.id : 0, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const tagsMap = await getTagsByPostIds([rows[0].id]);
    res.json({ ...rows[0], my_vote: rows[0].my_vote || 0, tags: tagsMap[rows[0].id] || [] });
  } catch (err) {
    sendError(res, err, 'Error al obtener post');
  }
};

const create = async (req, res) => {
  try {
    const { title, content, category_id, image_url, tag_ids } = req.body;

    const [category] = await pool.query('SELECT id FROM categories WHERE id = ?', [category_id]);
    if (category.length === 0) {
      return res.status(404).json({ error: 'La categoría no existe' });
    }

    if (!(await tagsExist(tag_ids))) {
      return res.status(400).json({ error: 'Alguno de los tags no existe' });
    }

    const [result] = await pool.query(
      'INSERT INTO posts (user_id, category_id, title, content, image_url) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, category_id, title, content, image_url || null]
    );

    await saveTags(result.insertId, tag_ids);

    res.status(201).json({ id: result.insertId, title, content, category_id, image_url: image_url || null });
  } catch (err) {
    sendError(res, err, 'Error al crear post');
  }
};

const update = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tenés permiso para editar este post' });
    }

    const { title, content, tag_ids } = req.body;
    const fields = [];
    const values = [];

    if (title) { fields.push('title = ?'); values.push(title); }
    if (content) { fields.push('content = ?'); values.push(content); }

    if (!(await tagsExist(tag_ids))) {
      return res.status(400).json({ error: 'Alguno de los tags no existe' });
    }

    if (fields.length > 0) {
      values.push(req.params.id);
      await pool.query(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (tag_ids !== undefined) {
      await pool.query('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
      await saveTags(req.params.id, tag_ids);
    }

    res.json({ message: 'Post actualizado' });
  } catch (err) {
    sendError(res, err, 'Error al actualizar post');
  }
};

const remove = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tenés permiso para eliminar este post' });
    }

    await pool.query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post eliminado' });
  } catch (err) {
    sendError(res, err, 'Error al eliminar post');
  }
};

const uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo' });
  }

  res.json({ image_url: `/uploads/posts/${req.file.filename}` });
};

module.exports = { getAll, getById, create, update, remove, uploadImage };
