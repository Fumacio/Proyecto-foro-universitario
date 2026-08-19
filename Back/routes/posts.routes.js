const { Router } = require('express');
const auth = require('../middleware/auth');
const { getAll, getById, create, update, remove } = require('../controllers/posts.controller');

const router = Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', auth, create);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

module.exports = router;
