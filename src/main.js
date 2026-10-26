const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require("electron");
const path     = require("path");
const fs       = require("fs");
const archiver = require("archiver");
const unzipper = require("unzipper");
const Engine   = require("./engine");
const MakeBotWS = require("./wsserver");
const { TaskTracker } = require("./logparse");
const { CheckoutService, WEBHOOK_RE } = require("./checkouts");
const Scheduler = require("./scheduler");
const updater   = require("./updater");

// Windows Server / Remote Desktop has no usable GPU: Chromium's GPU process
// crashes in a loop (exit code -1073741819) and the window stays blank.
// MakeBot+ draws nothing that needs the GPU, so render in software.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
// Even in software mode Chromium starts a sandboxed GPU helper; on some Windows
// Server setups the OS kills that sandbox on launch (0xC0000005), Chromium gives
// up after 6 tries and exits ("GPU process isn't usable. Goodbye."). The app only
// loads its own local files, so running without the Chromium sandbox is safe here.
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("no-sandbox");
// Do the (software) drawing inside the app process instead of a helper process —
// avoids the black window some servers show when the helper can't present frames.
app.commandLine.appendSwitch("in-process-gpu");

const isDev     = process.env.NODE_ENV === "development" || !app.isPackaged;
const engineDir = isDev
  ? path.join(__dirname, "..", "engine")
  : path.join(process.resourcesPath, "engine");

const configPath = path.join(app.getPath("userData"), "config.json");
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { return {}; }
}
function saveConfig(c) {
  fs.writeFileSync(configPath, JSON.stringify(c, null, 2), "utf8");
}

let cfg    = loadConfig();
let win    = null;
let engine = null;
const getConfig = () => cfg;
const saveCfg   = (c) => { cfg = c; saveConfig(cfg); };

function getEngineExe() { return cfg.engineExe || path.join(engineDir, "make-engine.exe"); }
function getEngineDir() { return cfg.engineExe ? path.dirname(cfg.engineExe) : engineDir; }

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new MakeBotWS({
  getEngine:    () => engine,
  getEngineDir: getEngineDir,
  getEngineExe: getEngineExe,
  fs, path,
  startEngine:  startEngineProcess,
});

// ── task state tracker (live stats) ───────────────────────────────────────────
const tracker = new TaskTracker();
let statsTimer = null;
function pushStats() {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    const c = tracker.counts();
    win?.webContents.send("engine:stats", c);
    wss.broadcastStats(c);
  }, 400);
}

// ── checkouts (webhook relay + optional Discord bot) ─────────────────────────
const checkouts = new CheckoutService({
  storePath:  path.join(app.getPath("userData"), "checkouts.json"),
  getConfig, saveConfig: saveCfg,
});
checkouts.on("checkout", co => {
  const lite = { ...co, raw: undefined };
  win?.webContents.send("checkouts:new", lite);
  wss.broadcastCheckout(lite);
});
checkouts.on("updated", co => win?.webContents.send("checkouts:updated", { ...co, raw: undefined }));
checkouts.on("status",  () => win?.webContents.send("webhook:status", webhookInfo()));

// ── scheduler ─────────────────────────────────────────────────────────────────
const scheduler = new Scheduler({
  getConfig, saveConfig: saveCfg,
  getEngine:   () => engine,
  startEngine: () => startEngineProcess(),
  log:         (msg, type) => pushLog(msg, type),
});
scheduler.on("changed", () => { win?.webContents.send("schedule:changed", schedulesWithNext()); wss.broadcastSchedules(schedulesWithNext()); });
function schedulesWithNext() { return scheduler.list().map(s => ({ ...s, nextRun: scheduler.nextRun(s) })); }

wss.attach({ checkouts, scheduler, tracker, schedulesWithNext });

