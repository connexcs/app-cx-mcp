import auth from 'cxRest';

/**
 * ConnexCS Customer Call Statistics Script
 * Provides comprehensive call statistics for customers including attempts, 
 * connected calls, duration, charges, ACD, ASR, and profitability metrics
 * 
 * Usage:
 * import { getCustomerCallStatistics, toolDefinition } from "./connexcs_customer_stats";
 * 
 * const result = await getCustomerCallStatistics({
 *   customer_id: '12345',
 *   start_date: '2024-01-01',
 *   end_date: '2024-12-31'
 * });
 */

// Initialize API instance
let api = null;

export async function initializeAPI() {
	if (!api) {
		api =new auth(process.env.API_USERNAME);
	}
	return api;
}

export const toolDefinition = {
	name: 'get_customer_call_statistics',
	description: 'Get comprehensive call statistics for a customer including attempts, connected calls, duration, charges, ACD, ASR, profitability, and destination breakdowns.',
	inputSchema: {
		type: 'object',
		properties: {
			company_id: {
				type: 'string',
				description: 'The unique company/customer ID'
			},
			start_date: {
				type: 'string',
				description: 'Start date for statistics (ISO 8601 or Unix timestamp). Optional.'
			},
			end_date: {
				type: 'string',
				description: 'End date for statistics (ISO 8601 or Unix timestamp). Optional.'
			}
		},
		required: ['company_id']
	}
};

/**
 * Main execution function - Get customer call statistics
 * @param {Object} params - Input parameters
 * @param {string} params.company_id - Company/Customer ID
 * @param {string} [params.start_date] - Optional start date
 * @param {string} [params.end_date] - Optional end date
 * @returns {Promise<Object>} Call statistics
 */
