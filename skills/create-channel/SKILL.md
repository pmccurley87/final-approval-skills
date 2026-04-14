---
name: create-channel
description: Create a FinalApproval channel to add human-in-the-loop approval to your AI agent workflows
argument-hint: <description of what needs approval, e.g. "email sending", "deployments", "billing charges">
---

# Create FinalApproval Channel

Wire human-in-the-loop approval into an agent's action. The end result: the agent's code submits a request, a human approves or denies in the dashboard, and the webhook fires back into the agent's code to execute or abort.

## Steps

### 1. Understand the action being gated

Ask the developer: **what action needs human approval before it runs?**

Identify:
- **The action** — what happens after approval (send email, deploy, charge card, publish post)
- **The data** — what runtime values describe the action (recipient, amount, content, etc.)
- **The trigger** — where in the codebase the action is initiated (an API route, a cron job, a queue consumer, an agent tool call)

Common examples:
- Send email → recipient, subject, body, priority
- Deploy to production → service, environment, commit, diff
- Charge customer → customer, amount, currency, description
- Post to social media → platform, content, images, schedule

### 2. Authenticate (device flow)

The rest of this skill needs a bearer token. Tokens are stored at `~/.finalapproval/token.json`.

The default host is `https://www.finalapproval.ai`. Override with `FINALAPPROVAL_URL` (e.g. `http://localhost:3001` for local dev).

**2a. Check for an existing session:**

```bash
FINALAPPROVAL_URL="${FINALAPPROVAL_URL:-https://www.finalapproval.ai}"

if [ -f ~/.finalapproval/token.json ]; then
  TOKEN=$(jq -r .token ~/.finalapproval/token.json)
  # Verify it still works
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$FINALAPPROVAL_URL/api/channels")
  [ "$STATUS" = "200" ] && echo "session ok" || rm ~/.finalapproval/token.json
fi
```

If the file is missing, invalid, or the verify call returns 401, continue to 2b.

**2b. Request a device code:**

Better Auth exposes an OAuth 2.0 device-authorization flow under `/api/auth/device/*`.

```bash
ORIGIN="$FINALAPPROVAL_URL"  # Better Auth requires an Origin header

RESP=$(curl -s -X POST "$FINALAPPROVAL_URL/api/auth/device/code" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"client_id":"finalapproval-cli"}')

DEVICE_CODE=$(echo "$RESP" | jq -r .device_code)
URL=$(echo "$RESP" | jq -r .verification_uri_complete)
INTERVAL=$(echo "$RESP" | jq -r .interval)
```

Show the developer `$URL` and ask them to open it in a browser. They'll sign in if needed, then click "Approve and connect".

**2c. Poll for the token:**

```bash
while true; do
  RESP=$(curl -s -X POST "$FINALAPPROVAL_URL/api/auth/device/token" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d "{
      \"grant_type\":\"urn:ietf:params:oauth:grant-type:device_code\",
      \"device_code\":\"$DEVICE_CODE\",
      \"client_id\":\"finalapproval-cli\"
    }")

  ERR=$(echo "$RESP" | jq -r '.error // empty')
  case "$ERR" in
    authorization_pending) sleep "$INTERVAL" ;;
    slow_down)             INTERVAL=$((INTERVAL * 2)); sleep "$INTERVAL" ;;
    expired_token|access_denied)
      echo "Device code $ERR — ask the developer to retry."; exit 1 ;;
    "")
      TOKEN=$(echo "$RESP" | jq -r .access_token)
      mkdir -p ~/.finalapproval
      echo "{\"token\":\"$TOKEN\"}" > ~/.finalapproval/token.json
      chmod 600 ~/.finalapproval/token.json
      break ;;
    *)
      echo "Unexpected error: $ERR"; exit 1 ;;
  esac
done
```

All future API calls in this skill use `Authorization: Bearer $TOKEN`.

### 3. Create the channel

If the developer already knows their webhook URL, include it now. Otherwise, skip it — webhooks can be added later from the channel settings page.

```bash
TOKEN=$(jq -r .token ~/.finalapproval/token.json)

curl -s -X POST "$FINALAPPROVAL_URL/api/channels" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Send Email",
    "description": "Approve outgoing emails before sending",
    "webhook_url": "https://your-server.com/webhooks/finalapproval"
  }'
```

Response includes:
- `api_key` (`fa_...`) — for submitting approvals. **Shown once.**
- `webhook_secret` (`whsec_...`) — for verifying webhook signatures. Only returned when `webhook_url` is provided. **Shown once.**

