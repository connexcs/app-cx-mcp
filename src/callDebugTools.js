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
export function getApi () {
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
// SHARED UTILITIES
// ============================================================================

/**
 * Returns a { start, end } date range string for the last N days (UTC, YYYY-MM-DD).
 * Shared across all test files to avoid duplication.
 * @param {number} daysBack Number of days to look back from today
 * @returns {{ start: string, end: string }}
 */
export function getDateRange (daysBack) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return { start, end }
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
export function getSipTrace (callid, callidb) {
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
export function getRtcpQuality (callid) {
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
export function getClass5Logs (callid) {
	const api = getApi()
	return api.get(`log/class5?callid=${encodeURIComponent(callid)}`)
}

/**
 * Fetch call transcription.
 * GET transcribe?s={callid}
 */
export function getTranscription (callid) {
	const api = getApi()
	return api.get(`transcribe?s=${encodeURIComponent(callid)}`)
}

/**
 * Fetch AI Agent interaction logs.
 * GET log/ai-agent?callid={callid}&d={date}
 * 
 * **IMPORTANT: Date must be in UTC time.** If you have local time,
 * convert it to UTC (YYYY-MM-DD format) before calling this method.
 * 
 * @param {string} callid - SIP Call-ID
 * @param {string} date - Date in YYYY-MM-DD format (UTC - required)
 */
export function getAiAgentLogs (callid, date) {
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

/**
 * Search CDR (Call Detail Records) for completed calls.
 * POST cdr with structured query (date range required for performance)
 * 
 * CDR contains actual completed call records (calls that connected).
 * Unlike logs (which show all attempts), CDR shows successful calls.
 * 
 * Use CDR when:
 * - Logs are swamped with failures (200+ auth errors)
 * - Need to find successful calls among failures
 * - Want to analyze completed call patterns
 * - Answering "why are my calls failing?" (compare CDR vs logs)
 * 
 * **IMPORTANT: All dates are treated as UTC time.** This function automatically converts
 * YYYY-MM-DD dates to UTC timestamps (YYYY-MM-DD HH:MM:SS). If you have local time,
 * convert it to UTC before calling this method.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format (UTC - required)
 * @param {string} [endDate] - End date in YYYY-MM-DD format (UTC - defaults to startDate)
 * @param {Object} [filters] - Optional filters
 * @param {string} [filters.cli] - CLI/ANI (caller number) - filters dest_cli field
 * @param {string} [filters.dst] - Destination number - filters dest_number field
 * @param {number} [filters.customer_id] - Customer ID
 * @param {number} [filters.provider_id] - Provider ID
 * @param {number} [filters.limit] - Max results (default 1000, max 5000)
 * @param {Array<string>} [filters.fields] - Fields to return (defaults to standard fields)
 * @returns {Promise<Array<Object>>} Array of CDR records with selected fields
 * @throws {Error} If startDate is missing or invalid format
 */
export async function searchCdr (startDate, endDate, filters = {}) {
	// Validate startDate (required)
	if (!startDate || typeof startDate !== 'string') {
		throw new Error('Parameter "startDate" is required and must be a string in YYYY-MM-DD format')
	}
	
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/
	if (!dateRegex.test(startDate)) {
		throw new Error(`Parameter "startDate" must be in YYYY-MM-DD format, received "${startDate}"`)
	}
	
	// Default endDate to startDate if not provided
	const effectiveEndDate = endDate || startDate
	if (typeof effectiveEndDate !== 'string') {
		throw new Error(`Parameter "endDate" must be a string, received ${typeof effectiveEndDate}`)
	}
	if (!dateRegex.test(effectiveEndDate)) {
		throw new Error(`Parameter "endDate" must be in YYYY-MM-DD format, received "${effectiveEndDate}"`)
	}
	
	// Build date range (00:00:00 to 23:59:59) in UTC
	// ConnexCS CDR requires UTC timestamps
	const startDateTime = `${startDate} 00:00:00`
	const endDateTime = `${effectiveEndDate} 23:59:59`
	
	// Default fields to return
	const defaultFields = [
		'dt',
		'callid',
		'dest_cli',
		'dest_number',
		'duration',
		'customer_id',
		'customer_charge',
		'customer_card_currency',
		'provider_id',
		'provider_charge',
		'provider_card_currency',
		'branch_idx'
	]
	
	// Build where clause rules (always start with date range)
	const rules = [
		{
			field: 'dt',
			condition: '>=',
			data: startDateTime
		},
		{
			field: 'dt',
			condition: '<=',
			data: endDateTime
		}
	]
	
	// Add optional filter rules
	if (filters.cli) {
		rules.push({
			field: 'dest_cli',
			condition: '=',
			data: filters.cli
		})
	}
	if (filters.dst) {
		rules.push({
			field: 'dest_number',
			condition: '=',
			data: filters.dst
		})
	}
	if (filters.customer_id !== undefined) {
		rules.push({
			field: 'customer_id',
			condition: '=',
			data: filters.customer_id
		})
	}
	if (filters.provider_id !== undefined) {
		rules.push({
			field: 'provider_id',
			condition: '=',
			data: filters.provider_id
		})
	}
	
	// Validate and set limit
	const limit = filters.limit !== undefined ? parseInt(filters.limit, 10) : 1000
	if (isNaN(limit) || limit < 1 || limit > 5000) {
		throw new Error(`Parameter "limit" must be between 1 and 5000, received ${filters.limit}`)
	}
	
	// Build structured query
	const query = {
		field: filters.fields || defaultFields,
		where: {
			rules: rules
		},
		limit: limit,
		order: []
	}
	
	const api = getApi()
	return await api.post('cdr', query)
}

/**
 * Get call analytics comparing failed vs successful calls.
 * POST log + POST cdr
 * 
 * Analyzes call patterns by comparing:
 * - Total attempts (from logs)
 * - Successful calls (from CDR with duration > 0)
 * - Failed calls (attempts - successful)
 * - Success/failure rates
 * - Common SIP error codes for failures
 * 
 * Use this to answer questions like:
 * - "How many calls failed today vs succeeded?"
 * - "What's our success rate this week?"
 * - "What are the most common failure reasons?"
 * - "Compare call success yesterday vs last week"
 * 
 * **IMPORTANT: All dates are treated as UTC time.** Provide dates in YYYY-MM-DD format.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format (UTC - required)
 * @param {string} [endDate] - End date in YYYY-MM-DD format (UTC - defaults to startDate)
 * @param {Object} [filters] - Optional filters
 * @param {string} [filters.cli] - CLI/ANI (caller number)
 * @param {string} [filters.dst] - Destination number
 * @param {number} [filters.customer_id] - Customer ID
 * @param {number} [filters.provider_id] - Provider ID
 * @returns {Promise<Object>} Analytics with success/failure stats, common errors, and comparison data
 * @throws {Error} If startDate is missing or invalid format
 */
export async function getCallAnalytics (startDate, endDate, filters = {}) {
	// Validate startDate (required)
	if (!startDate || typeof startDate !== 'string') {
		throw new Error('Parameter "startDate" is required and must be a string in YYYY-MM-DD format')
	}
	
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/
	if (!dateRegex.test(startDate)) {
		throw new Error(`Parameter "startDate" must be in YYYY-MM-DD format, received "${startDate}"`)
	}
	
	// Default endDate to startDate if not provided
	const effectiveEndDate = endDate || startDate
	if (typeof effectiveEndDate !== 'string') {
		throw new Error(`Parameter "endDate" must be a string, received ${typeof effectiveEndDate}`)
	}
	if (!dateRegex.test(effectiveEndDate)) {
		throw new Error(`Parameter "endDate" must be in YYYY-MM-DD format, received "${effectiveEndDate}"`)
	}
	
	const api = getApi()
	
	// Build date range label
	const dateRange = endDate && endDate !== startDate 
		? `${startDate} to ${effectiveEndDate}`
		: startDate
	
	try {
		// 1. Get CDR data (successful calls)
		const cdrResults = await searchCdr(startDate, effectiveEndDate, filters)
		const successfulCalls = Array.isArray(cdrResults) ? cdrResults : []
		
		// Filter for calls with actual duration (exclude 0-second calls)
		const completedCalls = successfulCalls.filter(call => call.duration && call.duration > 0)
		
		// 2. Get logs data (all attempts) - Note: logs may be limited to 200 results
		let totalAttempts = 0
		let failedAttempts = []
		const errorCodeCounts = {}
		
		// Build log search query with filters
		const logSearchTerms = []
		if (filters.cli) logSearchTerms.push(filters.cli)
		if (filters.dst) logSearchTerms.push(filters.dst)
		
		// If we have specific search terms, query logs
		if (logSearchTerms.length > 0) {
			for (const term of logSearchTerms) {
				try {
					const logResults = await searchCallLogs(term)
					const logsArray = Array.isArray(logResults) ? logResults : []
					
					// Count attempts and analyze failures
					for (const logEntry of logsArray) {
						const sipCode = logEntry.routing?.sip_code || logEntry.sip_code
						const sipReason = logEntry.routing?.sip_reason || logEntry.sip_reason || ''
						
						// Only count entries within our date range
						const startTime = logEntry.routing?.start_time || 0
						const logDate = new Date(startTime * 1000)
						const rangeStart = new Date(startDate + 'T00:00:00Z')
						const rangeEnd = new Date(effectiveEndDate + 'T23:59:59Z')
						
						if (logDate >= rangeStart && logDate <= rangeEnd) {
							totalAttempts++
							
							// Track failures (non-200 codes)
							if (sipCode && sipCode !== 200) {
								failedAttempts.push({
									code: sipCode,
									reason: sipReason,
									callid: logEntry.routing?.callid || logEntry.callid
								})
								
								const errorKey = `${sipCode} ${sipReason}`
								errorCodeCounts[errorKey] = (errorCodeCounts[errorKey] || 0) + 1
							}
						}
					}
				} catch (err) {
					// If log search fails, continue with other terms
					console.error(`Failed to search logs for term ${term}:`, err.message)
				}
			}
		}
		
		// Calculate statistics
		const successfulCount = completedCalls.length
		const failedCount = totalAttempts > 0 ? totalAttempts - successfulCount : 0
		// When no log attempt data is available (requires cli/dst filter), avoid reporting "0%"
		// which is misleading when CDR shows successful calls
		const successRate = totalAttempts > 0 ? ((successfulCount / totalAttempts) * 100).toFixed(2) : null
		const failureRate = totalAttempts > 0 ? ((failedCount / totalAttempts) * 100).toFixed(2) : null
		
		// Sort error codes by frequency
		const sortedErrors = Object.entries(errorCodeCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10) // Top 10 errors
			.map(([error, count]) => ({
				error,
				count,
				percentage: ((count / failedAttempts.length) * 100).toFixed(2)
			}))
		
		// Calculate total duration and charges for successful calls
		const totalDuration = completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0)
		const totalCharges = completedCalls.reduce((sum, call) => sum + (call.customer_charge || 0), 0)
		
		return {
			success: true,
			date_range: dateRange,
			filters_applied: filters,
			summary: {
				total_attempts: totalAttempts,
				successful_calls: successfulCount,
				failed_calls: failedCount,
				success_rate: successRate !== null ? `${successRate}%` : (successfulCount > 0 ? 'N/A (CDR only — provide cli or dst for attempt data)' : 'N/A'),
				failure_rate: failureRate !== null ? `${failureRate}%` : 'N/A',
				total_duration_seconds: totalDuration.toFixed(2),
				total_charges: totalCharges.toFixed(2)
			},
			top_failure_reasons: sortedErrors,
			successful_calls_sample: completedCalls.slice(0, 5),
			failed_calls_sample: failedAttempts.slice(0, 5),
			message: totalAttempts > 0
				? `Analyzed ${totalAttempts} call attempt(s) in ${dateRange}. Success rate: ${successRate}%, Failure rate: ${failureRate}%.`
				: `Found ${successfulCount} successful call(s) in CDR for ${dateRange}. No attempt data available from logs (may need specific CLI/DST search terms).`,
			warning: totalAttempts === 0 && logSearchTerms.length === 0
				? 'No log search performed. Provide cli or dst filter to analyze attempt data and failure patterns.'
				: totalAttempts === 200
					? 'Log results may be capped at 200. Actual attempt count could be higher.'
					: null
		}
	} catch (error) {
		return {
			success: false,
			error: error.message,
			date_range: dateRange
		}
	}
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
export function analyzeSipTrace (messages) {
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
		analysis.issues.push(`High Post-Dial Delay: ${analysis.pdd_ms}ms (>5s)`)	}
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
 * **IMPORTANT: Date must be in UTC time.** Provide date in YYYY-MM-DD format (UTC).
 * If you have local time, convert it to UTC before calling this handler.
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.callid - SIP Call-ID
 * @param {string} args.date - Date in YYYY-MM-DD format (UTC - required)
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

/**
 * MCP Tool Handler: Search CDR
 * 
 * Search CDR (Call Detail Records) for completed calls using date ranges.
 * CDR shows calls that actually connected (200 OK), unlike logs which show all attempts.
 * 
 * Use this when:
 * - Logs return 200 results of failures — you need to find successful calls
 * - Answering "why are my calls failing?" — compare CDR (success) vs logs (all attempts)
 * - Analyzing call patterns and completion rates
 * 
 * **IMPORTANT: All dates must be in UTC time.** The searchCdr function will convert
 * YYYY-MM-DD dates to UTC timestamps. If providing local time, convert to UTC first.
 * 
 * @param {Object} args - Tool arguments
 * @param {string} args.start_date - Start date in YYYY-MM-DD format (UTC - required)
 * @param {string} [args.end_date] - End date in YYYY-MM-DD format (UTC - defaults to start_date)
 * @param {string} [args.cli] - CLI/ANI filter (caller number)
 * @param {string} [args.dst] - Destination number filter
 * @param {number} [args.customer_id] - Customer ID filter
 * @param {number} [args.provider_id] - Provider ID filter
 * @param {number} [args.limit] - Max results (default 1000, max 5000)
 * @returns {Promise<Object>} CDR search results
 */
export async function searchCdrHandler (args) {
  const { start_date, end_date, cli, dst, customer_id, provider_id, limit } = args
  
  try {
    const filters = {}
    if (cli) filters.cli = cli
    if (dst) filters.dst = dst
    if (customer_id !== undefined) filters.customer_id = customer_id
    if (provider_id !== undefined) filters.provider_id = provider_id
    if (limit) filters.limit = limit
    
    const results = await searchCdr(start_date, end_date, filters)
    const cdrArray = Array.isArray(results) ? results : []
    
    const dateRange = end_date && end_date !== start_date 
      ? `${start_date} to ${end_date}`
      : start_date
    
    return {
      success: true,
      date_range: dateRange,
      result_count: cdrArray.length,
      filters_applied: filters,
      records: cdrArray,
      message: cdrArray.length > 0
        ? `Found ${cdrArray.length} completed call(s) in date range ${dateRange}. These are calls that successfully connected (200 OK).`
        : `No completed calls found in date range ${dateRange} with the specified filters. This could mean: (1) all calls failed, (2) wrong date range, or (3) filters too restrictive.`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      start_date: start_date || 'not provided'
    }
  }
}

/**
 * MCP Tool Handler: Get Call Analytics
 * 
 * Analyze call patterns comparing failed vs successful calls for a date range.
 * Provides comprehensive statistics on:
 * - Total attempts vs successful completions
 * - Success/failure rates
 * - Common SIP error codes causing failures
 * - Duration and revenue metrics
 * 
 * Use this to answer:
 * - "How many calls failed today?"
 * - "What's our call success rate this week?"
 * - "Why are calls failing? What are the most common errors?"
 * - "Compare call performance: today vs yesterday, this week vs last week"
 * 
 * **Note:** Logs are limited to 200 results per search term. For comprehensive analytics,
 * provide cli or dst filter. Without specific search terms, only CDR data (successful calls) will be analyzed.
 * 
 * **IMPORTANT: All dates must be in UTC time.**
 * 
 * @param {Object} args - Tool arguments
 * @param {string} args.start_date - Start date in YYYY-MM-DD format (UTC - required)
 * @param {string} [args.end_date] - End date in YYYY-MM-DD format (UTC - defaults to start_date)
 * @param {string} [args.cli] - CLI/ANI filter (caller number) - recommended for comprehensive analytics
 * @param {string} [args.dst] - Destination number filter - recommended for comprehensive analytics
 * @param {number} [args.customer_id] - Customer ID filter
 * @param {number} [args.provider_id] - Provider ID filter
 * @returns {Promise<Object>} Analytics with success/failure stats and top error reasons
 */
export async function getCallAnalyticsHandler (args) {
  const { start_date, end_date, cli, dst, customer_id, provider_id } = args
  
  try {
    const filters = {}
    if (cli) filters.cli = cli
    if (dst) filters.dst = dst
    if (customer_id !== undefined) filters.customer_id = customer_id
    if (provider_id !== undefined) filters.provider_id = provider_id
    
    const analytics = await getCallAnalytics(start_date, end_date, filters)
    return analytics
  } catch (error) {
    return {
      success: false,
      error: error.message,
      start_date: start_date || 'not provided'
    }
  }
}
