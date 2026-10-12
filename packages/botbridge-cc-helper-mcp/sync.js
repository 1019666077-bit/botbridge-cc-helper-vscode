#!/usr/bin/env node
/*
 * Keep the published bridge byte-identical to the copy that ships inside the
 * VS Code extension.
 *
 * Source of truth: <repo>/scripts/cc-helper-mcp.js
 * Published copy:  ./bin/botbridge-cc-helper-mcp.js
 *
 *   node sync.js           copy source -> published copy (no-op if identical)
 *   node sync.js --check   exit 1 if they differ, write nothing
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '..', '..', 'scripts', 'cc-helper-mcp.js');
const target = path.resolve(__dirname, 'bin', 'botbridge-cc-helper-mcp.js');
const checkOnly = process.argv.includes('--check');

let src;
try {
  src = fs.readFileSync(source);
} catch (err) {
  process.stderr.write(`cannot read source of truth ${source}: ${err.message}\n`);
  process.exit(1);
}

let cur = null;
try {
  cur = fs.readFileSync(target);
} catch {
  /* first run — target does not exist yet */
}

if (cur && src.equals(cur)) {
  process.stdout.write('bridge is in sync\n');
  process.exit(0);
}

if (checkOnly) {
  process.stderr.write(
    'bridge is OUT OF SYNC with scripts/cc-helper-mcp.js — run `npm run sync`\n'
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, src);
fs.chmodSync(target, 0o755);
process.stdout.write(`synced -> ${path.relative(process.cwd(), target)}\n`);
