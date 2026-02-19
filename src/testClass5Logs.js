/**
 * Test for getClass5Logs functionality
 */

import { searchCdr, getClass5Logs, getDateRange } from './callDebugTools'

/**
 * Tests the getClass5Logs function
 * @returns {Promise<Object>} Test result
 */
export async function testClass5Logs () {
  try {
    // Discover a real callid dynamically via CDR (last 3 days)
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'get_class5_logs',
        status: 'SKIP',
        error: 'No calls found in last 3 days to test with'
      }
    }

    const callid = cdrResults[0].callid
    if (!callid) {
      return {
        tool: 'get_class5_logs',
        status: 'FAIL',
        error: 'Could not extract callid from CDR results'
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
