/**
 * Call Debug MCP Server — Production Ready
 *
 * Independent MCP server for call debugging via real ConnexCS logging endpoints.
 * Follows ConnexCS MCP Server coding standards (see .github/instructions/coding-standards.instructions.md)
 *
 * Run with: cx run callDebugMcp
 *
 * 7 MCP Tools:
 *   1. search_call_logs       — Search logs by phone/IP/date (log) — START HERE to find calls
 *   2. get_sip_trace          — Fetch & analyze SIP trace (log/trace) — PRIMARY debugging tool
 *   3. get_call_quality       — Fetch RTCP quality metrics (log/rtcp)
 *   4. investigate_call       — Full debug: trace + class5 + rtcp
 *   5. get_rtp_server_groups  — List RTP media zones (setup/server/rtp-group)
 *   6. get_transcription      — Get call transcription (transcribe)
 *   7. get_ai_agent_logs      — Get AI agent logs (log/ai-agent)
 *
 * API Endpoints (see .github/instructions/call-debug.instructions.md):
 *   - log?phone={phone}&start={date}&end={date}   → Search call logs
 *   - log/trace?callid={callid}               → SIP trace (always present, 7 days retention)
 *   - log/rtcp?callid={callid}                → RTCP quality (if enabled)
 *   - log/class5?callid={callid}              → Class 5 features (only if used)
 *   - setup/server/rtp-group                  → RTP server groups/zones
 *   - transcribe?s={callid}                   → Call transcription (if enabled)
 *   - log/ai-agent?callid={callid}&d={date}   → AI agent logs (if AI agent was used)
 *
 * Note: ScriptForge scripts are isolated sandboxes and cannot import from other user files.
 * All required endpoint functions are inlined here.
 */

import { McpServer } from 'cxMcpServer'
import cxRest from 'cxRest'

const API_USERNAME = 'csiamunyanga@connexcs.com'

// ============================================================================
// PARAMETER VALIDATION HELPERS
// ============================================================================

/**
 * Validates that a Call-ID parameter is valid
 * @param {*} callid - The Call-ID value to validate
 * @param {string} paramName - Parameter name for error messages (default: 'callid')
 * @throws {Error} If validation fails with detailed correction guidance
 * @returns {void}
 */
function validateCallId (callid, paramName = 'callid') {
  if (!callid) {
    throw new Error(`Parameter "${paramName}" is required but was not provided. Please provide a valid SIP Call-ID from your ConnexCS logging page.`)
  }
  if (typeof callid !== 'string') {
    throw new Error(`Parameter "${paramName}" must be a string, received ${typeof callid}. Please provide the Call-ID as a string value.`)
  }
  if (callid.trim() === '') {
    throw new Error(`Parameter "${paramName}" cannot be an empty string. Please provide a non-empty SIP Call-ID.`)
  }
  if (callid.length > 255) {
    throw new Error(`Parameter "${paramName}" exceeds maximum length of 255 characters (received ${callid.length}). Please provide a valid Call-ID.`)
  }
}

// ============================================================================
// ENDPOINT FUNCTIONS (inlined for ScriptForge isolation)
// ============================================================================

/**
 * Fetches SIP trace messages for a specific call from ConnexCS logging system
 *
 * The trace endpoint returns an array of SIP messages in chronological order.
 * This is the PRIMARY call debugging endpoint — every call that hits the system
 * will have trace data (retained for 7 days).
 *
 * API: GET log/trace?callid={callid}&callidb={callidb}
 *
 * @param {string} callid - The SIP Call-ID to fetch trace for (required, non-empty, max 255 chars)
 * @param {string} [callidb] - Optional encoded internal identifier for the call
 * @returns {Promise<Array<Object>>} Array of SIP message objects containing:
 *   - {number} id - Unique packet ID
 *   - {string} date - Timestamp of the SIP message (ISO 8601)
 *   - {number} micro_ts - Microsecond-precision timestamp
 *   - {string} callid - SIP Call-ID header value
 *   - {string} method - SIP method or response code
 *   - {string} reply_reason - Reason phrase for SIP responses
 *   - {string} source_ip - IP address the packet was sent from
 *   - {number} source_port - Source port
 *   - {string} destination_ip - IP address the packet was sent to
 *   - {number} destination_port - Destination port
 *   - {string} protocol - Transport protocol (UDP, TCP, TLS)
 *   - {string} msg - Full raw SIP message text
 *   - {number} delta - Time delta (microseconds) from previous message
 *   - {string} from_user - From user/number
 *   - {string} to_user - To user/number
 * @throws {Error} If callid is invalid or API request fails
 */
function getSipTrace (callid, callidb) {
  validateCallId(callid, 'callid')

  const api = cxRest.auth(API_USERNAME)
  let url = `log/trace?callid=${encodeURIComponent(callid)}`
  if (callidb) {
    if (typeof callidb !== 'string') {
      throw new Error(`Parameter "callidb" must be a string, received ${typeof callidb}`)
    }
    url += `&callidb=${encodeURIComponent(callidb)}`
  }
  return api.get(url)
}

