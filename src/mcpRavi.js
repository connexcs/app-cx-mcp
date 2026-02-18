import { McpServer } from 'cxMcpServer'
import {searchCustomers, getCustomerBalance, getLastTopup} from './searchCustomer'
import { listRTPServersMain } from './listRtpServers'
import { getCustomerPackages } from './package'
import { getCustomerRateCards, getRateCardDetails, getRateCardRules } from './rateCard'
import { getCustomerProfitability, listCustomersByProfitability } from './listCustomersByProfitability'

const mcp = new McpServer('Example MCP Server', '1.0.0', true)

mcp.addTool('listRtpServers', 'Retrieves a list of available RTP (Real-time Transport Protocol) servers that are operational and ready to handle voice/video traffic. Can be filtered by geozone, zone, server ID, or alias.', listRTPServersMain)
	.addParameter('geozone', 'string', 'Optional: Filter by geozone (alias for zone). Examples: "North America", "Europe", "Frankfurt 2 (High Capacity)"', false)
	.addParameter('zone', 'string', 'Optional: Filter by zone (e.g., "Frankfurt 2 (High Capacity)")', false)
	.addParameter('server_id', 'number', 'Optional: Filter by specific server ID', false)
	.addParameter('alias', 'string', 'Optional: Filter by server alias/name (server hostname)', false)

mcp.addTool('searchCustomers', 'Search for customers using ID, name, SIP username, or IP address. Supports partial matching on name and SIP users; exact matching on ID and IP. Returns matching customers with their IDs for use in other operations.', searchCustomers)
	.addParameter('query', 'string', 'Search term: customer ID (exact), customer name (partial), SIP username (partial), or IP address (exact)', true)
	.addParameter('search_type', 'string', 'Type of search to perform. "auto" attempts to determine the best match type automatically.', false, 'auto', { enum: ['auto', 'id', 'name', 'sip_user', 'ips'] })
	.addParameter('limit', 'number', 'Maximum number of results to return', false, 10)

mcp.addTool('getCustomerBalance', 'Get customer\'s current balance including credit amount and debit limit. Call capability is determined by whether available balance (credit + debit_limit) is positive.', getCustomerBalance)
	.addParameter('customer_id', 'string', 'The unique customer ID (obtained from search_customers)', true)

mcp.addTool('getLastTopup', 'Retrieves the most recent top-up payment for a customer, including the date, amount, payment method, and invoice details.', getLastTopup)
	.addParameter('customer_id', 'string', 'The unique customer ID to retrieve the last top-up for.', true)

mcp.addTool('getCustomerPackages', 'Get all packages assigned to a customer including recurring charges, one-time fees, and free minute bundles. Supports filtering by package type.', getCustomerPackages)
	.addParameter('customerId', 'string', 'The unique customer ID (maps to company_id in the package endpoint)', true)
	.addParameter('type', 'string', 'Filter packages by type: "all" returns all packages, "recurring" for packages with billing frequency (month/day/etc), "one-time" for packages without frequency, "free-minutes" for minute bundles', false, 'all', { enum: ['all', 'recurring', 'one-time', 'free-minutes'] })

mcp.addTool('getCustomerRateCards', 'Get all rate cards assigned to a customer.', getCustomerRateCards)
	.addParameter('customerId', 'string', 'The unique customer ID (maps to customer_id in the routing endpoint)', true)

mcp.addTool('getRateCardDetails', 'Get complete details of a specific rate card.', getRateCardDetails)
	.addParameter('rateCardId', 'string', 'The rate card ID (e.g., "OF7H-xk1B")', true)

mcp.addTool('getRateCardRules', 'Get pricing rules and prefix information for a rate card revision. Requires include_prefixes to be true to fetch data.', getRateCardRules)
	.addParameter('rateCardId', 'string', 'The rate card ID (e.g., "fbIL-EJoJ")', true)
	.addParameter('activeRev', 'string', 'The active revision number (e.g., "19" or 19)', true)
	.addParameter('include_prefixes', 'boolean', 'Whether to include prefix rules. If false, no data is fetched (default: true)', false, true)
	.addParameter('prefix_limit', 'number', 'Maximum number of prefixes/rules to return. Default: 1000, Max: 10000', false, 1000)
	.addParameter('offset', 'number', 'Pagination offset for rules (default: 0)', false, 0)

mcp.addTool('getCustomerProfitability', 'Analyze customer profitability including revenue, costs, profit margins, and cost comparison across different currencies.', getCustomerProfitability)
	.addParameter('customer_id', 'string', 'The unique customer ID', true)
	.addParameter('start_date', 'string', 'Start date for analysis. Optional - defaults to last 30 days.', false)
	.addParameter('end_date', 'string', 'End date for analysis. Optional - defaults to now.', false)
	.addParameter('group_by', 'string', 'Group profitability data by time period. Optional.', false, null, { enum: ['day', 'week', 'month'] })

mcp.addTool('listCustomersByProfitability', 'Returns a ranked list of customers by profitability metrics. Useful for identifying top revenue generators, most profitable accounts, or customers with best margins.', listCustomersByProfitability)
	.addParameter('start_date', 'string', 'Start date for profitability calculation. Optional - defaults to last 30 days.', false)
	.addParameter('end_date', 'string', 'End date for profitability calculation. Optional - defaults to now.', false)
	.addParameter('sort_by', 'string', 'Metric to rank customers by. Defaults to total_profit.', false, 'total_profit', { enum: ['total_profit', 'profit_margin', 'total_revenue', 'total_cost'] })
	.addParameter('sort_order', 'string', 'Sort order. Defaults to descending (highest first).', false, 'desc', { enum: ['desc', 'asc'] })
	.addParameter('limit', 'number', 'Maximum number of customers to return. Defaults to 10.', false, 10)
	.addParameter('offset', 'number', 'Number of records to skip for pagination. Defaults to 0.', false, 0)
	.addParameter('min_profit', 'number', 'Optional filter: only include customers with profit above this threshold.', false)


export function main (data) {
	return mcp.handle(data)
}