// ── window ────────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width:1280, height:820, minWidth:900, minHeight:600,
    backgroundColor:"#0a0b09", frame:false,
    webPreferences:{
      preload: path.join(__dirname, "preload.js"),
      contextIsolation:true, nodeIntegration:false, webSecurity:false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "public", "index.html"));

  // ── diagnostics: everything that goes wrong in the window shows up in the terminal
  const wc = win.webContents;
  const LV = ["log", "warn", "error"];
  wc.on("console-message", (_e, level, message, line, source) => {
    if (level >= 1) console.log(`[window ${LV[level - 1] || "log"}] ${message}${source ? `  (${path.basename(source)}:${line})` : ""}`);
  });
  wc.on("did-finish-load", () => console.log("[window] page loaded"));
  wc.on("did-fail-load", (_e, code, desc, url) => console.log(`[window] failed to load ${url}: ${desc} (${code})`));
  wc.on("preload-error", (_e, p, err) => console.log(`[window] preload error in ${p}: ${err.stack || err}`));
  wc.on("render-process-gone", (_e, d) => console.log(`[window] renderer crashed: ${d.reason} (exit ${d.exitCode})`));
  wc.on("unresponsive", () => console.log("[window] page not responding"));
  // Ctrl+Shift+I (or F12) opens DevTools — the window is frameless so there's no menu
  wc.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")))
      wc.toggleDevTools();
  });
}

app.whenReady().then(() => {
  createWindow();
  wss.start();
  checkouts.startRelay();
  checkouts.startBot();
  scheduler.start();
  if (!isDev) updater.init(win);
});

function shutdown() { engine?.kill(); wss.stop(); checkouts.stop(); scheduler.stop(); app.quit(); }
app.on("window-all-closed", shutdown);

// ── push to renderer + WS clients ────────────────────────────────────────────
// accepts (msg, type) for GUI messages or a parsed engine entry object
function pushLog(msg, type="info") {
  const now = new Date().toLocaleTimeString("en-US",{hour12:false});
  const entry = typeof msg === "object"
    ? { ts: msg.ts || now, msg: msg.msg, type: msg.type, task: msg.task, site: msg.site, level: msg.level, comp: msg.comp }
    : { ts: now, msg, type };
  win?.webContents.send("engine:log", entry);
  wss.broadcastLog(entry);
}

// ── engine start (shared between IPC and WS) ──────────────────────────────────
async function startEngineProcess() {
  if (engine?.running) return { ok:false, err:"Already running" };
  const exePath = getEngineExe();
  const cwd     = getEngineDir();

  if (!fs.existsSync(exePath))
    return { ok:false, err:`make-engine.exe not found at:\n${exePath}` };

  try { fs.accessSync(exePath, fs.constants.X_OK); }
  catch { pushLog("Warning: permission check failed on exe, attempting spawn anyway","warn"); }

  engine = new Engine(exePath, cwd);
  tracker.reset();
  pushStats();

  engine.on("log", entry => {
    pushLog(entry);
    if (tracker.update(entry)) pushStats();
  });
  engine.on("totalTasks", n => { tracker.totalLoaded = n; pushStats(); });
  engine.on("menu", () => win?.webContents.send("engine:menu"));
  engine.on("webhookUrl", url => {
    if (checkouts.isRelayUrl(url)) { win?.webContents.send("webhook:status", webhookInfo()); return; }
    if (WEBHOOK_RE.test(url) && url !== cfg.realWebhookUrl) {
      cfg.realWebhookUrl = url; saveConfig(cfg);
      if (cfg.discordBotToken) checkouts.startBot();
    }
    win?.webContents.send("webhook:status", webhookInfo());
  });

  engine.on("started", () => {
    win?.webContents.send("engine:started");
    wss.broadcastStatus();
  });

  engine.on("ready", () => {
    win?.webContents.send("engine:ready");
    wss.broadcastStatus();
  });

  engine.on("exit", code => {
    pushLog(`Engine exited (${code})`, "warn");
    win?.webContents.send("engine:stopped");
    wss.broadcastStatus();
  });

  try   { await engine.start(); return { ok:true }; }
  catch (e) { return { ok:false, err:e.message }; }
}

