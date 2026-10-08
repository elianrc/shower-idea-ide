# Shower Idea

Shower Idea is an agent-first desktop development environment. Work begins with an intent, runs in an isolated Git worktree, passes through verification and review, and only becomes a commit after explicit human approval.

The product and architecture source of truth is [docs/product-architecture-spec.md](docs/product-architecture-spec.md).

## Implemented v0.1 workflow

- Open and inspect a local Git repository.
- Create a task from a natural-language request.
- Create a dedicated `task/*` branch and Git worktree.
- Launch Codex in the isolated worktree through an adapter interface.
- Stream meaningful activity into the task view.
- Detect changed files and line statistics.
- Render the raw Git diff in Monaco.
- Infer and run `lint`, `typecheck`, `test`, and `build` package scripts.
- Ask follow-up questions or request corrections in the same task.
- Approve the result and create a Git commit.
- Persist project, task, conversation, review, and verification metadata locally.

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

## Install on macOS

Build the native app bundle, copy it to `/Applications`, and launch it:

```bash
npm run install:mac
```

Once it opens, right-click its Dock icon and choose **Options > Keep in Dock**.
Re-run the same command whenever you want to replace the installed app with a
new local build.

Task metadata is stored in Electron's application data directory. Task worktrees are stored alongside that metadata rather than inside the opened repository.

## Architecture

The renderer has no direct access to Node.js. A narrow preload API connects it to the Electron main process, where the task manager coordinates persistence, Git, processes, the Codex adapter, and verification. This preserves the specification's key boundary: the UI owns presentation and decisions while the core engine owns development operations.

Local JSON is used for the first persistence vertical slice. The store is deliberately isolated behind `WorkspaceStore` so it can be migrated to the specification's SQLite and Drizzle design without changing the renderer or task workflow.
