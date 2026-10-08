# Agent-First Development Environment
## Product & Architecture Specification — v0.1

**Status:** Initial specification  
**Product name:** Vivlio
**Primary platform:** Desktop  
**Initial stack:** Electron + React + TypeScript  
**Primary philosophy:** Intent → Agent → Verify → Review → Ship

---

# 1. Product Vision

Modern development tools are still fundamentally designed around a workflow where the developer manually writes code.

AI coding agents have changed that workflow.

Increasingly, the developer:

1. describes what should change,
2. delegates implementation to an agent,
3. waits while the agent modifies the project,
4. inspects the result,
5. asks questions or requests corrections,
6. approves the changes,
7. commits and pushes them.

Traditional IDEs treat the AI agent as an additional feature inside a code editor.

This product reverses that relationship.

The **agent workflow is the primary interface**.

The code editor exists mainly for inspection, understanding, debugging, and occasional manual intervention.

The product should make agent-generated software changes easy to:

- understand,
- inspect,
- question,
- verify,
- approve,
- reject,
- commit,
- and trace historically.

The application should feel closer to a combination of:

- an AI coding agent,
- GitHub Desktop,
- a lightweight code viewer/editor,
- and a development task manager,

rather than a traditional IDE with an AI sidebar.

---

# 2. Core Principle

The human owns:

- intent,
- decisions,
- review,
- approval.

The agent owns:

- implementation,
- repetitive coding work,
- exploration,
- command execution,
- testing,
- proposed fixes.

The application exists between the two.

Its primary responsibility is to make the agent's work **understandable and controllable**.

---

# 3. Product Philosophy

The application should optimize for four qualities.

## 3.1 Simple

The interface should expose as little complexity as possible by default.

The user should not need to think about:

- Git staging,
- individual Git commands,
- worktree management,
- agent process management,
- terminal orchestration,
- log files,
- temporary branches,

unless they explicitly want to.

Advanced details must still remain accessible.

---

## 3.2 Agent-first

The main action in the application should not be:

> Open file.

It should be:

> Create task.

Natural language is the primary way work begins.

---

## 3.3 Git-native

Every meaningful agent change should exist within a Git-aware workflow.

Git provides:

- isolation,
- history,
- reversibility,
- comparison,
- accountability,
- collaboration.

Git should be fundamental to the architecture while remaining mostly invisible in the normal UI.

---

## 3.4 Human-supervised

The product must never assume that agent output is correct simply because an agent completed its work.

The normal workflow should encourage:

- review,
- verification,
- questions,
- inspection,
- and explicit approval.

The goal is not to remove the developer from software development.

The goal is to move the developer from **typing every implementation detail** toward **directing and supervising implementation**.

---

# 4. Primary Workflow

The core development lifecycle is:

```text
IDEA
 ↓
TASK
 ↓
AGENT
 ↓
VERIFY
 ↓
REVIEW
 ↓
APPROVE / REQUEST CHANGES
 ↓
COMMIT
 ↓
MERGE / PUSH
```

Every major interface decision should reinforce this workflow.

---

# 5. The Core Domain Object: Task

The primary unit of work is not a file.

It is a **Task**.

Example:

```text
Task
"Add password reset"

├── Original request
├── Agent
├── Conversation
├── Branch
├── Worktree
├── Commands executed
├── Files changed
├── Verification results
├── Review state
├── Commits
└── Final outcome
```

A Task represents one intentional change to the software.

Examples:

- Fix mobile navigation.
- Add password reset.
- Upgrade Stripe API version.
- Refactor authentication middleware.
- Investigate failing checkout tests.
- Change the dashboard layout.
- Add dark mode.

---

# 6. Task Lifecycle

A task can move through the following states.

```text
DRAFT
  ↓
PLANNING
  ↓
WORKING
  ↓
VERIFYING
  ↓
READY FOR REVIEW
  ↓
REVIEWING
  ├──→ CHANGES REQUESTED
  │        ↓
  │      WORKING
  │
  └──→ APPROVED
            ↓
         COMMITTED
            ↓
       MERGED / PUSHED
```

Possible exceptional states:

```text
FAILED
CANCELLED
BLOCKED
CONFLICT
```

The user should always be able to understand the current state of a task without reading agent logs.

---

# 7. Git Isolation

Each task should ideally operate in its own isolated Git environment.

The preferred initial model is:

**one Task = one Git branch + one Git worktree**

Example:

```text
Main repository

/project
  main

Task:
"Add password reset"

Branch:
task/password-reset

Worktree:
/.internal/worktrees/password-reset
```

This provides several advantages:

