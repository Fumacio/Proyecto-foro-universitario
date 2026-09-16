const pool = require('../db/connection');
const { sendError } = require('../utils/response.utils');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tags ORDER BY name');
    res.json(rows);
  } catch (err) {
    sendError(res, err, 'Error al obtener tags');
  }
};

const create = async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    if (name.length > 50) {
      return res.status(400).json({ error: 'El nombre del tag no puede superar los 50 caracteres' });
    }

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'El color debe ser un código hex válido (ej: #FF5733)' });
    }

    const [existing] = await pool.query('SELECT id FROM tags WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El tag ya existe' });
    }

    const [result] = await pool.query(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name, color || '#F99B4A']
    );

    res.status(201).json({ id: result.insertId, name, color: color || '#F99B4A' });
  } catch (err) {
    sendError(res, err, 'Error al crear tag');
  }
};

const remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tags WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tag no encontrado' });
    }

    res.json({ message: 'Tag eliminado' });
  } catch (err) {
    sendError(res, err, 'Error al eliminar tag');
  }
};

module.exports = { getAll, create, remove };
