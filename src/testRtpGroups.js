/**
 * Test for getRtpServerGroups functionality
 */

import { getRtpServerGroupsHandler } from './callDebugTools'

/**
 * Tests the getRtpServerGroups function
 * @returns {Promise<Object>} Test result
 */
export async function testRtpGroups () {
  try {
    const result = await getRtpServerGroupsHandler({})

    if (!result || result.success === false) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: (result && result.error) || 'getRtpServerGroupsHandler returned an error'
      }
    }

    const tableValid = Array.isArray(result.rows) && Array.isArray(result.columns) && typeof result.total === 'number'

    if (!tableValid) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: 'Response missing rows/columns/total',
        response_keys: Object.keys(result)
      }
    }

    if (result.rows.length === 0) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: 'No RTP groups found'
      }
    }

    const firstGroup = result.rows[0]
    return {
      tool: 'get_rtp_server_groups',
      status: 'PASS',
      group_count: result.rows.length,
      has_id: firstGroup.id !== undefined,
      has_name: firstGroup.name !== undefined,
      has_location: firstGroup.location !== undefined,
      first_group: firstGroup.name,
      table_rows: result.rows.length,
      table_columns: result.columns
    }

  } catch (error) {
    return {
      tool: 'get_rtp_server_groups',
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
  return await testRtpGroups()
}
