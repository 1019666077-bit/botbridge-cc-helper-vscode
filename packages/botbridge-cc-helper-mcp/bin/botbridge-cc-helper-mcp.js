#!/usr/bin/env node
/*
 * Bot Bridge CC Helper — bundled stdio bridge (MCP).
 *
 * This file ships with the Bot Bridge CC Helper VS Code extension and is
 * launched as a stdio MCP server, either by VS Code or by hand:
 *
 *     node scripts/cc-helper-mcp.js
 *
 * It is deliberately dependency-free (Node builtins only) and contains no
 * dispatch logic of its own. It speaks the *file bridge* that the local
 * Windows Bot Bridge CC Helper already owns, exactly as documented in the
 * free `cc-helper-dispatch` plugin playbook:
 *
 *     <home>\inbox\<id>.json          one job: {"id","title","prompt"}
 *     <home>\running\<id>\status.json progress while a job runs
 *     <home>\running\<id>\progress.md
 *     <home>\done\<id>\status.json    final state
 *     <home>\control\<id>.cmd         write "stop" to cancel
 *
 * <home> is CC_HELPER_HOME, else %USERPROFILE%\cc-helper.
 *
 * Nothing here runs Claude Code. The daemon/tray of the desktop Helper does
 * that. Without a local Helper install, every tool still answers — it just
 * reports that nothing is installed and points at the homepage.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_NAME = 'botbridge-cc-helper';
const SERVER_VERSION = '0.1.0';
const HOMEPAGE = 'https://botbridge.dev/cc-helper';
const DEFAULT_PROTOCOL_VERSION = '2024-11-05';
const TASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/* ------------------------------------------------------------------ paths */

function helperHome() {
  const raw = process.env.CC_HELPER_HOME;
  if (raw && raw.trim() !== '') {
    return path.resolve(raw.trim());
  }
  return path.join(os.homedir(), 'cc-helper');
}

function dirs(home) {
  return {
    home,
    inbox: path.join(home, 'inbox'),
    running: path.join(home, 'running'),
    done: path.join(home, 'done'),
    control: path.join(home, 'control'),
    daemon: path.join(home, 'daemon.js'),
    tray: path.join(home, 'start-tray.cmd'),
  };
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
}

function tail(p, max) {
  try {
    const s = fs.readFileSync(p, 'utf8');
    return s.length > max ? `…${s.slice(-max)}` : s;
  } catch {
    return undefined;
  }
}

function listIds(dir) {
  if (!isDir(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => !n.startsWith('.'))
      .map((n) => n.replace(/\.json$/, ''))
      .sort();
  } catch {
    return [];
  }
}

function assertTaskId(id) {
  if (typeof id !== 'string' || !TASK_ID_RE.test(id)) {
    throw new Error(
      `Invalid task id ${JSON.stringify(id)}. Use letters, digits, dot, dash or underscore (max 128).`,
    );
  }
  return id;
}

function newTaskId() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const stamp =
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
  return `task-${stamp}-${rand}`;
}

/* ------------------------------------------------------------------ status */

function installState() {
  const d = dirs(helperHome());
  return {
    home: d.home,
    homeExists: isDir(d.home),
    daemon: fs.existsSync(d.daemon),
    tray: fs.existsSync(d.tray),
    inbox: isDir(d.inbox),
    running: isDir(d.running),
    done: isDir(d.done),
    control: isDir(d.control),
  };
}

function statusReport() {
  const s = installState();
  const queued = listIds(dirs(s.home).inbox);
  const running = listIds(dirs(s.home).running);
  const done = listIds(dirs(s.home).done);

  if (!s.daemon) {
    return (
      `Bot Bridge CC Helper is NOT installed at ${s.home}.\n` +
      `Looked for:\n` +
      `  - ${path.join(s.home, 'daemon.js')} (missing)\n` +
      `  - ${path.join(s.home, 'start-tray.cmd')} (${s.tray ? 'present' : 'missing'})\n\n` +
      `Nothing can be dispatched until the desktop Helper (Windows) is installed and its tray is running.\n` +
      `Install / request the installer: ${HOMEPAGE}\n` +
      `If the Helper lives elsewhere, set CC_HELPER_HOME (or the "botbridge-cc-helper.helperHome" setting).`
    );
  }

  return (
    `Bot Bridge CC Helper looks installed.\n` +
    `  home            : ${s.home}\n` +
    `  daemon.js       : present\n` +
    `  start-tray.cmd  : ${s.tray ? 'present' : 'missing'}\n` +
    `  inbox/          : ${s.inbox ? `${queued.length} job(s) queued` : 'missing'}\n` +
    `  running/        : ${s.running ? `${running.length} job(s) running` : 'missing'}\n` +
    `  done/           : ${s.done ? `${done.length} job(s) finished` : 'missing'}\n` +
    `  control/        : ${s.control ? 'ready' : 'missing'}\n\n` +
    (s.tray
      ? ''
      : `The tray script is missing — make sure the Helper tray is running, or jobs will sit in inbox/.\n`) +
    `Homepage: ${HOMEPAGE}`
  );
}

