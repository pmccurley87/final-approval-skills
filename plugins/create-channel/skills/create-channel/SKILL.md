---
name: create-channel
description: Create a FinalApproval channel to add human-in-the-loop approval to your AI agent workflows
argument-hint: <description of what needs approval, e.g. "email sending", "deployments", "billing charges">
---

# Create FinalApproval Channel

Set up a human-in-the-loop approval channel so AI agent actions require human review before executing.

## Steps

### 1. Understand the use case

Ask the developer what action needs human approval. Common examples:
- **Send email** — recipient, subject, body preview
- **Deploy to production** — service, environment, commit hash, diff
- **Charge customer** — customer name, amount, description
- **Delete resource** — resource type, name, reason

### 2. Create the channel via API

The developer must be logged in. Use the dashboard UI at `http://localhost:5173/dashboard/channels/new` or call the API:

```bash
curl -X POST http://localhost:3001/api/channels \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{
    "name": "Send Email",
    "description": "Approve outgoing emails before sending"
  }'
```

The response includes a one-time **API key** (prefixed with `fa_`). Save this key immediately — it cannot be retrieved again.

### 3. Save the API key

Add the API key to the developer's `.env` file:

```
FINALAPPROVAL_API_KEY=fa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Design the approval body (HTML+Tailwind)

When submitting an approval, you craft the **body** as HTML with Tailwind CSS classes. This is what the human reviewer will see. Be creative — design a clear, scannable layout that helps the reviewer make a fast decision.

**Allowed HTML tags:** `div`, `span`, `p`, `h1`-`h6`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `code`, `pre`, `blockquote`, `strong`, `em`, `a`, `br`, `hr`, `details`, `summary`, `dl`, `dt`, `dd`, `small`

**Allowed attributes:** `class`, `href`, `target`, `rel`

**NOT allowed (stripped by sanitizer):** `<script>`, `<img>`, `<iframe>`, `<form>`, `<input>`, `style` attribute, `onclick`, `id`, `data-*`

Use Tailwind utility classes for all styling: `grid`, `flex`, `gap-*`, `p-*`, `rounded-*`, `bg-*`, `text-*`, `font-*`, `border`, etc.

#### Example: Email Approval

```html
<div class="space-y-3">
  <div class="grid grid-cols-2 gap-4">
    <div class="rounded-lg border p-3">
      <p class="text-xs text-gray-500">Recipient</p>
      <p class="font-semibold">alice@example.com</p>
    </div>
    <div class="rounded-lg border p-3 bg-red-50">
      <p class="text-xs text-gray-500">Priority</p>
      <span class="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">High</span>
    </div>
  </div>
  <div class="rounded-lg border p-3">
    <p class="text-xs text-gray-500 mb-1">Subject</p>
    <p class="font-medium">Welcome to our platform!</p>
  </div>
  <details class="rounded-lg border">
    <summary class="cursor-pointer p-3 font-medium text-sm">Email Body Preview</summary>
    <div class="border-t p-3 text-sm text-gray-600">
      Hello Alice, welcome to our platform. We're excited to have you on board.
    </div>
  </details>
</div>
```

#### Example: Deployment Approval

```html
<div class="space-y-3">
  <div class="grid grid-cols-3 gap-3">
    <div class="rounded-lg border p-3">
      <p class="text-xs text-gray-500">Service</p>
      <p class="font-mono font-semibold">api-gateway</p>
    </div>
    <div class="rounded-lg border p-3 bg-orange-50">
      <p class="text-xs text-gray-500">Environment</p>
      <span class="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">production</span>
    </div>
    <div class="rounded-lg border p-3">
      <p class="text-xs text-gray-500">Commit</p>
      <code class="text-xs">a1b2c3d</code>
    </div>
  </div>
  <div class="rounded-lg border p-3">
    <p class="text-xs text-gray-500 mb-2">Changes</p>
    <pre class="rounded bg-gray-50 p-2 text-xs font-mono overflow-x-auto">+ Added rate limiting to /api/v1/*
- Removed deprecated /api/legacy endpoint
  Modified health check timeout (30s → 60s)</pre>
  </div>
</div>
```

### 5. Add the approval call to the codebase

At the point where the action should be gated by human approval, POST to the API:

```typescript
const response = await fetch("http://localhost:3001/api/v1/approvals", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.FINALAPPROVAL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Send email to alice@example.com",
    body: `
      <div class="space-y-3">
        <div class="rounded-lg border p-3">
          <p class="text-xs text-gray-500">Recipient</p>
          <p class="font-semibold">${recipient}</p>
        </div>
        <div class="rounded-lg border p-3">
          <p class="text-xs text-gray-500">Subject</p>
          <p class="font-medium">${subject}</p>
        </div>
      </div>`,
    data: { recipient, subject, body: emailBody },
  }),
});

const { id, status } = await response.json();
// status = "pending" — human must approve in the dashboard
```

**Important:** The `body` field is the HTML display for the human reviewer. The `data` field is the structured JSON for programmatic use (webhooks, automation). Always include both.

### 6. Confirm setup

Tell the developer:
1. The channel is live at their FinalApproval dashboard
2. Approval requests appear there when the agent sends them
3. Each approval displays the rich HTML layout you designed
4. They can approve or deny each request from the dashboard
5. Webhook support for async approve/deny callbacks is coming soon
