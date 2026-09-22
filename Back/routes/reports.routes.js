const { Router } = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const { idParam } = require('../schemas/common');
const { createReportSchema, listReportsQuery, resolveReportSchema } = require('../schemas/reports.schemas');
const { createReport, getReports, getReportCounts, resolveReport } = require('../controllers/reports.controller');

const router = Router();

router.post('/', auth, validate(createReportSchema), createReport);
router.get('/', auth, role('admin'), validate(listReportsQuery, 'query'), getReports);
router.get('/counts', auth, role('admin'), getReportCounts);
router.put('/:id', auth, role('admin'), validate(idParam, 'params'), validate(resolveReportSchema), resolveReport);

module.exports = router;
