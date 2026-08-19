const pool = require('../db/connection');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT c.*, (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.id) AS subcategory_count FROM categories c WHERE c.parent_id IS NULL'
    );

    for (const cat of rows) {
      const [children] = await pool.query(
        'SELECT id, name, description FROM categories WHERE parent_id = ?',
        [cat.id]
      );
      cat.subcategories = children;
    }

    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const category = rows[0];
    const [children] = await pool.query(
      'SELECT id, name, description FROM categories WHERE parent_id = ?',
      [category.id]
    );
    category.subcategories = children;

    res.json(category);
  } catch {
    res.status(500).json({ error: 'Error al obtener categoría' });
  }
};

const create = async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)',
      [name, description || null, parent_id || null]
    );

    res.status(201).json({ id: result.insertId, name, description, parent_id });
  } catch {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

const update = async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;
    const fields = [];
    const values = [];

    if (name) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (parent_id !== undefined) { fields.push('parent_id = ?'); values.push(parent_id); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Categoría actualizada' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

const remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ message: 'Categoría eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
};

module.exports = { getAll, getById, create, update, remove };
