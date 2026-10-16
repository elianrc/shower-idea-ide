# Vivlio Reimplementation Plan

**Status:** Proposed implementation plan
**Date:** October 15, 2026
**Target:** First reviewable desktop alpha
**Primary platform:** macOS first, while preserving GitHub Desktop's Windows
infrastructure

## 1. Outcome

Vivlio will be rebuilt as a repository-centered desktop application with three
connected capabilities:

1. GitHub Desktop-grade repository management.
2. A T3 Code-style control plane for Codex and Claude Code sessions.
3. A focused Monaco code and review workspace.

The application must remain useful without an active agent. Codex and Claude
Code sessions are first-class native-feeling surfaces, not terminal emulators or
generic chat wrappers. The terminal is an optional utility panel.

The first alpha is successful when a user can open or clone a repository, manage
its branch and remote state, run parallel Codex or Claude Code sessions, inspect
and edit files, review all resulting changes, run checks, commit, and push from
one application.

## 2. Source strategy

Vivlio will not be rewritten from an empty Electron project. It will use three
sources deliberately:

### 2.1 GitHub Desktop: application foundation

Repository: <https://github.com/desktop/desktop>

GitHub Desktop supplies the base Electron application and its mature Git,
authentication, repository, branch, history, diff, staging, synchronization,
conflict, LFS, submodule, and operating-system behavior.

The initial reproducible baseline is the latest stable release available when
implementation begins. As of this plan:

- Tag: `release-3.6.6`
- Commit: `8b85519e733fd98a04c178249d2d10fd8f3db19e`

The `development` branch remains a read-only reference. Vivlio does not promise
continuous upstream merging, but the upstream remote will be retained so
important security and Git fixes can be evaluated selectively.

### 2.2 T3 Code: agent-control reference and selective source

Repository: <https://github.com/pingdotgg/t3code>

T3 Code supplies the strongest available open-source reference for a provider-
neutral agent control plane. Relevant areas include provider adapters, Codex
app-server integration, normalized events, permissions, session orchestration,
parallel environments, and native-feeling session presentation.

The reference baseline at the time of this plan is:

- Branch: `main`
- Commit: `42da166d131017335a1158d0b379dd68b8985796`

Vivlio will not import the entire T3 server, web, mobile, and remote stack by
default. We will audit and selectively port packages that remain cohesive inside
the GitHub Desktop foundation. If a subsystem cannot be separated safely, its
behavior will be used as a reference and implemented behind Vivlio's own
contracts.

### 2.3 Existing Vivlio prototype: archive and transplant source

The current prototype will not remain the application foundation. Before any
replacement, its complete working tree will be preserved on an archive branch
and recoverable tag.

Candidate work to transplant after review:

- Product definition and design decisions.
- Vivlio branding and assets that remain applicable.
- Monaco source and diff experiments.
- Repository-scoped preload and IPC security patterns.
- Codex session persistence and resume experiments.
- Worktree creation and cleanup behavior.
- Verification command discovery and result presentation.

Code is moved only when it fits the new architecture; preserving every existing
component is not a goal.

## 3. Repository transition

The two unrelated histories should not be combined through a large merge.
Implementation begins with this recoverable transition:

1. Record the current branch, commit, dirty working tree, and build status.
2. Commit the complete prototype state to `codex/archive-prototype-2026-10-15`.
3. Add a recoverable tag for the archived prototype.
4. Add GitHub Desktop and T3 Code as read-only upstream remotes.
5. Create `codex/reimplementation` directly from the pinned GitHub Desktop
   release commit.
6. Add the Vivlio product definition, this plan, and required attribution files
   to the new foundation.
7. Keep the original Vivlio remote as `origin`; do not overwrite its existing
   branches or history.

This makes the new foundation an authentic descendant of GitHub Desktop rather
than a copied directory, while the original prototype remains fully recoverable.

## 4. Non-negotiable architectural rules

### 4.1 Preserve the Git engine before reshaping it

GitHub Desktop's Git behavior and tests are treated as inherited product assets.
The first releases should adapt them through narrow interfaces instead of
rewriting operations to match a new UI.

### 4.2 Isolate provider processes

Codex, Claude Code, terminals, and long-running checks must not run inside the
renderer. Provider processes should be owned by an isolated host or child
process with explicit IPC, cancellation, deadlines, and crash recovery.

### 4.3 Use a common session contract without flattening providers

Vivlio owns common concepts such as session identity, workspace, transcript,
run state, approvals, changed files, and notifications. Provider-specific
features remain available through advertised capabilities.

```text
Vivlio session shell
├── Codex adapter
└── Claude Code adapter
```

The UI must not pretend that Codex reasoning controls and Claude permission
modes are identical.

### 4.4 Keep Git as the change authority

Agent checkpoints and transcripts may provide recovery and explanation, but the
working tree and index remain authoritative for review, staging, and commits.

