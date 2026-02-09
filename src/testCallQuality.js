/**
 * Test for getRtcpQuality functionality
 */

import { searchCallLogs, getRtcpQuality } from './callDebugTools'

/**
 * Tests the getRtcpQuality function
 * @returns {Promise<Object>} Test result
 */
export async function testCallQuality () {
  try {
    // First search for a call
    const searchResults = await searchCallLogs('3002')
    if (!searchResults || searchResults.length === 0) {
      return {
        tool: 'get_call_quality',
        status: 'SKIP',
        error: 'No calls found to test with'
      }
    }
    
    const firstCall = searchResults[0]
    const callid = firstCall.routing ? firstCall.routing.callid : null
    
    if (!callid) {
      return {
        tool: 'get_call_quality',
        status: 'FAIL',
        error: 'Could not extract callid from search results'
      }
    }
    
    // Test getRtcpQuality
    const quality = await getRtcpQuality(callid)
    
    if (!quality) {
      return {
        tool: 'get_call_quality',
        status: 'FAIL',
        error: 'No quality data returned'
      }
    }
    
    // RTCP endpoint returns an object with processed array
    // Structure: { processed: [], aggregate: {...} }
    if (Array.isArray(quality)) {
      // If it's an array, it's valid
      return {
        tool: 'get_call_quality',
        status: 'PASS',
        rtcp_records: quality.length,
        has_data: quality.length > 0,
        note: quality.length === 0 ? 'No RTCP data (expected for some calls)' : 'RTCP data available',
        callid: callid
      }
    } else if (typeof quality === 'object') {
      // If it's an object, check for processed array
      const processed = quality.processed || []
      return {
        tool: 'get_call_quality',
        status: 'PASS',
        rtcp_records: processed.length,
        has_data: processed.length > 0,
        note: processed.length === 0 ? 'No RTCP data (expected for some calls)' : 'RTCP data available',
        callid: callid,
        structure: 'object'
      }
    } else {
      return {
        tool: 'get_call_quality',
        status: 'FAIL',
        error: `Quality data has unexpected type: ${typeof quality}`
      }
    }
    
  } catch (error) {
    return {
      tool: 'get_call_quality',
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
  return await testCallQuality()
}