// ── IPC: window controls ──────────────────────────────────────────────────────
ipcMain.on("window:minimize", () => win?.minimize());
ipcMain.on("window:maximize", () => win?.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on("window:close",    () => shutdown());

// ── IPC: clipboard ────────────────────────────────────────────────────────────
ipcMain.handle("clipboard:write", (_, text) => { clipboard.writeText(text); return true; });

// ── IPC: engine ───────────────────────────────────────────────────────────────
ipcMain.handle("engine:start",  async ()       => startEngineProcess());
ipcMain.handle("engine:stop",   async ()       => { engine?.kill(); return { ok:true }; });
ipcMain.handle("engine:send",   async (_,cmd)  => { engine?.send(cmd); return { ok:true }; });
ipcMain.handle("engine:status", ()             => ({ running: engine?.running??false }));

ipcMain.handle("engine:sendThenWait", async (_, { cmd, patternStr, followUp, timeoutMs }) => {
  if (!engine?.running) return { ok:false, err:"Not running" };
  const result = await engine.sendThenWait(cmd, new RegExp(patternStr,"i"), followUp, timeoutMs??3000);
  return { ok:true, result };
});

ipcMain.handle("engine:sendRepeat", async (_, { cmd, times, delayMs }) => {
  if (!engine?.running) return { ok:false, err:"Not running" };
  await engine.sendRepeat(cmd, times??3, delayMs??400);
  return { ok:true };
});

ipcMain.handle("engine:pickExe", async () => {
  const r = await dialog.showOpenDialog(win, {
    title:"Locate make-engine.exe", properties:["openFile"],
    filters:[{ name:"Executable", extensions:["exe"] }],
  });
  if (r.canceled || !r.filePaths.length) return null;
  cfg.engineExe = r.filePaths[0]; saveConfig(cfg);
  return r.filePaths[0];
});

ipcMain.handle("engine:getExePath", () => getEngineExe());

// WS server port/address info → show in Engine tab
ipcMain.handle("ws:info", () => {
  const { _localAddresses } = wss;
  const addrs = wss._localAddresses();
  return { port: wss.port, lan: addrs.lan, tailscale: addrs.ts };
});

// ── IPC: file system ──────────────────────────────────────────────────────────
function dataDir()               { return getEngineDir(); }
function dataPath(folder, file)  { return path.join(dataDir(), folder, file); }

ipcMain.handle("fs:listGroup", (_, { folder }) => {
  const dir = path.join(dataDir(), folder);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir,{recursive:true}); return []; }
  return fs.readdirSync(dir)
    .filter(f=>!f.startsWith("."))
    .map(f=>path.basename(f,path.extname(f)));
});

ipcMain.handle("fs:readFile",  (_, { folder,name,ext }) => {
  const p = dataPath(folder, name+ext);
  return fs.existsSync(p) ? fs.readFileSync(p,"utf8") : "";
});

