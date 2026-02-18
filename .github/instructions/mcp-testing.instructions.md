# ConnexCS MCP Server — Comprehensive Testing Guide

## Overview

This document defines how to comprehensively test the ConnexCS MCP server. It covers the full range of client types ConnexCS serves — from novice resellers to enterprise engineers — and maps testing coverage across all 23 tools.

The goal is reproducible, evidence-based testing that can be run by any developer against any deployed instance of the MCP server.

**What "comprehensive" means here:**
- Every tool has been called and returned real data
- Every tool chain that a real user would follow has been walked end-to-end
- Error handling has been verified for missing params and bad IDs
- Response quality has been checked from both a novice and expert perspective
- Known bugs and limitations are documented

---

## Prerequisites

Before testing, confirm:

1. **MCP server is running** — the ScriptForge endpoint is live and the VS Code MCP extension (or equivalent client) has discovered all 23 tools
2. **Real account data exists** — you need at least one active customer who has:
   - Made calls in the last 7 days (for SIP trace tests)
   - At least one rate card with rules
   - At least one package assigned
   - At least one topup on record
   - Profitability data in the billing system
3. **Environment variable set** — `API_USERNAME` is configured with a valid ConnexCS API user
4. **`cx push` completed** — the latest source has been pushed to ScriptForge before testing

### Finding a Suitable Test Customer

Not all customers will have data for every test. Run `listCustomersByProfitability` with `limit: 10` first and probe the top results. A suitable customer will have:

- `getCustomerRateCards` returns at least one card with a non-`internal`, non-`ip:` `card_id`
- `getRateCardDetails` on that card returns `active_rev` (a number)
- `getLastTopup` returns a `last_topup` date
- Recent calls in `searchCdr` within the last 7 days

The `masterTest.js` suite automates this discovery via `discoverFullyEquippedCustomer()`. Run it first to identify the customer ID to use throughout manual testing.

---

## The 23 Tools

| # | Tool Name | Category | Data Always Available? |
|---|-----------|----------|----------------------|
| 1 | `searchDocumentation` | Documentation | Yes |
| 2 | `getDocumentation` | Documentation | Yes (for valid paths) |
| 3 | `searchCdr` | Call Records | Yes (with date range) |
| 4 | `searchCallLogs` | Call Debugging | Yes |
| 5 | `getSipTrace` | Call Debugging | 7-day window only |
| 6 | `investigateCall` | Call Debugging | 7-day window only |
| 7 | `getCallQuality` | Call Debugging | Only if RTCP enabled |
| 8 | `getCallAnalytics` | Analytics | Yes (with date range) |
| 9 | `getAiAgentLogs` | Call Debugging | Only if AI Agent used |
| 10 | `getTranscription` | Call Debugging | Only if transcription enabled |
| 11 | `listCustomersByProfitability` | Customers | Yes |
| 12 | `searchCustomers` | Customers | Yes |
| 13 | `getCustomerBalance` | Customers | Yes |
| 14 | `getLastTopup` | Customers | Only if customer has topped up |
| 15 | `getCustomerPackages` | Customers | Only if packages assigned |
| 16 | `getCustomerRateCards` | Rate Cards | Yes |
| 17 | `getRateCardDetails` | Rate Cards | Yes (for valid card_id) |
| 18 | `getRateCardRules` | Rate Cards | Yes (for valid card_id + rev) |
| 19 | `getCustomerProfitability` | Analytics | Yes |
| 20 | `getCustomerCallStatistics` | Analytics | Yes |
| 21 | `getCustomerDestinationStatistics` | Analytics | Yes |
| 22 | `getRtpServerGroups` | Infrastructure | Yes |
| 23 | `listRtpServers` | Infrastructure | Yes |

---

## Test Suites

### Suite 1 — Documentation Tools

**Purpose**: Verify that an AI agent or novice user can find and read ConnexCS documentation.

#### 1.1 — Keyword Search

Call `searchDocumentation` with a plain-English query:

```
searchDocumentation({ query: "how to debug a call", limit: 5 })
```

**Pass criteria:**
- `success: true`
- `results` array has at least 3 items
- Each result has a non-empty `link` field (e.g. `"guides/tshoot-signal"`)
- Each result has a non-empty `body` snippet containing relevant text

