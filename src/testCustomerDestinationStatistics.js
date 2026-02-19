/**
 * Test for getCustomerDestinationStatistics functionality
 */

import { searchCustomers } from './searchCustomer'
import { getCustomerDestinationStatistics } from './connexcsDestinationStats'
import { getDateRange } from './callDebugTools'

/**
 * Discovers a live customer_id via searchCustomers
 * @returns {Promise<string|null>} customer_id or null
 */
async function discoverCustomerId () {
  const result = await searchCustomers({ query: 'test', search_type: 'name', limit: 5 })
  const customers = (result && (result.customers || result.matches)) || []
  if (customers.length === 0) return null
  return String(customers[0].id)
}

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

    return {
      tool: 'get_customer_destination_statistics',
      status: 'PASS',
      customer_id: customerId,
      date_range: start + ' to ' + end,
      destination_count: destinations.length,
      has_destinations_array: isArray,
      has_summary: hasSummary,
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
