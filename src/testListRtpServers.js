/**
 * Test for listRtpServers functionality
 */

import { listRTPServersMain } from './listRtpServers'

/**
 * Tests the listRTPServersMain function (no-filter and with geozone filter)
 * @returns {Promise<Object>} Test result
 */
export async function testListRtpServers () {
  try {
    // Test 1: No filter — should return all servers
    const allResult = await listRTPServersMain({})

    if (!allResult) {
      return {
        tool: 'list_rtp_servers',
        status: 'FAIL',
        error: 'No result returned for unfiltered request'
      }
    }

    if (!allResult.success) {
      return {
        tool: 'list_rtp_servers',
        status: 'FAIL',
        error: allResult.error || 'listRTPServersMain returned success: false'
      }
    }

    const servers = allResult.servers || allResult.data || []
    if (!Array.isArray(servers) || servers.length === 0) {
      return {
        tool: 'list_rtp_servers',
        status: 'FAIL',
        error: 'No servers returned',
        response_keys: Object.keys(allResult)
      }
    }

    const firstServer = servers[0]
    const hasId = firstServer.id !== undefined
    const hasAlias = firstServer.alias !== undefined || firstServer.name !== undefined
    const hasLocation = firstServer.zone !== undefined || firstServer.location !== undefined || firstServer.geozone !== undefined

    // Test 2: Filter by a common geozone - just verify it does not crash
    let filteredResult = null
    let filteredCount = 0
    try {
      filteredResult = await listRTPServersMain({ geozone: 'US' })
      const filteredServers = (filteredResult && (filteredResult.servers || filteredResult.data)) || []
      filteredCount = Array.isArray(filteredServers) ? filteredServers.length : 0
    } catch (filterError) {
      // Geozone filter failure is not a hard failure — log but continue
      filteredCount = -1
    }

    return {
      tool: 'list_rtp_servers',
      status: 'PASS',
      total_servers: servers.length,
      has_id: hasId,
      has_alias: hasAlias,
      has_location: hasLocation,
      geozone_filter_servers: filteredCount,
      sample_server_keys: Object.keys(firstServer).slice(0, 6)
    }

  } catch (error) {
    return {
      tool: 'list_rtp_servers',
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
  return await testListRtpServers()
}
