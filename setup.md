# VM Setup Guide

Steps to set up this VM with VS Code, Claude Desktop, Claude Code, Node.js, and the Caveman skill.

## 1. Visual Studio Code

Download from the official site: https://code.visualstudio.com/download

Install the appropriate package for this VM's distro (.deb for Debian/Ubuntu, .rpm for Fedora/RHEL, or the tarball).

To run it in this environment (sandboxed VM, so the sandbox must be disabled):

```
code --no-sandbox
```

## 2. Claude for Linux (Desktop app)

Download and install from the official Claude setup docs for Linux: https://docs.claude.com

Follow the Linux installation instructions listed there for this distro.

To run it in this environment:

```
claude-desktop --no-sandbox
```

## 3. Claude Code (CLI)

Install from the official docs: https://docs.claude.com/en/docs/claude-code

Quickest path (requires Node.js -- see step 4):

```
npm install -g @anthropic-ai/claude-code
```

Then launch it from any project directory with:

```
claude
```

## 4. Node.js

Download from the official Node.js download page: https://nodejs.org/en/download

Install the LTS release for this distro (via the official installer, package manager, or a version manager like nvm). Node.js is required by both Claude Code and the npx-based skill installer used below.

Verify the install:

```
node -v
npm -v
```

## 5. Caveman skill for Claude Code

Reference: official Caveman GitHub repo -- https://github.com/JuliusBrussee/caveman

Install via VS Code's Claude Code extension terminal (or any terminal with Node.js on PATH):

```
npx skills add JuliusBrussee/caveman
```

This clones the repo and installs the Caveman skill set into `.agents/skills/` in the current project, symlinked for Claude Code.

> **NOTE:** the installer's security scan flags `caveman-setup` as High Risk -- that specific sub-skill reroutes an app's live LLM API traffic through Caveman's hosted cloud gateway and sends a real, billable request with a `CAVE_API_KEY`. It only activates if explicitly invoked (e.g. "set up caveman" with a gateway URL/key). The rest of the skills (caveman, caveman-compress, caveman-optimize, etc.) are the local, MIT-licensed terse-response/token-shrinking skills and scored Safe/Low Risk.

## 6. Restrictions to save Claude tokens

Practical limits to keep Claude Code/Claude Desktop usage cheap on this VM:

- Use the Caveman skill by default. Say "use caveman" (or invoke `/caveman`) for routine coding tasks -- its terse, caveman-style output measured ~65% shorter responses in the repo's own benchmark, with no loss of code accuracy.
- Never invoke `caveman-setup`. It sends real, billable provider requests through an external gateway and is unrelated to saving tokens locally -- it's a separate paid-product integration.
- Prefer a cheaper model for routine work. Use Haiku (or "fast mode" only when actually needed) for simple edits, lookups, and boilerplate; reserve Sonnet/Opus for tasks that need deeper reasoning.
- Run `/compact` periodically in long sessions to shrink conversation history instead of letting it grow unbounded.
- Avoid Agent/subagent spawns for small tasks. Each subagent starts cold and re-derives context, which costs more tokens than doing a quick lookup directly (e.g. with grep/Read).
- Scope file reads. Read only the relevant lines/sections of large files (use offset/limit) instead of whole files when only a small part is needed.
- Keep prompts and instructions specific and short. Vague or broad requests ("review everything", "explain the whole codebase") burn far more tokens than a targeted question.
- Close/exit idle Claude sessions rather than leaving them running -- background loops and scheduled wakeups also consume tokens on each firing.