### 4. Save channel credentials

The bearer token already lives at `~/.finalapproval/token.json`. The channel-scoped `fa_` key and webhook secret belong in the **project's** `.env`:

Check the developer's `.env` first — they may already have `FINALAPPROVAL_API_KEY` from a previous channel. Each channel gets its own key, so use a channel-specific name if multiple channels exist (e.g. `FINALAPPROVAL_EMAIL_API_KEY`).

Add any new credentials:

```
FINALAPPROVAL_API_KEY=fa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FINALAPPROVAL_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The webhook secret is only present if a webhook URL was provided in step 3. If not, skip it — it will be generated when the developer adds a webhook later via channel settings.

Both credentials are shown once and cannot be retrieved again. If lost, the API key requires creating a new channel; the webhook secret can be regenerated by updating the webhook URL in channel settings.

### 5. Build the approval submission function

This is the core integration. Create a single function that:
1. Builds a consistent HTML body from the action's runtime data
2. Includes the structured data for programmatic use in the webhook
3. Posts to the FinalApproval API

**The HTML body is a template defined once in code.** Every approval in this channel will look the same — only the data values change. Design the template for the specific use case identified in step 1.

```typescript
// lib/approval.ts — or wherever makes sense in the project

interface EmailApprovalData {
  recipient: string;
  subject: string;
  body: string;
  priority: "low" | "normal" | "high";
}

async function submitForApproval(data: EmailApprovalData): Promise<string> {
  const priorityColors = {
    low: { bg: "bg-gray-100", text: "text-gray-700" },
    normal: { bg: "bg-blue-100", text: "text-blue-700" },
    high: { bg: "bg-red-100", text: "text-red-700" },
  };
  const pc = priorityColors[data.priority];

  const htmlBody = `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border p-3">
          <p class="text-xs text-gray-500">Recipient</p>
          <p class="font-semibold">${data.recipient}</p>
        </div>
        <div class="rounded-lg border p-3">
          <p class="text-xs text-gray-500">Priority</p>
          <span class="inline-flex items-center rounded-full ${pc.bg} px-2 py-1 text-xs font-medium ${pc.text}">${data.priority}</span>
        </div>
      </div>
      <div class="rounded-lg border p-3">
        <p class="text-xs text-gray-500 mb-1">Subject</p>
        <p class="font-medium">${data.subject}</p>
      </div>
      <details class="rounded-lg border">
        <summary class="cursor-pointer p-3 font-medium text-sm">Email Body Preview</summary>
        <div class="border-t p-3 text-sm text-gray-600">${data.body}</div>
      </details>
    </div>`;

  const baseUrl = process.env.FINALAPPROVAL_URL ?? "https://www.finalapproval.ai";
  const response = await fetch(`${baseUrl}/api/v1/approvals`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FINALAPPROVAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `Send email to ${data.recipient}`,
      body: htmlBody,
      data,
    }),
  });

  if (!response.ok) throw new Error("Failed to submit approval");
  const { id } = await response.json();
  return id; // "pending" — human reviews in dashboard
}
```

**Key rules:**
- `body` is the HTML template (what the human sees). `data` is structured JSON (what the webhook returns to your code). Always include both.
- The HTML body is sanitized by DOMPurify on the frontend. Only use allowed tags and attributes (see appendix).
- Design the template so a human can make a confident approve/deny decision from the rendered card alone.

#### Calling the function

At the point in the codebase where the action is triggered, replace the direct action with the approval submission:

```typescript
// Before: sendEmail(recipient, subject, body)
// After:
const approvalId = await submitForApproval({
  recipient,
  subject,
  body: emailBody,
  priority: "high",
});
// Action is now pending — human reviews in dashboard
// If a webhook is wired (step 6), it fires when the human decides
```

### 6. Wire up the webhook receiver (if webhook is configured)

**Skip this step if no webhook URL was set in step 3.** The developer can add one later from the channel's settings page in the dashboard, and come back to wire this up then. Without a webhook, the developer would poll `GET /api/v1/approvals/:id` or check the dashboard manually.

When a human approves or denies, FinalApproval POSTs the decision to the webhook URL. **This is where the gated action actually runs.**

First, search the codebase for existing webhook handlers:
- Look for routes like `/webhooks`, `/api/hooks`, or similar patterns
- Check for existing Express/Fastify/Next.js API routes that handle incoming POSTs
- If a handler exists, add a new route for FinalApproval alongside it

If no webhook infrastructure exists, scaffold a receiver:

```typescript
import crypto from "node:crypto";

