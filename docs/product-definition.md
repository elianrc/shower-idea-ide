# Vivlio Product Definition

> **Future direction:** This document describes Vivlio's broader product vision.
> The first release is intentionally limited to GitHub Desktop workflows plus
> the integrated editor described in the [v1 UI specification](v1-ui-spec.md).
> AI sessions are not part of the v1 interface.

**Status:** Canonical product direction
**Product:** Vivlio
**Category:** Git-centered desktop development workspace
**Primary platform:** Desktop
**Product philosophy:** Understand, change, review, and ship

## 1. Product statement

Vivlio combines a complete GitHub Desktop-style repository workflow, a focused
Monaco-based code workspace, and a T3 Code-style control plane for persistent
Codex and Claude Code sessions in one desktop application.

It is designed for developers who currently move between a Git client, a code
editor, a terminal, and tools such as Codex or Claude Code to complete a single
change. Vivlio brings those activities into one repository-centered workspace so
the user can understand what changed, verify it, and make an informed decision
before committing or publishing it.

Vivlio is not task-first or agent-first. The repository is the center of the
product. Manual editing, terminal commands, external tools, and AI sessions are
different ways of acting on the same working tree.

> Git, code, and AI in one review-centered workspace.

## 2. Product thesis

AI makes producing code faster, but producing code is not the whole development
workflow. Developers still need to understand the repository, inspect changes,
run checks, manage branches, resolve conflicts, maintain history, and decide what
is safe to ship.

Today, those responsibilities are usually split across several applications:

- A Git client manages repositories, branches, commits, and remotes.
- An editor provides navigation, search, and direct code changes.
- A coding-agent desktop app manages conversations, approvals, and parallel
  agent work.
- A terminal remains useful for direct commands and development tools.

Vivlio treats these as parts of one continuous workflow rather than separate
products. Its value is not merely that all four surfaces are visible in one
window. Its value is that they share the same repository, branch or worktree,
working changes, history, and review context.

## 3. Core product model

The primary hierarchy is:

```text
Repository
└── Branch or worktree
    ├── Working tree and staged changes
    ├── Files and editor state
    ├── Commit history
    ├── AI sessions
    ├── Terminal processes and checks
    └── Remote synchronization and pull requests
```

Each concept has a distinct role:

| Concept | Role |
| --- | --- |
| Repository | The user's home and the top-level unit of organization |
| Branch or worktree | The active development context |
| File | A unit the user or an agent can inspect and edit |
| AI session | A persistent conversation attached to a repository workspace |
| Working tree and index | The source of truth for uncommitted changes |
| Diff | The common review surface for every type of change |
| Check | Evidence that the current change behaves as intended |
| Commit | A reviewed unit of local history |
| Pull request | A published proposal for collaboration and integration |

Vivlio does not create a parallel task lifecycle that competes with Git. A user
may organize work through branches, worktrees, commits, pull requests, and named
AI sessions without converting every action into a Vivlio task.

## 4. The shared workflow

All ways of changing the repository converge on the same review and shipping
flow:

```text
Manual editing ─┐
AI session ─────┼──→ Working changes → Review diff → Run checks → Commit → Push/PR
Terminal/tools ─┘
```

The user can move freely between these activities:

1. Open or clone a repository.
2. Select or create a branch or worktree.
3. Explore files, history, and existing changes.
4. Edit directly, run commands, ask an AI session for help, or combine all three.
5. Review the resulting diff, including staged and unstaged changes.
6. Ask questions about unfamiliar code or the reason for a change.
7. Run relevant tests, linters, builds, and other checks.
8. Stage intentionally, write a commit, and synchronize with the remote.
9. Create, inspect, or continue a pull request when collaboration is required.

Vivlio should make review natural and prominent without imposing a mandatory
approval ceremony on every edit.

## 5. Product principles

### 5.1 The repository is the center

Files, branches, worktrees, history, sessions, checks, and commits are presented
as parts of one repository rather than separate projects inside the application.