**Known limitation**: The `title` field is populated by extracting the markdown `# Heading` from the article body. The search API returns body snippets (not full articles), so there may be no heading in the snippet. If `title` is empty, this is an upstream API gap — verify `link` is usable instead.

#### 1.2 — Full Article Retrieval (paths from search results)

Take the `link` values from Suite 1.1 and call `getDocumentation` on each:

```
getDocumentation({ path: "guides/tshoot-media" })
getDocumentation({ path: "guides/tshoot-signal" })
getDocumentation({ path: "webphone" })
```

**Pass criteria for each:**
- `success: true`
- `title` is non-empty (e.g. `"Troubleshoot Media"`)
- `content` contains substantial readable text (not just HTML tags)
- `fullContent` starts with `# ` (a markdown heading)
- `metadata.audience` and `metadata.difficulty` are populated for technical guides

#### 1.3 — Invalid Path Handling

```
getDocumentation({ path: "this/does/not/exist" })
```

**Pass criteria:**
- `success: false` (or `status: "error"`)
- `attempts` array is present and explains what was tried
- Error message distinguishes between "not found" (404) and "unauthorized" (401)
- No unhandled exception thrown

---

### Suite 2 — Call Debug Chain (Novice Path)

**Purpose**: Simulate the experience of a non-technical customer support agent who has a Call-ID and wants to understand what happened.

#### 2.1 — Find a Recent Call

```
searchCdr({ start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD", limit: 5 })
```

Use a date range ending today, spanning the last 7 days.

**Pass criteria:**
- `success: true`
- `records` array is non-empty
- Each record has `callid`, `dt` (datetime), `duration`, `customer_id`
- `message` field contains human-readable guidance

Select the most recent `callid` from the results for steps 2.2-2.4.

#### 2.2 — Search Call Logs

```
searchCallLogs({ search: "<callid_from_2.1>" })
```

**Pass criteria:**
- `success: true`
- Returns the call with full routing data
- `message` field explains how to use `callid` and `callidb` for further debugging

#### 2.3 — Investigate Call

```
investigateCall({ callid: "<callid>", callidb: "<callidb_from_2.2>" })
```

**Pass criteria:**
- `success: true`
- `call_type` is `"class4"` or `"class5"`
- `debug_summary` is a non-empty human-readable string
- `trace.available` is `true` (for a call within the last 7 days)
- If trace is unavailable, `issues` array contains an explanation and `suggestions` are present

#### 2.4 — Get SIP Trace

```
getSipTrace({ callid: "<callid>", callidb: "<callidb>" })
```

**Pass criteria (trace available):**
- `success: true`
- `messages` array has multiple SIP packets
- At least one INVITE and one response (1xx or 2xx) present
- `summary` field (if present) describes the call outcome in plain English

**Pass criteria (trace expired — call older than 7 days):**
- `success: false`
- `message` explains traces are retained for 7 days only
- `suggestions` array has at least 3 actionable items
- No unhandled exception

---

### Suite 3 — Call Debug Chain (Expert Path)

**Purpose**: Simulate a senior engineer diagnosing a quality or routing issue.

#### 3.1 — Call Quality / RTCP

```
getCallQuality({ callid: "<callid>" })
```

**Pass criteria (RTCP data present):**
- `success: true`
- `has_rtcp: true`
- Returns MOS, jitter, packet loss, RTT fields

**Pass criteria (no RTCP data):**
- `success: true`
- `has_rtcp: false`
- `message` explains RTCP must be enabled on both endpoints

#### 3.2 — AI Agent Logs

```
getAiAgentLogs({ callid: "<callid>", date: "YYYY-MM-DD" })
```

**Pass criteria (no AI agent involved):**
- `success: true`
- `has_ai_agent: false`
- `message` clearly explains no AI agent was involved (not an error)

**Pass criteria (AI agent call):**
- `success: true`
- `has_ai_agent: true`
- `logs` array contains interaction entries

#### 3.3 — Transcription

```
getTranscription({ callid: "<callid>" })
```

**Pass criteria (no transcription):**
- `success: true`
- `has_transcription: false`
- `message` explains transcription must be enabled

---

### Suite 4 — Call Analytics

**Purpose**: Verify analytics tools return meaningful data and handle edge cases correctly.

#### 4.1 — Platform-Wide Analytics (no filters)

```
getCallAnalytics({ start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD" })
```

Use a 2-3 day range with known traffic.

