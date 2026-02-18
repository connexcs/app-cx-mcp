/**
 * Master Test Suite — All ConnexCS MCP Tools
 *
 * Single entry point for all MCP tool tests.
 * Run with: cx run masterTest
 *
 * Covers:
 *   Suite A — Call debug tools (tools 1–9 via handler functions + investigateCall)
 *   Suite B — Internal consistency (getSipTrace endpoint vs handler vs investigateCall)
 *   Suite C — Customer tools (searchCustomers, balance, topup, packages, rate cards, RTP servers)
 *   Suite D — Stats tools (profitability, call stats, destination stats)
 *   Suite E — Documentation tools (searchDocumentation + getDocumentation)
 */

import { testSearchLogs } from './testSearchLogs'
import { testCdr } from './testCdr'
import { testCallAnalytics } from './testCallAnalytics'
import { testSipTrace } from './testSipTrace'
import { testCallQuality } from './testCallQuality'
import { testClass5Logs } from './testClass5Logs'
import { testRtpGroups } from './testRtpGroups'
import { testTranscription } from './testTranscription'
import { testAiAgent } from './testAiAgent'
import { testInvestigateCall } from './testInvestigateCall'
import { testSearchCustomers } from './testSearchCustomers'
import { testCustomerBalance } from './testCustomerBalance'
import { testLastTopup } from './testLastTopup'
import { testListRtpServers } from './testListRtpServers'
import { testCustomerPackages } from './testCustomerPackages'
import { testCustomerRateCards, testRateCardDetails, testRateCardRules } from './testRateCards'
import { testCustomerProfitability } from './testCustomerProfitability'
import { testListCustomersByProfitability } from './testListCustomersByProfitability'
import { testCustomerCallStatistics } from './testCustomerCallStatistics'
import { testCustomerDestinationStatistics } from './testCustomerDestinationStatistics'
import { testDocumentation } from './testDocumentation'
import { getSipTrace, getSipTraceHandler, investigateCallHandler } from './callDebugTools'
import { searchCustomers, getLastTopup } from './searchCustomer'
import { getCustomerRateCards, getRateCardDetails } from './rateCard'
import { listCustomersByProfitability } from './listCustomersByProfitability'

// ============================================================================
// SUITE B — Internal consistency check
// ============================================================================

/**
 * Verifies getSipTrace endpoint, getSipTraceHandler, and investigateCallHandler
 * all return consistent underlying trace data (no logic duplication).
 * @returns {Promise<Object>} Test result
 */
async function testSipTraceConsistency () {
  const testCallId = '896411870-861076410-2143831551'
  const testCallIdB = 'CNX2863_ewlYegJpZwUIGwtpchR0Blp/A3VtAwwFC2xyEXYB'
  const results = {}

  try {
    const directTrace = await getSipTrace(testCallId, testCallIdB)
    results.directCall = {
      success: true,
      messageCount: Array.isArray(directTrace) ? directTrace.length : 0,
      firstMessageId: Array.isArray(directTrace) && directTrace.length > 0 ? directTrace[0].id : null
    }
  } catch (error) {
    results.directCall = { success: false, error: error.message }
  }

  try {
    const handlerResult = await getSipTraceHandler({ callid: testCallId, callidb: testCallIdB })
    results.handler = {
      success: handlerResult.success,
      messageCount: handlerResult.raw_message_count || 0,
      firstMessageId: handlerResult.raw_messages && handlerResult.raw_messages.length > 0 ? handlerResult.raw_messages[0].id : null
    }
  } catch (error) {
    results.handler = { success: false, error: error.message }
  }

  try {
    const investigateResult = await investigateCallHandler({ callid: testCallId, callidb: testCallIdB })
    results.investigate = {
      success: investigateResult.success,
      messageCount: investigateResult.trace ? investigateResult.trace.raw_message_count || 0 : 0,
      firstMessageId: investigateResult.trace && investigateResult.trace.raw_messages && investigateResult.trace.raw_messages.length > 0 ? investigateResult.trace.raw_messages[0].id : null,
      callType: investigateResult.call_type,
      issuesCount: investigateResult.issues ? investigateResult.issues.length : 0
    }
  } catch (error) {
    results.investigate = { success: false, error: error.message }
  }

  const allSucceeded = !!(results.directCall && results.directCall.success && results.handler && results.handler.success && results.investigate && results.investigate.success)
  const messageCountsMatch =
    (results.directCall ? results.directCall.messageCount : null) === (results.handler ? results.handler.messageCount : null) &&
    (results.handler ? results.handler.messageCount : null) === (results.investigate ? results.investigate.messageCount : null)
  const firstMessageIdsMatch =
    (results.directCall ? results.directCall.firstMessageId : null) === (results.handler ? results.handler.firstMessageId : null) &&
    (results.handler ? results.handler.firstMessageId : null) === (results.investigate ? results.investigate.firstMessageId : null)

  const passed = allSucceeded && messageCountsMatch && firstMessageIdsMatch

  return {
    tool: 'sip_trace_consistency',
    status: passed ? 'PASS' : 'FAIL',
    all_handlers_succeeded: allSucceeded,
    message_counts_match: messageCountsMatch,
    first_message_ids_match: firstMessageIdsMatch,
    details: results
  }
}

