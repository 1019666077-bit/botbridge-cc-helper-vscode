# Bot Bridge CC Helper

**A remote bot dispatches the work; a local Helper on your PC runs it.**

Bot Bridge CC Helper is a dispatch bridge. A bot — Cursor, Grok Bot, or GitHub
Copilot Chat agent mode through this extension — writes one job JSON into a
local **inbox**, a Windows tray/daemon picks it up, runs **Claude Code** with
that prompt, and streams status and progress back to a tray panel you can watch.

This repository is the **free, MIT-licensed VS Code extension**: the front door
and the bridge. It does not run Claude Code itself. The thing that actually runs
and watches the work is the **desktop Helper for Windows**, which is installed
separately — see <https://botbridge.dev/cc-helper>.

- Homepage / install the Helper: <https://botbridge.dev/cc-helper>
- Source: <https://github.com/1019666077-bit/botbridge-cc-helper-vscode>
- Free Cursor / Grok Bot plugin (same playbook): <https://github.com/1019666077-bit/cc-helper-plugin>

> **This is not a Claude Code GUI, not a Claude Code fork, and not an official
> extension.** It is an independent product by Moying Studio, not made by,
> endorsed by, or affiliated with Anthropic (Claude, Claude Code) or Anysphere
> (Cursor). It drives the Claude Code CLI you already have.

> **Publisher note:** this repository ships with a placeholder `publisher`
> (`botbridge`). Before publishing to the Marketplace you must create a real
> publisher and update `package.json` — see [PUBLISHING.md](PUBLISHING.md).

---

## What you get

| Piece | Role |
| --- | --- |
| **This extension** | Detects the local Helper, opens its inbox, dispatches a job by hand, and registers a bundled **MCP server** so agent mode can dispatch too. |
| **Desktop Helper (Windows)** | Tray + daemon that owns the inbox and actually runs Claude Code, with a realtime progress panel. **Separate install, not included here.** |

Without the desktop Helper, this extension still installs and still answers —
every command and every MCP tool will simply tell you that nothing is installed
and point at the download page. It will not pretend to dispatch.

## Requirements

