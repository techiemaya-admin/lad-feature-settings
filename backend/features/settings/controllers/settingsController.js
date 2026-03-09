'use strict';

/**
 * Settings Controller
 * Module: backend/features/settings
 * Responsibility: Validate request → extract tenant → call service → return HTTP response.
 *
 * LAD rules enforced:
 *  - Tenant ID comes from req.user (auth middleware), NEVER from the request body
 *  - Schema resolved via getSchema(req)
 *  - No SQL — all DB work is in settingsService / settingsRepository
 *  - No console.* — logger only
 */

const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');
const { requireTenantId } = require('../../../core/utils/tenantHelper');
const settingsService = require('../services/settingsService');

/**
 * GET /api/settings/business-hours
 * Returns current business hours for the authenticated tenant.
 */
async function getBusinessHours(req, res) {
    try {
        const tenantId = requireTenantId(null, req, 'getBusinessHours');
        const schema = getSchema(req);

        const data = await settingsService.getBusinessHours(tenantId, schema);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.message && error.message.includes('Tenant ID required')) {
            logger.warn('[SettingsController] getBusinessHours — tenant context missing', { error: error.message });
            return res.status(401).json({ success: false, error: 'Tenant context required' });
        }
        logger.error('[SettingsController] getBusinessHours — unexpected error', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to retrieve business hours' });
    }
}

/**
 * PATCH /api/settings/business-hours
 * Persists updated business hours for the authenticated tenant.
 *
 * Expected body:
 * { startTime: "09:00", endTime: "18:00", timezone: "GST+4", activeDays: [0,1,2,3,4] }
 */
async function updateBusinessHours(req, res) {
    try {
        const tenantId = requireTenantId(null, req, 'updateBusinessHours');
        const schema = getSchema(req);

        const { startTime, endTime, timezone, activeDays } = req.body || {};

        if (startTime === undefined || endTime === undefined ||
            timezone === undefined || activeDays === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: startTime, endTime, timezone, activeDays',
            });
        }

        const data = await settingsService.updateBusinessHours(tenantId, req.body, schema);

        logger.info('[SettingsController] updateBusinessHours — saved', { tenantId, schema });
        return res.status(200).json({ success: true, data });

    } catch (error) {
        if (error.message && error.message.includes('Tenant ID required')) {
            logger.warn('[SettingsController] updateBusinessHours — tenant context missing', { error: error.message });
            return res.status(401).json({ success: false, error: 'Tenant context required' });
        }
        if (error.code === 'VALIDATION_ERROR') {
            logger.warn('[SettingsController] updateBusinessHours — validation error', { error: error.message });
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.code === 'TENANT_PROFILE_NOT_FOUND') {
            logger.warn('[SettingsController] updateBusinessHours — tenant profile not found', { error: error.message });
            return res.status(404).json({ success: false, error: 'Tenant profile not found' });
        }
        logger.error('[SettingsController] updateBusinessHours — unexpected error', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to update business hours' });
    }
}

module.exports = { getBusinessHours, updateBusinessHours };
