const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getAll, getById, create, update, remove } = require('../controllers/categories.controller');

const router = Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', auth, role('admin'), create);
router.put('/:id', auth, role('admin'), update);
router.delete('/:id', auth, role('admin'), remove);

module.exports = router;
