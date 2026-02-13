import cxRest from 'cxRest';

/**
 * Get authenticated API instance
 * @returns {Object} Authenticated cxRest instance
 */
function getAuthenticatedApi() {
	if (!process.env.cx_api_user) {
		throw new Error('API user not configured. Set cx_api_user in environment variables.');
	}
	return cxRest.auth(process.env.cx_api_user);
}

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
 * Get standard row group columns for breakout analysis
 * @param {boolean} includeTime - Whether to include time grouping
 * @param {string} timeGrouping - Time grouping type: 'day', 'week', 'month'
 * @returns {Array} Row group column definitions
 */
function getStandardRowGroupCols(includeTime = false, timeGrouping = null) {
	const cols = [
		{ id: 'customer_id', displayName: 'Customer', field: 'customer_id' },
		{ id: 'provider_id', displayName: 'Provider', field: 'provider_id' },
		{ id: 'customer_card_dest_name', displayName: 'Customer Destination Name', field: 'customer_card_dest_name' },
		{ id: 'provider_card_dest_name', displayName: 'Provider Destination Name', field: 'provider_card_dest_name' }
	];
	
	if (includeTime && timeGrouping) {
		// Add time grouping - this would need to be adjusted based on API support
		cols.push({ id: 'dt', displayName: 'Date', field: 'dt' });
	}
	
	return cols;
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
 * Calculate profitability metrics from breakout data
 * @param {Array} records - Array of breakout records
 * @returns {Array} Array of records with profitability metrics (grouped by customer + provider + destination)
 */
function calculateProfitabilityMetrics(records) {
	if (!records || records.length === 0) {
		return [];
	}

	// Return records with calculated metrics, maintaining provider-level breakdown
	return records.map(record => {
		// AG-Grid API returns aggregated values directly without 'sum_' prefix
		const attempts = parseInt(record.attempts) || 0;
		const connected = parseInt(record.connected) || 0;
		const customerCharge = parseFloat(record.customer_charge) || 0;
		const providerCharge = parseFloat(record.provider_charge) || 0;
		const accountProfit = parseFloat(record.account_profit) || 0;
		const customerDuration = parseInt(record.customer_duration) || 0;
		const asr = parseFloat(record.asr) || 0;
		const acd = parseFloat(record.acd) || 0;

		// Derived metrics
		const conversionRate = attempts > 0 ? ((connected / attempts) * 100).toFixed(2) : 0;
		const costToRevenueRatio = customerCharge > 0 ? (providerCharge / customerCharge).toFixed(4) : 0;
		const profitPercentOfCost = providerCharge > 0 ? ((accountProfit / providerCharge) * 100).toFixed(2) : 0;
		const avgDurationSeconds = connected > 0 ? (customerDuration / connected).toFixed(2) : 0;
		const avgDurationMinutes = (avgDurationSeconds / 60).toFixed(2);

		return {
			...record,
			// Core metrics
			total_attempts: attempts,
			total_connected: connected,
			total_revenue: customerCharge,
			total_cost: providerCharge,
			total_profit: accountProfit,
			total_duration_seconds: customerDuration,
			
			// Profitability metrics
			profit_margin: customerCharge > 0 
				? ((accountProfit / customerCharge) * 100).toFixed(2)
				: 0,
			revenue_per_call: attempts > 0
				? (customerCharge / attempts).toFixed(4)
				: 0,
			cost_per_call: attempts > 0
				? (providerCharge / attempts).toFixed(4)
				: 0,
			margin_per_call: attempts > 0
				? (accountProfit / attempts).toFixed(4)
				: 0,
			
			// Efficiency metrics
			conversion_rate: conversionRate,
			cost_to_revenue_ratio: costToRevenueRatio,
			profit_percent_of_cost: profitPercentOfCost,
			revenue_per_duration_second: customerDuration > 0 ? (customerCharge / customerDuration).toFixed(6) : 0,
			
			// Duration metrics
			avg_duration_seconds: avgDurationSeconds,
			avg_duration_minutes: avgDurationMinutes,
			
			// Quality metrics
			asr: asr.toFixed(2),
			acd: acd.toFixed(2),
			call_completion_ratio: attempts > 0 ? ((connected / attempts) * 100).toFixed(2) : 0
		};
	});
}

/**
 * Get customer profitability details
 * Analyze customer profitability including revenue, costs, profit margins, and cost comparison.
 * 
 * @param {Object} filters - Filter options
 * @param {string} filters.customer_id - The unique customer ID (required)
 * @param {string} filters.provider_id - Optional: Filter by specific provider ID
 * @param {string} filters.start_date - Start date (ISO format). Defaults to 30 days ago.
 * @param {string} filters.end_date - End date (ISO format). Defaults to now.
 * @param {string} filters.group_by - Group by time period: 'day', 'week', 'month'
 * @returns {Object} Response with profitability data and metrics
 */
export async function getCustomerProfitability(filters = {}) {
	try {
		const api = getAuthenticatedApi();
		const { customer_id, provider_id, start_date, end_date, group_by } = filters;

		if (!customer_id) {
			return errorResponse('customer_id is required');
		}

		// Set default date range if not provided
		const dateRange = getDefaultDateRange();
		const queryStartDate = start_date ? formatDateForQuery(start_date, false) : dateRange.startDate;
		const queryEndDate = end_date ? formatDateForQuery(end_date, true) : dateRange.endDate;

		// Build row group columns
		const includeTime = !!group_by;
		const rowGroupCols = getStandardRowGroupCols(includeTime, group_by);

		// Build value columns
		const valueCols = getStandardValueCols();

		// Build URL parameters for ag-grid API
		const params = buildBreakoutAggridParams({
			rowGroupCols,
			valueCols,
			startDate: queryStartDate,
			endDate: queryEndDate,
			customerId: customer_id,
			providerId: provider_id,
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
				metrics: {
					total_revenue: 0,
					total_cost: 0,
					total_profit: 0,
					profit_margin: 0
				},
				message: `No profitability data found for customer ${customer_id} in the specified period`,
				dateRange: { start: queryStartDate, end: queryEndDate },
				groupBy: group_by || 'none'
			};
		}

		// Calculate metrics with detailed breakdown
		const enrichedData = calculateProfitabilityMetrics(breakoutData);
		const totalRevenue = enrichedData.reduce((sum, r) => sum + (parseFloat(r.total_revenue) || 0), 0);
		const totalCost = enrichedData.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);
		const totalProfit = enrichedData.reduce((sum, r) => sum + (parseFloat(r.total_profit) || 0), 0);
		const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

		// Calculate additional aggregate metrics
		const totalAttempts = enrichedData.reduce((sum, r) => sum + (r.total_attempts || 0), 0);
		const totalConnected = enrichedData.reduce((sum, r) => sum + (r.total_connected || 0), 0);
		const totalDuration = enrichedData.reduce((sum, r) => sum + (r.total_duration_seconds || 0), 0);
		const avgConversionRate = enrichedData.length > 0 
			? (enrichedData.reduce((sum, r) => sum + parseFloat(r.conversion_rate || 0), 0) / enrichedData.length).toFixed(2)
			: 0;
		const avgCostToRevenueRatio = enrichedData.length > 0 
			? (enrichedData.reduce((sum, r) => sum + parseFloat(r.cost_to_revenue_ratio || 0), 0) / enrichedData.length).toFixed(4)
			: 0;

		return {
			success: true,
			customer_id,
			provider_id: provider_id || 'all',
			totalRecords: enrichedData.length,
			data: enrichedData,
			metrics: {
				// Financial
				total_revenue: totalRevenue.toFixed(2),
				total_cost: totalCost.toFixed(2),
				total_profit: totalProfit.toFixed(2),
				profit_margin: profitMargin,
				
				// Call metrics
				total_attempts: totalAttempts,
				total_connected: totalConnected,
				total_duration_seconds: totalDuration,
				total_duration_minutes: (totalDuration / 60).toFixed(2),
				
				// Quality metrics
				avg_asr: (enrichedData.reduce((sum, r) => sum + (parseFloat(r.asr) || 0), 0) / enrichedData.length).toFixed(2),
				avg_acd: (enrichedData.reduce((sum, r) => sum + (parseFloat(r.acd) || 0), 0) / enrichedData.length).toFixed(2),
				avg_conversion_rate: avgConversionRate,
				avg_cost_to_revenue_ratio: avgCostToRevenueRatio,
				
				// Per-call metrics
				avg_revenue_per_call: totalAttempts > 0 ? (totalRevenue / totalAttempts).toFixed(4) : 0,
				avg_cost_per_call: totalAttempts > 0 ? (totalCost / totalAttempts).toFixed(4) : 0,
				avg_profit_per_call: totalAttempts > 0 ? (totalProfit / totalAttempts).toFixed(4) : 0
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
 * @param {Object} filters - Filter options
 * @param {string} filters.provider_id - Optional: Filter by specific provider ID
 * @param {string} filters.start_date - Start date (ISO format). Defaults to 30 days ago.
 * @param {string} filters.end_date - End date (ISO format). Defaults to now.
 * @param {string} filters.sort_by - Sort metric: 'total_profit', 'profit_margin', 'total_revenue', 'total_cost'. Defaults to 'total_profit'.
 * @param {string} filters.sort_order - Sort order: 'desc' or 'asc'. Defaults to 'desc'.
 * @param {number} filters.limit - Max results to return (1-100). Defaults to 10.
 * @param {number} filters.offset - Records to skip for pagination. Defaults to 0.
 * @param {number} filters.min_profit - Filter: only customers with profit above this value.
 * @param {string} filters.currency - Currency for results.
 * @returns {Object} Response with ranked customer list and summary
 */
export async function listCustomersByProfitability(filters = {}) {
	try {
		const api = getAuthenticatedApi();
		const {
			provider_id,
			start_date,
			end_date,
			sort_by = 'total_profit',
			sort_order = 'desc',
			limit = 10,
			offset = 0,
			min_profit,
			currency
		} = filters;

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

		// Build row group columns
		const rowGroupCols = getStandardRowGroupCols(false, null);

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
				summary: {
					total_all_revenue: 0,
					total_all_cost: 0,
					total_all_profit: 0,
					average_profit_margin: 0,
					top_currency: 'N/A'
				},
				pagination: { limit: validLimit, offset: validOffset, total: 0 },
				sortBy: sort_by,
				sortOrder: sort_order,
				message: 'No customer profitability data found in the specified period',
				dateRange: { start: queryStartDate, end: queryEndDate }
			};
		}

		// Calculate profitability metrics for each record (customer + provider + destination combination)
		const enrichedRecords = calculateProfitabilityMetrics(breakoutData);

		// Aggregate by customer for ranking
		const customerMap = {};
		enrichedRecords.forEach(record => {
			const customerId = record.customer_id;
			if (!customerMap[customerId]) {
				customerMap[customerId] = {
					customer_id: customerId,
					customer_name: record.customer_card_dest_name || 'Unknown',
					total_revenue: 0,
					total_cost: 0,
					total_profit: 0,
					total_attempts: 0,
					total_connected: 0,
					providers: new Set(),
					destinations: new Set(),
					record_count: 0,
					records: []
				};
			}
			const customer = customerMap[customerId];
			customer.total_revenue += parseFloat(record.total_revenue) || 0;
			customer.total_cost += parseFloat(record.total_cost) || 0;
			customer.total_profit += parseFloat(record.total_profit) || 0;
			customer.total_attempts += record.total_attempts || 0;
			customer.total_connected += record.total_connected || 0;
			customer.record_count += 1;
			if (record.provider_id) customer.providers.add(record.provider_id);
			if (record.customer_card_dest_name) customer.destinations.add(record.customer_card_dest_name);
			customer.records.push(record);
		});

		// Convert to array and calculate aggregate metrics
		let customers = Object.values(customerMap).map(customer => ({
			...customer,
			providers: Array.from(customer.providers),
			destinations: Array.from(customer.destinations),
			profit_margin: customer.total_revenue > 0 
				? ((customer.total_profit / customer.total_revenue) * 100).toFixed(2)
				: 0,
			revenue_per_call: customer.total_attempts > 0
				? (customer.total_revenue / customer.total_attempts).toFixed(4)
				: 0,
			cost_per_call: customer.total_attempts > 0
				? (customer.total_cost / customer.total_attempts).toFixed(4)
				: 0
		}));

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
		const paginatedCustomers = customers.slice(validOffset, validOffset + validLimit).map(c => {
			const { records, ...customerData } = c;
			return {
				...customerData,
				total_revenue: parseFloat(c.total_revenue).toFixed(2),
				total_cost: parseFloat(c.total_cost).toFixed(2),
				total_profit: parseFloat(c.total_profit).toFixed(2)
			};
		});

		// Calculate additional aggregate metrics
		const totalAllAttempts = customers.reduce((sum, c) => sum + (c.total_attempts || 0), 0);
		const totalAllConnected = customers.reduce((sum, c) => sum + (c.total_connected || 0), 0);
		const avgConversionRate = customers.length > 0
			? totalAllAttempts > 0 ? ((totalAllConnected / totalAllAttempts) * 100).toFixed(2) : 0
			: 0;

		// Calculate summary metrics
		const totalAllRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_revenue), 0);
		const totalAllCost = customers.reduce((sum, c) => sum + parseFloat(c.total_cost), 0);
		const totalAllProfit = customers.reduce((sum, c) => sum + parseFloat(c.total_profit), 0);
		const avgProfitMargin = customers.length > 0 
			? (customers.reduce((sum, c) => sum + parseFloat(c.profit_margin), 0) / customers.length).toFixed(2)
			: 0;

		return {
			success: true,
			totalRecords: customers.length,
			returnedRecords: paginatedCustomers.length,
			customers: paginatedCustomers,
			summary: {
				// Financial summary
				total_all_revenue: totalAllRevenue.toFixed(2),
				total_all_cost: totalAllCost.toFixed(2),
				total_all_profit: totalAllProfit.toFixed(2),
				average_profit_margin: avgProfitMargin,
				
				// Call metrics summary
				total_all_attempts: totalAllAttempts,
				total_all_connected: totalAllConnected,
				avg_conversion_rate: avgConversionRate,
				
				// Additional info
				top_currency: currency || 'mixed',
				total_breakout_records: enrichedRecords.length,
				filtered_by_provider: provider_id || 'none'
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
 * @param {string} data.customer_id - Customer ID (required for 'get_customer'). Using customer_id and provider_id together filters by both.
 * @param {string} data.provider_id - Optional: Filter by specific provider ID. Works with both actions.
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
				provider_id,
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
