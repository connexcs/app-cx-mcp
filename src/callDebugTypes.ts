/**
 * Type Definitions for ConnexCS Call Debug Tools
 * 
 * This file contains all TypeScript type definitions for call debugging operations.
 * Import these types in your logic files to ensure type safety.
 * 
 * Example usage:
 *   import type { SipTraceMessage, CallAnalyticsSummary } from './callDebugTypes'
 */

// ============================================================================
// API & Authentication Types
// ============================================================================

/**
 * ConnexCS REST API client interface
 */
export interface CxRestApi {
  get(endpoint: string, params?: Record<string, any>): Promise<any>
  post(endpoint: string, body?: any): Promise<any>
  put(endpoint: string, body?: any): Promise<any>
  delete(endpoint: string): Promise<any>
}

/**
 * API authentication configuration
 */
export interface ApiConfig {
  username: string
  baseUrl?: string
  timeout?: number
}

// ============================================================================
// SIP Trace Types
// ============================================================================

/**
 * Individual SIP message from trace
 */
export interface SipTraceMessage {
  id: number
  date: string
  micro_ts: number
  callid: string
  method: string
  reply_reason: string
  ruri: string
  ruri_user: string
  to_user: string
  from_user: string
  user_agent: string
  source_ip: string
  source_port: number
  destination_ip: string
  destination_port: number
  protocol: string
  msg: string
  delta?: number
}

/**
 * SIP call flow step (analyzed from raw messages)
 */
export interface SipCallFlowStep {
  time: string
  label: string
  from: string
  to: string
  from_user: string
  to_user: string
  protocol: string
  delta_ms: number
}

/**
 * SIP final response (e.g., 200 OK, 404 Not Found)
 */
export interface SipFinalResponse {
  code: number
  reason: string
}

/**
 * Analyzed SIP trace with insights
 */
export interface SipTraceAnalysis {
  message_count: number
  call_id: string | null
  from_user: string | null
  to_user: string | null
  start_time: string | null
  end_time: string | null
  duration_ms: number
  call_connected: boolean
  call_terminated: boolean
  final_response: SipFinalResponse | null
  pdd_ms: number | null
  setup_time_ms: number | null
  auth_required: boolean
  nat_detected: boolean
  anyedge_host: string | null
  protocols_used: string[]
  participants: string[]
  codecs: string[]
  call_flow: SipCallFlowStep[]
  issues: string[]
}

/**
 * SIP trace response from API
 */
export interface SipTraceResponse {
  success: boolean
  callid: string
  trace_available: boolean
  analysis?: SipTraceAnalysis
  raw_message_count?: number
  raw_messages?: SipTraceMessage[]
  issues?: string[]
  suggestions?: string[]
  message?: string
}

// ============================================================================
// Call Quality (RTCP) Types
// ============================================================================

/**
 * RTCP quality metrics for a single stream
 */
export interface RtcpQualityMetrics {
  mos?: number
  jitter?: number
  packet_loss?: number
  rtt?: number
  quality_assessment?: string
}

/**
 * RTCP quality response
 */
export interface CallQualityResponse {
  success: boolean
  callid: string
  has_rtcp: boolean
  upstream?: RtcpQualityMetrics
  downstream?: RtcpQualityMetrics
  message?: string
}

// ============================================================================
// Call Logs Types
// ============================================================================

/**
 * Routing parameters from call log
 */
export interface CallRoutingParams {
  switch?: string
  oU?: string
  fU?: string
  callid?: string
  userAgent?: string
  au?: string
  si?: string
  sp?: number
  rtp_ip?: string
  proto?: string
  reg_id?: string
  csIp?: string
  x_orig_ip?: string
  x_anyedge_host?: string
}

/**
 * Call routing information
 */
export interface CallRouting {
  params: CallRoutingParams
  sip_code: number
  sip_reason: string
  start_time: number
  server: string
  ou: string
  switch: string
  cli: string
  callid: string
  re: string
  log: string[]
  meta: Record<string, any>
  p: Record<string, any>
  account_id: number
  offer_auth?: boolean
  end_time: number
  attempts: any[]
  ok?: {
    duration: number
    callid_b: string
    release_reason: string
    provider_id: number
  }
  callidb: string
}

/**
 * Call log entry
 */
export interface CallLogEntry {
  routing: CallRouting
}

/**
 * Call logs search response
 */
export interface CallLogsResponse {
  success: boolean
  result_count: number
  calls: CallLogEntry[]
  search_term: string
  message: string
}

// ============================================================================
// CDR (Call Detail Records) Types
// ============================================================================

/**
 * CDR record for a completed call
 */
