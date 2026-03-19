/**
 * Test for getCustomerProfitability functionality
 */

import { discoverCustomerId } from './searchCustomer'
import { getCustomerProfitability } from './listCustomersByProfitability'
import { getDateRange } from './callDebugTools'

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

    if (!result || result.success === false) {
      return {
        tool: 'get_customer_profitability',
        status: 'FAIL',
        error: result.error || 'getCustomerProfitability returned an error',
        customer_id: customerId
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'
    if (!tableValid) {
      return {
        tool: 'get_customer_profitability',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    return {
      tool: 'get_customer_profitability',
      status: 'PASS',
      customer_id: customerId,
      date_range: result.date_range || (start + ' to ' + end),
      total_records: result.total,
      has_metrics: result.metrics !== undefined,
      table_rows: result.rows.length,
      table_columns: result.columns,
      response_keys: Object.keys(result).slice(0, 8)
    }

  } catch (error) {
    return {
      tool: 'get_customer_profitability',
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
  return await testCustomerProfitability()
}
