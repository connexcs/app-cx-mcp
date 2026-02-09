# ConnexCS Call Debug — MCP Server Instructions

## Overview

This MCP server provides call debugging tools for the ConnexCS platform. Call debugging is done entirely through **logging endpoints** — not via CDR database queries. The logging system captures real-time call attempts, SIP traces, routing status, and supplementary call data.

When a call hits the ConnexCS system, it appears in the Logging area. The majority of issue debugging takes place here.

### Why Logging?
- **Efficient Debugging**: Helps identify and resolve system issues quickly
- **Call Flow Analysis**: Tracks call routing and detects irregularities
- **Security Monitoring**: Logs unauthorized access attempts and suspicious activities
- **Performance Optimization**: Provides insights into system performance and helps fine-tune configurations
- **Regulatory Compliance**: Maintains records for audits and compliance requirements

---

## What is a Call-ID?

A Call-ID is a unique identifier automatically generated for every call. It is assigned at the origination point when the call is placed and is present in every SIP packet sent or received.

**Topology Hiding**: ConnexCS uses Topology Hiding which obscures specific infrastructure information for security. This means the **outgoing Call-ID is different from the incoming Call-ID**.

### Locating a Call-ID
1. Extract from the log file of the hardphone / softphone / dialler (may need verbose logging enabled)
2. Use tools such as `wireshark`, `tshark`, `tcpdump`, or `sngrep` to inspect traffic in transit
3. Search on the ConnexCS Logging page by destination number, origination number, date/time, or IP address

### If a call is not found in logging:
- The IP address may be blocked in the firewall (check Setup > Advanced > Firewall)
- The call may not be reaching the ConnexCS platform (request a pcap from the sender)
- If both above are ruled out, it may be a platform fault

---

## Searching the Logs

Logs can be searched by:
- **Phone number** (source or destination)
- **Call ID** (exact match)
- **IP address**

### Call ID Detail View

When clicking on a specific Call ID, the following information is available:

- **Call Details** (initial screen): Routing Status, Authentication, Induced PDD (Post-Dial Delay), RTP information, Routing Engine ID, DTMF data, and more
- **Providers**: Which carriers/providers were involved in routing
- **Billing**: Billing details for the call
- **Graphs**: RTT (Round Trip Time), MOS, Jitter, Packet Loss — only shown if the call experienced these issues
- **Logs**: Raw log entries
- **Raw Data**: The underlying data that populates the call view
- **SIP Trace**: Visual representation of SIP communications (see SIP Traces section)
- **Simulate**: Re-run the call routing to test fixes (simulated Call IDs begin with `SIM`)
- **Class5**: Extra information if the call used Class 5 features (IVR, queues, etc.)

### Compare Call IDs

You can compare two or more Call IDs side-by-side to identify differences in: switch, user agent, start time, CLI, end time, protocol, SIP code, SIP reason, port number, etc. This is useful for diagnosing issues by comparing successful vs failed calls.

---

## API Base URL

All logging endpoints are accessed via the ConnexCS Control Panel API:

```
https://app.connexcs.com/api/cp/
```

Authentication is handled via `cxRest.auth(API_USERNAME)`.

---

## Core Logging Endpoints

### 1. SIP Trace (Primary — Always Present)

```
GET log/trace?callid={callid}&callidb={callidb}
```

**This is the most important endpoint.** Every call that hits the system will have trace data. The trace returns an array of SIP messages in chronological order, each containing:

| Field              | Description                                         |
|--------------------|-----------------------------------------------------|
| `id`               | Unique packet ID                                    |
| `date`             | Timestamp of the SIP message (ISO 8601)             |
| `micro_ts`         | Microsecond-precision timestamp                     |
| `callid`           | SIP Call-ID header value                            |
| `method`           | SIP method (`INVITE`, `ACK`, `BYE`) or response code (`100`, `180`, `200`, `407`, etc.) |
| `reply_reason`     | Reason phrase for SIP responses (e.g. `Trying`, `Ringing`, `Proxy Authentication Required`) |
| `ruri`             | Request-URI                                         |
| `ruri_user`        | User portion of the Request-URI                     |
| `to_user`          | To header user (typically the called number)        |
| `from_user`        | From header user (typically the caller number)      |
| `user_agent`       | User-Agent header value                             |
| `source_ip`        | IP address the packet was sent from                 |
| `source_port`      | Source port                                         |
| `destination_ip`   | IP address the packet was sent to                   |
| `destination_port` | Destination port                                    |
| `protocol`         | Transport protocol (`UDP`, `TCP`, `TLS`)            |
| `msg`              | Full raw SIP message text                           |
| `delta`            | Time delta (microseconds) from the previous message |

