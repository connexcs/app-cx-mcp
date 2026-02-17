/**
 * Call Debug MCP Server — Production Ready
 *
 * Independent MCP server for call debugging via real ConnexCS logging endpoints.
 * Follows ConnexCS MCP Server coding standards (see .github/instructions/coding-standards.instructions.md)
 *
 * Run with: cx run callDebugMcp
 *
 * 13 MCP Tools:
 *   === Call Debugging Tools ===
 *   1. search_call_logs       — Search logs by phone/IP/date (log) — START HERE to find calls
 *   2. search_cdr             — Search CDR (completed calls) by date — Find successful calls when logs show failures
 *   3. get_call_analytics     — Analyze failed vs successful calls with stats — Compare day vs week patterns
 *   4. get_sip_trace          — Fetch & analyze SIP trace (log/trace) — PRIMARY debugging tool
 *   5. get_call_quality       — Fetch RTCP quality metrics (log/rtcp)
 *   6. investigate_call       — Full debug: trace + class5 + rtcp
 *   7. get_rtp_server_groups  — List RTP media zones (setup/server/rtp-group)
 *   8. get_transcription      — Get call transcription (transcribe)
 *   9. get_ai_agent_logs      — Get AI agent logs (log/ai-agent)
 *   
 *   === Customer Management Tools ===
 *   10. searchCustomers      — Search customers by ID/name/SIP/IP
 *   11. getCustomerBalance  — Get customer balance and credit info
 *   12. getLastTopup        — Get customer's most recent top-up payment
 *   13. listRtpServers      — List RTP servers with filtering options
 *  14. getCustomerPackages  — Get packages assigned to a customer with filtering
 * 15. getCustomerRateCards  — Get rate cards assigned to a customer
 * 16. getRateCardDetails    — Get complete details of a specific rate card
 * 17. getRateCardRules      — Get pricing rules and prefix info for a rate card revision
 * 18. getCustomerProfitability — Analyze customer profitability with revenue, costs, and margins
 * 19. listCustomersByProfitability — Get ranked list of customers by profitability metrics
 * 
 * === Adam tools
 * 20. getCustomerCallStatistics — Get comprehensive call statistics for a customer including attempts, connected calls, duration, charges, ACD, ASR, profitability, and destination breakdowns.
 * 21. getCustomerDestinationStatistics — Get breakdown of calls by destination, showing customer and provider card/route usage for analyzing call routing patterns and destination distribution.
 * 
 *
 * API Endpoints (see .github/instructions/call-debug.instructions.md):
 *   - log?s={search}                          ? Search call logs by phone/IP/callid
 *   - cdr?date={date}&cli={cli}&dst={dst}     ? Search CDR (completed calls) by date
 *   - log/trace?callid={callid}               ? SIP trace (always present, 7 days retention)
 *   - log/rtcp?callid={callid}                ? RTCP quality (if enabled)
 *   - log/class5?callid={callid}              ? Class 5 features (only if used)
 *   - setup/server/rtp-group                  ? RTP server groups/zones
 *   - transcribe?s={callid}                   ? Call transcription (if enabled)
 *   - log/ai-agent?callid={callid}&d={date}   ? AI agent logs (if AI agent was used)
 */

import { McpServer } from 'cxMcpServer'
import {
  searchCallLogsHandler,
  searchCdrHandler,
  getCallAnalyticsHandler,
  getSipTraceHandler,
  getCallQualityHandler,
  investigateCallHandler,
  getRtpServerGroupsHandler,
  getTranscriptionHandler,
  getAiAgentLogsHandler
} from './callDebugTools'
import { searchCustomers, getCustomerBalance, getLastTopup } from './searchCustomer'
import { listRTPServersMain } from './listRtpServers';
import { getCustomerPackages } from './package';
import { getCustomerRateCards, getRateCardDetails, getRateCardRules } from './rateCard';
import { getCustomerProfitability, listCustomersByProfitability } from './listCustomersByProfitability';
import { getCustomerCallStatistics } from './connexcs_customer_stats'
import { getCustomerDestinationStatistics } from './connexcs_destination_stats'


// ============================================================================
// MCP SERVER SETUP
// ============================================================================

const mcp = new McpServer('ConnexCS Call Debug', '1.0.0', true)

