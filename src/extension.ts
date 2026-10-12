import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';

/**
 * Bot Bridge CC Helper
 *
 * A thin VS Code front door for a **local** Bot Bridge CC Helper install.
 *
 * The product is a dispatch bridge: a remote bot writes one job JSON into a
 * local inbox, a Windows tray/daemon picks it up, runs Claude Code with it and
 * streams progress back. This extension does not run Claude Code, does not
 * replace the CLI, and is not affiliated with Anthropic or Cursor. It only:
 *
 *   1. registers a stdio MCP server (bundled scripts/cc-helper-mcp.js) that
 *      speaks the same file bridge the free Cursor/Grok plugin documents, so
 *      Copilot Chat agent mode can dispatch into the local inbox; and
 *   2. gives you commands to check the install, dispatch by hand, open the
 *      inbox, and reach the homepage/installer.
 *
 * The daemon, tray, realtime panel, budget caps and phone push are the desktop
 * Helper, sold separately on https://botbridge.dev/cc-helper. Without it this
 * extension still answers, and says so.
 */

const PROVIDER_ID = 'botbridge-cc-helper';
const SERVER_LABEL = 'Bot Bridge CC Helper';
const CONFIG_SECTION = 'botbridge-cc-helper';
const BRIDGE_SCRIPT = path.join('scripts', 'cc-helper-mcp.js');
const HOMEPAGE = 'https://botbridge.dev/cc-helper';
const PRO_URL = 'https://botbridge.dev/cc-helper#pro';
const PRO_HINT_KEY = 'ccHelper.proHintShown';
const SETUP_HINT_KEY = 'ccHelper.setupHintShown';
const TASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

let outputChannel: vscode.OutputChannel | undefined;

function output(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(SERVER_LABEL);
  }
  return outputChannel;
}

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

/**
 * Reads a setting that decides *what this extension writes or launches* from
 * user/machine scope only, ignoring workspace values. The matching settings are
 * declared `"scope": "machine"`; we ignore workspace values here too so a
 * cloned repository can never redirect the folder or executable we use.
 */
function machineSetting<T>(key: string, fallback: T): T {
  const info = config().inspect<T>(key);
  const value = info?.globalValue ?? info?.defaultValue;
  return value === undefined || value === null ? fallback : value;
}

function expandHome(value: string): string {
  return value.replace(/^~(?=$|[\\/])/, os.homedir());
}

/** Folder owned by the local Helper: `%USERPROFILE%\cc-helper` by default. */
function helperHome(): string {
  const configured = String(machineSetting('helperHome', '')).trim();
  return configured.length > 0
    ? path.resolve(expandHome(configured))
    : path.join(os.homedir(), 'cc-helper');
}

interface SubDirs {
  home: string;
  inbox: string;
  running: string;
  done: string;
  control: string;
  daemon: string;
  tray: string;
}

function helperDirs(): SubDirs {
  const home = helperHome();
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

function isDir(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function countEntries(target: string): number {
  try {
    return fs.readdirSync(target).filter((name) => !name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

function bridgeScriptPath(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(BRIDGE_SCRIPT);
}

/**
 * Command + env used to launch the bundled bridge. By default we reuse the Node
 * runtime embedded in VS Code (`process.execPath` with ELECTRON_RUN_AS_NODE),
 * so no separate Node install is required; `nodePath` overrides it.
 */
function nodeLaunch(): { command: string; env: Record<string, string> } {
  const configured = String(machineSetting('nodePath', '')).trim();
  if (configured.length > 0) {
    return { command: expandHome(configured), env: {} };
  }
  return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  const { timeoutMs = 20_000, env } = options;
  return new Promise<RunResult>((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        env: env ? { ...process.env, ...env } : process.env,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : error
              ? 1
              : 0;
        resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr), code });
      },
    );
  });
}

