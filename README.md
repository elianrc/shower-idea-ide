# Vivlio

Vivlio is a repository-centered desktop workspace for reviewing Git changes,
editing code, and managing Codex and Claude Code sessions in one place.

The product combines three workflows without making autonomous agents the
center of the experience:

- **Review:** the complete Git and GitHub workflow inherited from GitHub
  Desktop—repositories, branches, diffs, history, commits, remotes, and pull
  requests.
- **Code:** a Monaco-based editor, file tree, search, and diff-aware editing.
- **Sessions:** durable Codex and Claude Code conversations tied to the current
  repository, branch, worktree, and resulting changes.

The guiding principle is simple: AI can propose and execute work, but Vivlio
keeps the user close to the code and makes review a first-class step.

## Current status

Vivlio is being rebuilt on the GitHub Desktop codebase. The inherited Git
workflow builds and passes its baseline test suite. The current implementation
adds Vivlio product identity, safe network defaults, and the first
repository-level **Review / Code / Sessions** workspace shell.

Code and Sessions are visible foundations, not completed features yet. See the
[product definition](docs/product-definition.md) and
[reimplementation plan](docs/reimplementation-plan.md) for the intended scope
and delivery sequence.

## Development

The repository pins Node.js in `.node-version` and `.nvmrc` and uses Yarn 1.

```sh
yarn install --frozen-lockfile
yarn build:dev
yarn start
```

Useful checks:

```sh
yarn test:unit
yarn lint
```

GitHub sign-in requires a Vivlio-owned OAuth application. Builds do not fall
back to GitHub Desktop credentials.

```sh
export VIVLIO_GITHUB_OAUTH_CLIENT_ID=...
export VIVLIO_GITHUB_OAUTH_CLIENT_SECRET=...
```

The following release services are disabled unless their Vivlio-owned URLs are
provided by the build environment:

- `VIVLIO_UPDATES_URL`
- `VIVLIO_RELEASE_NOTES_URL`
- `VIVLIO_USAGE_REPORTING_ENDPOINT`
- `VIVLIO_ERROR_REPORTING_ENDPOINT`
- `VIVLIO_NON_FATAL_ERROR_REPORTING_ENDPOINT`

## Upstream foundations

Vivlio is an independent application built from open-source foundations:

- [GitHub Desktop](https://github.com/desktop/desktop), MIT licensed, provides
  the desktop Git foundation.
- [T3 Code](https://github.com/pingdotgg/t3code), MIT licensed, is a reference
  for multi-provider coding-session UX and architecture.
- [Monaco Editor](https://github.com/microsoft/monaco-editor), MIT licensed,
  will provide the embedded editor.

GitHub, GitHub Desktop, Claude, Claude Code, Codex, VS Code, and Monaco are
trademarks of their respective owners. Vivlio is not affiliated with or
endorsed by them.

## License

The repository is licensed under the MIT License. Existing upstream copyright
notices and third-party attributions are retained.