/**
 * Fetches RTCP quality metrics for a specific call
 *
 * Returns RTT (Round Trip Time), MOS (Mean Opinion Score), Jitter, and Packet Loss data.
 * Only returns data if RTCP was exchanged during the call - both sides must have it enabled.
 *
 * API: GET log/rtcp?callid={callid}
 *
 * @param {string} callid - The SIP Call-ID to fetch RTCP metrics for (required, non-empty, max 255 chars)
 * @returns {Promise<Array<Object>>} Array of RTCP metric objects containing:
 *   - {number} mos - Mean Opinion Score (1-5, higher is better)
 *   - {number} jitter - Jitter in milliseconds
 *   - {number} packet_loss - Packet loss percentage
 *   - {number} rtt - Round Trip Time in milliseconds
 *   - {string} timestamp - When the metric was recorded
 * @throws {Error} If callid is invalid or API request fails
 */
function getRtcpQuality (callid) {
  validateCallId(callid, 'callid')

  const api = cxRest.auth(API_USERNAME)
  return api.get(`log/rtcp?callid=${encodeURIComponent(callid)}`)
}

/**
 * Fetches Class 5 feature logs for a specific call
 *
 * Only contains data if the call used Class 5 features (IVR, conference, queue,
 * voicemail, call recording, etc.). Empty array indicates a pure Class 4 call.
 *
 * API: GET log/class5?callid={callid}
 *
 * @param {string} callid - The SIP Call-ID to fetch Class 5 logs for (required, non-empty, max 255 chars)
 * @returns {Promise<Array<Object>>} Array of Class 5 log entries
 * @throws {Error} If callid is invalid or API request fails
 */
function getClass5Logs (callid) {
  validateCallId(callid, 'callid')

  const api = cxRest.auth(API_USERNAME)
  return api.get(`log/class5?callid=${encodeURIComponent(callid)}`)
}

/**
 * Fetches RTP server groups (media zones) from ConnexCS
 *
 * Returns a list of available RTP server groups/zones used for media routing.
 * Each zone encompasses several servers for high availability.
 * Choose a media server that adds the least latency (close to customer or carrier).
 *
 * API: GET setup/server/rtp-group
 *
 * @returns {Promise<Array<Object>>} Array of RTP server group objects containing:
 *   - {number} id - Group ID
 *   - {string} name - Human-readable name (e.g. "UK (London)", "USA East (New York)")
 *   - {number} status - Active status (1 = active)
 *   - {number} alt - Alternate group ID for failover
 *   - {number} transcoding - Whether transcoding is enabled
 *   - {string} location - Short location code (e.g. lon, ams, nyc, sfo, fra, sgp, blr)
 *   - {number} elastic - Whether this is a dynamic/elastic group (1 = yes)
 *   - {number} max_server_per_sip - Max servers per SIP session (0 = unlimited)
 * @throws {Error} If API request fails
 */
function getRtpServerGroups () {
  const api = cxRest.auth(API_USERNAME)
  return api.get('setup/server/rtp-group')
}

/**
 * Fetches call transcription data from ConnexCS
 *
 * Returns transcription data for a call if transcription was enabled.
 * ONLY returns data if transcription was active for the call.
 * Empty array means no transcription was performed.
 *
 * API: GET transcribe?s={callid}
 *
 * @param {string} callid - The SIP Call-ID to fetch transcription for (required, non-empty, max 255 chars)
 * @returns {Promise<Array<Object>|Object>} Transcription data or empty array if not available
 * @throws {Error} If callid is invalid or API request fails
 */
function getTranscription (callid) {
  validateCallId(callid, 'callid')

  const api = cxRest.auth(API_USERNAME)
  return api.get(`transcribe?s=${encodeURIComponent(callid)}`)
}

/**
 * Fetches AI Agent logs for a specific call from ConnexCS logging system
 *
 * Returns AI Agent interaction logs if an AI Agent was handling the call.
 * ONLY returns data if an AI Agent was involved.
 * Empty array means no AI Agent was used for this call.
 *
 * API: GET log/ai-agent?callid={callid}&d={date}
 *
 * @param {string} callid - The SIP Call-ID to fetch AI Agent logs for (required, non-empty, max 255 chars)
 * @param {string} date - Date in YYYY-MM-DD format (required)
 * @returns {Promise<Array<Object>>} Array of AI Agent log entries (empty if no AI Agent)
 * @throws {Error} If callid is invalid, date is invalid, or API request fails
 */
function getAiAgentLogs (callid, date) {
  validateCallId(callid, 'callid')

  // Validate date format
  if (!date) {
    throw new Error('Parameter "date" is required but was not provided. Please provide a date in YYYY-MM-DD format.')
  }
  if (typeof date !== 'string') {
    throw new Error(`Parameter "date" must be a string, received ${typeof date}. Please provide the date in YYYY-MM-DD format.`)
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    throw new Error(`Parameter "date" must be in YYYY-MM-DD format, received "${date}". Example: 2026-02-09`)
  }

  const api = cxRest.auth(API_USERNAME)
  return api.get(`log/ai-agent?callid=${encodeURIComponent(callid)}&d=${encodeURIComponent(date)}`)
}

