const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { createTagSchema } = require('../schemas/tags.schemas');
const { getAll, create, remove } = require('../controllers/tags.controller');

const router = Router();

router.get('/', getAll);
router.post('/', auth, role('admin'), validate(createTagSchema), create);
router.delete('/:id', auth, role('admin'), validate(idParam, 'params'), remove);

module.exports = router;
