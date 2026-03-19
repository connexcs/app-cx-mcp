/**
 * Test for getCustomerPackages functionality
 */

import { discoverCustomerId } from './searchCustomer'
import { getCustomerPackages } from './package'

/**
 * Tests the getCustomerPackages function
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testCustomerPackages (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_customer_packages',
        status: 'SKIP',
        error: 'Could not discover a customer_id — no customers found matching "test"'
      }
    }

    const result = await getCustomerPackages({ customerId: customerId, type: 'all' })

    if (!result) {
      return {
        tool: 'get_customer_packages',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (result.success === false) {
      return {
        tool: 'get_customer_packages',
        status: 'FAIL',
        error: result.error || 'getCustomerPackages returned an error',
        customer_id: customerId
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'

    if (!tableValid) {
      return {
        tool: 'get_customer_packages',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    return {
      tool: 'get_customer_packages',
      status: 'PASS',
      customer_id: customerId,
      total_packages: result.rows.length,
      has_packages: result.rows.length > 0,
      table_rows: result.rows.length,
      table_columns: result.columns,
      note: result.rows.length === 0 ? 'No packages assigned (valid — customer may have none)' : 'Packages found'
    }

  } catch (error) {
    return {
      tool: 'get_customer_packages',
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
  return await testCustomerPackages()
}
