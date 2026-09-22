const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { listPostsQuery, createPostSchema, updatePostSchema } = require('../schemas/posts.schemas');
const { getAll, getById, create, update, remove, uploadImage } = require('../controllers/posts.controller');
const { uploadPostImage } = require('../middleware/upload');

const router = Router();

router.get('/', validate(listPostsQuery, 'query'), getAll);
router.post('/upload-image', auth, checkBan, uploadPostImage, uploadImage);
router.get('/:id', validate(idParam, 'params'), getById);
router.post('/', auth, checkBan, validate(createPostSchema), create);
router.put('/:id', auth, checkBan, validate(idParam, 'params'), validate(updatePostSchema), update);
router.delete('/:id', auth, checkBan, validate(idParam, 'params'), remove);

module.exports = router;
