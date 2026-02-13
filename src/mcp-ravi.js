import { McpServer } from 'cxMcpServer';
import {searchCustomers, getCustomerBalance, getLastTopup} from './searchCustomer';
import { listRTPServersMain } from './list_rtp_servers';

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


export function main(data) {
	return mcp.handle(data);
}
