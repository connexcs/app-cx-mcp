/**
 * Test for searchCallLogs functionality
 */

import { searchCdr, searchCallLogs, getDateRange } from './callDebugTools'

/**
 * Tests the searchCallLogs function
 * @returns {Promise<Object>} Test result
 */
export async function testSearchLogs () {
  try {
    // Discover a real callid dynamically via CDR (last 3 days)
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'search_call_logs',
        status: 'SKIP',
        error: 'No CDR records found in last 3 days to derive a search term'
      }
    }

    // Use the callid from the most recent CDR record as the search term
    const searchTerm = cdrResults[0].callid
    if (!searchTerm) {
      return {
        tool: 'search_call_logs',
        status: 'SKIP',
        error: 'CDR record has no callid field'
      }
    }

    const results = await searchCallLogs(searchTerm)
    
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
    const hasRouting = firstCall.routing !== undefined
    const hasCallId = hasRouting && firstCall.routing.callid !== undefined
    const hasCallIdB = hasRouting && firstCall.routing.callidb !== undefined
    
    if (!hasRouting) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: 'Result missing routing field'
      }
    }
    
    if (!hasCallId) {
      return {
        tool: 'search_call_logs',
        status: 'FAIL',
        error: 'Result missing callid field in routing'
      }
    }
    
    return {
      tool: 'search_call_logs',
      status: 'PASS',
      result_count: results.length,
      has_callid: hasCallId,
      has_callidb: hasCallIdB,
      search_term: searchTerm
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
