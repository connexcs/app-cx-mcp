import { getApi } from './callDebugTools'

/**
 * Error response helper
 * @param {string} error - Error message
 * @returns {Object} Error response object
 */
function errorResponse(error) {
	return { success: false, error };
}

/**
 * Normalize API response to array format
 * @param {any} data - Data from API
 * @returns {Array} Normalized array
 */
function normalizeToArray(data) {
	return Array.isArray(data) ? data : (data ? [data] : []);
}

/**
 * Build URLSearchParams for breakout-aggrid API
 * Follows the ag-grid server-side pattern with row grouping and value columns
 * @param {Object} options - Configuration options
 * @param {Array} options.rowGroupCols - Row grouping columns
 * @param {Array} options.valueCols - Value columns with aggregation functions
 * @param {string} options.startDate - Filter start date
 * @param {string} options.endDate - Filter end date
 * @param {string} options.customerId - Optional customer ID filter
 * @param {string} options.providerId - Optional provider ID filter
 * @param {number} options.startRow - Pagination start row (default 0)
 * @param {number} options.endRow - Pagination end row (default 10000)
 * @returns {URLSearchParams} Built parameters
 */
function buildBreakoutAggridParams(options) {
	const {
		rowGroupCols = [],
		valueCols = [],
		startDate,
		endDate,
		customerId,
		providerId,
		startRow = 0,
		endRow = 10000
	} = options;

	const params = new URLSearchParams({
		's': '',
		'_startRow': String(startRow),
		'_endRow': String(endRow),
		'_pivotMode': 'false'
	});

	// Add row group columns
	rowGroupCols.forEach((col, index) => {
		params.append(`_rowGroupCols[${index}][id]`, col.id);
		params.append(`_rowGroupCols[${index}][displayName]`, col.displayName);
		params.append(`_rowGroupCols[${index}][field]`, col.field);
	});

	// Add value columns
	valueCols.forEach((col, index) => {
		params.append(`_valueCols[${index}][id]`, col.id);
		params.append(`_valueCols[${index}][field]`, col.field);
		params.append(`_valueCols[${index}][displayName]`, col.displayName);
		params.append(`_valueCols[${index}][aggFunc]`, col.aggFunc);
	});

	// Add date filter
	if (startDate && endDate) {
		params.append('_filterModel[dt][type]', 'inRange');
		params.append('_filterModel[dt][filter]', startDate);
		params.append('_filterModel[dt][filterTo]', endDate);
	}

	// Add customer ID filter
	if (customerId) {
		params.append('_filterModel[customer_id][type]', 'equals');
		params.append('_filterModel[customer_id][filter]', String(customerId));
	}

	// Add provider ID filter
	if (providerId) {
		params.append('_filterModel[provider_id][type]', 'equals');
		params.append('_filterModel[provider_id][filter]', String(providerId));
	}

	return params;
}

/**
 * Get row group columns for single customer analysis
 * Groups only by customer_id and optionally time period
 * @param {boolean} includeTime - Whether to include time grouping
 * @param {string} timeGrouping - Time grouping type: 'day', 'week', 'month'
 * @returns {Array} Row group column definitions
 */
function getCustomerRowGroupCols(includeTime = false, timeGrouping = null) {
	const cols = [
		{ id: 'customer_id', displayName: 'Customer', field: 'customer_id' }
	];
	
	if (includeTime && timeGrouping) {
		cols.push({ id: 'dt', displayName: 'Date', field: 'dt' });
	}
	
	return cols;
}

/**
 * Get row group columns for multi-customer ranking analysis
 * Groups by customer, provider, and destination for detailed breakdown
 * @returns {Array} Row group column definitions
 */
function getStandardRowGroupCols() {
	return [
		{ id: 'customer_id', displayName: 'Customer', field: 'customer_id' },
		{ id: 'provider_id', displayName: 'Provider', field: 'provider_id' },
		{ id: 'customer_card_dest_name', displayName: 'Customer Destination Name', field: 'customer_card_dest_name' },
		{ id: 'provider_card_dest_name', displayName: 'Provider Destination Name', field: 'provider_card_dest_name' }
	];
}

/**
 * Get standard value columns for breakout analysis
 * @returns {Array} Value column definitions with aggregation functions
 */
