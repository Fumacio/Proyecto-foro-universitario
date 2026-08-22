const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getAll, getById, update, remove, uploadAvatar } = require('../controllers/users.controller');
const { uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');

const router = Router();

router.use(auth);

router.get('/', role('admin'), getAll);
router.post('/avatar', uploadAvatarMiddleware, uploadAvatar);
router.get('/:id', getById);
router.put('/:id', role('admin'), update);
router.delete('/:id', role('admin'), remove);

module.exports = router;
