/**
 * Test for getCustomerDestinationStatistics functionality
 */

import { discoverCustomerId } from './searchCustomer'
import { getCustomerDestinationStatistics } from './connexcsDestinationStats'
import { getDateRange } from './callDebugTools'

/**
 * Tests the getCustomerDestinationStatistics function
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testCustomerDestinationStatistics (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_customer_destination_statistics',
        status: 'SKIP',
        error: 'Could not discover a customer_id'
      }
    }

    const { start, end } = getDateRange(30)
    const result = await getCustomerDestinationStatistics({
      customer_id: customerId,
      start_date: start,
      end_date: end,
      limit: 10
    })

    if (!result || result.success === false) {
      return {
        tool: 'get_customer_destination_statistics',
        status: 'FAIL',
        error: (result && result.error) || 'getCustomerDestinationStatistics returned an error',
        customer_id: customerId
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'
    if (!tableValid) {
      return {
        tool: 'get_customer_destination_statistics',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    return {
      tool: 'get_customer_destination_statistics',
      status: 'PASS',
      customer_id: customerId,
      date_range: result.date_range || (start + ' to ' + end),
      destination_count: result.rows.length,
      has_summary: result.summary !== undefined,
      table_rows: result.rows.length,
      table_columns: result.columns,
      note: result.rows.length === 0 ? 'No destination data (may be no calls in range)' : 'Destinations returned'
    }

  } catch (error) {
    return {
      tool: 'get_customer_destination_statistics',
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
  return await testCustomerDestinationStatistics()
}
