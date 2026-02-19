/**
 * Test for getAiAgentLogs functionality
 */

import { searchCdr, getAiAgentLogs, getDateRange } from './callDebugTools'

/**
 * Tests the getAiAgentLogs function
 * @returns {Promise<Object>} Test result
 */
export async function testAiAgent () {
  try {
    // Discover a real callid dynamically via CDR (last 3 days)
    const { start, end } = getDateRange(3)
    const cdrResults = await searchCdr(start, end, { limit: 10 })

    if (!cdrResults || cdrResults.length === 0) {
      return {
        tool: 'get_ai_agent_logs',
        status: 'SKIP',
        error: 'No calls found in last 3 days to test with'
      }
    }

    const callid = cdrResults[0].callid
    if (!callid) {
      return {
        tool: 'get_ai_agent_logs',
        status: 'FAIL',
        error: 'Could not extract callid from CDR results'
      }
    }

    // Use the CDR record date for the AI logs query
    const cdrDate = cdrResults[0].start_date
    const dateStr = cdrDate ? cdrDate.split('T')[0] : end
    
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
