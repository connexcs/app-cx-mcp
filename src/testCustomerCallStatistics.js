/**
 * Test for getCustomerCallStatistics functionality
 */

import { discoverCustomerId } from './searchCustomer'
import { getCustomerCallStatistics } from './connexcsCustomerStats'
import { getDateRange } from './callDebugTools'

/**
 * Tests the getCustomerCallStatistics function
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testCustomerCallStatistics (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_customer_call_statistics',
        status: 'SKIP',
        error: 'Could not discover a customer_id'
      }
    }

    const { start, end } = getDateRange(30)
    const result = await getCustomerCallStatistics({
      company_id: customerId,
      start_date: start,
      end_date: end
    })

    if (!result || result.success === false) {
      return {
        tool: 'get_customer_call_statistics',
        status: 'FAIL',
        error: (result && result.error) || 'getCustomerCallStatistics returned an error',
        customer_id: customerId
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'
    const stats = result.statistics || {}

    return {
      tool: 'get_customer_call_statistics',
      status: tableValid ? 'PASS' : 'FAIL',
      customer_id: customerId,
      date_range: result.date_range || (start + ' to ' + end),
      has_statistics_object: result.statistics !== undefined,
      has_attempts_field: stats.attempts !== undefined || stats.total_attempts !== undefined,
      has_asr_field: stats.asr !== undefined || stats.answer_seizure_ratio !== undefined,
      table_rows: Array.isArray(result.rows) ? result.rows.length : 0,
      table_columns: result.columns || [],
      response_keys: Object.keys(result).slice(0, 8),
      error: tableValid ? undefined : 'Response missing rows/columns/total'
    }

  } catch (error) {
    return {
      tool: 'get_customer_call_statistics',
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
  return await testCustomerCallStatistics()
}
