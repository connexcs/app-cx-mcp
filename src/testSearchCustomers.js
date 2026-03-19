/**
 * Test for searchCustomers functionality
 */

import { searchCustomers } from './searchCustomer'

/**
 * Tests the searchCustomers function — searches by name
 * Returns the first discovered customer_id for use in downstream tests
 * @returns {Promise<Object>} Test result
 */
export async function testSearchCustomers () {
  try {
    const result = await searchCustomers({ query: 'test', search_type: 'name', limit: 5 })

    if (!result || result.success === false) {
      return {
        tool: 'search_customers',
        status: 'FAIL',
        error: (result && result.error) || 'searchCustomers returned an error'
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'
    if (!tableValid) {
      return {
        tool: 'search_customers',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    if (result.rows.length === 0) {
      return {
        tool: 'search_customers',
        status: 'SKIP',
        error: 'No customers found matching "test" — try a different search term',
        note: 'This is a data issue, not a tool failure'
      }
    }

    const firstCustomer = result.rows[0]
    const hasId = firstCustomer.id !== undefined
    const hasName = firstCustomer.name !== undefined

    if (!hasId) {
      return {
        tool: 'search_customers',
        status: 'FAIL',
        error: 'Customer record missing id field',
        sample_keys: Object.keys(firstCustomer)
      }
    }

    return {
      tool: 'search_customers',
      status: 'PASS',
      result_count: result.rows.length,
      has_id: hasId,
      has_name: hasName,
      search_type_detected: result.search_type || 'name',
      discovered_customer_id: String(firstCustomer.id),
      table_rows: result.rows.length,
      table_columns: result.columns
    }

  } catch (error) {
    return {
      tool: 'search_customers',
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
  return await testSearchCustomers()
}
