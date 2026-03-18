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

    if (!result) {
      return {
        tool: 'get_customer_destination_statistics',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_customer_destination_statistics',
        status: 'FAIL',
        error: result.error || 'getCustomerDestinationStatistics returned success: false',
        customer_id: customerId
      }
    }

    const destinations = result.destinations || []
    const hasSummary = result.summary !== undefined
    const isArray = Array.isArray(destinations)

    // _table must be valid when destinations exist, null when empty
    const tableValid = destinations.length > 0
      ? (result._table !== null && result._table !== undefined
         && Array.isArray(result._table.rows) && result._table.rows.length > 0
         && Array.isArray(result._table.columns)
         && typeof result._table.total === 'number')
      : result._table === null

    if (!tableValid) {
      return {
        tool: 'get_customer_destination_statistics',
        status: 'FAIL',
        error: destinations.length > 0
          ? '_table missing or malformed when destinations exist'
          : '_table should be null when no destinations',
        has_table: !!result._table
      }
    }

    return {
      tool: 'get_customer_destination_statistics',
      status: 'PASS',
      customer_id: customerId,
      date_range: start + ' to ' + end,
      destination_count: destinations.length,
      has_destinations_array: isArray,
      has_summary: hasSummary,
      table_rows: result._table ? result._table.rows.length : 0,
      table_columns: result._table ? result._table.columns : [],
      note: destinations.length === 0 ? 'No destination data (may be no calls in range)' : 'Destinations returned'
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
