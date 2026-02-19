import { getApi } from './callDebugTools'

/**
 * Error response helper
 * @param {string} error - Error message
 * @returns {Object} Error response object
 */
function errorResponse (error) {
	return { success: false, error }
}

/**
 * Normalize API response to array format
 * @param {any} data - Data from API
 * @returns {Array} Normalized array
 */
function normalizeToArray (data) {
	return Array.isArray(data) ? data : (data ? [data] : [])
}

/**
 * Get all rate cards assigned to a customer
 * Retrieves routing and rate card assignments for a customer.
 *
 * @param {Object} data - Request data
 * @param {string} data.customerId - The customer ID to get rate cards for
 * @returns {Object} Response with rate card details
 */
export async function getCustomerRateCards (data, meta) {
	try {
		const { customerId } = data || {}
		if (!customerId) {
			return errorResponse('customerId is required')
		}

		const trimmedCustomerId = typeof customerId === 'string' ? customerId.trim() : String(customerId)

		const api = getApi()
		
		const params = new URLSearchParams({
			's': '',
			'company_id': trimmedCustomerId
		})

		// Fetch customer rate cards from routing endpoint
		const rateCardsResponse = await api.get(`routing?${params.toString()}`)
		const rateCards = normalizeToArray(rateCardsResponse)

		if (!rateCards || rateCards.length === 0) {
			return {
				success: false,
				matchType: 'none',
				customerId: trimmedCustomerId,
				error: `No rate cards found for customer ${trimmedCustomerId}`,
				suggestion: 'Try searching with a different customer ID'
			}
		}

		// Pass rate card data as-is from API
		const enrichedRateCards = rateCards

		// Sort by ID (newest first)
		enrichedRateCards.sort((a, b) => {
			return b.id - a.id
		})

		return {
			success: true,
			matchType: 'exact',
			customerId: trimmedCustomerId,
			totalRateCards: enrichedRateCards.length,
			rateCards: enrichedRateCards,
			message: `Found ${enrichedRateCards.length} rate card(s) assigned to customer ${trimmedCustomerId}`
		}
	} catch (error) {
		return errorResponse(`Failed to get customer rate cards: ${error.message}`)
	}
}

/**
 * Get complete details of a specific rate card
 * Retrieves rate card information directly from the API.
 *
 * @param {Object} data - Request data
 * @param {string} data.rateCardId - The rate card ID (e.g., 'OF7H-xk1B')
 * @returns {Object} Response with rate card details
 */
export async function getRateCardDetails (data, meta) {
	try {
		const { rateCardId } = data || {}
		if (!rateCardId) {
			return errorResponse('rateCardId is required')
		}

		const trimmedRateCardId = typeof rateCardId === 'string' ? rateCardId.trim() : String(rateCardId)

		const api = getApi()

		// Fetch rate card details from card endpoint
		const rateCardData = await api.get(`card/${trimmedRateCardId}`)

		if (!rateCardData) {
			return {
				success: false,
				rateCardId: trimmedRateCardId,
				error: `Rate card not found: ${trimmedRateCardId}`
			}
		}

		// Normalize response - handle both array and object responses
		const normalizedCard = Array.isArray(rateCardData) ? rateCardData[0] : rateCardData

		return {
			success: true,
			rateCardId: trimmedRateCardId,
			data: normalizedCard
		}
	} catch (error) {
		return errorResponse(`Failed to get rate card details: ${error.message}`)
	}
}

/**
 * Get rate card rules/prefixes for a specific revision
 * Retrieves pricing rules and prefix information for a rate card revision.
 *
 * @param {Object} data - Request data
 * @param {string} data.rateCardId - The rate card ID (e.g., 'fbIL-EJoJ')
 * @param {string|number} data.activeRev - The active revision number (e.g., 19)
 * @param {boolean} data.include_prefixes - Whether to include prefix rules (default: true)
 * @param {number} data.prefix_limit - Maximum number of prefixes to return (default: 1000)
 * @param {number} data.offset - Pagination offset (default: 0)
 * @returns {Object} Response with rate card rules
 */
