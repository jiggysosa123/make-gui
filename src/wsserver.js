// ── MakeBot+ WebSocket Server ─────────────────────────────────────────────────
// Runs inside the Electron main process. Mobile clients connect here.
// Protocol: newline-delimited JSON over WebSocket.
//
// Server → Client messages:
//   { type:"log",     ts, msg, logType }
//   { type:"status",  running, taskGroups, proxyCount }
//   { type:"checkout",  ...checkoutFields }
//   { type:"pong" }
//
// Client → Server messages:
//   { type:"ping" }
//   { type:"engine:start" }
//   { type:"engine:stop" }
//   { type:"engine:send",        cmd }
//   { type:"engine:sendRepeat",  cmd, times, delayMs }
//   { type:"engine:sendThenWait",cmd, patternStr, followUp, timeoutMs }
//   { type:"fs:listGroup",       folder }
//   { type:"fs:readFile",        folder, name, ext }
//   { type:"fs:writeFile",       folder, name, ext, content }
//   { type:"status:request" }
//   { type:"checkouts:list" }                       → { items }
//   { type:"stats:request" }                        → stats payload
//   { type:"schedule:list" | "schedule:save" (schedule) | "schedule:remove" (id)
//          | "schedule:toggle" (id) | "schedule:runNow" (group) }
//
// Extra server → client: { type:"stats", ...counts }, { type:"schedules", items }
//
// Each client message that expects a response includes a `reqId` string;
// the server echoes it back in the response as `{ reqId, ...payload }`.

const { WebSocketServer } = require("ws");
const os = require("os");

class MakeBotWS {
  constructor({ getEngine, getEngineDir, getEngineExe, fs, path, startEngine }) {
    this.getEngine    = getEngine;
    this.getEngineDir = getEngineDir;
    this.getEngineExe = getEngineExe;
    this.fs           = fs;
    this.path         = path;
    this.startEngine  = startEngine;   // async fn → { ok, err }
    this.wss          = null;
    this.port         = 4269;
    this._logBuffer   = [];            // replay last 200 lines to new clients
    this.svc          = {};            // { checkouts, scheduler, tracker, schedulesWithNext }
  }

  attach(svc) { this.svc = svc; }

  start() {
    this.wss = new WebSocketServer({ port: this.port, host: "0.0.0.0" });

    this.wss.on("listening", () => {
      const addrs = this._localAddresses();
      console.log(`[WS] MakeBot+ remote server on :${this.port}`);
      console.log(`[WS] LAN:       ws://${addrs.lan}:${this.port}`);
      console.log(`[WS] Tailscale: ws://${addrs.ts}:${this.port}`);
    });

    this.wss.on("connection", (ws) => {
      // replay recent log history
      this._logBuffer.forEach(entry => ws.send(JSON.stringify(entry)));
      // send current status
      ws.send(JSON.stringify(this._statusPayload()));
      if (this.svc.tracker) ws.send(JSON.stringify({ type:"stats", ...this.svc.tracker.counts() }));

      ws.on("message", async (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        await this._handle(ws, msg);
      });

      ws.on("error", () => {});
    });

    this.wss.on("error", (e) => {
      console.error("[WS] Server error:", e.message);
    });
  }

  stop() {
    this.wss?.close();
  }

  // Called by main.js whenever the engine emits a log line
  broadcastLog(entry) {
    // { ts, msg, type }
    const payload = { type:"log", ts:entry.ts, msg:entry.msg, logType:entry.type, task:entry.task||null, site:entry.site||null };
    this._logBuffer.push(payload);
    if (this._logBuffer.length > 200) this._logBuffer.shift();
    this._broadcast(payload);
  }

  broadcastStatus() {
    this._broadcast(this._statusPayload());
  }

  broadcastCheckout(co) {
    this._broadcast({ type:"checkout", ...co });
  }

  broadcastStats(counts) {
    this._broadcast({ type:"stats", ...counts });
  }

  broadcastSchedules(items) {
    this._broadcast({ type:"schedules", items });
  }

