const pool = require('../db/connection');
const { sendError } = require('../utils/response.utils');

const getAll = async (req, res) => {
  try {
    // Una sola consulta (antes era una por categoría padre)
    const [rows] = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) AS post_count
       FROM categories c ORDER BY c.name`
    );

    const roots = rows.filter(c => c.parent_id === null);
    for (const root of roots) {
      root.subcategories = rows
        .filter(c => c.parent_id === root.id)
        .map(({ id, name, description, post_count }) => ({ id, name, description, post_count }));
      root.subcategory_count = root.subcategories.length;
    }

    res.json(roots);
  } catch (err) {
    sendError(res, err, 'Error al obtener categorías');
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, parent.name AS parent_name
       FROM categories c LEFT JOIN categories parent ON c.parent_id = parent.id
       WHERE c.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const category = rows[0];
    const [children] = await pool.query(
      'SELECT id, name, description FROM categories WHERE parent_id = ? ORDER BY name',
      [category.id]
    );
    category.subcategories = children;

    res.json(category);
  } catch (err) {
    sendError(res, err, 'Error al obtener categoría');
  }
};

/**
 * Las categorías tienen dos niveles (departamento → materia).
 * Devuelve un mensaje de error si parent_id no sirve como padre, o null si está todo bien.
 */
async function validateParent(parentId, categoryId = null) {
  if (!parentId) return null;
  if (parentId === categoryId) return 'Una categoría no puede ser su propia categoría padre';

  const [parent] = await pool.query('SELECT id, parent_id FROM categories WHERE id = ?', [parentId]);
  if (parent.length === 0) return 'La categoría padre no existe';
  if (parent[0].parent_id !== null) return 'La categoría padre tiene que ser una categoría principal';

  if (categoryId) {
    const [children] = await pool.query('SELECT COUNT(*) AS total FROM categories WHERE parent_id = ?', [categoryId]);
    if (children[0].total > 0) return 'Una categoría con subcategorías no puede pasar a ser subcategoría';
  }
  return null;
}

const create = async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;

    const parentError = await validateParent(parent_id);
    if (parentError) {
      return res.status(400).json({ error: parentError });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)',
      [name, description || null, parent_id || null]
    );

    res.status(201).json({ id: result.insertId, name, description: description || null, parent_id: parent_id || null });
  } catch (err) {
    sendError(res, err, 'Error al crear categoría');
  }
};

const update = async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;
    const fields = [];
    const values = [];

    if (parent_id !== undefined) {
      const parentError = await validateParent(parent_id, req.params.id);
      if (parentError) {
        return res.status(400).json({ error: parentError });
      }
    }

    if (name) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (parent_id !== undefined) { fields.push('parent_id = ?'); values.push(parent_id); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(req.params.id);
    const [result] = await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ message: 'Categoría actualizada' });
  } catch (err) {
    sendError(res, err, 'Error al actualizar categoría');
  }
};

const remove = async (req, res) => {
  try {
    // posts.category_id tiene ON DELETE CASCADE: borrar una categoría con posts los borraría todos
    const [[posts]] = await pool.query('SELECT COUNT(*) AS total FROM posts WHERE category_id = ?', [req.params.id]);
    if (posts.total > 0) {
      return res.status(409).json({
        error: `La categoría tiene ${posts.total} post(s). Movelos o borralos antes de eliminarla.`
      });
    }

    const [[children]] = await pool.query('SELECT COUNT(*) AS total FROM categories WHERE parent_id = ?', [req.params.id]);
    if (children.total > 0) {
      return res.status(409).json({ error: 'La categoría tiene subcategorías. Eliminalas primero.' });
    }

    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    sendError(res, err, 'Error al eliminar categoría');
  }
};

module.exports = { getAll, getById, create, update, remove };
