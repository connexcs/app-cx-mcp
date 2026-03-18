---
applyTo: '**'
---

# MCP Response Format — `_table` Standardisation

> **Living document — self-contained.** Tick checkboxes as tasks are completed.
> This file is written to be passed to the AI agent on the `connexcs/app-cx-mcp` repository.
> Last reviewed: 2026-03-18

---

## Context & Goal

The ConnexCS frontend chat (`Chat-Data-Table.vue`) renders MCP tool results as inline grids.
It expects a standardised `_table` property on any tool response that contains tabular data.

**Frontend expects** (from `structuredContentDetector.ts`):
```json
{
  "rows": [ { "callid": "...", "duration": 120 } ],
  "columns": ["callid", "dest_cli", "dest_number", "duration"],
  "total": 1532
}
```

**Problem:** The 23 tools in this repo return arrays under 10+ different property names
(`calls`, `records`, `servers`, `packages`, `rateCards`, `rules`, `customers`,
`destinations`, `groups`, `logs`…). There is no shared format.

**Solution — additive `_table` property:** Add `_table: { rows, columns, total }` alongside
all existing fields in each tool response. Existing response shapes are **not changed** —
no breaking changes.

```js
// BEFORE
return {
	success: true,
	result_count: 42,
	calls: callArray,
	message: '...'
}

// AFTER
return {
	success: true,
	result_count: 42,
	calls: callArray,
	message: '...',
	_table: buildTableResponse(callArray)   // ← new, additive only
}
```

The frontend detects `_table` first and falls back to heuristic array scanning for any
tool not yet updated.

---

## Repository Structure Note

This repo has a **flat `src/` directory** — no subdirectories under `src/`.
All source files are `src/*.js` or `src/*.ts`.

---

## Phase 1 — Shared Utility

### Task 1.1 — Create `src/utils.js`

- [x] Create `src/utils.js` with `buildTableResponse()` and `breakdownMapToRows()`

```js
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

	return { rows, columns, total }
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
```

---

## Phase 2 — Flat Array Tools (8 tools — highest priority)

These tools already return a flat array of objects. Add `_table` by passing that array
directly to `buildTableResponse()`.

> **Import line to add at the top of each file:**
> `import { buildTableResponse } from './utils'`

---

### Task 2.1 — `src/callDebugTools.js` — `searchCallLogsHandler`

- [x] Add import at top of file (shared with tasks 2.2–2.5, 4.1–4.4 in this file)
- [x] Add `_table` to the success return object

```js
// In searchCallLogsHandler — success return
return {
	success: true,
	result_count: callArray.length,
	calls: callArray,
	search_term: search,
	message: callArray.length > 0 ? `...` : `...`,
	_table: buildTableResponse(callArray, {
		columns: ['callid', 'callidb', 'dest_cli', 'dest_number', 'source_cli', 'sip_code', 'sip_reason']
	})
}
```

---

### Task 2.2 — `src/callDebugTools.js` — `searchCdrHandler`

- [x] Add `_table` to the success return object

```js
// In searchCdrHandler — success return
return {
	success: true,
	date_range: dateRange,
	result_count: cdrArray.length,
	filters_applied: filters,
	records: cdrArray,
	message: `...`,
	_table: buildTableResponse(cdrArray, {
		columns: ['dt', 'callid', 'dest_cli', 'dest_number', 'duration', 'customer_id', 'customer_charge', 'provider_id', 'provider_charge', 'branch_idx']
	})
}
```

> **Note:** `sip_code` is NOT in the CDR default fields list (`searchCdr` requests
> `dt, callid, dest_cli, dest_number, duration, customer_id, customer_charge,
> customer_card_currency, provider_id, provider_charge, provider_card_currency, branch_idx`).
> Do not include columns that are not present in the returned data.

---

### Task 2.3 — `src/callDebugTools.js` — `getRtpServerGroupsHandler`

- [x] Add `_table` to the success return object

```js
// In getRtpServerGroupsHandler — success return
return {
	success: true,
	group_count: groupArray.length,
	groups: groupArray,
	summary: `...`,
	_table: buildTableResponse(groupArray)
}
```

---

### Task 2.4 — `src/callDebugTools.js` — `getAiAgentLogsHandler`

- [x] Add `_table` to the success return object

```js
// In getAiAgentLogsHandler — success return
return {
	success: true,
	callid,
	date,
	has_ai_agent: logArray.length > 0,
	log_count: logArray.length,
	logs: logArray,
	message: `...`,
	_table: buildTableResponse(logArray)
}
```

---

### Task 2.5 — `src/listRtpServers.js` — `listRTPServers`

- [x] Add import at top of file
- [x] Add `_table` to the success return object

