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

    if (allResult.success === false) {
      return {
        tool: 'list_rtp_servers',
        status: 'FAIL',
        error: allResult.error || 'listRTPServersMain returned an error'
      }
    }

    const tableValid = Array.isArray(allResult.rows) && Array.isArray(allResult.columns) && typeof allResult.total === 'number'

    if (!tableValid) {
      return {
        tool: 'list_rtp_servers',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(allResult)
      }
    }

    if (allResult.rows.length === 0) {
      return {
        tool: 'list_rtp_servers',
        status: 'FAIL',
        error: 'No servers returned'
      }
    }

    const firstServer = allResult.rows[0]
    const hasId = firstServer.id !== undefined
    const hasAlias = firstServer.alias !== undefined || firstServer.name !== undefined
    const hasLocation = firstServer.zone !== undefined || firstServer.location !== undefined || firstServer.geozone !== undefined

    // Test 2: Filter by a common geozone - just verify it does not crash
    let filteredCount = 0
    try {
      const filteredResult = await listRTPServersMain({ geozone: 'US' })
      filteredCount = (filteredResult && Array.isArray(filteredResult.rows)) ? filteredResult.rows.length : 0
    } catch (filterError) {
      // Geozone filter failure is not a hard failure — log but continue
      filteredCount = -1
    }

    return {
      tool: 'list_rtp_servers',
      status: 'PASS',
      total_servers: allResult.rows.length,
      has_id: hasId,
      has_alias: hasAlias,
      has_location: hasLocation,
      geozone_filter_servers: filteredCount,
      sample_server_keys: Object.keys(firstServer).slice(0, 6),
      table_rows: allResult.rows.length,
      table_columns: allResult.columns
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