export async function getRateCardRules (data, meta) {
	try {
		const { rateCardId, activeRev, include_prefixes = true, prefix_limit = 1000, offset = 0 } = data || {}
		if (!rateCardId) {
			return errorResponse('rateCardId is required')
		}
		if (!activeRev && activeRev !== 0) {
			return errorResponse('activeRev is required')
		}

		if (!include_prefixes) {
			return {
				success: true,
				rateCardId,
				activeRev,
				message: 'include_prefixes is false, no rules fetched',
				data: []
			}
		}

		const trimmedRateCardId = typeof rateCardId === 'string' ? rateCardId.trim() : String(rateCardId)
		const trimmedRevision = String(activeRev).trim()
		const validLimit = Math.max(1, Math.min(parseInt(prefix_limit) || 1000, 10000))
		const validOffset = Math.max(0, parseInt(offset) || 0)

		const api = getApi()

		// Build API URL with parameters
		const params = new URLSearchParams({
			'limit': String(validLimit),
			'offset': String(validOffset)
		})

		// Fetch rate card rules from revision endpoint
		const rulesResponse = await api.get(`card/${trimmedRateCardId}/rev/${trimmedRevision}/rule?${params.toString()}`)
		const rules = normalizeToArray(rulesResponse)

		if (!rules || rules.length === 0) {
			return {
				success: true,
				rateCardId: trimmedRateCardId,
				activeRev: trimmedRevision,
				totalRules: 0,
				rules: [],
				pagination: {
					limit: validLimit,
					offset: validOffset,
					total: 0
				},
				message: `No rules found for rate card ${trimmedRateCardId} revision ${trimmedRevision}`
			}
		}

		return {
			success: true,
			rateCardId: trimmedRateCardId,
			activeRev: trimmedRevision,
			totalRules: rules.length,
			rules: rules,
			pagination: {
				limit: validLimit,
				offset: validOffset,
				total: rules.length
			},
			message: `Found ${rules.length} rule(s) for rate card ${trimmedRateCardId} revision ${trimmedRevision}`
		}
	} catch (error) {
		return errorResponse(`Failed to get rate card rules: ${error.message}`)
	}
}

/**
 * Main entry point - Get rate card information
 * @param {Object} data - Request data
 * @param {string} data.action - Action to perform: 'get_customer_cards', 'get_card_details', or 'get_card_rules'
 * @param {string} data.customerId - Customer ID (required for 'get_customer_cards')
 * @param {string} data.rateCardId - Rate card ID (required for 'get_card_details' and 'get_card_rules')
 * @param {number} data.activeRev - Active revision (required for 'get_card_rules')
 * @param {number} data.prefix_limit - Max rules to return (optional, for 'get_card_rules')
 * @param {number} data.offset - Pagination offset (optional, for 'get_card_rules')
 * @returns {Object} Response based on requested action
 */
export async function main (data) {
	const { action, customerId, rateCardId, activeRev, prefix_limit, offset } = data || {}

	if (!action) {
		return { success: false, error: 'action is required (get_customer_cards, get_card_details, or get_card_rules)' }
	}

	if (action === 'get_customer_cards') {
		if (!customerId) return { success: false, error: 'customerId is required for get_customer_cards' }
		return getCustomerRateCards({ customerId })
	}

	if (action === 'get_card_details') {
		if (!rateCardId) return { success: false, error: 'rateCardId is required for get_card_details' }
		return getRateCardDetails({ rateCardId })
	}

	if (action === 'get_card_rules') {
		if (!rateCardId) return { success: false, error: 'rateCardId is required for get_card_rules' }
		if (activeRev == null) return { success: false, error: 'activeRev is required for get_card_rules' }
		return getRateCardRules({ rateCardId, activeRev, include_prefixes: true, prefix_limit: prefix_limit || 10, offset: offset || 0 })
	}

	return { success: false, error: `Unknown action: ${action}. Use get_customer_cards, get_card_details, or get_card_rules` }
}
