import cxRest from 'cxRest'

/**
 * Tests ConnexCS logging endpoints to verify API connectivity and response formats
 *
 * Tests the following endpoints:
 * 1. setup/server/rtp-group - RTP server zones (no callid needed)
 * 2. log/trace - SIP trace messages (requires callid)
 * 3. log/rtcp - RTCP quality metrics (requires callid)
 * 4. log/class5 - Class 5 feature logs (requires callid)
 *
 * @returns {Promise<Object>} Test results object containing responses from all endpoints
 * @throws {Error} If authentication fails
 * @throws {Error} If any endpoint request fails
 */
export async function main () {
  console.log('=== ConnexCS Logging Endpoints Test ===\n')

  const api = cxRest.auth('csiamunyanga@connexcs.com')
  const results = {}

  // Test 1: RTP Groups (no callid needed)
  console.log('Test 1: Fetching RTP server groups...')
  try {
    const rtpGroups = await api.get('setup/server/rtp-group')
    results.rtpGroups = {
      success: true,
      count: rtpGroups.length,
      data: rtpGroups
    }
    console.log(`✅ RTP Groups: Found ${rtpGroups.length} server zones\n`)
  } catch (error) {
    results.rtpGroups = {
      success: false,
      error: error.message
    }
    console.log(`❌ RTP Groups failed: ${error.message}\n`)
  }

  // Test 2: SIP Trace (requires callid)
  // Replace with a real Call-ID from your ConnexCS logging page
  const testCallId = '419662770-1228314302-2103574869'

  console.log(`Test 2: Fetching SIP trace for callid: ${testCallId}...`)
  try {
    const sipTrace = await api.get(`log/trace?callid=${testCallId}`)
    results.sipTrace = {
      success: true,
      messageCount: sipTrace.length,
      data: sipTrace
    }
    console.log(`✅ SIP Trace: Found ${sipTrace.length} SIP messages\n`)
  } catch (error) {
    results.sipTrace = {
      success: false,
      error: error.message,
      note: 'Replace testCallId with a real Call-ID from ConnexCS logging'
    }
    console.log(`❌ SIP Trace failed: ${error.message}`)
    console.log('   Note: Replace testCallId with a real Call-ID\n')
  }

  // Test 3: RTCP Quality (requires callid)
  console.log(`Test 3: Fetching RTCP quality metrics for callid: ${testCallId}...`)
  try {
    const rtcpQuality = await api.get(`log/rtcp?callid=${testCallId}`)
    results.rtcpQuality = {
      success: true,
      dataPoints: rtcpQuality.length,
      data: rtcpQuality
    }
    if (rtcpQuality.length === 0) {
      console.log('⚠️  RTCP Quality: No data (call may not have RTCP enabled)\n')
    } else {
      console.log(`✅ RTCP Quality: Found ${rtcpQuality.length} data points\n`)
    }
  } catch (error) {
    results.rtcpQuality = {
      success: false,
      error: error.message,
      note: 'Replace testCallId with a real Call-ID from ConnexCS logging'
    }
    console.log(`❌ RTCP Quality failed: ${error.message}\n`)
  }

  // Test 4: Class 5 Logs (requires callid)
  console.log(`Test 4: Fetching Class 5 logs for callid: ${testCallId}...`)
  try {
    const class5Logs = await api.get(`log/class5?callid=${testCallId}`)
    results.class5Logs = {
      success: true,
      hasData: class5Logs.length > 0,
      data: class5Logs
    }
    if (class5Logs.length === 0) {
      console.log('⚠️  Class 5 Logs: Empty (call was Class 4, not Class 5)\n')
    } else {
      console.log(`✅ Class 5 Logs: Found ${class5Logs.length} log entries\n`)
    }
  } catch (error) {
    results.class5Logs = {
      success: false,
      error: error.message,
      note: 'Replace testCallId with a real Call-ID from ConnexCS logging'
    }
    console.log(`❌ Class 5 Logs failed: ${error.message}\n`)
  }

  // Summary
  console.log('=== Test Summary ===')
  const successCount = Object.values(results).filter(r => r.success).length
  const totalTests = Object.keys(results).length
  console.log(`Passed: ${successCount}/${totalTests} tests`)

  return results
}