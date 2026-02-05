import { McpServer } from 'cxMcpServer';
import { C4, C5, AI } from 'cxCallControl';
import { kysely } from 'cxKysely';

const mcp = new McpServer('ConnexCS Call Debug MCP Server', '1.0.0', true);

// ============================================================================
// CALL DEBUG TOOLS
// ============================================================================

/**
 * Investigate Call via logging or analytics
 * Queries CDR database for historical call data with optimized performance
 */
async function investigateCall(args) {
	const {
		phone_number,
		start_date,
		end_date,
		call_status,
		min_duration,
		max_duration,
		direction,
		limit = 100,
		offset = 0,
		order_by = 'dt',
		order_direction = 'DESC'
	} = args;

	// Build the query using Kysely query builder for safety and efficiency
	let query = kysely.selectFrom('cdr.cdr')
		.selectAll()
		.where('dt', '>=', start_date)
		.where('dt', '<=', end_date);

	// Apply optional filters
	if (phone_number) {
		// Search in both source and destination
		query = query.where(eb => eb.or([
			eb('src_number', 'like', `%${phone_number}%`),
			eb('dest_number', 'like', `%${phone_number}%`)
		]));
	}

	if (call_status) {
		query = query.where('status', '=', call_status);
	}

	if (min_duration !== undefined) {
		query = query.where('duration', '>=', min_duration);
	}

	if (max_duration !== undefined) {
		query = query.where('duration', '<=', max_duration);
	}

	if (direction) {
		// Assuming direction logic based on your routing setup
		if (direction === 'inbound') {
			query = query.where('direction', '=', 'inbound');
		} else if (direction === 'outbound') {
			query = query.where('direction', '=', 'outbound');
		}
	}

	// Apply ordering and pagination
	query = query
		.orderBy(order_by, order_direction)
		.limit(limit)
		.offset(offset);

	// Execute query
	const sql = query.compile();
	const results = await kysely.executeQuery(sql);

	// Get total count for pagination info (optimized with same filters but no limit)
	let countQuery = kysely.selectFrom('cdr.cdr')
		.select(eb => eb.fn.count('id').as('total'))
		.where('dt', '>=', start_date)
		.where('dt', '<=', end_date);

	if (phone_number) {
		countQuery = countQuery.where(eb => eb.or([
			eb('src_number', 'like', `%${phone_number}%`),
			eb('dest_number', 'like', `%${phone_number}%`)
		]));
	}
	if (call_status) countQuery = countQuery.where('status', '=', call_status);
	if (min_duration !== undefined) countQuery = countQuery.where('duration', '>=', min_duration);
	if (max_duration !== undefined) countQuery = countQuery.where('duration', '<=', max_duration);
	if (direction === 'inbound') countQuery = countQuery.where('direction', '=', 'inbound');
	if (direction === 'outbound') countQuery = countQuery.where('direction', '=', 'outbound');

	const countSql = countQuery.compile();
	const countResult = await kysely.executeQuery(countSql);
	const totalCount = countResult[0]?.total || 0;

	return {
		success: true,
		data: results,
		pagination: {
			limit,
			offset,
			total: totalCount,
			returned: results.length,
			has_more: (offset + results.length) < totalCount
		},
		filters_applied: {
			phone_number,
			start_date,
			end_date,
			call_status,
			min_duration,
			max_duration,
			direction
		}
	};
}

/**
 * Find Call log by specific call ID or unique identifier
 * Retrieves detailed call information with all associated data
 */
