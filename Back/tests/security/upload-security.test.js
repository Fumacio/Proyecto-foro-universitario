const path = require('path');

// Mock fs to prevent actual file operations during tests
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(() => {
    const { PassThrough } = require('stream');
    const stream = new PassThrough();
    stream.bytesWritten = 0;
    return stream;
  })
}));

// Mock multer to capture configuration without executing multer internals
let multerConfigs = [];
let diskStorageOpts = [];
jest.mock('multer', () => {
  const actualMulter = jest.requireActual('multer');
  const multerFn = jest.fn((config) => {
    multerConfigs.push({
      fileFilter: config.fileFilter,
      limits: config.limits
    });
    return {
      single: jest.fn(() => function uploadMiddleware(req, res, next) { next(); })
    };
  });
  multerFn.diskStorage = jest.fn((opts) => {
    diskStorageOpts.push(opts);
    return actualMulter.diskStorage(opts);
  });
  return multerFn;
});

const { uploadAvatar, uploadPostImage } = require('../../middleware/upload');
const fs = require('fs');

describe('Upload Middleware Security', () => {
  // Helper: test fileFilter by invoking it directly
  function callFilter(fileFilterFn, originalname, mimetype) {
    return new Promise((resolve) => {
      const file = { originalname, mimetype };
      fileFilterFn({}, file, (err, accepted) => {
        resolve({ err, accepted });
      });
    });
  }

  const avatarFilter = multerConfigs[0].fileFilter;
  const postFilter = multerConfigs[1].fileFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
  });

  // ─── Acceptance Tests ──────────────────────────────────────────────

  describe('uploadAvatar accepts valid image types', () => {
    test('accepts .jpg with image/jpeg MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'photo.jpg', 'image/jpeg');
      expect(accepted).toBe(true);
      expect(err).toBeNull();
    });

    test('accepts .png with image/png MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'image.png', 'image/png');
      expect(accepted).toBe(true);
      expect(err).toBeNull();
    });

    test('accepts .gif with image/gif MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'anim.gif', 'image/gif');
      expect(accepted).toBe(true);
      expect(err).toBeNull();
    });

    test('accepts .webp with image/webp MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'photo.webp', 'image/webp');
      expect(accepted).toBe(true);
      expect(err).toBeNull();
    });

    test('accepts .jpeg with image/jpeg MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'photo.jpeg', 'image/jpeg');
      expect(accepted).toBe(true);
      expect(err).toBeNull();
    });
  });

  // ─── Rejection Tests ──────────────────────────────────────────────

  describe('uploadAvatar rejects dangerous or invalid files', () => {
    test('rejects .exe with application/octet-stream MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'malware.exe', 'application/octet-stream');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/no permitido/);
    });

    test('rejects .php with application/x-php MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'shell.php', 'application/x-php');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });

    test('rejects .html with text/html MIME', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'page.html', 'text/html');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });

    test('rejects .svg with image/svg+xml MIME (XSS vector)', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'xss.svg', 'image/svg+xml');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });

    test('rejects .jpg when MIME is text/plain (MIME mismatch)', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'fake.jpg', 'text/plain');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });

    test('rejects file without extension', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'noextfile', 'image/jpeg');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── Filename Generation ──────────────────────────────────────────

  describe('filename generation', () => {
    test('generates random filename (not original)', (done) => {
      const filenameFn = diskStorageOpts[0].filename;
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg' };

      filenameFn({}, file, (err, name) => {
        expect(err).toBeNull();
        expect(typeof name).toBe('string');
        expect(name).not.toBe('photo.jpg');
        expect(name).toMatch(/\.jpg$/);
        // Random hex (16 bytes = 32 hex chars) + extension
        const baseName = name.replace('.jpg', '');
        expect(baseName).toMatch(/^[a-f0-9]{32}$/);
        done();
      });
    });

    test('filename uses MIME-based extension, not original extension', (done) => {
      const filenameFn = diskStorageOpts[0].filename;
      // File with .jpg extension but image/png MIME
      const file = { originalname: 'trick.jpg', mimetype: 'image/png' };

      filenameFn({}, file, (err, name) => {
        expect(err).toBeNull();
        // Should use .png (from MIME map), not .jpg (from original)
        expect(name).toMatch(/\.png$/);
        done();
      });
    });
  });

  // ─── Directory Configuration ───────────────────────────────────────

  describe('storage directory configuration', () => {
    test('avatar stores in correct directory (uploads/avatars)', (done) => {
      const destFn = diskStorageOpts[0].destination;
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg' };

      destFn({}, file, (err, dir) => {
        expect(err).toBeNull();
        expect(dir).toContain(path.join('uploads', 'avatars'));
        done();
      });
    });

    test('post image stores in different directory than avatar', (done) => {
      const avatarDestFn = diskStorageOpts[0].destination;
      const postDestFn = diskStorageOpts[1].destination;
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg' };

      avatarDestFn({}, file, (err1, avatarDir) => {
        postDestFn({}, file, (err2, postDir) => {
          expect(err1).toBeNull();
          expect(err2).toBeNull();
          expect(avatarDir).not.toBe(postDir);
          expect(avatarDir).toContain(path.join('uploads', 'avatars'));
          expect(postDir).toContain(path.join('uploads', 'posts'));
          done();
        });
      });
    });
  });

  // ─── Module Configuration Constants ────────────────────────────────

  describe('uploadPostImage acceptance rules', () => {
    test('accepts same valid types as avatar', async () => {
      const types = [
        { ext: 'photo.jpg', mime: 'image/jpeg' },
        { ext: 'image.png', mime: 'image/png' },
        { ext: 'anim.gif', mime: 'image/gif' },
        { ext: 'photo.webp', mime: 'image/webp' },
        { ext: 'photo.jpeg', mime: 'image/jpeg' }
      ];

      for (const { ext, mime } of types) {
        const { accepted } = await callFilter(postFilter, ext, mime);
        expect(accepted).toBe(true);
      }
    });

    test('rejects same invalid types as avatar', async () => {
      const types = [
        { ext: 'malware.exe', mime: 'application/octet-stream' },
        { ext: 'shell.php', mime: 'application/x-php' },
        { ext: 'page.html', mime: 'text/html' },
        { ext: 'xss.svg', mime: 'image/svg+xml' }
      ];

      for (const { ext, mime } of types) {
        const { accepted } = await callFilter(postFilter, ext, mime);
        expect(accepted).toBe(false);
      }
    });
  });

  // ─── MIME Map and Extensions Configuration ────────────────────────

  describe('MIME map and allowed extensions configuration', () => {
    // We test the constants indirectly through the fileFilter behavior

    test('MIMES map is correctly configured for all 4 types', async () => {
      // Each MIME type should be accepted with its matching extension
      const mimeTests = [
        { mime: 'image/jpeg', ext: '.jpg' },
        { mime: 'image/png', ext: '.png' },
        { mime: 'image/gif', ext: '.gif' },
        { mime: 'image/webp', ext: '.webp' }
      ];

      for (const { mime, ext } of mimeTests) {
        const { accepted } = await callFilter(avatarFilter, `test${ext}`, mime);
        expect(accepted).toBe(true);
      }
    });

    test('ALLOWED_EXTENSIONS contains exactly .jpg, .jpeg, .png, .gif, .webp', async () => {
      // These should all be accepted (with matching MIME)
      const allowed = [
        { ext: '.jpg', mime: 'image/jpeg' },
        { ext: '.jpeg', mime: 'image/jpeg' },
        { ext: '.png', mime: 'image/png' },
        { ext: '.gif', mime: 'image/gif' },
        { ext: '.webp', mime: 'image/webp' }
      ];

      for (const { ext, mime } of allowed) {
        const { accepted } = await callFilter(avatarFilter, `file${ext}`, mime);
        expect(accepted).toBe(true);
      }
    });

    test('fileFilter returns true for valid MIME + extension combo', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'valid.png', 'image/png');
      expect(accepted).toBe(true);
      expect(err).toBeNull();
    });

    test('fileFilter returns false for invalid MIME (valid extension)', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'valid.jpg', 'application/msword');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });

    test('fileFilter returns false for invalid extension (valid MIME)', async () => {
      const { err, accepted } = await callFilter(avatarFilter, 'file.bmp', 'image/bmp');
      expect(accepted).toBe(false);
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── Upload instances exported correctly ───────────────────────────

  describe('exported multer instances', () => {
    test('uploadAvatar and uploadPostImage are exported as functions', () => {
      expect(typeof uploadAvatar).toBe('function');
      expect(typeof uploadPostImage).toBe('function');
    });

    test('multer was configured with correct file size limit (5MB)', () => {
      expect(multerConfigs[0].limits.fileSize).toBe(5 * 1024 * 1024);
      expect(multerConfigs[1].limits.fileSize).toBe(5 * 1024 * 1024);
    });

    test('both upload instances use the same fileFilter reference', () => {
      expect(multerConfigs[0].fileFilter).toBe(multerConfigs[1].fileFilter);
    });
  });
});
