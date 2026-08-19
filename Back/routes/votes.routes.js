const { Router } = require('express');
const auth = require('../middleware/auth');
const { votePost, voteComment } = require('../controllers/votes.controller');

const router = Router();

router.put('/posts/:id/vote', auth, votePost);
router.put('/comments/:id/vote', auth, voteComment);

module.exports = router;
