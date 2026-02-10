/**
 * Call Debug Tools — Endpoint Functions
 * 
 * Real ConnexCS logging endpoints for call debugging:
 *   - log/trace            ? SIP Trace (primary, always present)
 *   - log/class5           ? Class 5 logs (IVR, conference, queue, etc.)
 *   - log/rtcp             ? RTCP quality metrics (MOS, jitter, packet loss, RTT)
 *   - transcribe           ? Call transcription
 *   - log/ai-agent         ? AI Agent interaction logs
 *   - setup/server/rtp-group ? RTP server groups/zones
 * 
 * See .github/instructions/call-debug.instructions.md for full documentation.
 */

import cxRest from 'cxRest'

/**
 * Get authenticated API client.
 * Requires API_USERNAME environment variable to be set.
 * @returns {Object} Authenticated cxRest API client
 * @throws {Error} If API_USERNAME environment variable is not set
 */
function getApi () {
	const apiUsername = process.env.API_USERNAME
	
	if (!apiUsername || apiUsername.trim() === '') {
		throw new Error(
			'API_USERNAME environment variable is required but not set. ' +
			'Please set API_USERNAME in your environment variables to authenticate with ConnexCS API.'
		)
	}
	
	return cxRest.auth(apiUsername)
}

// ============================================================================
// CORE ENDPOINT FUNCTIONS
// ============================================================================

/**
 * Fetch SIP trace for a call.
 * GET log/trace?callid={callid}&callidb={callidb}
 * 
 * PRIMARY debug endpoint — every call that hits the system has trace data.
 * Returns array of SIP messages in chronological order.
 */
export function getSipTrace(callid, callidb) {
	const api = getApi()
	let url = `log/trace?callid=${encodeURIComponent(callid)}`
	if (callidb) url += `&callidb=${encodeURIComponent(callidb)}`
	return api.get(url)
}

/**
 * Fetch RTCP quality metrics for a call.
 * GET log/rtcp?callid={callid}
 * 
 * Returns RTT, MOS, Jitter, Packet Loss data.
 * Only returns data if RTCP was exchanged during the call.
 */
export function getRtcpQuality(callid) {
	const api = getApi()
	return api.get(`log/rtcp?callid=${encodeURIComponent(callid)}`)
}

/**
 * Fetch Class 5 logs for a call.
 * GET log/class5?callid={callid}
 * 
 * Only contains data if the call used Class 5 features (IVR, conference, queue, etc.).
 * Empty array = pure Class 4 call.
 */
export function getClass5Logs(callid) {
	const api = getApi()
	return api.get(`log/class5?callid=${encodeURIComponent(callid)}`)
}

/**
 * Fetch call transcription.
 * GET transcribe?s={callid}
 */
export function getTranscription(callid) {
	const api = getApi()
	return api.get(`transcribe?s=${encodeURIComponent(callid)}`)
}

/**
 * Fetch AI Agent interaction logs.
 * GET log/ai-agent?callid={callid}&d={date}
 * @param {string} date - Date in YYYY-MM-DD format (required)
 */
export function getAiAgentLogs(callid, date) {
	const api = getApi()
	return api.get(`log/ai-agent?callid=${encodeURIComponent(callid)}&d=${date}`)
}

/**
 * Search call logs by phone number, Call-ID, or IP address.
 * GET log?s={search}
 * 
 * Flexible search endpoint — returns array of matching call records.
 * Each result contains callid, callidb, and other call metadata.
 * 
 * @param {string} search - Phone number, Call-ID, or IP address to search for
 * @returns {Promise<Array<Object>>} Array of matching call records
 */
export function searchCallLogs (search) {
	if (!search || typeof search !== 'string' || search.trim() === '') {
		throw new Error('search parameter is required and must be a non-empty string')
	}
	const api = getApi()
	return api.get(`log?s=${encodeURIComponent(search)}`)
}

/**
 * Fetch RTP server groups/zones.
 * GET setup/server/rtp-group
 * 
 * Reference endpoint — no callid needed.
 */
export function getRtpServerGroups () {
	const api = getApi()
	return api.get('setup/server/rtp-group')
}

// ============================================================================
// SIP TRACE ANALYSIS
// ============================================================================

/**
 * Analyze SIP trace messages and produce a structured debug summary.
 * 
 * Extracts: call flow, timing (PDD, setup time), auth, NAT detection,
 * codecs, retransmissions, failure reasons, participants.
 */
