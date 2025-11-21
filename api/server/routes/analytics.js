const express = require('express');
const router = express.Router();
const { getUsageAnalytics } = require('../controllers/AnalyticsController');
const { requireJwtAuth, checkAdmin } = require('../middleware');

router.get('/usage', requireJwtAuth, checkAdmin, getUsageAnalytics);

module.exports = router;
