const { Router } = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  deleteAccountSchema
} = require('../schemas/auth.schemas');
const { register, login, updateProfile, forgotPassword, resetPassword, deleteAccount, banStatus } = require('../controllers/auth.controller');

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.put('/profile', auth, validate(updateProfileSchema), updateProfile);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.delete('/account', auth, validate(deleteAccountSchema), deleteAccount);
router.get('/ban-status', auth, banStatus);

module.exports = router;
