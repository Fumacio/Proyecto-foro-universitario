const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { createCategorySchema, updateCategorySchema } = require('../schemas/categories.schemas');
const { getAll, getById, create, update, remove } = require('../controllers/categories.controller');

const router = Router();

router.get('/', getAll);
router.get('/:id', validate(idParam, 'params'), getById);
router.post('/', auth, role('admin'), validate(createCategorySchema), create);
router.put('/:id', auth, role('admin'), validate(idParam, 'params'), validate(updateCategorySchema), update);
router.delete('/:id', auth, role('admin'), validate(idParam, 'params'), remove);

module.exports = router;
