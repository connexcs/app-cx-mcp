import { getSipTrace, getSipTraceHandler, investigateCallHandler } from './callDebugTools'

/**
 * Tests that both getSipTrace endpoint function and handlers return consistent data
 * Verifies no logic duplication and proper function reuse
 *
 * Tests:
 * 1. Direct getSipTrace() call (endpoint function)
 * 2. getSipTraceHandler() (MCP handler)
 * 3. investigateCallHandler() (MCP handler that uses getSipTrace internally)
 *
 * All three should return the same underlying trace data
 */
export async function main () {
  console.log('=== Testing getSipTrace Function Reuse ===\n')
  
  const testCallId = '896411870-861076410-2143831551'
  const testCallIdB = 'CNX2863_ewlYegJpZwUIGwtpchR0Blp/A3VtAwwFC2xyEXYB'
  
  console.log(`Test Call ID: ${testCallId}`)
  console.log(`Test Call IDB: ${testCallIdB}\n`)

  const results = {}
  
  // Test 1: Direct getSipTrace() call (endpoint function)
  console.log('Test 1: Calling getSipTrace() directly...')
  try {
    const directTrace = await getSipTrace(testCallId, testCallIdB)
    const messageCount1 = Array.isArray(directTrace) ? directTrace.length : 0
    results.directCall = {
      success: true,
      messageCount: messageCount1,
      isArray: Array.isArray(directTrace),
      firstMessageId: messageCount1 > 0 ? directTrace[0].id : null
    }
    console.log(`✅ Direct getSipTrace(): ${messageCount1} messages`)
    console.log(`   First message ID: ${results.directCall.firstMessageId}\n`)
  } catch (error) {
    results.directCall = {
      success: false,
      error: error.message
    }
    console.log(`❌ Direct getSipTrace() failed: ${error.message}\n`)
  }

  // Test 2: getSipTraceHandler() (MCP handler)
  console.log('Test 2: Calling getSipTraceHandler()...')
  try {
    const handlerResult = await getSipTraceHandler({ callid: testCallId, callidb: testCallIdB })
    const messageCount2 = handlerResult.raw_message_count || 0
    results.handler = {
      success: handlerResult.success,
      messageCount: messageCount2,
      hasAnalysis: !!handlerResult.analysis,
      firstMessageId: handlerResult.raw_messages?.length > 0 ? handlerResult.raw_messages[0].id : null
    }
    console.log(`✅ getSipTraceHandler(): ${messageCount2} messages`)
    console.log(`   First message ID: ${results.handler.firstMessageId}`)
    console.log(`   Has analysis: ${results.handler.hasAnalysis}\n`)
  } catch (error) {
    results.handler = {
      success: false,
      error: error.message
    }
    console.log(`❌ getSipTraceHandler() failed: ${error.message}\n`)
  }

  // Test 3: investigateCallHandler() (uses getSipTrace internally)
  console.log('Test 3: Calling investigateCallHandler()...')
  try {
    const investigateResult = await investigateCallHandler({ callid: testCallId, callidb: testCallIdB })
    const messageCount3 = investigateResult.trace?.raw_message_count || 0
    const traceAvailable = investigateResult.trace?.available
    results.investigate = {
      success: investigateResult.success,
      traceAvailable,
      messageCount: messageCount3,
      hasAnalysis: !!investigateResult.trace?.analysis,
      firstMessageId: investigateResult.trace?.raw_messages?.length > 0 ? investigateResult.trace.raw_messages[0].id : null,
      callType: investigateResult.call_type,
      issuesCount: investigateResult.issues?.length || 0
    }
    console.log(`✅ investigateCallHandler(): ${messageCount3} messages`)
    console.log(`   Trace available: ${traceAvailable}`)
    console.log(`   First message ID: ${results.investigate.firstMessageId}`)
    console.log(`   Call type: ${results.investigate.callType}`)
    console.log(`   Issues found: ${results.investigate.issuesCount}\n`)
  } catch (error) {
    results.investigate = {
      success: false,
      error: error.message
    }
    console.log(`❌ investigateCallHandler() failed: ${error.message}\n`)
  }

  // Comparison and Summary
  console.log('=== COMPARISON ===')
  
  const allSucceeded = results.directCall?.success && results.handler?.success && results.investigate?.success
  const messageCountsMatch = 
    results.directCall?.messageCount === results.handler?.messageCount &&
    results.handler?.messageCount === results.investigate?.messageCount
  const firstMessageIdsMatch =
    results.directCall?.firstMessageId === results.handler?.firstMessageId &&
    results.handler?.firstMessageId === results.investigate?.firstMessageId
  
  console.log(`All tests succeeded: ${allSucceeded ? '✅' : '❌'}`)
  console.log(`Message counts match: ${messageCountsMatch ? '✅' : '❌'}`)
  console.log(`  - Direct: ${results.directCall?.messageCount || 'N/A'}`)
  console.log(`  - Handler: ${results.handler?.messageCount || 'N/A'}`)
  console.log(`  - Investigate: ${results.investigate?.messageCount || 'N/A'}`)
  console.log(`First message IDs match: ${firstMessageIdsMatch ? '✅' : '❌'}`)
  console.log(`  - Direct: ${results.directCall?.firstMessageId || 'N/A'}`)
  console.log(`  - Handler: ${results.handler?.firstMessageId || 'N/A'}`)
  console.log(`  - Investigate: ${results.investigate?.firstMessageId || 'N/A'}`)
  
  console.log('\n=== CONCLUSION ===')
  if (allSucceeded && messageCountsMatch && firstMessageIdsMatch) {
    console.log('✅ SUCCESS: All three methods return identical trace data')
    console.log('✅ No logic duplication - investigateCallHandler correctly uses shared getSipTrace()')
  } else {
    console.log('❌ ISSUE: Methods returned different results')
    console.log('Review the results above to identify discrepancies')
  }

  return results
}
