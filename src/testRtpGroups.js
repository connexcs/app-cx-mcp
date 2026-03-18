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

    if (!result || !result.success) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: (result && result.error) || 'getRtpServerGroupsHandler returned success: false'
      }
    }

    const groups = result.groups || []

    if (groups.length === 0) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: 'No RTP groups found'
      }
    }

    const tableValid = result._table !== null && result._table !== undefined
      && Array.isArray(result._table.rows) && result._table.rows.length > 0
      && Array.isArray(result._table.columns)
      && typeof result._table.total === 'number'

    if (!tableValid) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: '_table missing or malformed on getRtpServerGroupsHandler result',
        has_table: !!result._table
      }
    }

    const firstGroup = groups[0]
    return {
      tool: 'get_rtp_server_groups',
      status: 'PASS',
      group_count: groups.length,
      has_id: firstGroup.id !== undefined,
      has_name: firstGroup.name !== undefined,
      has_location: firstGroup.location !== undefined,
      first_group: firstGroup.name,
      table_rows: result._table.rows.length,
      table_columns: result._table.columns
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
