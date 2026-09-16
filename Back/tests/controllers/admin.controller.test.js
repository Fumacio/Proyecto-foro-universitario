jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');
const { getDashboard } = require('../../controllers/admin.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('admin.controller - getDashboard', () => {
  const mockCounts = (overrides = {}) => {
    const defaults = {
      users: 100,
      posts: 250,
      comments: 600,
      categories: 12,
      pendingReports: 5,
      activeBans: 3,
    };
    const c = { ...defaults, ...overrides };

    pool.query
      .mockResolvedValueOnce([[{ total: c.users }]])
      .mockResolvedValueOnce([[{ total: c.posts }]])
      .mockResolvedValueOnce([[{ total: c.comments }]])
      .mockResolvedValueOnce([[{ total: c.categories }]])
      .mockResolvedValueOnce([[{ total: c.pendingReports }]])
      .mockResolvedValueOnce([[{ total: c.activeBans }]]);
  };

  const mockRecentUsers = (rows) => {
    pool.query.mockResolvedValueOnce([rows]);
  };

  const mockRecentPosts = (rows) => {
    pool.query.mockResolvedValueOnce([rows]);
  };

  it('should return all counts and recent data', async () => {
    const recentUsers = [
      { id: 2, username: 'bob', email: 'bob@test.com', role: 'student', created_at: '2025-06-10' },
    ];
    const recentPosts = [
      { id: 15, title: 'Hello World', username: 'alice', created_at: '2025-06-11' },
    ];

    mockCounts();
    mockRecentUsers(recentUsers);
    mockRecentPosts(recentPosts);

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    expect(pool.query).toHaveBeenCalledTimes(8);
    expect(res.json).toHaveBeenCalledWith({
      counts: {
        users: 100,
        posts: 250,
        comments: 600,
        categories: 12,
        pendingReports: 5,
        activeBans: 3,
      },
      recentUsers,
      recentPosts,
    });
  });

  it('should return all zeros when the database is empty', async () => {
    mockCounts({ users: 0, posts: 0, comments: 0, categories: 0, pendingReports: 0, activeBans: 0 });
    mockRecentUsers([]);
    mockRecentPosts([]);

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    expect(res.json).toHaveBeenCalledWith({
      counts: {
        users: 0,
        posts: 0,
        comments: 0,
        categories: 0,
        pendingReports: 0,
        activeBans: 0,
      },
      recentUsers: [],
      recentPosts: [],
    });
  });

  it('should execute exactly 8 queries (6 counts + 2 recents)', async () => {
    mockCounts({ users: 1, posts: 1, comments: 1, categories: 1, pendingReports: 0, activeBans: 0 });
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    expect(pool.query).toHaveBeenCalledTimes(8);
  });

  it('should call the correct count queries in order', async () => {
    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    expect(pool.query.mock.calls[0][0]).toMatch(/SELECT COUNT.*FROM users/);
    expect(pool.query.mock.calls[1][0]).toMatch(/SELECT COUNT.*FROM posts/);
    expect(pool.query.mock.calls[2][0]).toMatch(/SELECT COUNT.*FROM comments/);
    expect(pool.query.mock.calls[3][0]).toMatch(/SELECT COUNT.*FROM categories/);
    expect(pool.query.mock.calls[4][0]).toMatch(/SELECT COUNT.*FROM reports.*WHERE status = 'pending'/);
    expect(pool.query.mock.calls[5][0]).toMatch(/SELECT COUNT.*FROM bans/);
  });

  it('should query recent users ordered by created_at DESC with LIMIT 5', async () => {
    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    const recentUsersQuery = pool.query.mock.calls[6][0];
    expect(recentUsersQuery).toMatch(/ORDER BY u\.created_at DESC LIMIT 5/);
  });

  it('should query recent posts ordered by created_at DESC with LIMIT 5', async () => {
    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    const recentPostsQuery = pool.query.mock.calls[7][0];
    expect(recentPostsQuery).toMatch(/ORDER BY p\.created_at DESC LIMIT 5/);
  });

  it('should join users with roles in recent users query', async () => {
    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    const recentUsersQuery = pool.query.mock.calls[6][0];
    expect(recentUsersQuery).toMatch(/JOIN roles r ON u\.role_id = r\.id/);
  });

  it('should join posts with users in recent posts query', async () => {
    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    const recentPostsQuery = pool.query.mock.calls[7][0];
    expect(recentPostsQuery).toMatch(/JOIN users u ON p\.user_id = u\.id/);
  });

  it('should filter bans by permanent type OR temporary with future expiry', async () => {
    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts([]);

    await getDashboard({}, mockRes());

    const bansQuery = pool.query.mock.calls[5][0];
    expect(bansQuery).toMatch(/type = 'permanent'/);
    expect(bansQuery).toMatch(/type = 'temporary'/);
    expect(bansQuery).toMatch(/expires_at > NOW\(\)/);
  });

  it('should handle multiple recent users', async () => {
    const manyUsers = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      username: `user${i}`,
      email: `user${i}@test.com`,
      role: 'student',
      created_at: `2025-06-${10 + i}`,
    }));

    mockCounts();
    mockRecentUsers(manyUsers);
    mockRecentPosts([]);

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    const data = res.json.mock.calls[0][0];
    expect(data.recentUsers).toHaveLength(5);
    expect(data.recentUsers[0].username).toBe('user0');
    expect(data.recentUsers[4].username).toBe('user4');
  });

  it('should handle multiple recent posts', async () => {
    const manyPosts = Array.from({ length: 5 }, (_, i) => ({
      id: i + 100,
      title: `Post ${i}`,
      username: `author${i}`,
      created_at: `2025-06-${10 + i}`,
    }));

    mockCounts();
    mockRecentUsers([]);
    mockRecentPosts(manyPosts);

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    const data = res.json.mock.calls[0][0];
    expect(data.recentPosts).toHaveLength(5);
    expect(data.recentPosts[0].title).toBe('Post 0');
    expect(data.recentPosts[4].title).toBe('Post 4');
  });

  it('should handle database errors gracefully', async () => {
    pool.query.mockRejectedValue(new Error('DB connection failed'));

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener dashboard' });
  });

  it('should send 500 even when the error occurs on the 8th query', async () => {
    // First 7 queries succeed, 8th fails
    pool.query
      .mockResolvedValueOnce([[{ total: 10 }]])
      .mockResolvedValueOnce([[{ total: 20 }]])
      .mockResolvedValueOnce([[{ total: 30 }]])
      .mockResolvedValueOnce([[{ total: 4 }]])
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('late failure'));

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener dashboard' });
  });

  it('should include pendingReports count from reports with status pending', async () => {
    mockCounts({ pendingReports: 42 });
    mockRecentUsers([]);
    mockRecentPosts([]);

    const req = {};
    const res = mockRes();

    await getDashboard(req, res);

    const data = res.json.mock.calls[0][0];
    expect(data.counts.pendingReports).toBe(42);
    expect(pool.query.mock.calls[4][0]).toContain("status = 'pending'");
  });
});