/**
 * Searches call logs in ConnexCS logging system
 *
 * The log endpoint provides flexible search across phone numbers, Call-IDs, IP addresses.
 * Returns an array of routing objects with call details including Call-IDs that can be
 * used with other debugging tools (get_sip_trace, investigate_call, etc.)
 *
 * API: GET log?s={search_term}
 *
 * The search parameter (s) searches across:
 * - Phone numbers (CLI/ANI and called number)
 * - Call-IDs (partial or full match)
 * - IP addresses (source/destination)
 *
 * Each result contains:
 * - callid: SIP Call-ID (use with other tools)
 * - callidb: Internal identifier (use with get_sip_trace)
 * - cli: Calling number (from)
 * - ou: Called number (to)
 * - start_time: Unix timestamp
 * - end_time: Unix timestamp
 * - sip_code: Final SIP response code (200, 407, 486, etc.)
 * - sip_reason: SIP response reason phrase
 * - switch: Switch IP address
 * - server: Server IP address
 * - attempts[]: Array of carrier attempts (for connected calls)
 * - routing params, metadata, etc.
 *
 * @param {string} search - Search term (phone number, Call-ID, or IP address)
 * @returns {Promise<Array<Object>>} Array of routing/call log objects
 * @throws {Error} If search parameter is invalid or API request fails
 */
function searchCallLogs (search) {
  if (!search) {
    throw new Error('Parameter "search" is required. Provide a phone number, Call-ID, or IP address to search for.')
  }

  if (typeof search !== 'string') {
    throw new Error(`Parameter "search" must be a string, received ${typeof search}`)
  }

  if (search.trim() === '') {
    throw new Error('Parameter "search" cannot be an empty string.')
  }

  const api = cxRest.auth(API_USERNAME)
  return api.get(`log?s=${encodeURIComponent(search.trim())}`)
}

// ============================================================================
// SIP TRACE ANALYSIS
// ============================================================================

/**
 * @typedef {Object} SipTraceMessage
 * @property {number} id - Unique packet ID
 * @property {string} date - ISO 8601 timestamp
 * @property {string} callid - SIP Call-ID
 * @property {string} method - SIP method or response code
 * @property {string} reply_reason - Reason phrase for responses
 * @property {string} source_ip - Source IP address
 * @property {number} source_port - Source port
 * @property {string} destination_ip - Destination IP address
 * @property {number} destination_port - Destination port
 * @property {string} protocol - Transport protocol
 * @property {string} msg - Raw SIP message
 * @property {number} delta - Time delta from previous message (microseconds)
 * @property {string} from_user - From user/number
 * @property {string} to_user - To user/number
 */

/**
 * @typedef {Object} CallFlowEntry
 * @property {string} time - ISO 8601 timestamp
 * @property {string} label - Human-readable label
 * @property {string} from - Source IP:port
 * @property {string} to - Destination IP:port
 * @property {string} from_user - From user/number
 * @property {string} to_user - To user/number
 * @property {string} protocol - Transport protocol
 * @property {number} delta_ms - Time since previous message in milliseconds
 */

/**
 * @typedef {Object} SipTraceAnalysis
 * @property {number} message_count - Total number of SIP messages
 * @property {string|null} call_id - SIP Call-ID
 * @property {string|null} from_user - Calling party
 * @property {string|null} to_user - Called party
 * @property {string|null} start_time - Call start timestamp
 * @property {string|null} end_time - Call end timestamp
 * @property {number} duration_ms - Total call duration in milliseconds
 * @property {boolean} call_connected - Whether call reached 200 OK
 * @property {boolean} call_terminated - Whether BYE was sent
 * @property {Object|null} final_response - Final error response if call failed
 * @property {number|null} pdd_ms - Post Dial Delay in milliseconds
 * @property {number|null} setup_time_ms - Call setup time in milliseconds
 * @property {boolean} auth_required - Whether authentication was required
 * @property {boolean} nat_detected - Whether NAT was detected
 * @property {string|null} anyedge_host - AnyEdge host if used
 * @property {Array<string>} protocols_used - List of protocols used
 * @property {Array<string>} participants - List of participant IP:port pairs
 * @property {Array<string>} codecs - List of detected codecs
 * @property {Array<CallFlowEntry>} call_flow - Chronological call flow
 * @property {Array<string>} issues - Array of detected issues
 */

/**
 * Analyzes SIP trace messages and produces a structured debug summary
 *
 * Extracts comprehensive call information including:
 * - Call flow with timing and participants
 * - Call quality indicators (PDD, setup time)
 * - Authentication requirements
 * - NAT detection and traversal
 * - Codec negotiation
 * - Retransmission detection
 * - Failure analysis
 *
 * @param {Array<SipTraceMessage>} messages - Array of SIP trace messages from log/trace endpoint
 * @returns {SipTraceAnalysis} Comprehensive analysis object
 * @throws {Error} If messages parameter is invalid
 */