**Key analysis points from trace data:**
- The SIP call flow: INVITE → 100 Trying → 180 Ringing → 200 OK → ACK → BYE → 200 OK
- Authentication flows: 407 Proxy Authentication Required followed by re-INVITE with credentials
- Call failure reasons from SIP response codes (e.g. 403 Forbidden, 404 Not Found, 486 Busy, 503 Service Unavailable)
- Post-Dial Delay (PDD): time between INVITE and first 180/183 response
- Call setup time: time between INVITE and 200 OK
- NAT detection: via `X-CX-NAT` and `X-Orig-IP` headers in the SIP message
- AnyEdge routing: via `X-AnyEdge-Host` header
- Re-transmissions: duplicate packets that indicate network issues (UDP only)
- SDP body analysis: check for compatible codecs and NAT issues (one-way audio diagnosis)
- STIR/SHAKEN: If calls are signed using a SHAKEN certificate, the INVITE packet's Identity header can be decoded to show Algorithm, Public Certificate URL, Attestation Level, Dialled Number, CLI, Unique Customer ID, Timestamp

**SIP Trace Known Limitations:**
- **Missing SIP data**: SIP packets are carried by UDP which may cause traces to be lossy. Less than 1 in 50,000 calls affected.
- **Missed call attempts**: With SIP authentication, two requests occur and may hit the database out of order, causing only the first attempt to display.
- **Re-transmissions**: Same INVITE transmitted more than once. Only happens on UDP when packets don't reach the receiver or get lost. Re-transmitted packets are absorbed by the receiver within a timer window.

**SIP Terminology (from trace analysis):**
- **Message**: Each individual SIP line (INVITE, 100, 180, 200, ACK, BYE)
- **Transaction**: A request and its responses (e.g. INVITE through ACK = one transaction; BYE and its 200 OK = another transaction)
- **Dialog**: The entire conversation from first INVITE to final 200 OK for BYE

### 2. RTP Server Groups

```
GET setup/server/rtp-group
```

Returns a list of available RTP (Real-time Transport Protocol) server groups/zones. This is a reference endpoint used to understand where media is being routed.

ConnexCS lets you route media through a global array of dedicated media servers. Each regional zone encompasses several servers for high availability. These servers operate independently of your SIP server (e.g. your SIP server could be in London while media routes through New York). **Choose a media server that adds the least latency** — if your customer is in Bangalore and your carrier is in New York, use either Bangalore or New York as the media proxy.

Each group contains:

| Field                 | Description                                    |
|-----------------------|------------------------------------------------|
| `id`                  | Group ID                                       |
| `name`                | Human-readable name (e.g. "UK (London)", "USA East (New York)") |
| `status`              | Active status (1 = active)                     |
| `alt`                 | Alternate group ID for failover                |
| `transcoding`         | Whether transcoding is enabled                 |
| `location`            | Short location code (e.g. `lon`, `ams`, `nyc`, `sfo`, `fra`, `sgp`, `blr`) |
| `elastic`             | Whether this is a dynamic/elastic group (1 = yes) |
| `max_server_per_sip`  | Max servers per SIP session (0 = unlimited)    |

### 3. Class 5 Logs (Optional — Present for Class 5 Calls Only)

```
GET log/class5?callid={callid}
```

Returns Class 5 call details. **Only contains data if the call used Class 5 features.** An empty array means the call was purely Class 4.

Class 5 calls can include:
- **IVR** (Interactive Voice Response) — automated menus with DTMF input
- **Conference calling** — multi-party calls
- **Call queuing / Call Center** — waiting queues with agents
- **Groups** — ring groups, hunt groups
- **Voicemail**
- **AI Agent** interactions
- **Apps** (custom ConnexCS applications built via the App/IDE system)
- **ConneXML** — programmable call flows

**Note on DTMF**: DTMF (Dual-Tone Multi-Frequency) is used between the customer's phone and their SIP device. DTMF is only relevant when communicating with ConnexCS while using Class 5 features such as IVR, conferencing, or voicemail.

### 4. Transcription (Optional)

```
GET transcribe?s={callid}
```