  // ── message handler ───────────────────────────────────────────────────────
  async _handle(ws, msg) {
    const reply = (payload) => {
      ws.send(JSON.stringify({ reqId: msg.reqId, ...payload }));
    };

    switch (msg.type) {

      case "ping":
        reply({ type:"pong" });
        break;

      case "status:request":
        reply(this._statusPayload());
        break;

      case "engine:start": {
        if (this.getEngine()?.running) { reply({ type:"engine:start", ok:false, err:"Already running" }); break; }
        const r = await this.startEngine();
        reply({ type:"engine:start", ...r });
        break;
      }

      case "engine:stop": {
        this.getEngine()?.kill();
        reply({ type:"engine:stop", ok:true });
        break;
      }

      case "engine:send": {
        const eng = this.getEngine();
        if (!eng?.running) { reply({ type:"engine:send", ok:false, err:"Not running" }); break; }
        eng.send(msg.cmd);
        reply({ type:"engine:send", ok:true });
        break;
      }

      case "engine:sendRepeat": {
        const eng = this.getEngine();
        if (!eng?.running) { reply({ type:"engine:sendRepeat", ok:false, err:"Not running" }); break; }
        await eng.sendRepeat(msg.cmd, msg.times??3, msg.delayMs??400);
        reply({ type:"engine:sendRepeat", ok:true });
        break;
      }

      case "engine:sendThenWait": {
        const eng = this.getEngine();
        if (!eng?.running) { reply({ type:"engine:sendThenWait", ok:false, err:"Not running" }); break; }
        const pattern = new RegExp(msg.patternStr, "i");
        const result  = await eng.sendThenWait(msg.cmd, pattern, msg.followUp, msg.timeoutMs??3000);
        reply({ type:"engine:sendThenWait", ok:true, result });
        break;
      }

      case "fs:listGroup": {
        const dir = this.path.join(this.getEngineDir(), msg.folder);
        if (!this.fs.existsSync(dir)) { this.fs.mkdirSync(dir,{recursive:true}); reply({type:"fs:listGroup",groups:[]}); break; }
        const groups = this.fs.readdirSync(dir)
          .filter(f=>!f.startsWith("."))
          .map(f=>this.path.basename(f,this.path.extname(f)));
        reply({ type:"fs:listGroup", groups });
        break;
      }

      case "fs:readFile": {
        const p = this.path.join(this.getEngineDir(), msg.folder, msg.name + msg.ext);
        const content = this.fs.existsSync(p) ? this.fs.readFileSync(p,"utf8") : "";
        reply({ type:"fs:readFile", content });
        break;
      }

      case "fs:writeFile": {
        const dir = this.path.join(this.getEngineDir(), msg.folder);
        if (!this.fs.existsSync(dir)) this.fs.mkdirSync(dir,{recursive:true});
        this.fs.writeFileSync(this.path.join(dir, msg.name+msg.ext), msg.content,"utf8");
        reply({ type:"fs:writeFile", ok:true });
        break;
      }

      case "checkouts:list":
        reply({ type:"checkouts:list", items: (this.svc.checkouts?.list() || []).slice(0, 300).map(c => ({ ...c, raw: undefined })) });
        break;

      case "stats:request":
        reply({ type:"stats", ...(this.svc.tracker?.counts() || {}) });
        break;

      case "schedule:list":
        reply({ type:"schedules", items: this.svc.schedulesWithNext?.() || [] });
        break;

      case "schedule:save":
        try { this.svc.scheduler.save(msg.schedule || {}); reply({ type:"schedule:save", ok:true }); }
        catch (e) { reply({ type:"schedule:save", ok:false, err:e.message }); }
        break;

      case "schedule:remove":
        this.svc.scheduler?.remove(msg.id); reply({ type:"schedule:remove", ok:true });
        break;

      case "schedule:toggle":
        this.svc.scheduler?.toggle(msg.id); reply({ type:"schedule:toggle", ok:true });
        break;

      case "schedule:runNow":
        this.svc.scheduler?.runNow(msg.group, "run now (phone)"); reply({ type:"schedule:runNow", ok:true });
        break;

      default:
        reply({ type:"error", err:`Unknown message type: ${msg.type}` });
    }
  }

  _statusPayload() {
    const eng = this.getEngine();
    return { type:"status", running: eng?.running??false };
  }

  _broadcast(payload) {
    if (!this.wss) return;
    const str = JSON.stringify(payload);
    this.wss.clients.forEach(c => {
      if (c.readyState === 1) c.send(str);
    });
  }

  _localAddresses() {
    const nets = os.networkInterfaces();
    let lan="0.0.0.0", ts="<tailscale-ip>";
    for (const iface of Object.values(nets)) {
      for (const n of iface) {
        if (n.family!=="IPv4"||n.internal) continue;
        // Tailscale addresses are in 100.64.0.0/10
        if (n.address.startsWith("100.")) ts=n.address;
        else if (n.address!=="127.0.0.1") lan=n.address;
      }
    }
    return { lan, ts };
  }
}

module.exports = MakeBotWS;