function getStandardValueCols() {
	return [
		{ id: 'attempts', field: 'attempts', displayName: 'Attempts', aggFunc: 'sum' },
		{ id: 'connected', field: 'connected', displayName: 'Connected', aggFunc: 'sum' },
		{ id: 'customer_duration', field: 'customer_duration', displayName: 'Customer Duration', aggFunc: 'sum' },
		{ id: 'provider_duration', field: 'provider_duration', displayName: 'Provider Duration', aggFunc: 'sum' },
		{ id: 'duration', field: 'duration', displayName: 'Duration', aggFunc: 'sum' },
		{ id: 'customer_charge', field: 'customer_charge', displayName: 'Customer Charge', aggFunc: 'sum' },
		{ id: 'provider_charge', field: 'provider_charge', displayName: 'Provider Charge', aggFunc: 'sum' },
		{ id: 'acd', field: 'acd', displayName: 'ACD', aggFunc: 'avg' },
		{ id: 'asr', field: 'asr', displayName: 'ASR', aggFunc: 'avg' },
		{ id: 'dtmf', field: 'dtmf', displayName: 'DTMF', aggFunc: 'sum' },
		{ id: 'account_profit', field: 'account_profit', displayName: 'Profit', aggFunc: 'sum' },
		{ id: 'account_profit_percent', field: 'account_profit_percent', displayName: 'Profit Percent', aggFunc: 'avg' },
		{ id: 'sdp_6', field: 'sdp_6', displayName: 'SDP', aggFunc: 'sum' },
		{ id: 'customer_card_dest_name', field: 'customer_card_dest_name', displayName: 'Customer Card Dest Name', aggFunc: 'groupUniqArray' },
		{ id: 'provider_card_dest_name', field: 'provider_card_dest_name', displayName: 'Provider Card Dest Name', aggFunc: 'groupUniqArray' }
	];
}

/**
 * Get default date range (last 30 days)
 * @returns {Object} Object with startDate and endDate
 */
function getDefaultDateRange() {
	const endDate = new Date();
	const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
	
	const formatDate = (date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	};
	
	return {
		startDate: formatDate(startDate),
		endDate: formatDate(endDate)
	};
}

/**
 * Format datetime string to SQL format
 * @param {string} dateStr - Date string
 * @param {boolean} endOfDay - If true, set time to 23:59:59
 * @returns {string} Formatted datetime
 */
function formatDateForQuery(dateStr, endOfDay = false) {
	const date = new Date(dateStr);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	
	if (endOfDay) {
		return `${year}-${month}-${day} 23:59:59`;
	}
	return `${year}-${month}-${day} 00:00:00`;
}

/**
 * Sum all currency values from a charge object (e.g., {"USD": 3.7, "EUR": 1.2} ? 4.9)
 * If the value is already a number, return it directly.
 * @param {Object|number} charge - Currency object or number
 * @returns {number} Total charge value
 */
function sumChargeValues(charge) {
	if (typeof charge === 'number') return charge;
	if (charge && typeof charge === 'object') {
		return Object.values(charge).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
	}
	return 0;
}

/**
 * Extract currency breakdown from a charge object
 * @param {Object|number} charge - Currency object or number
 * @returns {Object} Currency breakdown
 */
function getChargeBreakdown(charge) {
	if (typeof charge === 'number') return { default: charge };
	if (charge && typeof charge === 'object') return { ...charge };
	return {};
}

/**
 * Calculate profitability metrics from breakout data
 * Preserves all original API data and adds calculated total fields
 * @param {Array} records - Array of breakout records
 * @returns {Array} Array of records with original data plus profitability totals
 */
function calculateProfitabilityMetrics(records) {
	if (!records || records.length === 0) {
		return [];
	}

	return records.map(record => {
		const customerCharge = sumChargeValues(record.customer_charge);
		const providerCharge = sumChargeValues(record.provider_charge);
		const profit = parseFloat(record.account_profit) || 0;

		return {
			...record,  // Preserve all original API fields
			total_revenue: customerCharge,
			total_cost: providerCharge,
			total_profit: profit
		};
	});
}

/**
 * Get customer profitability details
 * Analyze customer profitability including revenue, costs, profit margins, and cost comparison across different currencies.
 * 
 * @param {Object} data - Request data
 * @param {string} data.customer_id - The unique customer ID (required)
 * @param {string} data.start_date - Start date (ISO format). Defaults to 30 days ago.
 * @param {string} data.end_date - End date (ISO format). Defaults to now.
 * @param {string} data.group_by - Group by time period: 'day', 'week', 'month'
 * @returns {Object} Response with profitability data and metrics
 */
