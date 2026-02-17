/**
 * ConnexCS Customer Destination Statistics Module (with cxRest Auth)
 * 
 * Uses the ConnexCS Breakout Aggrid API for real-time CDR aggregation
 * Provides breakdown of calls by destination, showing customer and provider 
 * card/route usage for analyzing call routing patterns and destination distribution.
 * 
 * API Endpoint:
 * https://app.connexcs.com/api/cp/breakout-aggrid
 * 
 * Authentication: cxRest library (via API_USERNAME environment variable)
 */

import auth from 'cxRest';

/**
 * Tool definition for LLM integration
 */
export const toolDefinition = {
	name: "get_customer_destination_statistics",
	description: "Get breakdown of calls by destination, showing customer and provider card/route usage for analyzing call routing patterns and destination distribution.",
	inputSchema: {
		type: "object",
		properties: {
			customer_id: {
				type: "string",
				description: "The unique customer ID or leave empty for all customers"
			},
			start_date: {
				type: "string",
				description: "Start date for statistics in YYYY-MM-DD format. Optional - defaults to last 30 days."
			},
			end_date: {
				type: "string",
				description: "End date for statistics in YYYY-MM-DD format. Optional - defaults to today."
			},
			limit: {
				type: "number",
				default: 20,
				description: "Number of top destinations to return (1-100)"
			}
		},
		required: ["customer_id"]
	}
};

/**
 * Initialize ConnexCS API client
 * @private
 */
async function initializeApiClient() {
	try {
		const apiUsername = process.env.API_USERNAME;
		if (!apiUsername) {
			return {
				success: false,
				error: 'API_USERNAME environment variable not set'
			};
		}

		const api = new auth(apiUsername);
		return {
			success: true,
			api: api
		};
	} catch (error) {
		return {
			success: false,
			error: error.message || 'Failed to initialize API client'
		};
	}
}

/**
 * Get customer destination statistics from ConnexCS using Breakout API
 * 
 * @param {Object} params - Parameters object
 * @param {string} params.customer_id - The unique customer ID
 * @param {string} [params.start_date] - Start date (YYYY-MM-DD, defaults to 30 days ago)
 * @param {string} [params.end_date] - End date (YYYY-MM-DD, defaults to today)
 * @param {number} [params.limit=20] - Number of top destinations to return
 * 
 * @returns {Promise<Object>} Result object with statistics or error
 */
export async function getCustomerDestinationStatistics(params = {}) {
	try {
		// Validate required parameters
		if (!params.customer_id) {
			return {
				success: false,
				error: 'customer_id is required'
			};
		}

		// Initialize API client
		const apiInit = await initializeApiClient();
		if (!apiInit.success) {
			return apiInit;
		}

		const api = apiInit.api;

		// Extract parameters with defaults
		const customerId = params.customer_id;
		const limit = Math.min(Math.max(params.limit || 20, 1), 100);

		// Set date range (defaults to last 30 days)
		let endDate = params.end_date;
		let startDate = params.start_date;

		if (!endDate) {
			endDate = new Date().toISOString().split('T')[0];
		}

		if (!startDate) {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			startDate = thirtyDaysAgo.toISOString().split('T')[0];
		}

		// Build the breakout API request
		const breakoutData = await fetchBreakoutAPI({
			api: api,
			customer_id: customerId,
			start_date: startDate,
			end_date: endDate
		});

		if (!breakoutData.success) {
			return {
				success: false,
				error: breakoutData.error,
				customer_id: customerId
			};
		}

		// Process the breakout data
		const processedData = processBreakoutData(
			breakoutData.data,
			customerId,
			limit
		);

		return {
			success: true,
			customer_id: customerId,
			start_date: startDate,
			end_date: endDate,
			summary: processedData.summary,
			destinations: processedData.destinations
		};

	} catch (error) {
		return {
			success: false,
			error: error.message || 'An unexpected error occurred',
			customer_id: params.customer_id
		};
	}
}

/**
 * Fetch data from ConnexCS Breakout API using cxRest
 * @private
 */