### 5.2 Git is the source of truth

Vivlio reflects the actual repository state. It does not hide changes in a
proprietary task model or maintain a competing representation of what will be
committed.

### 5.3 Review is a first-class activity

The diff is not only a final confirmation screen. It is a central workspace for
understanding a change, navigating to code, selecting what to stage, discussing
the implementation with AI, and checking whether the result matches the user's
intent.

### 5.4 AI should increase understanding

AI is available for implementation, exploration, explanation, debugging, and
review. The product should make the agent's actions and effects observable rather
than encouraging blind acceptance.

### 5.5 Humans and agents share one workspace

A change can begin manually and continue with an agent, or begin with an agent
and be refined manually. Both operate on an explicit branch or worktree and
produce ordinary Git-visible changes.

### 5.6 Shipping is an explicit decision

Commit, push, force-push, merge, rebase, reset, and pull-request actions remain
clear user decisions. Automation may prepare or recommend an action, but it must
not obscure consequential repository operations.

### 5.7 Complete common workflows before adding novelty

Vivlio should be dependable as a Git client and useful as a code workspace even
when no AI session is active. AI capabilities extend the development workflow;
they do not excuse gaps in essential repository behavior.

### 5.8 Use progressive disclosure

Routine actions should be approachable, while advanced Git state, command output,
agent activity, and recovery options remain available when needed.

## 6. Product pillars

### 6.1 Repository management

Vivlio should provide broad behavioral parity with GitHub Desktop for supported
workflows, including:

- Create, add, clone, fork, publish, and remove repositories.
- Authenticate with GitHub and supported GitHub Enterprise hosts.
- Inspect working changes and commit history.
- Stage files, individual hunks, and individual lines.
- Commit, amend, undo, revert, reset, reorder, squash, and cherry-pick.
- Create, switch, rename, compare, merge, rebase, and delete branches.
- Work with local branches, remote branches, tags, stashes, and worktrees.
- Fetch, pull, pull with rebase, push, publish, and force-push with safeguards.
- Handle conflicts, hooks, Git LFS, submodules, credentials, and authentication
  failures.
- Create or open issues and pull requests, check out pull requests, and compare
  branches.
- Open repositories in the system file browser, terminal, or another editor.

Parity is behavioral, not visual. Vivlio may reorganize these capabilities to
support its unified workspace, but it should preserve their reliability and
recoverability.

### 6.2 Focused code workspace

Vivlio includes the editing and navigation capabilities needed to inspect and
make ordinary repository changes without leaving the application:

- Repository file explorer with Git status decoration.
- Monaco editor with tabs, syntax highlighting, and language-aware behavior.
- File and project-wide search and replace.
- Direct navigation between diffs, history, diagnostics, agent messages, and
  source files.
- Side-by-side and unified diff views.
- Save, autosave, external-change detection, and unsaved-change protection.
- Problems, command output, and basic diagnostics.
- Integrated terminal access and configurable project commands.

The initial goal is a focused development workspace, not complete VS Code
compatibility. An extension marketplace, full debugger ecosystem, remote
development, dev containers, and support for every language service are outside
the initial product promise unless adopted explicitly later.

### 6.3 Agent session control plane

Vivlio integrates real coding-agent providers rather than recreating their
reasoning and tool runtimes. Codex and Claude Code should feel comparable to
using their native desktop applications while remaining manageable from one
shared session list. The experience is a visual control plane, not a generic
chat wrapper around terminal output.

Vivlio provides a common session shell while preserving provider-specific
capabilities. Shared concepts include repository context, transcript, run state,
approvals, changed files, notifications, and session organization. Models,
reasoning controls, permission modes, plan behavior, usage reporting, native
tools, and event types may differ by provider and must remain accurate.

An AI session is:

- Attached to a repository and an explicit branch or worktree.
- Persistent and resumable through the provider's native session identity.
- Capable of reading and changing files according to its granted permissions.
- Observable through conversation, commands, output, changed files, and checks.
- Available for questions and explanations without requiring code changes.
- Able to operate on the current working tree or in an isolated worktree.
- Presented through structured messages, tool calls, file changes, command
  activity, approvals, errors, and verification results.
- Steerable through queued messages, interruption, follow-up instructions, and
  provider-supported permission controls.
- Backed by provider-native session identities so compatible native tools can
  resume the session where supported.

Sessions may be named, pinned, searched, resumed, stopped, and archived. They do
not require task states such as planning, approval, or completion. Git state and
provider state describe what is actually happening.

The terminal is an optional utility for direct user work and debugging. It is not
the primary interface for creating, operating, approving, or reviewing sessions.

### 6.4 Review and verification

Review is the connective tissue between Git, editing, and AI:

- Every change is visible in the ordinary working-tree diff.
- Diff selections can open the corresponding source and history.
- Agent messages can reference files, lines, commands, and checks.
- The user can ask an agent to explain or critique a selected change.
- Relevant tests, type checks, linters, and builds can be detected and run.
- Results remain associated with the repository workspace and session that ran
  them.
- Verification evidence informs the user but does not replace their judgment.

## 7. Interaction model

Vivlio should expose three closely connected workspaces:

1. **Changes** — working tree, staging, diffs, history, commits, and remote sync.
2. **Code** — explorer, search, editor, diagnostics, command output, and an
   optional terminal panel.
3. **Sessions** — AI conversations, worktree context, activity, changed files,
   and checks.

Repository and branch or worktree context remain globally visible. The user
should be able to open a file from a diff, inspect a diff from an editor tab, or
discuss either one in an AI session without losing context.

Changes should always be easy to reach. The interface should continually help
the user answer:

- What changed?
- Why did it change?
- Do I understand it?
- Does it work?
- Is it ready to commit or publish?

## 8. Scope boundaries

Vivlio is intentionally not:

- A task-management system for software projects.
- An autonomous software factory that removes the developer from review.
- A proprietary replacement for Git history, branches, commits, or pull requests.
- A complete reimplementation of VS Code and its extension ecosystem.
- A new foundation model or coding-agent runtime.
- A GitHub-only product at the local Git layer, even though GitHub collaboration
  receives first-class integration.

These boundaries keep the product focused on unifying mature workflows instead
of reproducing every capability of each source product.

## 9. Product foundation

The intended foundation is the open-source GitHub Desktop application, used in
accordance with its MIT license and transformed into Vivlio. T3 Code is the
behavioral reference and a potential selective source for the provider-neutral
agent control plane; it is not a second application shell.

The foundation should preserve mature repository behavior while Vivlio replaces
the product shell and adds its code and session workspaces. The implementation
must remove GitHub trademarks and official distribution assumptions, configure
Vivlio-owned authentication and update infrastructure, and retain all required
license and attribution notices.

The existing Vivlio prototype remains useful as a reference and transplant
source for:

- Coding-agent provider adapters.
- Persistent agent sessions.
- Current-branch and isolated-worktree execution.
- Monaco-based source and diff views.
- File services and repository-scoped IPC boundaries.
- Verification command discovery and execution.

The prototype's task-first and session-first product assumptions are not part of
the canonical direction.

## 10. Initial product success criteria

Vivlio succeeds when a developer can complete a normal change without needing to
switch applications:

1. Clone or open a repository and manage its branches and remotes confidently.
2. Understand the current state through files, history, and diffs.
3. Make a change manually, with an AI session, or through both.
4. Inspect every resulting change and navigate directly to its source context.
5. Run and understand the relevant checks.
6. Stage intentionally, commit, push, and open or continue a pull request.
7. Return later and recover the repository, editor, and session context.

AI usage is optional in this definition of success. Vivlio must still be a
coherent Git and code workspace when the user chooses to work manually.
