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
 * Fetch and filter RTP servers with optional filters
 * Returns a list of available RTP (Real-time Transport Protocol) servers
 * that are operational and ready to handle voice/video traffic.
 * 
 * @param {Object} filters - Optional filters
 * @param {number|string} filters.server_id - Optional: Filter by specific server ID
 * @param {string} filters.zone - Optional: Filter by zone (e.g., 'Frankfurt 2 (High Capacity)')
 * @param {string} filters.alias - Optional: Filter by alias (server name)
 * @param {string} filters.geozone - Optional: Filter by geozone (alias for zone)
 * @returns {Object} Response with servers list and metadata
 */
export async function listRTPServers(filters = {}) {
	try {
		const api = getApi();

		// Fetch all servers from the setup/rtp endpoint once
		const servers = normalizeToArray(await api.get('setup/rtp'));

		if (!servers || servers.length === 0) {
			return {
				success: true,
				totalFound: 0,
				servers: [],
				message: 'No RTP servers found',
				filters
			};
		}

		let filteredServers = servers;
		const appliedFilters = {};

		// Filter by server ID
		if (filters.server_id) {
			const serverId = filters.server_id;
			filteredServers = filteredServers.filter(server => server.id === parseInt(serverId) || server.id === serverId);
			appliedFilters.server_id = serverId;
		}

		// Filter by zone
		const zoneFilter = filters.zone || filters.geozone;
		if (zoneFilter) {
			const zoneQuery = zoneFilter.toLowerCase().trim();
			filteredServers = filteredServers.filter(server => {
				if (!server.zone) return false;
				return server.zone.toLowerCase().includes(zoneQuery);
			});
			appliedFilters.zone = zoneFilter;
		}

		// Filter by alias (server name)
		if (filters.alias) {
			const aliasQuery = filters.alias.toLowerCase().trim();
			filteredServers = filteredServers.filter(server => {
				if (!server.alias) return false;
				return server.alias.toLowerCase().includes(aliasQuery);
			});
			appliedFilters.alias = filters.alias;
		}

		// Sort by alias (name/identifier)
		filteredServers.sort((a, b) => {
			return (a.alias || '').localeCompare(b.alias || '');
		});

		// Build message
		let message;
		if (filters.server_id) {
			message = filteredServers.length > 0
				? `Found RTP server with ID ${filters.server_id}`
				: `No RTP server found with ID ${filters.server_id}`;
		} else if (zoneFilter) {
			message = `Found ${filteredServers.length} RTP server(s) in zone "${zoneFilter}"`;
		} else if (filters.alias) {
			message = `Found ${filteredServers.length} RTP server(s) matching alias "${filters.alias}"`;
		} else {
			message = `Found ${filteredServers.length} total RTP server(s)`;
		}

		return {
			success: true,
			totalFound: filteredServers.length,
			servers: filteredServers,
			allServersCount: servers.length,
			message,
			filters: appliedFilters
		};
	} catch (error) {
		return errorResponse(`Failed to list RTP servers: ${error.message}`);
	}
}

/**
 * Main entry point - List RTP servers with optional filtering
 * @param {Object} data - Request data
 * @param {number|string} data.server_id - Optional: Get specific server by ID
 * @param {string} data.zone - Optional: Filter by zone (e.g., 'Frankfurt 2 (High Capacity)')
 * @param {string} data.geozone - Optional: Alias for zone parameter
 * @param {string} data.alias - Optional: Filter by server alias/name
 * @returns {Object} Response with RTP servers
 */
export async function listRTPServersMain (data) {
	const { server_id, zone , geozone, alias } = data || {};
	
	try {
		// Create filters object - all filtering is done in listRTPServers
		const filters = {};
		
		if (server_id) {
			filters.server_id = server_id;
		}
		if (zone) {
			filters.zone = zone;
		}
		if (geozone) {
			filters.geozone = geozone;
		}
		if (alias) {
			filters.alias = alias;
		}
		
		return await listRTPServers(filters);
	} catch (error) {
		return errorResponse(`RTP server listing failed: ${error.message}`);
	}
}
