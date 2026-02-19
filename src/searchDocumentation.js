import auth from 'cxRest'

/**
 * ConnexCS Documentation Search Tool
 * Searches system documentation via the ConnexCS API
 */

// Tool definition matching the required schema
const searchDocumentationTool = {
	name: "searchDocumentation",
	description: "Search the system documentation, help articles, API docs, and knowledge base. Returns matching articles with links to get full details.",
	inputSchema: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "Search query (e.g., 'how to add rate card', 'API authentication', 'DID management')"
			},
			limit: {
				type: "number",
				default: 10,
				description: "Maximum number of results to return"
			}
		},
		required: ["query"]
	}
}

/**
 * URL encode a string
 * @param {string} str - String to encode
 * @returns {string} URL encoded string
 */
export function urlencode (str) {
	return encodeURIComponent(str)
}

/**
 * Extract title from HTML or markdown body content
 * @param {string} body - HTML or markdown body content
 * @returns {string} Extracted title
 */
export function extractTitleFromBody (body) {
	if (!body) return ""

	// Try to extract markdown H1 heading (e.g. "# Title")
	const mdH1Match = body.match(/^#\s+(.+)$/m)
	if (mdH1Match) return mdH1Match[1].trim()

	// Try to extract HTML <h1> title
	const h1Match = body.match(/<h1>([^<]+)<\/h1>/)
	if (h1Match) return h1Match[1]

	// Try to extract category from metadata
	const categoryMatch = body.match(/<strong>Category<\/strong>:\s*([^<]+)/)
	if (categoryMatch) return categoryMatch[1].trim()

	return ""
}

/**
 * Search documentation using ConnexCS API
 * @param {object} api - Authenticated API instance
 * @param {string} query - Search query
 * @param {number} limit - Maximum results (optional)
 * @returns {Promise<object>} Search results with articles
 */
export async function searchDocumentationRequest (api, query, limit = 10) {
	try {
		if (!query || query.trim() === "") {
			return {
				success: false,
				error: "Search query cannot be empty",
				results: []
			}
		}

		// Build API endpoint with encoded query
		const endpoint = `docs?s=${urlencode(query)}`

		// Make API request
		const response = await api.get(endpoint)

		// Handle API response
		if (!response) {
			return {
				success: false,
				error: "No results found",
				query: query,
				results: []
			}
		}

		// API returns direct array: [{ public_url, link, body }, ...]
		// Handle both array response and object response for flexibility
		const results = Array.isArray(response) ? response : (response.results || [])
		const totalResults = results.length

		// Limit results to requested amount
		const limitedResults = results.slice(0, Math.min(limit, 10))

		return {
			success: true,
			query: query,
			totalResults: totalResults,
			displayedResults: limitedResults.length,
			results: limitedResults.map(doc => ({
				public_url: doc.public_url || "",
				link: doc.link || "", // Use this to fetch full documentation with getDocumentation
				title: doc.title || extractTitleFromBody(doc.body) || "",
				body: doc.body || "" // Raw HTML body - can be used for preview
			}))
		}
	} catch (error) {
		return {
			success: false,
			error: error.message || "Failed to search documentation",
			query: query,
			results: []
		}
	}
}

/**
 * Main handler - called by ConnexCS system
 * @param {object} params - Tool parameters
 * @returns {Promise<object>} Tool execution result
 */
export async function searchDocumentation (params) {
	try {
		const { query, limit } = params

		// Validate input
		if (!query) {
			return {
				status: "error",
				message: "Search query is required",
				data: {
					success: false,
					error: "Search query is required",
					results: []
				}
			}
		}

		// Authenticate with ConnexCS API
		const api = new auth(process.env.API_USERNAME)

		// Execute search
		const results = await searchDocumentationRequest(api, query, limit || 10)

		return {
			status: results.success ? "success" : "error",
			data: results
		}
	} catch (error) {
		return {
			status: "error",
			message: error.message,
			data: {
				success: false,
				error: error.message,
				results: []
			}
		}
	}
}
