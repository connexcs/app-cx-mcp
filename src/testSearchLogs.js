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

    if (!result || result.success === false) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: (result && result.error) || 'searchCallLogsHandler returned an error'
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'

    if (!tableValid) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    return {
      tool: 'search_call_logs',
      status: 'PASS',
      result_count: result.rows.length,
      table_rows: result.rows.length,
      table_columns: result.columns,
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