**Pass criteria:**
- `success: true`
- `summary.successful_calls` is a positive number
- `summary.success_rate` is either a `"XX.XX%"` string (when attempt log data is available) or `"N/A (CDR only — provide cli or dst for attempt data)"` (when it is not) — it must **never** be `"0%"` when `successful_calls > 0`
- `successful_calls_sample` contains real call records

#### 4.2 — Customer-Filtered Analytics

```
getCallAnalytics({ start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD", customer_id: "<test_customer_id>" })
```

**Pass criteria:**
- `filters_applied.customer_id` matches the input
- Results are scoped to that customer only (cross-check with CDR)

#### 4.3 — CDR Search with Customer Filter

```
searchCdr({ customer_id: "<test_customer_id>", start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD", limit: 10 })
```

**Pass criteria:**
- All returned records have `customer_id` matching the filter
- `filters_applied` object reflects the parameters used
- Empty result set returns `records: []` with a helpful `message` (not an error)

---

### Suite 5 — Customer Lookup Chain

**Purpose**: Simulate a billing or account manager looking up a customer and reviewing their account.

#### 5.1 — Search by Name

```
searchCustomers({ query: "Adam", search_type: "name" })
```

**Pass criteria:**
- `success: true`
- Returns customer with `id`, `name`, `status`, `credit`, `currency`
- `cards` array lists assigned rate card IDs (alphanumeric `card_id` values)
- `sip_users` and `ips` arrays present

#### 5.2 — Search by ID

```
searchCustomers({ query: "<customer_id>", search_type: "id" })
```

**Pass criteria:**
- Returns exact match for that customer ID
- `matchType: "exact"`

#### 5.3 — Customer Packages

```
getCustomerPackages({ customerId: "<customer_id>" })
```

**Pass criteria:**
- `success: true`
- `packages` array non-empty
- Each package has `name`, `type`, `qty`, `retail`
- Free-minutes packages show `minutes` and `remaining_minutes`

#### 5.4 — Customer Balance

```
getCustomerBalance({ customer_id: "<customer_id>" })
```

**Pass criteria:**
- `success: true`
- Returns current balance and currency
- Balance is a number (not null)

#### 5.5 — Last Topup

```
getLastTopup({ customer_id: "<customer_id>" })
```

**Pass criteria (topup exists):**
- `success: true`
- `last_topup` is a date string
- `amount` is a positive number

**Pass criteria (no topup history):**
- `success: true` with a clear message, or `success: false` with an explanation
- No unhandled exception

---

### Suite 6 — Rate Card Chain

**Purpose**: Simulate a technical user or routing engineer inspecting a customer's rate card configuration.

**Important**: The `cards` array on a customer uses `card_id` (alphanumeric, e.g. `"GjjS-E0FO"`), which is the identifier to pass to rate card tools. Do **not** use the numeric routing row `id` field from `getCustomerRateCards`.

#### 6.1 — List Customer Rate Cards

```
getCustomerRateCards({ customerId: "<customer_id>" })
```

**Pass criteria:**
- `success: true`
- `rateCards` array non-empty
- Each entry has `card_id` (alphanumeric) and `name`
- `totalRateCards` matches `rateCards.length`

Select a `card_id` that is NOT `"internal"` and does NOT start with `"ip:"` for steps 6.2-6.3.

#### 6.2 — Rate Card Details

```
getRateCardDetails({ rateCardId: "<card_id>" })
```

**Pass criteria:**
- `success: true`
- `data.id` matches the requested `card_id`
- `data.active_rev` is a number (required for calling `getRateCardRules`)
- `data.currency`, `data.strategy`, `data.direction` are present
- `data.count` shows number of rules in the card

#### 6.3 — Rate Card Rules

```
getRateCardRules({ rateCardId: "<card_id>", activeRev: "<active_rev>", prefix_limit: 10 })
```

**Pass criteria:**
- `success: true`
- `rules` array non-empty
- Each rule has `prefix`, `name`, `cost`, `mcd`, `pulse`
- `pagination.total` reflects total available rules (may exceed `prefix_limit`)
- `message` summarises what was returned

---

### Suite 7 — Profitability and Statistics Chain

**Purpose**: Simulate a business analyst or account manager reviewing customer performance.

#### 7.1 — Top Customers by Profitability

```
listCustomersByProfitability({ limit: 5, sort_by: "total_profit" })
```

