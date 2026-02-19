/**
 * Test for getCustomerBalance functionality
 */

import { getCustomerBalance, discoverCustomerId } from './searchCustomer'

/**
 * Tests the getCustomerBalance function
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testCustomerBalance (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_customer_balance',
        status: 'SKIP',
        error: 'Could not discover a customer_id — no customers found matching "test"'
      }
    }

    const result = await getCustomerBalance({ customer_id: customerId })

    if (!result) {
      return {
        tool: 'get_customer_balance',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_customer_balance',
        status: 'FAIL',
        error: result.error || 'getCustomerBalance returned success: false',
        customer_id: customerId
      }
    }

    const hasBalance = result.balance !== undefined
    const hasCredit = hasBalance && result.balance.credit !== undefined
    const hasDebitLimit = hasBalance && result.balance.debit_limit !== undefined
    const hasAvailableBalance = hasBalance && result.balance.available_balance !== undefined
    const hasCallCapability = result.call_capability !== undefined

    if (!hasBalance) {
      return {
        tool: 'get_customer_balance',
        status: 'FAIL',
        error: 'Response missing balance field'
      }
    }

    return {
      tool: 'get_customer_balance',
      status: 'PASS',
      customer_id: customerId,
      customer_name: result.customer_name,
      credit: result.balance.credit,
      debit_limit: result.balance.debit_limit,
      available_balance: result.balance.available_balance,
      currency: result.balance.currency,
      can_make_calls: result.call_capability && result.call_capability.can_make_calls,
      has_all_fields: hasCredit && hasDebitLimit && hasAvailableBalance && hasCallCapability
    }

  } catch (error) {
    return {
      tool: 'get_customer_balance',
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
  return await testCustomerBalance()
}
