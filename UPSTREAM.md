# Upstream maintenance

Vivlio is an independent desktop application built from the GitHub Desktop
codebase and adapted around code review, editing, and AI coding sessions.

## Foundation

- Upstream project: [GitHub Desktop](https://github.com/desktop/desktop)
- Imported release: `3.6.6`
- Imported commit: `8b85519e733fd98a04c178249d2d10fd8f3db19e`
- Import reviewed: October 16, 2026
- License: MIT; see [`LICENSE`](LICENSE) for the required notices

The upstream repository is configured locally as the `upstream` Git remote.
Its full commit history is intentionally not part of Vivlio's active branch.

## Update policy

GitHub Desktop updates are reviewed selectively rather than merged wholesale.
Security fixes, Git correctness fixes, and relevant platform compatibility
changes should be ported to a short-lived Vivlio branch and verified against
Vivlio's tests and packaged application.

When an upstream change still applies cleanly, it may be cherry-picked. When
Vivlio has changed the affected area, reproduce the corrected behavior and its
tests in Vivlio instead. Port commits should identify the original repository,
commit, issue, or pull request in their commit message.

Product-specific GitHub Desktop changes, branding, telemetry, and unrelated UI
features should not be imported automatically.

## Review record

| Upstream release | Status | Notes |
| --- | --- | --- |
| `3.6.6` | Foundation imported | Starting point for Vivlio |