**Pass criteria:**
- `success: true`
- Returns up to 5 customers sorted by profit
- Each entry has `customer_id`, `total_profit`, `total_revenue`, `total_cost`, `profit_margin`, `asr`, `acd`

#### 7.2 — Customer Profitability

```
getCustomerProfitability({ customer_id: "<customer_id>" })
```

**Pass criteria:**
- `success: true`
- `metrics` object present with `total_revenue`, `total_cost`, `total_profit`, `profit_margin`
- `dateRange` shows the period covered
- `data` array has at least one entry

#### 7.3 — Customer Call Statistics

```
getCustomerCallStatistics({ company_id: "<customer_id>" })
```

**Pass criteria:**
- `success: true`
- Returns time-series or summary data for the customer
- Data covers a meaningful period

#### 7.4 — Customer Destination Statistics

```
getCustomerDestinationStatistics({ customer_id: "<customer_id>", limit: 10 })
```

**Pass criteria:**
- `success: true`
- `destinations` array non-empty
- Each destination has `asr`, `acd`, `attempts`, `connected`, `profit`
- `summary` object aggregates across all destinations

---

### Suite 8 — RTP Infrastructure

**Purpose**: Verify infrastructure tools return correct data for media troubleshooting.

#### 8.1 — RTP Server Groups

```
getRtpServerGroups()
```

**Pass criteria:**
- `success: true`
- Returns 10+ active groups
- Each entry has `id`, `name`, `location`
- Named regions present: at minimum UK, USA, Europe, Asia-Pacific

#### 8.2 — List RTP Servers

```
listRtpServers()
```

**Pass criteria:**
- `success: true`
- Returns individual server entries with IP addresses
- Each server linked to a group ID from 8.1

---

### Suite 9 — Error Handling

**Purpose**: Verify the server fails gracefully and provides actionable guidance when called incorrectly.

#### 9.1 — Missing Required Parameter

Call a tool that has a required parameter with it omitted. Examples:

```
getSipTrace({})
getCustomerBalance({})
getRateCardDetails({})
```

**Pass criteria for each:**
- Returns an error object (not an unhandled exception / 500)
- Error message names the missing parameter explicitly
- Message is understandable by a novice user

#### 9.2 — Invalid / Non-Existent ID

```
getSipTrace({ callid: "FAKE-CALLID-THAT-DOES-NOT-EXIST" })
getCustomerRateCards({ customerId: "0" })
getRateCardDetails({ rateCardId: "XXXX-0000" })
```

**Pass criteria:**
- `success: false` (never throws unhandled)
- For SIP trace: `message` explains 7-day retention and suggests searching logs
- For customer/card: message clarifies the record was not found

#### 9.3 — No-Match Search

```
searchCallLogs({ search: "999INVALID000XXXX" })
searchCustomers({ query: "zzznoexist999", search_type: "name" })
```

**Pass criteria:**
- `success: true` with empty results (not an error)
- `message` suggests alternative queries or approaches
- `result_count: 0` (not null or undefined)

---

### Suite 10 — Cross-Tool Chain Validation

**Purpose**: Walk the two most important end-to-end journeys to verify chaining works.

#### Chain A — Call Debug Journey

This is the primary use case: a user reports a problem call.

1. `searchCdr` — get a recent `callid` and `customer_id`
2. `searchCallLogs({ search: callid })` — get `callidb`
3. `investigateCall({ callid, callidb })` — get `call_type`, `issues`
4. `getSipTrace({ callid, callidb })` — full SIP trace
5. `getCallQuality({ callid })` — RTCP data (pass/fail both acceptable)
6. If `call_type === "class5"`: `getAiAgentLogs`, `getTranscription`
7. `searchDocumentation({ query: "sip error " + <failure_code> })` — find relevant doc
8. `getDocumentation({ path: <link_from_step_7> })` — read the article

**Pass criteria:** Every step runs without error, each step's output provides the input for the next step, and the final output gives actionable guidance on the call issue.

#### Chain B — Customer Account Journey

This is the primary use case: an account manager reviewing a customer account.