Returns call transcription data. **Only returns data if transcription was enabled for the call.** An empty array means no transcription was active.

### 5. AI Agent Logs (Optional)

```
GET log/ai-agent?callid={callid}&d={date}
```

Where `d` is the date in `YYYY-MM-DD` format.

Returns AI Agent interaction logs for the call. **Only returns data if an AI Agent was handling the call.** An empty array means no AI Agent was involved.

### 6. RTCP Quality Data (Optional)

```
GET log/rtcp?callid={callid}
```

Returns RTCP (Real-time Transport Control Protocol) quality metrics for the call. **Only returns data if RTCP was exchanged during the call.** RTCP doesn't carry actual audio payload but reports on media quality statistics. This gives insight into:
- Round Trip Time (RTT)
- MOS (Mean Opinion Score) — call quality rating
- Jitter — variation in packet delivery time
- Packet Loss — percentage of lost media packets

An empty array means no RTCP data was captured for this call.

**To get RTCP data**: RTCP must be enabled on both the customer and carrier side. When enabled, metadata about the RTP stream (packet counters, round trip time) is exchanged. The graphs generated from this data help identify quality problems.

---

## Call Types

### Class 4 Calls
Simple point-to-point communication. The call goes from origin (A) to destination (B) through the ConnexCS switch. These calls will have:
- ✅ Trace data (always)
- ✅ RTCP data (if available)
- ❌ No Class 5 data
- ❌ Typically no transcription or AI agent data (unless specifically configured on the routing)

### Class 5 Calls
Calls with enhanced/special capabilities. These pass through the Class 5 system and may involve:
- ✅ Trace data (always)
- ✅ Class 5 logs (IVR menus, conference bridges, queue data, etc.)
- ✅ RTCP data (if available)
- ✅ Transcription data (if enabled)
- ✅ AI Agent data (if AI agent was handling the call)

**How to determine call type:** Query the `log/class5` endpoint. If it returns data, the call is Class 5. If empty, it's Class 4.

---

## Deprecated Endpoints

- **`c4log`** — This is the outdated version. **Do NOT use it.** Use the endpoints above instead.

---

## Call Debug Workflow

When debugging a call, follow this sequence:

1. **Get the Call ID** — Either from logging search or from a user report. Search by phone number, Call-ID, or IP address.
2. **Fetch SIP Trace** (`log/trace`) — This is always the first step. Analyze the SIP flow to understand what happened:
   - Did the call connect? (Look for 200 OK after INVITE)
   - Was there an authentication challenge? (407 response followed by re-INVITE with credentials)
   - What was the failure code? (4xx, 5xx responses)
   - What was the Post-Dial Delay (PDD)? Time between INVITE and 180/183
   - Were there re-transmissions? (duplicate packets indicating network issues)
   - Check SDP body for codec compatibility and NAT issues (one-way audio)
   - Check `X-CX-NAT`, `X-Orig-IP`, `X-AnyEdge-Host` headers for routing context
3. **Check Class 5 data** (`log/class5`) — Determine if this was a Class 5 call with special features (IVR, conference, queue, etc.)
4. **Check RTCP quality** (`log/rtcp`) — If the call connected, check media quality metrics (RTT, MOS, Jitter, Packet Loss)
5. **Check transcription** (`transcribe`) — If transcription is relevant to the investigation
6. **Check AI Agent** (`log/ai-agent`) — If the call may have involved an AI agent
7. **Reference RTP Groups** (`setup/server/rtp-group`) — To understand media routing zones and check if the media server location is optimal

### Troubleshooting Decision Tree

