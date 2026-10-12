# PLATFORM.md — where this extension can be listed

Short checklist of the directories that matter for **Bot Bridge CC Helper (VS
Code extension)**, what is already submitted, and what each remaining one needs.

Legend: **✅ 已交** = submitted and waiting on the platform · **⬜ 未交** =
nothing submitted yet · **🚫 不适用** = do not submit here, with the reason.

**Current state: nothing has been submitted anywhere yet.** Every row below is
⬜ or 🚫.

---

## 1. VS Code Marketplace — ⬜ 未交

The primary target. Blocked on a human, not on code.

**Still needed:**

1. Create a real publisher at <https://marketplace.visualstudio.com/manage>
   (the repo currently ships the placeholder `botbridge`).
2. Replace `"publisher"` in `package.json` with that publisher ID.
3. Authenticate: Entra ID route (`vsce login --azure-credential`, needs vsce
   ≥ 2.26.1 and **Node 22+**), or the legacy Azure DevOps global PAT.
4. `npx @vscode/vsce publish`.

Full steps, including the **2026-12-01 Azure DevOps PAT retirement** note:
[PUBLISHING.md](PUBLISHING.md).

## 2. Open VSX — ⬜ 未交

**This is the route to Cursor and VSCodium users.** Their extension panels read
Open VSX, not the Microsoft Marketplace; without an Open VSX listing those users
can only *Install from VSIX* by hand. Free.

**Still needed:**

1. A **separate Eclipse Foundation account** at <https://open-vsx.org> — this is
   not a Microsoft account, and the GitHub account you sign in with must match
   the one registered to the Eclipse account.
2. Claim a namespace: `npx ovsx create-namespace botbridge -p <token>` (the
   namespace must match the `publisher` field).
3. `npx ovsx publish botbridge-cc-helper-0.1.0.vsix -p <token>`.

The same `.vsix` is reused; nothing needs to be rebuilt.

## 3. cursor.directory — ⬜ 未交

A community directory that accepts plugin/extension submissions through a web
form. Free for a basic listing; paid tiers only buy a featured slot.

**Still needed:** submit the GitHub repository URL at
<https://cursor.directory/plugins/new>. The site reads the repository and picks
up components from the Open Plugins convention, so the repo needs to be public
and pushed first (it is).

**Caveat:** cursor.directory is primarily a *Cursor* directory. This repository
is a VS Code extension. Submit the **Cursor plugin** for the same product
(<https://github.com/1019666077-bit/cc-helper-plugin>) rather than this one, or
submit both and let the site classify them. Do not describe a VS Code extension
as a Cursor plugin.

## 4. Cursor official Marketplace — 🚫 不适用

Two independent blockers:

- It lists **Cursor** plugins, not VS Code extensions. That role is filled by
  the sibling repo <https://github.com/1019666077-bit/cc-helper-plugin>, which
  is already **submitted for Cursor Marketplace review** (not listed yet).
- Cursor's publisher terms (§3.1) require listed plugins to be free and open
  source. The $29/year Pro licence **cannot** be sold through it — Pro is sold
  only on <https://botbridge.dev/cc-helper>. This is why the product is split
  into a free marketplace layer plus a paid local Helper.

## 5. MCP registries — 🚫 不适用 (as-is)

**Smithery, Glama, the official MCP registry, mcp.so, Cline marketplace** and
similar directories accept **standalone, independently distributable MCP
servers**. The MCP server bundled here is a file bridge to a **local Windows
Helper** — it is useless without that install, and it is not published as its
own npm package. Submitting it would list something no one can run.

**If we ever want these listings**, the work is: publish the bridge as a
standalone npm package with its own `bin`, document it as "requires a local Bot
Bridge CC Helper install", and submit *that*. Until then, skip.

**Do not list on:** PulseMCP (stopped accepting submissions on **2026-09-03**) or
Continue Hub (retired). Both are dead ends.

---

## Summary

| Directory | Status | Reuses the same `.vsix`? | Blocked on |
| --- | --- | --- | --- |
| VS Code Marketplace | ⬜ 未交 | — | real publisher + auth token (human) |
| Open VSX | ⬜ 未交 | yes | Eclipse account + namespace (human) |
| cursor.directory | ⬜ 未交 | n/a (repo URL) | web form submission (human) |
| Cursor official Marketplace | 🚫 | n/a | free-only terms; sibling plugin already submitted |
| MCP registries | 🚫 | no | needs a standalone npm-published MCP server |
| PulseMCP / Continue Hub | 🚫 | — | closed / retired |

Nothing here has been submitted on your behalf, and this repository performs no
upload, submission, or publish action.
