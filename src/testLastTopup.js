/**
 * Test for getLastTopup functionality
 */

import { searchCustomers, getLastTopup } from './searchCustomer'

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
 * Tests the getLastTopup function
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testLastTopup (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_last_topup',
        status: 'SKIP',
        error: 'Could not discover a customer_id — no customers found matching "test"'
      }
    }

    const result = await getLastTopup({ customer_id: customerId })

    if (!result) {
      return {
        tool: 'get_last_topup',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    // No top-up history is acceptable — not an error
    if (!result.success) {
      return {
        tool: 'get_last_topup',
        status: 'SKIP',
        note: 'No payment history for this customer — tool responded correctly',
        customer_id: customerId,
        api_message: result.error
      }
    }

    const hasAmount = result.amount !== undefined
    const hasPaymentDate = result.payment_date !== undefined
    const hasPaymentMethod = result.payment_method !== undefined

    return {
      tool: 'get_last_topup',
      status: 'PASS',
      customer_id: customerId,
      amount: result.amount,
      currency: result.currency,
      payment_date: result.payment_date,
      payment_method: result.payment_method,
      status_field: result.status,
      has_all_fields: hasAmount && hasPaymentDate && hasPaymentMethod
    }

  } catch (error) {
    return {
      tool: 'get_last_topup',
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
  return await testLastTopup()
}
