/**
 * Test for getCustomerRateCards, getRateCardDetails, and getRateCardRules
 *
 * All three rate card tools are tested here in a single chained flow:
 *   1. Discover a customer and fetch their rate cards
 *   2. Use the first rate card ID to fetch details
 *   3. Use the rate card ID + activeRev to fetch pricing rules
 */

import { searchCustomers } from './searchCustomer'
import { getCustomerRateCards, getRateCardDetails, getRateCardRules } from './rateCard'

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
 * Tests getCustomerRateCards
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result with discovered rateCardId and activeRev
 */
export async function testCustomerRateCards (preloadedCustomerId) {
  try {
    const customerId = preloadedCustomerId || await discoverCustomerId()

    if (!customerId) {
      return {
        tool: 'get_customer_rate_cards',
        status: 'SKIP',
        error: 'Could not discover a customer_id'
      }
    }

    const result = await getCustomerRateCards({ customerId: customerId })

    if (!result) {
      return {
        tool: 'get_customer_rate_cards',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_customer_rate_cards',
        status: 'SKIP',
        note: 'No rate cards found for this customer — valid if none assigned',
        customer_id: customerId,
        api_message: result.error
      }
    }

    const cards = result.rateCards || []
    if (!Array.isArray(cards) || cards.length === 0) {
      return {
        tool: 'get_customer_rate_cards',
        status: 'SKIP',
        note: 'Rate cards array is empty — valid if none assigned',
        customer_id: customerId
      }
    }

    const firstCard = cards[0]
    const hasId = firstCard.id !== undefined
    const hasName = firstCard.name !== undefined

    return {
      tool: 'get_customer_rate_cards',
      status: 'PASS',
      customer_id: customerId,
      total_rate_cards: result.totalRateCards,
      has_id: hasId,
      has_name: hasName,
      discovered_rate_card_id: firstCard.id ? String(firstCard.id) : null,
      discovered_active_rev: firstCard.active_rev != null ? String(firstCard.active_rev) : null
    }

  } catch (error) {
    return {
      tool: 'get_customer_rate_cards',
      status: 'ERROR',
      error: error.message
    }
  }
}

/**
 * Tests getRateCardDetails using a dynamically discovered rate card ID
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testRateCardDetails (preloadedCustomerId) {
  try {
    // Discover customer and their rate cards first
    const customerId = preloadedCustomerId || await discoverCustomerId()
    if (!customerId) {
      return {
        tool: 'get_rate_card_details',
        status: 'SKIP',
        error: 'Could not discover a customer_id'
      }
    }

    const cardsResult = await getCustomerRateCards({ customerId: customerId })
    if (!cardsResult || !cardsResult.success) {
      return {
        tool: 'get_rate_card_details',
        status: 'SKIP',
        note: 'No rate cards available to test with'
      }
    }

    const cards = cardsResult.rateCards || []
    if (cards.length === 0) {
      return {
        tool: 'get_rate_card_details',
        status: 'SKIP',
        note: 'Empty rate cards list — nothing to test'
      }
    }

    const rateCardId = String(cards[0].id)
    const result = await getRateCardDetails({ rateCardId: rateCardId })

    if (!result) {
      return {
        tool: 'get_rate_card_details',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_rate_card_details',
        status: 'FAIL',
        error: result.error || 'getRateCardDetails returned success: false',
        rate_card_id: rateCardId
      }
    }

    const cardData = result.data || {}
    const hasId = cardData.id !== undefined || result.rateCardId !== undefined
    const hasName = cardData.name !== undefined

    return {
      tool: 'get_rate_card_details',
      status: 'PASS',
      rate_card_id: rateCardId,
      has_id: hasId,
      has_name: hasName,
      card_name: cardData.name,
      active_rev: cardData.active_rev != null ? String(cardData.active_rev) : null
    }

  } catch (error) {
    return {
      tool: 'get_rate_card_details',
      status: 'ERROR',
      error: error.message
    }
  }
}

/**
 * Tests getRateCardRules using dynamically discovered rate card ID + activeRev
 * @param {string} [preloadedCustomerId] - Optional pre-discovered customer ID
 * @returns {Promise<Object>} Test result
 */
export async function testRateCardRules (preloadedCustomerId) {
  try {
    // Discover customer and their rate cards
    const customerId = preloadedCustomerId || await discoverCustomerId()
    if (!customerId) {
      return {
        tool: 'get_rate_card_rules',
        status: 'SKIP',
        error: 'Could not discover a customer_id'
      }
    }

    const cardsResult = await getCustomerRateCards({ customerId: customerId })
    if (!cardsResult || !cardsResult.success) {
      return {
        tool: 'get_rate_card_rules',
        status: 'SKIP',
        note: 'No rate cards available to test with'
      }
    }

    const cards = cardsResult.rateCards || []
    if (cards.length === 0) {
      return {
        tool: 'get_rate_card_rules',
        status: 'SKIP',
        note: 'Empty rate cards list — nothing to test'
      }
    }

    const rateCardId = String(cards[0].id)

    // Get details to find activeRev
    const detailsResult = await getRateCardDetails({ rateCardId: rateCardId })
    const activeRev = detailsResult && detailsResult.data && detailsResult.data.active_rev != null
      ? String(detailsResult.data.active_rev)
      : null

    if (!activeRev) {
      return {
        tool: 'get_rate_card_rules',
        status: 'SKIP',
        note: 'Rate card has no active_rev — cannot fetch rules',
        rate_card_id: rateCardId
      }
    }

    const result = await getRateCardRules({
      rateCardId: rateCardId,
      activeRev: activeRev,
      include_prefixes: true,
      prefix_limit: 50
    })

    if (!result) {
      return {
        tool: 'get_rate_card_rules',
        status: 'FAIL',
        error: 'No result returned'
      }
    }

    if (!result.success) {
      return {
        tool: 'get_rate_card_rules',
        status: 'FAIL',
        error: result.error || 'getRateCardRules returned success: false',
        rate_card_id: rateCardId,
        active_rev: activeRev
      }
    }

    const rules = result.rules || []
    return {
      tool: 'get_rate_card_rules',
      status: 'PASS',
      rate_card_id: rateCardId,
      active_rev: activeRev,
      total_rules: result.totalRules,
      has_rules: rules.length > 0,
      note: rules.length === 0 ? 'No rules (empty rate card — valid)' : 'Rules returned'
    }

  } catch (error) {
    return {
      tool: 'get_rate_card_rules',
      status: 'ERROR',
      error: error.message
    }
  }
}

/**
 * Entry point for ScriptForge — runs all three rate card tests
 * @returns {Promise<Object>} Combined results
 */
export async function main () {
  const r1 = await testCustomerRateCards()
  const r2 = await testRateCardDetails()
  const r3 = await testRateCardRules()
  return { results: [r1, r2, r3] }
}
