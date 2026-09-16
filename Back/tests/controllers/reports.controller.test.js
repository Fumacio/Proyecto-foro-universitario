jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

const {
  createReport,
  getReports,
  getReportCounts,
  resolveReport,
} = require('../../controllers/reports.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// createReport
// ══════════════════════════════════════════════════════════════════════════════

describe('reports.controller - createReport', () => {
  it('should return 400 if reason is missing', async () => {
    const req = { body: { post_id: 1 }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La razón del reporte es obligatoria' });
  });

  it('should return 400 if neither post_id nor comment_id is provided', async () => {
    const req = { body: { reason: 'spam' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Debe especificar un post o comentario' });
  });

  it('should return 400 if both post_id and comment_id are provided', async () => {
    const req = { body: { post_id: 1, comment_id: 2, reason: 'spam' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Solo puede reportar un post o un comentario, no ambos' });
  });

  it('should return 400 if reason is not in valid list', async () => {
    const req = { body: { post_id: 1, reason: 'invalid_reason' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Razón inválida' });
  });

  it('should return 404 if post is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]); // SELECT id FROM posts

    const req = { body: { post_id: 999, reason: 'spam' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  it('should return 404 if comment is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]); // SELECT id FROM comments

    const req = { body: { comment_id: 999, reason: 'abuso' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Comentario no encontrado' });
  });

  it('should return 409 if duplicate pending report exists', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])   // post exists
      .mockResolvedValueOnce([[{ id: 5 }]]);   // existing report

    const req = { body: { post_id: 10, reason: 'spam' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ya reportaste este contenido y está pendiente de revisión' });
  });

  it('should create report for post successfully', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])    // post exists
      .mockResolvedValueOnce([[]])               // no duplicate
      .mockResolvedValueOnce([{ insertId: 20 }]); // INSERT

    const req = { body: { post_id: 10, reason: 'spam', description: 'Too much spam' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 20, message: 'Reporte enviado correctamente' });

    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO reports');
    expect(insertCall[1]).toEqual([1, 10, null, 'spam', 'Too much spam']);
  });

  it('should create report for comment successfully', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5 }]])     // comment exists
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 21 }]);

    const req = { body: { comment_id: 5, reason: 'abuso' }, user: { id: 2 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[1]).toEqual([2, null, 5, 'abuso', null]);
  });

  it('should accept all valid reason types', async () => {
    const validReasons = ['spam', 'abuso', 'contenido_inapropiado', 'off_topic', 'otro'];

    for (const reason of validReasons) {
      jest.clearAllMocks();
      pool.query
        .mockResolvedValueOnce([[{ id: 10 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 30 }]);

      const req = { body: { post_id: 10, reason }, user: { id: 1 } };
      const res = mockRes();

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    }
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { body: { post_id: 10, reason: 'spam' }, user: { id: 1 } };
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al crear reporte' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getReports
// ══════════════════════════════════════════════════════════════════════════════

describe('reports.controller - getReports', () => {
  it('should return reports with default status pending', async () => {
    const reports = [
      { id: 1, reason: 'spam', status: 'pending', reporter_username: 'alice' },
    ];
    pool.query.mockResolvedValueOnce([reports]);

    const req = { query: {} };
    const res = mockRes();

    await getReports(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['pending']
    );
    expect(res.json).toHaveBeenCalledWith(reports);
  });

  it('should filter reports by status query param', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { query: { status: 'resolved' } };
    const res = mockRes();

    await getReports(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['resolved']
    );
  });

  it('should return empty array when no reports match', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { query: {} };
    const res = mockRes();

    await getReports(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { query: {} };
    const res = mockRes();

    await getReports(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener reportes' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getReportCounts
// ══════════════════════════════════════════════════════════════════════════════

describe('reports.controller - getReportCounts', () => {
  it('should return pending, resolved and dismissed counts', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 5 }]])    // pending
      .mockResolvedValueOnce([[{ total: 3 }]])    // resolved
      .mockResolvedValueOnce([[{ total: 2 }]]);   // dismissed

    const req = {};
    const res = mockRes();

    await getReportCounts(req, res);

    expect(res.json).toHaveBeenCalledWith({ pending: 5, resolved: 3, dismissed: 2 });
  });

  it('should return zeros when no reports exist', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const req = {};
    const res = mockRes();

    await getReportCounts(req, res);

    expect(res.json).toHaveBeenCalledWith({ pending: 0, resolved: 0, dismissed: 0 });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = {};
    const res = mockRes();

    await getReportCounts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener conteo de reportes' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// resolveReport
// ══════════════════════════════════════════════════════════════════════════════

describe('reports.controller - resolveReport', () => {
  it('should return 400 if action is invalid', async () => {
    const req = { params: { id: '1' }, body: { action: 'delete' }, user: { id: 1 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acción inválida. Use "resolved" o "dismissed"' });
  });

  it('should return 400 if action is missing', async () => {
    const req = { params: { id: '1' }, body: {}, user: { id: 1 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acción inválida. Use "resolved" o "dismissed"' });
  });

  it('should return 404 if report is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { id: '999' }, body: { action: 'resolved' }, user: { id: 1 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Reporte no encontrado' });
  });

  it('should return 400 if report is already processed', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, status: 'resolved' }]]);

    const req = { params: { id: '1' }, body: { action: 'resolved' }, user: { id: 1 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El reporte ya fue procesado' });
  });

  it('should return 400 if report is already dismissed', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, status: 'dismissed' }]]);

    const req = { params: { id: '1' }, body: { action: 'resolved' }, user: { id: 1 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El reporte ya fue procesado' });
  });

  it('should resolve report as "resolved"', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1, status: 'pending' }]])
      .mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, body: { action: 'resolved' }, user: { id: 5 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports SET status'),
      ['resolved', 5, '1']
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Reporte marcado como resolved' });
  });

  it('should dismiss report as "dismissed"', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1, status: 'pending' }]])
      .mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, body: { action: 'dismissed' }, user: { id: 5 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports SET status'),
      ['dismissed', 5, '1']
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Reporte marcado como dismissed' });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' }, body: { action: 'resolved' }, user: { id: 1 } };
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al resolver reporte' });
  });
});
