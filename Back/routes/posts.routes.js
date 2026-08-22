const { Router } = require('express');
const auth = require('../middleware/auth');
const { getAll, getById, create, update, remove, uploadImage } = require('../controllers/posts.controller');
const { uploadPostImage } = require('../middleware/upload');

const router = Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', auth, create);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);
router.post('/upload-image', auth, uploadPostImage, uploadImage);

module.exports = router;
