# Vivlio v1 UI specification

**Status:** Implementation specification

**Scope:** GitHub Desktop with an integrated Monaco editor

**Primary target:** Desktop, dark theme first

## Product boundary

Vivlio v1 preserves GitHub Desktop's repository, branch, history, staging,
commit, synchronization, conflict, and recovery behavior. The release adds a
focused source editor to the existing repository view; it does not introduce a
second task model or an AI workspace.

The primary shell is:

```text
Native title bar
Toolbar: repository | branch | fetch/pull/push
Repository view
├── Sidebar: Changes | History | Files
└── Content: diff, history, or Monaco editor
```

There is no Review / Code / Sessions mode bar in v1. AI session UI and the
earlier violet accent are not part of this release.

## Interaction rules

- Changes and History retain their inherited GitHub Desktop behavior.
- Files opens the repository explorer in the existing sidebar and Monaco in the
  content pane.
- A changed file can switch between Diff and Edit without changing staging.
- Saving an editor document writes an ordinary working-tree change. GitHub
  Desktop remains responsible for detecting and presenting repository status.
- Unsaved edits are protected when closing a document, changing repository, or
  detecting an external disk change.
- Commit, discard, push, force-push, merge, rebase, and reset remain explicit
  user actions.

## Visual direction

- One accent color: blue `#2e6fd6`.
- Dense desktop layout with system UI fonts and the existing monospace stack.
- Hierarchy comes from stepped dark surfaces and one-pixel borders, not panel
  shadows.
- Selected rows use the accent with white text.
- Git status and staging state use glyphs in addition to color.
- New styling maps onto GitHub Desktop's semantic CSS variables. Editor-only
  values use additional semantic variables instead of hard-coded component
  colors.
- Existing light-theme values remain functional. A separate high-fidelity
  light-theme design is deferred.

## V1 screens

### Changes

- Three equal sidebar tabs: Changes, History, Files.
- Existing filter, check-all behavior, partial staging, file selection, commit
  form, warnings, and undo affordances remain intact.
- Changed-file rows use compact status glyphs and a strong selected state.
- The content header exposes a Diff / Edit segmented control for editable text
  files while retaining the existing diff-options menu.
- Diff styling uses the shared dark palette and makes excluded lines legible
  without relying on color alone.

### Files

- The sidebar contains a repository file filter, optional changed-files filter,
  tree, changed-file decorations, and a Review changes action.
- The content pane contains editor tabs, path breadcrumb, Monaco, external
  change warnings, explicit save, and a compact status bar.
- Files already open in the editor retain their unsaved state while navigating
  between Changes, History, and Files.

## Accessibility and layout

- Interactive elements use native buttons, inputs, labels, and tab semantics.
- Focus is visible and uses the blue focus token.
- Status is never communicated by color alone.
- Text tokens target WCAG AA. The visual reference's line-number colors are
  adjusted lighter because their supplied values do not reach 4.5:1.
- The repository sidebar remains resizable and the view must work at
  1024 by 640 without horizontal window scrolling.
- Reduced-motion preferences are respected.

## Explicitly deferred

The reference mockups include product capabilities that do not exist in the
current GitHub Desktop foundation and are not UI-only work. Vivlio v1 does not
show inactive placeholders for them:

- integrated terminal and bottom drawer;
- project-check discovery, execution, freshness, or `.vivlio/checks.toml`;
- diagnostics derived from pytest, ruff, mypy, or package scripts;
- Monaco symbol breadcrumbs and check-provided problem cards;
- Git-index line decorations in the editor;
- AI or agent sessions.

These may be specified and implemented as later functional releases.
