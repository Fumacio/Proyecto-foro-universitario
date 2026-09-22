const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { voteSchema } = require('../schemas/votes.schemas');
const { votePost, voteComment } = require('../controllers/votes.controller');

const router = Router();

router.put('/posts/:id/vote', auth, checkBan, validate(idParam, 'params'), validate(voteSchema), votePost);
router.put('/comments/:id/vote', auth, checkBan, validate(idParam, 'params'), validate(voteSchema), voteComment);

module.exports = router;
