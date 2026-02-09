# ConnexCS MCP Server — Coding Standards

## Overview

This document defines the coding standards for the ConnexCS MCP Server project. All code must adhere to these standards to maintain consistency, readability, and compatibility with the ScriptForge sandbox environment.

---

## Syntax Standards

### 1. No Semicolons
**Rule**: Do not use semicolons as line endings.

**Rationale**: Improves readability and maintains consistency across the codebase.

**Examples**:
```javascript
// ✅ CORRECT
const api = cxRest.auth('user@example.com')
const result = await api.get('endpoint')
return result

// ❌ INCORRECT
const api = cxRest.auth('user@example.com');
const result = await api.get('endpoint');
return result;
```

### 2. Function Declaration Spacing
**Rule**: Include a space between the function name and the opening parenthesis for parameters.

**Rationale**: Improves visual distinction between function names and parameter lists.

**Examples**:
```javascript
// ✅ CORRECT
export function getSipTrace () { }
export async function main () { }
function helperFunc (param1, param2) { }

// ❌ INCORRECT
export function getSipTrace() { }
export async function main() { }
function helperFunc(param1, param2) { }
```

### 3. No Trailing Spaces
**Rule**: Remove all trailing whitespace from lines.

**Rationale**: Prevents unnecessary git diffs and maintains clean code.

**Implementation**: Configure your editor to automatically trim trailing spaces on save.

---

## File Organization Standards

### 4. No Child Subfolders in src/
**Rule**: The `src/` directory must not contain any subdirectories. All script files must reside directly in the `src/` root.

**Rationale**: Maintains simple import paths and keeps the project structure flat and easy to navigate. While ScriptForge supports relative imports, keeping all files at the root level simplifies path resolution.

**Examples**:
```
✅ CORRECT Structure:
src/
  cacioustest.js
  callDebugMcp.js
  callDebugTools.js
  mcp.js

❌ INCORRECT Structure:
src/
  tools/
    callDebug.js
  helpers/
    utils.js
```

### 5. No Temporary Files
**Rule**: Never leave temporary, test, or experimental files in the codebase.

**Rationale**: Temporary files pollute the workspace, confuse developers, and increase repository size unnecessarily.

**Examples of files to avoid**:
- `test.js`, `temp.js`, `backup.js`
- `old_version.js`, `script_copy.js`
- `debug_test.js`, `experiment.js`

**Best Practice**: Delete temporary files immediately after use. Use descriptive names for legitimate test harnesses.

---

## Export Standards

### 6. Export Prefix Requirement
**Rule**: All functions that need to be exported must be prefixed with the `export` keyword at declaration.

**Rationale**: Explicit exports improve clarity and prevent confusion about module boundaries.

**Examples**:
```javascript
// ✅ CORRECT
export function getSipTrace (callid) {
  // Implementation
}

export async function main () {
  // Entry point
}

// ❌ INCORRECT
function getSipTrace (callid) {
  // Implementation
}
export { getSipTrace }  // Don't export separately
```

---

## Documentation Standards

### 7. JSDoc Type Annotations (Required)
**Rule**: Every function must be clearly documented using JSDoc with complete type information for all parameters and return values.

**Rationale**: TypeScript is not yet supported in this project. JSDoc provides typing, IDE intellisense, and documentation in a standards-compliant way.

**Requirements**:
- All functions must have a JSDoc comment block
- All parameters must have `@param` tags with types
- All return values must have `@returns` tags with types
- Functions must have a description explaining their purpose
- Document any thrown errors with `@throws`
- Document parameter limitations and constraints

**Type Syntax**:
```javascript
/**
 * Description of the function
 * @param {string} paramName - Description
 * @param {number} numParam - Description
 * @param {boolean} [optionalParam] - Optional parameter description
 * @param {Object} objParam - Object parameter
 * @param {string} objParam.property - Object property
 * @returns {Promise<Array<Object>>} Description of return value
 * @throws {Error} Description of error condition
 */
```

