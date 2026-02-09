/**
 * Test for getTranscription functionality
 */

import { searchCallLogs, getTranscription } from './callDebugTools'

/**
 * Tests the getTranscription function
 * @returns {Promise<Object>} Test result
 */
export async function testTranscription () {
  try {
    console.log('Testing getTranscription...')
    
    // First search for a call
    const searchResults = await searchCallLogs('3002')
    if (!searchResults || searchResults.length === 0) {
      return {
        tool: 'get_transcription',
        status: 'SKIP',
        error: 'No calls found to test with'
      }
    }
    
    const firstCall = searchResults[0]
    const callid = firstCall.routing ? firstCall.routing.callid : null
    
    if (!callid) {
      return {
        tool: 'get_transcription',
        status: 'FAIL',
        error: 'Could not extract callid from search results'
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