- `main` remains untouched while the agent works.
- Multiple tasks can exist simultaneously.
- Tasks can be cancelled without damaging the primary workspace.
- Changes can be compared cleanly.
- Agents can operate independently.
- Future parallel agent workflows become possible.

The application should manage worktrees automatically.

The user should not normally need to know where they are stored.

---

# 8. Creating a Task

The initial task interface should be extremely simple.

Example:

```text
What do you want to change?

┌──────────────────────────────────────────────┐
│ The theme switch currently reloads the page.│
│ Make theme switching instant while keeping  │
│ the preference persisted.                   │
└──────────────────────────────────────────────┘

Agent
Codex ▾

[ Start Task ]
```

Optional advanced settings may include:

- agent,
- model,
- autonomy level,
- base branch,
- environment variables,
- verification profile.

These should not dominate the default interface.

---

# 9. Agent Architecture

Agents should be interchangeable.

The product must not be architecturally tied to a single provider.

A common interface should be defined:

```ts
interface AgentAdapter {
  startTask(context: AgentTaskContext): Promise<AgentSession>;
  sendMessage(message: string): Promise<void>;
  cancel(): Promise<void>;
  getStatus(): AgentStatus;
}
```

Possible implementations:

```text
AgentAdapter
├── CodexAdapter
├── ClaudeAdapter
├── GeminiAdapter
└── LocalAgentAdapter
```

The application owns the workflow.

The agent provider only performs work within that workflow.

---

# 10. Agent Permissions

Tasks should have an explicit permission model.

Example:

```text
Agent Permissions

Files              Allow
Run commands       Allow
Install packages   Ask
Network access     Ask
Git commit         Never
Git push           Never
```

Potential permission presets:

### Review-only

- read files,
- inspect repository,
- propose changes,
- cannot modify anything.

### Standard

- edit files,
- run normal development commands,
- run tests,
- cannot push or commit.

### Autonomous

- edit files,
- execute commands,
- install dependencies,
- run tests,
- continue working without frequent approval.

Regardless of autonomy level, destructive or externally consequential operations should remain separately controllable.

---

# 11. Agent Execution View

During execution, the interface should prioritize meaningful progress rather than raw logs.

Example:

```text
Add password reset

● Working

✓ Inspected authentication flow
✓ Located User model
✓ Added reset token model
● Implementing reset endpoint
○ Adding UI
○ Running tests
```

Detailed logs should remain available behind something like:

```text
View activity
View terminal
View raw agent output
```

The user should not need to monitor terminal output to understand what is happening.

---

# 12. Verification

Agent completion and task completion are different concepts.

An agent may say:

> Done.

The application should then enter a separate **Verification** stage.

Possible checks include:

```text
Verification

✓ TypeScript
✓ ESLint
✓ Unit tests
✓ Build

○ Browser test
○ Integration tests
○ Visual comparison
```

Verification commands may initially be configured per repository.

Example:

```json
{
  "verification": [
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build"
  ]
}
```

Future versions should automatically infer common project commands.

Verification results should become permanent metadata associated with the task.

---

# 13. Review Model

Review is one of the most important differentiators of the product.

Traditional Git interfaces immediately expose raw file diffs.

This application should instead provide review at multiple levels.

```text
LEVEL 1
Task summary

      ↓

LEVEL 2
Logical changes

      ↓

LEVEL 3
Files

      ↓

LEVEL 4
Raw diff / code
```

---

# 14. Review Level 1 — Summary

Example:

```text
Password Reset
────────────────────────────────

Added password reset functionality.

6 files changed
+184  -23

✓ Reset API
✓ Reset form
✓ Token validation
✓ Tests

Verification

✓ TypeScript
✓ Tests — 24 passed
✓ Build

[ Review Changes ]
```

The summary should answer:

- What changed?
- Why?
- How much changed?
- Did verification succeed?
- Are there warnings?

---

# 15. Review Level 2 — Logical Changes

Changes should be grouped semantically instead of only by file.

Example:

```text
DATABASE

+ PasswordReset model
  Stores temporary password reset tokens.


SERVER

+ POST /api/auth/reset
  Generates reset token.

+ POST /api/auth/reset/confirm
  Validates token and updates password.


UI

+ ForgotPasswordForm
+ ResetPasswordForm


SECURITY

• Tokens expire after 30 minutes.
• Tokens can only be used once.
```

Each logical change may expose:

```text
[ Explain ]
[ Inspect code ]
[ View diff ]
[ Request change ]
```

---

# 16. Review Level 3 — Files

Traditional changed-file navigation remains available.

Example:

