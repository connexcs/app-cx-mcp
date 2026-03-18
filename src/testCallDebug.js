/**
 * Test Call Debug Functions
 * Direct function testing without MCP wrapper
 */

import { getApi } from './callDebugTools'

export async function executeSQL (sql) {
	const result = await getApi().post('setup/query/0/run', {
		_query: sql,
		_src: 'cdr'
	})
	
	return result
}

/**
 * Investigate recent calls with optional filters.
 * @param {Object} [args] - Filter options
 * @param {string} [args.time_range='last_24h'] - Time range: 'last_1h', 'last_6h', or 'last_24h'
 * @param {string} [args.phone_number] - Filter by phone number (digits only)
 * @param {string} [args.status] - Filter by call status: answered, failed, busy, no-answer, cancelled
 * @param {number} [args.limit=10] - Max results to return (1-1000)
 * @returns {Promise<Object>} Result with call list and executed SQL query
 */
export async function investigateCalls (args) {
	const {
		time_range = 'last_24h',
		phone_number,
		status,
		limit = 10
	} = args || {}

	// Calculate time range
	const now = new Date()
	const hours = time_range === 'last_1h' ? 1 : time_range === 'last_6h' ? 6 : 24
	const timeStart = new Date(now.getTime() - hours * 60 * 60 * 1000)

	// Sanitize limit — must be a positive integer, capped at 1000
	const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 1000)

	// Whitelist allowed status values to prevent SQL injection
	const ALLOWED_STATUSES = ['answered', 'failed', 'busy', 'no-answer', 'cancelled']
	const safeStatus = status && ALLOWED_STATUSES.includes(status.toLowerCase())
		? status.toLowerCase()
		: null

	if (status && !safeStatus) {
		return { success: false, error: `Invalid status value. Allowed: ${ALLOWED_STATUSES.join(', ')}` }
	}

	// Build SQL — dates from toISOString() and digits-only phone_number are safe
	let sql = `SELECT * FROM cdr.cdr WHERE dt >= '${timeStart.toISOString()}' AND dt <= '${now.toISOString()}'`

	if (phone_number) {
		const clean = phone_number.replace(/\D/g, '')
		sql += ` AND (src_number LIKE '%${clean}%' OR dest_number LIKE '%${clean}%')`
	}

	if (safeStatus) {
		sql += ` AND status = '${safeStatus}'`
	}

	sql += ` ORDER BY dt DESC LIMIT ${safeLimit}`

	const results = await executeSQL(sql)

	return {
		success: true,
		count: results.length,
		calls: results,
		query: sql
	}
}

export function main (data) {
	// Test investigate calls with default params
	return investigateCalls(data || {})
}
