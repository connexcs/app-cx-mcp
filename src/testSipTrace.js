/**
 * Test for getSipTrace functionality
 */

import { searchCdr, getSipTrace, getSipTraceHandler, getDateRange } from './callDebugTools'

/**
 * Tests the getSipTrace function by dynamically finding a recent call from CDR
 * @returns {Promise<Object>} Test result
 */
export async function testSipTrace () {
  try {
    // Dynamically find recent calls from CDR over last 3 days — no hardcoded search terms
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 50 })

    if (!cdrResults || !Array.isArray(cdrResults) || cdrResults.length === 0) {
      return {
        tool: 'get_sip_trace',
        status: 'SKIP',
        note: 'No CDR records found in the last 3 days to test with'
      }
    }

    // Try each CDR call until we find one with live trace data (7-day retention)
    let trace = null
    let callid = null

    for (let i = 0; i < cdrResults.length; i++) {
      const cid = cdrResults[i].callid
      if (!cid) continue

      const t = await getSipTrace(cid, null)
      if (t && Array.isArray(t) && t.length > 0) {
        trace = t
        callid = cid
        break
      }
    }

    if (!callid) {
      return {
        tool: 'get_sip_trace',
        status: 'SKIP',
        note: 'No calls with available trace data found in last 3 days (traces expire after 7 days)'
      }
    }

    // Verify structure of raw trace
    const firstMsg = trace[0]
    const hasMethod = firstMsg.method !== undefined
    const hasSource = firstMsg.source_ip !== undefined

    // Verify handler result has flat table format with call_flow rows
    const handlerResult = await getSipTraceHandler({ callid })
    if (!handlerResult || handlerResult.success === false) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: 'getSipTraceHandler returned an error',
        callid
      }
    }

    const tableValid = Array.isArray(handlerResult.rows) && Array.isArray(handlerResult.columns) && typeof handlerResult.total === 'number'

    if (!tableValid) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: 'Response missing rows/columns/total on getSipTraceHandler result',
        callid,
        response_keys: Object.keys(handlerResult)
      }
    }

    return {
      tool: 'get_sip_trace',
      status: 'PASS',
      sip_messages: trace.length,
      has_method: hasMethod,
      has_source_ip: hasSource,
      first_method: firstMsg.method,
      callid,
      table_rows: handlerResult.rows.length,
      table_columns: handlerResult.columns
    }

  } catch (error) {
    return {
      tool: 'get_sip_trace',
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
  return await testSipTrace()
}