**Full Example**:
```javascript
/**
 * Fetches SIP trace messages for a specific call from ConnexCS logging system.
 * 
 * The trace endpoint returns an array of SIP messages in chronological order.
 * This is the most important call debugging endpoint - every call that hits
 * the system will have trace data.
 * 
 * @param {string} callid - The SIP Call-ID to fetch trace for (required, non-empty)
 * @param {string} [callidb] - Optional encoded internal identifier for the call
 * @returns {Promise<Array<Object>>} Array of SIP message objects containing:
 *   - {number} id - Unique packet ID
 *   - {string} date - Timestamp of the SIP message (ISO 8601)
 *   - {number} micro_ts - Microsecond-precision timestamp
 *   - {string} callid - SIP Call-ID header value
 *   - {string} method - SIP method or response code
 *   - {string} reply_reason - Reason phrase for SIP responses
 *   - {string} source_ip - IP address the packet was sent from
 *   - {number} source_port - Source port
 *   - {string} destination_ip - IP address the packet was sent to
 *   - {number} destination_port - Destination port
 *   - {string} protocol - Transport protocol (UDP, TCP, TLS)
 *   - {string} msg - Full raw SIP message text
 *   - {number} delta - Time delta (microseconds) from previous message
 * @throws {Error} If callid is empty or invalid
 * @throws {Error} If API authentication fails
 * @throws {Error} If network request fails
 */
export async function getSipTrace (callid, callidb) {
  if (!callid || typeof callid !== 'string' || callid.trim() === '') {
    throw new Error('callid is required and must be a non-empty string')
  }
  
  const api = cxRest.auth('csiamunyanga@connexcs.com')
  const endpoint = callidb 
    ? `log/trace?callid=${callid}&callidb=${callidb}`
    : `log/trace?callid=${callid}`
  
  return await api.get(endpoint)
}
```

**Complex Type Examples**:
```javascript
/**
 * @typedef {Object} SipTraceMessage
 * @property {number} id - Unique packet ID
 * @property {string} date - ISO 8601 timestamp
 * @property {string} method - SIP method or response code
 * @property {string} msg - Full raw SIP message
 */

/**
 * Analyzes SIP trace messages and extracts call flow information
 * @param {Array<SipTraceMessage>} messages - Array of SIP trace messages
 * @returns {Object} Analysis result with call flow details
 */
export function analyzeSipTrace (messages) {
  // Implementation
}
```

### 8. Parameter Validation
**Rule**: All functions must validate their input parameters and throw meaningful errors.

**Rationale**: AI agents calling these tools need clear, actionable error messages to quickly correct invalid parameters.

**Requirements**:
- Check for required parameters (null, undefined checks)
- Validate parameter types
- Check parameter constraints (length, range, format)
- Throw descriptive errors with specific correction guidance
- Include parameter name and expected value in error messages

**Examples**:
```javascript
// ✅ CORRECT - Clear validation with meaningful errors
/**
 * @param {string} callid - Call ID (required, non-empty, max 255 chars)
 * @param {string} date - Date in YYYY-MM-DD format (required)
 * @throws {Error} If callid is missing, empty, or exceeds 255 characters
 * @throws {Error} If date is missing or not in YYYY-MM-DD format
 */
export async function getAiAgentLogs (callid, date) {
  // Validate callid
  if (!callid) {
    throw new Error('Parameter "callid" is required but was not provided')
  }
  if (typeof callid !== 'string') {
    throw new Error(`Parameter "callid" must be a string, received ${typeof callid}`)
  }
  if (callid.trim() === '') {
    throw new Error('Parameter "callid" cannot be an empty string')
  }
  if (callid.length > 255) {
    throw new Error(`Parameter "callid" exceeds maximum length of 255 characters (received ${callid.length})`)
  }
  
  // Validate date format
  if (!date) {
    throw new Error('Parameter "date" is required but was not provided')
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    throw new Error(`Parameter "date" must be in YYYY-MM-DD format, received "${date}"`)
  }
  
  // Proceed with API call
  const api = cxRest.auth('csiamunyanga@connexcs.com')
  return await api.get(`log/ai-agent?callid=${callid}&d=${date}`)
}

// ❌ INCORRECT - No validation
export async function getAiAgentLogs (callid, date) {
  const api = cxRest.auth('csiamunyanga@connexcs.com')
  return await api.get(`log/ai-agent?callid=${callid}&d=${date}`)
}
```

