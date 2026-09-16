const errorHandler = require('../../middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('should return 500 with generic error message', () => {
    const err = new Error('Something went wrong');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
  });

  test('should log the error to console', () => {
    const err = new Error('Test error');
    errorHandler(err, req, res, next);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[UNHANDLED ERROR]'),
      err
    );
  });

  test('should not call next', () => {
    const err = new Error('Error');
    errorHandler(err, req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