function analyzeSipTrace (messages) {
  if (!Array.isArray(messages)) {
    throw new Error(`Parameter "messages" must be an array, received ${typeof messages}`)
  }

  if (messages.length === 0) {
    return { error: 'No trace data available', message_count: 0 }
  }

  const analysis = {
    message_count: messages.length,
    call_id: messages[0]?.callid || null,
    from_user: messages[0]?.from_user || null,
    to_user: messages[0]?.to_user || null,
    start_time: null,
    end_time: null,
    duration_ms: 0,
    call_connected: false,
    call_terminated: false,
    final_response: null,
    pdd_ms: null,
    setup_time_ms: null,
    auth_required: false,
    nat_detected: false,
    anyedge_host: null,
    protocols_used: [],
    participants: [],
    codecs: [],
    call_flow: [],
    issues: []
  }

  let inviteTime = null
  let firstRingTime = null
  let connectTime = null
  const protocolSet = new Set()
  const participantSet = new Set()
  const codecSet = new Set()
  const methodTracker = {}

  for (const msg of messages) {
    // Build human-readable call flow
    const label = msg.reply_reason
      ? `${msg.method} ${msg.reply_reason}`
      : msg.method

    analysis.call_flow.push({
      time: msg.date,
      label,
      from: `${msg.source_ip}:${msg.source_port}`,
      to: `${msg.destination_ip}:${msg.destination_port}`,
      from_user: msg.from_user,
      to_user: msg.to_user,
      protocol: msg.protocol,
      delta_ms: msg.delta ? +(msg.delta / 1000).toFixed(1) : 0
    })

    // Timing
    if (!analysis.start_time) analysis.start_time = msg.date
    analysis.end_time = msg.date
    const msgTime = new Date(msg.date).getTime()

    // Track protocols & participants
    if (msg.protocol) protocolSet.add(msg.protocol)
    participantSet.add(`${msg.source_ip}:${msg.source_port}`)
    participantSet.add(`${msg.destination_ip}:${msg.destination_port}`)

    // Retransmission tracking
    const trackKey = `${msg.method}|${msg.source_ip}|${msg.destination_ip}`
    methodTracker[trackKey] = (methodTracker[trackKey] || 0) + 1

    // INVITE timing
    if (msg.method === 'INVITE' && !inviteTime) {
      inviteTime = msgTime
    }

    // Auth detection (407/401)
    if (msg.method === '407' || msg.method === '401') {
      analysis.auth_required = true
    }

    // Ringing → PDD calculation
    if ((msg.method === '180' || msg.method === '183') && !firstRingTime) {
      firstRingTime = msgTime
      if (inviteTime) {
        analysis.pdd_ms = firstRingTime - inviteTime
      }
    }

    // 200 OK → call connected
    if (msg.method === '200' && !connectTime && inviteTime) {
      connectTime = msgTime
      analysis.call_connected = true
      analysis.setup_time_ms = connectTime - inviteTime
    }

    // BYE → call terminated
    if (msg.method === 'BYE') {
      analysis.call_terminated = true
    }

    // Error responses (4xx, 5xx)
    const code = parseInt(msg.method, 10)
    if (code >= 400) {
      analysis.final_response = { code, reason: msg.reply_reason || '' }
    }

    // Inspect raw SIP message for special headers and SDP
    if (msg.msg) {
      if (msg.msg.includes('X-CX-NAT')) {
        analysis.nat_detected = true
      }
      const aeMatch = msg.msg.match(/X-AnyEdge-Host:\s*(.+)/i)
      if (aeMatch) {
        analysis.anyedge_host = aeMatch[1].trim()
      }
      // Codec extraction from SDP a=rtpmap lines
      const codecMatches = msg.msg.match(/a=rtpmap:\d+ ([^\r\n/]+)/g)
      if (codecMatches) {
        codecMatches.forEach(m => {
          const codec = m.replace(/a=rtpmap:\d+ /, '').split('/')[0]
          codecSet.add(codec)
        })
      }
    }
  }

  // Finalize sets → arrays
  analysis.protocols_used = [...protocolSet]
  analysis.participants = [...participantSet]
  analysis.codecs = [...codecSet]

  // Duration
  if (analysis.start_time && analysis.end_time) {
    analysis.duration_ms = new Date(analysis.end_time).getTime() - new Date(analysis.start_time).getTime()
  }

  // Issue detection
  if (analysis.pdd_ms && analysis.pdd_ms > 5000) {
    analysis.issues.push(`High Post-Dial Delay: ${analysis.pdd_ms}ms (>5s)`)
  }
  if (!analysis.call_connected && analysis.final_response) {
    analysis.issues.push(`Call failed: ${analysis.final_response.code} ${analysis.final_response.reason}`)
  }
  for (const [key, count] of Object.entries(methodTracker)) {
    if (count > 1 && key.startsWith('INVITE')) {
      analysis.issues.push(`INVITE retransmission detected (${count} copies) — possible network issue`)
    }
  }
  if (analysis.nat_detected) {
    analysis.issues.push('NAT detected — verify media path and Far-End NAT Traversal configuration')
  }

  return analysis
}