**Validation Helper Pattern**:
```javascript
/**
 * Validates that a parameter is a non-empty string
 * @param {*} value - The value to validate
 * @param {string} paramName - Name of the parameter for error messages
 * @param {number} [maxLength] - Optional maximum length constraint
 * @throws {Error} If validation fails
 */
function validateRequiredString (value, paramName, maxLength) {
  if (!value) {
    throw new Error(`Parameter "${paramName}" is required but was not provided`)
  }
  if (typeof value !== 'string') {
    throw new Error(`Parameter "${paramName}" must be a string, received ${typeof value}`)
  }
  if (value.trim() === '') {
    throw new Error(`Parameter "${paramName}" cannot be an empty string`)
  }
  if (maxLength && value.length > maxLength) {
    throw new Error(`Parameter "${paramName}" exceeds maximum length of ${maxLength} characters (received ${value.length})`)
  }
}
```

---

## ScriptForge-Specific Standards

### 9. Cross-File Imports
**Rule**: ScriptForge supports importing from other user files using relative paths **without file extensions**.

**Rationale**: ScriptForge runs in QuickJS sandboxes but supports ES6 module imports between user scripts in the same workspace.

**Import Syntax**:
- ✅ Use relative path with `./` prefix
- ✅ Omit the `.js` file extension
- ✅ Works for both named and default exports

**Examples**:
```javascript
// ✅ CORRECT - Import from user files
import { getSipTrace, getRtcpQuality } from './callDebugTools'
import { searchCallLogs } from './callDebugTools'
import someFunction from './utilities'

// ✅ CORRECT - Import from ConnexCS modules
import cxRest from 'cxRest'
import cxMcpServer from 'cxMcpServer'
import cxCallControl from 'cxCallControl'
import cxKysely from 'cxKysely'

// ❌ INCORRECT - Don't include .js extension
import { getSipTrace } from './callDebugTools.js'  // Will fail

// ❌ INCORRECT - Don't use absolute paths
import { getSipTrace } from '/src/callDebugTools'  // Will fail

// ❌ INCORRECT - Don't use bare module names for user files
import { getSipTrace } from 'callDebugTools'  // Will fail
```

**Best Practice**: Create shared utility modules (like `callDebugTools.js`) that export reusable functions, then import them where needed. This promotes code reuse and maintains single source of truth.

### 10. Export main() Function
**Rule**: Every executable ScriptForge script must export a `main()` function as its entry point.

**Example**:
```javascript
import cxRest from 'cxRest'

/**
 * Entry point for the script
 * @returns {Promise<Object>} API response object
 */
export async function main () {
  const api = cxRest.auth('csiamunyanga@connexcs.com')
  const response = await api.get('setup/server/rtp-group')
  return response
}
```

---

## Summary Checklist

Before committing code, verify:
- [ ] No semicolons used as line endings
- [ ] Space between function names and opening parenthesis
- [ ] No trailing whitespace
- [ ] No temporary or experimental files
- [ ] All files in `src/` root (no subdirectories)
- [ ] All exported functions use `export` prefix
- [ ] All functions have complete JSDoc documentation
- [ ] All parameters have type annotations in JSDoc
- [ ] All return values documented with `@returns`
- [ ] All parameters validated with meaningful error messages
- [ ] Error messages include parameter names and expected values
- [ ] Cross-file imports use correct syntax: `import { func } from './file'` (no .js extension)
- [ ] Entry point uses `export async function main ()`

---

## References

- [JSDoc Official Documentation](https://jsdoc.app/)
- [JSDoc Type Annotations](https://jsdoc.app/tags-type.html)
- [JSDoc @param Tag](https://jsdoc.app/tags-param.html)
- [JSDoc @returns Tag](https://jsdoc.app/tags-returns.html)
- [JSDoc @typedef Tag](https://jsdoc.app/tags-typedef.html)