```text
6 changed files

M src/lib/auth.ts
M src/app/login/page.tsx
+ src/app/reset/page.tsx
+ src/api/reset/route.ts
M prisma/schema.prisma
+ tests/reset.test.ts
```

Selecting a file displays its changes.

---

# 17. Review Level 4 — Raw Diff

Raw Git diff remains the ultimate source of truth.

The application should expose:

- unified diff,
- side-by-side diff,
- surrounding code,
- syntax highlighting,
- changed-line navigation.

Monaco's Diff Editor can provide much of this interface.

---

# 18. Ask About Changes

Any meaningful change should be question-able.

Examples:

```text
Why was this file changed?

Explain this function.

Was this change required by my original request?

Could this break existing authentication?

Why did you add this dependency?

Can this be implemented without modifying this file?
```

The agent answering these questions should receive:

- the original task,
- previous conversation,
- relevant file,
- relevant diff,
- repository context.

This transforms review into a conversation rather than passive diff inspection.

---

# 19. Requesting Changes

The user should be able to select:

```text
[ Request Changes ]
```

and provide instructions such as:

```text
Don't add another dependency for this.

Use the existing validation utility instead.
```

The same task then returns to the working state.

The existing task context remains intact.

```text
REVIEW
  ↓
CHANGES REQUESTED
  ↓
AGENT
  ↓
VERIFY
  ↓
REVIEW
```

This loop may occur multiple times.

---

# 20. Approval

Approval represents a meaningful human decision.

Example:

```text
Ready to approve

6 files changed
+184  -23

Verification
✓ lint
✓ typecheck
✓ tests
✓ build

[ Approve Task ]
```

Approval should not necessarily mean immediate push.

The initial implementation can translate approval into:

```text
git add
git commit
```

Possible subsequent actions:

```text
[ Merge into main ]

[ Push branch ]

[ Create PR ]
```

The user should still be able to access the underlying Git operations if desired.

---

# 21. Git Philosophy

Git should be foundational but mostly invisible.

The product should prefer concepts such as:

```text
Approve
Revert
Ship
Merge
Publish
```

instead of always requiring:

```text
Stage
Unstage
Commit
Push
Fetch
Merge
```

However, advanced Git controls should remain available.

This creates two conceptual layers:

```text
PRODUCT LANGUAGE

Approve task
Ship task
Undo change

        ↓

GIT IMPLEMENTATION

git add
git commit
git merge
git reset
git push
```

---

# 22. Code Editor

The product still requires an excellent code editor.

However, the editor is secondary to the agent workflow.

Its main purposes are:

- inspect implementation,
- understand surrounding code,
- make small manual changes,
- navigate references,
- resolve conflicts,
- debug unusual situations.

Initial editor capabilities:

- Monaco Editor,
- syntax highlighting,
- multiple files,
- tabs,
- find/replace,
- basic language intelligence,
- diff editor.

Advanced IDE functionality should not be prioritized until the core agent workflow is excellent.

---

# 23. Terminal

A terminal should exist but should not dominate the product.

Uses:

- observe agent commands,
- run manual commands,
- inspect development output,
- start dev servers,
- debug unusual problems.

Recommended implementation:

```text
xterm.js
+
node-pty
```

The application should manage background processes separately rather than requiring everything to live inside visible terminal sessions.

---

# 24. Development History

Git history should become richer than a list of commits.

Each completed task should preserve:

```text
Task

Original request
Agent conversation
Implementation summary
Files changed
Verification results
Review conversation
Commit(s)
Date
Agent/model
```

Example:

```text
Add webhook retry support
August 17, 2026

Original request

"We're occasionally losing Stripe
webhooks when the API is unavailable..."

Agent
Codex

Changes
8 files

Verification
✓ tests
✓ build
✓ typecheck

Commit
8af42ca

[ View Conversation ]
[ View Changes ]
```

The long-term goal is to preserve **why software changed**, not only what changed.

---

# 25. Primary Navigation

The application should avoid the complexity of a traditional IDE sidebar.

Initial navigation could contain only:

```text
PROJECT

Tasks
Changes
History
Code
```

Potential layout:

```text
┌───────────────────────────────────────────────────────┐
│ Project Name                       main ✓      Settings│
├─────────────┬─────────────────────────────────────────┤
│             │                                         │
│ Tasks       │                                         │
│ Changes     │             Main Content                │
│ History     │                                         │
│ Code        │                                         │
│             │                                         │
├─────────────┴─────────────────────────────────────────┤
│ main • clean                              origin/main │
└───────────────────────────────────────────────────────┘
```

This navigation should remain extremely restrained.

---

# 26. Project Dashboard

Opening a repository should initially show its development state rather than automatically opening a code file.

