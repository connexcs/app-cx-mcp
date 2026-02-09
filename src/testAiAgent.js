/**
 * Test for getAiAgentLogs functionality
 */

import { searchCallLogs, getAiAgentLogs } from './callDebugTools'

/**
 * Tests the getAiAgentLogs function
 * @returns {Promise<Object>} Test result
 */
export async function testAiAgent () {
  try {
    console.log('Testing getAiAgentLogs...')
    
    // First search for a call
    const searchResults = await searchCallLogs('3002')
    if (!searchResults || searchResults.length === 0) {
      return {
        tool: 'get_ai_agent_logs',
        status: 'SKIP',
        error: 'No calls found to test with'
      }
    }
    
    const firstCall = searchResults[0]
    const callid = firstCall.callid
    
    if (!callid) {
      return {
        tool: 'get_ai_agent_logs',
        status: 'FAIL',
        error: 'Could not extract callid from search results'
      }
    }
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    
    // Test getAiAgentLogs
    const aiLogs = await getAiAgentLogs(callid, dateStr)
    
    if (!aiLogs) {
      return {
        tool: 'get_ai_agent_logs',
        status: 'FAIL',
        error: 'No AI agent data returned'
      }
    }
    
    if (!Array.isArray(aiLogs)) {
      return {
        tool: 'get_ai_agent_logs',
        status: 'FAIL',
        error: 'AI agent data is not an array'
      }
    }
    
    // AI agent data may be empty (only for AI agent calls)
    return {
      tool: 'get_ai_agent_logs',
      status: 'PASS',
      ai_log_count: aiLogs.length,
      has_data: aiLogs.length > 0,
      note: aiLogs.length === 0 ? 'No AI agent data (AI not used for this call)' : 'AI agent data available',
      date: dateStr,
      callid: callid
    }
    
  } catch (error) {
    return {
      tool: 'get_ai_agent_logs',
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
  return await testAiAgent()
}