async function findCallLog(args) {
	const {
		call_id,
		channel_uuid,
		src_number,
		dest_number,
		date,
		lookup_method = 'call_id'
	} = args;

	let query = kysely.selectFrom('cdr.cdr').selectAll();

	// Primary lookup methods
	switch (lookup_method) {
		case 'call_id':
			if (!call_id) {
				throw new Error('call_id is required when lookup_method is "call_id"');
			}
			query = query.where('id', '=', call_id);
			break;

		case 'channel_uuid':
			if (!channel_uuid) {
				throw new Error('channel_uuid is required when lookup_method is "channel_uuid"');
			}
			query = query.where('channel_uuid', '=', channel_uuid);
			break;

		case 'phone_numbers':
			if (!src_number || !dest_number) {
				throw new Error('Both src_number and dest_number are required when lookup_method is "phone_numbers"');
			}
			query = query
				.where('src_number', '=', src_number)
				.where('dest_number', '=', dest_number);
			
			// If date provided, narrow down the search
			if (date) {
				const startOfDay = new Date(date);
				startOfDay.setHours(0, 0, 0, 0);
				const endOfDay = new Date(date);
				endOfDay.setHours(23, 59, 59, 999);
				
				query = query
					.where('dt', '>=', startOfDay.toISOString())
					.where('dt', '<=', endOfDay.toISOString());
			}
			
			// Limit to most recent if multiple matches
			query = query.orderBy('dt', 'DESC').limit(10);
			break;

		default:
			throw new Error(`Invalid lookup_method: ${lookup_method}. Use "call_id", "channel_uuid", or "phone_numbers"`);
	}

	const sql = query.compile();
	const results = await kysely.executeQuery(sql);

	if (results.length === 0) {
		return {
			success: false,
			message: 'No call log found with the provided criteria',
			lookup_method,
			criteria: { call_id, channel_uuid, src_number, dest_number, date }
		};
	}

	// If single result, return detailed view
	if (results.length === 1) {
		const call = results[0];
		
		// Enrich with additional analytics
		return {
			success: true,
			call_log: call,
			analytics: {
				call_quality: calculateCallQuality(call),
				billing_info: calculateBillingInfo(call),
				routing_info: extractRoutingInfo(call)
			},
			lookup_method
		};
	}

	// Multiple results (only for phone_numbers lookup)
	return {
		success: true,
		message: 'Multiple calls found matching criteria',
		calls: results,
		count: results.length,
		lookup_method
	};
}

/**
 * Get active calls across all systems (C4, C5, AI)
 * Real-time monitoring of ongoing calls
 */
