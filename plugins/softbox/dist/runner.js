#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);

// dist/runner.js
import { spawn } from "node:child_process";
import { mkdir as mkdir3, open } from "node:fs/promises";
import { join as join3 } from "node:path";

// dist/connection.js
import { mkdir as mkdir2, readFile as readFile2, rm as rm2, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir2, hostname } from "node:os";
import { join as join2 } from "node:path";

// dist/runner-install.js
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
var run = promisify(execFile);
var LABEL = "app.softbox.runner";
var RUNNER_DIR = join(homedir(), ".softbox", "runner");
var DISABLED_PATH = join(RUNNER_DIR, "disabled");
var PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
var HERE = dirname(fileURLToPath(import.meta.url));
var RUNNER_FILES = ["runner.js", "connection.js", "wake.js"];
var CODEX_CANDIDATES = [
  process.env.CODEX_CLI_PATH,
  "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex",
  "/Applications/ChatGPT.app/Contents/Resources/codex",
  "/Applications/Codex.app/Contents/Resources/codex",
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex"
];
async function exists(path) {
  return access(path).then(() => true, () => false);
}
async function findCodex() {
  for (const candidate of CODEX_CANDIDATES) {
    if (candidate?.startsWith("/") && await exists(candidate))
      return candidate;
  }
  return null;
}
var escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function plist(env) {
  const entries = Object.entries(env).map(([key, value]) => `      <key>${key}</key>
      <string>${escapeXml(value)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${escapeXml(process.execPath)}</string>
      <string>${escapeXml(join(RUNNER_DIR, "runner.js"))}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
${entries}
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>60</integer>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>${escapeXml(join(RUNNER_DIR, "runner.log"))}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(join(RUNNER_DIR, "runner.log"))}</string>
  </dict>
</plist>
`;
}
var domain = () => `gui/${process.getuid?.() ?? 0}`;
async function isLoaded() {
  return run("launchctl", ["print", `${domain()}/${LABEL}`]).then(() => true, () => false);
}
async function unload() {
  await run("launchctl", ["bootout", `${domain()}/${LABEL}`]).catch(() => void 0);
}
async function ensureRunner() {
  if (process.platform !== "darwin")
    return "unavailable";
  if (await exists(DISABLED_PATH))
    return "off";
  const codex = await findCodex();
  if (!codex)
    return "unavailable";
  const env = { HOME: homedir(), SOFTBOX_CODEX_PATH: codex };
  if (process.env.SOFTBOX_URL)
    env.SOFTBOX_URL = process.env.SOFTBOX_URL;
  const nextPlist = plist(env);
  await mkdir(RUNNER_DIR, { recursive: true, mode: 448 });
  let changed = await readFile(PLIST_PATH, "utf8").catch(() => "") !== nextPlist;
  for (const file of RUNNER_FILES) {
    const source = join(HERE, file);
    if (!await exists(source))
      continue;
    const target = join(RUNNER_DIR, file);
    const [next, current] = await Promise.all([
      readFile(source),
      readFile(target).catch(() => null)
    ]);
    if (current && next.equals(current))
      continue;
    await copyFile(source, target);
    changed = true;
  }
  if (!changed && await isLoaded())
    return "on";
  await mkdir(dirname(PLIST_PATH), { recursive: true });
  await writeFile(PLIST_PATH, nextPlist);
  await unload();
  await run("launchctl", ["bootstrap", domain(), PLIST_PATH]);
  return "on";
}
async function trimLog(maxBytes = 1e6) {
  const path = join(RUNNER_DIR, "runner.log");
  const size = await stat(path).then((info) => info.size, () => 0);
  if (size > maxBytes)
    await writeFile(path, "");
}

// dist/connection.js
var BASE_URL = (process.env.SOFTBOX_URL ?? "https://softbox-capture.vercel.app").replace(/\/$/, "");
var CREDENTIALS_DIR = join2(homedir2(), ".softbox");
var CREDENTIALS_PATH = join2(CREDENTIALS_DIR, "credentials.json");
var PAIRING_PATH = join2(CREDENTIALS_DIR, "pairing.json");
async function readCredentials() {
  try {
    const saved = JSON.parse(await readFile2(CREDENTIALS_PATH, "utf8"));
    return saved.baseUrl === BASE_URL ? saved : null;
  } catch {
    return null;
  }
}
async function writePrivate(path, value) {
  await mkdir2(CREDENTIALS_DIR, { recursive: true, mode: 448 });
  await writeFile2(path, JSON.stringify(value, null, 2), { mode: 384 });
}
async function readPairing() {
  try {
    const saved = JSON.parse(await readFile2(PAIRING_PATH, "utf8"));
    return saved.baseUrl === BASE_URL ? saved : null;
  } catch {
    return null;
  }
}
var claiming = null;
function claimPairing() {
  claiming ??= (async () => {
    const pairing = await readPairing();
    if (!pairing)
      return;
    const response = await fetch(`${BASE_URL}/api/plugin/pairings/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: pairing.code, secret: pairing.secret })
    }).catch(() => null);
    if (!response || response.status === 202 || response.status >= 500)
      return;
    if (response.ok) {
      const approved = await response.json();
      await writePrivate(CREDENTIALS_PATH, {
        baseUrl: BASE_URL,
        token: approved.token,
        deviceName: approved.deviceName,
        email: approved.email
      });
      void ensureRunner().catch(() => void 0);
    }
    await rm2(PAIRING_PATH, { force: true });
  })().finally(() => {
    claiming = null;
  });
  return claiming;
}
async function deviceToken() {
  let credentials = await readCredentials();
  if (!credentials) {
    await claimPairing();
    credentials = await readCredentials();
  }
  return credentials?.token ?? null;
}
async function authedFetch(path, init = {}) {
  const token = await deviceToken();
  if (!token)
    return null;
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.body ? { "content-type": "application/json" } : {},
      ...init.headers,
      authorization: `Bearer ${token}`
    }
  });
}
async function currentAccount() {
  const response = await authedFetch("/api/plugin/me");
  if (!response?.ok)
    return null;
  return await response.json();
}

// dist/wake.js
var HEARTBEAT_MS = 25e3;
var MAX_RECONNECT_MS = 6e4;
async function runnerCheck(backend, token) {
  const response = await fetch(`${backend.url}/rest/v1/rpc/runner_check`, {
    method: "POST",
    headers: { apikey: backend.key, "content-type": "application/json" },
    body: JSON.stringify({ p_token: token })
  });
  if (!response.ok)
    throw new Error(`runner_check ${response.status}`);
  return await response.json();
}
function listenForJobs(backend, topic, listener) {
  const channel = `realtime:${topic}`;
  const endpoint = `${backend.url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(backend.key)}&vsn=1.0.0`;
  let socket = null;
  let stopped = false;
  let attempts = 0;
  let ref = 0;
  const connect = () => {
    const ws = new WebSocket(endpoint);
    socket = ws;
    let joinRef = "";
    let heartbeatRef = null;
    let heartbeat;
    const send = (topicName, event, payload) => {
      const messageRef = String(++ref);
      ws.send(JSON.stringify({ topic: topicName, event, payload, ref: messageRef }));
      return messageRef;
    };
    ws.onopen = () => {
      joinRef = send(channel, "phx_join", {
        config: { broadcast: { self: false }, private: false }
      });
      heartbeat = setInterval(() => {
        if (heartbeatRef)
          return ws.close();
        heartbeatRef = send("phoenix", "heartbeat", {});
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (message) => {
      const { event, payload, ref: messageRef, topic: messageTopic } = JSON.parse(String(message.data));
      if (messageRef && messageRef === heartbeatRef) {
        heartbeatRef = null;
      } else if (messageRef === joinRef && event === "phx_reply") {
        if (payload.status === "ok") {
          attempts = 0;
          listener.onJoined();
        } else {
          listener.onLost(`\uCC44\uB110\uC5D0 \uB4E4\uC5B4\uAC00\uC9C0 \uBABB\uD588\uC5B4\uC694: ${JSON.stringify(payload.response)}`);
          ws.close();
        }
      } else if (messageTopic === channel && (event === "phx_error" || event === "phx_close")) {
        ws.close();
      } else if (event === "broadcast" && payload.event === "job") {
        listener.onJob();
      }
    };
    ws.onerror = () => void 0;
    ws.onclose = () => {
      clearInterval(heartbeat);
      if (stopped)
        return;
      const delay = Math.min(1e3 * 2 ** attempts++, MAX_RECONNECT_MS);
      if (attempts > 1)
        listener.onLost(`\uC5F0\uACB0\uC774 \uB04A\uACBC\uC5B4\uC694. ${Math.round(delay / 1e3)}\uCD08 \uB4A4 \uB2E4\uC2DC \uBD99\uC5B4\uC694.`);
      setTimeout(connect, delay);
    };
  };
  connect();
  return () => {
    stopped = true;
    socket?.close();
  };
}

// dist/runner.js
var CODEX = process.env.SOFTBOX_CODEX_PATH ?? "codex";
var WORK_DIR = join3(RUNNER_DIR, "work");
var LAST_RUN_LOG = join3(RUNNER_DIR, "last-run.log");
var IDLE_MS = 6e4;
var SAFETY_MS = 30 * 6e4;
var MIN_CHECK_MS = 5e3;
var RUN_TIMEOUT_MS = 30 * 6e4;
var MAX_BACKOFF_MS = 15 * 6e4;
var DISABLED_MCP_SERVERS = ["cua_repl"];
var PROMPT = [
  "Softbox \uB300\uAE30 \uC791\uC5C5\uC744 \uBAA8\uB450 \uCC98\uB9AC\uD574 \uC918.",
  "softbox_next_job\uC73C\uB85C \uC791\uC5C5\uC744 \uD558\uB098\uC529 \uBC1B\uC544, \uD568\uAED8 \uC624\uB294 \uC808\uCC28\uB300\uB85C \uC774\uBBF8\uC9C0\uB97C \uD55C \uC7A5\uC529 \uB9CC\uB4E4\uC5B4 \uB9CC\uB4E4 \uB54C\uB9C8\uB2E4 softbox_add_image\uB85C \uC62C\uB9AC\uACE0, \uB2E4 \uB418\uBA74 softbox_submit\uC73C\uB85C \uB05D\uB0B4.",
  "\uB300\uAE30 \uC791\uC5C5\uC774 \uC5C6\uB2E4\uACE0 \uB098\uC62C \uB54C\uAE4C\uC9C0 \uBC18\uBCF5\uD574.",
  "\uC0AC\uC6A9\uC790\uAC00 \uC5C6\uB294 \uC790\uB3D9 \uC2E4\uD589\uC774\uB2C8 \uC9C8\uBB38\uD558\uC9C0 \uB9D0\uACE0 \uB05D\uAE4C\uC9C0 \uC9C4\uD589\uD574. Softbox \uB3C4\uAD6C\uC640 \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uB9D0\uACE0\uB294 \uC4F0\uC9C0 \uB9C8."
].join(" ");
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var log = (message) => console.log(`${(/* @__PURE__ */ new Date()).toISOString()} ${message}`);
var signaled = false;
var wake = null;
function signal() {
  signaled = true;
  wake?.();
}
function waitForSignal(ms) {
  if (signaled)
    return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      wake = null;
      resolve();
    }
    wake = done;
  });
}
async function runCodex() {
  await mkdir3(WORK_DIR, { recursive: true });
  const output = await open(LAST_RUN_LOG, "w");
  try {
    return await new Promise((resolve) => {
      const child = spawn(CODEX, [
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "-c",
        'approval_policy="never"',
        ...DISABLED_MCP_SERVERS.flatMap((name) => [
          "-c",
          `mcp_servers.${name}={command="/usr/bin/true",enabled=false}`
        ]),
        "-C",
        WORK_DIR,
        PROMPT
      ], { cwd: WORK_DIR, stdio: ["ignore", output.fd, output.fd] });
      const timer = setTimeout(() => child.kill("SIGTERM"), RUN_TIMEOUT_MS);
      child.on("error", (error) => {
        log(`Codex\uB97C \uC2E4\uD589\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694: ${error.message}`);
        clearTimeout(timer);
        resolve(null);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  } finally {
    await output.close();
  }
}
async function connectBackend() {
  const token = await deviceToken();
  if (!token)
    return null;
  const account = await currentAccount();
  if (!account?.supabase)
    return null;
  return { backend: account.supabase, token };
}
async function serve(backend, token) {
  let stop = null;
  let topic = null;
  let lastCheck = 0;
  let backoff = 0;
  try {
    for (; ; ) {
      await sleep(Math.max(0, lastCheck + MIN_CHECK_MS - Date.now()));
      signaled = false;
      lastCheck = Date.now();
      const checked = await runnerCheck(backend, token);
      if (!checked)
        return;
      if (checked.topic !== topic) {
        stop?.();
        topic = checked.topic;
        stop = listenForJobs(backend, topic, {
          onJoined: signal,
          onJob: signal,
          onLost: log
        });
        log("\uC791\uC5C5 \uC2E0\uD638\uB97C \uAE30\uB2E4\uB824\uC694.");
      }
      const { queued } = checked;
      if (queued > 0) {
        log(`\uB300\uAE30 \uC791\uC5C5 ${queued}\uAC74\uC744 Codex\uB85C \uCC98\uB9AC\uD574\uC694.`);
        const code = await runCodex();
        const left = (await runnerCheck(backend, token))?.queued ?? queued;
        log(`Codex\uAC00 \uB05D\uB0AC\uC5B4\uC694 (\uC885\uB8CC \uCF54\uB4DC ${code}). \uB0A8\uC740 \uB300\uAE30 \uC791\uC5C5 ${left}\uAC74.`);
        if (left >= queued) {
          backoff = Math.min(backoff ? backoff * 2 : IDLE_MS, MAX_BACKOFF_MS);
          log(`${Math.round(backoff / 1e3)}\uCD08 \uC26C\uC5C8\uB2E4\uAC00 \uB2E4\uC2DC \uD574\uC694. \uC790\uC138\uD55C \uB0B4\uC6A9\uC740 last-run.log\uC5D0 \uC788\uC5B4\uC694.`);
          await sleep(backoff);
          continue;
        }
        backoff = 0;
        continue;
      }
      await waitForSignal(SAFETY_MS);
    }
  } finally {
    stop?.();
  }
}
async function main() {
  await trimLog();
  log(`\uC2E4\uD589\uAE30\uB97C \uCF30\uC5B4\uC694. Codex: ${CODEX}`);
  for (; ; ) {
    try {
      const connection = await connectBackend();
      if (connection)
        await serve(connection.backend, connection.token);
    } catch (error) {
      log(`\uC624\uB958: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(IDLE_MS);
  }
}
await main();