```js
// In listRTPServers — success return
return {
	success: true,
	totalFound: filteredServers.length,
	servers: filteredServers,
	allServersCount: servers.length,
	message,
	filters: appliedFilters,
	_table: buildTableResponse(filteredServers, {
		columns: ['id', 'alias', 'zone', 'ip', 'port', 'type', 'status']
	})
}
```

---

### Task 2.6 — `src/package.js` — `getCustomerPackages`

- [x] Add import at top of file
- [x] Add `_table` to the success return object

```js
// In getCustomerPackages — success return
return {
	success: true,
	customerId,
	type,
	totalPackages: enrichedPackages.length,
	packages: enrichedPackages,
	message,
	_table: buildTableResponse(enrichedPackages, {
		columns: ['id', 'name', 'type', 'retail', 'setup_retail', 'minutes', 'minutes_used', 'remaining_minutes', 'frequency', 'start_date']
	})
}
```

---

### Task 2.7 — `src/rateCard.js` — `getCustomerRateCards`

- [x] Add import at top of file
- [x] Add `_table` to the success return object

```js
// In getCustomerRateCards — success return
return {
	success: true,
	matchType: 'exact',
	customerId: trimmedCustomerId,
	totalRateCards: enrichedRateCards.length,
	rateCards: enrichedRateCards,
	message: `...`,
	_table: buildTableResponse(enrichedRateCards)
}
```

---

### Task 2.8 — `src/rateCard.js` — `getRateCardRules`

- [x] Add `_table` to the success return object (import already added for task 2.7)

```js
// In getRateCardRules — success return
return {
	success: true,
	rateCardId: trimmedRateCardId,
	activeRev: trimmedRevision,
	totalRules: rules.length,
	rules: rules,
	pagination: { limit: validLimit, offset: validOffset, total: rules.length },
	message: `...`,
	_table: buildTableResponse(rules, {
		total: rules.length,
		columns: ['prefix', 'destination', 'rate', 'con_cost', 'min_inc', 'min_duration', 'pulse', 'active']
	})
}
```

---

## Phase 3 — Analytics & Ranking Tools (5 tools — medium priority)

These tools return enriched arrays. Add `_table` with an explicit `columns` list to control
display order and exclude internal aggregation fields.

---

### Task 3.1 — `src/listCustomersByProfitability.js` — `getCustomerProfitability`

- [x] Add import at top of file (shared with task 3.2)
- [x] Add `_table` to the success return object

```js
// In getCustomerProfitability — success return (enrichedData is the array)
return {
	success: true,
	customer_id,
	totalRecords: enrichedData.length,
	data: enrichedData,
	metrics: { ... },
	dateRange: { start: queryStartDate, end: queryEndDate },
	groupBy: group_by || 'none',
	_table: buildTableResponse(enrichedData, {
		columns: [
			'customer_id', 'dt', 'attempts', 'connected', 'duration',
			'customer_duration', 'acd', 'asr', 'total_revenue', 'total_cost',
			'total_profit', 'account_profit_percent'
		]
	})
}
```

---

### Task 3.2 — `src/listCustomersByProfitability.js` — `listCustomersByProfitability`

- [x] Add `_table` to the success return object

```js
// In listCustomersByProfitability — success return (paginatedCustomers is the array)
return {
	success: true,
	totalRecords: customers.length,
	returnedRecords: paginatedCustomers.length,
	customers: paginatedCustomers,
	summary: { ... },
	pagination: { ... },
	sortBy: sort_by,
	sortOrder: sort_order,
	dateRange: { start: queryStartDate, end: queryEndDate },
	_table: buildTableResponse(paginatedCustomers, {
		total: customers.length,
		columns: [
			'customer_id', 'attempts', 'connected', 'customer_duration',
			'total_revenue', 'total_cost', 'total_profit', 'profit_margin', 'asr', 'acd'
		]
	})
}
```

---

### Task 3.3 — `src/connexcsDestinationStats.js` — `getCustomerDestinationStatistics`

- [x] Add import at top of file
- [x] Add `_table` to the success return object

```js
// In getCustomerDestinationStatistics — success return
return {
	success: true,
	customer_id: customerId,
	start_date: startDate,
	end_date: endDate,
	summary: processedData.summary,
	destinations: processedData.destinations,
	_table: buildTableResponse(processedData.destinations, {
		columns: [
			'destination', 'attempts', 'connected', 'failed', 'asr',
			'duration', 'acd', 'customer_charge', 'provider_charge', 'profit', 'profit_percent'
		]
	})
}
```

---

### Task 3.4 — `src/searchDocumentation.js` — `searchDocumentation`

- [x] Add import at top of file
- [x] Add `_table` to the data object returned in the success response

The result shape here is `{ status, data: { results: [...] } }`. Add `_table` inside `data`:

