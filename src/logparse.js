// ── MakeBot+ engine log parser ────────────────────────────────────────────────
// Engine line formats seen in the wild:
//   [12:02:16.459][INFO]|[shop-topps-com][TASK-0292]| > proposal
//   [16:11:17.285][ERROR]|CsvUtil| > error in 'topfoot.csv' at line '33' ...
//   [12:40:01.002][ERROR]|Webhook| > Webhook not sent properly
//   Loaded Tasks: 5736                         (plain startup text)
// Defensive: if two entries ever arrive on one stdout line (e.g. a missing
// newline under heavy load), split them on the timestamp boundary.

const SPLIT_RE = /(?=\[\d{2}:\d{2}:\d{2}\.\d{1,3}\]\[[A-Z]+\])/;
const LINE_RE  = /^\[(\d{2}:\d{2}:\d{2})\.\d{1,3}\]\[([A-Z]+)\]\|(?:\[([^\]]+)\]\[([^\]]+)\]|([^|]*))\|\s*>?\s*(.*)$/;

// Log/console types. Task states are a subset (see TASK_STATES).
//   monitor  – watching for product / waiting for drop
//   queue    – in Shopify queue / pre-queue
//   init     – initializing, login, session, cloudflare
//   cart     – adding to cart
//   checkout – checkpoint, contact, tokenizing, proposal, placing order, receipt
//   captcha  – solving a checkout captcha
//   success  – order placed
//   fail     – a step failed (task usually retries)
//   stopped  – task stopped
//   error    – engine/system error (ERROR level)
//   warn / info / dim – everything else
function classify(level, msg) {
  const m = msg.toLowerCase();

  if (level === "ERROR")                                   return "error";
  if (m.startsWith("failed")) {
    // "Failed 'monitoring X' -> no products found" is normal monitoring, not a failure
    if (/^failed '(monitoring|queue)/.test(m))             return m.includes("queue") ? "queue" : "monitor";
    return "fail";
  }
  if (m.includes("stopping task") || m === "stopped")      return "stopped";
  if (/(^|-> )success\b/.test(m))                          return "success";
  if (m.includes("mismatch"))                              return "fail";
  if (m.includes("captcha"))                               return "captcha";
  if (m.includes("adding to cart") || m.includes("add to cart") || m.includes("carting")) return "cart";
  if (/placing order|proposal|pending terms|updating checkout|polling for receipt|checkpoint|contact page|tokenizing|csrf|shipping|payment/.test(m))
                                                           return "checkout";
  if (/queue/.test(m))                                     return "queue";
  if (/monitoring|homepage|waiting for drop|no (matching )?products|restock/.test(m))
                                                           return "monitor";
  if (/initializing|login|signin|sign in|session|cloudflare|refreshing/.test(m))
                                                           return "init";
  if (level === "WARN")                                    return "warn";
  return "info";
}

// Plain (unstructured) engine text: startup banner, menu, prompts
function classifyPlain(text) {
  const l = text.toLowerCase();
  if (/error|exception|failed|invalid/.test(l))            return "error";
  if (/^\d\)\s/.test(text))                                return "dim";      // menu items
  if (/enter group name|do you want|y\/n/.test(l))         return "warn";     // prompts
  if (/loaded|starting|initialized|up ?to ?date/.test(l))  return "ok";
  return "info";
}

// Returns an array of entries (one raw line can hold several glued entries)
function parseRaw(raw) {
  const out = [];
  for (const part of String(raw).split(SPLIT_RE)) {
    const text = part.trim();
    if (!text) continue;
    const m = text.match(LINE_RE);
    if (m) {
      const [, ts, level, site, task, comp, msg] = m;
      out.push({
        ts, level, site: site || null, task: task || null,
        comp: comp ? comp.trim() : null,
        msg: msg.trim(),
        type: classify(level, msg.trim()),
      });
    } else {
      out.push({ ts: null, level: null, site: null, task: null, comp: null, msg: text, type: classifyPlain(text) });
    }
  }
  return out;
}

// ── Per-task state tracker ────────────────────────────────────────────────────
// Every task's latest state, so the UI can show "how many tasks are in queue right now".
const TASK_STATES = ["init", "monitor", "queue", "cart", "checkout", "captcha", "success", "fail", "stopped"];

class TaskTracker {
  constructor() { this.reset(); }

  reset() {
    this.tasks      = new Map();  // taskId → { state, site, msg, ts }
    this.succeeded  = new Set();  // taskIds that ever reached success
    this.failEvents = 0;
    this.totalLoaded = 0;
  }

  update(e) {
    if (!e.task) return false;
    let state = e.type;
    if (!TASK_STATES.includes(state)) state = (state === "warn" || state === "error") ? "fail" : null;
    if (!state) return false;
    if (state === "fail") this.failEvents++;
    if (state === "success") this.succeeded.add(e.task);
    this.tasks.set(e.task, { state, site: e.site, msg: e.msg, ts: e.ts });
    return true;
  }

  counts() {
    const c = { active: 0, success: this.succeeded.size, failEvents: this.failEvents, totalLoaded: this.totalLoaded };
    TASK_STATES.forEach(s => { if (s !== "success") c[s] = 0; });
    for (const t of this.tasks.values()) {
      if (t.state === "success") continue;
      c[t.state]++;
      if (t.state !== "stopped") c.active++;
    }
    return c;
  }
}

module.exports = { parseRaw, classify, TaskTracker, TASK_STATES };
