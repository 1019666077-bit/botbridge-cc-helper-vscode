# ACCEPT.md — 验收

**产品**：Bot Bridge CC Helper（VS Code 扩展）
**定位**：远程 bot 派活 → 本机 Helper 执行与盯梢
**日期**：2026-10-12
**状态**：代码与打包已完成，**未上架、未 publish**（按约定，上架动作留给人工）

---

## 1. 交付物

| 项 | 值 |
| --- | --- |
| 仓库 | <https://github.com/1019666077-bit/botbridge-cc-helper-vscode> |
| 分支 | `main` |
| 显示名 | `Bot Bridge CC Helper` |
| 扩展 ID | `botbridge.botbridge-cc-helper`（publisher 为占位 `botbridge`） |
| 版本 | `0.1.0` |
| 授权 | MIT（Moying Studio） |
| 打包产物 | `botbridge-cc-helper-0.1.0.vsix`（9 files, 20.91 KB） |
| SHA-256 | `e6ded0dde85a97f08e69cf7fb923cfac99e4ddf6bd5c633f852502579ce936ed` |
| Homepage | <https://botbridge.dev/cc-helper> |

`.vsix` 是**构建产物**，已按 `.gitignore` 排除，不在仓库里；本地用
`npm install && npm run package` 一键重建。

## 2. 都做了什么

**免费薄壳 + 真实可用的桥**，不是空壳引导页：

- **安装引导**：激活时若未检测到本机 Helper，弹**一次性**非阻塞提示（`Open setup guide` / `Later`），之后不再打扰；状态栏常驻 `CC Helper / CC Helper: install`。
- **打开 homepage**：命令 `Install the Desktop Helper (Windows)` 与 `Open Homepage` 均打开 <https://botbridge.dev/cc-helper>。
- **MCP 真的接了**：随包 `scripts/cc-helper-mcp.js`（零依赖、Node 内建模块）注册为 stdio MCP server，暴露 5 个工具，走的是与免费 Cursor/Grok 插件**完全相同**的文件桥协议，没有自创协议。
- **soft Pro 提示**：$29/年，仅在一次**成功派活之后**出现一次，`See Pro` / `Not now` 都不阻断任何功能。
- **命令**：Check Environment / Dispatch Task / Open Inbox Folder / Refresh MCP Server / Install the Desktop Helper / Open Homepage。

### 关键实现与安全

| 点 | 做法 |
| --- | --- |
| 文件桥 | `%USERPROFILE%\cc-helper\{inbox,running,done,control}`，job JSON 为 `{id,title,prompt}`，与 `cc-helper-plugin` 的 playbook 逐字一致 |
| 半写保护 | 先写 `.tmp-<pid>` 再 `rename` 进 inbox，daemon 不会读到半个 JSON |
| 路径穿越 | task id 先过 `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` 才拼路径（已实测 `../../etc/passwd` 被拒） |
| 供应链 | `helperHome` / `nodePath` 声明 `"scope": "machine"` 且代码只读 user/machine 级，克隆仓库无法改写入目录或改启动的可执行文件 |
| 运行期依赖 | **零**。桥只用 Node 内建模块；默认复用 VS Code 自带 Node 运行时，不要求另装 Node |
| 不越界 | 扩展**不**运行 Claude Code、不发网络请求、无遥测、不读写 `helperHome` 以外的文件 |

### 实测记录

- `npm run compile` → `out/extension.js` 生成，无 TS 报错（strict + noUnusedLocals）。
- 桥协议实测：`initialize` 回显客户端 protocolVersion、`tools/list` 返回 5 工具、`ping`、`tools/call` 成功与失败路径、未知方法回 `-32601`、坏 JSON 回 `-32700`。
- 空 Helper 环境实测：`cc_helper_status` 如实报「未安装」并给下载链接；`cc_helper_dispatch` 报错而不是假装成功。
- 假 Helper 环境实测：dispatch 写出 `inbox\task-*.json`、`list_tasks` 正确计数、`cc_helper_stop` 写出 `control\<id>.cmd` 内容 `stop`。
- `npx vsce package` 通过，产物含 `readme.md` / `changelog.md` / `LICENSE.txt` / `icon.png` / `out/extension.js` / `scripts/cc-helper-mcp.js`。

### 口径（合规）

- 显示名全程 **Bot Bridge CC Helper**，全文未出现 "Claude Code Helper"（PUBLISHING.md 里那句是**禁止使用**的提醒）。
- README/落地页一致声明：**不是 Claude Code GUI、不是 Claude Code 分支、不是官方扩展**，与 Anthropic / Cursor 无关联，驱动的是用户自己的 Claude Code CLI。
- 免费插件 MIT；Pro $29/年只卖**本机 Helper 授权**，不在 Marketplace 卖。

## 3. 还差用户哪几步（才能真正上架）

代码这边没有了，剩下的全是要真人账号的动作：

1. **建 publisher**：<https://marketplace.visualstudio.com/manage> → Create publisher，拿到唯一 ID。
2. **改占位**：把 `package.json` 里 `"publisher": "botbridge"` 换成真 ID，提交。
3. **认证**（二选一）：
   - 推荐 **Entra ID**：`npx @vscode/vsce login <id> --azure-credential`。注意这条要 **Node 22+**（本机是 Node 20，`npm install` 会打 `EBADENGINE` 警告，这条路线跑不起来），并把该身份加成 publisher 的 **Contributor**。
   - 旧的 Azure DevOps 全局 PAT 仍可用，但**2026-12-01 退役**。
4. **发布**：`npx @vscode/vsce publish`。
5. **（可选，但强烈建议）Open VSX**：Cursor / VSCodium 用户走 Open VSX，需**另注册 Eclipse 账号** + `npx ovsx create-namespace botbridge`，然后 `npx ovsx publish <同一个 vsix>`。免费，复用同一个 `.vsix`。

细节见 [PUBLISHING.md](PUBLISHING.md)；其余目录见 [PLATFORM.md](PLATFORM.md)。

## 4. 明确没做的事

- **没 publish、没提交任何市场审核**，一个平台都没交。
- **没建 publisher、没申请任何 token**。
- 没在 Marketplace 上架 Pro 付费项（Pro 只在落地页卖）。
- 没花 Cursor 云端额度；没动其他仓库。

> 注：`npm audit` 报的 6 个 high 全在 `vsce` 的 **devDependency** 链上（`secretlint → globby → fast-glob → micromatch → braces`），属构建期，`.vsix` 不含任何 runtime 依赖，不影响使用者。