```js
// In searchDocumentation — success return (limitedResults is the results array)
return {
	status: results.success ? 'success' : 'error',
	data: {
		...results,
		_table: buildTableResponse(results.results || [], {
			columns: ['title', 'public_url', 'link']
		})
	}
}
```

---

### Task 3.5 — `src/searchCustomer.js` — `searchCustomers` wrapper

- [x] Add import at top of file
- [x] In `searchCustomers` wrapper — add `_table` **after** applying the limit, for both
  name and IP search types
- [x] Do NOT add `_table` to `searchById` (returns single record, not a list)

> **Why the wrapper?** The `searchCustomers` wrapper applies a `limit` that
> truncates `results.customers`. Adding `_table` in the individual search functions
> (`searchByName`, `searchByIp`) would cause `_table.rows` to reference the
> pre-truncated array, creating a mismatch. Adding `_table` in the wrapper after
> truncation keeps everything consistent.

> **Gap:** `searchBySipUser` partial matches also return an array (`matches`)
> but are not yet covered. Consider adding `_table` for this case in v2.

```js
// In searchCustomers — after applying limit, before final return

// For name-based searches (customers is a flat array of customer objects)
if (finalSearchType === 'name' && results.customers && Array.isArray(results.customers)) {
	results._table = buildTableResponse(results.customers, {
		columns: ['id', 'name', 'email', 'status', 'currency', 'credit', 'debit_limit']
	})
}

// For IP-based searches (customers is array of { ipEntry, customer } — flatten for table)
if (finalSearchType === 'ips' && results.customers && Array.isArray(results.customers)) {
	const customerRows = results.customers.map(c => ({ ...c.customer, matched_ip: c.ipEntry?.ip }))
	results._table = buildTableResponse(customerRows, {
		columns: ['id', 'name', 'email', 'status', 'matched_ip', 'currency', 'credit']
	})
}

return { ...results, search_type: finalSearchType, query }
```

---

## Phase 4 — Complex / Multi-Section Tools (4 tools — lower priority)

These tools have complex nested or multi-array responses. Add `_table` pointing to the
**single most useful renderable section** for v1. Use `breakdownMapToRows()` where needed.

> **Import line to add** (where not already added):
> `import { buildTableResponse, breakdownMapToRows } from './utils'`

---

### Task 4.1 — `src/callDebugTools.js` — `getCallAnalyticsHandler`

- [x] Import already added (task 2.1)
- [x] Add `_table` using `top_failure_reasons` as the primary data array

`top_failure_reasons` already has shape `[{ error, count, percentage }]` — flat and directly renderable.

> **Note:** `getCallAnalyticsHandler` delegates to `getCallAnalytics()` and returns
> the result directly (`return analytics`). Add `_table` in the handler by mutating
> the returned object before returning — consistent with the Task 4.4 pattern.

```js
// In getCallAnalyticsHandler — after getting analytics, before return
const analytics = await getCallAnalytics(start_date, end_date, filters)
analytics._table = buildTableResponse(analytics.top_failure_reasons || [], {
	columns: ['error', 'count', 'percentage']
})
return analytics
```

---

### Task 4.2 — `src/callDebugTools.js` — `getSipTraceHandler`

- [x] Import already added (task 2.1)
- [x] Add `_table` using `analysis.call_flow` as the primary data array

```js
// In getSipTraceHandler — success return, after const analysis = analyzeSipTrace(messages)
return {
	success: true,
	callid,
	analysis,
	raw_message_count: messages.length,
	raw_messages: messages,
	_table: buildTableResponse(analysis.call_flow || [], {
		columns: ['time', 'label', 'from_user', 'to_user', 'from', 'to', 'protocol', 'delta_ms']
	})
}
```

---

### Task 4.3 — `src/connexcsCustomerStats.js` — `getCustomerCallStatistics`

- [x] Add import at top of file (needs both `buildTableResponse` and `breakdownMapToRows`)
- [x] Convert `statistics.destination_breakdown` map to an array of rows
- [x] Add `_table` to the success return object

```js
// In getCustomerCallStatistics — success return
// Convert destination breakdown map to rows for _table
const destinationRows = breakdownMapToRows(statistics.destination_breakdown, 'destination')

return {
	success: true,
	company_id: id,
	period: { start: ..., end: ... },
	statistics: statistics,
	_table: buildTableResponse(destinationRows, {
		columns: ['destination', 'calls', 'duration', 'cost']
	})
}
```

---

### Task 4.4 — `src/callDebugTools.js` — `investigateCallHandler`

- [x] Import already added (task 2.1)
- [x] Add `_table` to the return object using `trace.analysis.call_flow` when available
- [x] Fall back to `null` (buildTableResponse returns null on empty input, which is fine)

```js
// In investigateCallHandler — at the end of the function, before return result
const callFlowRows = result.trace?.analysis?.call_flow || []
result._table = buildTableResponse(callFlowRows, {
	columns: ['time', 'label', 'from_user', 'to_user', 'from', 'to', 'protocol', 'delta_ms']
})

return result
```

