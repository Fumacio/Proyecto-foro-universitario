const { Router } = require('express');
const auth = require('../middleware/auth');
const { register, login, updateProfile } = require('../controllers/auth.controller');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.put('/profile', auth, updateProfile);

module.exports = router;
