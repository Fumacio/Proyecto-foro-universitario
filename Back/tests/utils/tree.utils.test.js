const { buildTree } = require('../../utils/tree.utils');

describe('buildTree Utility', () => {
  test('should return empty array for empty input', () => {
    expect(buildTree([], null)).toEqual([]);
  });

  test('should build single level tree with null parentId', () => {
    const items = [
      { id: 1, parent_id: null, content: 'A' },
      { id: 2, parent_id: null, content: 'B' },
      { id: 3, parent_id: 1, content: 'C' }
    ];
    const tree = buildTree(items, null);
    expect(tree).toHaveLength(2);
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies[0].content).toBe('C');
    expect(tree[1].replies).toHaveLength(0);
  });

  test('should build deeply nested tree', () => {
    const items = [
      { id: 1, parent_id: null, content: 'root' },
      { id: 2, parent_id: 1, content: 'child1' },
      { id: 3, parent_id: 2, content: 'grandchild' },
      { id: 4, parent_id: 1, content: 'child2' }
    ];
    const tree = buildTree(items, null);
    expect(tree).toHaveLength(1);
    expect(tree[0].replies).toHaveLength(2);
    expect(tree[0].replies[0].replies).toHaveLength(1);
    expect(tree[0].replies[0].replies[0].content).toBe('grandchild');
    expect(tree[0].replies[1].replies).toHaveLength(0);
  });

  test('should preserve all properties of items', () => {
    const items = [
      { id: 1, parent_id: null, content: 'A', extra: 'data' }
    ];
    const tree = buildTree(items, null);
    expect(tree[0]).toMatchObject({ id: 1, parent_id: null, content: 'A', extra: 'data', replies: [] });
  });
});
