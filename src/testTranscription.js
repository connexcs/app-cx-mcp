/**
 * Test for getTranscription functionality
 */

import { searchCdr, getTranscription } from './callDebugTools'

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
 * Tests the getTranscription function
 * @returns {Promise<Object>} Test result
 */
export async function testTranscription () {
  try {
    // Discover a real callid dynamically via CDR (last 3 days)
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'get_transcription',
        status: 'SKIP',
        error: 'No calls found in last 3 days to test with'
      }
    }

    const callid = cdrResults[0].callid
    if (!callid) {
      return {
        tool: 'get_transcription',
        status: 'FAIL',
        error: 'Could not extract callid from CDR results'
      }
    }
    
    // Test getTranscription
    const transcription = await getTranscription(callid)
    
    if (transcription === null || transcription === undefined) {
      return {
        tool: 'get_transcription',
        status: 'FAIL',
        error: 'No transcription data returned'
      }
    }
    
    // Transcription may be empty array or object
    const hasData = Array.isArray(transcription) 
      ? transcription.length > 0 
      : Object.keys(transcription).length > 0
    
    return {
      tool: 'get_transcription',
      status: 'PASS',
      has_data: hasData,
      data_type: Array.isArray(transcription) ? 'array' : 'object',
      note: hasData ? 'Transcription data available' : 'No transcription (not enabled for this call)',
      callid: callid
    }
    
  } catch (error) {
    return {
      tool: 'get_transcription',
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
  return await testTranscription()
}
