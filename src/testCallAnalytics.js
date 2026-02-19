/**
 * Test Call Analytics Tool
 * 
 * Tests the getCallAnalytics function which compares failed vs successful calls.
 * 
 * Run with: cx run testCallAnalytics
 */

import { getCallAnalytics, getDateRange } from './callDebugTools'

/**
 * Test the call analytics function
 * @returns {Promise<Object>} Test results
 */
export async function testCallAnalytics () {
  try {
    // Use dynamic date range (last 2 days) — no hardcoded numbers or dates
    const { start, end } = getDateRange(2)
    const result = await getCallAnalytics(start, end, {})
    
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
    
    // Verify structure
    const hasSummary = result.summary !== undefined
    const hasDateRange = result.date_range !== undefined
    const hasSuccessfulCalls = result.summary && result.summary.successful_calls !== undefined
    const hasFailedCalls = result.summary && result.summary.failed_calls !== undefined
    
    if (!hasSummary) {
      return {
        tool: 'get_call_analytics',
        status: 'FAIL',
        error: 'Result missing summary field'
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
      success_rate: result.summary.success_rate
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
