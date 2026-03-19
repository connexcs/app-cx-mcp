/**
 * Test CDR Search - Standalone Version
 * Run: cx run testCdr
 */

import { searchCdrHandler, getDateRange } from './callDebugTools'

/**
 * Standalone CDR test with direct API call
 * @returns {Promise<Object>} Test result
 */
export async function testCdr () {
  try {
    const { start, end } = getDateRange(30)

    const result = await searchCdrHandler({ start_date: start, end_date: end, limit: 1000 })

    if (!result || result.success === false) {
      return {
        tool: 'search_cdr',
        status: 'FAIL',
        error: (result && result.error) || 'searchCdrHandler returned an error'
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'

    if (!tableValid) {
      return {
        tool: 'search_cdr',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    return {
      tool: 'search_cdr',
      status: 'PASS',
      result_count: result.rows.length,
      table_rows: result.rows.length,
      table_columns: result.columns,
      message: result.rows.length > 0
        ? `Found ${result.rows.length} CDR records in last 30 days`
        : 'No completed calls found in last 30 days'
    }
  } catch (error) {
    return {
      tool: 'search_cdr',
      status: 'FAIL',
      error: error.message
    }
  }
}

/**
 * Main entry point for ScriptForge
 */
export async function main () {
  return await testCdr()
}