export async function getCustomerProfitability(data, meta) {
	try {
		const api = getApi();
		const { customer_id, start_date, end_date, group_by } = data || {};

		if (!customer_id) {
			return errorResponse('customer_id is required');
		}

		// Set default date range if not provided
		const dateRange = getDefaultDateRange();
		const queryStartDate = start_date ? formatDateForQuery(start_date, false) : dateRange.startDate;
		const queryEndDate = end_date ? formatDateForQuery(end_date, true) : dateRange.endDate;

		// Build row group columns - only group by customer_id (and time if specified)
		const includeTime = !!group_by;
		const rowGroupCols = getCustomerRowGroupCols(includeTime, group_by);

		// Build value columns
		const valueCols = getStandardValueCols();

		// Build URL parameters for ag-grid API
		const params = buildBreakoutAggridParams({
			rowGroupCols,
			valueCols,
			startDate: queryStartDate,
			endDate: queryEndDate,
			customerId: customer_id,
			startRow: 0,
			endRow: 10000
		});

		const breakoutData = normalizeToArray(await api.get(`breakout-aggrid?${params.toString()}`));

		if (!breakoutData || breakoutData.length === 0) {
			return {
				success: true,
				customer_id,
				totalRecords: 0,
				data: [],
				metrics: { total_revenue: {}, total_cost: {}, total_profit: 0, profit_margin: 0 },
				message: `No profitability data found for customer ${customer_id} in the specified period`,
				dateRange: { start: queryStartDate, end: queryEndDate },
				groupBy: group_by || 'none'
			};
		}

		const enrichedData = calculateProfitabilityMetrics(breakoutData);

		// Aggregate revenue/cost per currency across all records
		const revenueByCurrency = {};
		const costByCurrency = {};
		enrichedData.forEach(r => {
			for (const [curr, val] of Object.entries(r.customer_charge)) {
				revenueByCurrency[curr] = (revenueByCurrency[curr] || 0) + (parseFloat(val) || 0);
			}
			for (const [curr, val] of Object.entries(r.provider_charge)) {
				costByCurrency[curr] = (costByCurrency[curr] || 0) + (parseFloat(val) || 0);
			}
		});

		// Round currency values
		for (const curr in revenueByCurrency) revenueByCurrency[curr] = parseFloat(revenueByCurrency[curr].toFixed(2));
		for (const curr in costByCurrency) costByCurrency[curr] = parseFloat(costByCurrency[curr].toFixed(2));

		const totalProfit = enrichedData.reduce((sum, r) => sum + r.total_profit, 0);
		const totalRevenue = enrichedData.reduce((sum, r) => sum + r.total_revenue, 0);
		const totalAttempts = enrichedData.reduce((sum, r) => sum + r.attempts, 0);
		const totalConnected = enrichedData.reduce((sum, r) => sum + r.connected, 0);

		return {
			success: true,
			customer_id,
			totalRecords: enrichedData.length,
			data: enrichedData,
			metrics: {
				total_revenue: revenueByCurrency,
				total_cost: costByCurrency,
				total_profit: parseFloat(totalProfit.toFixed(2)),
				profit_margin: totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
				total_attempts: totalAttempts,
				total_connected: totalConnected,
				avg_asr: enrichedData.length > 0 ? parseFloat((enrichedData.reduce((sum, r) => sum + r.asr, 0) / enrichedData.length).toFixed(2)) : 0,
				avg_acd: enrichedData.length > 0 ? parseFloat((enrichedData.reduce((sum, r) => sum + r.acd, 0) / enrichedData.length).toFixed(2)) : 0
			},
			dateRange: { start: queryStartDate, end: queryEndDate },
			groupBy: group_by || 'none'
		};
	} catch (error) {
		return errorResponse(`Failed to get customer profitability: ${error.message}`);
	}
}

/**
 * List customers ranked by profitability metrics
 * Returns a ranked list of customers by profitability to identify top revenue generators,
 * most profitable accounts, or customers with best margins.
 * 
 * @param {Object} data - Request data
 * @param {string} data.provider_id - Optional: Filter by specific provider ID
 * @param {string} data.start_date - Start date (ISO format). Defaults to 30 days ago.
 * @param {string} data.end_date - End date (ISO format). Defaults to now.
 * @param {string} data.sort_by - Sort metric: 'total_profit', 'profit_margin', 'total_revenue', 'total_cost'. Defaults to 'total_profit'.
 * @param {string} data.sort_order - Sort order: 'desc' or 'asc'. Defaults to 'desc'.
 * @param {number} data.limit - Max results to return (1-100). Defaults to 10.
 * @param {number} data.offset - Records to skip for pagination. Defaults to 0.
 * @param {number} data.min_profit - Filter: only customers with profit above this value.
 * @param {string} data.currency - Currency for results.
 * @returns {Object} Response with ranked customer list and summary
 */