/* ---------------------------------------------------------------- dispatch */

function dispatch(title, prompt, id) {
  const taskId = id ? assertTaskId(id) : newTaskId();
  const d = dirs(helperHome());

  if (!isDir(d.inbox)) {
    throw new Error(
      `No inbox folder at ${d.inbox}. The desktop Bot Bridge CC Helper is not installed (or CC_HELPER_HOME points somewhere else). Install it first: ${HOMEPAGE}`,
    );
  }
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error('A non-empty "prompt" is required.');
  }

  const task = {
    id: taskId,
    title: typeof title === 'string' && title.trim() !== '' ? title.trim() : taskId,
    prompt,
  };

  const target = path.join(d.inbox, `${taskId}.json`);
  if (fs.existsSync(target)) {
    throw new Error(`Task id "${taskId}" is already in the inbox. Use a unique id.`);
  }

  // Write beside the target and rename, so the daemon never reads a half-written job.
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);

  return (
    `Dispatched "${task.title}" as ${taskId}.\n` +
    `  wrote : ${target}\n` +
    `  watch : ${path.join(d.running, taskId, 'status.json')} and progress.md\n` +
    `  done  : ${path.join(d.done, taskId, 'status.json')}\n` +
    `  stop  : cc_helper_stop with id "${taskId}"\n\n` +
    `Progress tracking, budget caps, stall kill and phone push are part of the desktop Helper (Pro, $29/year). Homepage: ${HOMEPAGE}`
  );
}

/* ------------------------------------------------------------------ status */

function taskStatus(id) {
  const taskId = assertTaskId(id);
  const d = dirs(helperHome());

  const parts = [];
  const inboxFile = path.join(d.inbox, `${taskId}.json`);
  const runningDir = path.join(d.running, taskId);
  const doneDir = path.join(d.done, taskId);

  if (fs.existsSync(inboxFile)) {
    parts.push(`state: queued (still in inbox/, not picked up yet)`);
  }

  if (isDir(runningDir)) {
    parts.push(`state: running`);
    const st = readJson(path.join(runningDir, 'status.json'));
    if (st) parts.push(`status.json: ${JSON.stringify(st)}`);
    const prog = tail(path.join(runningDir, 'progress.md'), 4000);
    if (prog && prog.trim() !== '') parts.push(`--- progress.md (tail) ---\n${prog}`);
  }

  if (isDir(doneDir)) {
    parts.push(`state: done`);
    const st = readJson(path.join(doneDir, 'status.json'));
    if (st) parts.push(`status.json: ${JSON.stringify(st)}`);
    const prog = tail(path.join(doneDir, 'progress.md'), 4000);
    if (prog && prog.trim() !== '') parts.push(`--- progress.md (tail) ---\n${prog}`);
  }

  if (parts.length === 0) {
    return `No trace of task "${taskId}" in inbox/, running/ or done/ under ${d.home}.`;
  }
  return `Task ${taskId}:\n  ${parts.join('\n  ')}`;
}

function listTasks() {
  const d = dirs(helperHome());
  const inbox = listIds(d.inbox);
  const running = listIds(d.running);
  const done = listIds(d.done);
  if (inbox.length + running.length + done.length === 0) {
    return `No tasks under ${d.home}.`;
  }
  return (
    `Tasks under ${d.home}:\n` +
    `  queued  (${inbox.length}): ${inbox.join(', ') || '—'}\n` +
    `  running (${running.length}): ${running.join(', ') || '—'}\n` +
    `  done    (${done.length}): ${done.join(', ') || '—'}`
  );
}

