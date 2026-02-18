/**
 * Test CDR Search - Standalone Version
 * 
 * Direct test without imports to isolate the issue.
 * 
 * Run: cx run testCdr
 */

import cxRest from 'cxRest'

/**
 * Standalone CDR test with direct API call
 * @returns {Promise<Object>} Test result
 */
export async function testCdr () {
  try {
    console.log('[testCdr] Starting standalone CDR test...')
    
    // Build query matching user's example - test with higher limit
    const query = {
      field: ['dt', 'callid', 'dest_cli', 'dest_number', 'duration'],
      where: {
        rules: [
          { field: 'dt', condition: '>=', data: '2026-01-01 00:00:00' },
          { field: 'dt', condition: '<=', data: '2026-01-31 23:59:59' }
        ]
      },
      limit: 1000,  // Test with default limit (max is 5000)
      order: []
    }
    
    console.log('[testCdr] Query built, authenticating...')
    
    const api = cxRest.auth('csiamunyanga@connexcs.com')
    console.log('[testCdr] Calling POST cdr...')
    
    const result = await api.post('cdr', query)
    
    console.log('[testCdr] Got result, type:', typeof result, 'isArray:', Array.isArray(result))
    
    if (!Array.isArray(result)) {
      console.error('[testCdr] FAIL - Result is not an array')
      return {
        tool: 'search_cdr',
        status: 'FAIL',
        error: 'Result is not an array'
      }
    }
    
    console.log('[testCdr] Result count:', result.length)
    
    // Verify structure if we have results
    if (result.length > 0) {
      const firstRecord = result[0]
      console.log('[testCdr] First record keys:', Object.keys(firstRecord).join(', '))
      
      if (!firstRecord.callid && !firstRecord.dt) {
        console.error('[testCdr] FAIL - Missing expected fields')
        return {
          tool: 'search_cdr',
          status: 'FAIL',
          error: 'CDR record missing expected fields (callid or dt)'
        }
      }
    }
    
    console.log('[testCdr] PASS')
    return {
      tool: 'search_cdr',
      status: 'PASS',
      result_count: result.length,
      message: result.length > 0
        ? `Found ${result.length} CDR records from January`
        : 'No completed calls found in January'
    }
  } catch (error) {
    console.error('[testCdr] FAIL - Error:', error.message)
    return {
      tool: 'search_cdr',
      status: 'FAIL',
      error: error.message
    }
  }
}

/**
 * Main entry point for ScriptForge
 */
export async function main () {
  console.log('===== CDR Test Start =====')
  const result = await testCdr()
  console.log('===== CDR Test End =====')
  return result
}
