const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const validate = require('../middleware/validate');
const { postIdParam, postCommentParams } = require('../schemas/common');
const { listCommentsQuery, createCommentSchema, updateCommentSchema } = require('../schemas/comments.schemas');
const { getByPost, create, update, remove } = require('../controllers/comments.controller');

const router = Router({ mergeParams: true });

router.get('/', auth.optional, validate(postIdParam, 'params'), validate(listCommentsQuery, 'query'), getByPost);
router.post('/', auth, checkBan, validate(postIdParam, 'params'), validate(createCommentSchema), create);
router.put('/:id', auth, checkBan, validate(postCommentParams, 'params'), validate(updateCommentSchema), update);
router.delete('/:id', auth, checkBan, validate(postCommentParams, 'params'), remove);

module.exports = router;
