/**
 * Test for getCustomerRateCards, getRateCardDetails, and getRateCardRules
 *
 * All three rate card tools are tested here in a single chained flow:
 *   1. Discover a customer and fetch their rate cards
 *   2. Use the first rate card ID to fetch details
 *   3. Use the rate card ID + activeRev to fetch pricing rules
 */

import { discoverCustomerId } from './searchCustomer'
import { getCustomerRateCards, getRateCardDetails, getRateCardRules } from './rateCard'

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
    // card_id is the actual card identifier; id is the routing row ID
    // Filter out non-fetchable cards (internal routing, IP-based, etc.)
    const usableCard = cards.find(function (c) {
      const cid = c.card_id || ''
      return cid && cid !== 'internal' && cid.indexOf('ip:') !== 0 && cid.indexOf(':') === -1
    }) || firstCard
    const hasId = usableCard.id !== undefined
    const hasName = usableCard.name !== undefined

    return {
      tool: 'get_customer_rate_cards',
      status: 'PASS',
      customer_id: customerId,
      total_rate_cards: result.totalRateCards,
      has_id: hasId,
      has_name: hasName,
      discovered_rate_card_id: usableCard.card_id ? String(usableCard.card_id) : null,
      discovered_active_rev: usableCard.active_rev != null ? String(usableCard.active_rev) : null
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

    // Use card_id (the actual card identifier), not id (routing row ID)
    // Skip non-fetchable card types (internal, IP-based)
    const usableCard = cards.find(function (c) {
      const cid = c.card_id || ''
      return cid && cid !== 'internal' && cid.indexOf('ip:') !== 0 && cid.indexOf(':') === -1
    })
    if (!usableCard) {
      return {
        tool: 'get_rate_card_details',
        status: 'SKIP',
        note: 'No fetchable rate card found (all are internal/IP-based routing entries)'
      }
    }
    const rateCardId = String(usableCard.card_id)
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
 * @param {string} [preloadedRateCardId] - Optional pre-discovered rate card ID (avoids extra API call)
 * @param {string} [preloadedActiveRev] - Optional pre-discovered active revision (avoids extra API call)
 * @returns {Promise<Object>} Test result
 */
export async function testRateCardRules (preloadedCustomerId, preloadedRateCardId, preloadedActiveRev) {
  try {
    // If both rate card ID and active revision are preloaded, skip discovery entirely
    if (preloadedRateCardId && preloadedActiveRev) {
      const result = await getRateCardRules({
        rateCardId: preloadedRateCardId,
        activeRev: preloadedActiveRev,
        include_prefixes: true,
        prefix_limit: 50
      })
      if (!result || !result.success) {
        return {
          tool: 'get_rate_card_rules',
          status: 'FAIL',
          error: (result && result.error) || 'getRateCardRules returned success: false',
          rate_card_id: preloadedRateCardId,
          active_rev: preloadedActiveRev
        }
      }
      const rules = result.rules || []
      return {
        tool: 'get_rate_card_rules',
        status: 'PASS',
        rate_card_id: preloadedRateCardId,
        active_rev: preloadedActiveRev,
        total_rules: result.totalRules,
        has_rules: rules.length > 0,
        note: rules.length === 0 ? 'No rules (empty rate card — valid)' : 'Rules returned'
      }
    }

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

    // Use card_id (the actual card identifier), not id (routing row ID)
    // Skip non-fetchable card types (internal, IP-based)
    const usableCard = cards.find(function (c) {
      const cid = c.card_id || ''
      return cid && cid !== 'internal' && cid.indexOf('ip:') !== 0 && cid.indexOf(':') === -1
    })
    if (!usableCard) {
      return {
        tool: 'get_rate_card_rules',
        status: 'SKIP',
        note: 'No fetchable rate card found (all are internal/IP-based routing entries)'
      }
    }
    const rateCardId = String(usableCard.card_id)

    // Get details to find activeRev — use preloaded if available to avoid extra API call
    let activeRev = preloadedActiveRev || null
    let detailsResult = null
    if (!activeRev) {
      detailsResult = await getRateCardDetails({ rateCardId: rateCardId })
      const cardData = (detailsResult && detailsResult.data) || {}
      activeRev = cardData.active_rev != null ? String(cardData.active_rev) : null
    }

    if (!activeRev) {
      return {
        tool: 'get_rate_card_rules',
        status: 'SKIP',
        note: 'Rate card has no active_rev — cannot fetch rules',
        rate_card_id: rateCardId,
        debug_details_keys: detailsResult ? Object.keys(detailsResult) : null,
        debug_data_keys: (detailsResult && detailsResult.data) ? Object.keys(detailsResult.data) : null,
        debug_active_rev_raw: (detailsResult && detailsResult.data) ? detailsResult.data.active_rev : 'NO_DATA'
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
