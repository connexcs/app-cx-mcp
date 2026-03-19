/**
 * Test for listCustomersByProfitability functionality
 */

import { listCustomersByProfitability } from './listCustomersByProfitability'

/**
 * Tests the listCustomersByProfitability function
 * @returns {Promise<Object>} Test result
 */
export async function testListCustomersByProfitability () {
  try {
    const result = await listCustomersByProfitability({
      sort_by: 'total_profit',
      sort_order: 'desc',
      limit: 5
    })

    if (!result || result.success === false) {
      return {
        tool: 'list_customers_by_profitability',
        status: 'FAIL',
        error: (result && result.error) || 'listCustomersByProfitability returned an error'
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'
    if (!tableValid) {
      return {
        tool: 'list_customers_by_profitability',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    return {
      tool: 'list_customers_by_profitability',
      status: 'PASS',
      customer_count: result.rows.length,
      has_data: result.rows.length > 0,
      sort_by: 'total_profit',
      table_rows: result.rows.length,
      table_columns: result.columns,
      note: result.rows.length === 0 ? 'No data returned (may be expected for this account)' : 'Customers ranked by profit returned'
    }

  } catch (error) {
    return {
      tool: 'list_customers_by_profitability',
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
  return await testListCustomersByProfitability()
}