### 4.5 Make every replacement incremental

The application should build and launch at the end of every phase. Existing
GitHub Desktop behavior is removed only after its Vivlio replacement has tests
and an explicit product reason.

### 4.6 Keep the terminal optional

Commands performed by an agent appear as structured session events. A terminal
panel is available for direct user work and debugging, but it is not required to
start, steer, approve, or review an agent session.

## 5. Implementation phases

### Phase 0 — Preserve and establish baselines

Actions:

- Archive the complete existing Vivlio working tree.
- Pin GitHub Desktop and T3 Code source commits.
- Record MIT licenses and third-party attribution requirements.
- Build and test the unmodified GitHub Desktop baseline on macOS.
- Inventory GitHub-owned services, credentials, update endpoints, analytics,
  crash reporting, trademarks, and release infrastructure.
- Inventory T3 provider packages and determine which can be ported independently.

Exit criteria:

- The prototype is recoverable.
- The pinned GitHub Desktop source builds and launches locally.
- A written keep, replace, disable, or defer decision exists for each GitHub-
  owned integration.

### Phase 1 — Create a neutral Vivlio foundation

Actions:

- Rename product, executable, bundle identifiers, protocols, data directories,
  and visible strings.
- Replace GitHub trademarks and assets while retaining required license notices.
- Disable or replace official update, analytics, and crash-reporting endpoints.
- Preserve GitHub authentication behavior behind Vivlio-owned OAuth
  configuration.
- Add a Vivlio feature flag boundary around new surfaces.
- Establish formatting, linting, testing, and packaging commands for the forked
  foundation.

Exit criteria:

- A clean Vivlio-branded build launches and can open, clone, inspect, commit,
  fetch, pull, and push a test repository.
- No request is sent to GitHub Desktop-specific telemetry or update services.
- GitHub Desktop's applicable Git tests still pass.

### Phase 2 — Prove the three-surface shell

Actions:

- Introduce top-level `Changes`, `Code`, and `Sessions` workspaces.
- Keep repository, branch or worktree, and sync state globally visible.
- Preserve the existing Changes and History experience during the transition.
- Add an empty Monaco file view capable of opening a repository file.
- Add a minimal session list and provider-host process using a fake provider.
- Prove navigation from changed file to source and from session to workspace.

Exit criteria:

- All three workspaces operate in one packaged application.
- Switching workspaces preserves repository and branch context.
- The fake provider demonstrates streamed events, cancellation, approval, and
  recovery after a provider-host restart.

This is the main architectural decision gate. If T3's provider packages cannot
fit behind this boundary without importing its entire application, Vivlio keeps
the contract and implements the adapters directly.

### Phase 3 — Deliver the Codex vertical slice

Actions:

- Integrate Codex through its documented app-server protocol over local stdio.
- Reuse existing Codex authentication when supported and provide explicit login
  state when it is not available.
- Implement create, resume, send, queue or steer, interrupt, archive, and delete.
- Render agent messages, reasoning or progress, commands, file changes, tool
  calls, approvals, errors, and completion as structured events.
- Expose model, reasoning effort, sandbox, and approval controls supported by the
  connected Codex version.
- Support current-checkout and isolated-worktree sessions.
- Persist native thread identifiers so compatible native tools can resume the
  same session where supported.

Risk control:

Codex app-server is the official deep-integration interface, but portions of the
command and transports are still marked experimental. All protocol handling must
remain inside a versioned adapter with capability discovery, schema fixtures,
and graceful unsupported-version behavior.

Exit criteria:

- A user can complete a multi-turn Codex session without using a terminal.
- Approval prompts, interruption, resumption, and worktree isolation work.
- Agent file changes immediately appear in Vivlio's ordinary Changes workspace.

### Phase 4 — Deliver the Claude Code vertical slice

Actions:

- Select the most stable supported Claude Code integration after a focused API
  and licensing spike.
- Prefer provider-native authentication and subscriptions over Vivlio-managed
  API keys.
- Implement the same common session lifecycle as Codex.
- Preserve Claude-specific models, effort, modes, permissions, plan behavior,
  usage reporting, and event types through capabilities.
- Support native session resume or import where the supported interface allows
  it.
- Add contract tests that run the Codex and Claude adapters against the same
  normalized lifecycle suite.

Exit criteria:

- Codex and Claude sessions coexist in one repository and session list.
- Provider-specific controls are accurate and do not leak into the other
  provider.
- Parallel isolated sessions do not mutate each other's working trees.

### Phase 5 — Build the focused Monaco workspace

Actions:

- Add a repository explorer with Git decorations.
- Add editor tabs, save, autosave, dirty-state protection, and external-change
  detection.
- Add file search and project-wide text search.
- Add language detection, syntax highlighting, and initial diagnostics.
- Connect diffs, history entries, agent file references, and search results to
  source navigation.