// ============================================================================
// MAIN — Run all suites
// ============================================================================

/**
 * Runs all tool tests and internal consistency checks, aggregates results.
 * @returns {Promise<Object>} Combined test results
 */
export async function main () {
  const results = {
    tests_run: 0,
    tests_passed: 0,
    tests_failed: 0,
    tests_skipped: 0,
    tests_error: 0,
    details: []
  }

  // Helper: pause N milliseconds
  function sleep (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms) })
  }

  /**
   * Find a customer that has rate cards AND payment history AND profitability data.
   * Strategy:
   *   1. Use listCustomersByProfitability (top 10 by profit) — these are active customers
   *   2. For each candidate, probe getCustomerRateCards + getLastTopup in parallel
   *   3. Return the first that has both; otherwise return the best partial match
   * @returns {Promise<{ customerId: string|null, rateCardId: string|null, activeRev: string|null }>}
   */
  async function discoverFullyEquippedCustomer () {
    // Step 1: get profitable customers (likely to have the most data)
    let candidates = []
    try {
      const profResult = await listCustomersByProfitability({
        sort_by: 'total_profit',
        sort_order: 'desc',
        limit: 10
      })
      const profCustomers = (profResult && (profResult.customers || profResult.data || profResult.results)) || []
      candidates = profCustomers
        .filter(function (c) { return c && (c.id || c.customer_id || c.company_id) })
        .map(function (c) { return String(c.id || c.customer_id || c.company_id) })
    } catch (e) {
      // Fall through to name search
    }

    // Step 2: also include customers from a name search as fallback candidates
    try {
      const nameResult = await searchCustomers({ query: '', search_type: 'name', limit: 10 })
      const nameCustomers = (nameResult && (nameResult.customers || nameResult.matches)) || []
      nameCustomers.forEach(function (c) {
        const id = String(c.id || c.customer_id || '')
        if (id && candidates.indexOf(id) === -1) {
          candidates.push(id)
        }
      })
    } catch (e) {
      // Not fatal
    }

    if (candidates.length === 0) return null

    /**
     * Check if a candidate customer has:
     *   - a usable rate card (real card_id w/ active_rev)
     *   - payment history (topup)
     * Returns { hasRateCards, hasTopup, hasActiveRev, rateCardId, activeRev }
     */
    async function probeCandidate (id) {
      const rateCardResult = await getCustomerRateCards({ customerId: id })
      const topupResult = await getLastTopup({ customer_id: id })
      const hasTopup = !!(topupResult && topupResult.success)

      const cards = (rateCardResult && rateCardResult.success && rateCardResult.rateCards) || []
      const usableCard = cards.find(function (c) {
        const cid = c.card_id || ''
        return cid && cid !== 'internal' && cid.indexOf('ip:') !== 0 && cid.indexOf(':') === -1
      })
      if (!usableCard) return { hasRateCards: false, hasTopup: hasTopup, hasActiveRev: false, rateCardId: null, activeRev: null }

      // Check active_rev via getRateCardDetails
      let hasActiveRev = false
      let activeRev = null
      const foundRateCardId = String(usableCard.card_id)
      try {
        const details = await getRateCardDetails({ rateCardId: foundRateCardId })
        if (details && details.success && details.data && details.data.active_rev != null) {
          hasActiveRev = true
          activeRev = String(details.data.active_rev)
        }
      } catch (e) {
        // details call failed
      }
      return { hasRateCards: true, hasTopup: hasTopup, hasActiveRev: hasActiveRev, rateCardId: foundRateCardId, activeRev: activeRev }
    }

    // Step 3: probe each candidate — look for full match first, then best partial
    let bestPartial = null // has at least rate cards
    let bestWithRev = null // has rate cards + active_rev but no topup
    for (let i = 0; i < candidates.length; i++) {
      const id = candidates[i]
      try {
        // Small delay between probes to avoid 429
        if (i > 0) await sleep(500)
        const probe = await probeCandidate(id)

        if (probe.hasRateCards && probe.hasTopup && probe.hasActiveRev) {
          return { customerId: id, rateCardId: probe.rateCardId, activeRev: probe.activeRev } // perfect match
        }
        if (probe.hasRateCards && probe.hasActiveRev && !bestWithRev) {
          bestWithRev = { customerId: id, rateCardId: probe.rateCardId, activeRev: probe.activeRev }
        }
        if (probe.hasRateCards && !bestPartial) {
          bestPartial = { customerId: id, rateCardId: probe.rateCardId, activeRev: null }
        }
      } catch (e) {
        // Probe failed for this candidate — try next
      }
    }

    // Return best available: prefer rev+topup > rev only > cards only > first candidate
    return bestWithRev || bestPartial || { customerId: candidates[0], rateCardId: null, activeRev: null }
  }

  // Pre-discover a fully-equipped customer ID once — reused across all customer-dependent tests
  let sharedCustomerId = null
  let sharedRateCardId = null
  let sharedActiveRev = null
  try {
    const discovered = await discoverFullyEquippedCustomer()
    if (discovered) {
      sharedCustomerId = discovered.customerId
      sharedRateCardId = discovered.rateCardId
      sharedActiveRev = discovered.activeRev
    }
  } catch (e) {
    // Not fatal — customer tests will individually report what they find
  }

  // Suite A — Call debug tools (tools 1–10)
  const suiteA = [
    { name: 'search_call_logs', func: testSearchLogs },
    { name: 'search_cdr', func: testCdr },
    { name: 'get_call_analytics', func: testCallAnalytics },
    { name: 'get_sip_trace', func: testSipTrace },
    { name: 'get_call_quality', func: testCallQuality },
    { name: 'get_class5_logs', func: testClass5Logs },
    { name: 'get_rtp_server_groups', func: testRtpGroups },
    { name: 'get_transcription', func: testTranscription },
    { name: 'get_ai_agent_logs', func: testAiAgent },
    { name: 'investigate_call', func: testInvestigateCall }
  ]

  // Suite B — Internal consistency tests
  const suiteB = [
    { name: 'sip_trace_consistency', func: testSipTraceConsistency }
  ]

  // Suite C — Customer management tools (shared customer ID passed to avoid repeated lookups)
  const suiteC = [
    { name: 'search_customers', func: function () { return testSearchCustomers() } },
    { name: 'get_customer_balance', func: function () { return testCustomerBalance(sharedCustomerId) } },
    { name: 'get_last_topup', func: function () { return testLastTopup(sharedCustomerId) } },
    { name: 'list_rtp_servers', func: testListRtpServers },
    { name: 'get_customer_packages', func: function () { return testCustomerPackages(sharedCustomerId) } },
    { name: 'get_customer_rate_cards', func: function () { return testCustomerRateCards(sharedCustomerId) } },
    { name: 'get_rate_card_details', func: function () { return testRateCardDetails(sharedCustomerId) } },
    { name: 'get_rate_card_rules', func: function () { return testRateCardRules(sharedCustomerId, sharedRateCardId, sharedActiveRev) } }
  ]

  // Suite D — Statistics tools
  const suiteD = [
    { name: 'get_customer_profitability', func: function () { return testCustomerProfitability(sharedCustomerId) } },
    { name: 'list_customers_by_profitability', func: testListCustomersByProfitability },
    { name: 'get_customer_call_statistics', func: function () { return testCustomerCallStatistics(sharedCustomerId) } },
    { name: 'get_customer_destination_statistics', func: function () { return testCustomerDestinationStatistics(sharedCustomerId) } }
  ]

  // Suite E — Documentation tools (searchDocumentation + getDocumentation tested together)
  const suiteE = [
    { name: 'documentation', func: testDocumentation }
  ]

  const suites = [
    { label: 'A', tests: suiteA },
    { label: 'B', tests: suiteB },
    { label: 'C', tests: suiteC },
    { label: 'D', tests: suiteD },
    { label: 'E', tests: suiteE }
  ]

  for (let si = 0; si < suites.length; si++) {
    if (si > 0) {
      await sleep(3000)
    }
    const suite = suites[si]
    for (const test of suite.tests) {
      results.tests_run++
      try {
        const result = await test.func()
        results.details.push(result)
        if (result.status === 'PASS') {
          results.tests_passed++
        } else if (result.status === 'SKIP') {
          results.tests_skipped++
        } else if (result.status === 'ERROR') {
          results.tests_error++
        } else {
          results.tests_failed++
        }
      } catch (error) {
        results.tests_error++
        results.details.push({
          tool: test.name,
          status: 'ERROR',
          error: error.message
        })
      }
    }
  }

  results.success = results.tests_failed === 0 && results.tests_error === 0
  results.summary = `${results.tests_passed}/${results.tests_run} tests passed`

  return results
}