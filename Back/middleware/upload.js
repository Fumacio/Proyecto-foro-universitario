const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const createStorage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  cb(null, allowed.includes(file.mimetype));
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