// ============================================================================
// TOOL 1: get_sip_trace
// ============================================================================

/**
 * Handler for the get_sip_trace MCP tool
 *
 * Fetches SIP trace messages for a call and performs comprehensive analysis.
 * Returns call flow, timing metrics, authentication details, NAT detection,
 * codec information, and identified issues.
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID (required)
 * @param {string} [args.callidb] - Internal call identifier (optional)
 * @returns {Promise<Object>} Analysis result object containing:
 *   - {boolean} success - Whether the operation succeeded
 *   - {string} callid - The Call-ID that was queried
 *   - {SipTraceAnalysis} [analysis] - Detailed SIP trace analysis (if data found)
 *   - {number} [raw_message_count] - Number of SIP messages
 *   - {Array<SipTraceMessage>} [raw_messages] - Raw SIP messages
 *   - {string} [message] - User-friendly message (if no data)
 *   - {Array<string>} [suggestions] - Troubleshooting suggestions (if no data)
 *   - {string} [error] - Error message (if request failed)
 * @throws {Error} If parameter validation fails
 */
async function getSipTraceHandler (args) {
  const { callid, callidb } = args

  try {
    // Validate parameters
    validateCallId(callid, 'callid')

    // Fetch trace data
    const traceMessages = await getSipTrace(callid, callidb)
    const messages = Array.isArray(traceMessages) ? traceMessages : []

    // Handle empty trace
    if (messages.length === 0) {
      return {
        success: false,
        callid,
        message: 'No SIP trace data found for this Call-ID',
        suggestions: [
          'Verify the Call-ID is correct (check for typos)',
          'Traces are retained for 7 days only - call may be too old',
          'Call may not have reached ConnexCS platform',
          'Try searching in the ConnexCS logging page to verify the call exists'
        ]
      }
    }

    // Analyze trace
    const analysis = analyzeSipTrace(messages)

    return {
      success: true,
      callid,
      analysis,
      raw_message_count: messages.length,
      raw_messages: messages
    }

  } catch (error) {
    return {
      success: false,
      callid,
      error: error.message || 'Unknown error occurred'
    }
  }
}

// ============================================================================
// TOOL 2: get_call_quality
// ============================================================================

/**
 * @typedef {Object} RtcpStatistics
 * @property {number} min - Minimum value
 * @property {number} max - Maximum value
 * @property {number} avg - Average value
 * @property {number} samples - Number of samples
 */

/**
 * @typedef {Object} RtcpQualitySummary
 * @property {string} overall_quality - Overall quality assessment ('good', 'fair', 'poor')
 * @property {RtcpStatistics|null} mos - MOS statistics
 * @property {RtcpStatistics|null} jitter_ms - Jitter statistics in milliseconds
 * @property {RtcpStatistics|null} packet_loss_pct - Packet loss statistics in percentage
 * @property {RtcpStatistics|null} rtt_ms - RTT statistics in milliseconds
 * @property {Array<string>} issues - List of detected quality issues
 * @property {number} sample_count - Total number of RTCP samples
 */

/**
 * Summarizes RTCP quality metrics and identifies issues
 *
 * Calculates min/max/avg statistics for MOS, jitter, packet loss, and RTT.
 * Detects quality issues based on thresholds:
 * - Low MOS: < 3.5
 * - High jitter: > 30ms
 * - Packet loss: > 1%
 * - High RTT: > 300ms
 *
 * @param {Array<Object>} metrics - Array of RTCP metric objects from log/rtcp endpoint
 * @returns {RtcpQualitySummary|null} Summary object with quality assessment, or null if no metrics
 * @throws {Error} If metrics parameter is invalid
 */
function summarizeRtcpMetrics (metrics) {
  if (!Array.isArray(metrics)) {
    throw new Error(`Parameter "metrics" must be an array, received ${typeof metrics}`)
  }

  if (metrics.length === 0) return null

  const values = { mos: [], jitter: [], packet_loss: [], rtt: [] }

  for (const m of metrics) {
    if (m.mos !== undefined && m.mos !== null) values.mos.push(Number(m.mos))
    if (m.jitter !== undefined && m.jitter !== null) values.jitter.push(Number(m.jitter))
    if (m.packet_loss !== undefined && m.packet_loss !== null) values.packet_loss.push(Number(m.packet_loss))
    if (m.rtt !== undefined && m.rtt !== null) values.rtt.push(Number(m.rtt))
  }

  /**
   * Calculates statistics for an array of numbers
   * @param {Array<number>} arr - Array of numeric values
   * @returns {RtcpStatistics|null} Statistics object or null if empty
   */
  function stats (arr) {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2),
      samples: arr.length
    }
  }

  const mosStats = stats(values.mos)
  const jitterStats = stats(values.jitter)
  const packetLossStats = stats(values.packet_loss)
  const rttStats = stats(values.rtt)

  const issues = []
  if (mosStats && mosStats.avg < 3.5) issues.push(`Low MOS: ${mosStats.avg} (< 3.5 threshold)`)
  if (jitterStats && jitterStats.avg > 30) issues.push(`High jitter: ${jitterStats.avg}ms (> 30ms threshold)`)
  if (packetLossStats && packetLossStats.avg > 1) issues.push(`Packet loss: ${packetLossStats.avg}% (> 1% threshold)`)
  if (rttStats && rttStats.avg > 300) issues.push(`High RTT: ${rttStats.avg}ms (> 300ms threshold)`)

  return {
    overall_quality: issues.length === 0 ? 'good' : issues.length <= 1 ? 'fair' : 'poor',
    mos: mosStats,
    jitter_ms: jitterStats,
    packet_loss_pct: packetLossStats,
    rtt_ms: rttStats,
    issues: issues.length > 0 ? issues : ['No quality issues detected'],
    sample_count: metrics.length
  }
}

