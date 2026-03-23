import { getApi } from './callDebugTools'
import { buildTableResult } from './utils'

// Regex patterns for validation and detection
const REGEX_IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const REGEX_NUMERIC = /^\d+$/

/**
 * Auto-detect the search type based on query format
 * @param {string|number} query - The search query
 * @returns {string} The detected search type ('id', 'ips', or 'name')
 */
function detectSearchType (query) {
	const queryStr = String(query).trim()
	if (REGEX_IPV4.test(queryStr)) return 'ips'
	if (REGEX_NUMERIC.test(queryStr)) return 'id'
	return 'name'
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
 * Create standard error response
 * @param {string} error - Error message
 * @returns {Object} Error response object
 */
function errorResponse (error) {
	return { success: false, error }
}

/**
 * Discovers a live customer_id via searchCustomers.
 * Shared across test files to avoid duplication.
 * @returns {Promise<string|null>} customer_id or null
 */
export async function discoverCustomerId () {
  const result = await searchCustomers({ query: 'test', search_type: 'name', limit: 5 })
  const customers = (result && (result.customers || result.matches)) || []
  if (customers.length === 0) return null
  return String(customers[0].id)
}


/**
 * Search for a customer by numeric ID.
 * @param {string|number} id - The numeric customer ID
 * @returns {Promise<Object>} Match result with customer details, or error response if not found
 */
export async function searchById (id) {
	try {
		if (!id && id !== 0) return errorResponse('ID is required')

		const customerId = typeof id === 'string' ? id.trim() : typeof id === 'number' ? String(id) : null
		if (!customerId) return errorResponse('ID must be a string or number')
		if (!REGEX_NUMERIC.test(customerId)) return errorResponse('Invalid ID format. Expected numeric customer ID (e.g., 1234)')

		const api = getApi()
		
		const params = new URLSearchParams({
			's': '',
			'id': customerId
		})
		
		const customer = normalizeToArray(await api.get(`customer?${params.toString()}`))[0]
		
		if (!customer) {
			return {
				success: false,
				matchType: 'none',
				id: customerId,
				error: `Customer with ID "${customerId}" not found`,
				suggestion: 'Try searching with a different customer ID or use the name search function'
			}
		}

		return {
			success: true,
			matchType: 'exact',
			id: customerId,
			customer,
			message: `Found exact match for customer ID ${customerId} - returning complete customer details`
		}
	} catch (error) {
		return {
			success: false,
			matchType: 'none',
			id,
			error: `Customer with ID "${id}" not found: ${error.message}`,
			suggestion: 'Try searching with a different customer ID or use the name search function'
		}
	}
}


/**
 * Search for customers by company name.
 * @param {string} name - The customer name or partial name to search for
 * @returns {Promise<Object>} Match result with list of matching customers, or error response
 */
export async function searchByName (name) {
	try {
		if (!name || typeof name !== 'string') return errorResponse('Name must be a non-empty string')

		const trimmedName = name.trim()
		const api = getApi()
		
		const params = new URLSearchParams({
			's': '',
			'name': trimmedName
		})
		
		const customersArray = normalizeToArray(await api.get(`customer?${params.toString()}`))

		if (customersArray.length === 0) {
			return {
				success: false,
				matchType: 'none',
				query: trimmedName,
				error: `No customer found matching "${trimmedName}"`,
				suggestion: 'Try searching with a different name or use the customer ID search'
			}
		}

		return {
			success: true,
			matchType: 'exact',
			customers: customersArray,
			totalFound: customersArray.length,
			message: `Found ${customersArray.length} customer(s) matching "${trimmedName}"`
		}
	} catch (error) {
		return errorResponse(`Failed to search customers: ${error.message}`)
	}
}


/**
 * Search for a customer by SIP username.
 * Looks up switch users and returns the associated customer record.
 * Supports exact and partial username matches.
 * @param {string} username - The SIP username to search for
 * @returns {Promise<Object>} Match result with switch user and customer details, or error response
 */
export async function searchBySipUser (username) {
	try {
		if (!username || typeof username !== 'string') return errorResponse('Username must be a non-empty string')

		const trimmedUsername = username.trim()
		const queryLower = trimmedUsername.toLowerCase()
		const api = getApi()
		const usersArray = normalizeToArray(await api.get('switch/user', { _limit: 1000 }))

		let exactMatch = null
		const partialMatches = []

		for (const user of usersArray) {
			if (user.username) {
				const usernameLower = user.username.toLowerCase()
				if (usernameLower === queryLower) exactMatch = user
				else if (usernameLower.includes(queryLower)) partialMatches.push(user)
			}
		}

		if (exactMatch) {
			try {
				const customer = await api.get(`customer/${exactMatch.company_id}`)
				return {
					success: true,
					matchType: 'exact',
					switchUser: exactMatch,
					customer,
					message: 'Exact match found - returning complete customer details'
				}
			} catch (error) {
				return {
					success: false,
					matchType: 'exact',
					error: `Exact match found but customer details could not be retrieved: ${error.message}`
				}
			}
		}

		if (partialMatches.length > 0) {
			const customers = []
			for (const user of partialMatches) {
				try {
					const customer = await api.get(`customer/${user.company_id}`)
					customers.push({ switchUser: user, customer })
				} catch (error) {
					// Skip if customer not found
				}
			}

			return {
				success: true,
				matchType: 'partial',
				matches: customers,
				totalFound: customers.length,
				message: `Found ${customers.length} partial matches - returning associated customer details`
			}
		}

		return {
			success: false,
			matchType: 'none',
			query: trimmedUsername,
			error: `No SIP user found matching "${trimmedUsername}"`,
			suggestion: 'Try searching with a different username or use the customer name search'
		}
	} catch (error) {
		return errorResponse(`Failed to search SIP users: ${error.message}`)
	}
}

/**
 * Search for a customer by IPv4 address.
 * Looks up IP entries in the switch and returns the associated customer record.
 * @param {string} ip - IPv4 address to search for (e.g., '192.168.1.1')
 * @returns {Promise<Object>} Match result with IP entry and customer details, or error response
 */
export async function searchByIp (ip) {
	try {
		if (!ip || typeof ip !== 'string') return errorResponse('IP address must be a non-empty string')
		if (!REGEX_IPV4.test(ip.trim())) return errorResponse('Invalid IP address format. Expected IPv4 format (e.g., 192.168.1.1)')

		const trimmedIp = ip.trim()
		const api = getApi()
		const matchedIps = normalizeToArray(await api.get('switch/ip', { ip: trimmedIp, _limit: 1000 }))

		if (matchedIps.length > 0) {
			const customers = []
			const customerIds = [...new Set(matchedIps.map(ipEntry => ipEntry.company_id).filter(Boolean))]

			for (const customerId of customerIds) {
				try {
					const customer = await api.get(`customer/${customerId}`)
					customers.push({
						ipEntry: matchedIps.find(ipE => ipE.company_id === customerId),
						customer
					})
				} catch (error) {
					// Skip if customer not found
				}
			}

			return {
				success: true,
				matchType: 'exact',
				ip: trimmedIp,
				totalFound: customers.length,
				customers,
				message: `Found exact match for IP ${trimmedIp} - returning customer details`
			}
		}

		return {
			success: false,
			matchType: 'none',
			ip: trimmedIp,
			error: `No IP entry found matching "${trimmedIp}"`,
			suggestion: 'Try searching with a different IP address or use the customer search function'
		}
	} catch (error) {
		return errorResponse(`Failed to search IP addresses: ${error.message}`)
	}
}

/**
 * Get the current balance and call capability for a customer.
 * @param {Object} data - Request data
 * @param {string} data.customer_id - The numeric customer ID
 * @param {Object} [meta] - Optional metadata passed by the MCP framework
 * @returns {Promise<Object>} Balance details including credit, debit limit, available balance, and call capability
 */
export async function getCustomerBalance (data, meta) {
	const { customer_id } = data || {}

	if (!customer_id) return errorResponse('customer_id parameter is required')

	try {
		const customerId = typeof customer_id === 'string' ? customer_id.trim() : String(customer_id)
		if (!REGEX_NUMERIC.test(customerId)) {
			return errorResponse('Invalid customer_id format. Expected numeric customer ID (e.g., 1234)')
		}

		const api = getApi()
		const customer = await api.get(`customer/${customerId}`)

		if (!customer) {
			return {
				success: false,
				error: `Customer with ID "${customerId}" not found`
			}
		}

		// Extract balance information
		const credit = parseFloat(customer.credit) || 0
		const debitLimit = parseFloat(customer.debit_limit) || 0
		const availableBalance = credit + debitLimit
		const canMakeCalls = availableBalance > 0

		return {
			success: true,
			customer_id: customerId,
			customer_name: customer.name || 'Unknown',
			balance: {
				credit: credit,
				debit_limit: debitLimit,
				available_balance: availableBalance,
				currency: customer.currency || 'USD'
			},
			call_capability: {
				can_make_calls: canMakeCalls,
				status: canMakeCalls ? 'active' : 'suspended',
				message: canMakeCalls 
					? `Customer has ${availableBalance.toFixed(2)} available balance and can make calls`
					: `Customer has insufficient balance (${availableBalance.toFixed(2)}) and cannot make calls`
			},
			message: `Successfully retrieved balance for customer ${customerId}`
		}
	} catch (error) {
		return {
			success: false,
			customer_id,
			error: `Failed to retrieve customer balance: ${error.message}`,
			suggestion: 'Verify the customer ID is correct and try again'
		}
	}
}


/**
 * Get the most recent top-up (payment) for a customer.
 * Returns the latest payment record sorted by payment time descending.
 * @param {Object} data - Request data
 * @param {string} data.customer_id - The numeric customer ID
 * @param {Object} [meta] - Optional metadata passed by the MCP framework
 * @returns {Promise<Object>} Most recent payment details including amount, date, and method
 */
export async function getLastTopup (data, meta) {
	const { customer_id } = data || {}

	if (!customer_id) return errorResponse('customer_id parameter is required')

	try {
		const customerId = typeof customer_id === 'string' ? customer_id.trim() : String(customer_id)
		if (!REGEX_NUMERIC.test(customerId)) {
			return errorResponse('Invalid customer_id format. Expected numeric customer ID (e.g., 1234)')
		}

		const api = getApi()
		
		// Build query parameters for payment endpoint
		const params = new URLSearchParams({
			's': '',
			'company_id': customerId,
			'_startRow': '0',
			'_endRow': '100',
			'_pivotMode': 'false',
			'_sortModel[0][sort]': 'desc',
			'_sortModel[0][colId]': 'payment.payment_time'
		})

		const payments = normalizeToArray(await api.get(`payment?${params.toString()}`))

		if (!payments || payments.length === 0) {
			return {
				success: false,
				customer_id: customerId,
				error: `No payments found for customer ${customerId}`
			}
		}

		// The first payment is the most recent due to descending sort
		const lastTopup = payments[0]

		return {
			success: true,
			customer_id: customerId,
			payment_id: lastTopup.id,
			amount: parseFloat(lastTopup.amount) || 0,
			currency: lastTopup.currency || 'USD',
			payment_date: lastTopup.payment_time,
			payment_method: lastTopup.method || 'Unknown',
			status: lastTopup.status
		}
	} catch (error) {
		return {
			success: false,
			customer_id,
			error: `Failed to retrieve last top-up: ${error.message}`
		}
	}
}


/**
 * Search for customers using an auto-detected or specified search type.
 * Dispatches to searchById, searchByName, searchBySipUser, or searchByIp based on the query.
 * @param {Object} data - Request data
 * @param {string} data.query - Search string (name, numeric ID, SIP username, or IPv4 address)
 * @param {string} [data.search_type='auto'] - Force a search type: 'auto', 'id', 'name', 'sip_user', or 'ips'
 * @param {number} [data.limit=10] - Maximum number of results to return
 * @param {Object} [meta] - Optional metadata passed by the MCP framework
 * @returns {Promise<Object>} Search results with customer list and table data
 */
export async function searchCustomers (data, meta) {
	const { query, search_type = 'auto', limit = 10 } = data || {}

	if (!query) return errorResponse('Query parameter is required')

	try {
		const finalSearchType = search_type === 'auto' ? detectSearchType(query) : search_type

		const searchMap = { id: searchById, name: searchByName, sip_user: searchBySipUser, ips: searchByIp }
		const searchFn = searchMap[finalSearchType]
		if (!searchFn) return errorResponse(`Invalid search_type: ${finalSearchType}. Valid options: auto, id, name, sip_user, ips`)

		const results = await searchFn(query)

		// Apply limit
		if (results.customers && Array.isArray(results.customers)) {
			results.customers = results.customers.slice(0, Math.max(1, limit))
		} else if (results.matches && Array.isArray(results.matches)) {
			results.matches = results.matches.slice(0, Math.max(1, limit))
		}

		// Add table result for name-based searches
		if (finalSearchType === 'name' && results.customers && Array.isArray(results.customers)) {
			const tableData = buildTableResult(results.customers, {
				columns: ['id', 'name', 'email', 'status', 'currency', 'credit', 'debit_limit'],
				query: null,
				message: `Found ${results.customers.length} customer(s) matching "${query}"`
			})
			Object.assign(results, tableData)
		}

		// Add table result for IP-based searches (flatten { ipEntry, customer } objects)
		if (finalSearchType === 'ips' && results.customers && Array.isArray(results.customers)) {
			const customerRows = results.customers.map(c => ({ ...c.customer, matched_ip: c.ipEntry?.ip }))
			const tableData = buildTableResult(customerRows, {
				columns: ['id', 'name', 'email', 'status', 'matched_ip', 'currency', 'credit'],
				query: null,
				message: `Found ${customerRows.length} customer(s) matching IP "${query}"`
			})
			Object.assign(results, tableData)
		}

		return { ...results, search_type: finalSearchType }
	} catch (error) {
		return errorResponse(`Search failed: ${error.message}`)
	}
}