Example:

```text
my-project

main ✓
No uncommitted changes


Active Tasks

● Add password reset
  Agent working

○ Improve mobile navbar
  Ready for review


Recent

✓ Update Stripe SDK
✓ Fix checkout validation


                 + New Task
```

The repository becomes a workspace containing development activity.

---

# 27. Parallel Work

The architecture should support multiple tasks eventually.

Example:

```text
Active Tasks

● Password reset       Codex
● Dashboard redesign   Claude
○ Stripe migration     Waiting for review
```

Git worktrees provide the technical isolation required for this.

Parallel execution does not need to exist in v0.1, but the architecture should avoid making it impossible later.

---

# 28. Application Architecture

Recommended high-level architecture:

```text
┌────────────────────────────────────────────┐
│                 UI                         │
│                                            │
│ Tasks   Review   History   Code            │
└──────────────────┬─────────────────────────┘
                   │
                   │ IPC
                   ▼
┌────────────────────────────────────────────┐
│              CORE ENGINE                   │
│                                            │
│ ProjectManager                             │
│ TaskManager                                │
│ AgentManager                               │
│ GitService                                 │
│ WorktreeManager                            │
│ VerificationService                        │
│ ProcessManager                             │
│ HistoryService                             │
└──────────┬──────────────┬──────────────────┘
           │              │
           ▼              ▼
        Agents          System
           │              │
     Codex/Claude      Git / Files
                      Shell / Processes
```

---

# 29. Frontend Stack

Initial recommendation:

```text
Electron
React
TypeScript
Vite
```

State management:

```text
Zustand
```

Possible UI primitives:

```text
Radix UI
```

Styling:

```text
Tailwind CSS
```

The visual design should remain custom and restrained rather than resembling a standard dashboard template.

---

# 30. Desktop Runtime

Use:

```text
Electron
```

Primary reasons:

- Node.js integration,
- subprocess management,
- shell integration,
- filesystem access,
- Git process management,
- agent CLI integration,
- terminal processes,
- file watching,
- familiarity with TypeScript.

Tauri may be reconsidered later if application size or resource usage becomes an important issue.

---

# 31. Persistence

Use local persistence for product metadata.

Recommended:

```text
SQLite
+
Drizzle ORM
```

SQLite stores application-specific information such as:

```text
projects
tasks
agent_sessions
messages
verification_runs
review_events
task_metadata
```

Git remains responsible for source history.

SQLite should not duplicate source-code version control.

---

# 32. Git Layer

The application should use the system Git executable.

Example service:

```ts
interface GitService {
  status(repo: string): Promise<GitStatus>;
  diff(repo: string): Promise<GitDiff>;
  createBranch(name: string): Promise<void>;
  createWorktree(...): Promise<Worktree>;
  commit(message: string): Promise<string>;
  merge(branch: string): Promise<void>;
  push(branch: string): Promise<void>;
}
```

Internally this may execute:

```text
git status
git diff
git branch
git worktree
git add
git commit
git merge
git push
```

The React UI should never directly execute Git commands.

---

# 33. Process Layer

Agent CLIs and development tools should run through a centralized process manager.

Example:

```ts
ProcessManager.spawn()
ProcessManager.kill()
ProcessManager.streamOutput()
ProcessManager.getStatus()
```

This layer may manage:

- Codex,
- Claude,
- npm,
- pnpm,
- tests,
- dev servers,
- build processes,
- shell commands.

This prevents process management logic from spreading throughout the application.

---

# 34. Repository Structure

Initial monorepo-style structure:

```text
/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   ├── renderer/
│       │   └── preload/
│       │
│       └── package.json
│
├── packages/
│   ├── core/
│   │   ├── tasks/
│   │   ├── agents/
│   │   ├── git/
│   │   ├── worktrees/
│   │   ├── verification/
│   │   └── processes/
│   │
│   ├── agents/
│   │   ├── codex/
│   │   └── claude/
│   │
│   ├── database/
│   │
│   └── shared/
│
├── package.json
└── README.md
```

The exact structure may change during implementation.

The important architectural principle is:

**UI logic and development-engine logic must remain separated.**

---

# 35. IPC Boundary

Electron renderer code should not receive unrestricted Node.js access.

Use a preload layer with explicit APIs.

Example:

```ts
window.app.tasks.create(...)
window.app.tasks.approve(...)
window.app.git.getChanges(...)
window.app.agent.sendMessage(...)
```

Instead of exposing:

```ts
require("child_process")
```

inside React.

This improves:

- security,
- maintainability,
- testability,
- architecture clarity.

---

# 36. Version 0.1 Scope