async function getActiveCalls(args) {
	const {
		system = 'all', // 'c4', 'c5', 'ai', or 'all'
		company_id,
		server_aliases = ['am1fs1'], // Default server
		filter_by,
		include_details = true
	} = args;

	const results = {
		success: true,
		timestamp: new Date().toISOString(),
		systems: {}
	};

	try {
		// Get C5 active calls
		if (system === 'all' || system === 'c5') {
			const c5 = await C5(server_aliases);
			const c5Calls = company_id 
				? await c5.activeCalls(company_id)
				: await c5.activeCalls();
			
			results.systems.c5 = {
				total_calls: c5Calls.length,
				calls: include_details ? c5Calls : undefined,
				summary: summarizeCalls(c5Calls)
			};
		}

		// Get C4 registrations
		if (system === 'all' || system === 'c4') {
			const c4 = await C4(server_aliases);
			const c4Registrations = await c4.registrations();
			
			results.systems.c4 = {
				total_registrations: c4Registrations.length,
				registrations: include_details ? c4Registrations : undefined
			};
		}

		// Get AI active calls
		if (system === 'all' || system === 'ai') {
			if (filter_by?.agent_dest) {
				const ai = await AI();
				const aiCalls = await ai.activeCalls(
					filter_by.agent_dest,
					filter_by.query || {},
					false
				);
				
				results.systems.ai = {
					total_calls: aiCalls.length,
					calls: include_details ? aiCalls : undefined,
					agent_dest: filter_by.agent_dest
				};
			} else if (system === 'ai') {
				results.systems.ai = {
					message: 'AI call monitoring requires agent_dest in filter_by parameter'
				};
			}
		}

		// Calculate totals
		results.totals = {
			c5_calls: results.systems.c5?.total_calls || 0,
			c4_registrations: results.systems.c4?.total_registrations || 0,
			ai_calls: results.systems.ai?.total_calls || 0
		};

		return results;

	} catch (error) {
		return {
			success: false,
			error: error.message,
			timestamp: new Date().toISOString()
		};
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateCallQuality(call) {
	const { duration, status, hangup_cause } = call;
	
	let quality_score = 100;
	
	// Penalize based on hangup cause
	if (hangup_cause && hangup_cause !== 'NORMAL_CLEARING') {
		quality_score -= 30;
	}
	
	// Penalize very short calls (likely failures)
	if (duration < 10 && status === 'answered') {
		quality_score -= 20;
	}
	
	// Bonus for successful longer calls
	if (duration > 60 && status === 'answered') {
		quality_score = Math.min(100, quality_score + 10);
	}
	
	return {
		score: Math.max(0, quality_score),
		status: quality_score >= 70 ? 'good' : quality_score >= 40 ? 'fair' : 'poor',
		factors: {
			duration_seconds: duration,
			call_status: status,
			hangup_cause: hangup_cause || 'unknown'
		}
	};
}

function calculateBillingInfo(call) {
	const { duration, status } = call;
	
	// Simple billing calculation - adjust based on your rates
	const rate_per_minute = 0.01; // $0.01 per minute
	const billable_duration = status === 'answered' ? duration : 0;
	const cost = (billable_duration / 60) * rate_per_minute;
	
	return {
		billable_duration_seconds: billable_duration,
		billable_duration_minutes: (billable_duration / 60).toFixed(2),
		estimated_cost: `$${cost.toFixed(4)}`,
		rate_per_minute: `$${rate_per_minute}`
	};
}

function extractRoutingInfo(call) {
	// Extract routing information from call record
	return {
		source: call.src_number,
		destination: call.dest_number,
		route_used: call.route_id || 'unknown',
		carrier: call.carrier_id || 'unknown',
		ingress_server: call.ingress_server || 'unknown',
		egress_server: call.egress_server || 'unknown'
	};
}

function summarizeCalls(calls) {
	const summary = {
		total: calls.length,
		by_status: {},
		total_duration: 0,
		avg_duration: 0
	};
	
	calls.forEach(call => {
		// Count by status
		const status = call.status || 'unknown';
		summary.by_status[status] = (summary.by_status[status] || 0) + 1;
		
		// Sum duration
		if (call.duration) {
			summary.total_duration += call.duration;
		}
	});
	
	summary.avg_duration = calls.length > 0 
		? (summary.total_duration / calls.length).toFixed(2)
		: 0;
	
	return summary;
}

// ============================================================================
// REGISTER MCP TOOLS
// ============================================================================

// Tool 1: Investigate Call via logging or analytics
mcp.addTool(
	'investigate_call',
	'Investigate calls via CDR database analytics. Query historical call records with filters for phone numbers, dates, status, duration, and direction. Optimized for large datasets with pagination support.',
	investigateCall
)
	.addParameter('start_date', 'string', 'Start date/time for search (ISO 8601 format, e.g., "2024-01-01T00:00:00Z"). REQUIRED for performance.', true)
	.addParameter('end_date', 'string', 'End date/time for search (ISO 8601 format, e.g., "2024-01-31T23:59:59Z"). REQUIRED for performance.', true)
	.addParameter('phone_number', 'string', 'Phone number to search (partial match in source or destination)', false)
	.addParameter('call_status', 'string', 'Filter by call status', false, undefined, { enum: ['answered', 'no_answer', 'busy', 'failed', 'cancelled'] })
	.addParameter('min_duration', 'number', 'Minimum call duration in seconds', false)
	.addParameter('max_duration', 'number', 'Maximum call duration in seconds', false)
	.addParameter('direction', 'string', 'Call direction filter', false, undefined, { enum: ['inbound', 'outbound'] })
	.addParameter('limit', 'number', 'Maximum number of results to return (default: 100, max: 1000)', false, 100)
	.addParameter('offset', 'number', 'Offset for pagination (default: 0)', false, 0)
	.addParameter('order_by', 'string', 'Field to order results by', false, 'dt', { enum: ['dt', 'duration', 'status', 'src_number', 'dest_number'] })
	.addParameter('order_direction', 'string', 'Sort direction', false, 'DESC', { enum: ['ASC', 'DESC'] });

// Tool 2: Find Call log
mcp.addTool(
	'find_call_log',
	'Find a specific call log by call ID, channel UUID, or phone numbers. Returns detailed call information with analytics including call quality, billing info, and routing details.',
	findCallLog
)
	.addParameter('lookup_method', 'string', 'Method to find the call', true, 'call_id', { enum: ['call_id', 'channel_uuid', 'phone_numbers'] })
	.addParameter('call_id', 'string', 'Unique call ID (required if lookup_method is "call_id")', false)
	.addParameter('channel_uuid', 'string', 'Channel UUID (required if lookup_method is "channel_uuid")', false)
	.addParameter('src_number', 'string', 'Source phone number (required if lookup_method is "phone_numbers")', false)
	.addParameter('dest_number', 'string', 'Destination phone number (required if lookup_method is "phone_numbers")', false)
	.addParameter('date', 'string', 'Date to narrow search when using phone_numbers (ISO 8601 format, optional)', false);

// Tool 3: Get Active Calls (Bonus real-time monitoring)
mcp.addTool(
	'get_active_calls',
	'Get real-time active calls across C4, C5, and AI systems. Monitor ongoing calls, registrations, and system status.',
	getActiveCalls
)
	.addParameter('system', 'string', 'Which system to query', false, 'all', { enum: ['all', 'c4', 'c5', 'ai'] })
	.addParameter('company_id', 'number', 'Filter by company ID (optional)', false)
	.addParameter('server_aliases', 'array', 'Array of server aliases to query', false, ['am1fs1'])
	.addParameter('filter_by', 'object', 'Additional filters (e.g., {agent_dest: "Agent123", query: {callStatus: "connected"}})', false)
	.addParameter('include_details', 'boolean', 'Include detailed call/registration data (false returns only counts)', false, true);

export function main(data) {
	return mcp.handle(data);
}