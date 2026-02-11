/**
 * Master test suite for all Call Debug MCP tools
 * Imports and runs all individual test modules
 */

import { testSearchLogs } from './testSearchLogs'
import { testCdr } from './testCdr'
import { testSipTrace } from './testSipTrace'
import { testCallQuality } from './testCallQuality'
import { testClass5Logs } from './testClass5Logs'
import { testRtpGroups } from './testRtpGroups'
import { testTranscription } from './testTranscription'
import { testAiAgent } from './testAiAgent'

/**
 * Runs all tool tests and aggregates results
 * @returns {Promise<Object>} Combined test results
 */
export async function main () {
  const results = {
    tests_run: 0,
    tests_passed: 0,
    tests_failed: 0,
    tests_skipped: 0,
    tests_error: 0,
    details: []
  }
  
  // Array of all test functions
  const tests = [
    { name: 'search_call_logs', func: testSearchLogs },
    { name: 'search_cdr', func: testCdr },
    { name: 'get_sip_trace', func: testSipTrace },
    { name: 'get_call_quality', func: testCallQuality },
    { name: 'get_class5_logs', func: testClass5Logs },
    { name: 'get_rtp_server_groups', func: testRtpGroups },
    { name: 'get_transcription', func: testTranscription },
    { name: 'get_ai_agent_logs', func: testAiAgent }
  ]
  
  // Run each test
  for (const test of tests) {
    results.tests_run++
    
    try {
      const result = await test.func()
      
      results.details.push(result)
      
      if (result.status === 'PASS') {
        results.tests_passed++
      } else if (result.status === 'SKIP') {
        results.tests_skipped++
      } else if (result.status === 'ERROR') {
        results.tests_error++
      } else {
        results.tests_failed++
      }
      
    } catch (error) {
      results.tests_error++
      results.details.push({
        tool: test.name,
        status: 'ERROR',
        error: error.message
      })
    }
  }
  
  results.success = results.tests_failed === 0 && results.tests_error === 0
  results.summary = `${results.tests_passed}/${results.tests_run} tests passed`
  
  return results
}
