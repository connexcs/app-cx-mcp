/**
 * Call Debug MCP Server — Production Ready
 *
 * Independent MCP server for call debugging via real ConnexCS logging endpoints.
 * Follows ConnexCS MCP Server coding standards (see .github/instructions/coding-standards.instructions.md)
 *
 * Run with: cx run callDebugMcp
 *
 * 8 MCP Tools:
 *   1. search_call_logs       — Search logs by phone/IP/date (log) — START HERE to find calls
 *   2. search_cdr             — Search CDR (completed calls) by date — Find successful calls when logs show failures
 *   3. get_sip_trace          — Fetch & analyze SIP trace (log/trace) — PRIMARY debugging tool
 *   4. get_call_quality       — Fetch RTCP quality metrics (log/rtcp)
 *   5. investigate_call       — Full debug: trace + class5 + rtcp
 *   6. get_rtp_server_groups  — List RTP media zones (setup/server/rtp-group)
 *   7. get_transcription      — Get call transcription (transcribe)
 *   8. get_ai_agent_logs      — Get AI agent logs (log/ai-agent)
 *
 * API Endpoints (see .github/instructions/call-debug.instructions.md):
 *   - log?s={search}                          → Search call logs by phone/IP/callid
 *   - cdr?date={date}&cli={cli}&dst={dst}     → Search CDR (completed calls) by date
 *   - log/trace?callid={callid}               → SIP trace (always present, 7 days retention)
 *   - log/rtcp?callid={callid}                → RTCP quality (if enabled)
 *   - log/class5?callid={callid}              → Class 5 features (only if used)
 *   - setup/server/rtp-group                  → RTP server groups/zones
 *   - transcribe?s={callid}                   → Call transcription (if enabled)
 *   - log/ai-agent?callid={callid}&d={date}   → AI agent logs (if AI agent was used)
 */

import { McpServer } from 'cxMcpServer'
import {
  searchCallLogsHandler,
  searchCdrHandler,
  getSipTraceHandler,
  getCallQualityHandler,
  investigateCallHandler,
  getRtpServerGroupsHandler,
  getTranscriptionHandler,
  getAiAgentLogsHandler
} from './callDebugTools'

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

const mcp = new McpServer('ConnexCS Call Debug', '1.0.0', true)

// Tool 1: Search Call Logs
mcp.addTool(
  'search_call_logs',
  'Search ConnexCS call logs by phone number, Call-ID, or IP address. Returns routing objects with full call details including Call-IDs. **START HERE** to find calls before debugging. Use the returned "callid" and "callidb" with get_sip_trace or investigate_call. The search is flexible — searches across CLI, called numbers, Call-IDs, and IP addresses. Endpoint: log?s={search}',
  searchCallLogsHandler
)
  .addParameter('search', 'string', 'Phone number, Call-ID, or IP address to search for', true)

// Tool 2: Search CDR
mcp.addTool(
  'search_cdr',
  'Search CDR (Call Detail Records) for completed calls using date ranges. CDR shows calls that actually connected (200 OK), unlike logs which show all attempts. **Use this when logs are swamped with failures** (e.g., 200 auth errors) and you need to find successful calls. Date range required for performance. Perfect for answering "why are my calls failing?" — compare CDR success vs log failures. Uses structured query with field selection. Endpoint: POST cdr',
  searchCdrHandler
)
  .addParameter('start_date', 'string', 'Start date in YYYY-MM-DD format (required)', true)
  .addParameter('end_date', 'string', 'End date in YYYY-MM-DD format (optional, defaults to start_date)', false)
  .addParameter('cli', 'string', 'CLI/ANI filter (caller number, optional)', false)
  .addParameter('dst', 'string', 'Destination number filter (optional)', false)
  .addParameter('customer_id', 'number', 'Customer ID filter (optional)', false)
  .addParameter('provider_id', 'number', 'Provider ID filter (optional)', false)
  .addParameter('limit', 'number', 'Max results (default 1000, max 5000, optional)', false)

// Tool 3: Get SIP Trace
mcp.addTool(
  'get_sip_trace',
  'Fetch and analyze SIP trace for a call. Returns full SIP flow with timing, auth, NAT detection, codecs, and identified issues. PRIMARY debugging tool — every call has trace data (7 days retention). Use this first when debugging any call. Endpoint: log/trace',
  getSipTraceHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('callidb', 'string', 'Internal call identifier (optional)', false)

// Tool 4: Get Call Quality
mcp.addTool(
  'get_call_quality',
  'Fetch RTCP quality metrics for a call. Returns MOS (Mean Opinion Score), jitter, packet loss, and RTT statistics with quality assessment. Only available if RTCP was enabled on both call endpoints. Use to diagnose audio quality issues. Endpoint: log/rtcp',
  getCallQualityHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)

// Tool 5: Investigate Call
mcp.addTool(
  'investigate_call',
  'Perform comprehensive call investigation combining SIP trace + Class 5 logs + RTCP quality. Determines call type (Class 4 vs Class 5), analyzes full call flow, checks quality metrics, and provides unified debug summary with all identified issues. Use as single-command full investigation. Endpoints: log/trace + log/class5 + log/rtcp',
  investigateCallHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('callidb', 'string', 'Internal call identifier (optional)', false)

// Tool 6: Get RTP Server Groups
mcp.addTool(
  'get_rtp_server_groups',
  'Fetch list of RTP server groups/zones for media routing. Returns all available media zones (London, New York, Singapore, etc.) with their IDs, locations, and configurations. Use to understand where media is routed and choose optimal media server locations. Useful for diagnosing media quality issues and latency. Endpoint: setup/server/rtp-group',
  getRtpServerGroupsHandler
)

// Tool 7: Get Transcription
mcp.addTool(
  'get_transcription',
  'Fetch transcription data for a call. Returns text transcription if transcription was enabled on the call. Only returns data if transcription was active. Use to review call contents for quality assurance, training, or compliance. Endpoint: transcribe',
  getTranscriptionHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)

// Tool 8: Get AI Agent Logs
mcp.addTool(
  'get_ai_agent_logs',
  'Fetch AI Agent interaction logs for a call. Returns AI Agent logs if an AI Agent was handling the call. Only returns data if AI Agent was involved. Use to debug AI-assisted calls and review agent behavior. Requires date parameter in YYYY-MM-DD format. Endpoint: log/ai-agent',
  getAiAgentLogsHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('date', 'string', 'Date in YYYY-MM-DD format (e.g. 2026-02-09)', true)

/**
 * Main entry point for the MCP server
 *
 * Handles incoming MCP requests and routes them to the appropriate tool handler.
 *
 * @param {Object} data - MCP request data from client
 * @returns {Promise<Object>} MCP response object
 */
export function main (data) {
  return mcp.handle(data)
}