// Tool 1: Search Call Logs
mcp.addTool(
  'searchCallLogs',
  'Search ConnexCS call logs by phone number, Call-ID, or IP address. Returns routing objects with full call details including Call-IDs. **START HERE** to find calls before debugging. Use the returned "callid" and "callidb" with get_sip_trace or investigate_call. The search is flexible — searches across CLI, called numbers, Call-IDs, and IP addresses. Endpoint: log?s={search}',
  searchCallLogsHandler
)
  .addParameter('search', 'string', 'Phone number, Call-ID, or IP address to search for', true)

// Tool 2: Search CDR
mcp.addTool(
  'searchCdr',
  'Search CDR (Call Detail Records) for completed calls using date ranges. CDR shows calls that actually connected (200 OK), unlike logs which show all attempts. **Use this when logs are swamped with failures** (e.g., 200 auth errors) and you need to find successful calls. Date range required for performance. Perfect for answering "why are my calls failing?" — compare CDR success vs log failures. Uses structured query with field selection. **All dates must be in UTC time.** Endpoint: POST cdr',
  searchCdrHandler
)
  .addParameter('start_date', 'string', 'Start date in YYYY-MM-DD format UTC (required)', true)
  .addParameter('end_date', 'string', 'End date in YYYY-MM-DD format UTC (optional, defaults to start_date)', false)
  .addParameter('cli', 'string', 'CLI/ANI filter (caller number, optional)', false)
  .addParameter('dst', 'string', 'Destination number filter (optional)', false)
  .addParameter('customer_id', 'number', 'Customer ID filter (optional)', false)
  .addParameter('provider_id', 'number', 'Provider ID filter (optional)', false)
  .addParameter('limit', 'number', 'Max results (default 1000, max 5000, optional)', false)

// Tool 3: Get Call Analytics
mcp.addTool(
  'getCallAnalytics',
  'Analyze call patterns comparing failed vs successful calls for a date range. Provides statistics on total attempts, successful calls, failed calls, success/failure rates, and top failure reasons (SIP error codes). Use this to answer questions like: "How many calls failed today?", "What\'s our success rate this week?", "Why are calls failing?", "Compare yesterday vs last week". **Note:** For comprehensive analytics, provide cli or dst filter to search logs. Without specific search terms, only CDR data (successful calls) will be analyzed. **All dates must be in UTC time.** Endpoint: log + cdr',
  getCallAnalyticsHandler
)
  .addParameter('start_date', 'string', 'Start date in YYYY-MM-DD format UTC (required)', true)
  .addParameter('end_date', 'string', 'End date in YYYY-MM-DD format UTC (optional, defaults to start_date)', false)
  .addParameter('cli', 'string', 'CLI/ANI filter (caller number) - recommended for comprehensive analytics', false)
  .addParameter('dst', 'string', 'Destination number filter - recommended for comprehensive analytics', false)
  .addParameter('customer_id', 'number', 'Customer ID filter (optional)', false)
  .addParameter('provider_id', 'number', 'Provider ID filter (optional)', false)

