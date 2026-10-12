# Changelog

All notable changes to **Bot Bridge CC Helper** (the VS Code extension) are
documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-12

### Added

- Initial release: a thin VS Code front door for a local Bot Bridge CC Helper
  install on Windows.
- Bundled stdio **MCP server** (`scripts/cc-helper-mcp.js`) exposing
  `cc_helper_status`, `cc_helper_dispatch`, `cc_helper_task_status`,
  `cc_helper_list_tasks` and `cc_helper_stop` over the same file bridge the free
  Cursor/Grok plugin documents.
- Commands: **Check Environment**, **Dispatch Task to Local Helper**,
  **Open Local Inbox Folder**, **Refresh MCP Server**, **Install the Desktop
  Helper (Windows)**, **Open Homepage**.
- Settings: `enabled`, `helperHome` (machine scope), `nodePath` (machine scope).
- One-time, non-blocking install nudge when no local Helper is detected, and a
  one-time soft Pro hint ($29/year) after a successful dispatch.
- Status bar entry showing whether the local Helper was found.

### Security

- `helperHome` and `nodePath` are `"scope": "machine"` and are read from
  user/machine scope only, so a cloned workspace cannot redirect which folder
  job files are written to or which executable is launched.
- Task ids are validated before path construction, blocking `..` traversal.
- Jobs are written to a temp file and renamed into place to avoid partial reads
  by the Helper daemon.

### Notes

- No runtime npm dependencies: the bridge uses Node builtins only, and the
  extension reuses the Node runtime embedded in VS Code by default.
- The extension does not run Claude Code, does not upload anything, and
  collects no telemetry.