**Call won't connect?**
1. Check [Status Page](https://status.connexcs.com/) for known issues
2. Check Register Logging if it's a registration issue
3. Get the SIP trace and analyze the error code
4. If call not found in logging: check firewall, verify call is reaching the platform

**Call quality issues (choppy audio, echo, one-way audio, static)?**
1. Check SDP body in the INVITE for codec compatibility and NAT issues
2. Check firewalls — media doesn't flow through the same server as SIP
3. Verify media zone is optimal (close to customer or carrier)
4. Try changing the media zone (Customer > Routing > Media > Media Proxy)
5. Try media direct mode (bypass ConnexCS media servers) — if issue persists, it's customer/carrier/far-end
6. Check RTCP metrics for packet loss, jitter, RTT

**Call disconnects unexpectedly?**
1. Check for MI Termination (no audio detected — system sent BYE on both sides)
2. Check for Ping Timeout (SIP Ping enabled, party failed to respond to OPTIONS)
3. Check for maintenance issues (registration drops)

**Warning about NAT and Direct Media**: If a customer or carrier is behind NAT and you change media to Direct, ConnexCS won't be able to perform Far-End-NAT Traversal, which may make the problem worse. Also, sending media direct exposes carrier identity to customer and vice versa.

---

## SIP Response Code Reference

### 1xx — Provisional Responses
| Code | Meaning           | Detail                                           |
|------|-------------------|--------------------------------------------------|
| 100  | Trying            | Request is being processed                       |
| 180  | Ringing           | Destination is alerting the user                 |
| 183  | Session Progress  | Early media / call progress info                 |

### 2xx — Success
| Code | Meaning | Detail                  |
|------|---------|-------------------------|
| 200  | OK      | Call connected / request successful |

### 3xx — Redirection
| Code | Meaning           | Detail                           |
|------|--------------------|----------------------------------|
| 302  | Moved Temporarily  | Call being redirected             |

### 4xx — Client Errors
| Code | Meaning                          | Detail                                |
|------|----------------------------------|---------------------------------------|
| 400  | Bad Request                      | Malformed SIP message                 |
| 401  | Unauthorized                     | Authentication required               |
| 403  | Forbidden                        | Caller not allowed                    |
| 404  | Not Found                        | Destination doesn't exist             |
| 407  | Proxy Authentication Required    | Proxy auth challenge (common flow)    |
| 408  | Request Timeout                  | No response from destination          |
| 480  | Temporarily Unavailable          | Callee currently unavailable          |
| 486  | Busy Here                        | Destination is busy                   |
| 487  | Request Terminated               | Call cancelled by caller              |
| 488  | Not Acceptable Here              | Codec/media negotiation failure       |

### 5xx — Server Errors
| Code | Meaning                   | Detail                              |
|------|---------------------------|-------------------------------------|
| 500  | Server Internal Error     | Internal server problem             |
| 502  | Bad Gateway               | Upstream/carrier error              |
| 503  | Service Unavailable       | Server overloaded or maintenance    |

---

## Call Release Reasons

When a call disconnects, it can be due to:

1. **Downstream BYE** — Call disconnected from the originator's side (the caller hung up)
2. **Upstream BYE** — Call disconnected from the receiver's side (the callee hung up)
3. **MI Termination** — System terminated the call because no audio was detected between parties
4. **Ping Timeout** — If SIP Ping is enabled, and either party fails to respond to OPTIONS packets, the call terminates as inactive

---

## Key SIP Headers in ConnexCS

When analyzing the raw SIP `msg` field, look for these ConnexCS-specific headers:

| Header             | Description                                        |
|--------------------|----------------------------------------------------|
| `X-CX-NAT`        | Whether NAT was detected (`true`/`false`)          |
| `X-AnyEdge-Host`  | Which AnyEdge node handled the call                |
| `X-Orig-IP`       | Original source IP (before NAT/proxy)              |
| `X-LB-SEC`        | Load balancer security hash                        |
| `X-NAT-IDX`       | NAT detection index and details                    |
| `X-Channel-Hint`  | Channel hint for internal routing                  |

### Understanding SIP and RTP Relationship

- **SIP** handles signaling: connection setup, maintenance, and tear-down. SIP packets hop from server to server (like email), with each server adding a `Via` header. SIP uses similar format and error codes to HTTP (e.g. 404, 408).
- **RTP** handles the actual audio payload. RTP sessions are set up directly between SIP clients (not through SIP proxies). RTP runs on UDP for high-speed delivery, with some packet loss mitigated by built-in correction mechanisms.
- **RTCP** is the control protocol for RTP — it reports on media quality (packet counters, RTT) but carries no audio data.
- **Media servers** (RTP proxies) are used when clients can't communicate directly (NAT scenarios). ConnexCS media servers operate independently from SIP servers and can be in different locations.

---

## SIP Signaling Phases

1. **Setup**: Process of connecting the call. Creates a path through telecom devices. Involves INVITE, authentication, routing decisions, and codec negotiation.
2. **Maintenance**: Once connected, SIP sends periodic registration messages to keep the call active. If using SIP Ping, OPTIONS packets are exchanged at intervals.
3. **Tear-Down**: Process of ending the call by closing the SIP session. BYE message is sent and acknowledged with 200 OK.

---

## Simulation

Simulating calls lets providers identify areas of concern or verify functionality by testing in different setups. Simulation parameters include:
- **Dialed Number**: Destination
- **CLI/ANI**: Origination number
- **Switch IP**: Where the call traverses
- **Customer IP**: Where the call originates
- **Registered User**: Optional SIP extension user
- **Routing Engine**: Regional zone

Simulated calls appear in logging with Call IDs beginning with `SIM`. After fixing a routing issue, you can re-simulate from within the Call ID to verify the fix.

---

## SIP Trace Retention

ConnexCS keeps a record of **every SIP packet sent and received** by your server over the **last seven (7) days**. Traces are always-on and require no additional configuration.

---

## Notes for Tool Development

- Always query `log/trace` first — it's the foundation of all call debugging
- Use the `callid` as the primary key to correlate data across all endpoints
- The `callidb` parameter on the trace endpoint is an encoded internal identifier
- For `log/ai-agent`, the `d` (date) parameter is required in `YYYY-MM-DD` format
- Empty arrays from optional endpoints are normal — they just mean that feature wasn't active for the call
- The `delta` field in trace results shows microsecond intervals between SIP messages, useful for diagnosing timing issues
- The `micro_ts` field provides microsecond precision for exact packet ordering
- When displaying trace data, present it as a call flow diagram (INVITE → responses → ACK → BYE) for clarity
- SIP traces are retained for **7 days** — older calls won't have trace data
- ConnexCS monitors 45+ metrics on 30+ RTP servers — check [status.connexcs.com](https://status.connexcs.com/) for known issues before deep debugging
- When analyzing one-way audio: check SDP body for codecs and NAT, check firewalls (media uses different servers than SIP), verify media zone proximity
- The call's **Routing Status**, **Authentication**, **Induced PDD**, **RTP info**, **Routing Engine ID**, and **DTMF** data are all available in the Call ID detail view
- For live calls, data must be refreshed as some processing happens through CDR before display
- **Billing info** and **Provider info** for a call are visible at the bottom of the Call ID detail view

### SIP Timer Reference (for re-transmission analysis)

| Timer   | Duration          | Purpose                                           |
|---------|-------------------|---------------------------------------------------|
| T1      | 500 ms            | Round-trip time (RTT) estimate                    |
| T2      | 4 sec             | Max retransmission interval for non-INVITE        |
| T4      | 5 sec             | Max duration a message can remain in the network  |
| Timer A | initially T1      | INVITE retransmission interval (UDP only)         |
| Timer B | 64*T1             | INVITE transaction timeout                        |
| Timer D | > 32 sec (UDP)    | Wait time for response retransmissions            |
| Timer E | initially T1      | Non-INVITE retransmission interval (UDP only)     |
| Timer F | 64*T1             | Non-INVITE transaction timeout                    |
| Timer G | initially T1      | INVITE response retransmission interval           |
| Timer H | 64*T1             | Wait time for ACK receipt                         |

Reference: [RFC 3261](https://www.ietf.org/rfc/rfc3261.txt)

### Documentation References

- [ConnexCS Logging](https://docs.connexcs.com/logging/)
- [Call-ID Guide](https://docs.connexcs.com/guides/howto/callid/)
- [Troubleshoot Signaling](https://docs.connexcs.com/guides/tshoot-signal/)
- [Troubleshoot Media](https://docs.connexcs.com/guides/tshoot-media/)
- [Call Disconnection Reasons](https://docs.connexcs.com/guides/call-disconnection-reasons/)
- [SIP Traces Guide](https://docs.connexcs.com/guides/sip-traces/)
- [NAT Traversal](https://docs.connexcs.com/far-end-nat-traversal/)
- [RTP Zones / Servers](https://docs.connexcs.com/setup/settings/servers/)
- [Class 5 Features](https://docs.connexcs.com/customer/class5/)
- [AI Agent](https://docs.connexcs.com/class5/ai-agent/)
- [IVR](https://docs.connexcs.com/class5/creating-ivr/)
- [Conference](https://docs.connexcs.com/class5/creating-conference/)
- [Call Center](https://docs.connexcs.com/class5/call-center/)
- [Transcription](https://docs.connexcs.com/transcription/)
- [STIR/SHAKEN](https://docs.connexcs.com/setup/information/stir-shaken/)
