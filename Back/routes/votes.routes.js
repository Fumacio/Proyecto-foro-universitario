const { Router } = require('express');
const auth = require('../middleware/auth');
const checkBan = require('../middleware/ban');
const { votePost, voteComment } = require('../controllers/votes.controller');

const router = Router();

router.put('/posts/:id/vote', auth, checkBan, votePost);
router.put('/comments/:id/vote', auth, checkBan, voteComment);

module.exports = router;
