/**
 * Test Call Analytics Tool
 * 
 * Tests the getCallAnalytics function which compares failed vs successful calls.
 * 
 * Run with: cx run testCallAnalytics
 */

import { getCallAnalyticsHandler, getDateRange } from './callDebugTools'

/**
 * Test the call analytics function
 * @returns {Promise<Object>} Test results
 */
export async function testCallAnalytics () {
  try {
    // Use dynamic date range (last 2 days) — no hardcoded numbers or dates
    const { start, end } = getDateRange(2)
    const result = await getCallAnalyticsHandler({ start_date: start, end_date: end })

    if (!result) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: result.error || 'Analytics returned success: false'
      }
    }

    if (!result.summary) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: 'Result missing summary field'
      }
    }

    // _table uses top_failure_reasons — null is valid when no failures were logged
    const failures = result.top_failure_reasons || []
    const tableValid = failures.length > 0
      ? (result._table !== null && result._table !== undefined
         && Array.isArray(result._table.rows) && result._table.rows.length > 0
         && Array.isArray(result._table.columns)
         && typeof result._table.total === 'number')
      : result._table === null

    if (!tableValid) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: failures.length > 0
          ? '_table missing or malformed when failure reasons exist'
          : '_table should be null when no failure reasons',
        has_table: !!result._table
      }
    }

    return {
      tool: 'get_call_analytics',
      status: 'PASS',
      queried_range: { start, end },
      date_range: result.date_range,
      total_attempts: result.summary.total_attempts,
      successful_calls: result.summary.successful_calls,
      failed_calls: result.summary.failed_calls,
      success_rate: result.summary.success_rate,
      table_valid: tableValid,
      table_rows: result._table ? result._table.rows.length : 0
    }
    
  } catch (error) {
    return {
      tool: 'get_call_analytics',
      status: 'ERROR',
      error: error.message
    }
  }
}

/**
 * Main entry point
 * @returns {Promise<Object>} Test results
 */
export async function main () {
  return await testCallAnalytics()
}