ipcMain.handle("fs:writeFile", (_, { folder,name,ext,content }) => {
  const dir = path.join(dataDir(), folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(dataPath(folder,name+ext), content,"utf8");
  return { ok:true };
});

ipcMain.handle("fs:deleteFile", (_, { folder,name,ext }) => {
  const p = dataPath(folder,name+ext);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return { ok:true };
});

ipcMain.handle("fs:importFile", async (_, { filters }) => {
  const r = await dialog.showOpenDialog(win,{ properties:["openFile"], filters });
  if (r.canceled || !r.filePaths.length) return null;
  return { path:r.filePaths[0], content:fs.readFileSync(r.filePaths[0],"utf8") };
});

ipcMain.handle("fs:openEngineDir", () => shell.openPath(dataDir()));

// ── IPC: product image scraper ────────────────────────────────────────────────
ipcMain.handle("fetch:ogImage", async (_, url) => {
  try {
    const { net } = require("electron");
    return await new Promise(resolve => {
      const req = net.request({ url, method:"GET", headers:{
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":"text/html,application/xhtml+xml",
      }});
      let body="";
      req.on("response", res => {
        res.on("data", c => { body+=c.toString(); if(body.length>80_000) req.abort(); });
        res.on("end", () => {
          const og  = body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                   || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          const tw  = body.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
          const img = body.match(/<img[^>]+class=["'][^"']*product[^"']*["'][^>]+src=["']([^"']+)["']/i);
          resolve(og?.[1]||tw?.[1]||img?.[1]||null);
        });
      });
      req.on("error", ()=>resolve(null));
      req.setTimeout(6000,()=>{req.abort();resolve(null);});
      req.end();
    });
  } catch { return null; }
});

// ── IPC: engine info / stats ──────────────────────────────────────────────────
ipcMain.handle("engine:info", () => ({
  running:    engine?.running ?? false,
  menuReady:  engine?.menuReady ?? false,
  webhookUrl: engine?.webhookUrl ?? null,
  stats:      tracker.counts(),
}));

// ── IPC: shell ────────────────────────────────────────────────────────────────
ipcMain.handle("shell:open", (_, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  return true;
});

// ── IPC: checkouts ────────────────────────────────────────────────────────────
ipcMain.handle("checkouts:list",   () => checkouts.list().map(c => ({ ...c, raw: undefined })));
ipcMain.handle("checkouts:raw",    (_, id) => checkouts.list().find(c => c.id === id)?.raw ?? null);
ipcMain.handle("checkouts:clear",  () => { checkouts.clear(); return true; });
ipcMain.handle("checkouts:remove", (_, id) => { checkouts.remove(id); return true; });
ipcMain.handle("checkouts:setImage", (_, { id, image }) => { checkouts.update(id, { image }); return true; });
ipcMain.handle("checkouts:backfill", async (_, { maxPages } = {}) => {
  try {
    const result = await checkouts.backfill(maxPages || 20, (progress) => {
      win?.webContents.send("checkouts:backfillProgress", progress);
    });
    // re-send full list so renderer picks up new entries
    const all = checkouts.list().map(c => ({ ...c, raw: undefined }));
    win?.webContents.send("checkouts:backfillDone", { ...result, items: all });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── IPC: webhook routing ──────────────────────────────────────────────────────
function webhookInfo() {
  const st = checkouts.status();
  const current = engine?.webhookUrl || null;
  return {
    ...st,
    engineWebhook: current,
    routed:   checkouts.isRelayUrl(current),
    relayUrl: checkouts.relayUrlFor(cfg.realWebhookUrl),
  };
}
ipcMain.handle("webhook:status", () => webhookInfo());

// Menu 5 → engine asks for a URL → send it. The engine's exact prompt text isn't
// known yet, so we wait for any non-menu line mentioning webhook/url/enter, then
// confirm by watching the reprinted menu line "5) Webhook settings -> <url>".
async function setEngineWebhook(url) {
  if (!engine?.running)   return { ok:false, err:"Engine not running" };
  if (!engine.menuReady)  return { ok:false, err:"Engine menu not ready yet" };
  pushLog(`> 5) Webhook settings → ${url.replace(/\/[\w-]{20,}$/, "/••••")}`, "dim");
  const confirm = engine.waitFor(/^5\)\s*Webhook settings\s*->/i, 8000);
  await engine.sendThenWait("5", /^(?!\d\)).*(webhook|url|enter|paste|link)/i, url, 3000);
  const line = await confirm;
  const ok = !!line && line.includes(url);
  if (!ok) pushLog("Couldn't confirm the webhook change from the menu — check the console output above.", "warn");
  win?.webContents.send("webhook:status", webhookInfo());
  return { ok, err: ok ? null : "Not confirmed — see console", line };
}
ipcMain.handle("webhook:route", async () => {
  const relayUrl = checkouts.relayUrlFor(cfg.realWebhookUrl);
  if (!relayUrl) return { ok:false, err:"Real Discord webhook unknown — start the engine so it can be read from the menu" };
  return setEngineWebhook(relayUrl);
});
ipcMain.handle("webhook:restore", async () => {
  if (!cfg.realWebhookUrl) return { ok:false, err:"No saved Discord webhook" };
  return setEngineWebhook(cfg.realWebhookUrl);
});
ipcMain.handle("webhook:setReal", (_, url) => {
  if (!WEBHOOK_RE.test(url || "")) return { ok:false, err:"That isn't a Discord webhook URL" };
  cfg.realWebhookUrl = url; saveConfig(cfg);
  if (cfg.discordBotToken) checkouts.startBot();
  return { ok:true, status: webhookInfo() };
});
ipcMain.handle("webhook:setBotToken", async (_, token) => {
  cfg.discordBotToken = (token || "").trim() || undefined; saveConfig(cfg);
  await checkouts.startBot();
  return webhookInfo();
});

// ── IPC: schedules ────────────────────────────────────────────────────────────
ipcMain.handle("schedule:list",   () => schedulesWithNext());
ipcMain.handle("schedule:save",   (_, s) => { try { scheduler.save(s); return { ok:true }; } catch (e) { return { ok:false, err:e.message }; } });
ipcMain.handle("schedule:remove", (_, id) => { scheduler.remove(id); return { ok:true }; });
ipcMain.handle("schedule:toggle", (_, id) => { scheduler.toggle(id); return { ok:true }; });
ipcMain.handle("schedule:runNow",  (_, group) => { scheduler.runNow(group, "run now"); return { ok:true }; });
ipcMain.handle("schedule:stopNow", (_, group) => { scheduler.stopNow(group, "stop now"); return { ok:true }; });

// ── IPC: config export/import ────────────────────────────────────────────────
ipcMain.handle("config:export", async () => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: `makebot-backup-${new Date().toISOString().slice(0,10)}.zip`,
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
  });
  if (r.canceled || !r.filePath) return { ok: false };

  const dir = dataDir();
  const output = fs.createWriteStream(r.filePath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  // add all subfolders (task, proxy, profile, account, precookie, etc.)
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      archive.directory(full, e.name);
    } else if (e.isFile() && !/\.(exe|dll)$/i.test(e.name)) {
      // include loose config files (json, txt, etc.) but skip binaries
      archive.file(full, { name: e.name });
    }
  }
  // also include app-level config
  const appCfg = path.join(app.getPath("userData"), "config.json");
  if (fs.existsSync(appCfg)) archive.file(appCfg, { name: "_app_config.json" });
  const coDB = path.join(app.getPath("userData"), "checkouts.json");
  if (fs.existsSync(coDB)) archive.file(coDB, { name: "_checkouts.json" });
  const schDB = path.join(app.getPath("userData"), "schedules.json");
  if (fs.existsSync(schDB)) archive.file(schDB, { name: "_schedules.json" });

  await archive.finalize();
  await new Promise(resolve => output.on("close", resolve));
  return { ok: true, path: r.filePath };
});

