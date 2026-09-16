const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const { getAll, getById, create, update, remove, uploadImage } = require('../controllers/posts.controller');
const { uploadPostImage } = require('../middleware/upload');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas subidas, esperá 1 hora' }
});

const router = Router();

router.get('/', getAll);
router.post('/upload-image', auth, checkBan, uploadLimiter, uploadPostImage, uploadImage);
router.get('/:id', getById);
router.post('/', auth, checkBan, create);
router.put('/:id', auth, checkBan, update);
router.delete('/:id', auth, checkBan, remove);

module.exports = router;
