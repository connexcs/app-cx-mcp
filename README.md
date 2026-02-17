# ConnexCS MCP App
Extendable MCP Server for ConnexCS Application Platform

## Overview

This repository contains MCP (Model Context Protocol) servers for ConnexCS, enabling AI assistants like GitHub Copilot to directly access ConnexCS call debugging, analytics, and customer management tools.

## Installing the MCP Server in VS Code

Follow these steps to configure the ConnexCS MCP server in any VS Code workspace:

### Step 1: Create the `.vscode` Folder

In your workspace root (the main folder of your project), create a `.vscode` folder if it doesn't already exist:

```bash
mkdir .vscode
```

Or create it manually in your file explorer.

### Step 2: Create the `mcp.json` File

Inside the `.vscode` folder, create a new file named `mcp.json`:

```bash
# Windows PowerShell
New-Item -Path .vscode\mcp.json -ItemType File

# Mac/Linux
touch .vscode/mcp.json
```

Or create it manually in your code editor.

### Step 3: Add the Configuration

Copy and paste the following content into `.vscode/mcp.json`:

```json
{
	"servers": {
		"connexcs-call-debug": {
			"url": "https://fr1dev1.connexcs.net/api/cp/scriptforge/8362/run",
			"type": "http",
			"headers": {
				"Authorization": "Bearer YourJWTTokenHere"
			}
		}
	},
	"inputs": []
}
```

### Step 4: Add `mcp.json` to `.gitignore`

> **⚠️ IMPORTANT: Do this immediately before adding your token!**

The `mcp.json` file will contain a JWT token, which is a **sensitive credential**. If committed to version control, anyone with access to the repository can use your token to access your ConnexCS account.

Open or create a `.gitignore` file in your workspace root and add:

```gitignore
.vscode/mcp.json
```

This ensures your token is never accidentally pushed to a remote repository. **Do not skip this step.**

### Step 5: Get Your JWT Access Token

You need a JWT **Access Token** from the ConnexCS Control Panel:

1. Log in to the ConnexCS Control Panel
2. In the left sidebar, navigate to **Setup** → **Integrations** → **JWT Keys**
3. Click the **`+`** button to open the **Add JWT** dialog
4. Fill in the fields:
   - **Audience**: Enter a descriptive name (e.g., `mcp-server`)
   - **Type**: Click the dropdown and change it from "Refresh Token" to **Access Token**
   - **Lifetime**: Select the token duration (e.g., `1 Month`)
5. Click **Save**
6. Copy the generated Access Token

### Step 6: Update the Token in `mcp.json`

In the `.vscode/mcp.json` file, replace `YourJWTTokenHere` with the Access Token you copied from the Control Panel.

The token goes after `Bearer ` (with a space) in the `Authorization` header:

```
"Authorization": "Bearer <paste-your-access-token-here>"
```

Make sure there is a single space between `Bearer` and your token.

> **🔒 Reminder**: Your `mcp.json` now contains a live credential. Make sure you completed [Step 4](#step-4-add-mcpjson-to-gitignore) and added `.vscode/mcp.json` to your `.gitignore`. Never share this file or commit it to version control. Treat this token like a password.

### Step 7: (Optional) Use a Custom ScriptForge App

If you have deployed your own custom MCP server to ScriptForge, you can change the app ID in the URL.

In the URL: `https://fr1dev1.connexcs.net/api/cp/scriptforge/8362/run`

Replace `8362` with your ScriptForge app ID. You can find your app ID in:
- ConnexCS Control Panel → **IDE** → **Apps**

Example with custom app ID `9999`:
```json
"url": "https://fr1dev1.connexcs.net/api/cp/scriptforge/9999/run"
```

### Step 8: Start the MCP Server

After saving `mcp.json`, you need to start the MCP server in VS Code:

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to open the Command Palette
2. Type **"MCP: List Servers"** and select it
3. Find **connexcs-call-debug** in the list
4. Click **Start** (or **Restart** if it was already running)

The server status should change to indicate it is running.

> **Tip**: If you ever update the token or URL in `mcp.json`, repeat these steps and select **Restart** to apply the changes.

### Step 9: Verify Installation

Test if the MCP server is working by asking GitHub Copilot:

```
"Are there any calls in my ConnexCS switch today?"
```

or

```
"Search for customer named Adam in ConnexCS"
```

If configured correctly, Copilot will be able to query your ConnexCS switch and return real data.

## Available MCP Tools

Once installed, you can ask GitHub Copilot to:

- **investigate_call** - Full call analysis with SIP trace, Class 5 logs, and RTCP quality
- **get_sip_trace** - Detailed SIP message trace
- **get_call_quality** - RTCP quality metrics (MOS, jitter, packet loss)
- **search_cdr** - Search Call Detail Records
- **get_call_analytics** - Call analytics and statistics
- **search_customers** - Search customers by ID, name, SIP user, or IP
- **list_rtp_servers** - List RTP media servers
- **list_rtp_server_groups** - List RTP server groups
- **get_ai_agent_logs** - AI Agent interaction logs
- **get_transcription** - Call transcription data
- And more...

### Example Questions

```
"Investigate call with ID abc123"
"Show me call statistics for the last 7 days"
"Find customer with ID 12345"
"Search CDR for calls from CLI 1234567890"
"List all RTP servers in Europe"
"Get call quality metrics for call xyz789"
```

## Troubleshooting

### MCP Server Not Appearing

- Verify `.vscode/mcp.json` exists and is valid JSON
- Check that the file is in the workspace root's `.vscode` folder
- Restart VS Code completely (close and reopen, don't just reload)

### "Unauthorized" or 401 Errors

This means your JWT Access Token has expired or is invalid. Repeat [Step 5](#step-5-get-your-jwt-access-token) to generate a new Access Token, then [Step 6](#step-6-update-the-token-in-mcpjson) to update it in `mcp.json`, and [Step 8](#step-8-start-the-mcp-server) to restart the server.

### Wrong Server or "Could Not Connect"

Check that:
- The URL in `mcp.json` matches your ConnexCS server
- The ScriptForge app ID (e.g., `8362`) is correct
- The MCP server is deployed to ScriptForge

### Tools Not Appearing or Disabled

If some tools are not showing up or appear disabled:

1. Open the **Copilot Chat** panel
2. Click the **Tools** icon (wrench/hammer) at the bottom of the chat input
3. Search for the tool name and ensure it is toggled on
4. If tools are still missing, restart the MCP server using [Step 8](#step-8-start-the-mcp-server)

## License

Proprietary - ConnexCS Ltd.
