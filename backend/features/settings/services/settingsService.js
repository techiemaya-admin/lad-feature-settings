'use strict';

/**
 * Settings Service
 * Module: backend/features/settings
 * Responsibility: Business logic ONLY — validate, transform, delegate to repository.
 *
 * DB column → API field mapping:
 *   start_hour  ↔  startTime   (strips seconds on read: "09:00:00" → "09:00")
 *   end_hour    ↔  endTime
 *   timezone    ↔  timezone
 *   days        ↔  activeDays  (number[] 0-6)
 *   updated_at  ↔  updatedAt
 */

const logger = require('../../../core/utils/logger');
const settingsRepository = require('../repositories/settingsRepository');

// Allowed timezone values — keep in sync with BH_TZ_OPTIONS in frontend
const VALID_TIMEZONES = new Set([
    'UTC+0', 'GMT+0', 'GST+4', 'IST+5:30',
    'EST-5', 'PST-8', 'CET+1', 'JST+9', 'AEST+10',
]);

/**
 * Strip seconds portion from a Postgres TIME value.
 * Postgres returns "09:00:00" — the frontend expects "09:00".
 *
 * @param {string|null} pgTime  e.g. "09:00:00"
 * @returns {string}            e.g. "09:00"
 */
function trimSeconds(pgTime) {
    if (!pgTime) return '09:00';
    // "09:00:00" → ["09", "00", "00"] → "09:00"
    return pgTime.split(':').slice(0, 2).join(':');
}

/**
 * Validate a business hours payload.
 * Throws a structured error with a `code` property on failure.
 *
 * @param {any} payload
 * @throws {Error}
 */
function validateBusinessHoursPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        const err = new Error('Business hours payload must be an object');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    const { startTime, endTime, timezone, activeDays } = payload;

    // "HH:MM" format (24-hour)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        const err = new Error('startTime and endTime must be in HH:MM format');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    if (!VALID_TIMEZONES.has(timezone)) {
        const err = new Error(`timezone "${timezone}" is not a recognised value`);
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    if (!Array.isArray(activeDays)) {
        const err = new Error('activeDays must be an array');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    if (activeDays.some(d => typeof d !== 'number' || d < 0 || d > 6)) {
        const err = new Error('Each value in activeDays must be an integer 0 (Mon)–6 (Sun)');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }
}

/**
 * Map a database row to the API response shape.
 *
 * @param {Object} row  - Raw DB row from tenant_profile
 * @returns {Object}    - { startTime, endTime, timezone, activeDays, updatedAt }
 */
function rowToPayload(row) {
    return {
        startTime: trimSeconds(row.start_hour) || '09:00',
        endTime: trimSeconds(row.end_hour) || '18:00',
        timezone: row.timezone || 'GST+4',
        activeDays: Array.isArray(row.days) ? row.days : (row.days || [0, 1, 2, 3, 4]),
        updatedAt: row.updated_at || null,
    };
}

/**
 * Get business hours for a tenant.
 * Returns sensible defaults if no row found or columns not yet set.
 *
 * @param {string} tenantId
 * @param {string} schema
 * @returns {Promise<Object>}
 */
async function getBusinessHours(tenantId, schema) {
    logger.info('[SettingsService] getBusinessHours', { tenantId, schema });

    const row = await settingsRepository.getBusinessHoursByTenantId(tenantId, schema);

    if (!row) {
        logger.warn('[SettingsService] tenant_profile not found — returning defaults', {
            tenantId,
            schema,
        });
        return {
            startTime: '09:00',
            endTime: '18:00',
            timezone: 'GST+4',
            activeDays: [0, 1, 2, 3, 4],
            updatedAt: null,
        };
    }

    return rowToPayload(row);
}

/**
 * Persist updated business hours for a tenant.
 *
 * @param {string} tenantId
 * @param {Object} payload  - Raw request body (will be validated here)
 * @param {string} schema
 * @returns {Promise<Object>}
 */
async function updateBusinessHours(tenantId, payload, schema) {
    logger.info('[SettingsService] updateBusinessHours', { tenantId, schema });

    validateBusinessHoursPayload(payload);

    // Build clean whitelisted payload
    const clean = {
        startTime: payload.startTime,
        endTime: payload.endTime,
        timezone: payload.timezone,
        activeDays: [...payload.activeDays].sort((a, b) => a - b),
    };

    const row = await settingsRepository.updateBusinessHoursByTenantId(tenantId, clean, schema);

    return rowToPayload(row);
}

module.exports = {
    getBusinessHours,
    updateBusinessHours,
};