function stopTask(id) {
  const taskId = assertTaskId(id);
  const d = dirs(helperHome());
  if (!isDir(d.control)) {
    throw new Error(`No control folder at ${d.control}. Is the desktop Helper installed? ${HOMEPAGE}`);
  }
  const target = path.join(d.control, `${taskId}.cmd`);
  fs.writeFileSync(target, 'stop', 'utf8');
  return `Wrote "stop" to ${target}. The Helper picks it up on its next poll.`;
}

/* ------------------------------------------------------------ MCP plumbing */

const TOOLS = [
  {
    name: 'cc_helper_status',
    description:
      'Check whether the local Bot Bridge CC Helper (Windows desktop Helper) is installed, and how many jobs are queued, running and done. Call this before dispatching.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'cc_helper_dispatch',
    description:
      'Dispatch one task to the local Bot Bridge CC Helper by writing a job JSON into its inbox folder. The Helper daemon runs Claude Code with the prompt and streams progress. The user watches it in the tray. Returns the task id used for status polling and stop.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The work for the local Claude Code run. Be explicit about files and the expected result. Never include secrets.',
        },
        title: { type: 'string', description: 'Short human-readable label shown in the tray panel.' },
        id: {
          type: 'string',
          description: 'Optional unique task id. Omit to let the bridge generate one. Do not reuse an id.',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'cc_helper_task_status',
    description:
      'Read the state of one dispatched task: queued in inbox/, running with status.json + progress.md, or finished in done/.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Task id returned by cc_helper_dispatch.' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'cc_helper_list_tasks',
    description: 'List queued, running and finished tasks under the local Helper home folder.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'cc_helper_stop',
    description:
      'Ask the local Helper to stop a running task by writing "stop" into its control folder. The Helper acts on its next poll.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Task id to stop.' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

function callTool(name, args) {
  const a = args && typeof args === 'object' ? args : {};
  switch (name) {
    case 'cc_helper_status':
      return statusReport();
    case 'cc_helper_dispatch':
      return dispatch(a.title, a.prompt, a.id);
    case 'cc_helper_task_status':
      return taskStatus(a.id);
    case 'cc_helper_list_tasks':
      return listTasks();
    case 'cc_helper_stop':
      return stopTask(a.id);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handle(msg) {
  const { id, method, params } = msg;
  const hasId = id !== undefined && id !== null;

  switch (method) {
    case 'initialize': {
      const requested = params && typeof params.protocolVersion === 'string' ? params.protocolVersion : undefined;
      reply(id, {
        protocolVersion: requested || DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
      return;
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // notifications have no reply
    case 'ping':
      if (hasId) reply(id, {});
      return;
    case 'tools/list':
      reply(id, { tools: TOOLS });
      return;
    case 'tools/call': {
      const name = params && params.name;
      try {
        const text = callTool(name, params && params.arguments);
        reply(id, { content: [{ type: 'text', text }], isError: false });
      } catch (err) {
        reply(id, {
          content: [{ type: 'text', text: `cc-helper: ${err && err.message ? err.message : String(err)}` }],
          isError: true,
        });
      }
      return;
    }
    default:
      if (hasId) replyError(id, -32601, `Method not found: ${method}`);
  }
}

function main() {
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line === '') continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        replyError(null, -32700, 'Parse error');
        continue;
      }
      try {
        handle(msg);
      } catch (err) {
        replyError(msg && msg.id !== undefined ? msg.id : null, -32603, String(err && err.message ? err.message : err));
      }
    }
  });
  process.stdin.on('error', () => process.exit(0));
  process.stdin.resume();
}

/* ----------------------------------------------------------------- selftest */

function selftest() {
  const home = helperHome();
  process.stdout.write(`home: ${home}\n\n${statusReport()}\n\n`);
  const d = dirs(home);
  try {
    fs.mkdirSync(d.inbox, { recursive: true });
    const id = newTaskId();
    process.stdout.write(`${dispatch('selftest', 'noop', id)}\n\n`);
    process.stdout.write(`${taskStatus(id)}\n\n`);
    fs.rmSync(path.join(d.inbox, `${id}.json`), { force: true });
    process.stdout.write(`cleaned up ${id}\n`);
  } catch (err) {
    process.stdout.write(`dispatch skipped: ${err.message}\n`);
  }
}

if (process.argv.includes('--selftest')) {
  selftest();
} else {
  main();
}
