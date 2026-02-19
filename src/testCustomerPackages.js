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

    if (!result.success) {
      return {
        tool: 'get_customer_packages',
        status: 'FAIL',
        error: result.error || 'getCustomerPackages returned success: false',
        customer_id: customerId
      }
    }

    const hasPackagesArray = Array.isArray(result.packages)
    const hasTotalPackages = result.totalPackages !== undefined

    if (!hasPackagesArray) {
      return {
        tool: 'get_customer_packages',
        status: 'FAIL',
        error: 'Response missing packages array'
      }
    }

    // No packages is valid — customer may just have none assigned
    return {
      tool: 'get_customer_packages',
      status: 'PASS',
      customer_id: customerId,
      total_packages: result.totalPackages,
      has_packages: result.packages.length > 0,
      has_total_field: hasTotalPackages,
      note: result.packages.length === 0 ? 'No packages assigned (valid — customer may have none)' : 'Packages found'
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