export async function fetchBreakoutAPI({ api, customer_id, start_date, end_date }) {
	try {
		// Format dates with timezone offset
		const startDateTime = `${start_date} 00:00:00`;
		const endDateTime = `${end_date} 23:59:59`;

		// Build the query parameters for aggrid
		const params = new URLSearchParams();
		params.append('s', '');
		params.append('_startRow', '0');
		params.append('_endRow', '10000');

		// Row group columns
		const rowGroupCols = [
			{ id: 'customer_id', displayName: 'Customer', field: 'customer_id' },
			{ id: 'provider_id', displayName: 'Provider', field: 'provider_id' },
			{ id: 'customer_card_dest_name', displayName: 'Customer Destination', field: 'customer_card_dest_name' },
			{ id: 'provider_card_dest_name', displayName: 'Provider Destination', field: 'provider_card_dest_name' }
		];

		rowGroupCols.forEach((col, idx) => {
			params.append(`_rowGroupCols[${idx}][id]`, col.id);
			params.append(`_rowGroupCols[${idx}][displayName]`, col.displayName);
			params.append(`_rowGroupCols[${idx}][field]`, col.field);
		});

		// Value columns
		const valueCols = [
			{ id: 'attempts', agg: 'sum', display: 'Attempts', field: 'attempts' },
			{ id: 'connected', agg: 'sum', display: 'Connected', field: 'connected' },
			{ id: 'duration', agg: 'sum', display: 'Duration', field: 'duration' },
			{ id: 'customer_charge', agg: 'sum', display: 'Customer Charge', field: 'customer_charge' },
			{ id: 'provider_charge', agg: 'sum', display: 'Provider Charge', field: 'provider_charge' },
			{ id: 'acd', agg: 'avg', display: 'ACD', field: 'acd' },
			{ id: 'asr', agg: 'avg', display: 'ASR', field: 'asr' },
			{ id: 'account_profit', agg: 'sum', display: 'Profit', field: 'account_profit' },
			{ id: 'account_profit_percent', agg: 'avg', display: 'Profit %', field: 'account_profit_percent' }
		];

		valueCols.forEach((col, idx) => {
			params.append(`_valueCols[${idx}][id]`, col.id);
			params.append(`_valueCols[${idx}][aggFunc]`, col.agg);
			params.append(`_valueCols[${idx}][displayName]`, col.display);
			params.append(`_valueCols[${idx}][field]`, col.field);
		});

		// Filter model
		params.append('_filterModel[dt][type]', 'inRange');
		params.append('_filterModel[dt][filter]', startDateTime);
		params.append('_filterModel[dt][filterTo]', endDateTime);

		if (customer_id && customer_id !== 'all') {
			params.append('_filterModel[customer_id][type]', 'equals');
			params.append('_filterModel[customer_id][filter]', parseInt(customer_id));
		}

		params.append('_pivotMode', 'false');

		const queryString = params.toString();

		// Use cxRest API to fetch breakout data
		const data = await api.get(`breakout-aggrid?${queryString}`);

		return {
			success: true,
			data: Array.isArray(data) ? data : [data]
		};

	} catch (error) {
		return {
			success: false,
			error: error.message || 'Failed to fetch breakout data'
		};
	}
}

/**
 * Process breakout API response data
 * @private
 */