1. `searchCustomers({ query: <name>, search_type: "name" })` — get `customer_id`
2. `getCustomerBalance({ customer_id })` — current balance
3. `getLastTopup({ customer_id })` — topup history
4. `getCustomerPackages({ customerId: customer_id })` — active packages
5. `getCustomerRateCards({ customerId: customer_id })` — get a `card_id`
6. `getRateCardDetails({ rateCardId: card_id })` — get `active_rev`
7. `getRateCardRules({ rateCardId: card_id, activeRev: active_rev, prefix_limit: 10 })` — sample rates
8. `getCustomerProfitability({ customer_id })` — profit metrics
9. `getCustomerDestinationStatistics({ customer_id, limit: 5 })` — destination breakdown

**Pass criteria:** Every step returns `success: true`, data flows correctly between steps (no ID mismatches), and the final picture gives a complete account overview.

---

## Client Type Coverage

The ConnexCS platform serves different client types. When evaluating MCP server quality, consider which tools serve each audience:

### Novice Resellers / SMB Customers
Primary needs: "Why did my call fail?", "What is my balance?", "How do I set up X?"

Relevant tools: `searchDocumentation`, `getDocumentation`, `searchCdr`, `investigateCall`, `getCustomerBalance`, `getLastTopup`

Testing focus: Are error messages plain English? Do tools suggest next steps when data is missing? Can a non-technical user identify the problem from the response alone?

### Technical Engineers / Integrators
Primary needs: SIP trace analysis, codec negotiation, NAT issues, routing decisions

Relevant tools: `getSipTrace`, `getCallQuality`, `searchCallLogs`, `getAiAgentLogs`, `getRtpServerGroups`, `listRtpServers`

Testing focus: Is the full SIP message available in `msg` field? Are timing fields (`delta`, `micro_ts`) present? Is RTCP data structured for analysis (not just raw numbers)?

### Billing / Finance Teams
Primary needs: Revenue, cost, profit margins, customer profitability rankings

Relevant tools: `listCustomersByProfitability`, `getCustomerProfitability`, `getCustomerCallStatistics`, `getCustomerDestinationStatistics`, `getCustomerBalance`, `getLastTopup`

Testing focus: Are currency fields consistent? Is `profit_margin` calculated correctly? Does `dateRange` always indicate the period the data covers?

### Routing / Rate Card Engineers
Primary needs: Rate card inspection, prefix lookup, revision management

Relevant tools: `getCustomerRateCards`, `getRateCardDetails`, `getRateCardRules`

Testing focus: Is `card_id` (alphanumeric) always the key to pass to details/rules — not the numeric routing row `id`? Does `active_rev` from `getRateCardDetails` feed correctly into `getRateCardRules`? Are prefix names human-readable?

### Operations / Infrastructure Teams
Primary needs: Media server status, zone selection, capacity planning

Relevant tools: `getRtpServerGroups`, `listRtpServers`, `getCallAnalytics`

Testing focus: Are all active regions listed? Is `location` field a readable name (not just a code)? Does `getCallAnalytics` make the distinction between CDR-only data and full attempt data clear?

---

## Automated Testing

The `masterTest.js` suite covers all 23 tools with 24 individual tests across 5 suites. Run it with:

```
cx run masterTest
```

**Expected output**: `24/24 tests passed`

Each test in `masterTest.js` maps to one or more of the manual suites above. The automated suite:
- Discovers a suitable test customer automatically via `discoverFullyEquippedCustomer()`
- Shares discovered IDs (customer, rate card, active revision) across dependent tests
- Inserts 3-second delays between suites to avoid rate-limiting (HTTP 429)
- Uses a known call ID from a recent call for SIP trace tests

When adding new tools, add a corresponding test function in the appropriate test file (`src/test*.js`) and register it in `masterTest.js`.

---

## Known Bugs and Limitations

### 1. `searchDocumentation` — Empty `title` Field
The `docs?s=` search API returns body snippets without article titles. `extractTitleFromBody` in `searchDocumentation.js` attempts to extract a `# Heading` from the snippet, but snippets are mid-paragraph excerpts unlikely to contain a heading. The `link` field is reliable — always use it to fetch the full article with `getDocumentation`, which will return a correct title.

**Workaround**: Always call `getDocumentation` on the `link` to get the article title. Do not depend on `title` from `searchDocumentation` results.

**Root cause**: Server-side — the `docs?s=` endpoint does not include article titles in its response payload.

### 2. `getCallAnalytics` — No Attempt Log Data Without `cli`/`dst` Filter
When `cli` or `dst` filter is not provided, the tool skips the log search and relies on CDR only. CDR has `successful_calls` counts but not `total_attempts`. The `success_rate` field will read `"N/A (CDR only — provide cli or dst for attempt data)"` rather than a percentage.

