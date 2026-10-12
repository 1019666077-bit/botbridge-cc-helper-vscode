# botbridge-cc-helper-mcp

An MCP **stdio** server that bridges a remote bot (any MCP client) to a **local
Bot Bridge CC Helper** running on Windows. You dispatch a coding task into the
Helper's inbox and read progress and results back out.

> **Independent product.** This is not an Anthropic product and is not
> affiliated with, endorsed by, or sponsored by Anthropic. It talks to a local
> Bot Bridge CC Helper install that you run yourself.

## Requirements

This package is a **file bridge**. It is useful only together with a local
Bot Bridge CC Helper install — the desktop tray/daemon that actually owns the
job folders and runs your local coding agent. Without that install every tool
still answers, but reports that nothing is installed.

- Node.js **>= 18**
- A local Bot Bridge CC Helper install (**Windows**), which owns:
  - `inbox\` — one JSON file per queued job
  - `running\` — per-job progress while a job runs
  - `done\` — final state per job
  - `control\` — cancellation commands

The Helper folder defaults to `%USERPROFILE%\cc-helper` and can be pointed
elsewhere with the `CC_HELPER_HOME` environment variable.

## Install

```bash
npm install -g botbridge-cc-helper-mcp
```

Or run it without installing:

```bash
npx -y botbridge-cc-helper-mcp
```

## Usage

The server speaks MCP over stdio, so your MCP client launches it:

```json
{
  "mcpServers": {
    "cc-helper": {
      "command": "npx",
      "args": ["-y", "botbridge-cc-helper-mcp"],
      "env": {
        "CC_HELPER_HOME": "C:\\Users\\you\\cc-helper"
      }
    }
  }
}
```

`CC_HELPER_HOME` is optional; omit it to use `%USERPROFILE%\cc-helper`.

Check the install from a terminal:

```bash
npx -y botbridge-cc-helper-mcp --selftest
```

## Tools

| Tool | What it does |
|------|--------------|
| `cc_helper_status` | Report whether a local Helper install is present and where its folders are. |
| `cc_helper_dispatch` | Queue a job (`{ id, title, prompt }`) into `inbox\` for the local Helper to pick up. |
| `cc_helper_task_status` | Read one job's state from `running\` / `done\`. |
| `cc_helper_list_tasks` | List queued, running, and finished jobs. |
| `cc_helper_stop` | Write a `stop` control command to cancel a running job. |

## Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `CC_HELPER_HOME` | `%USERPROFILE%\cc-helper` on Windows, `~/cc-helper` elsewhere | Folder the bridge reads and writes job files in. |

## Source

The bridge ships byte-identical inside the
[Bot Bridge CC Helper](https://github.com/1019666077-bit/botbridge-cc-helper-vscode)
VS Code extension as `scripts/cc-helper-mcp.js`, which is the source of truth.
`npm run sync` refreshes `bin/botbridge-cc-helper-mcp.js` from it; `prepack`
fails the build if the two ever drift apart.

## License

MIT. See [LICENSE](LICENSE).
