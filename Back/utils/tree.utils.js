function buildTree(items, parentId) {
  return items
    .filter(item => item.parent_id === parentId)
    .map(item => ({
      ...item,
      replies: buildTree(items, item.id)
    }));
}

module.exports = { buildTree };