**This is correct behaviour** — the N/A is intentional (a previous bug reported `"0%"` which was misleading).

**Workaround**: To get a real success rate, provide a `cli` (caller number) or `dst` (destination number) filter so the tool can search log attempt data.

### 3. SIP Trace 7-Day Retention
SIP traces are only retained for 7 days. Any `callid` older than 7 days will return `{ success: false, message: "No SIP trace data found..." }`. This is a platform limitation, not a tool bug.

**Workaround**: Always use call IDs from within the last 7 days for SIP trace tests. Use `searchCdr` to find recent calls.

### 4. `getCustomerBalance` and `getLastTopup` May Be Disabled
These tools can be selectively disabled via the MCP server configuration. If disabled, calls return an error referencing the tool being disabled. Check the server's tool list — 23 tools should be active and accessible.

### 5. `getRateCardDetails` Requires `card_id` Not Routing Row `id`
`getCustomerRateCards` returns routing rows that include both a numeric `id` (the routing row identifier) and an alphanumeric `card_id` (the actual rate card identifier, e.g. `"GjjS-E0FO"`). Only `card_id` is valid for `getRateCardDetails` and `getRateCardRules`. Using the numeric `id` will return a "Record Not Found" error.

---

## Test Data Reference

When testing against the ConnexCS development environment, the following reference data has been validated:

| Item | Value |
|------|-------|
| Well-equipped test customer | Customer `105979` ("Adam") |
| Active rate card ID | `"GjjS-E0FO"` (name: "UK LL and Mobile") |
| Active revision | `21` |
| Known good call ID (Feb 16 2026) | `1f7d8bce9925450388a302d73e8e4132` |
| Known callidb for above | `CNX3736_clZZKgs6PFYOCgRqdxFzA1Z2UmtvAVMEBTp7QXcBXXw-` |
| Packages count | 7 |
| Total rate cards | 13 |
| SIP trace expired (older than 7 days) | Any call before Feb 11 2026 |

**Note**: Call IDs expire from trace storage after 7 days. The "known good call ID" above will stop having trace data after February 23, 2026. Use `searchCdr` to find current call IDs.

---

## Checklist — Before Declaring a Release Tested

- [ ] `masterTest.js` passes 24/24 with 0 SKIP and 0 FAIL
- [ ] Suite 1: Both `searchDocumentation` and `getDocumentation` called on a real query; `link` values resolve correctly
- [ ] Suite 2: Full novice debug chain walked with a call less than 7 days old
- [ ] Suite 3: Expert debug tools called; `getCallQuality` returns correct "no RTCP" message when applicable
- [ ] Suite 4: `success_rate` field verified — must not be `"0%"` when `successful_calls > 0`
- [ ] Suite 5: Customer lookup chain completed; `getCustomerPackages` returns real package data
- [ ] Suite 6: Rate card chain completed using `card_id` (not numeric `id`); `getRateCardRules` returns real prefix/cost rows
- [ ] Suite 7: Profitability chain completed; `profit_margin` is a number and `dateRange` is populated
- [ ] Suite 8: RTP groups return 10+ zones; `listRtpServers` returns individual server IPs
- [ ] Suite 9: Missing param test for at least 3 tools; error messages are novice-friendly
- [ ] Suite 10: Both Chain A and Chain B walked end-to-end; no ID mismatch between steps
- [ ] All 23 tools have been called at least once during this test session
- [ ] No tool returned an unhandled exception (stack trace, 500 Internal Server Error, etc.)
- [ ] Response quality assessed from novice, engineer, billing, and routing perspectives
- [ ] Novice question sequence (Section below) walked end-to-end — AI resolved all questions without human help
- [ ] Expert question sequence (Section below) walked end-to-end — AI produced technically accurate answers with data

---

## Real-World Question Sequences

These sequences simulate what actual ConnexCS customers would type into an AI assistant connected to this MCP server. They are designed to stress-test tool discovery, chaining, ambiguity handling, and response quality. The AI agent must figure out which tools to call, in what order, with what parameters — these are NOT structured API calls.

### Novice User Sequence (Support Agent / Small Reseller)

