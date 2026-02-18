/**
 * Master Test Suite — All ConnexCS MCP Tools
 *
 * Single entry point for all MCP tool tests.
 * Run with: cx run masterTest
 *
 * Covers:
 *   Suite A — Tool tests (all registered MCP tools via their handler functions)
 *   Suite B — Internal consistency (getSipTrace endpoint vs handler vs investigateCall)
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
import { getSipTrace, getSipTraceHandler, investigateCallHandler } from './callDebugTools'

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

  // Suite A — MCP tool handler tests
  const suiteA = [
    { name: 'search_call_logs', func: testSearchLogs },
    { name: 'search_cdr', func: testCdr },
    { name: 'get_call_analytics', func: testCallAnalytics },
    { name: 'get_sip_trace', func: testSipTrace },
    { name: 'get_call_quality', func: testCallQuality },
    { name: 'get_class5_logs', func: testClass5Logs },
    { name: 'get_rtp_server_groups', func: testRtpGroups },
    { name: 'get_transcription', func: testTranscription },
    { name: 'get_ai_agent_logs', func: testAiAgent }
  ]

  // Suite B — Internal consistency tests
  const suiteB = [
    { name: 'sip_trace_consistency', func: testSipTraceConsistency }
  ]

  const allTests = [...suiteA, ...suiteB]

  for (const test of allTests) {
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

  results.success = results.tests_failed === 0 && results.tests_error === 0
  results.summary = `${results.tests_passed}/${results.tests_run} tests passed`

  return results
}