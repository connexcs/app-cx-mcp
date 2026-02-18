import { McpServer } from 'cxMcpServer'

const mcp = new McpServer('Example MCP Server testing adam', '1.0.0', true)

import { getCustomerCallStatistics } from './connexcsCustomerStats'
import { getCustomerDestinationStatistics } from './connexcsDestinationStats'
import { getDocumentation } from './getDocumentation'
import { searchDocumentation } from './searchDocumentation'

mcp.addTool('get_customer_call_statistics', 'Get comprehensive call statistics for a customer including attempts, connected calls, duration, charges, ACD, ASR, profitability, and destination breakdowns.', getCustomerCallStatistics)
    .addParameter('company_id', 'string', 'The unique company/customer ID', true)
    .addParameter('start_date', 'string', 'Start date for statistics (ISO 8601 or Unix timestamp). Optional.', false)
    .addParameter('end_date', 'string', 'End date for statistics (ISO 8601 or Unix timestamp). Optional.', false)

mcp.addTool('get_customer_destination_statistics', 'Get breakdown of calls by destination, showing customer and provider card/route usage for analyzing call routing patterns and destination distribution.', getCustomerDestinationStatistics)
    .addParameter('customer_id', 'string', 'The unique customer ID or leave empty for all customers', true)
    .addParameter('start_date', 'string', 'Start date for statistics in YYYY-MM-DD format. Optional - defaults to last 30 days.', false)
    .addParameter('end_date', 'string', 'End date for statistics in YYYY-MM-DD format. Optional - defaults to today.', false)
    .addParameter('limit', 'number', 'Number of top destinations to return (1-100)', false, 20)

mcp.addTool('getDocumentation', 'Retrieve the full content of a documentation article using its path.', getDocumentation)
    .addParameter('path', 'string', 'Documentation article path (e.g., "customer/did")', true)

mcp.addTool('searchDocumentation', 'Search the system documentation, help articles, API docs, and knowledge base. Returns matching articles with links to get full details.', searchDocumentation)
    .addParameter('query', 'string', 'Search query (e.g., "how to add rate card")', true)
    .addParameter('limit', 'number', 'Maximum number of results to return (1-100). Default: 10', false, 10)

export function main (data) {
	return mcp.handle(data)
}
