/**
 * Test for investigateCall functionality
 */

import { searchCdr, investigateCallHandler, getDateRange } from './callDebugTools'

/**
 * Tests the investigateCall function (combined SIP + Class5 + RTCP)
 * @returns {Promise<Object>} Test result
 */
export async function testInvestigateCall () {
  try {
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'investigate_call',
        status: 'SKIP',
        error: 'No calls found in last 3 days to test with'
      }
    }

    const callid = cdrResults[0].callid
    if (!callid) {
      return {
        tool: 'investigate_call',
        status: 'FAIL',
        error: 'Could not extract callid from CDR results'
      }
    }

    const result = await investigateCallHandler({ callid: callid })

    if (!result) {
      return {
        tool: 'investigate_call',
        status: 'FAIL',
        error: 'No result returned from investigateCallHandler'
      }
    }

    if (!result.success) {
      return {
        tool: 'investigate_call',
        status: 'FAIL',
        error: result.error || 'investigateCall returned success: false'
      }
    }

    const hasCallType = result.call_type !== undefined
    const hasTrace = result.trace !== undefined
    const hasIssues = Array.isArray(result.issues)
    const hasDebugSummary = typeof result.debug_summary === 'string'

    if (!hasCallType || !hasTrace || !hasIssues) {
      return {
        tool: 'investigate_call',
        status: 'FAIL',
        error: 'Response missing required fields (call_type, trace, or issues)',
        has_call_type: hasCallType,
        has_trace: hasTrace,
        has_issues: hasIssues
      }
    }

    return {
      tool: 'investigate_call',
      status: 'PASS',
      call_type: result.call_type,
      trace_available: result.trace && result.trace.available,
      trace_messages: result.trace && result.trace.raw_message_count || 0,
      class5_available: result.class5 && result.class5.available,
      rtcp_available: result.rtcp && result.rtcp.available,
      issues_count: result.issues.length,
      has_debug_summary: hasDebugSummary,
      callid: callid
    }

  } catch (error) {
    return {
      tool: 'investigate_call',
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
  return await testInvestigateCall()
}
