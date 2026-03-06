'use strict';

/**
 * Settings Repository
 * Module: backend/features/settings
 * Responsibility: SQL ONLY — no business logic here.
 *
 * Maps to real lad_dev.tenant_profile columns:
 *   start_hour  → TIME WITHOUT TIME ZONE   (e.g. "09:00:00")
 *   end_hour    → TIME WITHOUT TIME ZONE   (e.g. "18:00:00")
 *   timezone    → TEXT                     (e.g. "IST")
 *   days        → JSONB                    (e.g. [0,1,2,3,4])
 *   updated_at  → TIMESTAMP WITHOUT TIME ZONE
 *
 * All queries are tenant-scoped via the `schema` parameter resolved
 * upstream by schemaHelper.getSchema(req).
 */

const db = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');

/**
 * Retrieve business hours fields for a specific tenant.
 *
 * @param {string} tenantId  - UUID from JWT (primary_tenant_id)
 * @param {string} schema    - Resolved schema name (e.g. "lad_dev")
 * @returns {Promise<Object|null>} Row with start_hour, end_hour, timezone, days, updated_at
 */
async function getBusinessHoursByTenantId(tenantId, schema) {
  const sql = `
    SELECT
      tenant_id,
      start_hour,
      end_hour,
      timezone,
      days,
      updated_at
    FROM ${schema}.tenant_profile
    WHERE tenant_id = $1
    LIMIT 1
  `;

  logger.debug('[SettingsRepository] getBusinessHoursByTenantId', { tenantId, schema });

  const result = await db.query(sql, [tenantId]);

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0];
}

/**
 * Update business hours columns for a specific tenant.
 *
 * @param {string} tenantId  - UUID from JWT (primary_tenant_id)
 * @param {Object} payload   - { startTime, endTime, timezone, activeDays }
 * @param {string} schema    - Resolved schema name
 * @returns {Promise<Object>} Updated row
 */
async function updateBusinessHoursByTenantId(tenantId, payload, schema) {
  // tenant_profile's primary key is `id`, not `tenant_id`. 
  // Since `tenant_id` does not have a UNIQUE constraint, we cannot use ON CONFLICT (tenant_id).
  // We must check if the row exists, then UPDATE or INSERT.

  const checkSql = `SELECT id FROM ${schema}.tenant_profile WHERE tenant_id = $1 LIMIT 1`;
  const checkResult = await db.query(checkSql, [tenantId]);

  let sql;
  let params;

  if (checkResult.rows.length > 0) {
    // UPDATE existing row
    sql = `
      UPDATE ${schema}.tenant_profile
      SET
        start_hour = $2::time,
        end_hour   = $3::time,
        timezone   = $4,
        days       = $5::jsonb,
        updated_at = NOW()
      WHERE tenant_id = $1
      RETURNING tenant_id, start_hour, end_hour, timezone, days, updated_at
    `;
    params = [
      tenantId,
      payload.startTime,
      payload.endTime,
      payload.timezone,
      JSON.stringify(payload.activeDays),
    ];
  } else {
    // INSERT new row for tenant
    // Note: Reusing tenant_id as the primary key `id` is a common LAD pattern 
    // when setting up a 1:1 tenant profile, or letting Postgres generate `id` if it has a default.
    // We provide `id` = `tenant_id` to ensure it works interchangeably.
    sql = `
      INSERT INTO ${schema}.tenant_profile (
        id, tenant_id, start_hour, end_hour, timezone, days, updated_at
      ) VALUES (
        $1, $1, $2::time, $3::time, $4, $5::jsonb, NOW()
      )
      RETURNING tenant_id, start_hour, end_hour, timezone, days, updated_at
    `;
    params = [
      tenantId,
      payload.startTime,
      payload.endTime,
      payload.timezone,
      JSON.stringify(payload.activeDays),
    ];
  }

  logger.debug('[SettingsRepository] updateBusinessHoursByTenantId', {
    tenantId,
    schema,
    startTime: payload.startTime,
    endTime: payload.endTime,
    timezone: payload.timezone,
    days: payload.activeDays,
  });

  const result = await db.query(sql, params);

  if (!result.rows.length) {
    const error = new Error(`tenant_profile not found for tenant_id: ${tenantId}`);
    error.code = 'TENANT_PROFILE_NOT_FOUND';
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  getBusinessHoursByTenantId,
  updateBusinessHoursByTenantId,
};
