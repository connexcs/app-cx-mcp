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

    if (!result) {
      return {
        tool: 'list_customers_by_profitability',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'list_customers_by_profitability',
        status: 'FAIL',
        error: result.error || 'listCustomersByProfitability returned success: false'
      }
    }

    // Result may use different array field names
    const customers = result.customers || result.data || result.results || []
    const isArray = Array.isArray(customers)

    if (!isArray) {
      return {
        tool: 'list_customers_by_profitability',
        status: 'FAIL',
        error: 'Response does not contain a customer array',
        response_keys: Object.keys(result)
      }
    }

    // _table must be valid when customers exist, null when empty
    const tableValid = customers.length > 0
      ? (result._table !== null && result._table !== undefined
         && Array.isArray(result._table.rows) && result._table.rows.length > 0
         && Array.isArray(result._table.columns)
         && typeof result._table.total === 'number')
      : result._table === null

    if (!tableValid) {
      return {
        tool: 'list_customers_by_profitability',
        status: 'FAIL',
        error: customers.length > 0
          ? '_table missing or malformed when customers exist'
          : '_table should be null when no customers',
        has_table: !!result._table
      }
    }

    return {
      tool: 'list_customers_by_profitability',
      status: 'PASS',
      customer_count: customers.length,
      has_data: customers.length > 0,
      sort_by: 'total_profit',
      table_rows: result._table ? result._table.rows.length : 0,
      table_columns: result._table ? result._table.columns : [],
      note: customers.length === 0 ? 'No data returned (may be expected for this account)' : 'Customers ranked by profit returned'
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
