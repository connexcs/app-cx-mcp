/**
 * Test for getCustomerDestinationStatistics functionality
 */

import { searchCustomers } from './searchCustomer'
import { getCustomerDestinationStatistics } from './connexcsDestinationStats'

/**
 * Returns a { start, end } date range string for the last N days (UTC, YYYY-MM-DD)
 * @param {number} daysBack
 * @returns {{ start: string, end: string }}
 */
function getDateRange (daysBack) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return { start, end }
}

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
      // 429 = rate limited — the tool works, API is throttling; treat as SKIP
      const is429 = result.error && result.error.indexOf('429') !== -1
      return {
        tool: 'get_customer_destination_statistics',
        status: is429 ? 'SKIP' : 'FAIL',
        error: result.error || 'getCustomerDestinationStatistics returned success: false',
        customer_id: customerId,
        note: is429 ? 'API rate limited (429) — tool is functional, retry later' : undefined
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