- Add an optional terminal drawer only after the primary session interactions
  work without it.

Exit criteria:

- A user can inspect and make ordinary targeted code changes without leaving
  Vivlio.
- Editor changes and agent changes are indistinguishable in Git status and
  review.
- External edits are detected without silently overwriting user work.

### Phase 6 — Unify review, verification, and shipping

Actions:

- Present agent-created and manually created changes through the same diff and
  staging model.
- Add inline review comments that can be sent back to the active agent session.
- Connect changed-file summaries to full diff and source views.
- Detect and run project checks with structured status and output.
- Associate check results with the workspace and session that initiated them.
- Preserve GitHub Desktop commit, branch, push, pull, conflict, and pull-request
  behavior.

Exit criteria:

- A user can review every change, request a correction, rerun checks, stage
  intentionally, commit, push, and create or continue a pull request from one
  coherent flow.

### Phase 7 — Parity and recovery hardening

Actions:

- Execute the GitHub Desktop behavioral parity ledger against fixture
  repositories.
- Cover dirty checkout, partial staging, renames, untracked files, detached
  HEAD, conflicts, divergence, rebases, stashes, tags, LFS, submodules, hooks,
  authentication failures, and worktree removal.
- Exercise agent crashes, app restarts, interrupted turns, missing CLIs, expired
  credentials, deleted worktrees, and provider upgrades.
- Add accessibility and keyboard-navigation checks.
- Validate performance on large repositories and long transcripts.

Exit criteria:

- No known regression exists in the supported GitHub Desktop parity scope.
- Sessions and repository state recover predictably after crashes and restarts.

### Phase 8 — Release engineering

Actions:

- Configure Vivlio-owned code signing, notarization, installers, updates, crash
  reporting, and privacy controls.
- Produce third-party license bundles and acknowledgements.
- Run macOS release candidates, then validate the preserved Windows path.
- Document supported provider versions and diagnostic collection.

Exit criteria:

- A signed, installable alpha upgrades safely and does not collide with GitHub
  Desktop, T3 Code, Codex, or Claude Desktop installations.

## 6. Test strategy

Testing is layered so provider work cannot destabilize Git behavior:

- **Inherited tests:** Keep GitHub Desktop's applicable Git and UI tests green.
- **Provider contract tests:** Run every provider adapter against the same session
  lifecycle suite with recorded protocol fixtures.
- **Repository fixtures:** Generate repositories for status, history, staging,
  remotes, conflicts, worktrees, LFS, and submodules.
- **Integration tests:** Exercise provider host → filesystem → Git status → diff
  → commit flows.
- **Packaged smoke tests:** Launch the signed application and operate real test
  repositories on supported platforms.
- **Manual acceptance:** Compare key Git flows with GitHub Desktop and key
  session flows with Codex, Claude Code Desktop, and T3 Code.

## 7. First-alpha scope

Included:

- Local repositories and GitHub-hosted repositories.
- Existing GitHub Desktop repository, history, branch, commit, and sync flows.
- Codex and Claude Code local sessions.
- Current-checkout and isolated-worktree modes.
- Parallel session list, transcript, approvals, controls, and notifications.
- File explorer, Monaco editor, search, diffs, and review.
- Check execution and structured results.
- Optional local terminal panel.
- macOS packaging, without removing Windows compatibility.

Deferred unless required by the foundation:

- Mobile clients and remote-control infrastructure.
- Cloud-hosted agent environments.
- SSH development environments.
- Providers beyond Codex and Claude Code.
- VS Code extension compatibility and marketplace support.
- Full debugger and language-server ecosystem.
- Scheduled agents and automations.
- Continuous merging from GitHub Desktop or T3 Code upstream.

## 8. Decisions to confirm before implementation

The plan assumes:

1. macOS is the first release platform; Windows follows without intentionally
   removing inherited support.
2. The first alpha is local-first; mobile, remote, cloud, and SSH are deferred.
3. Provider-native login and subscriptions are preferred over separate API keys.
4. Codex and Claude Code are the only initial providers.
5. GitHub Desktop stable is the application foundation; T3 Code is selectively
   mined rather than used as a second full foundation.
6. The current Vivlio prototype can be archived and replaced once recoverability
   is verified.

Changing any of these assumptions is possible, but should happen before the
repository transition because it changes the foundation and test matrix.

## 9. Immediate implementation batch

Once the assumptions are accepted, the first batch is:

1. Archive the existing prototype safely.
2. Create the GitHub Desktop-based reimplementation branch.
3. Build the unmodified pinned foundation.
4. Produce the GitHub integration and branding inventory.
5. Rebrand the package to a local Vivlio development build.
6. Verify open, clone, change, commit, fetch, pull, and push against disposable
   repositories.
7. Add the three-workspace shell behind a feature flag.

No agent or editor code is ported until that foundation is reproducible and the
inherited Git behavior is protected by tests.
