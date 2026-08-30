const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { createReport, getReports, getReportCounts, resolveReport } = require('../controllers/reports.controller');

const router = Router();

router.post('/', auth, createReport);
router.get('/', auth, role('admin'), getReports);
router.get('/counts', auth, role('admin'), getReportCounts);
router.put('/:id', auth, role('admin'), resolveReport);

module.exports = router;
