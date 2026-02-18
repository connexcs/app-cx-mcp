/**
 * Test for getRtcpQuality functionality
 */

import { searchCdr, getRtcpQuality } from './callDebugTools'

/**
 * Returns a { start, end } date range string for the last N days (UTC, YYYY-MM-DD)
 * @param {number} daysBack
 * @returns {{ start: string, end: string }}
 */
function getDateRange (daysBack) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return { start, end }
}

/**
 * Tests the getRtcpQuality function
 * @returns {Promise<Object>} Test result
 */
export async function testCallQuality () {
  try {
    // Discover a real callid dynamically via CDR (last 3 days)
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'get_call_quality',
        status: 'SKIP',
        error: 'No calls found in last 3 days to test with'
      }
    }

    const callid = cdrResults[0].callid
    if (!callid) {
      return {
        tool: 'get_call_quality',
        status: 'FAIL',
        error: 'Could not extract callid from CDR results'
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
