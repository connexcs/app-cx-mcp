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
  const testCallId = '896411870-861076410-2143831551'
  const testCallIdB = 'CNX2863_ewlYegJpZwUIGwtpchR0Blp/A3VtAwwFC2xyEXYB'

  const results = {}
  
  // Test 1: Direct getSipTrace() call (endpoint function)
  try {
    const directTrace = await getSipTrace(testCallId, testCallIdB)
    const messageCount1 = Array.isArray(directTrace) ? directTrace.length : 0
    results.directCall = {
      success: true,
      messageCount: messageCount1,
      isArray: Array.isArray(directTrace),
      firstMessageId: messageCount1 > 0 ? directTrace[0].id : null
    }
  } catch (error) {
    results.directCall = {
      success: false,
      error: error.message
    }
  }

  // Test 2: getSipTraceHandler() (MCP handler)
  try {
    const handlerResult = await getSipTraceHandler({ callid: testCallId, callidb: testCallIdB })
    const messageCount2 = handlerResult.raw_message_count || 0
    results.handler = {
      success: handlerResult.success,
      messageCount: messageCount2,
      hasAnalysis: !!handlerResult.analysis,
      firstMessageId: handlerResult.raw_messages?.length > 0 ? handlerResult.raw_messages[0].id : null
    }
  } catch (error) {
    results.handler = {
      success: false,
      error: error.message
    }
  }

  // Test 3: investigateCallHandler() (uses getSipTrace internally)
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
  } catch (error) {
    results.investigate = {
      success: false,
      error: error.message
    }
  }

  // Comparison and Summary
  
  const allSucceeded = results.directCall?.success && results.handler?.success && results.investigate?.success
  const messageCountsMatch = 
    results.directCall?.messageCount === results.handler?.messageCount &&
    results.handler?.messageCount === results.investigate?.messageCount
  const firstMessageIdsMatch =
    results.directCall?.firstMessageId === results.handler?.firstMessageId &&
    results.handler?.firstMessageId === results.investigate?.firstMessageId
  
  results.all_tests_succeeded = allSucceeded
  results.message_counts_match = messageCountsMatch
  results.first_message_ids_match = firstMessageIdsMatch
  results.validation_passed = allSucceeded && messageCountsMatch && firstMessageIdsMatch

  return results
}
