// Mock nodemailer before requiring mailer
const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
  }))
}));

const nodemailer = require('nodemailer');
const { sendMail } = require('../../utils/mailer');

describe('Mailer Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  test('should return sent:false if SMTP not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const result = await sendMail({ to: 'test@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result.sent).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('should send email if SMTP is configured', async () => {
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'password123';
    mockSendMail.mockResolvedValue({ messageId: '123' });

    const result = await sendMail({ to: 'user@test.com', subject: 'Hello', html: '<p>Hello</p>' });
    expect(result.sent).toBe(true);
    expect(result.messageId).toBe('123');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Hello',
        html: '<p>Hello</p>'
      })
    );
  });

  test('should throw on sendMail failure', async () => {
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'password123';
    mockSendMail.mockRejectedValue(new Error('SMTP Error'));

    await expect(sendMail({ to: 'a@b.com', subject: 'T', html: 'H' })).rejects.toThrow('SMTP Error');
  });
});
