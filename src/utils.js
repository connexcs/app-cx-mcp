/**
 * Build a standardised table result for MCP tool responses.
 *
 * Returns the top-level response object directly — rows, columns, total
 * plus optional metadata (query, message, date_range, limit).
 * No duplication: data lives in `rows` only.
 *
 * @param {any[]} rows - Array of row objects (can be empty).
 * @param {Object} [options]
 * @param {string[]} [options.columns] - Ordered column list. Defaults to Object.keys(rows[0]).
 * @param {string[]} [options.exclude] - Field names to omit from auto-derived columns.
 * @param {string} [options.query] - The API query/endpoint that produced this data.
 * @param {string} [options.message] - Human-readable summary for AI agent narration.
 * @param {Object} [options.date_range] - { start, end } if the tool uses date filtering.
 * @param {number} [options.limit] - The limit that was applied to the query.
 * @param {number} [options.total] - Total count (defaults to rows.length).
 * @returns {{ rows: object[], columns: string[], total: number, query?: string, message?: string, date_range?: Object, limit?: number }}
 */
export function buildTableResult (rows, options = {}) {
	const safeRows = Array.isArray(rows) ? rows : []

	const DEFAULT_EXCLUDE = new Set([
		'success', 'message', 'error', 'warning',
		'matchType', 'suggestions', 'search_term', 'filters_applied'
	])

	const excludeSet = new Set([
		...DEFAULT_EXCLUDE,
		...(options.exclude || [])
	])

	const columns = options.columns
		|| (safeRows.length > 0
			? Object.keys(safeRows[0]).filter(k => !excludeSet.has(k))
			: [])

	const total = options.total !== undefined ? options.total : safeRows.length

	// Project only column keys into plain objects (breaks circular refs, keeps scalars)
	const projectedRows = safeRows.map(r => {
		const out = {}
		for (const col of columns) {
			const val = r[col]
			out[col] = (val !== null && typeof val === 'object') ? JSON.stringify(val) : val
		}
		return out
	})

	const result = { rows: projectedRows, columns, total }

	if (options.query !== undefined) result.query = options.query
	if (options.message !== undefined) result.message = options.message
	if (options.date_range !== undefined) result.date_range = options.date_range
	if (options.limit !== undefined) result.limit = options.limit

	return result
}

/** @deprecated Use buildTableResult instead. Kept for backward compatibility during migration. */
export function buildTableResponse (rows, options = {}) {
	if (!Array.isArray(rows) || rows.length === 0) return null
	const result = buildTableResult(rows, options)
	return { rows: result.rows, columns: result.columns, total: result.total }
}

/**
 * Convert a breakdown map to an array of flat row objects.
 * e.g. { "UK": { calls: 5, duration: 120 } }
 *   → [{ destination: "UK", calls: 5, duration: 120 }]
 *
 * @param {Object} map - The breakdown map to convert.
 * @param {string} [keyField='key'] - Name for the key column.
 * @returns {object[]} Array of flat row objects, or [] for invalid input.
 */
export function breakdownMapToRows (map, keyField = 'key') {
	if (!map || typeof map !== 'object' || Array.isArray(map)) return []
	return Object.entries(map).map(([k, v]) => ({
		[keyField]: k,
		...(v && typeof v === 'object' ? v : { value: v })
	}))
}
