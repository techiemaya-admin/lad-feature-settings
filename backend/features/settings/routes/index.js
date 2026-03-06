'use strict';

/**
 * Settings Routes
 * Module: backend/features/settings
 *
 * Mount point (set in core/app.js): /api/settings
 * Full paths exposed:
 *   GET   /api/settings/health            — health check
 *   GET   /api/settings/business-hours    — fetch tenant business hours
 *   PATCH /api/settings/business-hours    — update tenant business hours
 */

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// ── Health check ──────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Settings service is healthy',
    timestamp: new Date().toISOString(),
  });
});

// ── Business Hours ────────────────────────────────────────────────────────────

// GET /api/settings/business-hours
// Returns the saved business hours for the authenticated tenant
router.get('/business-hours', settingsController.getBusinessHours);

// PATCH /api/settings/business-hours
// Body: { startTime, endTime, timezone, activeDays }
// Updates business hours for the authenticated tenant
router.patch('/business-hours', settingsController.updateBusinessHours);

module.exports = router;
