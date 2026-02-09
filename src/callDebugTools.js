/**
 * Call Debug Tools — Endpoint Functions
 * 
 * Real ConnexCS logging endpoints for call debugging:
 *   - log/trace            → SIP Trace (primary, always present)
 *   - log/class5           → Class 5 logs (IVR, conference, queue, etc.)
 *   - log/rtcp             → RTCP quality metrics (MOS, jitter, packet loss, RTT)
 *   - transcribe           → Call transcription
 *   - log/ai-agent         → AI Agent interaction logs
 *   - setup/server/rtp-group → RTP server groups/zones
 * 
 * See .github/instructions/call-debug.instructions.md for full documentation.
 */

import cxRest from 'cxRest';

const API_USERNAME = process.env.API_USERNAME || 'csiamunyanga@connexcs.com';

function getApi() {
	return cxRest.auth(API_USERNAME);
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
	const api = getApi();
	let url = `log/trace?callid=${encodeURIComponent(callid)}`;
	if (callidb) url += `&callidb=${encodeURIComponent(callidb)}`;
	return api.get(url);
}

/**
 * Fetch RTCP quality metrics for a call.
 * GET log/rtcp?callid={callid}
 * 
 * Returns RTT, MOS, Jitter, Packet Loss data.
 * Only returns data if RTCP was exchanged during the call.
 */
export function getRtcpQuality(callid) {
	const api = getApi();
	return api.get(`log/rtcp?callid=${encodeURIComponent(callid)}`);
}

/**
 * Fetch Class 5 logs for a call.
 * GET log/class5?callid={callid}
 * 
 * Only contains data if the call used Class 5 features (IVR, conference, queue, etc.).
 * Empty array = pure Class 4 call.
 */
export function getClass5Logs(callid) {
	const api = getApi();
	return api.get(`log/class5?callid=${encodeURIComponent(callid)}`);
}

/**
 * Fetch call transcription.
 * GET transcribe?s={callid}
 */
export function getTranscription(callid) {
	const api = getApi();
	return api.get(`transcribe?s=${encodeURIComponent(callid)}`);
}

/**
 * Fetch AI Agent interaction logs.
 * GET log/ai-agent?callid={callid}&d={date}
 * @param {string} date - Date in YYYY-MM-DD format (required)
 */
export function getAiAgentLogs(callid, date) {
	const api = getApi();
	return api.get(`log/ai-agent?callid=${encodeURIComponent(callid)}&d=${date}`);
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
		return { error: 'No trace data available', message_count: 0 };
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
	};

	let inviteTime = null;
	let firstRingTime = null;
	let connectTime = null;
	const protocolSet = new Set();
	const participantSet = new Set();
	const codecSet = new Set();
	const methodTracker = {};

	for (const msg of messages) {
		// Build human-readable call flow
		const label = msg.reply_reason
			? `${msg.method} ${msg.reply_reason}`
			: msg.method;

		analysis.call_flow.push({
			time: msg.date,
			label,
			from: `${msg.source_ip}:${msg.source_port}`,
			to: `${msg.destination_ip}:${msg.destination_port}`,
			from_user: msg.from_user,
			to_user: msg.to_user,
			protocol: msg.protocol,
			delta_ms: msg.delta ? +(msg.delta / 1000).toFixed(1) : 0
		});

		// Timing
		if (!analysis.start_time) analysis.start_time = msg.date;
		analysis.end_time = msg.date;
		const msgTime = new Date(msg.date).getTime();

		// Track protocols & participants
		if (msg.protocol) protocolSet.add(msg.protocol);
		participantSet.add(`${msg.source_ip}:${msg.source_port}`);
		participantSet.add(`${msg.destination_ip}:${msg.destination_port}`);

		// Retransmission tracking
		const trackKey = `${msg.method}|${msg.source_ip}|${msg.destination_ip}`;
		methodTracker[trackKey] = (methodTracker[trackKey] || 0) + 1;

		// INVITE timing
		if (msg.method === 'INVITE' && !inviteTime) {
			inviteTime = msgTime;
		}

		// Auth detection (407/401)
		if (msg.method === '407' || msg.method === '401') {
			analysis.auth_required = true;
		}

		// Ringing → PDD calculation
		if ((msg.method === '180' || msg.method === '183') && !firstRingTime) {
			firstRingTime = msgTime;
			if (inviteTime) {
				analysis.pdd_ms = firstRingTime - inviteTime;
			}
		}

		// 200 OK → call connected
		if (msg.method === '200' && !connectTime && inviteTime) {
			connectTime = msgTime;
			analysis.call_connected = true;
			analysis.setup_time_ms = connectTime - inviteTime;
		}

		// BYE → call terminated
		if (msg.method === 'BYE') {
			analysis.call_terminated = true;
		}

		// Error responses (4xx, 5xx)
		const code = parseInt(msg.method, 10);
		if (code >= 400) {
			analysis.final_response = { code, reason: msg.reply_reason || '' };
		}

		// Inspect raw SIP message for special headers and SDP
		if (msg.msg) {
			if (msg.msg.includes('X-CX-NAT')) {
				analysis.nat_detected = true;
			}
			const aeMatch = msg.msg.match(/X-AnyEdge-Host:\s*(.+)/i);
			if (aeMatch) {
				analysis.anyedge_host = aeMatch[1].trim();
			}
			// Codec extraction from SDP a=rtpmap lines
			const codecMatches = msg.msg.match(/a=rtpmap:\d+ ([^\r\n/]+)/g);
			if (codecMatches) {
				codecMatches.forEach(m => {
					const codec = m.replace(/a=rtpmap:\d+ /, '').split('/')[0];
					codecSet.add(codec);
				});
			}
		}
	}

	// Finalize sets → arrays
	analysis.protocols_used = [...protocolSet];
	analysis.participants = [...participantSet];
	analysis.codecs = [...codecSet];

	// Duration
	if (analysis.start_time && analysis.end_time) {
		analysis.duration_ms = new Date(analysis.end_time).getTime() - new Date(analysis.start_time).getTime();
	}

	// Issue detection
	if (analysis.pdd_ms && analysis.pdd_ms > 5000) {
		analysis.issues.push(`High Post-Dial Delay: ${analysis.pdd_ms}ms (>5s)`);
	}
	if (!analysis.call_connected && analysis.final_response) {
		analysis.issues.push(`Call failed: ${analysis.final_response.code} ${analysis.final_response.reason}`);
	}
	for (const [key, count] of Object.entries(methodTracker)) {
		if (count > 1 && key.startsWith('INVITE')) {
			analysis.issues.push(`INVITE retransmission detected (${count} copies) — possible network issue`);
		}
	}
	if (analysis.nat_detected) {
		analysis.issues.push('NAT detected — verify media path and Far-End NAT Traversal configuration');
	}

	return analysis;
}