ipcMain.handle("config:import", async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };

  const zipPath = r.filePaths[0];
  const dir = dataDir();
  const userData = app.getPath("userData");

  const directory = await unzipper.Open.file(zipPath);
  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;
    // app-level files go to userData
    let dest;
    if (entry.path === "_app_config.json") dest = path.join(userData, "config.json");
    else if (entry.path === "_checkouts.json") dest = path.join(userData, "checkouts.json");
    else if (entry.path === "_schedules.json") dest = path.join(userData, "schedules.json");
    else dest = path.join(dir, entry.path);

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const content = await entry.buffer();
    fs.writeFileSync(dest, content);
  }

  // reload config in memory
  cfg = JSON.parse(fs.readFileSync(path.join(userData, "config.json"), "utf8") || "{}");
  return { ok: true };
});

ipcMain.handle("app:version", () => app.getVersion());

ipcMain.handle("releases:fetch", async () => {
  try {
    const https = require("https");
    const data = await new Promise((resolve, reject) => {
      const req = https.get("https://api.github.com/repos/jiggysosa123/make-gui/releases?per_page=20", {
        headers: { "User-Agent": "MakeBot-Console" },
      }, res => {
        let body = "";
        res.on("data", c => body += c);
        res.on("end", () => {
          if (res.statusCode === 200) resolve(JSON.parse(body));
          else reject(new Error(`GitHub ${res.statusCode}`));
        });
      });
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
    });
    return data.filter(r => !r.draft).map(r => ({
      ver: (r.tag_name || "").replace(/^v/, ""),
      date: (r.published_at || r.created_at || "").slice(0, 10),
      title: r.name || r.tag_name || "",
      body: r.body || "",
    }));
  } catch { return null; }
});

// ── IPC: notification sound ──────────────────────────────────────────────────
ipcMain.handle("sound:pick", async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: ["mp3","wav","ogg","m4a"] }],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const src = r.filePaths[0];
  const dest = path.join(app.getPath("userData"), "custom-sound" + path.extname(src));
  fs.copyFileSync(src, dest);
  cfg.customSoundPath = dest;
  saveCfg(cfg);
  return dest;
});

ipcMain.handle("sound:getConfig", () => ({
  enabled: cfg.soundEnabled !== false,
  custom: cfg.customSoundPath || null,
}));

ipcMain.handle("sound:setEnabled", (_e, on) => {
  cfg.soundEnabled = on;
  saveCfg(cfg);
});

ipcMain.handle("sound:reset", () => {
  delete cfg.customSoundPath;
  const old = path.join(app.getPath("userData"), "custom-sound.mp3");
  try { fs.unlinkSync(old); } catch {}
  try { fs.unlinkSync(old.replace(".mp3",".wav")); } catch {}
  try { fs.unlinkSync(old.replace(".mp3",".ogg")); } catch {}
  try { fs.unlinkSync(old.replace(".mp3",".m4a")); } catch {}
  saveCfg(cfg);
});
