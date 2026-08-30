const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getAll, getById, findByEmail, update, remove, uploadAvatar, getStats, getActivity } = require('../controllers/users.controller');
const { uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');

const router = Router();

router.use(auth);

router.get('/', role('admin'), getAll);
router.get('/by-email', role('admin'), findByEmail);
router.post('/avatar', uploadAvatarMiddleware, uploadAvatar);
router.get('/:id', getById);
router.get('/:id/stats', getStats);
router.get('/:id/activity', getActivity);
router.put('/:id', role('admin'), update);
router.delete('/:id', role('admin'), remove);

module.exports = router;