function buildServerDefinition(
  context: vscode.ExtensionContext,
  version: string,
): vscode.McpStdioServerDefinition {
  const { command, env } = nodeLaunch();
  const script = bridgeScriptPath(context);
  return new vscode.McpStdioServerDefinition(
    SERVER_LABEL,
    command,
    [script],
    { ...env, CC_HELPER_HOME: helperHome() },
    version,
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const version = String(context.extension.packageJSON.version ?? '0.0.0');
  const didChange = new vscode.EventEmitter<void>();

  const provider: vscode.McpServerDefinitionProvider = {
    onDidChangeMcpServerDefinitions: didChange.event,
    provideMcpServerDefinitions: () => {
      if (!config().get<boolean>('enabled', true)) {
        return [];
      }
      return [buildServerDefinition(context, version)];
    },
    resolveMcpServerDefinition: async (server) => {
      const script = bridgeScriptPath(context);
      if (!fs.existsSync(script)) {
        void vscode.window.showErrorMessage(
          `${SERVER_LABEL}: bundled bridge is missing at ${script}. Reinstall the extension.`,
        );
        return undefined;
      }

      const { command, env } = nodeLaunch();
      const probe = await run(command, ['--version'], { env });
      if (!probe.ok) {
        const choice = await vscode.window.showErrorMessage(
          `${SERVER_LABEL} could not start its bundled bridge: "${command}" is not runnable. ` +
            `Set "botbridge-cc-helper.nodePath" to a Node.js executable.`,
          'Open Settings',
        );
        if (choice === 'Open Settings') {
          void vscode.commands.executeCommand('workbench.action.openSettings', CONFIG_SECTION);
        }
        return undefined;
      }

      if (!fs.existsSync(helperDirs().daemon)) {
        output().appendLine(
          `[warn] no local Helper at ${helperDirs().home} — tools will report it as not installed.`,
        );
      }
      output().appendLine(`[start] ${command} ${script}  (CC_HELPER_HOME=${helperHome()})`);
      return server;
    },
  };

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'botbridge-cc-helper.checkEnvironment';

  function refreshStatusItem(): void {
    const d = helperDirs();
    const installed = fs.existsSync(d.daemon);
    statusItem.text = installed ? '$(hubot) CC Helper' : '$(hubot) CC Helper: install';
    statusItem.tooltip = installed
      ? `${SERVER_LABEL} — local Helper at ${d.home}`
      : `${SERVER_LABEL} — no local Helper at ${d.home}. Click for setup.`;
    statusItem.show();
  }

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, provider),
    didChange,
    statusItem,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        didChange.fire();
        refreshStatusItem();
      }
    }),
    vscode.commands.registerCommand('botbridge-cc-helper.checkEnvironment', () =>
      checkEnvironment(context, version),
    ),
    vscode.commands.registerCommand('botbridge-cc-helper.dispatchTask', () =>
      dispatchTask(context),
    ),
    vscode.commands.registerCommand('botbridge-cc-helper.openInbox', () => openInbox()),
    vscode.commands.registerCommand('botbridge-cc-helper.refresh', () => {
      didChange.fire();
      refreshStatusItem();
      void vscode.window.showInformationMessage(
        `${SERVER_LABEL}: refreshed. Open the MCP servers view to start it.`,
      );
    }),
    vscode.commands.registerCommand('botbridge-cc-helper.installHelper', () =>
      vscode.env.openExternal(vscode.Uri.parse(HOMEPAGE)),
    ),
    vscode.commands.registerCommand('botbridge-cc-helper.openHomepage', () =>
      vscode.env.openExternal(vscode.Uri.parse(HOMEPAGE)),
    ),
  );

  refreshStatusItem();
  void maybeSetupHint(context);
}

/**
 * One-time, non-blocking install nudge. Never repeats once the user has seen it
 * (regardless of which button they picked) and never appears when the local
 * Helper is already in place.
 */
