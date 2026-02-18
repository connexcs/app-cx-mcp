/**
 * Test Call Debug Functions
 * Direct function testing without MCP wrapper
 */

import cxRest from 'cxRest'

const API_USERNAME = 'csiamunyanga@connexcs.com'

export async function executeSQL (sql) {
	// Execute SQL query via cxRest API
	const result = await cxRest.auth(API_USERNAME).post('setup/query/0/run', {
		_query: sql,
		_src: 'cdr'
	})
	
	return result
}

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
	
	// Build SQL
	let sql = `SELECT * FROM cdr.cdr WHERE dt >= '${timeStart.toISOString()}' AND dt <= '${now.toISOString()}'`
	
	if (phone_number) {
		const clean = phone_number.replace(/\D/g, '')
		sql += ` AND (src_number LIKE '%${clean}%' OR dest_number LIKE '%${clean}%')`
	}
	
	if (status) {
		sql += ` AND status = '${status}'`
	}
	
	sql += ` ORDER BY dt DESC LIMIT ${limit}`
	
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
