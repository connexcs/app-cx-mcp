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

    const hasCallType = result.call_type !== undefined
    const hasTraceAvailable = result.trace_available !== undefined
    const hasCallIssues = Array.isArray(result.call_issues)
    const hasRows = Array.isArray(result.rows)

    if (!hasCallType || !hasTraceAvailable || !hasCallIssues) {
      return {
        tool: 'investigate_call',
        status: 'FAIL',
        error: 'Response missing required fields (call_type, trace_available, or call_issues)',
        has_call_type: hasCallType,
        has_trace_available: hasTraceAvailable,
        has_call_issues: hasCallIssues
      }
    }

    return {
      tool: 'investigate_call',
      status: 'PASS',
      call_type: result.call_type,
      trace_available: result.trace_available,
      trace_messages: result.trace_message_count || 0,
      class5_available: result.class5_available,
      rtcp_available: result.rtcp_available,
      call_issues_count: result.call_issues.length,
      callid,
      table_rows: hasRows ? result.rows.length : 0,
      table_note: !hasRows || result.rows.length === 0
        ? 'empty (no SIP trace data — valid)'
        : `${result.columns.join(', ')}`
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