export async function listCustomersByProfitability(data, meta) {
	try {
		const api = getApi();
		const {
			provider_id,
			start_date,
			end_date,
			sort_by = 'total_profit',
			sort_order = 'desc',
			limit = 10,
			offset = 0,
			min_profit
		} = data || {};

		// Validate inputs
		const validSortBy = ['total_profit', 'profit_margin', 'total_revenue', 'total_cost'];
		const validSortOrder = ['desc', 'asc'];
		const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
		const validOffset = Math.max(parseInt(offset) || 0, 0);

		if (!validSortBy.includes(sort_by)) {
			return errorResponse(`Invalid sort_by. Must be one of: ${validSortBy.join(', ')}`);
		}

		if (!validSortOrder.includes(sort_order)) {
			return errorResponse(`Invalid sort_order. Must be 'asc' or 'desc'`);
		}

		// Set default date range if not provided
		const dateRange = getDefaultDateRange();
		const queryStartDate = start_date ? formatDateForQuery(start_date, false) : dateRange.startDate;
		const queryEndDate = end_date ? formatDateForQuery(end_date, true) : dateRange.endDate;

		// Build row group columns - group by customer, provider, and destination
		const rowGroupCols = getStandardRowGroupCols();

		// Build value columns
		const valueCols = getStandardValueCols();

		// Build URL parameters for ag-grid API
		const params = buildBreakoutAggridParams({
			rowGroupCols,
			valueCols,
			startDate: queryStartDate,
			endDate: queryEndDate,
			providerId: provider_id,
			startRow: 0,
			endRow: 10000
		});

		const breakoutData = normalizeToArray(await api.get(`breakout-aggrid?${params.toString()}`));

		if (!breakoutData || breakoutData.length === 0) {
			return {
				success: true,
				totalRecords: 0,
				customers: [],
				summary: { total_revenue: 0, total_cost: 0, total_profit: 0, profit_margin: 0 },
				pagination: { limit: validLimit, offset: validOffset, total: 0 },
				sortBy: sort_by,
				sortOrder: sort_order,
				message: 'No customer profitability data found in the specified period',
				dateRange: { start: queryStartDate, end: queryEndDate }
			};
		}

		// Calculate profitability metrics for each record
		const enrichedRecords = calculateProfitabilityMetrics(breakoutData);

		// Aggregate by customer for ranking
		const customerMap = {};
		enrichedRecords.forEach(record => {
			const customerId = record.customer_id;
			if (!customerMap[customerId]) {
				// Initialize with all fields from first record, then override with aggregation accumulators
				customerMap[customerId] = {
					...record,  // Spread all API fields from first record
					total_revenue: 0,
					total_cost: 0,
					total_profit: 0,
					attempts: 0,
					connected: 0,
					customer_duration: 0,
					asr_sum: 0,
					acd_sum: 0,
					record_count: 0
				};
			}
			const customer = customerMap[customerId];
			customer.total_revenue += record.total_revenue;
			customer.total_cost += record.total_cost;
			customer.total_profit += record.total_profit;
			customer.attempts += record.attempts;
			customer.connected += record.connected;
			customer.customer_duration += record.customer_duration;
			customer.asr_sum += record.asr;
			customer.acd_sum += record.acd;
			customer.record_count += 1;
		});

		// Convert to array with aggregated metrics
		let customers = Object.values(customerMap).map(c => {
			// Remove internal tracking fields, keep everything else
			const { asr_sum, acd_sum, record_count, ...customerData } = c;
			
			return {
				...customerData,  // All API fields + aggregated values
				profit_margin: c.total_revenue > 0 
					? parseFloat(((c.total_profit / c.total_revenue) * 100).toFixed(2))
					: 0,
				asr: c.record_count > 0 ? parseFloat((c.asr_sum / c.record_count).toFixed(2)) : 0,
				acd: c.record_count > 0 ? parseFloat((c.acd_sum / c.record_count).toFixed(2)) : 0
			};
		});

		// Apply min_profit filter
		if (min_profit !== undefined) {
			customers = customers.filter(c => parseFloat(c.total_profit) >= min_profit);
		}

		// Sort by requested metric
		const sortMultiplier = sort_order === 'asc' ? 1 : -1;
		customers.sort((a, b) => {
			let aValue, bValue;
			
			switch (sort_by) {
				case 'profit_margin':
					aValue = parseFloat(a.profit_margin);
					bValue = parseFloat(b.profit_margin);
					break;
				case 'total_revenue':
					aValue = parseFloat(a.total_revenue);
					bValue = parseFloat(b.total_revenue);
					break;
				case 'total_cost':
					aValue = parseFloat(a.total_cost);
					bValue = parseFloat(b.total_cost);
					break;
				case 'total_profit':
				default:
					aValue = parseFloat(a.total_profit);
					bValue = parseFloat(b.total_profit);
			}
			
			return (bValue - aValue) * sortMultiplier;
		});

		// Apply pagination
		const paginatedCustomers = customers.slice(validOffset, validOffset + validLimit).map(c => ({
			...c,
			total_revenue: parseFloat(c.total_revenue.toFixed(2)),
			total_cost: parseFloat(c.total_cost.toFixed(2)),
			total_profit: parseFloat(c.total_profit.toFixed(2))
		}));

		// Summary across all customers (not just paginated)
		const totalAllRevenue = customers.reduce((sum, c) => sum + c.total_revenue, 0);
		const totalAllCost = customers.reduce((sum, c) => sum + c.total_cost, 0);
		const totalAllProfit = customers.reduce((sum, c) => sum + c.total_profit, 0);

		return {
			success: true,
			totalRecords: customers.length,
			returnedRecords: paginatedCustomers.length,
			customers: paginatedCustomers,
			summary: {
				total_revenue: totalAllRevenue.toFixed(2),
				total_cost: totalAllCost.toFixed(2),
				total_profit: totalAllProfit.toFixed(2),
				profit_margin: totalAllRevenue > 0 ? ((totalAllProfit / totalAllRevenue) * 100).toFixed(2) : 0
			},
			pagination: {
				limit: validLimit,
				offset: validOffset,
				total: customers.length,
				hasMore: validOffset + validLimit < customers.length
			},
			sortBy: sort_by,
			sortOrder: sort_order,
			dateRange: { start: queryStartDate, end: queryEndDate }
		};
	} catch (error) {
		return errorResponse(`Failed to list customers by profitability: ${error.message}`);
	}
}

