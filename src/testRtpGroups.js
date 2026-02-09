/**
 * Test for getRtpServerGroups functionality
 */

import { getRtpServerGroups } from './callDebugTools'

/**
 * Tests the getRtpServerGroups function
 * @returns {Promise<Object>} Test result
 */
export async function testRtpGroups () {
  try {
    console.log('Testing getRtpServerGroups...')
    
    const groups = await getRtpServerGroups()
    
    if (!groups || !Array.isArray(groups)) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: 'Groups is not an array'
      }
    }
    
    if (groups.length === 0) {
      return {
        tool: 'get_rtp_server_groups',
        status: 'FAIL',
        error: 'No RTP groups found'
      }
    }
    
    // Verify structure of first group
    const firstGroup = groups[0]
    const hasId = firstGroup.id !== undefined
    const hasName = firstGroup.name !== undefined
    const hasLocation = firstGroup.location !== undefined
    
    return {
      tool: 'get_rtp_server_groups',
      status: 'PASS',
      group_count: groups.length,
      has_id: hasId,
      has_name: hasName,
      has_location: hasLocation,
      first_group: firstGroup.name
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