export function analyzeSipTrace(messages) {
	if (!Array.isArray(messages) || messages.length === 0) {
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

		// Ringing ? PDD calculation
		if ((msg.method === '180' || msg.method === '183') && !firstRingTime) {
			firstRingTime = msgTime
			if (inviteTime) {
				analysis.pdd_ms = firstRingTime - inviteTime
			}
		}

		// 200 OK ? call connected
		if (msg.method === '200' && !connectTime && inviteTime) {
			connectTime = msgTime
			analysis.call_connected = true
			analysis.setup_time_ms = connectTime - inviteTime
		}

		// BYE ? call terminated
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

	// Finalize sets ? arrays
	analysis.protocols_used = [...protocolSet]
	analysis.participants = [...participantSet]
	analysis.codecs = [...codecSet]

	// Duration
	if (analysis.start_time && analysis.end_time) {
		analysis.duration_ms = new Date(analysis.end_time).getTime() - new Date(analysis.start_time).getTime()
	}

	// Issue detection
	if (analysis.pdd_ms && analysis.pdd_ms > 5000) {
		analysis.issues.push(`High Post-Dial Delay: ${analysis.pdd_ms}ms (>5s)`);
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
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a Call-ID parameter
 * 
 * @param {string} callid - The Call-ID to validate
 * @param {string} paramName - Name of the parameter for error messages
 * @throws {Error} If validation fails
 */
export function validateCallId (callid, paramName) {
  if (!callid) {
    throw new Error(`Parameter "${paramName}" is required but was not provided`)
  }
  if (typeof callid !== 'string') {
    throw new Error(`Parameter "${paramName}" must be a string, received ${typeof callid}`)
  }
  if (callid.trim() === '') {
    throw new Error(`Parameter "${paramName}" cannot be an empty string`)
  }
  if (callid.length > 255) {
    throw new Error(`Parameter "${paramName}" exceeds maximum length of 255 characters (received ${callid.length})`)
  }
}

// ============================================================================
// RTCP QUALITY HELPERS
// ============================================================================

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
 * @returns {Object|null} Summary object with quality assessment, or null if no metrics
 * @throws {Error} If metrics parameter is invalid
 */
export function summarizeRtcpMetrics (metrics) {
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
 * Builds a human-readable debug summary from investigation results
 *
 * @param {Object} result - Investigation result object
 * @returns {string} Multi-line summary text
 */
export function buildDebugSummary (result) {
  const lines = []
  lines.push(`Call Type: ${result.call_type || 'unknown'}`)

  if (result.trace?.available && result.trace.analysis) {
    const a = result.trace.analysis
    lines.push(`From: ${a.from_user || '?'} ? To: ${a.to_user || '?'}`)
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

// ============================================================================
// MCP TOOL HANDLERS
// ============================================================================

/**
 * Handler for the get_sip_trace MCP tool
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID (required)
 * @param {string} [args.callidb] - Internal call identifier (optional)
 * @returns {Promise<Object>} Analysis result object
 */
export async function getSipTraceHandler (args) {
  const { callid, callidb } = args

  try {
    validateCallId(callid, 'callid')

    const traceMessages = await getSipTrace(callid, callidb)
    const messages = Array.isArray(traceMessages) ? traceMessages : []

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

/**
 * Handler for the get_call_quality MCP tool
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID (required)
 * @returns {Promise<Object>} Quality result object
 */
export async function getCallQualityHandler (args) {
  const { callid } = args

  try {
    validateCallId(callid, 'callid')

    const rtcpData = await getRtcpQuality(callid)
    const metrics = Array.isArray(rtcpData) ? rtcpData : []

    if (metrics.length === 0) {
      return {
        success: true,
        callid,
        has_rtcp: false,
        message: 'No RTCP data available - RTCP must be enabled on both call endpoints'
      }
    }

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

/**
 * Handler for the investigate_call MCP tool
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID (required)
 * @param {string} [args.callidb] - Internal call identifier (optional)
 * @returns {Promise<Object>} Investigation result object
 */
export async function investigateCallHandler (args) {
  const { callid, callidb } = args

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
 * @param {Object} args - Tool arguments (none required)
 * @returns {Promise<Object>} Handler response with RTP server group data
 */
export async function getRtpServerGroupsHandler (args) {
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
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID
 * @returns {Promise<Object>} Handler response with transcription data
 */
export async function getTranscriptionHandler (args) {
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
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID
 * @param {string} args.date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Handler response with AI Agent log data
 */
export async function getAiAgentLogsHandler (args) {
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

/**
 * Handler for the search_call_logs MCP tool
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.search - Search term (phone number, Call-ID, or IP address)
 * @returns {Promise<Object>} Search results
 */
export async function searchCallLogsHandler (args) {
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
