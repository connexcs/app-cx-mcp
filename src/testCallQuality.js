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
    console.log('Testing getRtcpQuality...')
    
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
    const callid = firstCall.callid
    
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
    
    if (!Array.isArray(quality)) {
      return {
        tool: 'get_call_quality',
        status: 'FAIL',
        error: 'Quality data is not an array'
      }
    }
    
    // RTCP data may be empty (not all calls have it)
    return {
      tool: 'get_call_quality',
      status: 'PASS',
      rtcp_records: quality.length,
      has_data: quality.length > 0,
      note: quality.length === 0 ? 'No RTCP data (expected for some calls)' : 'RTCP data available',
      callid: callid
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
