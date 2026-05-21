# DocShark Agent Skills

This directory contains reusable Agent Skills for the DocShark documentation indexing and search system.

## Available Skills

### 1. `docshark`

**Search and manage documentation through DocShark MCP server**

- **Purpose**: Documentation lookup, discovery, and library management
- **Triggers**: Framework/library/API documentation questions, search, page retrieval
- **Tools Used**: `list_libraries`, `search_docs`, `get_doc_page`, `add_library`, `refresh_library`, `remove_library`
- **When to Use**:
  - User asks about any framework, library, or API documentation
  - Search results need full-page context
  - Documentation sources need to be added, refreshed, or removed

**Files**:

- `docshark/SKILL.md` — Decision flow, patterns, examples
- `docshark/evals/` — Test cases for evaluation
- `docshark/references/` — Additional guidance (optional)

### 2. `using-docshark`

**Set up, configure, and integrate DocShark locally**

- **Purpose**: Installation, configuration, integration, and troubleshooting
- **Triggers**: Setup questions, MCP client integration, Docker, configuration
- **When to Use**:
  - User wants to install DocShark locally
  - Integration with Claude Desktop, VS Code, or Cursor
  - Configuration of environment variables or documentation sources
  - Troubleshooting crawling, search, or memory issues

**Files**:

- `using-docshark/SKILL.md` — Setup guide, config, troubleshooting
- `using-docshark/evals/` — Test cases
- `using-docshark/references/` — Additional setup guides

## Installation

You can install these skills directly into your AI coding assistant using the [skills.sh](https://skills.sh) CLI:

```bash
# Install the docshark tool usage skill
npx skills add Michael-Obele/docshark --skill docshark

# Install the docshark setup and config skill
npx skills add Michael-Obele/docshark --skill using-docshark
```

### Installation by Code Editor

The `npx skills add` command automatically detects your environment, but here is where the skills are stored in various AI code editors:

- **Cursor**: Installed into the `.cursor/rules/` directory as `docshark.mdc`.
- **Windsurf**: Appended to your project's `.windsurfrules` file.
- **VS Code (Cline / Roo Code)**: Injected into `.clinerules` or `.roomodes`.
- **VS Code (GitHub Copilot)**: Injected into `.github/copilot-instructions.md`.
- **Trae IDE**: Installed into the `.trae/skills/` directory.

---

## Directory Structure

```
skills/
├── docshark/
│   ├── SKILL.md                 # Main skill definition
│   ├── evals/                   # Evaluation test cases
│   └── references/              # Additional resources
│
├── using-docshark/
│   ├── SKILL.md                 # Installation & config guide
│   ├── evals/                   # Test cases
│   └── references/              # Setup references
│
├── VALIDATION_CHECKLIST.md      # Pre-publishing validation
└── README.md                    # This file
```

## Publishing Skills to skills.sh/

To publish these skills to the [Agent Skills Directory](https://skills.sh/):

### Quick Start

```bash
# 1. Validate locally
gh skill publish --dry-run

# 2. Publish (interactive)
gh skill publish

# 3. Verify on skills.sh (5-10 minutes)
# Visit: https://skills.sh/?search=docshark
```

### Full Instructions

See [PUBLISHING_SKILLS.md](../../PUBLISHING_SKILLS.md) for:

- Step-by-step publishing guide
- Troubleshooting common issues
- Version management and CI/CD integration
- Verification after publishing

### Pre-Publishing Checklist

See [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) for:

- Required frontmatter fields
- Directory naming rules
- Content quality standards
- Manual validation commands

## Skill Metadata Requirements

### Frontmatter Format

Each SKILL.md must start with valid YAML:

```yaml
---
name: skill-name
description: "Clear description with action verbs. Use this skill when the user..."
---
```

### Key Rules

- ✅ `name:` must match directory name
- ✅ `description:` must be 150+ characters and include "Use this skill when"
- ✅ `allowed-tools:` (if present) must be a string: `"tool1, tool2"` not `["tool1", "tool2"]`
- ✅ No install metadata (`metadata.github-*`)
- ✅ Valid YAML syntax

## Best Practices

### Skill Design

1. **Clear Triggering**: Describe exactly when the skill should be used
2. **Actionable Content**: Provide workflows, examples, decision flows
3. **Error Handling**: Include troubleshooting section
4. **Tested Patterns**: Use examples from real user workflows
5. **Progressive Disclosure**: Keep SKILL.md under 500 lines; link to references for deep content

### Content Patterns

- **Decision flows**: Numbered steps for common workflows
- **Code examples**: Real, executable examples
- **Best practices**: ✅ good vs ❌ bad patterns
- **Troubleshooting**: Common issues with solutions
- **References**: Links to external docs

## Updating Skills

When you modify or enhance a skill:

1. Update `SKILL.md` with new content
2. Add/update test cases in `evals/`
3. Run validation: `gh skill publish --dry-run`
4. Publish new version:
   ```bash
   gh skill publish --tag v1.0.1  # patch
   gh skill publish --tag v1.1.0  # minor
   ```

## Integration Examples

### Claude Desktop

```json
{
  "mcpServers": {
    "docshark": {
      "command": "npx",
      "args": ["docshark", "--stdio"]
    }
  }
}
```

### VS Code + Copilot

```json
{
  "copilot.mcp.enabled": true,
  "copilot.mcp.mcpServers": {
    "docshark": {
      "command": "npx",
      "args": ["docshark", "--stdio"]
    }
  }
}
```

## Metrics & Feedback

After publishing on skills.sh/:

- **View installs**: Check GitHub release downloads
- **Monitor feedback**: Watch GitHub issues and discussions
- **Gather signals**: Use `/eval` to benchmark skill performance
- **Iterate**: Create new versions based on user feedback

## Contributing

To add new DocShark-related skills:

1. Create directory: `skills/new-skill-name/`
2. Create `SKILL.md` with required frontmatter
3. Add test cases to `evals/`
4. Run validation: `gh skill publish --dry-run`
5. Submit PR with new skill
6. Publish via `gh skill publish` once merged

## References

- [skills.sh](https://skills.sh/) — Agent Skills Directory
- [gh CLI: skill publish](https://cli.github.com/manual/gh_skill_publish) — Publishing documentation
- [PUBLISHING_SKILLS.md](../../PUBLISHING_SKILLS.md) — DocShark publishing guide
- [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) — Pre-publish validation

## Status

- ✅ `docshark` — Complete and ready to publish
- ✅ `using-docshark` — Complete and ready to publish
- 📋 Both skills pass validation checks
- 🚀 Ready for: `gh skill publish`