| Requirement | Why |
| --- | --- |
| **VS Code 1.101+** | The MCP server definition provider API (`vscode.lm.registerMcpServerDefinitionProvider`) landed in 1.101. |
| **The desktop Helper (Windows)** | Owns `%USERPROFILE%\cc-helper\` and runs the jobs. Get it from the homepage. |
| **Claude Code CLI** | The Helper invokes it. Install it once on the same machine. |
| **Node.js** | Not required separately: the bridge runs on the Node runtime embedded in VS Code. Set `botbridge-cc-helper.nodePath` to use a different one. |

## Install

### From the Marketplace (once listed)

Search for **Bot Bridge CC Helper** in the Extensions view, or run:

```
ext install botbridge.botbridge-cc-helper
```

### From a `.vsix`

1. Download or build the `.vsix` (see [Building](#building-a-vsix)).
2. In VS Code: **Extensions view → `...` → Install from VSIX…**, or run:

```
code --install-extension botbridge-cc-helper-0.1.0.vsix
```

### First run

1. Install the **desktop Helper** from <https://botbridge.dev/cc-helper> and
   keep its tray running. The installer is delivered on request.
2. Confirm the install: run **Bot Bridge CC Helper: Check Environment** from the
   Command Palette. It reports the Helper folder, the inbox/running/done/control
   folders, and the bridge self-test.
3. Dispatch something:
   - **By hand:** *Bot Bridge CC Helper: Dispatch Task to Local Helper*.
   - **Through a bot:** start the MCP server in the **MCP servers** view and
     confirm VS Code's trust prompt, then ask Copilot Chat agent mode to
     `cc_helper_status` and `cc_helper_dispatch`.

## Commands

| Command | What it does |
| --- | --- |
| **Check Environment** | Prints the Helper folder, which of `daemon.js` / `start-tray.cmd` / `inbox` / `running` / `done` / `control` exist, and runs the bridge self-test. Nothing is dispatched. |
| **Dispatch Task to Local Helper** | Asks for a title and a prompt, then writes one job JSON into `inbox\`. |
| **Open Local Inbox Folder** | Reveals the Helper home in your OS file manager. |
| **Refresh MCP Server** | Re-registers the MCP server definition after a settings change. |
| **Install the Desktop Helper (Windows)** | Opens <https://botbridge.dev/cc-helper>. |
| **Open Homepage** | Same. |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `botbridge-cc-helper.enabled` | `true` | Offer the bridge as an MCP server to VS Code. Turning it off leaves the commands working. |
| `botbridge-cc-helper.helperHome` | `%USERPROFILE%\cc-helper` | Folder of the local Helper install. **Machine scope.** |
| `botbridge-cc-helper.nodePath` | *(VS Code's own Node)* | Node.js executable used to launch the bundled bridge. **Machine scope.** |

## MCP tools

The bundled `scripts/cc-helper-mcp.js` is a dependency-free Node script that
speaks the **same file bridge** the free Cursor/Grok plugin documents — it adds
no protocol of its own.

| Tool | Effect |
| --- | --- |
| `cc_helper_status` | Is the Helper installed, and how many jobs are queued/running/done. |
| `cc_helper_dispatch` | Write one job JSON into `inbox\`. Returns the task id. |
| `cc_helper_task_status` | Read `running\<id>\status.json` + `progress.md`, or `done\<id>\status.json`. |
| `cc_helper_list_tasks` | List queued, running and finished tasks. |
| `cc_helper_stop` | Write `stop` into `control\<id>.cmd`. |

The file bridge, unchanged from the playbook:

```
%USERPROFILE%\cc-helper\
├─ daemon.js
├─ start-tray.cmd
├─ inbox\<id>.json              {"id": "...", "title": "...", "prompt": "..."}
├─ running\<id>\status.json
├─ running\<id>\progress.md
├─ done\<id>\status.json
└─ control\<id>.cmd             contents: stop
```

Jobs are written to a temporary file and renamed into place, so the daemon never
reads a half-written job.

## Free vs. Pro

This extension is **free and MIT-licensed**, and so is the Cursor/Grok plugin.
Both tiers close the same loop: dispatch into the inbox, watch progress, stop a
job.

| | Free (this extension) | Pro — $29/year |
| --- | --- | --- |
| Dispatch from the bot | Yes | Same |
| Progress watch | Tray panel + `progress.md` | Same |
| Stop a running job | Yes (`control\ stop`) | Same |
| Token / budget cap | Soft guidance only | **Hard stop** when the cap hits |
| Stall timeout | — | **Kills** a hung job after N minutes |
| Phone push | — | Bark and/or webhook on blockers |

Pro is a **licence for the local desktop Helper**, sold separately on
<https://botbridge.dev/cc-helper>; it is not sold through the Marketplace, and
nothing in this repository silently enables it.

## Permissions and privacy

| Concern | Behaviour |
| --- | --- |
| What this extension executes | Only the Node runtime plus its own bundled `scripts/cc-helper-mcp.js`. It never launches Claude Code itself. |
| Filesystem | Reads and writes **only** files under `helperHome` (`inbox/`, `running/`, `done/`, `control/`). It never deletes or rewrites your work. |
| Network | The extension makes **no** network calls. The only network use is the one you trigger by clicking a homepage link. |
| Telemetry | None. No usage data is collected or sent. |
| Secrets | Task JSON is plain text on your disk. Do not paste API keys or credentials into a task title or prompt. |

### Security notes

- The two settings that decide **what this extension touches** — `helperHome`
  and `nodePath` — are declared `"scope": "machine"`, and the code additionally
  ignores any workspace-level value. Opening a cloned repository therefore
  cannot redirect the folder jobs are written to, or the executable that is
  launched.
- Task ids are validated against `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` before any
  path is built, so a tool argument cannot escape `helperHome` via `..`.
- VS Code still asks you to **trust/confirm** an extension-provided MCP server
  before it is launched; this extension cannot and does not bypass that prompt.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "no inbox at …" | The desktop Helper is not installed, or `botbridge-cc-helper.helperHome` points somewhere else. |
| Job sits in `inbox\` forever | The Helper tray is not running. Start it (`start-tray.cmd`). |
| MCP server never appears | VS Code 1.101+ is required. Open **MCP: List Servers** and refresh. |
| "not runnable" for the bridge launcher | Set `botbridge-cc-helper.nodePath` to a Node.js executable. |
| Not on Windows | The desktop Helper is Windows-only. This extension can only answer questions about it. |

## Building a `.vsix`

```bash
npm install
npm run package          # -> botbridge-cc-helper-0.1.0.vsix
```

The packaged extension has **no runtime npm dependencies** — `npm install` is
only needed for the TypeScript compiler and `vsce`.

See [PUBLISHING.md](PUBLISHING.md) for the Marketplace submission steps and
[PLATFORM.md](PLATFORM.md) for where else this can be listed.

## License

MIT — see [LICENSE](LICENSE).

## Author

Moying Studio — 东莞市常平创客汇网络技术工作室（个体工商户）, Dongguan, China ·
<https://botbridge.dev/cc-helper> · moying.studio@outlook.com
