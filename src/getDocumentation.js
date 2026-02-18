import auth from 'cxRest'

const getDocumentationTool = {
	name: "getDocumentation",
	description: "Retrieve the full content of a documentation article using its path.",
	inputSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Documentation article path (e.g., 'customer/did')"
			}
		},
		required: ["path"]
	}
}

export function formatPath (path) {
	if (!path) return ""
	return path.trim().replace(/^\//, '')
}

export function extractMetadata (body) {
	const metadata = {
		category: null,
		audience: null,
		difficulty: null,
		timeRequired: null,
		prerequisites: null,
		nextSteps: null
	}

	if (!body || typeof body !== "string") return metadata

	const categoryMatch = body.match(/Category(?:<\/strong>)?:\s*([^\n<]+)/)
	if (categoryMatch) metadata.category = categoryMatch[1].trim()

	const audienceMatch = body.match(/Audience(?:<\/strong>)?:\s*([^\n<]+)/)
	if (audienceMatch) metadata.audience = audienceMatch[1].trim()

	const difficultyMatch = body.match(/Difficulty(?:<\/strong>)?:\s*([^\n<]+)/)
	if (difficultyMatch) metadata.difficulty = difficultyMatch[1].trim()

	const timeMatch = body.match(/Time Required(?:<\/strong>)?:\s*([^\n<]+)/)
	if (timeMatch) metadata.timeRequired = timeMatch[1].trim()

	const preMatch = body.match(/Prerequisites(?:<\/strong>)?:\s*([^\n<]+)/)
	if (preMatch) metadata.prerequisites = preMatch[1].trim()

	return metadata
}

export function stripHtml (html) {
	if (!html || typeof html !== "string") return ""
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\n\s*\n/g, '\n')
		.trim()
}

/**
 * Get documentation using cxRest API without JSON parsing
 * The trick: Make the request and catch the JSON error to extract the raw content
 */
export async function getDocumentationRequest (apiInstance, path) {
	try {
		if (!path || path.trim() === "") {
			return {
				success: false,
				error: "Path required",
				content: null
			}
		}

		const formattedPath = formatPath(path)
		const attempts = []
		let bodyContent = null

		// Strategy 1: Try to use api.get() and catch the JSON error
		// The error message contains the actual content!
		try {
			attempts.push(`Attempting: docs/${formattedPath}`)
			const response = await apiInstance.get(`docs/${formattedPath}`)

			// If we get here without error, extract content
			if (typeof response === 'string' && response.trim() !== "") {
				bodyContent = response
				attempts.push(`? Got content directly as string`)
			} else if (response && typeof response === 'object') {
				// Check for content in various properties
				const keys = ['data', 'body', 'content', 'text', 'html']
				for (const key of keys) {
					if (response[key] && typeof response[key] === 'string' && response[key].trim() !== "") {
						bodyContent = response[key]
						attempts.push(`? Got content from response.${key}`)
						break
					}
				}
			}
		} catch (apiError) {
			// The error message contains the actual content!
			// Error format: "Unexpected token '#', \"# Direct I\"... is not valid JSON"
			const errorMsg = apiError.message || ""
			attempts.push(`API error (expected): ${errorMsg.substring(0, 100)}`)

			// Try to extract the content from the error message
			// The format shows the start of the content in quotes
			// But we need the full content, not just the error preview

			// Instead, let's make a raw fetch request with proper headers
			try {
				const endpoint = `docs/${formattedPath}`
				const authHeader = apiInstance.defaultHeaders?.Authorization || ''

				attempts.push(`Making raw fetch to: ${endpoint}`)

				// Build the full URL based on the API base
				const fullUrl = `https://app.connexcs.com/api/cp/${endpoint}`

				const fetchResponse = await fetch(fullUrl, {
					method: 'GET',
					headers: {
						'Accept': 'text/plain, text/html, text/markdown, */*',
						'User-Agent': 'ConnexCS-Doc-Tool/1.0',
						...(authHeader ? { 'Authorization': authHeader } : {})
					}
				})

				if (!fetchResponse.ok) {
					attempts.push(`Fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`)
				} else {
					bodyContent = await fetchResponse.text()
					attempts.push(`? Got content via fetch (${bodyContent.length} chars)`)
				}
			} catch (fetchError) {
				attempts.push(`Fetch error: ${fetchError.message}`)
			}
		}

		// Strategy 2: If still no content, try markdown
		if (!bodyContent) {
			try {
				attempts.push(`Attempting markdown: docs/${formattedPath}.md`)
				const mdResponse = await apiInstance.get(`docs/${formattedPath}.md`)

				if (typeof mdResponse === 'string') {
					bodyContent = mdResponse
					attempts.push(`? Got markdown content`)
				}
			} catch (mdError) {
				attempts.push(`Markdown failed: ${mdError.message.substring(0, 80)}`)
			}
		}

		if (!bodyContent || bodyContent.trim() === "") {
			return {
				success: false,
				error: "Documentation not found or empty",
				path: path,
				attempts: attempts,
				content: null
			}
		}

		const metadata = extractMetadata(bodyContent)
		let cleanContent = bodyContent
			.replace(/<details>[\s\S]*?<\/details>/g, '')
			.replace(/<summary>[\s\S]*?<\/summary>/g, '')
		cleanContent = stripHtml(cleanContent)

		if (cleanContent.length > 3000) {
			cleanContent = cleanContent.substring(0, 3000) + "\n\n[Content truncated...]"
		}

		return {
			success: true,
			path: formattedPath,
			title: metadata.category || "Documentation",
			category: metadata.category,
			audience: metadata.audience,
			difficulty: metadata.difficulty,
			timeRequired: metadata.timeRequired,
			prerequisites: metadata.prerequisites,
			content: cleanContent,
			fullContent: bodyContent,
			metadata: metadata,
			attempts: attempts
		}
	} catch (error) {
		return {
			success: false,
			error: error.message,
			path: path,
			content: null
		}
	}
}

export async function getDocumentation (params) {
	try {
		const { path } = params

		if (!path) {
			return {
				status: "error",
				message: "Path required",
				data: {
					success: false,
					error: "Path required",
					content: null
				}
			}
		}

		// Authenticate
		const api =new auth(process.env.API_USERNAME)

		// Get documentation
		const result = await getDocumentationRequest(api, path)

		return {
			status: result.success ? "success" : "error",
			data: result
		}
	} catch (error) {
		return {
			status: "error",
			message: error.message,
			data: {
				success: false,
				error: error.message,
				path: params?.path || null,
				content: null
			}
		}
	}
}

export async function main () {
	const api = new auth(process.env.API_USERNAME)
	return await api.get('docs/customer/did')

}
