const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { banUser, unbanUser, getBans, getBanStatus } = require('../controllers/bans.controller');

const router = Router();

router.get('/', auth, role('admin'), getBans);
router.post('/', auth, role('admin'), banUser);
router.post('/unban', auth, role('admin'), unbanUser);
router.get('/status/:user_id', auth, getBanStatus);

module.exports = router;
