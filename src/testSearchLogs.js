/**
 * Test for searchCallLogs functionality
 */

import { searchCdr, searchCallLogsHandler, getDateRange } from './callDebugTools'

/**
 * Tests the searchCallLogs function
 * @returns {Promise<Object>} Test result
 */
export async function testSearchLogs () {
  try {
    // Discover a real callid dynamically via CDR (last 3 days)
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'search_call_logs',
        status: 'SKIP',
        error: 'No CDR records found in last 3 days to derive a search term'
      }
    }

    // Use the callid from the most recent CDR record as the search term
    const searchTerm = cdrResults[0].callid
    if (!searchTerm) {
      return {
        tool: 'search_call_logs',
        status: 'SKIP',
        error: 'CDR record has no callid field'
      }
    }

    const result = await searchCallLogsHandler({ search: searchTerm })

    if (!result || !result.success) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: (result && result.error) || 'searchCallLogsHandler returned success: false'
      }
    }

    const callArray = result.calls || []
    const tableValid = callArray.length > 0
      ? (result._table !== null && result._table !== undefined
         && Array.isArray(result._table.rows) && result._table.rows.length > 0
         && Array.isArray(result._table.columns)
         && typeof result._table.total === 'number')
      : result._table === null

    if (!tableValid) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: callArray.length > 0
          ? '_table missing or malformed when results exist'
          : '_table should be null when no results',
        has_table: !!result._table,
        table_shape: result._table
      }
    }

    return {
      tool: 'search_call_logs',
      status: 'PASS',
      result_count: callArray.length,
      table_rows: result._table ? result._table.rows.length : 0,
      table_columns: result._table ? result._table.columns : [],
      search_term: searchTerm
    }
    
  } catch (error) {
    return {
      tool: 'search_call_logs',
      status: 'ERROR',
      error: error.message
    }
  }
}

/**
 * Entry point for ScriptForge
 * @returns {Promise<Object>} Test result
 */
export async function main () {
  return await testSearchLogs()
}
