import { McpServer } from 'cxMcpServer'

const mcp = new McpServer('Example MCP Server', '1.0.0', true)

function getWeather(args) {
	const { city, units = 'celsius' } = args
	// Simulated weather data - replace with actual API call
	const temperature = units === 'celsius' ? 22 : 72
	const unitSymbol = units === 'celsius' ? '°C' : '°F'

	return {
		city,
		temperature: `${temperature}${unitSymbol}`,
		condition: 'Partly cloudy',
		humidity: '65%',
	}
}

mcp.addTool('get_weather', 'Get the current weather for a specified city', getWeather)
	.addParameter('city', 'string', 'The city name to get weather for', true)
	.addParameter('units', 'string', 'Temperature units (celsius or fahrenheit)', false, 'celsius', { enum: ['celsius', 'fahrenheit'] })


export function main(data) {
	return mcp.handle(data)
}