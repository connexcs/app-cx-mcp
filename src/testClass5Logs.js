/**
 * Test for getClass5Logs functionality
 */

import { searchCallLogs, getClass5Logs } from './callDebugTools'

/**
 * Tests the getClass5Logs function
 * @returns {Promise<Object>} Test result
 */
export async function testClass5Logs () {
  try {
    // First search for a call
    const searchResults = await searchCallLogs('3002')
    if (!searchResults || searchResults.length === 0) {
      return {
        tool: 'get_class5_logs',
        status: 'SKIP',
        error: 'No calls found to test with'
      }
    }
    
    const firstCall = searchResults[0]
    const callid = firstCall.routing ? firstCall.routing.callid : null
    
    if (!callid) {
      return {
        tool: 'get_class5_logs',
        status: 'FAIL',
        error: 'Could not extract callid from search results'
      }
    }
    
    // Test getClass5Logs
    const class5 = await getClass5Logs(callid)
    
    if (!class5) {
      return {
        tool: 'get_class5_logs',
        status: 'FAIL',
        error: 'No class5 data returned'
      }
    }
    
    if (!Array.isArray(class5)) {
      return {
        tool: 'get_class5_logs',
        status: 'FAIL',
        error: 'Class5 data is not an array'
      }
    }
    
    // Class 5 data may be empty (only for Class 5 calls)
    return {
      tool: 'get_class5_logs',
      status: 'PASS',
      class5_records: class5.length,
      has_data: class5.length > 0,
      note: class5.length === 0 ? 'No Class 5 data (Class 4 call)' : 'Class 5 data available',
      callid: callid
    }
    
  } catch (error) {
    return {
      tool: 'get_class5_logs',
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
  return await testClass5Logs()
}
