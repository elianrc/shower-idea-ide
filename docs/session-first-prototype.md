# Session-First Prototype

Vivlio’s current product direction is **GitHub Desktop for local coding-agent sessions**.

The primary hierarchy is:

```text
Repository → Branch or worktree → Agent sessions
```

A session is an ongoing, resumable conversation with a locally installed coding-agent CLI. It owns the provider thread identifier, repository workspace, conversation event log, changed files, and verification results.

## Prototype behavior

- Repository and branch selection remain global, GitHub Desktop-style controls.
- A new session starts Codex on the current branch or in a generated `session/*` worktree.
- Follow-up messages resume the same native Codex thread.
- Conversation is the primary session view; changes and checks are secondary tabs.
- Verification and commits are explicit actions, not mandatory session lifecycle stages.
- The provider interface remains narrow so Claude Code can be added without changing the renderer’s session model.

The original v0.1 product specification documents the earlier task-first model. This document supersedes that model for the current prototype while the broader specification is revised.
