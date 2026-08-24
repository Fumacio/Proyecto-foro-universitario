const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getAll, create, remove } = require('../controllers/tags.controller');

const router = Router();

router.get('/', getAll);
router.post('/', auth, role('admin'), create);
router.delete('/:id', auth, role('admin'), remove);

module.exports = router;
