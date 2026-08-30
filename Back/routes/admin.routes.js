const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getDashboard } = require('../controllers/admin.controller');

const router = Router();

router.use(auth);
router.use(role('admin'));

router.get('/dashboard', getDashboard);

module.exports = router;