async function maybeSetupHint(context: vscode.ExtensionContext): Promise<void> {
  if (fs.existsSync(helperDirs().daemon)) {
    return;
  }
  if (context.globalState.get<boolean>(SETUP_HINT_KEY)) {
    return;
  }
  await context.globalState.update(SETUP_HINT_KEY, true);

  const choice = await vscode.window.showInformationMessage(
    `${SERVER_LABEL}: no local Helper found at ${helperDirs().home}. ` +
      `This extension is the bridge — the Windows Helper is what actually runs the work.`,
    'Open setup guide',
    'Later',
  );
  if (choice === 'Open setup guide') {
    void vscode.env.openExternal(vscode.Uri.parse(HOMEPAGE));
  }
}

/** Soft Pro hint: once per install, only after something actually succeeded. */
async function maybeProHint(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(PRO_HINT_KEY)) {
    return;
  }
  await context.globalState.update(PRO_HINT_KEY, true);

  const choice = await vscode.window.showInformationMessage(
    `${SERVER_LABEL}: free covers dispatch, progress and stop. ` +
      `Pro ($29/year, sold separately) adds hard token/budget caps, stall timeout and phone push.`,
    'See Pro',
    'Not now',
  );
  if (choice === 'See Pro') {
    void vscode.env.openExternal(vscode.Uri.parse(PRO_URL));
  }
}