// Tool 4: Get SIP Trace
mcp.addTool(
  'getSipTrace',
  'Fetch and analyze SIP trace for a call. Returns full SIP flow with timing, auth, NAT detection, codecs, and identified issues. PRIMARY debugging tool — every call has trace data (7 days retention). Use this first when debugging any call. Endpoint: log/trace',
  getSipTraceHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('callidb', 'string', 'Internal call identifier (optional)', false)

// Tool 5: Get Call Quality
mcp.addTool(
  'getCallQuality',
  'Fetch RTCP quality metrics for a call. Returns MOS (Mean Opinion Score), jitter, packet loss, and RTT statistics with quality assessment. Only available if RTCP was enabled on both call endpoints. Use to diagnose audio quality issues. Endpoint: log/rtcp',
  getCallQualityHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)

// Tool 6: Investigate Call
mcp.addTool(
  'investigateCall',
  'Perform comprehensive call investigation combining SIP trace + Class 5 logs + RTCP quality. Determines call type (Class 4 vs Class 5), analyzes full call flow, checks quality metrics, and provides unified debug summary with all identified issues. Use as single-command full investigation. Endpoints: log/trace + log/class5 + log/rtcp',
  investigateCallHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('callidb', 'string', 'Internal call identifier (optional)', false)

// Tool 7: Get RTP Server Groups
mcp.addTool(
  'getRtpServerGroups',
  'Fetch list of RTP server groups/zones for media routing. Returns all available media zones (London, New York, Singapore, etc.) with their IDs, locations, and configurations. Use to understand where media is routed and choose optimal media server locations. Useful for diagnosing media quality issues and latency. Endpoint: setup/server/rtp-group',
  getRtpServerGroupsHandler
)

// Tool 8: Get Transcription
mcp.addTool(
  'getTranscription',
  'Fetch transcription data for a call. Returns text transcription if transcription was enabled on the call. Only returns data if transcription was active. Use to review call contents for quality assurance, training, or compliance. Endpoint: transcribe',
  getTranscriptionHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)

// Tool 9: Get AI Agent Logs
mcp.addTool(
  'getAiAgentLogs',
  'Fetch AI Agent interaction logs for a call. Returns AI Agent logs if an AI Agent was handling the call. Only returns data if AI Agent was involved. Use to debug AI-assisted calls and review agent behavior. **Date must be in UTC time** (YYYY-MM-DD format). Endpoint: log/ai-agent',
  getAiAgentLogsHandler
)
  .addParameter('callid', 'string', 'SIP Call-ID (required, non-empty, max 255 chars)', true)
  .addParameter('date', 'string', 'Date in YYYY-MM-DD format UTC (e.g. 2026-02-09)', true)

// ============================================================================
// CUSTOMER MANAGEMENT TOOLS (from mcp-ravi)
// ============================================================================

// Tool 10: Search Customers
mcp.addTool(
  'searchCustomers',
  'Search for customers using ID, name, SIP username, or IP address. Supports partial matching on name and SIP users; exact matching on ID and IP. Returns matching customers with their IDs for use in other operations like get_customer_balance or get_last_topup.',
  searchCustomers
)
  .addParameter('query', 'string', 'Search term: customer ID (exact), customer name (partial), SIP username (partial), or IP address (exact)', true)
  .addParameter('search_type', 'string', 'Type of search to perform. "auto" attempts to determine the best match type automatically.', false, 'auto', { enum: ['auto', 'id', 'name', 'sip_user', 'ips'] })
  .addParameter('limit', 'number', 'Maximum number of results to return', false, 10)

// Tool 11: Get Customer Balance
mcp.addTool(
  'getCustomerBalance',
  'Get customer\'s current balance including credit amount and debit limit. Call capability is determined by whether available balance (credit + debit_limit) is positive. Use this to check if a customer can make calls or needs to top up.',
  getCustomerBalance
)
  .addParameter('customer_id', 'string', 'The unique customer ID (obtained from searchCustomers)', true)

// Tool 12: Get Last Top-up
mcp.addTool(
  'getLastTopup',
  'Retrieves the most recent top-up payment for a customer, including the date, amount, payment method, and invoice details. Use this to check payment history or verify recent top-ups.',
  getLastTopup
)
  .addParameter('customer_id', 'string', 'The unique customer ID to retrieve the last top-up for.', true)

// Tool 13: List RTP Servers
mcp.addTool(
  'listRtpServers',
  'Retrieves a detailed list of available RTP (Real-time Transport Protocol) servers that are operational and ready to handle voice/video traffic. Can be filtered by geozone, zone, server ID, or alias. Returns comprehensive server details including location, capacity, status, and configuration.',
  listRTPServersMain
)
  .addParameter('geozone', 'string', 'Optional: Filter by geozone (alias for zone). Examples: "North America", "Europe", "Frankfurt 2 (High Capacity)"', false)
  .addParameter('zone', 'string', 'Optional: Filter by zone (e.g., "Frankfurt 2 (High Capacity)")', false)
  .addParameter('server_id', 'number', 'Optional: Filter by specific server ID', false)
  .addParameter('alias', 'string', 'Optional: Filter by server alias/name (server hostname)', false)

// Tool 14: Get Customer Packages
mcp.addTool(
  'getCustomerPackages', 
  'Get all packages assigned to a customer including recurring charges, one-time fees, and free minute bundles. Supports filtering by package type.', 
  getCustomerPackages
)
  .addParameter('customerId', 'string', 'The unique customer ID (maps to company_id in the package endpoint)', true)
  .addParameter('type', 'string', 'Filter packages by type: "all" returns all packages, "recurring" for packages with billing frequency (month/day/etc), "one-time" for packages without frequency, "free-minutes" for minute bundles', false, 'all', { enum: ['all', 'recurring', 'one-time', 'free-minutes'] });

// Tool 15: Get Customer Rate Cards
mcp.addTool(
  'getCustomerRateCards', 
  'Get all rate cards assigned to a customer.', 
  getCustomerRateCards
)
  .addParameter('customerId', 'string', 'The unique customer ID (maps to customer_id in the routing endpoint)', true);

// Tool 16: Get Rate Card Details
mcp.addTool(
  'getRateCardDetails', 
  'Get complete details of a specific rate card.', 
  getRateCardDetails
)
  .addParameter('rateCardId', 'string', 'The rate card ID (e.g., "OF7H-xk1B")', true);

// Tool 17: Get Rate Card Rules
mcp.addTool(
  'getRateCardRules', 
  'Get pricing rules and prefix information for a rate card revision. Requires include_prefixes to be true to fetch data.', 
  getRateCardRules
)
  .addParameter('rateCardId', 'string', 'The rate card ID (e.g., "fbIL-EJoJ")', true)
  .addParameter('activeRev', 'string', 'The active revision number (e.g., "19" or 19)', true)
  .addParameter('include_prefixes', 'boolean', 'Whether to include prefix rules. If false, no data is fetched (default: true)', false, true)
  .addParameter('prefix_limit', 'number', 'Maximum number of prefixes/rules to return. Default: 1000, Max: 10000', false, 1000)
  .addParameter('offset', 'number', 'Pagination offset for rules (default: 0)', false, 0);

// Tool 18: Get Customer Profitability
mcp.addTool(
  'getCustomerProfitability', 
  'Analyze customer profitability including revenue, costs, profit margins, and cost comparison across different currencies.', 
  getCustomerProfitability
)
  .addParameter('customer_id', 'string', 'The unique customer ID', true)
  .addParameter('start_date', 'string', 'Start date for analysis. Optional - defaults to last 30 days.', false)
  .addParameter('end_date', 'string', 'End date for analysis. Optional - defaults to now.', false)
  .addParameter('group_by', 'string', 'Group profitability data by time period. Optional.', false, null, { enum: ['day', 'week', 'month'] });

// Tool 19: List Customers by Profitability  
mcp.addTool(
  'listCustomersByProfitability', 
  'Returns a ranked list of customers by profitability metrics. Useful for identifying top revenue generators, most profitable accounts, or customers with best margins.', 
  listCustomersByProfitability
)
  .addParameter('start_date', 'string', 'Start date for profitability calculation. Optional - defaults to last 30 days.', false)
  .addParameter('end_date', 'string', 'End date for profitability calculation. Optional - defaults to now.', false)
  .addParameter('sort_by', 'string', 'Metric to rank customers by. Defaults to total_profit.', false, 'total_profit', { enum: ['total_profit', 'profit_margin', 'total_revenue', 'total_cost'] })
  .addParameter('sort_order', 'string', 'Sort order. Defaults to descending (highest first).', false, 'desc', { enum: ['desc', 'asc'] })
  .addParameter('limit', 'number', 'Maximum number of customers to return. Defaults to 10.', false, 10)
  .addParameter('offset', 'number', 'Number of records to skip for pagination. Defaults to 0.', false, 0)
  .addParameter('min_profit', 'number', 'Optional filter: only include customers with profit above this threshold.', false);


// ============================================================================
// TOOLS (from adam-mcp)
// ============================================================================

// Tool 20 : Get Customer Call Statistics
mcp.addTool(
  'getCustomerCallStatistics', 
  'Get comprehensive call statistics for a customer including attempts, connected calls, duration, charges, ACD, ASR, profitability, and destination breakdowns.',
  getCustomerCallStatistics
)
  .addParameter('company_id', 'string', 'The unique company/customer ID', true)
  .addParameter('start_date', 'string', 'Start date for statistics (ISO 8601 or Unix timestamp). Optional.', false)
  .addParameter('end_date', 'string', 'End date for statistics (ISO 8601 or Unix timestamp). Optional.', false);

// Tool 21 Get Customer Destination Statistics
mcp.addTool(
  'getCustomerDestinationStatistics',
  'Get breakdown of calls by destination, showing customer and provider card/route usage for analyzing call routing patterns and destination distribution.',
  getCustomerDestinationStatistics
)
  .addParameter('customer_id', 'string', 'The unique customer ID or leave empty for all customers', true)
  .addParameter('start_date', 'string', 'Start date for statistics in YYYY-MM-DD format. Optional - defaults to last 30 days.', false)
  .addParameter('end_date', 'string', 'End date for statistics in YYYY-MM-DD format. Optional - defaults to today.', false)
  .addParameter('limit', 'number', 'Number of top destinations to return (1-100)', false, 20);




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
