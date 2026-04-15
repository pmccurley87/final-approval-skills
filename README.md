# FinalApproval Skills

**Human-in-the-loop approvals for AI agents.**
Before your agent does something irreversible, it asks. You approve from a dashboard, a webhook fires, the agent continues.

---

## Install

**Claude Code** (recommended)

```
/plugin marketplace add pmccurley87/final-approval-skills
/plugin install finalapproval@final-approval-skills
```

**Cursor, Windsurf, Codex — or any project**

```bash
npx final-approval-skills
```

Auto-detects your tool and installs in the right format. Add `--global` to install for all projects.

**Check for updates**

```bash
npx final-approval-skills --check
```

Re-run `npx final-approval-skills` to upgrade — it always fetches the latest.

---

## What the skill does

Describe the approval you need in one sentence. The skill provisions a FinalApproval channel — the dashboard, the API key, the optional webhook — and hands your agent the integration snippet.

| Tool          | Invoke                                         |
| ------------- | ---------------------------------------------- |
| Claude Code   | `/create-channel`                              |
| Cursor        | `@create-channel`                              |
| Windsurf      | `"create an approval channel for …"`           |
| Codex         | `$create-channel`                              |

---

## Docs & dashboard

- Dashboard: **[finalapproval.ai](https://finalapproval.ai)**
- Install guide: **[finalapproval.ai/install](https://finalapproval.ai/install)**
- Webhook verification (Node + Python drop-ins): in the dashboard under each channel

---

## Available skills

| Skill            | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `create-channel` | Create a FinalApproval channel to gate an agent action behind human approval              |

More coming — `approval-policy` (routing, auto-approve, multi-signer) is next.

---

## Contributing a skill

1. Fork this repo
2. Add `skills/<your-skill-name>/SKILL.md` with YAML frontmatter + instructions
3. (Optional) Add a `templates/` directory for template files
4. Open a PR

### SKILL.md format

```yaml
---
name: my-skill-name
description: Short description of what the skill does
argument-hint: [what arguments the skill accepts]
---

# Skill Title

Instructions for the AI to follow when this skill is invoked.
```

---

## License

MIT
