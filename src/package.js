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
 * Get all packages assigned to a customer including recurring charges, one-time fees, and free minute bundles
 * Retrieves package assignments for a customer and filters by type if specified.
 *
 * @param {Object} filters - Filter options
 * @param {string} filters.customerId - The customer ID (maps to company_id) to get packages for
 * @param {string} [filters.type] - Optional: Filter by package type ('all', 'recurring', 'one-time', 'free-minutes')
 * @returns {Object} Response with package details
 */
export async function getCustomerPackages(filters = {}) {
	try {
		const api = getApi();
		const { customerId, type = 'all' } = filters;

		if (!customerId) {
			return errorResponse('customerId is required');
		}

		// Validate type parameter
		const validTypes = ['all', 'recurring', 'one-time', 'free-minutes'];
		if (type && !validTypes.includes(type)) {
			return errorResponse(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
		}

		// Fetch customer packages from cp/package endpoint
		// The API uses company_id parameter which maps to customerId
		// Using URLSearchParams similar to searchCustomer.js for consistent query string handling
		const params = new URLSearchParams({
			's': '',
			'company_id': customerId
		});
		
		const packagesResponse = await api.get(`package?${params.toString()}`);
		const packages = normalizeToArray(packagesResponse);

		if (!packages || packages.length === 0) {
			return {
				success: true,
				customerId,
				type,
				totalPackages: 0,
				packages: [],
				message: 'No packages assigned to this customer'
			};
		}

		let filteredPackages = packages;

		// Filter by package type if specified and not 'all'
		if (type !== 'all') {
			filteredPackages = filteredPackages.filter(pkg => {
				switch(type) {
					case 'free-minutes':
						// Check if type array includes 'free-minutes'
						return Array.isArray(pkg.type) && pkg.type.includes('free-minutes');
					case 'recurring':
						// Packages with a retail value (not null/undefined/falsy)
						return pkg.retail != null && pkg.retail !== '';
					case 'one-time':
						// Packages with setup_retail value (not null/undefined/falsy)
						return pkg.setup_retail != null && pkg.setup_retail !== '';
					default:
						return true;
				}
			});
		}

		// Pass package data as-is from API with enriched information
		const enrichedPackages = filteredPackages.map(pkg => {
			return {
				...pkg,
				remaining_minutes: Math.max(0, (pkg.minutes || 0) - (pkg.minutes_used || 0))
			};
		});

		// Sort by ID (packages returned in order)
		enrichedPackages.sort((a, b) => {
			return b.id - a.id;
		});

		let message;
		if (type === 'all') {
			message = `Found ${enrichedPackages.length} package(s) assigned to customer ${customerId}`;
		} else {
			message = `Found ${enrichedPackages.length} ${type} package(s) assigned to customer ${customerId}`;
		}

		return {
			success: true,
			customerId,
			type,
			totalPackages: enrichedPackages.length,
			packages: enrichedPackages,
			message
		};
	} catch (error) {
		return errorResponse(`Failed to get customer packages: ${error.message}`);
	}
}

/**
 * Main entry point - Get all packages assigned to a customer
 * @param {Object} data - Request data
 * @param {string} data.customerId - The unique customer ID (maps to company_id)
 * @param {string} [data.type] - Optional: Filter by package type ('all', 'recurring', 'one-time', 'free-minutes'). Defaults to 'all'
 * @returns {Object} Response with packages and details
 */
export async function main(data) {
	const { customerId, type = 'all' } = data || {};

	try {
		if (!customerId) {
			return errorResponse('customerId is required');
		}

		const filters = { customerId, type };

		return await getCustomerPackages(filters);
	} catch (error) {
		return errorResponse(`Get customer packages failed: ${error.message}`);
	}
}