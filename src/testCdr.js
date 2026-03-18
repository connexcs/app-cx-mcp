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

    if (!result || !result.success) {
      return {
        tool: 'search_cdr',
        status: 'FAIL',
        error: (result && result.error) || 'searchCdrHandler returned success: false'
      }
    }

    const cdrArray = result.records || []

    const tableValid = cdrArray.length > 0
      ? (result._table !== null && result._table !== undefined
         && Array.isArray(result._table.rows) && result._table.rows.length > 0
         && Array.isArray(result._table.columns)
         && typeof result._table.total === 'number')
      : result._table === null

    if (!tableValid) {
      return {
        tool: 'search_cdr',
        status: 'FAIL',
        error: cdrArray.length > 0
          ? '_table missing or malformed when records exist'
          : '_table should be null when no records',
        has_table: !!result._table,
        table_shape: result._table
      }
    }

    return {
      tool: 'search_cdr',
      status: 'PASS',
      result_count: cdrArray.length,
      table_rows: result._table ? result._table.rows.length : 0,
      table_columns: result._table ? result._table.columns : [],
      message: cdrArray.length > 0
        ? `Found ${cdrArray.length} CDR records in last 30 days`
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
