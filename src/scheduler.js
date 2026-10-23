// ── MakeBot+ scheduler ────────────────────────────────────────────────────────
// Schedules live in config.json and run in the main process, so they fire no
// matter which tab is open (or whether the phone app is connected).
//
// Schedule: { id, time:"HH:MM", group, action:"start"|"stop",
//             repeat:"once"|"daily", days:[0-6]|null,
//             enabled, lastFired:"YYYY-MM-DD HH:MM"|null }
//
// Start fire sequence:
//   engine not running → launch it (key prompt is auto-answered "n")
//   wait for the main menu ("9) Exit")
//   send "2" → wait for "Enter group name" → send group
//
// Stop fire sequence:
//   engine must be running (skip if not)
//   send "4" → wait for "Enter group name" → send group (repeated 3× for reliability)

const EventEmitter = require("events");
const crypto = require("crypto");

const pad = n => String(n).padStart(2, "0");
const stamp = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

class Scheduler extends EventEmitter {
  constructor({ getConfig, saveConfig, getEngine, startEngine, log }) {
    super();
    this.getConfig   = getConfig;
    this.saveConfig  = saveConfig;
    this.getEngine   = getEngine;
    this.startEngine = startEngine;
    this.log         = log;
    this._busy       = Promise.resolve();
  }

  list() { return this.getConfig().schedules || []; }

  _write(list) {
    const cfg = this.getConfig();
    cfg.schedules = list;
    this.saveConfig(cfg);
    this.emit("changed", list);
  }

  save(s) {
    if (!/^\d{2}:\d{2}$/.test(s.time || "")) throw new Error("Time must be HH:MM");
    if (!s.group) throw new Error("Pick a task group");
    const list = this.list();
    const item = {
      id: s.id || crypto.randomUUID(),
      time: s.time, group: s.group,
      action: s.action === "stop" ? "stop" : "start",
      repeat: s.repeat === "daily" ? "daily" : "once",
      days: Array.isArray(s.days) && s.days.length ? s.days : null,
      enabled: s.enabled !== false,
      lastFired: s.lastFired || null,
    };
    const i = list.findIndex(x => x.id === item.id);
    if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item);
    this._write(list);
    return item;
  }

  remove(id)  { this._write(this.list().filter(x => x.id !== id)); }
  toggle(id)  { this._write(this.list().map(x => x.id === id ? { ...x, enabled: !x.enabled } : x)); }

  // next fire time as epoch ms (for countdowns)
  nextRun(s, from = new Date()) {
    if (!s.enabled) return null;
    const [h, m] = s.time.split(":").map(Number);
    for (let add = 0; add < 8; add++) {
      const d = new Date(from); d.setDate(d.getDate() + add); d.setHours(h, m, 0, 0);
      if (d <= from) continue;
      if (s.days && !s.days.includes(d.getDay())) continue;
      return d.getTime();
    }
    return null;
  }

  start() {
    this._timer = setInterval(() => this._tick(), 5_000);
    this._tick();
  }
  stop() { clearInterval(this._timer); }

  _tick() {
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const key  = stamp(now);
    for (const s of this.list()) {
      if (!s.enabled || s.time !== hhmm || s.lastFired === key) continue;
      if (s.days && !s.days.includes(now.getDay())) continue;
      // mark fired before running so a slow start never double-fires
      this._write(this.list().map(x => x.id === s.id
        ? { ...x, lastFired: key, enabled: x.repeat === "daily" ? x.enabled : false }
        : x));
      const action = s.action || "start";
      if (action === "stop") {
        this.stopNow(s.group, `schedule ${s.time}`);
      } else {
        this.runNow(s.group, `schedule ${s.time}`);
      }
    }
  }

  // Queue runs so two schedules in the same minute don't talk over each other
  runNow(group, why = "manual") {
    this._busy = this._busy.then(() => this._run(group, why)).catch(e => this.log(`[Scheduler] ${e.message}`, "error"));
    return this._busy;
  }

  stopNow(group, why = "manual") {
    this._busy = this._busy.then(() => this._runStop(group, why)).catch(e => this.log(`[Scheduler] ${e.message}`, "error"));
    return this._busy;
  }

  async _run(group, why) {
    this.log(`[Scheduler] ${why} → starting group "${group}"`, "ok");
    let eng = this.getEngine();
    if (!eng?.running) {
      this.log("[Scheduler] engine not running — launching", "dim");
      const r = await this.startEngine();
      if (!r.ok) throw new Error(`launch failed: ${r.err}`);
      eng = this.getEngine();
    }
    const menu = await eng.waitForMenu(90_000);
    if (!menu) this.log("[Scheduler] menu never appeared — sending anyway", "warn");
    const result = await eng.sendThenWait("2", /Enter group name/i, group, 6_000);
    this.log(`[Scheduler] sent "2" → "${group}" (${result === "matched" ? "prompt matched" : "prompt not seen, sent on timeout"})`,
      result === "matched" ? "ok" : "warn");
    this.emit("fired", { group, why, at: Date.now(), result, action: "start" });
  }

  async _runStop(group, why) {
    this.log(`[Scheduler] ${why} → stopping group "${group}"`, "warn");
    const eng = this.getEngine();
    if (!eng?.running) {
      this.log("[Scheduler] engine not running — nothing to stop", "dim");
      return;
    }
    // send stop command: "4" then group name — repeat 3× because engine may
    // miss stdin writes while mid-task
    let result = "timeout";
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await eng.sendThenWait("4", /Enter group name/i, group, 4_000);
      if (r === "matched") { result = "matched"; break; }
      // small gap before retry
      await new Promise(ok => setTimeout(ok, 350));
    }
    this.log(`[Scheduler] sent "4" → "${group}" (${result === "matched" ? "prompt matched" : "sent on timeout after retries"})`,
      result === "matched" ? "ok" : "warn");
    this.emit("fired", { group, why, at: Date.now(), result, action: "stop" });
  }
}

module.exports = Scheduler;
