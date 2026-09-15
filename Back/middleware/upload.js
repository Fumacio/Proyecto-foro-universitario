const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const createStorage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeExt = MIME_EXTENSION_MAP[file.mimetype] || '.jpg';
    const name = crypto.randomBytes(16).toString('hex') + safeExt;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const originalExt = path.extname(file.originalname).toLowerCase();
  const isMimeAllowed = Boolean(MIME_EXTENSION_MAP[file.mimetype]);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(originalExt);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Formato de archivo no permitido. Solo se admiten JPG, PNG, GIF y WEBP'), false);
  }
};

const uploadAvatar = multer({
  storage: createStorage('avatars'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('avatar');

const uploadPostImage = multer({
  storage: createStorage('posts'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');

module.exports = { uploadAvatar, uploadPostImage };