export interface CdrRecord {
  dt: string
  callid: string
  dest_cli: string
  dest_number: string
  duration: number
  customer_id: number
  customer_charge: number
  customer_card_currency: string
  provider_id: number
  provider_charge: number
  provider_card_currency: string
  branch_idx: number
}

/**
 * CDR search filters
 */
export interface CdrSearchFilters {
  cli?: string
  dst?: string
  customer_id?: number
  provider_id?: number
  limit?: number
  fields?: string[]
}

/**
 * CDR query structure for API
 */
export interface CdrQuery {
  field: string[]
  where: {
    rules: Array<{
      field: string
      condition: string
      data: string | number
    }>
  }
  limit: number
  order: any[]
}

/**
 * CDR search response
 */
export interface CdrSearchResponse {
  success: boolean
  date_range: string
  result_count: number
  filters_applied: CdrSearchFilters
  records: CdrRecord[]
  message: string
}

// ============================================================================
// Call Analytics Types
// ============================================================================

/**
 * Analytics summary statistics
 */
export interface AnalyticsSummary {
  total_attempts: number
  successful_calls: number
  failed_calls: number
  success_rate: string
  failure_rate: string
  total_duration_seconds: string
  total_charges: string
}

/**
 * Top failure reason with count
 */
export interface FailureReason {
  error: string
  count: number
  percentage: string
}

/**
 * Failed call sample
 */
export interface FailedCallSample {
  code: number
  reason: string
  callid: string
}

/**
 * Call analytics response
 */
export interface CallAnalyticsResponse {
  success: boolean
  date_range: string
  filters_applied: CdrSearchFilters
  summary: AnalyticsSummary
  top_failure_reasons: FailureReason[]
  successful_calls_sample: CdrRecord[]
  failed_calls_sample: FailedCallSample[]
  message: string
  warning?: string | null
  error?: string
}

// ============================================================================
// RTP Server Types
// ============================================================================

/**
 * RTP server group/zone
 */
export interface RtpServerGroup {
  id: number
  name: string
  location?: string
  status?: string
  elastic?: number
  transcoding?: number
}

/**
 * RTP server groups response
 */
export interface RtpServerGroupsResponse {
  success: boolean
  group_count: number
  groups: RtpServerGroup[]
  message?: string
}

// ============================================================================
// MCP Tool Handler Types
// ============================================================================

/**
 * MCP tool arguments for search_call_logs
 */
export interface SearchCallLogsArgs {
  search: string
}

/**
 * MCP tool arguments for search_cdr
 */
export interface SearchCdrArgs {
  start_date: string
  end_date?: string
  cli?: string
  dst?: string
  customer_id?: number
  provider_id?: number
  limit?: number
}

/**
 * MCP tool arguments for get_call_analytics
 */
export interface GetCallAnalyticsArgs {
  start_date: string
  end_date?: string
  cli?: string
  dst?: string
  customer_id?: number
  provider_id?: number
}

/**
 * MCP tool arguments for get_sip_trace
 */
export interface GetSipTraceArgs {
  callid: string
  callidb?: string
}

/**
 * MCP tool arguments for get_call_quality
 */
export interface GetCallQualityArgs {
  callid: string
}

/**
 * MCP tool arguments for investigate_call
 */
export interface InvestigateCallArgs {
  callid: string
  callidb?: string
}

// ============================================================================
// Customer Management Types
// ============================================================================

/**
 * Customer information
 */
export interface Customer {
  id: number
  name: string
  credit: number
  currency: string
  debit_limit: number
  status: string
  last_call: number | null
  ips: string[]
  sip_users: string[]
  cards: string[]
  contact_name: string[]
  tags: string[]
  account_manager_id: number
  cx_referal: number
  s3_size: number | null
}

/**
 * Customer balance information
 */
export interface CustomerBalance {
  credit: number
  debit_limit: number
  available_balance: number
  currency: string
}

/**
 * Customer search response
 */
export interface CustomerSearchResponse {
  success: boolean
  matchType: string
  id?: string
  customer?: Customer
  customers?: Customer[]
  totalFound?: number
  message: string
  search_type: string
  query: string
  error?: string
  suggestion?: string
}

/**
 * Customer balance response
 */
export interface CustomerBalanceResponse {
  success: boolean
  customer_id: string
  customer_name: string
  balance: CustomerBalance
  call_capability: {
    can_make_calls: boolean
    status: string
    message: string
  }
  message: string
  error?: string
}

// ============================================================================
// Error & Response Types
// ============================================================================

/**
 * Generic error response
 */
export interface ErrorResponse {
  success: false
  error: string
  suggestion?: string
}

/**
 * Generic success response
 */
export interface SuccessResponse<T = any> {
  success: true
  message?: string
  data?: T
}

/**
 * API response union type
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse
