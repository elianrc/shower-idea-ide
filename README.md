# Vivlio

Vivlio is a repository-centered desktop workspace for local coding agents. It combines GitHub Desktop-style repository and branch controls with persistent Codex sessions that can run directly on the current branch or in an isolated worktree.

The current direction is captured in [docs/session-first-prototype.md](docs/session-first-prototype.md). The original architecture remains in [docs/product-architecture-spec.md](docs/product-architecture-spec.md).

## Implemented session workflow

- Open and inspect a local Git repository.
- Start a Codex session from a natural-language message.
- Use the current branch or create a dedicated `session/*` worktree.
- Persist and resume the native Codex CLI thread for follow-up messages.
- Stream conversation, commands, and output into the session view.
- Detect changed files and line statistics.
- Render the raw Git diff in Monaco.
- Infer and run `lint`, `typecheck`, `test`, and `build` package scripts.
- Run project checks on demand.
- Continue the conversation or create a Git commit from the same session.
- Persist repositories, sessions, conversations, changes, and verification metadata locally.

## Development

Requirements:

- Node.js 20 or newer
- Git
- The `codex` CLI authenticated and available on `PATH`

```bash
npm install
npm run dev
```

Verification:

```bash
npm run verify
```

GitHub browser sign-in is optional. Official or self-hosted builds can configure
it by following [the GitHub App setup guide](docs/github-app-setup.md). Vivlio
keeps the GitHub client secret outside the open-source desktop bundle.

## Install on macOS

Build the native app bundle, copy it to `/Applications`, and launch it:

```bash
npm run install:mac
```

Once it opens, right-click its Dock icon and choose **Options > Keep in Dock**.
Re-run the same command whenever you want to replace the installed app with a
new local build.

Session metadata is stored in Electron's application data directory. Isolated session worktrees are stored alongside that metadata rather than inside the opened repository.

## Architecture

The renderer has no direct access to Node.js. A narrow preload API connects it to the Electron main process, where the session manager coordinates persistence, Git, processes, the Codex adapter, and verification. This preserves the specification's key boundary: the UI owns presentation and decisions while the core engine owns development operations.

Local JSON is used for the first persistence vertical slice. The store is deliberately isolated behind `WorkspaceStore` so it can later move to SQLite without changing the renderer or session workflow.
