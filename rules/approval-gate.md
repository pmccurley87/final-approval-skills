---
description: Require human approval before any irreversible action
alwaysApply: true
---

# Approval gate

Before performing any **irreversible or externally-visible action**, submit a FinalApproval request and wait for a human yes/no. Do not proceed until the approval resolves.

## Actions that require approval

- Production deploys, database migrations, schema changes
- Sending email, SMS, push notifications, or social media posts
- Paying money, issuing refunds, charging cards
- Deleting data (users, records, files, branches)
- Pushing to `main`, force-pushing any branch, tagging releases
- Publishing packages, creating external PRs, posting to public APIs
- Rotating credentials or changing access controls

## How to gate an action

If the project has a FinalApproval channel configured (look for `FINALAPPROVAL_API_KEY` in `.env`, or a `finalapproval` config block), use it. Otherwise, invoke the `create-channel` skill to set one up:

```
@create-channel <one-line description of the action to gate>
```

Example: `@create-channel production database migrations`

The skill will provision a channel, return an API key, and show you how to call `POST /api/v1/approvals` at the gate point in the code.

## At the gate point

1. Build an HTML body summarising what the agent is about to do (recipient + amount + preview for an email; service + commit + diff for a deploy).
2. `POST` it to `https://www.finalapproval.ai/api/v1/approvals` with the channel's API key.
3. Either wait for the webhook callback or poll `GET /api/v1/approvals/:id` until `status` is `approved` or `denied`.
4. Only execute the action on `approved`. On `denied`, surface the reason to the user and stop.

## What *not* to do

- Do not silently retry a denied approval with a tweaked request.
- Do not call the action first and "ask forgiveness later."
- Do not approve requests on the user's behalf, even if you are confident.

Humans approve from the dashboard at [finalapproval.ai](https://finalapproval.ai). The whole point is the human — don't route around them.
