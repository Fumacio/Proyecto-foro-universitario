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

module.exports = { saveTags, getTagsByPostIds };