Use these questions exactly as written — one at a time, in order. Each question builds on the previous answer. The AI must resolve each without the user providing tool names or parameters.

**Scenario**: A small reseller's customer called to complain that their call didn't connect. The reseller has no technical knowledge and just wants answers.

> **Question 1**: "My customer Adam says his calls are failing. Can you check what's going on with his account?"
>
> _Expected AI behaviour_: Search for customer "Adam", return account status, balance, and recent call activity. Should call `searchCustomers` and possibly `getCustomerBalance`. Must present the answer in plain English — not raw JSON.

> **Question 2**: "Does he have enough credit to make calls?"
>
> _Expected AI behaviour_: If not already fetched, call `getCustomerBalance`. Compare the balance against the debit limit. Give a clear yes/no answer with the actual numbers.

> **Question 3**: "When was the last time he topped up?"
>
> _Expected AI behaviour_: Call `getLastTopup` for the customer ID discovered in Q1. Return the date and amount. If no topup exists, explain that clearly.

> **Question 4**: "Can you find his most recent calls and tell me if any failed?"
>
> _Expected AI behaviour_: Call `searchCdr` with the customer ID and a recent date range. Identify failed vs successful calls. Summarise in plain language: "3 out of 5 calls connected, 2 failed with error 403."

> **Question 5**: "One of the failed calls had this ID: [paste a callid from Q4 results]. What went wrong?"
>
> _Expected AI behaviour_: Call `searchCallLogs` or `investigateCall` with the call ID. Present the failure reason in non-technical language. Should NOT say "SIP 403 Forbidden" alone — should translate it: "The call was rejected because the destination blocked the caller ID" or similar.

> **Question 6**: "Is there a guide on how to fix this kind of problem?"
>
> _Expected AI behaviour_: Call `searchDocumentation` with a query related to the failure reason from Q5 (e.g. "call rejected 403", "troubleshoot signaling"). Then call `getDocumentation` on the most relevant result. Summarise the key steps from the article.

> **Question 7**: "What packages does Adam have? Is he on the right plan?"
>
> _Expected AI behaviour_: Call `getCustomerPackages`. Present the packages in a readable table or list. Identify free-minutes packages and whether minutes are being used. Flag any packages that look unusual (zero retail, no type).

> **Question 8**: "How profitable is Adam as a customer for us?"
>
> _Expected AI behaviour_: Call `getCustomerProfitability`. Present revenue, cost, profit, and margin in a business-friendly format. Contextualise: "Adam generated $11.74 revenue against $11.55 cost — a 1.6% margin, which is low."

**Pass criteria for the full sequence:**
- AI never asks "which tool should I use?" — it figures it out
- Customer ID from Q1 is reused throughout without re-asking
- Failed call reasons are explained in plain English, not SIP jargon
- Documentation is fetched and summarised, not just linked
- Profitability numbers are contextualised (good/bad/average)
- The entire conversation feels like talking to a knowledgeable support agent

---

### Expert User Sequence (VoIP Engineer / Technical Integrator)

Use these questions exactly as written — one at a time, in order. The user knows SIP, understands routing, and expects precise technical data.

**Scenario**: A senior engineer is investigating intermittent one-way audio and poor MOS scores on calls to UK mobile numbers for a specific customer.

> **Question 1**: "Pull the last 5 CDRs for customer 105979 where the destination starts with 44. I need the call IDs, durations, and which carrier handled each call."
>
> _Expected AI behaviour_: Call `searchCdr` with customer_id 105979 and a recent date range, limit 5. Filter or highlight records with dest_number starting with "44". Present callid, duration, provider_id, and charges in a structured table.

> **Question 2**: "Run a full investigation on [callid from Q1]. I want the SIP trace, RTCP quality, and Class 5 status."
>
> _Expected AI behaviour_: Call `investigateCall` with both callid and callidb (extracted from Q1 data or from `searchCallLogs`). Present call_type, trace availability, RTCP availability, and any issues found. If trace is available, highlight the SIP flow (INVITE → response codes → BYE). If RTCP data exists, show MOS, jitter, packet loss, RTT.

> **Question 3**: "What does the routing engine log show for that call? I want to see the egress route selection, which provider cards were tried, and the ScriptForge execution time."
>
> _Expected AI behaviour_: Call `searchCallLogs` with the callid. Extract from the routing object: `egress_routing` array (which carriers, their rates, RTP server IDs), `card_rev`, `profile` timings (auth ms, ingress ms, total ms), `scriptForgeId`, `sandbox_time`. Present these as structured technical output.

