# AI sessions

Vivlio treats AI work as a repository workspace, not as an autonomous mode that
replaces review. A session sits beside Code and Review so the user can move from
conversation, to source, to the final diff without leaving the app.

## Current implementation

The first provider is Codex. Vivlio launches the user's installed `codex`
executable in app-server mode and communicates over its JSONL protocol. This
reuses the user's existing Codex authentication and durable thread store; Vivlio
does not collect or persist provider credentials.

The implementation provides:

- repository-scoped session creation, resume, rename, archive, and interruption;
- model discovery from the installed Codex version;
- streaming user, assistant, plan, command, file-change, and tool activity;
- explicit command, file-write, and permission approval cards;
- a versioned local catalog that remembers which Codex threads belong to each
  repository while Codex remains the source of truth for transcript history;
- direct handoff from a session to the Monaco Code workspace or Git Review;
- bounded streaming updates so long responses do not overwhelm Electron IPC.

All provider communication is owned by the Electron main process. The renderer
uses typed IPC messages and only receives serializable session snapshots.

## Safety model

New threads use the repository as their working directory, the
`workspace-write` sandbox, user-reviewed approvals, and the `on-request`
approval policy. Permission requests are granted only at the scope selected in
the UI. Closing Vivlio stops the app-server child process; durable threads stay
available through Codex.

## Next provider phase

Claude Code should implement the same provider-neutral session contract rather
than leak provider-specific protocol details into the UI. Before enabling it,
the integration needs equivalent guarantees for authentication reuse, durable
resume, streamed activity, interrupt, approvals, and repository scoping. Once
those guarantees exist, the provider selector can create either Codex or Claude
Code sessions while keeping the same review-first workflow.

