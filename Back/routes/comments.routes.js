const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const { getByPost, create, update, remove } = require('../controllers/comments.controller');

const router = Router({ mergeParams: true });

router.get('/', getByPost);
router.post('/', auth, checkBan, create);
router.put('/:id', auth, checkBan, update);
router.delete('/:id', auth, checkBan, remove);

module.exports = router;