/**
 * Main entry point - Get customer profitability
 * @param {Object} data - Request data
 * @param {string} data.action - Action to perform: 'get_customer' or 'list_customers'. Defaults to 'list_customers'.
 * @param {string} data.customer_id - Customer ID (required for 'get_customer').
 * @param {string} data.provider_id - Optional: Filter by specific provider ID (list_customers only).
 * @param {string} data.start_date - Start date (optional). Defaults to 30 days ago.
 * @param {string} data.end_date - End date (optional). Defaults to now.
 * @param {string} data.group_by - Group results by time period: 'day', 'week', 'month' (optional, get_customer only)
 * @param {string} data.sort_by - Sort metric: 'total_profit', 'profit_margin', 'total_revenue', 'total_cost' (optional, list_customers only)
 * @param {string} data.sort_order - Sort order: 'desc' or 'asc' (optional)
 * @param {number} data.limit - Limit for listing (optional, 1-100). Defaults to 10.
 * @param {number} data.offset - Offset for pagination (optional). Defaults to 0.
 * @param {number} data.min_profit - Minimum profit filter (optional)
 * @param {string} data.currency - Currency for results (optional)
 * @returns {Object} Response based on requested action
 * 
 * @example
 * // Get a specific customer's profitability with a provider filter
 * main({
 *   action: 'get_customer',
 *   customer_id: 49051,
 *   provider_id: 5,
 *   start_date: '2026-01-01',
 *   end_date: '2026-02-05'
 * })
 * 
 * @example
 * // List all customers ranked by profit margin, filtered by provider
 * main({
 *   action: 'list_customers',
 *   provider_id: 5,
 *   sort_by: 'profit_margin',
 *   sort_order: 'desc',
 *   limit: 20
 * })
 */
export async function main(data) {
	const {
		action = 'list_customers',
		customer_id ,
		provider_id,
		start_date,
		end_date,
		group_by,
		sort_by,
		sort_order,
		limit,
		offset,
		min_profit,
		currency
	} = data || {};

	try {
		if (action === 'get_customer') {
			if (!customer_id) {
				return errorResponse('customer_id is required for get_customer action');
			}
			return await getCustomerProfitability({
				customer_id,
				start_date,
				end_date,
				group_by
			});
		} else if (action === 'list_customers') {
			return await listCustomersByProfitability({
				provider_id,
				start_date,
				end_date,
				sort_by,
				sort_order,
				limit,
				offset,
				min_profit,
				currency
			});
		} else {
			return errorResponse(`Invalid action '${action}'. Must be 'get_customer' or 'list_customers'`);
		}
	} catch (error) {
		return errorResponse(`Profitability analysis failed: ${error.message}`);
	}
}
