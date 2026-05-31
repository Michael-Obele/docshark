# DocShark Agent Skills

This repository ships two Agent Skills under `skills/`:

- `docshark` - Use DocShark MCP tools for documentation lookup and library management.
- `using-docshark` - Install, configure, and troubleshoot DocShark in local workflows.

## Standards Used

These skills follow the open Agent Skills specification used by the `skills` CLI and skills.sh:

- Spec: https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- CLI: https://www.npmjs.com/package/skills

## Required Skill Format

Each skill lives in its own directory and must include `SKILL.md` with YAML frontmatter:

```yaml
---
name: skill-name
description: What the skill does and when to use it.
---
```

Validation-critical rules:

- `name` must match the parent directory exactly.
- `name` must be lowercase letters, numbers, and hyphens only.
- `description` must be non-empty and explain both behavior and trigger context.
- Optional `allowed-tools` is experimental and, if used, should be a space-separated string.

## Local Validation

From repo root:

```bash
# Discover skills in this repo
npx skills add . --list

# Install one skill locally for testing
npx skills add . --skill docshark -y

# Install both skills locally for testing
npx skills add . --skill '*' -y
```

## Installation From GitHub

```bash
# Install specific skill
npx skills add Michael-Obele/docshark --skill docshark
npx skills add Michael-Obele/docshark --skill using-docshark

# List discoverable skills in the repo
npx skills add Michael-Obele/docshark --list
```

## skills.sh Discovery

There is no separate manual publish command in this workflow.

To be discoverable:

1. Keep the repo public.
2. Keep skill directories valid (`skills/<name>/SKILL.md` with valid frontmatter).
3. Install/share using `npx skills add owner/repo ...`.
4. Check listing on https://skills.sh/Michael-Obele/docshark.

As installs occur through the `skills` CLI, usage telemetry drives visibility/ranking on skills.sh.

## Directory Layout

```text
skills/
  docshark/
    SKILL.md
    evals/
    references/
  using-docshark/
    SKILL.md
    evals/
    references/
```
