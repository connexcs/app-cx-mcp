/**
 * TypeScript Call Debug Tools - Logic Implementation
 * 
 * This file demonstrates how to use the types from callDebugTypes.ts
 * to create type-safe call debugging functions.
 * 
 * This is a proof-of-concept showing:
 * - Proper type imports
 * - Type-safe function signatures
 * - Type annotations for variables and return values
 * - Type guards for runtime validation
 */

import cxRest from 'cxRest'
import type {
  CxRestApi,
  SipTraceMessage,
  SipTraceAnalysis,
  SipTraceResponse,
  SipCallFlowStep,
  CallLogsResponse,
  CallLogEntry,
  CdrRecord,
  CdrSearchFilters,
  CdrQuery,
  CdrSearchResponse,
  CallAnalyticsResponse,
  AnalyticsSummary,
  FailedCallSample,
  SearchCallLogsArgs,
  SearchCdrArgs,
  GetCallAnalyticsArgs,
  GetSipTraceArgs
} from './callDebugTypes'

// ============================================================================
// API Authentication (Type-Safe)
// ============================================================================

/**
 * Get authenticated API client
 * @returns {CxRestApi} Authenticated cxRest API client
 * @throws {Error} If API_USERNAME environment variable is not set
 */
export function getApi (): CxRestApi {
  const apiUsername: string | undefined = process.env.API_USERNAME

  if (!apiUsername || apiUsername.trim() === '') {
    throw new Error(
      'API_USERNAME environment variable is required but not set. ' +
      'Please set API_USERNAME in your environment variables to authenticate with ConnexCS API.'
    )
  }

  return cxRest.auth(apiUsername) as CxRestApi
}

// ============================================================================
// SIP Trace Analysis (Type-Safe)
// ============================================================================

/**
 * Analyze SIP trace messages and produce structured debug summary
 * 
 * @param {SipTraceMessage[]} messages - Array of raw SIP trace messages
 * @returns {SipTraceAnalysis} Analyzed trace with insights
 */
