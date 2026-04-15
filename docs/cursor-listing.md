# Cursor marketplace listing — copy

Paste-ready text for cursor.com/marketplace/publish. Keep this file in sync with `.cursor-plugin/plugin.json` — the manifest is the source of truth for name/version; this file is the human-facing copy.

---

## Name

FinalApproval

## Tagline (≤80 chars)

Human-in-the-loop approvals for AI agents

## Short description (≤200 chars)

Before your agent does something irreversible — a deploy, a payment, an email — it asks. You approve from a dashboard, a webhook fires, the agent continues.

## Long description

Agents are fast. Mistakes made at agent speed are expensive. FinalApproval gives you a one-line gate: your Cursor agent submits a request with a rich HTML body describing what it's about to do, and a human approves or denies from a dashboard.

**What you get when you install:**

- The `create-channel` skill — describe the action you want gated in one sentence, and it provisions a channel, API key, optional signed webhook, and returns the integration snippet for your codebase.
- An `approval-gate` rule — teaches the agent *when* to stop and ask. Covers deploys, migrations, sending messages, paying money, and destructive operations.
- Works alongside whatever your agent already does — you're adding a checkpoint, not replacing its workflow.

**Good fit for:**

- Agents that deploy, migrate databases, or run infra commands
- Agents that send email, DMs, or post to social
- Agents that spend money — refunds, charges, ad spend
- Any autonomous pipeline where one bad step is hard to roll back

**How it works in 30 seconds:**

1. `@create-channel production deploys` (or whatever you want gated)
2. The skill wires up a channel in your FinalApproval dashboard and prints the code snippet for the gate point
3. Paste the snippet, commit, done — next time your agent hits that code path, it waits for you

Dashboard: [finalapproval.ai](https://finalapproval.ai) · Docs: [finalapproval.ai/install](https://finalapproval.ai/install)

## Screenshots (checklist)

- [ ] Dashboard view — channels list with pending approvals
- [ ] Single approval card — rendered HTML body + Approve/Deny buttons
- [ ] Webhook receipt — delivery log showing signed POST + 200 response
- [ ] Skill catalog on /install — the `@create-channel` invoke in Cursor

## Preview image

1280×720. Source: reuse the `/designed-for-agents` landing hero from finalapproval.ai — already on-brand, already has the pitch text laid out.

## Icon

256×256 SVG. Use the FinalApproval wordmark/checkmark (same as favicon) on the warm-cream `#f2f1ed` background with `#f54e00` orange accent.

## Categories / tags

- agent-safety
- approval
- human-in-the-loop
- webhook
- review
- deploy-gate

## Post-publish checklist

- [ ] Add `?utm_source=cursor-marketplace` to the dashboard/install links above before pasting into the Cursor form
- [ ] Email 5 beta users with the listing URL and ask them to ★ it
- [ ] Tweet launch thread (problem → GIF → install → /install link)
- [ ] Publish blog post: "How to add a human approval step to your Cursor agent in 30 seconds"
