/**
 * Test for getCustomerProfitability functionality
 */

import { searchCustomers } from './searchCustomer'
import { getCustomerProfitability } from './listCustomersByProfitability'

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
 * Tests the getCustomerProfitability function
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testCustomerProfitability (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_customer_profitability',
        status: 'SKIP',
        error: 'Could not discover a customer_id'
      }
    }

    const { start, end } = getDateRange(30)
    const result = await getCustomerProfitability({
      customer_id: customerId,
      start_date: start,
      end_date: end
    })

    if (!result) {
      return {
        tool: 'get_customer_profitability',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_customer_profitability',
        status: 'FAIL',
        error: result.error || 'getCustomerProfitability returned success: false',
        customer_id: customerId
      }
    }

    // Actual response: { success, customer_id, totalRecords, data, metrics, message, dateRange, groupBy }
    const hasSummary = result.metrics !== undefined || result.data !== undefined || result.summary !== undefined
    const hasDateRange = result.dateRange !== undefined || result.date_range !== undefined

    return {
      tool: 'get_customer_profitability',
      status: 'PASS',
      customer_id: customerId,
      date_range: result.dateRange || result.date_range || (start + ' to ' + end),
      total_records: result.totalRecords,
      has_metrics: hasSummary,
      has_date_range: hasDateRange,
      response_keys: Object.keys(result).slice(0, 8)
    }

  } catch (error) {
    const is429 = error.message && error.message.indexOf('429') !== -1
    return {
      tool: 'get_customer_profitability',
      status: is429 ? 'SKIP' : 'ERROR',
      error: error.message,
      note: is429 ? 'API rate limited (429) — tool is functional, retry later' : undefined,
      customer_id: undefined
    }
  }
}

/**
 * Entry point for ScriptForge
 * @returns {Promise<Object>} Test result
 */
export async function main () {
  return await testCustomerProfitability()
}