export function processBreakoutData(rawData, customerId, limit) {
	const destinations = [];
	let totalAttempts = 0;
	let totalConnected = 0;
	let totalDuration = 0;
	let totalCustomerCharge = 0;
	let totalProviderCharge = 0;
	let totalProfit = 0;
	let totalASR = 0;
	let totalACD = 0;
	let recordCount = 0;

	// Parse raw data
	rawData.forEach(record => {
		// Filter by customer if needed
		if (customerId !== 'all' && record.customer_id.toString() !== customerId) {
			return;
		}

		const destination = {
			destination: getDestinationName(record),
			customer_id: record.customer_id,
			provider_id: record.provider_id,
			customer_destination: getArrayValue(record.customer_card_dest_name),
			provider_destination: getArrayValue(record.provider_card_dest_name),

			// Call metrics
			attempts: record.attempts || 0,
			connected: record.connected || 0,
			failed: (record.attempts || 0) - (record.connected || 0),
			asr: record.asr !== null ? parseFloat(record.asr.toFixed(2)) : 0,

			// Duration metrics
			duration: record.duration || 0,
			customer_duration: record.customer_duration || 0,
			provider_duration: record.provider_duration || 0,
			acd: record.acd !== null ? parseFloat(record.acd.toFixed(2)) : 0,

			// Financial metrics
			customer_charge: extractCharge(record.customer_charge),
			provider_charge: extractCharge(record.provider_charge),
			profit: record.account_profit !== null ? parseFloat(record.account_profit.toFixed(2)) : 0,
			profit_percent: record.account_profit_percent !== null ? parseFloat(record.account_profit_percent.toFixed(2)) : 0,

			// Additional metrics
			dtmf: record.dtmf || 0,
			sdp: record.sdp_6 || 0
		};

		destinations.push(destination);

		// Aggregate totals
		totalAttempts += destination.attempts;
		totalConnected += destination.connected;
		totalDuration += destination.duration;
		totalCustomerCharge += destination.customer_charge;
		totalProviderCharge += destination.provider_charge;
		totalProfit += destination.profit;
		totalASR += destination.asr;
		totalACD += destination.acd;
		recordCount += 1;
	});

	// Sort by attempts (call count)
	destinations.sort((a, b) => b.attempts - a.attempts);

	// Apply limit
	const limitedDestinations = destinations.slice(0, limit);

	// Calculate summary
	const summary = {
		total_calls: totalAttempts,
		total_destinations: destinations.length,
		successful_calls: totalConnected,
		failed_calls: totalAttempts - totalConnected,
		success_rate: totalAttempts > 0
			? parseFloat((totalConnected / totalAttempts * 100).toFixed(2))
			: 0,
		total_duration: Math.round(totalDuration),
		avg_call_duration: totalConnected > 0
			? parseFloat((totalDuration / totalConnected).toFixed(2))
			: 0,
		avg_asr: recordCount > 0
			? parseFloat((totalASR / recordCount).toFixed(2))
			: 0,
		avg_acd: recordCount > 0
			? parseFloat((totalACD / recordCount).toFixed(2))
			: 0,
		total_customer_charge: totalCustomerCharge,
		total_provider_charge: totalProviderCharge,
		total_profit: parseFloat(totalProfit.toFixed(2))
	};

	return {
		summary: summary,
		destinations: limitedDestinations
	};
}

/**
 * Extract destination name from record
 * @private
 */
export function getDestinationName(record) {
	// Try to get from customer card destination name
	const customerDest = getArrayValue(record.customer_card_dest_name);
	if (customerDest && customerDest !== '') {
		return customerDest;
	}

	// Fall back to provider card destination name
	const providerDest = getArrayValue(record.provider_card_dest_name);
	if (providerDest && providerDest !== '') {
		return providerDest;
	}

	// Fall back to IDs
	return `Customer ${record.customer_id}`;
}

/**
 * Extract value from nested array structure
 * @private
 */
export function getArrayValue(arrayData) {
	if (!arrayData) return '';

	// Handle nested array structure like [["", "UK", "USA"]]
	if (Array.isArray(arrayData)) {
		if (Array.isArray(arrayData[0])) {
			// Get non-empty values from nested array
			const values = arrayData[0].filter(v => v && v !== '');
			return values.length > 0 ? values.join(', ') : '';
		} else {
			// Simple array
			const values = arrayData.filter(v => v && v !== '');
			return values.length > 0 ? values.join(', ') : '';
		}
	}

	return arrayData || '';
}

/**
 * Extract charge amount from charge object
 * @private
 */
export function extractCharge(chargeObj) {
	if (!chargeObj || typeof chargeObj !== 'object') {
		return 0;
	}

	// Get the first currency value
	const values = Object.values(chargeObj);
	return values.length > 0 ? parseFloat(values[0]) : 0;
}

/**
 * Example usage
 */
export async function main() {
	const result = await getCustomerDestinationStatistics({
		customer_id: '123',
		limit: 20
	});

	if (result.success) {
		console.log('Customer Destination Statistics:', result);
	} else {
		console.error('Error:', result.error);
	}
}