export async function getCustomerCallStatistics(params) {
	try {
		const { company_id, customer_id, start_date, end_date } = params;

		// Support both company_id and customer_id for backwards compatibility
		const id = company_id || customer_id;

		// Validate id
		if (!id) {
			throw new Error('company_id is required');
		}

		// Parse dates if provided
		let startDate = start_date ? parseDate(start_date) : null;
		let endDate = end_date ? parseDate(end_date) : null;

		// IMPORTANT: Prevent "all time" queries which cause 500 errors
		// If no date range provided, default to last 90 days
		if (!startDate && !endDate) {
			endDate = new Date();
			startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
			console.warn('??  No date range specified. Using last 90 days:',
				startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
		}

		// Fetch CDR data for the customer
		let cdrData = [];
		try {
			cdrData = await fetchCustomerCDRs(id, startDate, endDate);
		} catch (error) {
			// Log the error but continue with empty data
			console.warn('CDR fetch failed:', error.message);
			cdrData = [];
		}

		// Calculate statistics
		const statistics = calculateStatistics(cdrData);

		// Fetch billing data for profitability metrics
		let billingData = {};
		try {
			billingData = await fetchBillingData(id, startDate, endDate);
		} catch (error) {
			// Log the error but continue
			console.warn('Billing fetch failed:', error.message);
			billingData = {
				total_invoices: 0,
				unique_invoice_ids: 0,
				date_range: null,
				invoices: []
			};
		}

		statistics.billing = billingData;

		return {
			success: true,
			company_id: id,
			period: {
				start: startDate ? startDate.toISOString() : 'Not specified',
				end: endDate ? endDate.toISOString() : 'Not specified'
			},
			statistics: statistics
		};
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
}

/**
 * Parse date string (ISO 8601 or Unix timestamp)
 * @param {string} dateStr - Date string to parse
 * @returns {Date} Parsed date
 */
export function parseDate(dateStr) {
	// Check if it's a Unix timestamp
	if (!isNaN(dateStr) && dateStr.length === 10) {
		return new Date(parseInt(dateStr) * 1000);
	}
	// Otherwise treat as ISO 8601
	return new Date(dateStr);
}

/**
 * Fetch CDR records for a customer using cxRest API
 * @param {string} customerId - Customer ID or company_id
 * @param {Date} startDate - Optional start date
 * @param {Date} endDate - Optional end date
 * @returns {Promise<Array>} CDR records
 */
export async function fetchCustomerCDRs(customerId, startDate, endDate) {
	try {
		const api = await initializeAPI();

		// Format dates for API (YYYY-MM-DD HH:MM:SS)
		const formatDateTime = (date) => {
			if (!date) return null;
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			const seconds = String(date.getSeconds()).padStart(2, '0');
			return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
		};

		// Build where conditions
		const whereRules = [
			{
				field: 'customer_id',
				condition: '=',
				data: customerId
			}
		];

		// Add date filters if provided
		if (startDate) {
			whereRules.push({
				field: 'dt',
				condition: '>=',
				data: formatDateTime(startDate)
			});
		}

		if (endDate) {
			whereRules.push({
				field: 'dt',
				condition: '<=',
				data: formatDateTime(endDate)
			});
		}

		// Build the payload - include all cost-related fields
		const payload = {
			field: [
				'dt',
				'callid',
				'dest_cli',
				'dest_number',
				'duration',
				'source_cli',
				'source_dest_number',
				'customer_charge',          // Customer charge per call
				'customer_duration',        // Duration for charging
				'customer_id',
				'customer_card_rate',       // Card rate used
				'customer_card_dest_code',  // Destination code
				'customer_card_dest_name',  // Destination name
				'pdd_in',                   // Post Dial Delay inbound
				'pdd_out',                  // Post Dial Delay outbound
				'ring_duration',            // Ring time
				'sip_code',                 // SIP response code
				'sip_reason',               // SIP reason
				'release_reason',           // Call release reason
				'recording_cost'            // Recording cost if any
			],
			where: {
				rules: whereRules
			},
			limit: 5000,
			order: [
				{
					field: 'dt',
					direction: 'DESC'
				}
			]
		};

		// Use cxRest API to fetch CDR data
		const response = await api.post('cdr', payload);

		// Handle response - it can be array or object with result property
		const data = Array.isArray(response) ? response : (response.result || response.data || []);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.error('Error fetching CDRs:', error.message);
		return [];
	}
}

/**
 * Fetch billing data for customer using cxRest API
 * @param {string} customerId - Customer ID or company_id
 * @param {Date} startDate - Optional start date
 * @param {Date} endDate - Optional end date
 * @returns {Promise<Object>} Billing data
 */
export async function fetchBillingData(customerId, startDate, endDate) {
	try {
		const api = await initializeAPI();

		// Use cxRest API to fetch billed invoices for specific company
		// Endpoint: invoice/billed?company_id={customerId}
		const response = await api.get(`invoice/billed`, {
			company_id: customerId
		});

		const invoices = response.result || response.data || response || [];

		// Convert to array if needed
		const invoiceArray = Array.isArray(invoices) ? invoices : [];

		// Filter by date if provided
		let filtered = invoiceArray;
		if (startDate || endDate) {
			filtered = invoiceArray.filter(inv => {
				const invDate = new Date(inv.cdr_date);
				if (startDate && invDate < startDate) return false;
				if (endDate && invDate > endDate) return false;
				return true;
			});
		}

		// Calculate billing metrics
		return {
			total_invoices: filtered.length,
			unique_invoice_ids: [...new Set(filtered.map(inv => inv.invoice_id))].length,
			date_range: filtered.length > 0 ? {
				first_date: filtered[0].cdr_date,
				last_date: filtered[filtered.length - 1].cdr_date
			} : null,
			invoices: filtered
		};
	} catch (error) {
		console.error('Error fetching billing data:', error.message);
		return {
			total_invoices: 0,
			unique_invoice_ids: 0,
			error: error.message,
			invoices: []
		};
	}
}

/**
 * Calculate comprehensive call statistics from CDR data
 * @param {Array} cdrData - CDR records
 * @returns {Object} Calculated statistics
 */
export function calculateStatistics(cdrData) {
	const stats = {
		total_calls: cdrData.length,
		connected_calls: 0,
		failed_calls: 0,
		total_duration: 0,
		average_duration: 0,
		total_cost: 0,
		average_cost_per_call: 0,
		acd: 0, // Average Call Duration
		asr: 0, // Answer Seizure Ratio
		profit_metrics: {},
		destination_breakdown: {},
		hourly_breakdown: {},
		daily_breakdown: {}
	};

	if (cdrData.length === 0) {
		return stats;
	}

	// Process each CDR record
	cdrData.forEach(cdr => {
		// Handle duration - use customer_duration or duration
		const duration = parseInt(cdr.customer_duration || cdr.duration || 0);

		// Handle cost - use customer_charge (the actual amount billed to customer)
		const cost = parseFloat(cdr.customer_charge || 0);

		// Count connected calls (duration > 0 or has SIP code)
		if (duration > 0 || cdr.sip_code) {
			stats.connected_calls++;
		} else {
			stats.failed_calls++;
		}

		// Calculate duration metrics
		stats.total_duration += duration;

		// Calculate cost metrics
		stats.total_cost += cost;

		// Destination breakdown - use dest_number or customer_card_dest_name
		const destination = cdr.customer_card_dest_name || cdr.dest_number || 'Unknown';
		if (!stats.destination_breakdown[destination]) {
			stats.destination_breakdown[destination] = {
				calls: 0,
				duration: 0,
				cost: 0
			};
		}
		stats.destination_breakdown[destination].calls++;
		stats.destination_breakdown[destination].duration += duration;
		stats.destination_breakdown[destination].cost += cost;

		// Hourly breakdown
		if (cdr.dt) {
			const date = new Date(cdr.dt);
			const hour = `${date.getHours().toString().padStart(2, '0')}:00`;
			if (!stats.hourly_breakdown[hour]) {
				stats.hourly_breakdown[hour] = { calls: 0, duration: 0, cost: 0 };
			}
			stats.hourly_breakdown[hour].calls++;
			stats.hourly_breakdown[hour].duration += duration;
			stats.hourly_breakdown[hour].cost += cost;
		}

		// Daily breakdown
		if (cdr.dt) {
			const date = new Date(cdr.dt);
			const day = date.toISOString().split('T')[0];
			if (!stats.daily_breakdown[day]) {
				stats.daily_breakdown[day] = { calls: 0, duration: 0, cost: 0 };
			}
			stats.daily_breakdown[day].calls++;
			stats.daily_breakdown[day].duration += duration;
			stats.daily_breakdown[day].cost += cost;
		}
	});

	// Calculate averages
	stats.average_duration = stats.connected_calls > 0
		? Math.round(stats.total_duration / stats.connected_calls)
		: 0;

	stats.average_cost_per_call = stats.total_calls > 0
		? (stats.total_cost / stats.total_calls).toFixed(4)
		: 0;

	// ACD (Average Call Duration) in seconds
	stats.acd = stats.average_duration;

	// ASR (Answer Seizure Ratio) as percentage
	stats.asr = stats.total_calls > 0
		? ((stats.connected_calls / stats.total_calls) * 100).toFixed(2)
		: 0;

	// Profitability metrics
	stats.profit_metrics = {
		total_cost: stats.total_cost.toFixed(4),
		calls_with_profit: countProfitableCalls(cdrData),
		calls_with_loss: countLosingCalls(cdrData),
		average_margin: calculateAverageMargin(cdrData)
	};

	return stats;
}

/**
 * Count calls with profit (requires revenue data)
 * @param {Array} cdrData - CDR records
 * @returns {number} Count of profitable calls
 */
export function countProfitableCalls(cdrData) {
	return cdrData.filter(cdr => {
		const revenue = parseFloat(cdr.revenue || 0);
		const cost = parseFloat(cdr.cost || 0);
		return revenue > cost;
	}).length;
}

/**
 * Count calls with loss (requires revenue data)
 * @param {Array} cdrData - CDR records
 * @returns {number} Count of losing calls
 */
export function countLosingCalls(cdrData) {
	return cdrData.filter(cdr => {
		const revenue = parseFloat(cdr.revenue || 0);
		const cost = parseFloat(cdr.cost || 0);
		return revenue < cost && cost > 0;
	}).length;
}

/**
 * Calculate average profit margin
 * @param {Array} cdrData - CDR records
 * @returns {string} Average margin as percentage
 */
export function calculateAverageMargin(cdrData) {
	const callsWithRevenue = cdrData.filter(cdr => parseFloat(cdr.revenue || 0) > 0);

	if (callsWithRevenue.length === 0) return '0.00';

	const totalMargin = callsWithRevenue.reduce((sum, cdr) => {
		const revenue = parseFloat(cdr.revenue || 0);
		const cost = parseFloat(cdr.cost || 0);
		const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
		return sum + margin;
	}, 0);

	return (totalMargin / callsWithRevenue.length).toFixed(2);
}