export function analyzeSipTrace (messages: SipTraceMessage[]): SipTraceAnalysis {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      message_count: 0,
      call_id: null,
      from_user: null,
      to_user: null,
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
      issues: ['No trace data available']
    }
  }

  const analysis: SipTraceAnalysis = {
    message_count: messages.length,
    call_id: messages[0]?.callid || null,
    from_user: messages[0]?.from_user || null,
    to_user: messages[0]?.to_user || null,
    start_time: messages[0]?.date || null,
    end_time: messages[messages.length - 1]?.date || null,
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

  // Extract unique protocols
  const protocolsSet = new Set<string>()
  const participantsSet = new Set<string>()
  const codecsSet = new Set<string>()

  for (const msg of messages) {
    // Collect protocols
    if (msg.protocol) {
      protocolsSet.add(msg.protocol)
    }

    // Collect participants
    if (msg.source_ip && msg.source_port) {
      participantsSet.add(`${msg.source_ip}:${msg.source_port}`)
    }

    // Check for auth requirements
    if (msg.method === '401' || msg.method === '407') {
      analysis.auth_required = true
    }

    // Check for successful connection
    if (msg.method === '200' && msg.reply_reason === 'OK') {
      analysis.call_connected = true
    }

    // Check for termination
    if (msg.method === 'BYE') {
      analysis.call_terminated = true
    }

    // Extract codecs from SDP
    if (msg.msg && msg.msg.includes('m=audio')) {
      const codecMatch = msg.msg.match(/a=rtpmap:\d+ (\w+)\//g)
      if (codecMatch) {
        codecMatch.forEach((codec: string) => {
          const codecName = codec.match(/a=rtpmap:\d+ (\w+)\//)?.[1]
          if (codecName) codecsSet.add(codecName)
        })
      }
    }

    // Build call flow
    const flowStep: SipCallFlowStep = {
      time: msg.date,
      label: msg.method + (msg.reply_reason ? ` ${msg.reply_reason}` : ''),
      from: `${msg.source_ip}:${msg.source_port}`,
      to: `${msg.destination_ip}:${msg.destination_port}`,
      from_user: msg.from_user,
      to_user: msg.to_user,
      protocol: msg.protocol,
      delta_ms: msg.delta || 0
    }
    analysis.call_flow.push(flowStep)
  }

  // Convert sets to arrays
  analysis.protocols_used = Array.from(protocolsSet)
  analysis.participants = Array.from(participantsSet)
  analysis.codecs = Array.from(codecsSet)

  // Find final response
  const finalResponses = messages.filter((msg: SipTraceMessage) => 
    parseInt(msg.method) >= 200 && parseInt(msg.method) < 700
  )
  if (finalResponses.length > 0) {
    const lastResponse = finalResponses[finalResponses.length - 1]
    analysis.final_response = {
      code: parseInt(lastResponse.method),
      reason: lastResponse.reply_reason
    }
  }

  // Calculate duration
  if (analysis.start_time && analysis.end_time) {
    const startMs = new Date(analysis.start_time).getTime()
    const endMs = new Date(analysis.end_time).getTime()
    analysis.duration_ms = endMs - startMs
  }

  // Identify issues
  if (!analysis.call_connected) {
    analysis.issues.push(`Call failed: ${analysis.final_response?.code} ${analysis.final_response?.reason}`)
  }
  if (analysis.auth_required && !analysis.call_connected) {
    analysis.issues.push('Authentication required but call did not succeed')
  }

  return analysis
}

/**
 * Fetch SIP trace for a call
 * 
 * @param {string} callid - SIP Call-ID
 * @param {string} [callidb] - Internal call identifier (optional)
 * @returns {Promise<SipTraceMessage[]>} Array of SIP trace messages
 */
export async function getSipTrace (
  callid: string,
  callidb?: string
): Promise<SipTraceMessage[]> {
  const api: CxRestApi = getApi()
  let url = `log/trace?callid=${encodeURIComponent(callid)}`
  if (callidb) {
    url += `&callidb=${encodeURIComponent(callidb)}`
  }
  return await api.get(url)
}

/**
 * MCP handler for get_sip_trace tool (Type-Safe)
 * 
 * @param {GetSipTraceArgs} args - Tool arguments with callid and optional callidb
 * @returns {Promise<SipTraceResponse>} SIP trace response with analysis
 */
export async function getSipTraceHandler (
  args: GetSipTraceArgs
): Promise<SipTraceResponse> {
  const { callid, callidb } = args
  
  try {
    // Validate callid
    if (!callid || typeof callid !== 'string' || callid.trim() === '') {
      const errorResponse: SipTraceResponse = {
        success: false,
        callid: callid || '',
        trace_available: false,
        issues: ['callid parameter is required and must be a non-empty string'],
        suggestions: ['Provide a valid SIP Call-ID']
      }
      return errorResponse
    }

    // Fetch trace data
    const messages: SipTraceMessage[] = await getSipTrace(callid, callidb)
    
    if (!messages || messages.length === 0) {
      return {
        success: false,
        callid,
        trace_available: false,
        message: 'No SIP trace data found for this Call-ID',
        suggestions: [
          'Verify the Call-ID is correct (check for typos)',
          'Traces are retained for 7 days only - call may be too old',
          'Call may not have reached ConnexCS platform',
          'Try searching in the ConnexCS logging page to verify the call exists'
        ]
      }
    }

    // Analyze the trace
    const analysis: SipTraceAnalysis = analyzeSipTrace(messages)
    
    return {
      success: true,
      callid,
      trace_available: true,
      analysis,
      raw_message_count: messages.length,
      raw_messages: messages
    }
    
  } catch (error: any) {
    return {
      success: false,
      callid,
      trace_available: false,
      issues: [error.message],
      message: `Failed to fetch SIP trace: ${error.message}`
    }
  }
}

// ============================================================================
// Call Logs Search (Type-Safe)
// ============================================================================

/**
 * Search call logs by phone number, Call-ID, or IP address
 * 
 * @param {string} search - Search term (phone/IP/callid)
 * @returns {Promise<CallLogEntry[]>} Array of matching call log entries
 */
export async function searchCallLogs (search: string): Promise<CallLogEntry[]> {
  if (!search || typeof search !== 'string' || search.trim() === '') {
    throw new Error('search parameter is required and must be a non-empty string')
  }
  
  const api: CxRestApi = getApi()
  return await api.get(`log?s=${encodeURIComponent(search)}`)
}

/**
 * MCP handler for search_call_logs tool (Type-Safe)
 * 
 * @param {SearchCallLogsArgs} args - Tool arguments with search term
 * @returns {Promise<CallLogsResponse>} Call logs search response
 */
export async function searchCallLogsHandler (
  args: SearchCallLogsArgs
): Promise<CallLogsResponse> {
  const { search } = args
  
  try {
    const results: CallLogEntry[] = await searchCallLogs(search)
    const logsArray: CallLogEntry[] = Array.isArray(results) ? results : []
    
    return {
      success: true,
      result_count: logsArray.length,
      calls: logsArray,
      search_term: search,
      message: logsArray.length > 0
        ? `Found ${logsArray.length} matching call(s). Each result contains 'callid' and 'callidb' — use these with get_sip_trace or investigate_call for detailed debugging.`
        : `No calls found matching "${search}". Try a different phone number, Call-ID, or IP address.`
    }
  } catch (error: any) {
    return {
      success: false,
      result_count: 0,
      calls: [],
      search_term: search,
      message: `Error: ${error.message}`
    }
  }
}

// ============================================================================
// CDR Search (Type-Safe)
// ============================================================================

/**
 * Search CDR (Call Detail Records) for completed calls
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format (UTC)
 * @param {string} [endDate] - End date in YYYY-MM-DD format (UTC)
 * @param {CdrSearchFilters} [filters={}] - Optional filters
 * @returns {Promise<CdrRecord[]>} Array of CDR records
 */
export async function searchCdr (
  startDate: string,
  endDate?: string,
  filters: CdrSearchFilters = {}
): Promise<CdrRecord[]> {
  // Validate startDate
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(startDate)) {
    throw new Error(`Parameter "startDate" must be in YYYY-MM-DD format, received "${startDate}"`)
  }
  
  // Default endDate to startDate if not provided
  const effectiveEndDate: string = endDate || startDate
  if (!dateRegex.test(effectiveEndDate)) {
    throw new Error(`Parameter "endDate" must be in YYYY-MM-DD format, received "${effectiveEndDate}"`)
  }
  
  // Build date range
  const startDateTime = `${startDate} 00:00:00`
  const endDateTime = `${effectiveEndDate} 23:59:59`
  
  // Default fields
  const defaultFields: string[] = [
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
  
  // Build query
  const query: CdrQuery = {
    field: filters.fields || defaultFields,
    where: {
      rules: [
        { field: 'dt', condition: '>=', data: startDateTime },
        { field: 'dt', condition: '<=', data: endDateTime }
      ]
    },
    limit: filters.limit || 1000,
    order: []
  }
  
  // Add optional filters
  if (filters.cli) {
    query.where.rules.push({ field: 'dest_cli', condition: '=', data: filters.cli })
  }
  if (filters.dst) {
    query.where.rules.push({ field: 'dest_number', condition: '=', data: filters.dst })
  }
  if (filters.customer_id !== undefined) {
    query.where.rules.push({ field: 'customer_id', condition: '=', data: filters.customer_id })
  }
  if (filters.provider_id !== undefined) {
    query.where.rules.push({ field: 'provider_id', condition: '=', data: filters.provider_id })
  }
  
  const api: CxRestApi = getApi()
  return await api.post('cdr', query)
}

/**
 * MCP handler for search_cdr tool (Type-Safe)
 * 
 * @param {SearchCdrArgs} args - Tool arguments with date range and filters
 * @returns {Promise<CdrSearchResponse>} CDR search response
 */
export async function searchCdrHandler (
  args: SearchCdrArgs
): Promise<CdrSearchResponse> {
  const { start_date, end_date, cli, dst, customer_id, provider_id, limit } = args
  
  try {
    const filters: CdrSearchFilters = {}
    if (cli) filters.cli = cli
    if (dst) filters.dst = dst
    if (customer_id !== undefined) filters.customer_id = customer_id
    if (provider_id !== undefined) filters.provider_id = provider_id
    if (limit) filters.limit = limit
    
    const results: CdrRecord[] = await searchCdr(start_date, end_date, filters)
    const cdrArray: CdrRecord[] = Array.isArray(results) ? results : []
    
    const dateRange: string = end_date && end_date !== start_date 
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
  } catch (error: any) {
    const errorResponse: CdrSearchResponse = {
      success: false,
      date_range: start_date,
      result_count: 0,
      filters_applied: {},
      records: [],
      message: `Error: ${error.message}`
    }
    return errorResponse
  }
}

// ============================================================================
// Call Analytics (Type-Safe)
// ============================================================================

/**
 * Get call analytics comparing failed vs successful calls
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format (UTC)
 * @param {string} [endDate] - End date in YYYY-MM-DD format (UTC)
 * @param {CdrSearchFilters} [filters={}] - Optional filters
 * @returns {Promise<CallAnalyticsResponse>} Analytics with success/failure stats
 */
export async function getCallAnalytics (
  startDate: string,
  endDate?: string,
  filters: CdrSearchFilters = {}
): Promise<CallAnalyticsResponse> {
  const effectiveEndDate: string = endDate || startDate
  const dateRange: string = endDate && endDate !== startDate 
    ? `${startDate} to ${effectiveEndDate}`
    : startDate
  
  try {
    // 1. Get CDR data (successful calls)
    const cdrResults: CdrRecord[] = await searchCdr(startDate, effectiveEndDate, filters)
    const successfulCalls: CdrRecord[] = cdrResults.filter(
      (call: CdrRecord) => call.duration && call.duration > 0
    )
    
    // 2. Get logs data (all attempts) - simplified for demo
    const totalAttempts = 0 // Would come from searchCallLogs
    const failedAttempts: FailedCallSample[] = []
    
    // 3. Calculate statistics
    const successfulCount: number = successfulCalls.length
    const failedCount: number = totalAttempts > 0 ? totalAttempts - successfulCount : 0
    const successRate: number = totalAttempts > 0 
      ? (successfulCount / totalAttempts) * 100 
      : 0
    const failureRate: number = totalAttempts > 0 
      ? (failedCount / totalAttempts) * 100 
      : 0
    
    // Calculate totals
    const totalDuration: number = successfulCalls.reduce(
      (sum: number, call: CdrRecord) => sum + (call.duration || 0), 
      0
    )
    const totalCharges: number = successfulCalls.reduce(
      (sum: number, call: CdrRecord) => sum + (call.customer_charge || 0), 
      0
    )
    
    const summary: AnalyticsSummary = {
      total_attempts: totalAttempts,
      successful_calls: successfulCount,
      failed_calls: failedCount,
      success_rate: `${successRate.toFixed(2)}%`,
      failure_rate: `${failureRate.toFixed(2)}%`,
      total_duration_seconds: totalDuration.toFixed(2),
      total_charges: totalCharges.toFixed(2)
    }
    
    return {
      success: true,
      date_range: dateRange,
      filters_applied: filters,
      summary,
      top_failure_reasons: [],
      successful_calls_sample: successfulCalls.slice(0, 5),
      failed_calls_sample: failedAttempts.slice(0, 5),
      message: totalAttempts > 0
        ? `Analyzed ${totalAttempts} call attempt(s) in ${dateRange}. Success rate: ${successRate.toFixed(2)}%, Failure rate: ${failureRate.toFixed(2)}%.`
        : `Found ${successfulCount} successful call(s) in CDR for ${dateRange}. No attempt data available from logs (may need specific CLI/DST search terms).`,
      warning: totalAttempts === 0 && !filters.cli && !filters.dst
        ? 'No log search performed. Provide cli or dst filter to analyze attempt data and failure patterns.'
        : null
    }
  } catch (error: any) {
    const errorResponse: CallAnalyticsResponse = {
      success: false,
      date_range: dateRange,
      filters_applied: filters,
      summary: {
        total_attempts: 0,
        successful_calls: 0,
        failed_calls: 0,
        success_rate: '0%',
        failure_rate: '0%',
        total_duration_seconds: '0',
        total_charges: '0'
      },
      top_failure_reasons: [],
      successful_calls_sample: [],
      failed_calls_sample: [],
      message: `Error: ${error.message}`,
      error: error.message
    }
    return errorResponse
  }
}

// ============================================================================
// Entry Point — main () for cx run execution
// ============================================================================

/**
 * Entry point for ScriptForge execution via cx run.
 * Runs analyzeSipTrace with mock SIP data to verify the typed tools work.
 * @returns {Promise<SipTraceAnalysis>} Analysis result from mock SIP trace
 */
export async function main (): Promise<SipTraceAnalysis> {
  const mockMessages: SipTraceMessage[] = [
    {
      id: 1,
      date: '2026-02-16T10:00:00.000Z',
      micro_ts: 1739700000000000,
      callid: 'test-call-id-123@example.com',
      method: 'INVITE',
      reply_reason: '',
      ruri: 'sip:44123456789@sip.example.com',
      ruri_user: '44123456789',
      to_user: '44123456789',
      from_user: '44987654321',
      user_agent: 'TestUA/1.0',
      source_ip: '192.168.1.100',
      source_port: 5060,
      destination_ip: '10.0.0.1',
      destination_port: 5060,
      protocol: 'UDP',
      msg: 'INVITE sip:44123456789@sip.example.com SIP/2.0\r\nContent-Type: application/sdp\r\n\r\nv=0\r\nm=audio 10000 RTP/AVP 0 8\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000'
    },
    {
      id: 2,
      date: '2026-02-16T10:00:00.100Z',
      micro_ts: 1739700000100000,
      callid: 'test-call-id-123@example.com',
      method: '100',
      reply_reason: 'Trying',
      ruri: '',
      ruri_user: '',
      to_user: '44123456789',
      from_user: '44987654321',
      user_agent: 'ConnexCS/6.0',
      source_ip: '10.0.0.1',
      source_port: 5060,
      destination_ip: '192.168.1.100',
      destination_port: 5060,
      protocol: 'UDP',
      msg: 'SIP/2.0 100 Trying',
      delta: 100000
    },
    {
      id: 3,
      date: '2026-02-16T10:00:01.500Z',
      micro_ts: 1739700001500000,
      callid: 'test-call-id-123@example.com',
      method: '200',
      reply_reason: 'OK',
      ruri: '',
      ruri_user: '',
      to_user: '44123456789',
      from_user: '44987654321',
      user_agent: 'ConnexCS/6.0',
      source_ip: '10.0.0.1',
      source_port: 5060,
      destination_ip: '192.168.1.100',
      destination_port: 5060,
      protocol: 'UDP',
      msg: 'SIP/2.0 200 OK',
      delta: 1400000
    },
    {
      id: 4,
      date: '2026-02-16T10:05:00.000Z',
      micro_ts: 1739700300000000,
      callid: 'test-call-id-123@example.com',
      method: 'BYE',
      reply_reason: '',
      ruri: 'sip:44123456789@sip.example.com',
      ruri_user: '44123456789',
      to_user: '44123456789',
      from_user: '44987654321',
      user_agent: 'TestUA/1.0',
      source_ip: '192.168.1.100',
      source_port: 5060,
      destination_ip: '10.0.0.1',
      destination_port: 5060,
      protocol: 'UDP',
      msg: 'BYE sip:44123456789@sip.example.com SIP/2.0',
      delta: 298500000
    }
  ]

  return analyzeSipTrace(mockMessages)
}

/**
 * MCP handler for get_call_analytics tool (Type-Safe)
 * 
 * @param {GetCallAnalyticsArgs} args - Tool arguments with date range and filters
 * @returns {Promise<CallAnalyticsResponse>} Call analytics response
 */
export async function getCallAnalyticsHandler (
  args: GetCallAnalyticsArgs
): Promise<CallAnalyticsResponse> {
  const { start_date, end_date, cli, dst, customer_id, provider_id } = args
  
  try {
    const filters: CdrSearchFilters = {}
    if (cli) filters.cli = cli
    if (dst) filters.dst = dst
    if (customer_id !== undefined) filters.customer_id = customer_id
    if (provider_id !== undefined) filters.provider_id = provider_id
    
    return await getCallAnalytics(start_date, end_date, filters)
  } catch (error: any) {
    const errorResponse: CallAnalyticsResponse = {
      success: false,
      date_range: start_date,
      filters_applied: {},
      summary: {
        total_attempts: 0,
        successful_calls: 0,
        failed_calls: 0,
        success_rate: '0%',
        failure_rate: '0%',
        total_duration_seconds: '0',
        total_charges: '0'
      },
      top_failure_reasons: [],
      successful_calls_sample: [],
      failed_calls_sample: [],
      message: `Error: ${error.message}`,
      error: error.message
    }
    return errorResponse
  }
}