const pool = require('../db/connection');

async function saveTags(postId, tagIds) {
  if (!tagIds || tagIds.length === 0) return;
  const values = tagIds.map(id => [postId, id]);
  await pool.query('INSERT INTO post_tags (post_id, tag_id) VALUES ?', [values]);
}

async function getTagsByPostIds(postIds) {
  if (postIds.length === 0) return {};
  const [rows] = await pool.query(
    `SELECT pt.post_id, t.id, t.name, t.color
     FROM post_tags pt
     JOIN tags t ON pt.tag_id = t.id
     WHERE pt.post_id IN (?)`,
    [postIds]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.post_id]) map[row.post_id] = [];
    map[row.post_id].push({ id: row.id, name: row.name, color: row.color });
  }
  return map;
}

const getAll = async (req, res) => {
  try {
    const { category_id, tag_id, q, sort = 'recent', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = 'SELECT COUNT(*) AS total FROM posts p';
    let query = `
      SELECT p.*, u.username, u.avatar_url, c.name AS category_name,
        (SELECT CAST(COALESCE(SUM(v.value), 0) AS SIGNED) FROM votes v WHERE v.post_id = p.id) AS vote_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN categories c ON p.category_id = c.id
    `;
    const params = [];
    const countParams = [];
    const conditions = [];

    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
      countParams.push(category_id);
    }

    if (tag_id) {
      conditions.push('p.id IN (SELECT post_id FROM post_tags WHERE tag_id = ?)');
      params.push(tag_id);
      countParams.push(tag_id);
    }

    if (q) {
      conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
      const search = `%${q}%`;
      params.push(search, search);
      countParams.push(search, search);
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
    params.push(limitNum, offset);

    const [rows] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    const postIds = rows.map(p => p.id);
    const tagsMap = await getTagsByPostIds(postIds);
    const data = rows.map(p => ({ ...p, tags: tagsMap[p.id] || [] }));

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener posts' });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.username, u.avatar_url, c.name AS category_name,
        (SELECT CAST(COALESCE(SUM(v.value), 0) AS SIGNED) FROM votes v WHERE v.post_id = p.id) AS vote_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const tagsMap = await getTagsByPostIds([rows[0].id]);
    res.json({ ...rows[0], tags: tagsMap[rows[0].id] || [] });
  } catch {
    res.status(500).json({ error: 'Error al obtener post' });
  }
};

const create = async (req, res) => {
  try {
    const { title, content, category_id, image_url, tag_ids } = req.body;

    if (!title || !content || !category_id) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (title, content, category_id)' });
    }

    const [result] = await pool.query(
      'INSERT INTO posts (user_id, category_id, title, content, image_url) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, category_id, title, content, image_url || null]
    );

    if (tag_ids && tag_ids.length > 0) {
      await saveTags(result.insertId, tag_ids);
    }

    res.status(201).json({ id: result.insertId, title, content, category_id, image_url: image_url || null });
  } catch {
    res.status(500).json({ error: 'Error al crear post' });
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

    if (fields.length === 0 && tag_ids === undefined) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    if (fields.length > 0) {
      values.push(req.params.id);
      await pool.query(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (tag_ids !== undefined) {
      await pool.query('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
      if (tag_ids.length > 0) {
        await saveTags(req.params.id, tag_ids);
      }
    }

    res.json({ message: 'Post actualizado' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar post' });
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
  } catch {
    res.status(500).json({ error: 'Error al eliminar post' });
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const imageUrl = `/uploads/posts/${req.file.filename}`;
    res.json({ image_url: imageUrl });
  } catch {
    res.status(500).json({ error: 'Error al subir imagen' });
  }
};

module.exports = { getAll, getById, create, update, remove, uploadImage };
