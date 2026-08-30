const { Router } = require('express');
const auth = require('../middleware/auth');
const { register, login, updateProfile, forgotPassword, resetPassword, deleteAccount, banStatus } = require('../controllers/auth.controller');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.put('/profile', auth, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.delete('/account', auth, deleteAccount);
router.get('/ban-status', auth, banStatus);

module.exports = router;
