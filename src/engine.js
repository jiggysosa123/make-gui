const { spawn }      = require("child_process");
const EventEmitter   = require("events");
const readline       = require("readline");
const { parseRaw }   = require("./logparse");

const READY_MARKERS = [
  "starting engine",
  "loaded tasks:",
  "loaded profile groups",
];

const AUTO_REPLY = [
  { match: /do you want to change it\?/i, reply: "n" },
  { match: /enter.*key/i,                 reply: ""  },
];

class Engine extends EventEmitter {
  constructor(exePath, cwd) {
    super();
    this.exePath  = exePath;
    this.cwd      = cwd;
    this.proc     = null;
    this.running  = false;
    this._lineWaiters = []; // [{ pattern, resolve }]
    this.menuReady    = false;  // true once the main menu ("9) Exit") has printed
    this.webhookUrl   = null;   // parsed from "5) Webhook settings -> <url>"
    this.totalTasks   = 0;      // parsed from "Loaded Tasks: N"
  }

  // Resolve when a stdout line matches pattern (or null on timeout)
  waitFor(pattern, timeoutMs = 60_000) {
    return new Promise(resolve => {
      const w = { pattern, resolve: (line) => { clearTimeout(timer); resolve(line); } };
      const timer = setTimeout(() => {
        this._lineWaiters = this._lineWaiters.filter(x => x !== w);
        resolve(null);
      }, timeoutMs);
      this._lineWaiters.push(w);
    });
  }

  // Resolve once the main menu is on screen (immediately if it already is)
  waitForMenu(timeoutMs = 90_000) {
    if (this.menuReady) return Promise.resolve(true);
    return this.waitFor(/^9\)\s*Exit/i, timeoutMs).then(Boolean);
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.proc = spawn(this.exePath, [], {
          cwd:         this.cwd,
          stdio:       ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (e) { return reject(e); }

      this.running = true;
      let ready    = false;
      const markReady = () => {
        if (ready) return;
        ready = true;
        this.emit("ready");
        resolve();
      };

      // process is alive → tell the UI right away (don't wait for startup text)
      this.proc.once("spawn", () => this.emit("started"));

      // ── stdout reader ──────────────────────────────────────────────────────
      // Not readline: prompts like "Do you want to change it? Y/N:" and
      // "Enter group name:" are printed WITHOUT a newline, so a line reader never
      // sees them. Complete lines are handled immediately; a leftover partial
      // line is handled once output goes quiet for 150ms.
      let buf = "", partialTimer = null;
      const handle = (raw) => this._handleLine(raw, markReady);
      this.proc.stdout.setEncoding("utf8");
      this.proc.stdout.on("data", chunk => {
        buf += chunk;
        const parts = buf.split(/\r\n|\n|\r/);
        buf = parts.pop();
        parts.forEach(handle);
        clearTimeout(partialTimer);
        if (buf.trim()) partialTimer = setTimeout(() => { const p = buf; buf = ""; handle(p); }, 150);
      });
      this.proc.stdout.on("end", () => { clearTimeout(partialTimer); if (buf.trim()) handle(buf); buf = ""; });

      const rle = readline.createInterface({ input: this.proc.stderr });
      rle.on("line", line => {
        if (line.trim()) this.emit("log", { ts:null, level:"STDERR", site:null, task:null, comp:null, msg: line.trim(), type: "error" });
      });

      this.proc.on("error", err => { this.running = false; reject(err); });
      this.proc.on("exit",  code => { this.running = false; this.emit("exit", code); resolve(); });

      // engine printed nothing we recognise — it's still running, so carry on
      setTimeout(markReady, 15_000);
    });
  }

  _handleLine(raw, markReady) {
    const line = raw.trim();
    if (!line) return;

    // emit to UI — one raw line may contain more than one entry
    for (const entry of parseRaw(line)) this.emit("log", entry);

    // menu / settings detection
    if (/^9\)\s*Exit/i.test(line)) {
      const first = !this.menuReady;
      this.menuReady = true;
      this.emit("menu", first);
      markReady();
    }
    const wh = line.match(/^5\)\s*Webhook settings\s*->\s*(\S+)/i);
    if (wh && wh[1] !== this.webhookUrl) { this.webhookUrl = wh[1]; this.emit("webhookUrl", wh[1]); }
    const lt = line.match(/^Loaded Tasks:\s*(\d+)/i);
    if (lt) { this.totalTasks = +lt[1]; this.emit("totalTasks", this.totalTasks); }

    // resolve any stdout waiters
    this._lineWaiters = this._lineWaiters.filter(w => {
      if (w.pattern.test(line)) { w.resolve(line); return false; }
      return true;
    });

    // auto-reply to startup prompts
    for (const { match, reply } of AUTO_REPLY) {
      if (match.test(line)) { this._write(reply); break; }
    }

    // ready detection
    const lower = line.toLowerCase();
    if (READY_MARKERS.some(m => lower.includes(m))) markReady();
  }

  // Simple send — fire and forget
  send(cmd) {
    this._write(String(cmd));
  }

  // Send cmd, wait for stdout to match pattern, then send followUp
  // Resolves when followUp has been sent or timeout hits
  sendThenWait(cmd, awaitPattern, followUp, timeoutMs = 3000) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        // pattern never matched — send anyway as fallback
        this._write(String(followUp));
        resolve("timeout");
      }, timeoutMs);

      this._lineWaiters.push({
        pattern: awaitPattern,
        resolve: () => {
          clearTimeout(timer);
          // small settle — give engine's readline loop time to park on stdin
          setTimeout(() => { this._write(String(followUp)); resolve("matched"); }, 120);
        },
      });

      this._write(String(cmd));
    });
  }

  // Send cmd N times with delayMs between each — for stop commands
  // that may be dropped if the engine is mid-task
  sendRepeat(cmd, times = 3, delayMs = 400) {
    return new Promise(resolve => {
      let sent = 0;
      const fire = () => {
        if (sent >= times) { resolve(); return; }
        this._write(String(cmd));
        sent++;
        setTimeout(fire, delayMs);
      };
      fire();
    });
  }

  _write(text) {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(text + "\n");
    }
  }

  kill() {
    if (this.proc && this.running) {
      this.proc.kill("SIGTERM");
      this.running = false;
    }
  }
}

module.exports = Engine;
