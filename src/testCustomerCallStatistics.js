/**
 * Test for getCustomerCallStatistics functionality
 */

import { searchCustomers } from './searchCustomer'
import { getCustomerCallStatistics } from './connexcsCustomerStats'

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

    if (!result) {
      return {
        tool: 'get_customer_call_statistics',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_customer_call_statistics',
        status: 'FAIL',
        error: result.error || 'getCustomerCallStatistics returned success: false',
        customer_id: customerId
      }
    }

    // Actual response shape: { success, company_id, period, statistics: { ... } }
    const hasStatistics = result.statistics !== undefined
    const hasPeriod = result.period !== undefined
    const stats = result.statistics || {}
    const hasAttempts = stats.attempts !== undefined || stats.total_attempts !== undefined
    const hasAsr = stats.asr !== undefined || stats.answer_seizure_ratio !== undefined

    return {
      tool: 'get_customer_call_statistics',
      status: 'PASS',
      customer_id: customerId,
      date_range: start + ' to ' + end,
      has_statistics_object: hasStatistics,
      has_period: hasPeriod,
      has_attempts_field: hasAttempts,
      has_asr_field: hasAsr,
      response_keys: Object.keys(result).slice(0, 8)
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
