const { sendError } = require('../../utils/response.utils');

describe('sendError Utility', () => {
  let res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('should send error with default status 500', () => {
    const err = new Error('test error');
    sendError(res, err, 'Error al procesar');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al procesar' });
  });

  test('should send error with custom status', () => {
    const err = new Error('not found');
    sendError(res, err, 'No encontrado', 404);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No encontrado' });
  });

  test('should log the error to console', () => {
    const err = new Error('test error');
    sendError(res, err, 'Error message');
    expect(console.error).toHaveBeenCalledWith('Error message', err);
  });
});