---

## Phase 5 — No Changes Needed (7 tools)

These tools return single records or text content. No `_table` property should be added.

| Tool | Reason |
|------|--------|
| `getCallQuality` | Single summary record — not an array |
| `getTranscription` | Text / transcription content |
| `searchCustomers` → `searchById` | Single customer object |
| `getCustomerBalance` | Single balance record |
| `getLastTopup` | Single payment record |
| `getRateCardDetails` | Single rate card object |
| `getDocumentation` | Full-text article — not tabular |

---

## Phase 6 — Optional: `outputSchema` in `src/mcp.js`

Adding `outputSchema` to `mcp.addTool()` calls helps the AI model understand response
structure and generate better narration. Do this after all Phases 1–4 are done.

- [x] For each tool that now includes `_table`, add an `outputSchema` property to its
  `mcp.addTool()` call in `mcp.js` that documents the `_table` shape.

Example pattern:
```js
mcp.addTool(
	'searchCallLogs',
	'Search ConnexCS call logs ...',
	searchCallLogsHandler,
	{
		outputSchema: {
			type: 'object',
			properties: {
				_table: {
					type: 'object',
					description: 'Standardised table data for frontend grid rendering',
					properties: {
						rows: { type: 'array' },
						columns: { type: 'array', items: { type: 'string' } },
						total: { type: 'number' }
					}
				}
			}
		}
	}
)
```

> Only add `outputSchema` if the `McpServer.addTool()` API in `cxMcpServer` supports a
> 4th options argument. Check the `cxMcpServer` library signature first before doing this.

---

## Acceptance Criteria

For each modified tool, verify ALL of the following before marking the task complete:

1. **`_table` is present** on the success return — `JSON.parse(JSON.stringify(response))._table` is not `null` or `undefined` when there is data
2. **`rows` is a flat array of objects** — `Array.isArray(response._table.rows)` is `true` and `typeof response._table.rows[0] === 'object'`
3. **`columns` is an ordered string array** — `Array.isArray(response._table.columns)` is `true` and all values match actual keys in `rows[0]`
4. **`total` is a number** — `typeof response._table.total === 'number'`
5. **No metadata in columns** — `success`, `message`, `error`, `warning` do NOT appear in `_table.columns`
6. **Backward compatibility** — ALL existing response properties are still present and unchanged. Adding `_table` must be the ONLY structural change.
7. **Empty result returns null** — when the data array is empty, `buildTableResponse` returns `null` and the response contains `_table: null` (not an object with empty rows)

---

## Test Checklist

- [x] `searchCallLogs` — response has `_table` with `callid` and `duration` columns
- [x] `searchCdr` — response has `_table` with `dt`, `dest_cli`, `duration` columns
- [x] `listRtpServers` — response has `_table` with `alias` and `zone` columns
- [x] `getCustomerPackages` — response has `_table` with `name`, `retail`, `remaining_minutes` columns
- [x] `getRateCardRules` — response has `_table` with `prefix` and `rate` columns
- [x] `listCustomersByProfitability` — response has `_table` with `customer_id` and `total_profit` columns
- [x] `getCustomerDestinationStatistics` — response has `_table` with `destination` and `asr` columns
- [x] `getCallAnalytics` — response has `_table` with `error` and `count` columns (from `top_failure_reasons`)
- [x] `getCustomerCallStatistics` — response has `_table` with `destination` and `calls` columns (converted from map)
- [x] `searchCustomers` (name search) — response has `_table` with `id`, `name` columns
- [x] Empty result case — `buildTableResponse([])` returns `null`
- [x] Backward compat — existing `calls`, `records`, `servers`, etc. properties still present

---

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Additive `_table`, not restructuring responses | Avoids breaking existing consumers |
| 2 | Flat `src/utils.js` (no subdirectory) | Repository has flat `src/` — no subdirectory support |
| 3 | `_table.columns` is `string[]` (not rich objects) | Simpler for v1; labels derived on frontend via `key.replace(/_/g, ' ')` |
| 4 | Single primary table per tool | Multi-table support (`_tables: []`) deferred to v2 |
| 5 | `buildTableResponse` returns `null` for empty input | Frontend must handle `_table: null` gracefully |
| 6 | Convert breakdown maps to row arrays | Objects keyed by string are not grid-renderable |
| 7 | `_table: null` acceptable (not omitted) | Frontend checks `_table != null` before rendering |
| 8 | `searchCustomers` `_table` added in wrapper, not sub-functions | Wrapper applies `limit` truncation; adding `_table` before truncation causes row mismatch |
| 9 | `searchBySipUser` partial matches deferred to v2 | Niche case; partial matches return `{ switchUser, customer }` objects requiring flatten logic |
