const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { listCommentsQuery, createCommentSchema, updateCommentSchema } = require('../schemas/comments.schemas');
const { getByPost, create, update, remove } = require('../controllers/comments.controller');

const router = Router({ mergeParams: true });

router.get('/', validate(listCommentsQuery, 'query'), getByPost);
router.post('/', auth, checkBan, validate(createCommentSchema), create);
router.put('/:id', auth, checkBan, validate(idParam, 'params'), validate(updateCommentSchema), update);
router.delete('/:id', auth, checkBan, validate(idParam, 'params'), remove);

module.exports = router;