/**
 * Handler for the get_call_quality MCP tool
 *
 * Fetches RTCP quality metrics for a call and summarizes the quality assessment.
 * RTCP data is only available if both call endpoints had RTCP enabled.
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID (required)
 * @returns {Promise<Object>} Quality result object containing:
 *   - {boolean} success - Whether the operation succeeded
 *   - {string} callid - The Call-ID that was queried
 *   - {boolean} has_rtcp - Whether RTCP data was available
 *   - {RtcpQualitySummary} [summary] - Quality summary (if RTCP available)
 *   - {number} [metrics_count] - Number of RTCP data points
 *   - {Array<Object>} [raw_metrics] - Raw RTCP metrics
 *   - {string} [message] - User-friendly message (if no RTCP)
 *   - {string} [error] - Error message (if request failed)
 * @throws {Error} If parameter validation fails
 */
async function getCallQualityHandler (args) {
  const { callid } = args

  try {
    // Validate parameters
    validateCallId(callid, 'callid')

    // Fetch RTCP data
    const rtcpData = await getRtcpQuality(callid)
    const metrics = Array.isArray(rtcpData) ? rtcpData : []

    // Handle no RTCP data
    if (metrics.length === 0) {
      return {
        success: true,
        callid,
        has_rtcp: false,
        message: 'No RTCP data available - RTCP must be enabled on both call endpoints'
      }
    }

    // Summarize quality
    const summary = summarizeRtcpMetrics(metrics)

    return {
      success: true,
      callid,
      has_rtcp: true,
      summary,
      metrics_count: metrics.length,
      raw_metrics: metrics
    }

  } catch (error) {
    return {
      success: false,
      callid,
      error: error.message || 'Unknown error occurred'
    }
  }
}

// ============================================================================
// TOOL 3: investigate_call
// ============================================================================

/**
 * Builds a human-readable debug summary from investigation results
 *
 * Creates a multi-line text summary highlighting key information:
 * - Call type (Class 4 vs Class 5)
 * - Call participants and connection status
 * - Timing metrics (setup time, PDD)
 * - Quality assessment (if RTCP available)
 * - Detected issues
 *
 * @param {Object} result - Investigation result object
 * @returns {string} Multi-line summary text
 */
function buildDebugSummary (result) {
  const lines = []
  lines.push(`Call Type: ${result.call_type || 'unknown'}`)

  if (result.trace?.available && result.trace.analysis) {
    const a = result.trace.analysis
    lines.push(`From: ${a.from_user || '?'} → To: ${a.to_user || '?'}`)
    lines.push(`Connected: ${a.call_connected ? 'Yes' : 'No'}`)
    if (a.call_connected) lines.push(`Setup: ${a.setup_time_ms}ms`)
    if (a.pdd_ms !== null) lines.push(`PDD: ${a.pdd_ms}ms`)
    if (a.final_response && !a.call_connected) lines.push(`Failed: ${a.final_response.code} ${a.final_response.reason}`)
    if (a.auth_required) lines.push('Auth: Required')
    if (a.nat_detected) lines.push('NAT: Detected')
    if (a.codecs.length > 0) lines.push(`Codecs: ${a.codecs.join(', ')}`)
  }

  if (result.rtcp?.available && result.rtcp.summary) {
    const q = result.rtcp.summary
    lines.push(`Quality: ${q.overall_quality.toUpperCase()}`)
    if (q.mos) lines.push(`  MOS: ${q.mos.avg}`)
    if (q.jitter_ms) lines.push(`  Jitter: ${q.jitter_ms.avg}ms`)
  }

  if (result.issues.length > 0) {
    lines.push('', '--- Issues ---')
    result.issues.forEach((iss, i) => lines.push(`${i + 1}. ${iss}`))
  } else {
    lines.push('', 'No issues detected.')
  }

  return lines.join('\n')
}

