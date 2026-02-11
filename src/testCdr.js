/**
 * Test CDR Search
 * 
 * Tests the searchCdr function with date range parameters and structured query.
 * 
 * Run: cx run testCdr
 */

import { searchCdr } from './callDebugTools'

/**
 * Tests the searchCdr function with new structured query format
 * @returns {Promise<Object>} Test result
 */
export async function testCdr () {
  try {
    // Test basic CDR search with required start_date parameter
    // endDate defaults to startDate for single-day query
    const result = await searchCdr('2026-02-11')
    
    if (!Array.isArray(result)) {
      return {
        tool: 'search_cdr',
        status: 'FAIL',
        error: 'Result is not an array'
      }
    }
    
    // CDR might be empty if no successful calls on this date (that's OK)
    // Just verify the structure if we have results
    if (result.length > 0) {
      const firstRecord = result[0]
      
      // Verify CDR record has expected fields from structured query
      if (!firstRecord.callid && !firstRecord.dt) {
        return {
          tool: 'search_cdr',
          status: 'FAIL',
          error: 'CDR record missing expected fields (callid or dt)'
        }
      }
    }
    
    return {
      tool: 'search_cdr',
      status: 'PASS',
      result_count: result.length,
      message: result.length > 0
        ? `Found ${result.length} CDR records with structured query`
        : 'No completed calls found (this is OK - may be all failures on this date)'
    }
  } catch (error) {
    return {
      tool: 'search_cdr',
      status: 'FAIL',
      error: error.message
    }
  }
}

/**
 * Main test execution (for standalone testing)
 * @returns {Promise<Object>} Test results
 */
export async function main () {
  // Just run the quick test for ScriptForge
  return await testCdr()
}