The first prototype should prove the central workflow.

It does not need to be a complete IDE.

## Required

### Repository

- Open local Git repository.
- Read repository status.
- Detect current branch.

### Tasks

- Create task.
- Store task metadata.
- Create task branch.
- Create Git worktree.

### Agent

Support one agent initially.

Recommended first target:

```text
Codex
```

or whichever agent interface is easiest to integrate reliably at implementation time.

The architecture must still use an adapter.

### Execution

- Launch agent inside task worktree.
- Display basic progress/output.
- Allow follow-up message.
- Cancel task.

### Changes

- Detect changed files.
- Display Git diff.
- Display change statistics.

### Review

- Display agent-generated summary.
- Inspect files.
- Inspect raw diff.
- Ask agent follow-up questions.

### Verification

- Configure verification commands.
- Execute them.
- Record success/failure.

### Approval

- Approve task.
- Create commit.
- Display resulting commit.

---

# 37. Explicitly Out of Scope for v0.1

Do not initially build:

- extension marketplace,
- debugger,
- remote SSH,
- cloud accounts,
- real-time collaboration,
- pull request management,
- GitHub Issues integration,
- multiple simultaneous agents,
- automatic browser testing,
- visual regression testing,
- AI-generated risk scoring,
- full LSP infrastructure,
- deep project indexing,
- multi-device sync,
- cloud task history,
- complex Git history editing,
- custom plugin ecosystem.

These features may become valuable later.

They should not distract from proving the primary workflow.

---

# 38. v0.1 Success Criteria

The prototype is successful when the following scenario works reliably:

```text
1. Open an existing Git repository.

2. Create:
   "Change the homepage heading."

3. Application creates an isolated task.

4. Agent receives the repository and request.

5. Agent modifies the project.

6. Application shows:
   - what changed,
   - changed files,
   - raw diff.

7. Application runs verification.

8. User reviews the result.

9. User asks a question or requests a correction.

10. Agent updates the implementation.

11. Verification runs again.

12. User approves.

13. Application creates the Git commit.
```

If this experience feels dramatically simpler than:

```text
Open Codex
→ run task
→ open GitHub Desktop
→ inspect changes
→ go back to Codex
→ ask correction
→ return to GitHub Desktop
→ commit
```

then the central product hypothesis has been validated.

---

# 39. Development Milestones

## Milestone 0 — Workflow Prototype

No emphasis on visual polish.

Build:

```text
Open repo
→ Create task
→ Create worktree
→ Run agent
→ Show diff
→ Approve
→ Commit
```

Goal:

Prove that the architecture works.

---

## Milestone 1 — Usable Application

Add:

- project dashboard,
- task history,
- proper review experience,
- verification,
- follow-up conversations,
- Monaco diff viewer,
- persistent SQLite storage.

Goal:

Use the application for real development work.

---

## Milestone 2 — Daily Driver

Add:

- Monaco code editor,
- terminal,
- branch management,
- better Git operations,
- multiple agent adapters,
- improved task summaries,
- configurable permissions.

Goal:

Begin replacing the existing Codex/Claude + GitHub Desktop workflow.

---

## Milestone 3 — Agent-Native Development

Explore:

- parallel tasks,
- background agents,
- browser verification,
- screenshots,
- automated issue reproduction,
- PR creation,
- semantic review,
- project memory,
- richer development history.

Goal:

Move beyond recreating existing developer tools and begin introducing workflows that are only possible because agents are the primary implementers.

---

# 40. Product Non-Goals

The product should not attempt to become:

### A VS Code replacement based on feature count

Success is not measured by matching every VS Code capability.

### A generic AI chat application

Conversation exists in the context of software tasks.

### A wrapper around one AI provider

Agents are implementation backends.

The workflow is the product.

### A fully autonomous software engineer

Human review remains a fundamental part of the philosophy.

### A Git GUI with AI added

Git is infrastructure.

Tasks and agent work are the higher-level abstraction.

---

# 41. Long-Term Product Hypothesis

Traditional IDEs organize software development primarily around:

```text
Projects
Files
Editors
Terminals
```

An agent-first environment may instead organize development around:

```text
Projects
Intent
Tasks
Changes
Decisions
History
```

Files remain essential, but they cease to be the primary abstraction through which the developer experiences software development.

The long-term opportunity is not merely to create:

> a better place to use coding agents.

It is to investigate what software development looks like when **writing code is no longer the developer's primary interaction with the computer**.

The application should therefore avoid blindly recreating traditional IDE conventions.

Every major feature should be questioned:

> If agent-assisted development had existed before IDEs were invented, would we still design this workflow this way?

That question should guide the product.