function newTaskId(): string {
  const d = new Date();
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
  return `task-${stamp}-${rand}`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function dispatchTask(context: vscode.ExtensionContext): Promise<void> {
  const d = helperDirs();

  if (!isDir(d.inbox)) {
    const choice = await vscode.window.showWarningMessage(
      `${SERVER_LABEL}: no inbox at ${d.inbox}. The desktop Helper is not installed, so there is nothing to dispatch into.`,
      'Open setup guide',
      'Open Settings',
    );
    if (choice === 'Open setup guide') {
      void vscode.env.openExternal(vscode.Uri.parse(HOMEPAGE));
    } else if (choice === 'Open Settings') {
      void vscode.commands.executeCommand('workbench.action.openSettings', CONFIG_SECTION);
    }
    return;
  }

  const title = await vscode.window.showInputBox({
    title: `${SERVER_LABEL}: dispatch a task (1/2)`,
    prompt: 'Short label shown in the Helper tray panel.',
    placeHolder: 'e.g. fix the failing parser test',
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? 'Give the task a short title.' : undefined),
  });
  if (title === undefined) {
    return;
  }

  const prompt = await vscode.window.showInputBox({
    title: `${SERVER_LABEL}: dispatch a task (2/2)`,
    prompt: 'The work the local Helper should run. Do not paste secrets or API keys.',
    placeHolder: 'e.g. In this repo, make the failing parser test pass and summarise the change.',
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? 'The prompt cannot be empty.' : undefined),
  });
  if (prompt === undefined) {
    return;
  }

  const id = `${newTaskId()}${slug(title) ? `-${slug(title)}` : ''}`;
  if (!TASK_ID_RE.test(id)) {
    void vscode.window.showErrorMessage(`${SERVER_LABEL}: generated an invalid task id (${id}).`);
    return;
  }

  const target = path.join(d.inbox, `${id}.json`);
  const job = { id, title: title.trim(), prompt };
  try {
    // Write beside the target and rename: the daemon never sees a partial job.
    const tmp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, target);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `${SERVER_LABEL}: could not write the job to ${target} — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }

  output().appendLine(`[dispatch] ${id} -> ${target}`);
  const choice = await vscode.window.showInformationMessage(
    `${SERVER_LABEL}: dispatched "${job.title}" as ${id}. Watch it in the tray, or in ${d.running}.`,
    'Open inbox',
    'Open homepage',
  );
  if (choice === 'Open inbox') {
    await openInbox();
  } else if (choice === 'Open homepage') {
    void vscode.env.openExternal(vscode.Uri.parse(HOMEPAGE));
  }

  await maybeProHint(context);
}

async function openInbox(): Promise<void> {
  const d = helperDirs();
  const target = isDir(d.inbox) ? d.inbox : d.home;
  if (!isDir(target)) {
    void vscode.window.showWarningMessage(
      `${SERVER_LABEL}: ${target} does not exist yet. Install the desktop Helper first.`,
    );
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(target));
}

async function checkEnvironment(
  context: vscode.ExtensionContext,
  version: string,
): Promise<void> {
  const channel = output();
  channel.show(true);
  const d = helperDirs();

  channel.appendLine(`${SERVER_LABEL} — environment check`);
  channel.appendLine(`  Extension version : ${version}`);
  channel.appendLine(`  VS Code           : ${vscode.version}`);
  channel.appendLine(`  Platform          : ${process.platform}`);
  channel.appendLine(`  Helper home       : ${d.home}`);
  channel.appendLine(`  Bridge script     : ${bridgeScriptPath(context)}`);
  channel.appendLine(`  Homepage          : ${HOMEPAGE}`);
  channel.appendLine('');

  channel.appendLine('Local Helper:');
  channel.appendLine(`  daemon.js         : ${fs.existsSync(d.daemon) ? '✓ present' : '✗ missing'}`);
  channel.appendLine(`  start-tray.cmd    : ${fs.existsSync(d.tray) ? '✓ present' : '✗ missing'}`);
  channel.appendLine(`  inbox/            : ${isDir(d.inbox) ? `✓ ${countEntries(d.inbox)} file(s)` : '✗ missing'}`);
  channel.appendLine(`  running/          : ${isDir(d.running) ? `✓ ${countEntries(d.running)} task(s)` : '✗ missing'}`);
  channel.appendLine(`  done/             : ${isDir(d.done) ? `✓ ${countEntries(d.done)} task(s)` : '✗ missing'}`);
  channel.appendLine(`  control/          : ${isDir(d.control) ? '✓ present' : '✗ missing'}`);
  if (process.platform !== 'win32') {
    channel.appendLine(
      '  ! The desktop Helper is Windows-only. On this platform the bridge can only answer, not dispatch.',
    );
  }
  if (!fs.existsSync(d.daemon)) {
    channel.appendLine('');
    channel.appendLine(`  → Install the desktop Helper: ${HOMEPAGE}`);
    channel.appendLine('    (If it lives elsewhere, set "botbridge-cc-helper.helperHome".)');
  }

  channel.appendLine('');
  channel.appendLine('Bridge:');
  const { command, env } = nodeLaunch();
  channel.appendLine(`  launcher          : ${command}`);
  const probe = await run(command, ['--version'], { env });
  channel.appendLine(
    probe.ok ? `  ✓ ${probe.stdout.trim() || 'ok'}` : `  ✗ not runnable (${probe.stderr.trim() || `exit ${probe.code}`})`,
  );

  const script = bridgeScriptPath(context);
  if (!fs.existsSync(script)) {
    channel.appendLine(`  ✗ bridge script missing at ${script}`);
    return;
  }

  channel.appendLine('  Running bridge self-test (tools/list)...');
  const selftest = await run(command, [script, '--selftest'], {
    timeoutMs: 30_000,
    env: { ...env, CC_HELPER_HOME: d.home },
  });
  if (selftest.stdout.trim()) {
    for (const line of selftest.stdout.trim().split('\n')) {
      channel.appendLine(`  ${line}`);
    }
  }
  if (selftest.stderr.trim()) {
    channel.appendLine(`  [stderr] ${selftest.stderr.trim()}`);
  }
  channel.appendLine(
    selftest.ok
      ? `  ✓ Bridge is ready. "Bot Bridge CC Helper" appears in the MCP servers view.`
      : `  ✗ Bridge self-test failed. See the output above.`,
  );
}

export function deactivate(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
