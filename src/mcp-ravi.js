import { McpServer } from 'cxMcpServer';
import {searchCustomers, getCustomerBalance, getLastTopup} from './searchCustomer';
import { listRTPServersMain } from './listRtpServers';
import { main as getCustomerPackagesMain } from './package';
import { main as getCustomerRateCardsMain } from './rateCard';
import { getCustomerProfitability, listCustomersByProfitability } from './listCustomersByProfitability';

const mcp = new McpServer('Example MCP Server', '1.0.0', true);

function getWeather(args) {
	const { city, units = 'celsius' } = args;
	// Simulated weather data - replace with actual API call
	const temperature = units === 'celsius' ? 22 : 72;
	const unitSymbol = units === 'celsius' ? '°C' : '°F';

	return {
		city,
		temperature: `${temperature}${unitSymbol}`,
		condition: 'Partly cloudy',
		humidity: '65%',
	};
}


mcp.addTool('get_weather', 'Get the current weather for a specified city', getWeather)
	.addParameter('city', 'string', 'The city name to get weather for', true)
	.addParameter('units', 'string', 'Temperature units (celsius or fahrenheit)', false, 'celsius', { enum: ['celsius', 'fahrenheit'] });

mcp.addTool('list_rtp_servers', 'Retrieves a list of available RTP (Real-time Transport Protocol) servers that are operational and ready to handle voice/video traffic. Can be filtered by geozone, zone, server ID, or alias.', listRTPServersMain)
	.addParameter('geozone', 'string', 'Optional: Filter by geozone (alias for zone). Examples: "North America", "Europe", "Frankfurt 2 (High Capacity)"', false)
	.addParameter('zone', 'string', 'Optional: Filter by zone (e.g., "Frankfurt 2 (High Capacity)")', false)
	.addParameter('server_id', 'number', 'Optional: Filter by specific server ID', false)
	.addParameter('alias', 'string', 'Optional: Filter by server alias/name (server hostname)', false);

mcp.addTool('search_customers', 'Search for customers using ID, name, SIP username, or IP address. Supports partial matching on name and SIP users; exact matching on ID and IP. Returns matching customers with their IDs for use in other operations.', searchCustomers)
	.addParameter('query', 'string', 'Search term: customer ID (exact), customer name (partial), SIP username (partial), or IP address (exact)', true)
	.addParameter('search_type', 'string', 'Type of search to perform. "auto" attempts to determine the best match type automatically.', false, 'auto', { enum: ['auto', 'id', 'name', 'sip_user', 'ips'] })
	.addParameter('limit', 'number', 'Maximum number of results to return', false, 10);

mcp.addTool('get_customer_balance', 'Get customer\'s current balance including credit amount and debit limit. Call capability is determined by whether available balance (credit + debit_limit) is positive.', getCustomerBalance)
	.addParameter('customer_id', 'string', 'The unique customer ID (obtained from search_customers)', true);

mcp.addTool('get_last_topup', 'Retrieves the most recent top-up payment for a customer, including the date, amount, payment method, and invoice details.', getLastTopup)
	.addParameter('customer_id', 'string', 'The unique customer ID to retrieve the last top-up for.', true);

mcp.addTool('getCustomerPackages', 'Get all packages assigned to a customer including recurring charges, one-time fees, and free minute bundles. Supports filtering by package type.', getCustomerPackagesMain)
	.addParameter('customerId', 'string', 'The unique customer ID (maps to company_id in the package endpoint)', true)
	.addParameter('type', 'string', 'Filter packages by type: "all" returns all packages, "recurring" for packages with billing frequency (month/day/etc), "one-time" for packages without frequency, "free-minutes" for minute bundles', false, 'all', { enum: ['all', 'recurring', 'one-time', 'free-minutes'] });

mcp.addTool('getCustomerRateCards', 'Get all rate cards assigned to a customer.', getCustomerRateCardsMain)
	.addParameter('customerId', 'string', 'The unique customer ID (maps to customer_id in the routing endpoint)', true);

mcp.addTool('getCustomerProfitability', 'Analyze a specific customer\'s profitability with detailed metrics including revenue, costs, profit margins, and cost comparison.', getCustomerProfitability)
	.addParameter('customer_id', 'string', 'The unique customer ID (required)', true)
	.addParameter('provider_id', 'string', 'Optional: Filter by specific provider ID', false)
	.addParameter('start_date', 'string', 'Start date (ISO format). Defaults to 30 days ago', false)
	.addParameter('end_date', 'string', 'End date (ISO format). Defaults to now', false)
	.addParameter('group_by', 'string', 'Group results by time period: "day", "week", or "month"', false, undefined, { enum: ['day', 'week', 'month'] });

mcp.addTool('listCustomersByProfitability', 'List all customers ranked by profitability metrics to identify top revenue generators, most profitable accounts, or customers with best margins.', listCustomersByProfitability)
	.addParameter('provider_id', 'string', 'Optional: Filter by specific provider ID', false)
	.addParameter('start_date', 'string', 'Start date (ISO format). Defaults to 30 days ago', false)
	.addParameter('end_date', 'string', 'End date (ISO format). Defaults to now', false)
	.addParameter('sort_by', 'string', 'Sort metric: "total_profit", "profit_margin", "total_revenue", "total_cost"', false, 'total_profit', { enum: ['total_profit', 'profit_margin', 'total_revenue', 'total_cost'] })
	.addParameter('sort_order', 'string', 'Sort order: "desc" or "asc"', false, 'desc', { enum: ['desc', 'asc'] })
	.addParameter('limit', 'number', 'Max results to return (1-100). Defaults to 10', false, 10)
	.addParameter('offset', 'number', 'Records to skip for pagination. Defaults to 0', false, 0)
	.addParameter('min_profit', 'number', 'Filter: only customers with profit above this value', false)
	.addParameter('currency', 'string', 'Currency for results', false);

export function main(data) {
	return mcp.handle(data);
}
