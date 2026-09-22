const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const { userIdParam } = require('../schemas/common');
const { banUserSchema, unbanUserSchema } = require('../schemas/bans.schemas');
const { banUser, unbanUser, getBans, getBanStatus } = require('../controllers/bans.controller');

const router = Router();

router.get('/', auth, role('admin'), getBans);
router.post('/', auth, role('admin'), validate(banUserSchema), banUser);
router.post('/unban', auth, role('admin'), validate(unbanUserSchema), unbanUser);
router.get('/status/:user_id', auth, validate(userIdParam, 'params'), getBanStatus);

module.exports = router;
