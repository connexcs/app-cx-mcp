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

    // Verify handler result has _table with call_flow
    const handlerResult = await getSipTraceHandler({ callid })
    if (!handlerResult || !handlerResult.success) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: 'getSipTraceHandler returned success: false',
        callid
      }
    }

    const callFlow = (handlerResult.analysis && handlerResult.analysis.call_flow) || []
    const tableValid = callFlow.length > 0
      ? (handlerResult._table !== null && handlerResult._table !== undefined
         && Array.isArray(handlerResult._table.rows) && handlerResult._table.rows.length > 0
         && Array.isArray(handlerResult._table.columns)
         && typeof handlerResult._table.total === 'number')
      : handlerResult._table === null

    if (!tableValid) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: '_table missing or malformed on getSipTraceHandler result',
        callid,
        has_table: !!handlerResult._table
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
      table_rows: handlerResult._table ? handlerResult._table.rows.length : 0,
      table_columns: handlerResult._table ? handlerResult._table.columns : []
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