> **Question 4**: "Show me Adam's rate card for UK destinations. What's the per-minute rate to UK mobile prefixes like 447?"
>
> _Expected AI behaviour_: Call `getCustomerRateCards` for 105979. Identify the card used for UK traffic (likely "UK LL & Mobile", card_id `GjjS-E0FO`). Then call `getRateCardDetails` to get `active_rev`. Then call `getRateCardRules` with a prefix filter. Find rules matching "447" prefixes and present the cost, pulse, MCD.

> **Question 5**: "Which RTP server groups are available in Europe? If I'm routing UK calls, which zone should I use for lowest latency?"
>
> _Expected AI behaviour_: Call `getRtpServerGroups`. Filter to European zones (UK London, Europe Amsterdam, Europe Frankfurt, etc.). Recommend UK London for UK-destined calls with reasoning about proximity. Optionally call `listRtpServers` to show specific server IPs in that zone.

> **Question 6**: "Compare Adam's profitability on UK destinations versus his overall profitability. Is he profitable on UK traffic specifically?"
>
> _Expected AI behaviour_: Call both `getCustomerProfitability` (overall) and `getCustomerDestinationStatistics` (destination breakdown). Compare the UK-specific ASR, ACD, and profit margin against the overall numbers. Flag if UK traffic is loss-making despite overall profitability.

> **Question 7**: "I'm seeing one-way audio issues. Find me the ConnexCS documentation on media troubleshooting — specifically the section about NAT and SDP body analysis."
>
> _Expected AI behaviour_: Call `searchDocumentation` with "media troubleshooting NAT one-way audio". Then `getDocumentation` on `guides/tshoot-media`. Extract and present the specific sections about checking SDP body for codecs and NAT, checking firewalls, and the media zone recommendations. Should reference the echo test setup as an additional diagnostic.

> **Question 8**: "Give me a full diagnostic summary: Adam's account health, call success rate on UK mobile, quality metrics if available, routing efficiency, and whether his rate card pricing leaves room for margin on UK routes."
>
> _Expected AI behaviour_: This is the stress test. The AI must synthesise data from multiple tools without being told which ones. It should call some combination of: `searchCustomers` (account status), `getCustomerBalance` (financial health), `getCallAnalytics` (success rates), `getCustomerProfitability` (margins), `getCustomerDestinationStatistics` (UK-specific performance), `getRateCardRules` (pricing on 447 prefixes). The response should be a structured diagnostic report with clear sections, not a data dump.

**Pass criteria for the full sequence:**
- AI provides raw data AND interpretation — not just numbers
- SIP response codes are correct and match the actual trace
- Rate card pricing is extracted for the correct prefix (447, not just 44)
- RTP zone recommendation is technically sound (proximity-based)
- The Q8 synthesis pulls from 4+ tools and produces a coherent narrative
- Routing log details (egress selection, ScriptForge timing) are presented accurately
- The AI never confuses `card_id` with routing row `id`
- Technical terminology is used correctly (MOS, PDD, ASR, ACD, RTCP)

---

### Adversarial / Edge Case Questions

These questions test how the AI handles uncertainty, missing data, and mistakes.

> **"Check the SIP trace for call ID abc123"**
>
> _Expected_: Gracefully reports no data found with suggestions (check ID, within 7 days, etc.) — not a crash or empty response.

> **"What's the balance for customer 999999999?"**
>
> _Expected_: Reports customer not found — does not fabricate data.

> **"Show me the rate for destination 999 on rate card XXXX-0000"**
>
> _Expected_: Reports rate card not found. Does not guess or hallucinate pricing.

> **"My calls are choppy, fix it"**
>
> _Expected_: Asks which customer or call ID, then finds relevant documentation on media troubleshooting. Does not claim to "fix" anything directly — explains diagnostic steps.

> **"Compare the profitability of all my customers and rank them"**
>
> _Expected_: Calls `listCustomersByProfitability`. Presents a ranked table. Does not need to be told the tool name.

> **"Is the platform having issues right now?"**
>
> _Expected_: The MCP server does NOT have a status page tool. The AI should acknowledge this limitation and direct the user to status.connexcs.com. Bonus if it pulls the `searchDocumentation` for status page info.
