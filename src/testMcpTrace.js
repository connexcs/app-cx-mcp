import cxRest from 'cxRest'

/**
 * Test the get_ai_agent_logs MCP tool
 *
 * @returns {Promise<Object>} Test result
 */
export async function main () {
  const testCallId = '419662770-1228314302-2103574869'
  const testDate = '2026-02-06'

  console.log('Testing get_ai_agent_logs with Call-ID:', testCallId, 'and date:', testDate)

  const api = cxRest.auth('csiamunyanga@connexcs.com')

  const mcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_ai_agent_logs',
      arguments: {
        callid: testCallId,
        date: testDate
      }
    }
  }

  const response = await api.post('scriptforge/019bdb30-eed0-739f-b6af-6b34a300b164/callDebugMcp', mcpRequest)

  console.log('Response:', JSON.stringify(response, null, 2))

  return response
}