/**
 * Handler for the investigate_call MCP tool
 *
 * Performs comprehensive call investigation by fetching and analyzing:
 * 1. SIP trace (call flow, timing, issues)
 * 2. Class 5 logs (determines if call used advanced features)
 * 3. RTCP quality (audio quality metrics if available)
 *
 * All three endpoints are queried and results are combined into a unified
 * investigation report with actionable insights.
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID (required)
 * @param {string} [args.callidb] - Internal call identifier (optional)
 * @returns {Promise<Object>} Investigation result object containing:
 *   - {boolean} success - Whether the operation succeeded
 *   - {string} callid - The Call-ID that was investigated
 *   - {string} call_type - Call classification ('class4', 'class5', or null)
 *   - {Object} trace - SIP trace results with analysis
 *   - {Object} class5 - Class 5 logs results
 *   - {Object} rtcp - RTCP quality results with summary
 *   - {Array<string>} issues - Aggregated list of all detected issues
 *   - {string} debug_summary - Human-readable multi-line summary
 * @throws {Error} If parameter validation fails
 */
async function investigateCallHandler (args) {
  const { callid, callidb } = args

  // Validate parameters
  validateCallId(callid, 'callid')

  const result = {
    success: true,
    callid,
    call_type: null,
    trace: null,
    class5: null,
    rtcp: null,
    issues: [],
    debug_summary: null
  }

  // 1. SIP trace
  try {
    const traceMessages = await getSipTrace(callid, callidb)
    const messages = Array.isArray(traceMessages) ? traceMessages : []

    if (messages.length === 0) {
      result.trace = { available: false }
      result.issues.push('No SIP trace data found')
    } else {
      const analysis = analyzeSipTrace(messages)
      result.trace = { available: true, analysis, raw_message_count: messages.length, raw_messages: messages }
      if (analysis.issues && analysis.issues.length > 0) result.issues.push(...analysis.issues)
    }
  } catch (error) {
    result.trace = { available: false, error: error.message }
    result.issues.push(`Trace error: ${error.message}`)
  }

  // 2. Class 5
  try {
    const class5Data = await getClass5Logs(callid)
    const class5Records = Array.isArray(class5Data) ? class5Data : []

    if (class5Records.length > 0) {
      result.call_type = 'class5'
      result.class5 = { available: true, records: class5Records }
    } else {
      result.call_type = 'class4'
      result.class5 = { available: false }
    }
  } catch (error) {
    result.class5 = { available: false, error: error.message }
  }

  // 3. RTCP
  try {
    const rtcpData = await getRtcpQuality(callid)
    const metrics = Array.isArray(rtcpData) ? rtcpData : []

    if (metrics.length > 0) {
      const summary = summarizeRtcpMetrics(metrics)
      result.rtcp = { available: true, summary, metrics_count: metrics.length, raw_metrics: metrics }
      if (summary && summary.issues) {
        result.issues.push(...summary.issues.filter(i => !i.includes('No quality issues')))
      }
    } else {
      result.rtcp = { available: false }
    }
  } catch (error) {
    result.rtcp = { available: false, error: error.message }
  }

  // 4. Debug summary
  result.debug_summary = buildDebugSummary(result)

  return result
}

/**
 * MCP tool handler for get_rtp_server_groups
 *
 * Returns list of RTP server groups/zones for media routing
 *
 * @param {Object} args - Tool arguments (none required)
 * @returns {Promise<Object>} Handler response with RTP server group data
 */
