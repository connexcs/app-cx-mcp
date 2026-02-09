/**
 * Master test suite for all Call Debug MCP tools
 * Imports and runs all individual test modules
 */

import { testSearchLogs } from './testSearchLogs'
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
  console.log('='.repeat(60))
  console.log('Call Debug MCP Tools — Test Suite')
  console.log('='.repeat(60))
  console.log('')
  
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
        console.log(`✓ ${result.tool} — PASS`)
      } else if (result.status === 'SKIP') {
        results.tests_skipped++
        console.log(`⊘ ${result.tool} — SKIP: ${result.error}`)
      } else if (result.status === 'ERROR') {
        results.tests_error++
        console.log(`✗ ${result.tool} — ERROR: ${result.error}`)
      } else {
        results.tests_failed++
        console.log(`✗ ${result.tool} — FAIL: ${result.error}`)
      }
      
    } catch (error) {
      results.tests_error++
      results.details.push({
        tool: test.name,
        status: 'ERROR',
        error: error.message
      })
      console.log(`✗ ${test.name} — ERROR: ${error.message}`)
    }
  }
  
  console.log('')
  console.log('='.repeat(60))
  console.log('Test Summary')
  console.log('='.repeat(60))
  console.log(`Total:   ${results.tests_run}`)
  console.log(`Passed:  ${results.tests_passed}`)
  console.log(`Failed:  ${results.tests_failed}`)
  console.log(`Skipped: ${results.tests_skipped}`)
  console.log(`Errors:  ${results.tests_error}`)
  console.log('='.repeat(60))
  
  results.success = results.tests_failed === 0 && results.tests_error === 0
  results.summary = `${results.tests_passed}/${results.tests_run} tests passed`
  
  return results
}
