const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { findByEmailQuery, updateUserSchema } = require('../schemas/users.schemas');
const { getAll, getById, findByEmail, update, remove, uploadAvatar, getStats, getActivity } = require('../controllers/users.controller');
const { uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');

const router = Router();

router.use(auth);

router.get('/', role('admin'), getAll);
router.get('/by-email', role('admin'), validate(findByEmailQuery, 'query'), findByEmail);
router.post('/avatar', uploadAvatarMiddleware, uploadAvatar);
router.get('/:id', validate(idParam, 'params'), getById);
router.get('/:id/stats', validate(idParam, 'params'), getStats);
router.get('/:id/activity', validate(idParam, 'params'), getActivity);
router.put('/:id', role('admin'), validate(idParam, 'params'), validate(updateUserSchema), update);
router.delete('/:id', role('admin'), validate(idParam, 'params'), remove);

module.exports = router;