// Signature verification — MUST be done before trusting the payload
function verifyWebhook(headers: Record<string, string>, body: string): boolean {
  const secret = process.env.FINALAPPROVAL_WEBHOOK_SECRET!;
  const signature = headers["x-finalapproval-signature-256"];
  const timestamp = headers["x-finalapproval-timestamp"];

  // Reject replays older than 5 minutes
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

// Webhook route
app.post("/webhooks/finalapproval", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = req.body.toString();

  if (!verifyWebhook(req.headers as Record<string, string>, rawBody)) {
    res.status(403).send("Invalid signature");
    return;
  }

  const { event, approval } = JSON.parse(rawBody);

  if (event === "approval.resolved") {
    if (approval.status === "approved") {
      // Execute the gated action using approval.data
      const { recipient, subject, body } = approval.data;
      sendEmail(recipient, subject, body); // <-- the action that was waiting
    } else {
      // Denied — log it, notify the agent, or take corrective action
      console.log(`Denied: ${approval.title}`);
      if (approval.denial_reason) {
        console.log(`Reason: ${approval.denial_reason}`);
      }
    }
  }

  res.status(200).send("ok");
});
```

**The webhook handler closes the loop.** The submission function (step 5) sends the request; the webhook handler (this step) receives the decision and runs the action. Both use `approval.data` as the shared contract — the structured JSON that carries the runtime values through the approval flow.

#### Webhook payload schema

```json
{
  "event": "approval.resolved",
  "timestamp": "2026-04-11T12:00:00.000Z",
  "approval": {
    "id": "uuid",
    "channel_id": "uuid",
    "title": "Send email to alice@example.com",
    "body": "<div class=\"space-y-3\">...</div>",
    "data": { "recipient": "alice@example.com", "subject": "...", "body": "..." },
    "status": "approved",
    "denial_reason": null,
    "created_at": "2026-04-11T11:55:00.000Z",
    "resolved_at": "2026-04-11T12:00:00.000Z",
    "resolved_by": "user_abc123"
  },
  "channel": { "id": "uuid", "name": "Send Email" }
}
```

Security headers on every delivery:
- `X-FinalApproval-Signature-256: sha256=<hmac_hex>` — HMAC-SHA256 of `timestamp.body`
- `X-FinalApproval-Timestamp: <unix_seconds>` — reject if older than 5 minutes

### 7. Verify the setup

Walk the developer through confirmation:

1. **Channel is live** — visible at the FinalApproval dashboard
2. **Submission works** — trigger the action in the codebase, confirm it appears as a pending approval in the dashboard
3. **Body renders correctly** — the HTML template displays the runtime data clearly in the approval card

If a webhook is configured, also verify:

4. **Webhook fires** — approve the request in the dashboard, confirm the webhook handler receives it and executes the action
5. **Denial works** — deny a request with a reason, confirm the handler receives `denial_reason` and handles it
6. **Test from settings** — open the channel settings in the dashboard and click "Test" to send a synthetic webhook delivery

If no webhook is configured yet, let the developer know they can add one later from channel settings. Until then, they can check approval status by polling or reviewing the dashboard.

If any step fails, check:
- `~/.finalapproval/token.json` exists and the token still works (re-run step 2 if not)
- `FINALAPPROVAL_API_KEY` is set in the project's `.env` (starts with `fa_`)
- Webhook URL is reachable from the FinalApproval server
- Webhook secret matches (regenerate by updating the webhook URL in channel settings)
- Signature verification uses the raw body string, not a re-serialized object

---

## Appendix: HTML Sanitization Rules

**Allowed tags:** `div`, `span`, `p`, `h1`-`h6`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `strong`, `em`, `small`, `code`, `pre`, `blockquote`, `a`, `br`, `hr`, `details`, `summary`, `img`, `figure`, `figcaption`

**Allowed attributes:** `class`, `href`, `src`, `alt`, `target`, `rel`, `loading`

**Images:** `src` must use `https://`. Other schemes (`http://`, `data:`, relative paths) are stripped at render time.

**Links:** Automatically get `target="_blank" rel="noopener noreferrer"`.

**Stripped silently:** `<script>`, `<iframe>`, `<form>`, `<input>`, `<video>`, `<svg>`, `style` attribute, `on*` handlers, `id`, `data-*`.
