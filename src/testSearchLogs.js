/**
 * Test for searchCallLogs functionality
 */

import { searchCallLogs } from './callDebugTools'

/**
 * Tests the searchCallLogs function
 * @returns {Promise<Object>} Test result
 */
export async function testSearchLogs () {
  try {
    console.log('Testing searchCallLogs...')
    
    const results = await searchCallLogs('3002')
    
    if (!results || !Array.isArray(results)) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: 'Results is not an array'
      }
    }
    
    if (results.length === 0) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: 'No results found'
      }
    }
    
    // Verify structure of first result
    const firstCall = results[0]
    const hasCallId = firstCall.callid !== undefined
    const hasCallIdB = firstCall.callidb !== undefined
    
    if (!hasCallId) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: 'Result missing callid field'
      }
    }
    
    return {
      tool: 'search_call_logs',
      status: 'PASS',
      result_count: results.length,
      has_callid: hasCallId,
      has_callidb: hasCallIdB
    }
    
  } catch (error) {
    return {
      tool: 'search_call_logs',
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
  return await testSearchLogs()
}
