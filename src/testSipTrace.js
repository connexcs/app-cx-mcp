/**
 * Test for getSipTrace functionality
 */

import { searchCallLogs, getSipTrace } from './callDebugTools'

/**
 * Tests the getSipTrace function
 * @returns {Promise<Object>} Test result
 */
export async function testSipTrace () {
  try {
    // First search for a call
    const searchResults = await searchCallLogs('3002')
    if (!searchResults || searchResults.length === 0) {
      return {
        tool: 'get_sip_trace',
        status: 'SKIP',
        error: 'No calls found to test with'
      }
    }
    
    const firstCall = searchResults[0]
    const callid = firstCall.routing ? firstCall.routing.callid : null
    const callidb = firstCall.routing ? firstCall.routing.callidb : null
    
    if (!callid) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: 'Could not extract callid from search results'
      }
    }
    
    // Test getSipTrace
    const trace = await getSipTrace(callid, callidb)
    
    if (!trace || !Array.isArray(trace)) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: 'Trace is not an array'
      }
    }
    
    if (trace.length === 0) {
      return {
        tool: 'get_sip_trace',
        status: 'FAIL',
        error: 'No trace data returned'
      }
    }
    
    // Verify structure
    const firstMsg = trace[0]
    const hasMethod = firstMsg.method !== undefined
    const hasSource = firstMsg.source_ip !== undefined
    
    return {
      tool: 'get_sip_trace',
      status: 'PASS',
      sip_messages: trace.length,
      has_method: hasMethod,
      has_source_ip: hasSource,
      first_method: firstMsg.method,
      callid: callid
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
