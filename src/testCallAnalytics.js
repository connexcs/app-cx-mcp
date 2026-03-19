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

    if (result.success === false) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: result.error || 'Analytics returned an error'
      }
    }

    if (!result.summary) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: 'Result missing summary field'
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'

    if (!tableValid) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
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
      table_rows: result.rows.length
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
