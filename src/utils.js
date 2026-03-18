/**
 * Shared table response builder for MCP tools.
 * Adds a standardised _table shape so the ConnexCS frontend Chat-Data-Table
 * component can render tool results as an inline grid.
 *
 * @param {any} rows - Must be a non-empty array of objects.
 * @param {Object} [options]
 * @param {string[]} [options.columns] - Ordered column list. Defaults to
 *   Object.keys(rows[0]) minus the DEFAULT_EXCLUDE set.
 * @param {number} [options.total] - Total count. Defaults to rows.length.
 * @param {string[]} [options.exclude] - Additional field names to omit from
 *   auto-derived columns.
 * @returns {{ rows: object[], columns: string[], total: number } | null}
 *   Returns null for empty / non-array input.
 */
export function buildTableResponse (rows, options = {}) {
	if (!Array.isArray(rows) || rows.length === 0) return null

	const DEFAULT_EXCLUDE = new Set([
		'success', 'message', 'error', 'warning',
		'matchType', 'suggestions', 'search_term', 'filters_applied'
	])

	const excludeSet = new Set([
		...DEFAULT_EXCLUDE,
		...(options.exclude || [])
	])

	const columns = options.columns
		|| Object.keys(rows[0]).filter(k => !excludeSet.has(k))

	const total = options.total !== undefined ? options.total : rows.length

	// Project only the column keys into new plain objects.
	// This breaks object identity (prevents MCP serialiser circular-ref markers)
	// and ensures only renderable scalar/primitive values reach the frontend.
	const projectedRows = rows.map(r => {
		const out = {}
		for (const col of columns) {
			const val = r[col]
			out[col] = (val !== null && typeof val === 'object') ? JSON.stringify(val) : val
		}
		return out
	})

	return { rows: projectedRows, columns, total }
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
