# Publishing to the VS Code Marketplace

This extension is ready to package and publish, but **several steps require a
human with Marketplace access**. This repository does not and cannot do them for
you.

## What is already done

- `package.json` has `name`, `displayName`, `version`, `engines.vscode`,
  `categories`, `icon` (256×256 PNG), `license`, `repository`, `homepage`,
  `bugs`, `keywords`, `pricing`.
- `README.md`, `CHANGELOG.md`, `LICENSE` exist at the repository root.
- `LICENSE.txt` and `README.md` are picked up by `vsce` automatically.
- The extension compiles to `out/extension.js` and packages to a `.vsix` with
  **no runtime npm dependencies**.

## What you must do

### 1. Create a Publisher and replace the placeholder

`package.json` currently uses a **placeholder** publisher:

```json
"publisher": "botbridge"
```

1. Go to <https://marketplace.visualstudio.com/manage> and sign in.
2. Click **Create publisher**. Pick a unique **ID** (it appears in the extension
   URL and cannot be changed later) and a display **Name**.
3. Replace `"publisher": "botbridge"` in `package.json` with your real publisher
   **ID**, then commit the change.

> The display name of this extension is **Bot Bridge CC Helper**. Do not rename
> it to anything containing "Claude Code Helper" — it is an independent product
> and is not an Anthropic extension (see the disclaimer in `README.md`).

### 2. Authenticate

Marketplace publishing needs a Microsoft identity with access to that publisher.
Two routes:

**Route A — Entra ID (recommended; the durable route).**

```bash
npx @vscode/vsce login <publisher-id> --azure-credential
```

- Requires **vsce ≥ 2.26.1** (this repo pins `^3.2.1`) and **Node.js 22+**.
  Note: the `@azure/*` packages that back this route declare `node >= 22`, so on
  Node 20 `npm install` prints `EBADENGINE` warnings and this route will not run.
- Add the identity to your publisher as a **Contributor** at
  <https://marketplace.visualstudio.com/manage>.

**Route B — Azure DevOps global PAT (legacy).**

1. Sign in at <https://dev.azure.com> with the **same** Microsoft account.
2. **User settings → Personal access tokens → New Token**.
3. **Organization:** *All accessible organizations*.
4. **Scopes:** *Custom defined* → **Marketplace → Manage**.
5. Copy the token (shown once), then `npx @vscode/vsce login <publisher-id>` and
   paste it.

> **Deadline:** Azure DevOps global PATs are scheduled for **retirement on
> 2026-12-01**. After that date only Route A works. If you are setting this up
> fresh, set up Route A.

### 3. Package and publish

```bash
npm install
npx @vscode/vsce package                  # -> botbridge-cc-helper-0.1.0.vsix
npx @vscode/vsce publish                  # uploads the current version
```

`vsce publish minor` / `vsce publish 1.1.0` bump the version for you.

## Reviewer checklist

Before uploading, confirm:

- [ ] `publisher` in `package.json` matches a real, existing publisher **ID**.
- [ ] `version` is greater than the last published version.
- [ ] The icon is a PNG ≥128×128 (this repo uses 256×256, `media/icon.png`).
- [ ] `README.md` links are `https` and contain no SVG images.
- [ ] `keywords` has ≤30 entries (this repo has 14).
- [ ] `npm run compile` succeeds and `out/extension.js` exists before packaging.
- [ ] The listing text does not imply affiliation with Anthropic or Cursor.

## Known advisories

`npm audit` reports high-severity advisories in the `vsce` **devDependency**
chain (`secretlint → globby → fast-glob → micromatch → braces`). These packages
are build-time only and are **not** included in the `.vsix`, which ships zero
runtime dependencies. They do not affect users of the published extension;
upgrade `@vscode/vsce` when upstream ships a fix.

## What this repository deliberately does **not** do

- It does not push to `main`/`master` on your behalf.
- It does not create publishers, tokens, or Marketplace listings.
- It does not upload, submit for review, or publish anything.

Those are user actions, by design. For other directories (Open VSX,
cursor.directory, MCP registries) see [PLATFORM.md](PLATFORM.md).
