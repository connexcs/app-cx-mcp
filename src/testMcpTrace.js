/**
 * Test harness for getSipTrace functionality
 * Tests importing from callDebugTools.js with absolute path
 */

import cxRest from 'cxRest'
import { getSipTrace } from './callDebugTools'

/**
 * Main test function
 * @returns {Promise<Object>} Test results
 */
export async function main () {
  try {
    // First, search for a call to get a callid
    console.log('Searching for calls with "3002"...')
    const api = cxRest.auth('csiamunyanga@connexcs.com')
    const searchResults = await api.get('log?s=3002')
    
    if (!searchResults || searchResults.length === 0) {
      return {
        success: false,
        message: 'No calls found in search',
        tests_run: 1,
        tests_passed: 0
      }
    }

    console.log(`Found ${searchResults.length} calls`)
    
    // Use first call for testing
    const firstCall = searchResults[0]
    
    // Log the structure to debug
    console.log('First call structure:', JSON.stringify(firstCall, null, 2))
    
    // Extract callid - try different possible locations
    const callid = firstCall.callid || firstCall.routing?.callid
    const callidb = firstCall.callidb || firstCall.routing?.callidb
    
    if (!callid) {
      return {
        success: false,
        message: 'Could not extract callid from search results',
        first_call_keys: Object.keys(firstCall),
        tests_run: 1,
        tests_passed: 0
      }
    }
    
    console.log(`Testing getSipTrace with callid: ${callid}`)
    
    // Test getSipTrace
    const trace = await getSipTrace(callid, callidb)
    
    if (!trace || trace.length === 0) {
      return {
        success: false,
        message: 'getSipTrace returned no data',
        callid: callid,
        tests_run: 1,
        tests_passed: 0
      }
    }

    console.log(`✓ Success! Received ${trace.length} SIP messages`)
    
    // Analyze the trace
    const methods = trace.map(msg => msg.method).filter(Boolean)
    const hasInvite = methods.includes('INVITE')
    const hasAuth = methods.includes('407')
    
    return {
      success: true,
      message: `getSipTrace test passed`,
      callid: callid,
      sip_messages: trace.length,
      has_invite: hasInvite,
      has_auth_challenge: hasAuth,
      first_method: trace[0]?.method,
      last_method: trace[trace.length - 1]?.method,
      tests_run: 1,
      tests_passed: 1
    }

  } catch (error) {
    return {
      success: false,
      message: `Test failed: ${error.message}`,
      error: error.message,
      tests_run: 1,
      tests_passed: 0
    }
  }
}
