// ── MakeBot+ checkout capture ─────────────────────────────────────────────────
// The engine only logs "> success" — the real details (product, image, price,
// size, order #) live in the Discord webhook embed it sends. A Discord webhook
// URL can only be POSTed to, not read from, so there are two ways in:
//
//  1. RELAY (default, no Discord setup):
//     The engine's webhook is pointed at  http://127.0.0.1:4270/api/webhooks/<id>/<token>
//     This server parses the embed for the dashboard, then forwards the exact
//     same request to https://discord.com/api/webhooks/<id>/<token> and hands
//     Discord's response back to the engine. Discord still gets every message.
//
//  2. BOT (fallback, if the engine refuses a non-Discord URL):
//     A Discord bot token reads the webhook's channel over REST and picks up
//     messages that webhook posted.

const http   = require("http");
const https  = require("https");
const fs     = require("fs");
const crypto = require("crypto");
const EventEmitter = require("events");

const WEBHOOK_RE = /^https?:\/\/(?:[\w.-]+\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([\w-]+)/i;

// ── embed → checkout record ───────────────────────────────────────────────────
function cleanVal(v) {
  if (v == null) return "";
  return String(v)
    .replace(/\|\|([\s\S]*?)\|\|/g, "$1")          // ||spoiler||
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1") // [text](url)
    .replace(/[`*_~]/g, "")
    .replace(/<a?:\w+:\d+>/g, "")                   // custom emoji
    .trim();
}
function firstUrl(v) {
  const m = String(v || "").match(/\((https?:[^)\s]+)\)|(https?:\/\/[^\s|)>]+)/);
  return m ? (m[1] || m[2]) : "";
}
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9#]/g, "");

function parsePrice(s) {
  const m = String(s || "").replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

function embedToCheckout(embed, payload, meta = {}) {
  const fields = (embed.fields || []).map(f => ({ name: cleanVal(f.name), value: cleanVal(f.value), rawValue: f.value }));
  if (!fields.length && !embed.title && !embed.description) return null;

  const pick = (...keys) => {
    for (const k of keys) {
      const f = fields.find(f => norm(f.name) === k) || fields.find(f => norm(f.name).includes(k));
      if (f && f.value) return f;
    }
    return null;
  };
  const val = (...keys) => pick(...keys)?.value || "";

  const title  = cleanVal(embed.title);
  const author = cleanVal(embed.author?.name);
  const headline = [title, author, cleanVal(payload.content)].join(" ");

  let status = "other";
  if (/declin|fail|error|denied|card|payment (issue|error)|out of stock|oos/i.test(headline)) status = "declined";
  else if (/success|checked ?out|checkout|order (placed|confirmed)|paid|copped|purchase/i.test(headline)) status = "success";

  // product name: a "Product"/"Item" field, else a non-generic title, else first description line
  const genericTitle = /^(successful|success|checkout|checked out|order|declined|failed|payment)\b/i.test(title) || /checkout|success|declin/i.test(title);
  let product = val("product", "item", "productname", "title", "name");
  if (!product && title && !genericTitle) product = title;
  if (!product && embed.description) product = cleanVal(String(embed.description).split("\n")[0]);

  const allText = [title, embed.description, ...fields.map(f => `${f.name}: ${f.value}`)].join("\n");

  let order = val("order", "ordernumber", "order#", "orderid", "confirmation");
  if (!order) {
    const m = allText.match(/order\s*(?:#|number|no\.?|id)?\s*[:\-]?\s*#?([A-Z0-9-]{4,})/i);
    if (m) order = m[1];
  }
  const orderField = pick("order", "ordernumber", "orderid");
  const orderUrl = orderField ? firstUrl(orderField.rawValue) : "";

  const priceStr = val("price", "total", "amount", "cost", "subtotal");
  const site     = val("site", "store", "shop", "domain", "website") || hostOf(embed.url);
  const productUrl = embed.url || firstUrl(pick("product", "item", "link", "url")?.rawValue) || "";

  return {
    id:       meta.id || crypto.randomUUID(),
    ts:       embed.timestamp ? Date.parse(embed.timestamp) || Date.now() : (meta.ts || Date.now()),
    source:   meta.source || "relay",
    status,
    headline: title || author,
    product,
    site,
    size:     val("size", "variant", "option"),
    color:    val("color", "colour", "style"),
    price:    priceStr,
    priceNum: parsePrice(priceStr),
    qty:      val("quantity", "qty"),
    order,
    orderUrl,
    profile:  val("profile"),
    account:  val("account", "email", "login", "user"),
    proxy:    val("proxy"),
    mode:     val("mode"),
    task:     val("task", "taskid", "group"),
    image:    upscaleImg(embed.image?.url || embed.thumbnail?.url || ""),
    productUrl,
    fields:   fields.map(({ name, value }) => ({ name, value })),
    raw:      embed,
  };
}

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }

// Discord CDN serves tiny thumbnails by default — request a larger size
function upscaleImg(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (/discord(app)?\.com|media\.discordapp\.net/.test(u.hostname)) {
      u.searchParams.set("width", "400");
      u.searchParams.set("height", "400");
      return u.toString();
    }
  } catch {}
  return url;
}

function payloadToCheckouts(payload, meta) {
  if (!payload || typeof payload !== "object") return [];
  return (payload.embeds || []).map((e, i) => embedToCheckout(e, payload, { ...meta, id: meta.id ? `${meta.id}:${i}` : undefined })).filter(Boolean);
}

// Webhooks can arrive as JSON or multipart/form-data (payload_json + files)
function extractPayload(contentType, body) {
  const ct = String(contentType || "");
  const text = body.toString("utf8");
  if (ct.includes("application/json")) { try { return JSON.parse(text); } catch { return null; } }
  if (ct.includes("multipart/form-data")) {
    const m = text.match(/name="payload_json"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)\r?\n--/);
    if (m) { try { return JSON.parse(m[1]); } catch { return null; } }
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(text).get("payload_json");
    if (p) { try { return JSON.parse(p); } catch { return null; } }
  }
  try { return JSON.parse(text); } catch { return null; }
}

// Same embed seen via relay and via bot → one card
function fingerprint(co) {
  // Normalize: use only parsed fields (not raw embed) so relay vs discord API payloads match
  const key = [
    (co.headline || "").toLowerCase().trim(),
    (co.product  || "").toLowerCase().trim(),
    (co.order    || "").trim(),
    (co.site     || "").toLowerCase().trim(),
    (co.account  || co.profile || "").toLowerCase().trim(),
    (co.size     || "").toLowerCase().trim(),
    (co.price    || "").trim(),
  ];
  return crypto.createHash("sha1").update(JSON.stringify(key)).digest("hex");
}

// ── service ───────────────────────────────────────────────────────────────────
class CheckoutService extends EventEmitter {
  constructor({ storePath, getConfig, saveConfig, port = 4270 }) {
    super();
    this.storePath  = storePath;
    this.getConfig  = getConfig;
    this.saveConfig = saveConfig;
    this.port       = port;
    this.items      = this._load();
    this._dedup();
    this._mergeRelated();
    this.seen       = new Map(this.items.map(c => [fingerprint(c), c.source]));  // fp → source
    this.relay      = { listening: false, received: 0, forwarded: 0, lastAt: null, lastError: null };
    this.bot        = { enabled: false, ok: false, channelId: null, lastPoll: null, error: null, imported: 0 };
    this._botTimer  = null;
    this._lastMsgId = null;
  }

  // ── store ───────────────────────────────────────────────────────────────────
  _load() {
    try { return JSON.parse(fs.readFileSync(this.storePath, "utf8")); } catch { return []; }
  }
  _save() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try { fs.writeFileSync(this.storePath, JSON.stringify(this.items.slice(0, 3000))); } catch {}
    }, 400);
  }
  list()  { return this.items; }
  clear() { this.items = []; this.seen.clear(); this._save(); this.emit("cleared"); }
  remove(id) { this.items = this.items.filter(c => c.id !== id); this._save(); }
  update(id, patch) {
    const co = this.items.find(c => c.id === id);
    if (co) { Object.assign(co, patch); this._save(); this.emit("updated", co); }
  }

  // ── dedup: drop duplicates already in stored data ───────────────────────────
  _dedup() {
    const seen = new Map();
    const before = this.items.length;
    this.items = this.items.filter(c => {
      const fp = fingerprint(c);
      if (seen.has(fp)) return false;
      seen.set(fp, true);
      return true;
    });
    if (this.items.length < before) this._save();
  }

  // ── merge ORDER/SETUP "other" records into their matching SUCCESS card ──────
  _mergeRelated() {
    const successes = this.items.filter(c => c.status === "success");
    const remove = new Set();
    for (const c of this.items) {
      if (c.status !== "other") continue;
      const hl = (c.headline || "").toLowerCase();
      const isOrder = /order/i.test(hl);
      const isSetup = /setup|init/i.test(hl);
      if (!isOrder && !isSetup) continue;

      // match by order number
      let match = null;
      if (c.order) match = successes.find(s => s.order === c.order);

      // match by profile/account within 10 min
      if (!match) {
        const key = (c.profile || c.account || "").toLowerCase();
        if (key) {
          match = successes.find(s => {
            const sk = (s.profile || s.account || "").toLowerCase();
            return sk === key && Math.abs(s.ts - c.ts) < 600_000;
          });
        }
      }

      // last resort: nearest success within 3 min
      if (!match) {
        match = successes
          .filter(s => Math.abs(s.ts - c.ts) < 180_000 && !s._matchedOrder && !s._matchedSetup)
          .sort((a, b) => Math.abs(a.ts - c.ts) - Math.abs(b.ts - c.ts))[0];
      }

      if (match) {
        if (isOrder) {
          match.hasOrder = true;
          match._matchedOrder = true;
          if (!match.order && c.order) match.order = c.order;
          if (!match.orderUrl && c.orderUrl) match.orderUrl = c.orderUrl;
        }
        if (isSetup) {
          match.hasSetup = true;
          match._matchedSetup = true;
        }
        remove.add(c);
      }
    }
    // clean temp flags
    successes.forEach(s => { delete s._matchedOrder; delete s._matchedSetup; });
    if (remove.size) {
      this.items = this.items.filter(c => !remove.has(c));
      this._save();
    }
  }

  _ingest(payload, meta) {
    let added = 0;
    for (const co of payloadToCheckouts(payload, meta)) {
      if (co.source === "discord" && this.items.some(x => x.id === co.id)) continue;  // re-polled message
      const fp = fingerprint(co);
      if (this.seen.has(fp)) continue;   // same checkout via relay AND bot/backfill → keep first
      this.seen.set(fp, co.source);
      this.items.unshift(co);
      this.emit("checkout", co);
      added++;
    }
    if (added) { this._mergeRelated(); this._save(); }
    return added;
  }

  status() {
    const cfg = this.getConfig();
    return {
      relay: { ...this.relay, port: this.port },
      bot:   { ...this.bot, hasToken: !!cfg.discordBotToken },
      realWebhook: cfg.realWebhookUrl || null,
    };
  }
  _status() { this.emit("status", this.status()); }

  relayUrlFor(realUrl) {
    const m = String(realUrl || "").match(WEBHOOK_RE);
    if (!m) return null;
    return `http://127.0.0.1:${this.port}/api/webhooks/${m[1]}/${m[2]}`;
  }
  isRelayUrl(url) { return new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${this.port}/api/webhooks/`).test(String(url || "")); }

  // ── 1. relay ────────────────────────────────────────────────────────────────
  startRelay() {
    this.server = http.createServer((req, res) => this._handleRelay(req, res));
    this.server.on("error", e => { this.relay.listening = false; this.relay.lastError = e.message; this._status(); });
    this.server.listen(this.port, "127.0.0.1", () => { this.relay.listening = true; this._status(); });
  }
  stop() { this.server?.close(); clearInterval(this._botTimer); }

  _handleRelay(req, res) {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const m = req.url.match(/^\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([\w-]+)/);
      if (!m) { res.writeHead(404); res.end("not a webhook path"); return; }

      this.relay.received++;
      this.relay.lastAt = Date.now();

      if (req.method === "POST") {
        const payload = extractPayload(req.headers["content-type"], body);
        if (payload) this._ingest(payload, { source: "relay" });
        this.emit("rawWebhook", payload);
      }

      // forward untouched to Discord
      const headers = { "user-agent": req.headers["user-agent"] || "MakeBotPlus-Relay" };
      if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
      if (body.length) headers["content-length"] = body.length;

      const fwd = https.request({ hostname: "discord.com", path: req.url, method: req.method, headers }, up => {
        const out = [];
        up.on("data", c => out.push(c));
        up.on("end", () => {
          if (up.statusCode >= 400) this.relay.lastError = `Discord ${up.statusCode}: ${Buffer.concat(out).toString().slice(0, 140)}`;
          else { this.relay.forwarded++; this.relay.lastError = null; }
          const h = {};
          ["content-type", "x-ratelimit-remaining", "x-ratelimit-reset-after", "retry-after"].forEach(k => { if (up.headers[k]) h[k] = up.headers[k]; });
          res.writeHead(up.statusCode, h);
          res.end(Buffer.concat(out));
          this._status();
        });
      });
      fwd.on("error", e => {
        this.relay.lastError = `Forward failed: ${e.message}`;
        res.writeHead(502); res.end(e.message);
        this._status();
      });
      fwd.setTimeout(15_000, () => fwd.destroy(new Error("timeout")));
      fwd.end(body);
      this._status();
    });
  }

  // ── 2. bot poller ───────────────────────────────────────────────────────────
  async startBot() {
    clearInterval(this._botTimer);
    const cfg = this.getConfig();
    this.bot = { enabled: false, ok: false, channelId: null, lastPoll: null, error: null, imported: this.bot.imported || 0 };
    if (!cfg.discordBotToken) { this._status(); return; }
    const wh = String(cfg.realWebhookUrl || "").match(WEBHOOK_RE);
    if (!wh) { this.bot.error = "Real webhook URL unknown — start the engine once so it can be read from the menu."; this._status(); return; }

    this.bot.enabled = true;
    try {
      const info = await this._discordGet(`/api/v10/webhooks/${wh[1]}/${wh[2]}`, false);
      this.bot.channelId = info.channel_id;
      this._webhookId    = info.id;
    } catch (e) { this.bot.error = `Webhook lookup failed: ${e.message}`; this._status(); return; }

    const poll = async () => {
      try {
        const q = this._lastMsgId ? `after=${this._lastMsgId}&limit=50` : `limit=50`;
        const msgs = await this._discordGet(`/api/v10/channels/${this.bot.channelId}/messages?${q}`, true);
        msgs.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        for (const msg of msgs) {
          this._lastMsgId = msg.id;
          if (msg.webhook_id !== this._webhookId) continue;
          if (!msg.embeds?.length && msg.content) continue;
          this.bot.imported += this._ingest(msg, { source: "discord", id: msg.id, ts: Date.parse(msg.timestamp) });
        }
        this.bot.ok = true; this.bot.error = null; this.bot.lastPoll = Date.now();
        if (msgs.length && msgs.every(m => !m.embeds?.length && !m.content)) {
          this.bot.error = "Messages have no content — enable MESSAGE CONTENT INTENT for the bot in the Discord developer portal.";
        }
      } catch (e) { this.bot.ok = false; this.bot.error = e.message; }
      this._status();
    };
    await poll();
    this._botTimer = setInterval(poll, 15_000);
  }

  // ── 3. backfill — page backwards through channel history ─────────────────
  async backfill(maxPages = 20, onProgress) {
    const cfg = this.getConfig();
    if (!cfg.discordBotToken) throw new Error("Discord bot token required — add it in Settings");
    const wh = String(cfg.realWebhookUrl || "").match(WEBHOOK_RE);
    if (!wh) throw new Error("No webhook URL — start the engine once first");

    // resolve channel + webhook id
    let channelId = this.bot.channelId;
    let webhookId = this._webhookId;
    if (!channelId || !webhookId) {
      const info = await this._discordGet(`/api/v10/webhooks/${wh[1]}/${wh[2]}`, false);
      channelId = info.channel_id;
      webhookId = info.id;
      this.bot.channelId = channelId;
      this._webhookId = webhookId;
    }

    let before = null;
    let totalImported = 0;
    let totalScanned  = 0;
    let page = 0;

    while (page < maxPages) {
      const q = before ? `before=${before}&limit=100` : `limit=100`;
      let msgs;
      try {
        msgs = await this._discordGet(`/api/v10/channels/${channelId}/messages?${q}`, true);
      } catch (e) {
        if (/429|rate.?limit/i.test(e.message)) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw e;
      }
      if (!msgs.length) break;

      // oldest message id for next page
      msgs.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
      before = msgs[0].id;
      totalScanned += msgs.length;

      for (const msg of msgs) {
        if (msg.webhook_id !== webhookId) continue;
        if (!msg.embeds?.length) continue;
        totalImported += this._ingest(msg, { source: "discord", id: msg.id, ts: Date.parse(msg.timestamp) });
      }

      page++;
      if (onProgress) onProgress({ page, totalScanned, totalImported });

      // rate-limit courtesy: 500ms between pages
      if (msgs.length === 100) await new Promise(r => setTimeout(r, 500));
      else break; // less than 100 = we reached the end
    }
    this._status();
    return { totalScanned, totalImported, pages: page };
  }

  _discordGet(path, auth) {
    const token = this.getConfig().discordBotToken;
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "discord.com", path, method: "GET",
        headers: { "user-agent": "MakeBotPlus (local, 1.0)", ...(auth ? { authorization: `Bot ${token}` } : {}) },
      }, res => {
        const out = []; res.on("data", c => out.push(c));
        res.on("end", () => {
          const text = Buffer.concat(out).toString();
          if (res.statusCode === 429) return reject(new Error("Rate limited by Discord — will retry"));
          if (res.statusCode === 401) return reject(new Error("Bot token rejected (401)"));
          if (res.statusCode === 403) return reject(new Error("Bot can't read that channel (403) — invite it and grant View Channel + Read Message History"));
          if (res.statusCode >= 400) return reject(new Error(`Discord ${res.statusCode}: ${text.slice(0, 120)}`));
          try { resolve(JSON.parse(text)); } catch { reject(new Error("Bad JSON from Discord")); }
        });
      });
      req.on("error", reject);
      req.setTimeout(10_000, () => req.destroy(new Error("timeout")));
      req.end();
    });
  }
}

module.exports = { CheckoutService, payloadToCheckouts, extractPayload, WEBHOOK_RE };
