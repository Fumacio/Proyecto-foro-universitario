const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const { getByPost, create, update, remove } = require('../controllers/comments.controller');

const router = Router({ mergeParams: true });

router.get('/', getByPost);
router.post('/', auth, checkBan, create);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

module.exports = router;