async function getRtpServerGroupsHandler (args) {
  try {
    const groups = await getRtpServerGroups()
    const groupArray = Array.isArray(groups) ? groups : []

    return {
      success: true,
      group_count: groupArray.length,
      groups: groupArray,
      summary: `Found ${groupArray.length} RTP server groups/zones available for media routing`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * MCP tool handler for get_transcription
 *
 * Returns call transcription data if available
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID
 * @returns {Promise<Object>} Handler response with transcription data
 */
async function getTranscriptionHandler (args) {
  const { callid } = args

  try {
    validateCallId(callid, 'callid')

    const transcription = await getTranscription(callid)
    const hasData = transcription && (Array.isArray(transcription) ? transcription.length > 0 : Object.keys(transcription).length > 0)

    return {
      success: true,
      callid,
      has_transcription: hasData,
      transcription: hasData ? transcription : null,
      message: hasData
        ? 'Transcription data available'
        : 'No transcription data available — transcription must be enabled for the call'
    }
  } catch (error) {
    return {
      success: false,
      callid,
      error: error.message
    }
  }
}

/**
 * MCP tool handler for get_ai_agent_logs
 *
 * Returns AI Agent interaction logs if available
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID
 * @param {string} args.date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Handler response with AI Agent log data
 */
async function getAiAgentLogsHandler (args) {
  const { callid, date } = args

  try {
    validateCallId(callid, 'callid')

    const logs = await getAiAgentLogs(callid, date)
    const logArray = Array.isArray(logs) ? logs : []

    return {
      success: true,
      callid,
      date,
      has_ai_agent: logArray.length > 0,
      log_count: logArray.length,
      logs: logArray,
      message: logArray.length > 0
        ? `Found ${logArray.length} AI Agent log entries`
        : 'No AI Agent logs found — call did not involve an AI Agent'
    }
  } catch (error) {
    return {
      success: false,
      callid,
      date,
      error: error.message
    }
  }
}

// ============================================================================
// TOOL 7: search_call_logs
// ============================================================================

/**
 * Handler for the search_call_logs MCP tool
 *
 * Searches the ConnexCS logging system to find calls matching the specified criteria.
 * Returns a list of calls with basic information including Call-IDs that can then
 * be used with other debugging tools (get_sip_trace, investigate_call, etc.).
 *
 * Typical workflow:
 * 1. Use search_call_logs to find calls by phone number, IP, or date
 * 2. Get Call-IDs from the results
 * 3. Use those Call-IDs with get_sip_trace or investigate_call for detailed debugging
 *
 * @param {Object} args - Tool arguments
 * @param {string} [args.phone_number] - Phone number to search (source or destination)
 * @param {string} [args.callid] - Exact Call-ID match
 * @param {string} [args.source_ip] - Source IP address
 * @param {string} [args.start_date] - Start date/time
 * @param {string} [args.end_date] - End date/time
 * @param {number} [args.limit=100] - Maximum results (1-1000)
 * @param {number} [args.offset=0] - Pagination offset
 * @returns {Promise<Object>} Search results containing:
 *   - {boolean} success - Whether the operation succeeded
 *   - {number} result_count - Number of calls found
 *   - {Array<Object>} calls - Array of call records with Call-IDs
 *   - {Object} search_criteria - Echo of search parameters used
 *   - {string} [message] - User-friendly message
 *   - {string} [error] - Error message (if request failed)
 */
async function searchCallLogsHandler (args) {
  const { search } = args

  try {
    const results = await searchCallLogs(search)
    const callArray = Array.isArray(results) ? results : []

    return {
      success: true,
      result_count: callArray.length,
      calls: callArray,
      search_term: search,
      message: callArray.length > 0
        ? `Found ${callArray.length} matching call(s). Each result contains 'callid' and 'callidb' — use these with get_sip_trace or investigate_call for detailed debugging.`
        : `No calls found matching "${search}". Try a different phone number, Call-ID, or IP address.`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      search_term: search
    }
  }
}

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

const mcp = new McpServer('ConnexCS Call Debug', '1.0.0', true)

mcp.addTool(
  'get_sip_trace',
  'Fetch and analyze SIP trace for a call. Returns full SIP flow with timing, auth, NAT detection, codecs, and identified issues. PRIMARY debugging tool — every call has trace data (7 days retention). Use this first when debugging any call. Endpoint: log/trace',
  getSipTraceHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('callidb', 'string', 'Internal call identifier (optional)', false)

mcp.addTool(
  'get_call_quality',
  'Fetch RTCP quality metrics for a call. Returns MOS (Mean Opinion Score), jitter, packet loss, and RTT statistics with quality assessment. Only available if RTCP was enabled on both call endpoints. Use to diagnose audio quality issues. Endpoint: log/rtcp',
  getCallQualityHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)

mcp.addTool(
  'investigate_call',
  'Perform comprehensive call investigation combining SIP trace + Class 5 logs + RTCP quality. Determines call type (Class 4 vs Class 5), analyzes full call flow, checks quality metrics, and provides unified debug summary with all identified issues. Use as single-command full investigation. Endpoints: log/trace + log/class5 + log/rtcp',
  investigateCallHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('callidb', 'string', 'Internal call identifier (optional)', false)

mcp.addTool(
  'get_rtp_server_groups',
  'Fetch list of RTP server groups/zones for media routing. Returns all available media zones (London, New York, Singapore, etc.) with their IDs, locations, and configurations. Use to understand where media is routed and choose optimal media server locations. Useful for diagnosing media quality issues and latency. Endpoint: setup/server/rtp-group',
  getRtpServerGroupsHandler
)

mcp.addTool(
  'get_transcription',
  'Fetch transcription data for a call. Returns text transcription if transcription was enabled on the call. Only returns data if transcription was active. Use to review call contents for quality assurance, training, or compliance. Endpoint: transcribe',
  getTranscriptionHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)

mcp.addTool(
  'get_ai_agent_logs',
  'Fetch AI Agent interaction logs for a call. Returns AI Agent logs if an AI Agent was handling the call. Only returns data if AI Agent was involved. Use to debug AI-assisted calls and review agent behavior. Requires date parameter in YYYY-MM-DD format. Endpoint: log/ai-agent',
  getAiAgentLogsHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('date', 'string', 'Date in YYYY-MM-DD format (e.g. 2026-02-09)', true)

mcp.addTool(
  'search_call_logs',
  'Search ConnexCS call logs by phone number, Call-ID, or IP address. Returns routing objects with full call details including Call-IDs. **START HERE** to find calls before debugging. Use the returned "callid" and "callidb" with get_sip_trace or investigate_call. The search is flexible — searches across CLI, called numbers, Call-IDs, and IP addresses. Endpoint: log?s={search}',
  searchCallLogsHandler
)
  .addParameter('search', 'string', 'Phone number, Call-ID, or IP address to search for', true)

/**
 * Main entry point for the MCP server
 *
 * Handles incoming MCP requests and routes them to the appropriate tool handler.
 *
 * @param {Object} data - MCP request data from client
 * @returns {Promise<Object>} MCP response object
 * @throws {Error} If MCP handling fails
 */
export function main (data) {
  return mcp.handle(data)
}
