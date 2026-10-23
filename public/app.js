"use strict";
window.addEventListener("DOMContentLoaded", () => {
  if (!window.api) {
    document.getElementById("root").innerHTML =
      `<div style="color:#c45454;font-family:monospace;padding:40px">ERROR: preload bridge missing</div>`;
    return;
  }
  App(window.api);
});

function App(api) {

// ── THEME ─────────────────────────────────────────────────────────────────────
// Every color is a CSS variable so the light/dark toggle is a single attribute
// flip on <html>. C / T keep their old names so page code is unchanged.
const C = {
  base:"var(--bg)", surface:"var(--surface)", panel:"var(--panel)",
  border:"var(--border)", borderHi:"var(--border-hi)", accent:"var(--accent)",
  accentHi:"var(--accent-hi)", accentDim:"var(--accent-dim)", text:"var(--text)",
  textDim:"var(--text-dim)", textMuted:"var(--text-muted)", success:"var(--success)",
  warn:"var(--warn)", danger:"var(--danger)", dangerHi:"var(--danger-hi)",
};
// task-state / log colors (console, stat tiles)
const T = {
  monitor:"var(--t-monitor)", queue:"var(--t-queue)", init:"var(--t-init)", cart:"var(--t-cart)",
  checkout:"var(--t-checkout)", captcha:"var(--t-captcha)", success:"var(--t-success)", fail:"var(--t-fail)",
  stopped:"var(--t-stopped)", error:"var(--t-error)", warn:"var(--t-warn)",
};
const STATE_TILES = [
  { k:"monitor",  l:"Monitoring" },
  { k:"queue",    l:"In Queue" },
  { k:"cart",     l:"Carting" },
  { k:"checkout", l:"Checkout", plus:["captcha"] },
  { k:"success",  l:"Success" },
  { k:"fail",     l:"Failing" },
  { k:"stopped",  l:"Stopped" },
];

// ── STYLES ────────────────────────────────────────────────────────────────────
const css = `
:root,[data-theme="dark"]{
  color-scheme:dark;
  --bg:#0e1013; --side:#0b0d0f; --surface:#14171b; --panel:#15181c; --raised:#1b1f24; --hover:#1d2127;
  --border:#22262c; --border-hi:#30353d; --console:#0b0d0f;
  --text:#e6e8eb; --text-dim:#9aa1aa; --text-muted:#666d77;
  --accent:#1ed6a4; --accent-hi:#3fe6b8; --accent-ink:#03140e; --accent-dim:color-mix(in srgb,var(--accent) 14%,transparent);
  --success:#2fbf71; --warn:#e3a33b; --danger:#e5484d; --danger-hi:#ff6b6f; --danger-dim:color-mix(in srgb,var(--danger) 14%,transparent);
  --t-monitor:#5b9bd5; --t-queue:#a08cf0; --t-init:#8f9bb0; --t-cart:#e3a33b; --t-checkout:#e6c84f; --t-captcha:#d08ad8;
  --t-success:#3fd07f; --t-fail:#e8894a; --t-stopped:#7d838c; --t-error:#ff6b6f; --t-warn:#d9b53f;
  --shadow:0 10px 40px rgba(0,0,0,.55); --glow:0 0 0 1px color-mix(in srgb,var(--accent) 40%,transparent),0 6px 22px color-mix(in srgb,var(--accent) 30%,transparent);
}
[data-theme="light"]{
  color-scheme:light;
  --bg:#f5f6f7; --side:#ffffff; --surface:#ffffff; --panel:#ffffff; --raised:#f2f4f6; --hover:#eef1f3;
  --border:#e3e6ea; --border-hi:#d1d5db; --console:#fbfbfc;
  --text:#14171b; --text-dim:#59606a; --text-muted:#8b929c;
  --accent:#0ea57a; --accent-hi:#0b8a66; --accent-ink:#ffffff; --accent-dim:color-mix(in srgb,var(--accent) 11%,transparent);
  --success:#178a4f; --warn:#b97a10; --danger:#d93036; --danger-hi:#c3252b; --danger-dim:color-mix(in srgb,var(--danger) 10%,transparent);
  --t-monitor:#2a6fc0; --t-queue:#6650d6; --t-init:#5f6b80; --t-cart:#b06d00; --t-checkout:#9a7a00; --t-captcha:#a43fae;
  --t-success:#14864a; --t-fail:#c25a17; --t-stopped:#7a8089; --t-error:#d93036; --t-warn:#9a7a00;
  --shadow:0 10px 40px rgba(20,23,27,.14); --glow:0 4px 16px color-mix(in srgb,var(--accent) 28%,transparent);
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;overflow:hidden;user-select:none}
body{background:var(--bg);color:var(--text);font-family:Inter,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;
     font-size:13px;-webkit-font-smoothing:antialiased;font-feature-settings:"tnum" 1}
button,input,select,textarea{font-family:inherit}
.mono{font-family:"Cascadia Mono","Cascadia Code",Consolas,monospace}

/* ── SHELL ── */
.app{display:grid;grid-template-columns:224px 1fr;height:100vh}
.side{background:var(--side);border-right:1px solid var(--border);display:flex;flex-direction:column;min-height:0}
.brand{display:flex;align-items:center;gap:10px;padding:16px 18px 18px;-webkit-app-region:drag}
.brand svg{width:26px;height:26px;flex-shrink:0}
.brand-name{font-size:13px;font-weight:650;line-height:1.15}
.brand-sub{font-size:11px;color:var(--text-muted)}
.nav{flex:1;overflow-y:auto;padding:0 10px}
.nav-sec{font-size:10.5px;font-weight:600;letter-spacing:.09em;color:var(--text-muted);text-transform:uppercase;padding:14px 10px 6px}
.nav-item{display:flex;align-items:center;gap:11px;padding:8px 10px;margin:1px 0;border-radius:8px;cursor:pointer;
  color:var(--text-dim);font-size:13px;font-weight:500;position:relative;transition:background .12s,color .12s}
.nav-item svg{width:16px;height:16px;flex-shrink:0;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.nav-item:hover{background:var(--hover);color:var(--text)}
.nav-item.active{background:var(--accent-dim);color:var(--text)}
.nav-item.active::before{content:"";position:absolute;left:-10px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--accent)}
.nav-item.active svg{stroke:var(--accent)}
.nav-item.nav-dragging{opacity:.85;background:var(--hover);box-shadow:0 4px 16px rgba(0,0,0,.35);border-radius:8px}
.nav-drop-ph{border:1.5px dashed var(--accent);border-radius:8px;margin:1px 0;opacity:.45}
.side-foot{padding:10px;border-top:1px solid var(--border)}
.eng-card{margin-top:8px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}
.eng-card-top{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600}
.eng-card-row{display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px;gap:8px}
.eng-card-row span:last-child{color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}

.main{display:flex;flex-direction:column;min-width:0;min-height:0}
.topbar{display:flex;align-items:center;gap:10px;padding:0 10px 0 26px;height:62px;border-bottom:1px solid var(--border);
  flex-shrink:0;-webkit-app-region:drag;background:var(--bg)}
.no-drag,.topbar button,.topbar .pill{-webkit-app-region:no-drag}
.pg-title{font-size:18px;font-weight:650;letter-spacing:-.01em;line-height:1.2}
.pg-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.pill{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border-radius:99px;border:1px solid var(--border);
  background:var(--surface);font-size:12px;color:var(--text-dim);white-space:nowrap}
.dot{width:7px;height:7px;border-radius:50%;background:var(--text-muted);flex-shrink:0}
.dot.on{background:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.clock{font-size:12.5px;color:var(--text-dim);padding:0 6px;font-variant-numeric:tabular-nums}
.icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim);
  display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .12s}
.icon-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.icon-btn:hover{color:var(--text);border-color:var(--border-hi)}
.icon-btn.on{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.wc-group{display:flex;margin-left:4px}
.wc{width:34px;height:30px;border:none;border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;
  display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s}
.wc:hover{background:var(--hover);color:var(--text)}
.wc.cl:hover{background:var(--danger);color:#fff}
.vsep{width:1px;height:22px;background:var(--border);margin:0 2px}

.content{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0}
.pane{flex:1;overflow:auto;padding:22px 26px 26px;display:none;flex-direction:column;gap:14px}
.pane.active{display:flex}

/* ── CARDS ── */
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden;flex-shrink:0}
.card-hdr{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;
  font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;flex-shrink:0;min-height:46px}
.card-hdr .btn{text-transform:none;letter-spacing:0}
.file-hdr{text-transform:none;letter-spacing:0;font-size:14px;font-weight:650;color:var(--text)}
.file-hdr>span+span{font-family:"Cascadia Mono",Consolas,monospace;font-size:11.5px!important;font-weight:400!important;color:var(--text-muted)!important}
.file-hdr>.btn:first-of-type{margin-left:auto}
.card-body{padding:16px}
.full-card{flex:1;display:flex;flex-direction:column;min-height:0}
.toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap}
.spacer{flex:1}
.divv{width:1px;height:22px;background:var(--border);flex-shrink:0}

/* ── BUTTONS ── */
.btn{height:32px;padding:0 14px;border-radius:8px;border:1px solid var(--border-hi);background:var(--surface);color:var(--text);
  font-size:12.5px;font-weight:550;cursor:pointer;transition:all .12s;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:var(--hover);border-color:var(--border-hi)}
.btn.pr{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);box-shadow:var(--glow)}
.btn.pr:hover{background:var(--accent-hi);border-color:var(--accent-hi)}
.btn.dg{border-color:color-mix(in srgb,var(--danger) 55%,transparent);background:var(--danger-dim);color:var(--danger-hi)}
.btn.dg:hover{background:var(--danger);border-color:var(--danger);color:#fff}
.btn.sm{height:28px;padding:0 11px;font-size:12px;border-radius:7px}
.btn:disabled{opacity:.4;pointer-events:none;box-shadow:none}

/* ── SPREADSHEET ── */
.sheet-wrap{overflow:auto;flex:1;min-height:0}
.sheet{border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px;width:max-content;min-width:100%}
.sheet th{padding:0 10px;height:36px;text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;color:var(--text-muted);
  text-transform:uppercase;border-bottom:1px solid var(--border);border-right:1px solid var(--border);background:var(--panel);
  white-space:nowrap;position:sticky;top:0;z-index:2;min-width:100px;user-select:none}
.sheet th.row-num{min-width:42px;width:42px;text-align:center;position:sticky;left:0;z-index:3;background:var(--panel)}
.sheet td{border-bottom:1px solid var(--border);border-right:1px solid var(--border);padding:0;background:var(--panel);position:relative;white-space:nowrap;height:34px}
.sheet td.row-num{text-align:center;font-size:10.5px;color:var(--text-muted);background:var(--panel);position:sticky;left:0;z-index:1;
  font-family:"Cascadia Mono",Consolas,monospace;user-select:none;min-width:42px;width:42px}
.sheet td input{width:100%;height:100%;padding:0 10px;background:transparent;border:none;color:var(--text);
  font-family:"Cascadia Mono","Cascadia Code",Consolas,monospace;font-size:12px;outline:none;min-width:0}
.sheet td input:focus{background:var(--accent-dim);box-shadow:inset 0 0 0 1.5px var(--accent)}
.sheet tr:hover td:not(.row-num){background:var(--hover)}
.sheet tr.sel-row td{background:var(--accent-dim)}
.add-row-btn{display:flex;align-items:center;gap:6px;padding:10px 16px;cursor:pointer;color:var(--text-dim);font-size:12px;
  border-top:1px solid var(--border);transition:color .12s,background .12s;user-select:none}
.add-row-btn:hover{color:var(--accent);background:var(--hover)}

/* ── GROUP SIDEBAR (inside pages) ── */
.sl{display:flex;gap:16px;flex:1;min-height:0}
.sidebar{width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;min-height:0}
.sidebar>.card{display:flex;flex-direction:column;min-height:0;flex-shrink:1}
.sidebar .btn{justify-content:center}
.sidebar-main{flex:1;display:flex;flex-direction:column;min-width:0}
.g-list{display:flex;flex-direction:column;gap:2px;padding:8px;overflow-y:auto}
.g-item{padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:550;color:var(--text);border:1px solid transparent;
  transition:all .1s;display:flex;justify-content:space-between;align-items:center;gap:8px}
.g-item span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g-item:hover{background:var(--hover)}
.g-item.active{background:var(--accent-dim);border-color:color-mix(in srgb,var(--accent) 35%,transparent)}
.g-count{color:var(--text-muted);font-size:11px;font-weight:500;flex-shrink:0}

/* plain text editor (accounts / proxies) */
.txt-editor{flex:1;width:100%;background:var(--panel);border:none;border-radius:0;color:var(--text);
  font-family:"Cascadia Mono","Cascadia Code",Consolas,monospace;font-size:12px;padding:12px 16px;outline:none;resize:none;line-height:1.75}
.txt-editor:focus{outline:none}

/* ── CONSOLE ── */
.con-wrap{background:var(--console);border:1px solid var(--border);border-radius:10px;flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:440px}
.con-hdr{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;
  letter-spacing:.08em;color:var(--text-muted);flex-shrink:0;text-transform:uppercase}
.con-hdr .btn{text-transform:none;letter-spacing:0}
.con-body{flex:1;overflow-y:auto;padding:6px 0;line-height:1.75;font-family:"Cascadia Mono","Cascadia Code",Consolas,monospace;font-size:12px}
.ll{display:flex;gap:12px;padding:1px 14px;align-items:center}
.ll:hover{background:var(--hover)}
.lt{color:var(--text-muted);flex-shrink:0;user-select:none}
.lm{cursor:text;user-select:text;min-width:0;overflow-wrap:anywhere}
.lm.info{color:var(--text)} .lm.ok{color:var(--success)} .lm.warn{color:var(--t-warn)}
.lm.error{color:var(--t-error)} .lm.dim{color:var(--text-dim)}
.stats-row{display:flex;gap:8px;flex-wrap:wrap}
.e-stat{display:flex;flex-direction:column;gap:2px;padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px}
.e-val{font-size:22px;font-weight:700;color:var(--accent);line-height:1}
.e-lbl{font-size:9px;font-weight:600;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase}
.con-input-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid var(--border);flex-shrink:0;background:var(--panel)}
.con-prompt{font-family:"Cascadia Mono",Consolas,monospace;font-size:12px;color:var(--accent);flex-shrink:0;user-select:none}
.con-stdin{flex:1;background:transparent;border:none;outline:none;font-family:"Cascadia Mono",Consolas,monospace;font-size:12px;
  color:var(--text);padding:4px 0;user-select:text}
.con-stdin::placeholder{color:var(--text-muted)}

/* ── SHEET SELECTION & EXTRAS ── */
.sh-corner{cursor:pointer}
.sh-corner:hover{background:var(--accent-dim)!important;color:var(--accent)}
.sh-col-hdr{cursor:pointer}
.sh-col-hdr:hover{background:var(--hover)!important;color:var(--text)}
.sh-col-active{background:var(--accent-dim)!important;color:var(--accent)!important}
.sh-sel{background:var(--accent-dim)!important}
.sh-sel input{background:transparent!important}
.sh-sel-col{background:color-mix(in srgb,var(--accent) 7%,transparent)!important}
.sh-flash-copy{animation:shFlashC .45s ease}
.sh-flash-cut {animation:shFlashX .45s ease}
@keyframes shFlashC{0%{background:color-mix(in srgb,var(--accent) 40%,transparent)}100%{background:var(--accent-dim)}}
@keyframes shFlashX{0%{background:color-mix(in srgb,var(--danger) 40%,transparent)}100%{background:transparent}}

/* context menu */
.sh-ctx{position:fixed;z-index:999;min-width:210px;background:var(--panel);border:1px solid var(--border-hi);border-radius:10px;
  padding:5px;box-shadow:var(--shadow);font-size:12.5px;user-select:none}
.sh-ctx-item{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;cursor:pointer;color:var(--text);gap:16px}
.sh-ctx-item:hover{background:var(--hover)}
.sh-ctx-item.danger{color:var(--danger-hi)}
.sh-ctx-item.danger:hover{background:var(--danger-dim)}
.sh-ctx-key{color:var(--text-muted);font-size:11px;font-family:"Cascadia Mono",Consolas,monospace;flex-shrink:0}
.sh-ctx-sep{height:1px;background:var(--border);margin:4px 2px}

/* hint bar */
.sh-hints{display:flex;gap:0;flex-wrap:wrap;padding:6px 16px;border-top:1px solid var(--border);background:var(--panel);flex-shrink:0}
.sh-hints span{font-size:10.5px;color:var(--text-muted);padding:2px 9px;border-right:1px solid var(--border)}
.sh-hints span:first-child{padding-left:0}
.sh-hints span:last-child{border-right:none}

/* ── DASHBOARD / STAT FIGURES ── */
.dash-header{display:flex;align-items:stretch;gap:0;flex-shrink:0;flex-wrap:wrap;background:var(--panel);border:1px solid var(--border);border-radius:10px}
.dash-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:8px;padding:16px 22px;min-width:150px;border-right:1px solid var(--border)}
.dash-stat:last-of-type{border-right:none}
.dash-stat-val{font-size:28px;font-weight:650;color:var(--text);line-height:1;letter-spacing:-.02em}
.dash-stat-lbl{font-size:12px;font-weight:500;color:var(--text-dim)}
.dash-stat.hi .dash-stat-val{color:var(--accent)}
.dash-header>.btn{align-self:center;margin:0 16px 0 auto}

/* ── DASHBOARD ROW (calendar + day detail side-by-side) ── */
.dash-row{display:flex;gap:14px;align-items:stretch}
.dash-cal-card{flex:0 0 auto;min-width:320px;max-width:420px}
.dash-day-card{flex:1;min-width:0;display:flex;flex-direction:column}
.dash-cal-hdr{display:flex;align-items:center;justify-content:space-between}
.dash-cal-hdr span{font-weight:600;font-size:14px;color:var(--text)}
.dash-day-body{flex:1;overflow-y:auto;max-height:420px;display:flex;flex-direction:column;gap:6px}
.dash-day-empty{display:flex;align-items:center;justify-content:center;flex:1;color:var(--text-muted);font-size:13px;padding:40px 0;text-align:center}
.dash-day-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:var(--raised);border:1px solid var(--border);cursor:pointer;transition:border-color .12s}
.dash-day-item:hover{border-color:var(--border-hi)}
.dash-day-item img{width:44px;height:44px;object-fit:contain;border-radius:6px;background:var(--panel);flex-shrink:0}
.dash-day-item .noimg{width:44px;height:44px;border-radius:6px;background:var(--panel);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
.dash-day-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dash-day-prod{font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dash-day-sub{font-size:11px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dash-day-ts{font-size:10.5px;color:var(--text-muted)}
.dash-day-status{font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:5px;flex-shrink:0}
.dash-day-status.success{color:var(--t-success);background:color-mix(in srgb,var(--t-success) 12%,transparent)}
.dash-day-status.declined{color:var(--t-error);background:color-mix(in srgb,var(--t-error) 12%,transparent)}
.dash-day-status.other{color:var(--text-dim);background:var(--panel)}
.cal-cell.selected{outline:2px solid var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 18%,transparent)}

/* ── CALENDAR ── */
.dash-cal-wrap{}
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal-month-lbl{font-weight:600;font-size:14px;color:var(--text)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.cal-hdr-row{margin-bottom:2px}
.cal-cell{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:6px;font-size:12px;color:var(--text-dim);position:relative}
.cal-cell.empty{visibility:hidden}
.cal-day-hdr{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);aspect-ratio:auto;padding:2px 0}
.cal-cell.today{outline:2px solid var(--accent);outline-offset:-2px}
.cal-cell.has-co{background:color-mix(in srgb, var(--accent) calc(var(--co-intensity,0) * 70%), transparent);color:var(--text)}
.cal-day-num{font-weight:500}
.cal-count{font-size:9px;font-weight:700;color:var(--accent);line-height:1}
.cal-legend{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:var(--text-dim)}
.cal-legend-dot{width:12px;height:12px;border-radius:4px;background:var(--accent);opacity:.65}

/* ── GROUP BREAKDOWN TABLE (condensed) ── */
.grp-table{display:flex;flex-direction:column;gap:1px}
.grp-row{display:grid;grid-template-columns:1.4fr .5fr .5fr .5fr 1fr;align-items:center;gap:6px;padding:6px 8px;border-radius:5px}
.grp-row.grp-hdr{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);padding-bottom:3px}
.grp-row:not(.grp-hdr):hover{background:var(--hover)}
.grp-name{font-size:12px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grp-num{font-size:12px;font-weight:600;color:var(--text-dim);text-align:center}
.grp-num.ok{color:var(--accent)}
.grp-num.bad{color:var(--red,#e74c3c)}
.grp-bar-col{display:flex;align-items:center;gap:6px}
.grp-bar{flex:1;height:5px;background:var(--raised);border-radius:3px;overflow:hidden}
.grp-bar-fill{height:100%;background:var(--accent);border-radius:3px;transition:width .3s ease}
.grp-rate{font-size:11px;font-weight:600;color:var(--text);min-width:32px;text-align:right}

/* ── PRODUCT CARDS (DASHBOARD) ── */
.dash-prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.dash-prod-card{display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--raised);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.dash-prod-card:hover{border-color:var(--border-hi);box-shadow:var(--shadow)}
.dash-prod-card img{width:52px;height:52px;object-fit:contain;border-radius:6px;background:var(--panel);flex-shrink:0}
.dash-prod-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dash-prod-name{font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dash-prod-sub{font-size:11px;color:var(--text-dim)}
.dash-prod-acct{font-size:11px;color:var(--text-muted)}
.dash-prod-ts{font-size:10.5px;color:var(--text-muted)}
.dash-prod-qty{background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;flex-shrink:0}

/* ── TASK GROUPS PAGE ── */
#pane-taskgroups{padding:0;overflow:hidden}
.tg-wrap{display:flex;gap:0;height:100%;overflow:hidden}
.tg-list-panel{width:320px;min-width:280px;border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;background:var(--panel)}
.tg-list-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px}
.tg-list-title{font-size:14px;font-weight:650;color:var(--text)}
.tg-list-count{font-size:11px;color:var(--text-muted);font-weight:500}
.tg-search{margin:0 12px 8px;width:calc(100% - 24px);box-sizing:border-box}
.tg-list-body{flex:1;overflow-y:auto;padding:0 8px 12px}
.tg-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .12s}
.tg-row:hover{background:var(--hover)}
.tg-row.active{background:var(--raised);border:1px solid var(--border-hi)}
.tg-row-info{flex:1;min-width:0}
.tg-row-name{font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-row-sub{font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-row-actions{display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity .15s}
.tg-row:hover .tg-row-actions,.tg-row.active .tg-row-actions{opacity:1}
.tg-detail-panel{flex:1;overflow-y:auto;padding:16px 20px}
.tg-empty{display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);font-size:14px}
.tg-detail-hdr{margin-bottom:16px}
.tg-detail-name{font-size:20px;font-weight:700;color:var(--text)}
.tg-detail-sub{font-size:12px;color:var(--text-muted);margin-top:4px}
.tg-stats-bar{display:flex;gap:0;background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.tg-stat{flex:1;padding:14px 16px;border-right:1px solid var(--border);text-align:center}
.tg-stat:last-child{border-right:none}
.tg-stat-val{font-size:22px;font-weight:650;line-height:1}
.tg-stat-lbl{font-size:10.5px;font-weight:500;color:var(--text-muted);margin-top:6px;text-transform:uppercase;letter-spacing:.05em}
.tg-con-body{max-height:400px;overflow-y:auto;font-family:var(--mono);font-size:11.5px;padding:8px;background:var(--bg);border-radius:6px}
.tg-con-body .log-row{padding:2px 6px}

/* ── Basic/Advanced toggle ─────────────────────────────────── */
.task-mode-toggle{display:flex;background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-left:auto}
.task-mode-btn{background:none;border:none;color:var(--text-muted);font-size:11px;font-weight:600;padding:4px 12px;cursor:pointer;transition:all .15s;letter-spacing:.02em}
.task-mode-btn:hover{color:var(--text)}
.task-mode-btn.active{background:var(--accent);color:#fff}
.bt-sidebar-hdr{display:flex;align-items:center;gap:8px}
.bt-sidebar-hdr span{flex-shrink:0}

/* ── Basic card view ──────────────────────────────────────────── */
.bt-main-scroll{flex:1;overflow-y:auto;padding:12px 16px 16px;display:flex;flex-direction:column;gap:12px}
.bt-main-hdr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bt-grp-name{font-size:15px;font-weight:700;color:var(--text)}
.bt-grp-file{font-size:11px;color:var(--text-muted);font-family:var(--mono,monospace)}
.bt-main-hdr .btn{margin-left:4px}
.bt-main-hdr .btn:first-of-type{margin-left:auto}

/* pick-tasks bar */
.bt-pick-bar{display:flex;align-items:center;gap:8px;padding:6px 0}
.bt-pick-label{font-size:12px;font-weight:600;color:var(--text)}
.bt-hint{font-size:10.5px;color:var(--text-muted);opacity:.7}
.bt-cb{width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0}

/* task cards */
.bt-cards{display:flex;flex-direction:column;gap:8px}
.bt-task-card{display:flex;align-items:stretch;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 10px 10px 0;gap:0;transition:border-color .15s,box-shadow .15s}
.bt-task-card:hover{border-color:var(--border-hi);box-shadow:var(--shadow)}
.bt-card-left{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 10px;flex-shrink:0;min-width:40px}
.bt-card-num{font-size:11px;font-weight:700;color:var(--text-muted);background:var(--surface);border-radius:4px;padding:1px 6px}
.bt-card-body{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.bt-card-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.bt-card-col{display:flex;flex-direction:column;gap:2px;min-width:0}
.bt-card-col:first-child{flex:1.2}
.bt-card-col:nth-child(2){flex:1}
.bt-card-col:nth-child(3){flex:1}
.bt-card-col:nth-child(4){flex:1}
.bt-card-sm-col{flex:0 0 70px !important;min-width:60px}
.bt-card-kw-col{flex:2 !important;min-width:150px}
.bt-card-lbl{font-size:9.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.bt-card-sel{font-size:12px;padding:5px 8px;border-radius:6px;cursor:pointer}
.bt-card-inp{font-size:12px;padding:5px 8px;border-radius:6px}
.bt-card-actions{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 8px;flex-shrink:0}
.bt-card-act{cursor:pointer;color:var(--text-muted);opacity:.5;transition:opacity .15s,color .15s}
.bt-card-act:hover{opacity:1}
.bt-card-del:hover{color:#e06060}

/* keyword bubbles */
.bt-kw-container{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 8px;background:var(--surface);border:1px solid var(--border-hi);border-radius:6px;min-height:32px;cursor:text;transition:border-color .12s}
.bt-kw-container:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-dim)}
.bt-card-kw{min-height:28px;padding:3px 6px}
.bt-kw-input{border:none;background:none;outline:none;color:var(--text);font-size:11.5px;flex:1;min-width:60px;padding:1px 0}
.bt-kw-input::placeholder{color:var(--text-muted);opacity:.5}
.bt-kw-bubbles{display:flex;flex-wrap:wrap;gap:3px;align-items:center}
.bt-kw-chip{display:inline-flex;align-items:center;gap:2px;padding:2px 7px;border-radius:10px;font-size:10.5px;font-weight:600;background:rgba(80,200,120,.18);color:#5fd68d;cursor:default}
.bt-kw-neg{background:rgba(220,70,70,.18);color:#e06060}
.bt-kw-x{cursor:pointer;opacity:.6;margin-left:1px;font-size:12px}
.bt-kw-x:hover{opacity:1}

/* builder section */
.bt-builder{margin-top:4px;border:1px dashed var(--border-hi);border-radius:10px;background:var(--surface)}
.bt-builder-hdr{font-size:13px}
.bt-builder-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.bt-builder-profs{display:flex;flex-direction:column;gap:4px}
.bt-prof-list-hdr{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
.bt-prof-list-hdr .bt-hint{font-size:10px;text-transform:none;letter-spacing:0}
.bt-prof-body{max-height:160px;overflow-y:auto;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:4px 0}
.bt-prof-row{display:flex;align-items:center;gap:8px;padding:3px 10px;cursor:pointer;font-size:12px;transition:background .1s}
.bt-prof-row:hover{background:var(--hover)}
.bt-prof-name{color:var(--text);user-select:none}
.bt-builder-gen{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border)}
.bt-gen-preview{font-size:13px;font-weight:600}

.co-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;overflow-y:auto;flex:1;align-content:start}
.co-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;
  transition:border-color .15s,box-shadow .15s,transform .15s;position:relative}
.co-card:hover{border-color:var(--border-hi);box-shadow:var(--shadow);transform:translateY(-1px)}
.co-card.fresh{border-color:var(--accent);animation:flashIn .8s ease}
@keyframes flashIn{0%{box-shadow:0 0 0 4px var(--accent-dim)}100%{box-shadow:none}}
.co-img-wrap{width:100%;height:150px;background:var(--raised);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.co-img-wrap img{width:100%;height:100%;object-fit:contain;padding:10px}
.co-img-placeholder{color:var(--text-muted);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.co-body{padding:12px 14px 13px;display:flex;flex-direction:column;gap:6px;flex:1}
.co-site{font-size:10.5px;font-weight:600;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase}
.co-product{font-size:13.5px;font-weight:600;color:var(--text);line-height:1.35}
.co-meta{display:flex;flex-wrap:wrap;gap:5px}
.co-pill{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11px;font-weight:550;
  background:var(--raised);border:1px solid var(--border);color:var(--text-dim)}
.co-pill.size{color:var(--text)}
.co-ts{font-size:11px;color:var(--text-muted);margin-top:auto;padding-top:6px}
.co-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:8px;color:var(--text-muted);padding:40px 0;grid-column:1/-1}
.co-empty-icon{font-size:34px;opacity:.35}
.co-empty-lbl{font-size:13px;font-weight:550;color:var(--text-dim)}
.tab-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;
  background:var(--accent);color:var(--accent-ink);font-size:10px;font-weight:700;margin-left:auto;opacity:0;transition:opacity .2s}
.tab-badge.show{opacity:1}

/* ── MODALS / FORMS ── */
.overlay{position:fixed;inset:0;background:rgba(5,7,9,.62);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:99}
.modal{background:var(--panel);border:1px solid var(--border-hi);border-radius:14px;padding:22px;width:480px;max-width:95vw;max-height:90vh;
  overflow-y:auto;box-shadow:var(--shadow)}
.modal-title{font-size:16px;font-weight:650;color:var(--text);margin-bottom:16px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
.form-row{display:flex;flex-direction:column;gap:6px}
label{font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--text-muted);text-transform:uppercase}
.finput{height:34px;background:var(--surface);border:1px solid var(--border-hi);border-radius:8px;color:var(--text);
  font-size:12.5px;padding:0 11px;outline:none;transition:border-color .12s,box-shadow .12s;width:100%}
select.finput{padding-right:6px}
.finput:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.info-dim{font-size:12px;color:var(--text-dim);line-height:1.55}
.toast{position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:10px;font-size:12.5px;font-weight:550;z-index:200;pointer-events:none;
  background:var(--panel);color:var(--text);border:1px solid var(--border-hi);box-shadow:var(--shadow);opacity:0;transform:translateY(6px);transition:all .2s}
.toast::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:9px;vertical-align:1px}
.toast.show{opacity:1;transform:none}

/* ── LOG TYPES ── */
.lm.success{color:var(--t-success);font-weight:600} .lm.checkout{color:var(--t-checkout)} .lm.cart{color:var(--t-cart)}
.lm.captcha{color:var(--t-captcha)} .lm.queue{color:var(--t-queue)} .lm.monitor{color:var(--t-monitor)}
.lm.init{color:var(--t-init)} .lm.fail{color:var(--t-fail)} .lm.stopped{color:var(--t-stopped)}
.lm.error{color:var(--t-error)}
.ltask{color:var(--text-dim);flex-shrink:0;width:82px;user-select:text}
.lsite{color:var(--text-muted);flex-shrink:0;width:124px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbar{width:7px;height:7px;border-radius:50%;flex-shrink:0;background:var(--border-hi)}
.ll.success{background:color-mix(in srgb,var(--t-success) 8%,transparent)}

/* ── STATE STRIP ── */
.st-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:0;flex-shrink:0;background:var(--panel);
  border:1px solid var(--border);border-radius:10px;overflow:hidden}
.st-tile{position:relative;padding:13px 16px;display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:7px;
  border-right:1px solid var(--border);cursor:pointer;transition:background .12s}
.st-tile:last-child{border-right:none}
.st-tile:hover{background:var(--hover)}
.st-tile.on{background:color-mix(in srgb,var(--c) 10%,transparent)}
.st-tile.on::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--c)}
.st-val{font-size:24px;font-weight:650;line-height:1;color:var(--c);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.st-lbl{font-size:10.5px;font-weight:600;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase}
.st-sub{font-size:10px;color:var(--text-muted)}
.st-meta{display:flex;gap:18px;font-size:12px;color:var(--text-muted);flex-wrap:wrap;padding:0 2px}
.st-meta b{color:var(--text);font-weight:600}
.filter-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:99px;font-size:10.5px;letter-spacing:.05em;
  border:1px solid var(--c);color:var(--c);cursor:pointer;text-transform:uppercase}

/* ── SCHEDULE ── */
.sch-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border);font-size:12.5px}
.sch-row:first-child{border-top:none;padding-top:0}
.sch-time{font-size:15px;font-weight:650;color:var(--text);width:56px;font-variant-numeric:tabular-nums}
.sch-action{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:.5px;flex-shrink:0}
.sch-action.start{background:var(--ok);color:#fff}
.sch-action.stop{background:var(--danger);color:#fff}
.sch-row.off .sch-time,.sch-row.off .sch-grp,.sch-row.off .sch-action{opacity:.4}
.sch-grp{flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}
.sch-next{font-size:11.5px;color:var(--warn);white-space:nowrap;font-weight:550}
.sch-form{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:14px;margin-top:10px;border-top:1px solid var(--border)}
.sch-form .finput{height:32px}
.day-pick{display:flex;gap:3px}
.day-pick span{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:10.5px;font-weight:650;
  cursor:pointer;border:1px solid var(--border);color:var(--text-muted)}
.day-pick span.on{background:var(--accent-dim);border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--accent)}

/* ── CHECKOUTS ── */
.co-status{position:absolute;top:10px;left:10px;height:20px;display:flex;align-items:center;padding:0 8px;border-radius:6px;font-size:10px;font-weight:700;
  letter-spacing:.07em;text-transform:uppercase;background:var(--panel);border:1px solid}
.co-status.success{color:var(--t-success);border-color:color-mix(in srgb,var(--t-success) 45%,transparent)}
.co-status.declined{color:var(--t-error);border-color:color-mix(in srgb,var(--t-error) 45%,transparent)}
.co-status.other{color:var(--text-dim);border-color:var(--border)}
.co-badge{position:absolute;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-weight:700;
  background:var(--panel);border:1px solid var(--border);z-index:2}
.co-badge.order-badge{top:10px;left:10px;color:var(--t-checkout);border-color:color-mix(in srgb,var(--t-checkout) 40%,transparent);font-family:"Cascadia Mono",Consolas,monospace}
.co-badge.setup-badge{top:10px;right:10px;color:var(--text-dim);border-color:var(--border)}
.co-badge svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.7}
/* ── UPDATE BAR ── */
.update-bar{position:fixed;bottom:0;left:0;right:0;height:38px;display:flex;align-items:center;justify-content:center;gap:10px;
  background:color-mix(in srgb,var(--accent) 14%,var(--bg));border-top:1px solid var(--accent);z-index:900;
  font-size:12.5px;color:var(--text);transform:translateY(100%);transition:transform .3s ease}
.update-bar.show{transform:translateY(0)}
.update-bar .update-msg{font-weight:500}
.update-bar button{font-size:11.5px;padding:4px 14px;border-radius:5px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;font-weight:600}
.update-bar button:hover{filter:brightness(1.1)}
.co-card{cursor:pointer}
.co-card.declined{opacity:.75}
.co-img-wrap{position:relative;background:#f4f4f2}
.co-img-wrap.noimg{background:var(--raised)}
.co-pill.order{color:var(--t-checkout);border-color:color-mix(in srgb,var(--t-checkout) 35%,transparent);font-family:"Cascadia Mono",Consolas,monospace}
.co-sub{font-size:11.5px;color:var(--text-dim);display:flex;gap:10px;flex-wrap:wrap}
.co-toolbar{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.co-toolbar>.finput{height:36px;padding-left:34px;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%238b929c' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 12px center}
.seg{display:flex;border:1px solid var(--border);border-radius:9px;overflow:hidden;background:var(--surface);padding:3px;gap:2px}
.seg span{height:26px;display:flex;align-items:center;padding:0 12px;font-size:12px;font-weight:550;color:var(--text-dim);cursor:pointer;border-radius:6px}
.seg span:hover{color:var(--text)}
.seg span.on{background:var(--raised);color:var(--text);box-shadow:inset 0 0 0 1px var(--border-hi)}
.wh-line{display:flex;align-items:center;gap:10px;font-size:12.5px;padding:6px 0;flex-wrap:wrap}
.wh-k{width:150px;color:var(--text-muted);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0}
.wh-v{font-family:"Cascadia Mono",Consolas,monospace;font-size:12px;color:var(--text);user-select:text;word-break:break-all}
.okc{color:var(--t-success)} .badc{color:var(--t-error)} .midc{color:var(--t-cart)}
.kv{display:grid;grid-template-columns:130px 1fr;gap:8px 14px;font-size:12.5px}
.kv .k{color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding-top:2px}
.kv .v{color:var(--text);user-select:text;word-break:break-word}

/* ── SETTINGS ── */
.set-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px;align-items:start}
.set-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--border)}
.set-row:first-child{border-top:none;padding-top:0}
.set-row:last-child{padding-bottom:0}
.set-k{flex:1;min-width:0}
.set-k b{display:block;font-size:13px;font-weight:600}
.set-k span{display:block;font-size:12px;color:var(--text-dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis}
.switch{width:38px;height:22px;border-radius:99px;background:var(--border-hi);position:relative;cursor:pointer;flex-shrink:0;transition:background .15s;border:none}
.switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.switch.on{background:var(--accent)}
.switch.on::after{transform:translateX(16px)}

/* ── PRIVACY BLUR (personal details hidden until focused / hovered) ── */
.privacy .sheet td.pv input:not(:focus){filter:blur(5px)}
.privacy .txt-editor.pv:not(:focus){filter:blur(4.5px)}
.privacy .co-sub,.privacy .kv .v.pv{filter:blur(5px);transition:filter .15s}
.privacy .co-card:hover .co-sub,.privacy .kv .v.pv:hover{filter:none}

::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-hi);border-radius:99px;border:3px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:var(--text-muted);background-clip:content-box;border:3px solid transparent}
::-webkit-scrollbar-corner{background:transparent}
`;
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

// ── APPEARANCE (theme + privacy are per-machine view preferences) ─────────────
const pref = {
  get(k, d) { try { const v = localStorage.getItem("mb-" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("mb-" + k, JSON.stringify(v)); } catch {} },
};
function applyTheme(t) { document.documentElement.dataset.theme = t; pref.set("theme", t); }
function applyPrivacy(on) { document.body.classList.toggle("privacy", !!on); pref.set("privacy", !!on); }
applyTheme(pref.get("theme", "dark"));
applyPrivacy(pref.get("privacy", true));

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t=document.createElement("div"); t.id="toast"; t.className="toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ── STATE ─────────────────────────────────────────────────────────────────────
const S = {
  tab: "dashboard",
  engineRunning: false,
  log: [],
  checkouts: [],    // parsed checkout entries from engine stdout
  taskFiles:  {},
  proxies:    {},
  accounts:   {},
  profiles:   {},
  precookies: {},
  activeGroups: {},
  webhookUrl: "",
  engineExePath: "",
  stats: {},            // live task-state counts from main process
  logFilter: null,      // null | state key → console shows only that state
  webhook: null,        // relay / bot / routing status
  schedules: [],
  coFilter: { q:"", status:"success", range:"all" },
  coUnseen: 0,
};

const uid    = () => Math.random().toString(36).slice(2,8);
const nowStr = () => new Date().toLocaleTimeString("en-US",{hour12:false});
const esc    = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const mk     = (tag,cls,html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!==undefined)e.innerHTML=html; return e; };
const mkBtn  = (label,cls,cb) => { const b=mk("button",`btn ${cls||""}`); b.textContent=label; if(cb)b.onclick=cb; return b; };
const $      = (sel,root=document) => root.querySelector(sel);
const $$     = (sel,root=document) => [...root.querySelectorAll(sel)];

// ── COLUMNS ───────────────────────────────────────────────────────────────────
const TASK_COLS = [
  {k:"profileGroup", l:"Profile Group",  w:130},
  {k:"profileName",  l:"Profile Name",   w:120},
  {k:"proxyGroup",   l:"Proxy Group",    w:120},
  {k:"accountGroup", l:"Account Group",  w:120},
  {k:"input",        l:"Input",          w:150},
  {k:"size",         l:"Size",           w:80},
  {k:"color",        l:"Color",          w:80},
  {k:"site",         l:"Site",           w:160},
  {k:"mode",         l:"Mode",           w:80},
  {k:"cartQuantity", l:"Qty",            w:60},
  {k:"delay",        l:"Delay",          w:80},
];

const PROFILE_COLS = [
  {k:"profileName",  l:"Profile Name",   w:110},
  {k:"firstName",    l:"First Name",     w:100},
  {k:"lastName",     l:"Last Name",      w:100},
  {k:"email",        l:"Email",          w:160},
  {k:"address1",     l:"Address 1",      w:150},
  {k:"address2",     l:"Address 2",      w:110},
  {k:"city",         l:"City",           w:100},
  {k:"state",        l:"State",          w:65},
  {k:"zipcode",      l:"Zip",            w:70},
  {k:"country",      l:"Country",        w:70},
  {k:"phoneNumber",  l:"Phone",          w:120},
  {k:"ccNumber",     l:"CC Number",      w:155},
  {k:"ccMonth",      l:"Month",          w:60},
  {k:"ccYear",       l:"Year",           w:60},
  {k:"cvv",          l:"CVV",            w:55},
];

const MODES = ["preload","wait","safe"];
// columns blurred while "Hide personal details" is on
const PRIVATE_KEYS = new Set(["firstName","lastName","email","address1","address2","phoneNumber","ccNumber","ccMonth","ccYear","cvv","zipcode"]);
const SITES = ["jp.supreme.com","supremenewyork.com","kith.com","bodega.com","concepts.com","hanon-shop.com"];

// ── ROOT / SHELL ──────────────────────────────────────────────────────────────
const root = document.getElementById("root");
root.className = "app";

const ICON = {
  dashboard: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>',
  checkouts: '<path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  engine:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/>',
  tasks:     '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  profiles:  '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  proxies:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  accounts:  '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  precookie: '<path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-5-5Z"/><circle cx="9" cy="13" r="1"/><circle cx="14" cy="16" r="1"/><circle cx="8" cy="9" r="1"/>',
  taskgroups:'<path d="M4 7h3M4 12h3M4 17h3"/><rect x="10" y="5" width="10" height="4" rx="1"/><rect x="10" y="10" width="10" height="4" rx="1"/><rect x="10" y="15" width="10" height="4" rx="1"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  eye:       '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:    '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sun:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24">${ICON[name]}</svg>`;

const NAV = [
  { sec: "Run",       items: [["dashboard","Dashboard"],["checkouts","Checkouts"],["taskgroups","Task Groups"],["engine","Engine"]] },
  { sec: "Configure", items: [["tasks","Tasks"],["profiles","Profiles"],["proxies","Proxies"],["accounts","Accounts"],["precookie","Pre-cookie"]] },
];
const TABS = ["dashboard","checkouts","taskgroups","engine","tasks","profiles","proxies","accounts","precookie","settings"];
const TITLES = { dashboard:"Dashboard", checkouts:"Checkouts", taskgroups:"Task Groups", engine:"Engine", tasks:"Tasks", profiles:"Profiles",
                 proxies:"Proxies", accounts:"Accounts", precookie:"Pre-cookie", settings:"Settings" };

// sidebar
const side = mk("aside","side");
side.innerHTML = `
  <div class="brand">
    <svg viewBox="0 0 32 32"><path d="M16 3 29 27H3Z" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M16 12 22.5 24h-13Z" fill="var(--accent)" opacity=".35"/></svg>
    <div><div class="brand-name">MakeBot+</div><div class="brand-sub">Console</div></div>
  </div>`;
const nav = mk("nav","nav");
const navItem = (t, label) => {
  const d = mk("div","nav-item", `${svg(t)}<span>${label}</span>`);
  d.dataset.tab = t;
  if (t === "checkouts") { const badge = mk("span","tab-badge"); badge.id = "dash-badge"; badge.textContent = "0"; d.appendChild(badge); }
  d.onclick = () => switchTab(t);
  return d;
};
NAV.forEach(({ sec, items }) => {
  nav.appendChild(mk("div","nav-sec", sec));
  items.forEach(([t, l]) => nav.appendChild(navItem(t, l)));
});
// drag-to-reorder nav items within each section
(function initNavDrag() {
  const THRESHOLD = 5; // px of movement before drag kicks in
  const isItem = el => el?.classList?.contains("nav-item") && el.dataset.tab !== "settings";
  const sectionOf = el => { let s = el.previousElementSibling; while (s && !s.classList.contains("nav-sec")) s = s.previousElementSibling; return s; };

  nav.addEventListener("mousedown", e => {
    const item = e.target.closest(".nav-item");
    if (!isItem(item)) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false, dragged = null, placeholder = null, offY = 0;

    const beginDrag = () => {
      dragging = true;
      const rect = item.getBoundingClientRect();
      dragged = item;
      dragged._sec = sectionOf(dragged);
      placeholder = mk("div","nav-drop-ph");
      placeholder.style.height = rect.height + "px";
      dragged.classList.add("nav-dragging");
      dragged.style.width = rect.width + "px";
      dragged.style.position = "fixed";
      dragged.style.zIndex = "999";
      dragged.style.pointerEvents = "none";
      dragged.style.left = rect.left + "px";
      dragged.style.top = rect.top + "px";
      dragged.parentNode.insertBefore(placeholder, dragged);
      offY = startY - rect.top;
    };

    const move = ev => {
      if (!dragging) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.sqrt(dx*dx + dy*dy) < THRESHOLD) return;
        beginDrag();
      }
      dragged.style.top = (ev.clientY - offY) + "px";
      const over = [...nav.querySelectorAll(".nav-item:not(.nav-dragging), .nav-drop-ph")].find(el => {
        const r = el.getBoundingClientRect();
        return ev.clientY > r.top && ev.clientY < r.bottom && sectionOf(el) === dragged._sec;
      });
      if (over && over !== placeholder) {
        const r = over.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) over.parentNode.insertBefore(placeholder, over);
        else over.parentNode.insertBefore(placeholder, over.nextSibling);
      }
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      if (dragging) {
        dragged.classList.remove("nav-dragging");
        dragged.style.cssText = "";
        placeholder.parentNode.insertBefore(dragged, placeholder);
        placeholder.remove();
        dragged = placeholder = null;
      } else {
        // no drag happened — switch tab directly (item.click() doesn't reliably fire onclick)
        switchTab(item.dataset.tab);
      }
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
})();
side.appendChild(nav);
const foot = mk("div","side-foot");
foot.appendChild(navItem("settings","Settings"));
const engCard = mk("div","eng-card");
engCard.innerHTML = `
  <div class="eng-card-top"><span class="dot" id="side-dot"></span><span id="side-lbl">Engine stopped</span></div>
  <div class="eng-card-row"><span>Engine</span><span id="side-exe">—</span></div>
  <div class="eng-card-row"><span>Active tasks</span><span id="side-active">0</span></div>`;
foot.appendChild(engCard);
side.appendChild(foot);
root.appendChild(side);

// main column: top bar + panes
const mainCol = mk("div","main");
const tb = mk("header","topbar");
tb.innerHTML = `
  <div style="min-width:0"><div class="pg-title" id="pg-title">Dashboard</div><div class="pg-sub" id="pg-sub"></div></div>
  <div class="tb-right">
    <span class="pill" title="Engine status"><span class="dot" id="eng-dot"></span><span id="eng-lbl">Engine stopped</span></span>
    <button class="btn pr no-drag" id="tb-engine">Launch engine</button>
    <span class="clock" id="tb-clock"></span>
    <button class="icon-btn" id="tb-privacy" title="Hide personal details"></button>
    <button class="icon-btn" id="tb-theme" title="Switch light / dark"></button>
    <span class="vsep"></span>
    <div class="wc-group">
      <button class="wc" id="wc-min" title="Minimize">─</button>
      <button class="wc" id="wc-max" title="Maximize">□</button>
      <button class="wc cl" id="wc-close" title="Close">✕</button>
    </div>
  </div>`;
mainCol.appendChild(tb);
$("#wc-min", tb).onclick   = () => api.window.minimize();
$("#wc-max", tb).onclick   = () => api.window.maximize();
$("#wc-close", tb).onclick = () => api.window.close();

function paintToggles() {
  const pv = document.body.classList.contains("privacy");
  const pb = $("#tb-privacy", tb); pb.innerHTML = svg(pv ? "eyeOff" : "eye"); pb.classList.toggle("on", pv);
  pb.title = pv ? "Personal details hidden — click to show" : "Hide personal details";
  const dark = document.documentElement.dataset.theme !== "light";
  $("#tb-theme", tb).innerHTML = svg(dark ? "sun" : "moon");
}
$("#tb-privacy", tb).onclick = () => { applyPrivacy(!document.body.classList.contains("privacy")); paintToggles(); if (S.tab === "settings") renderTab("settings"); };
$("#tb-theme", tb).onclick   = () => { applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"); paintToggles(); if (S.tab === "settings") renderTab("settings"); };
paintToggles();

// top-bar engine button: same start / stop the Engine page uses
$("#tb-engine", tb).onclick = async () => {
  if (S.engineRunning) {
    await api.engine.stop(); S.engineRunning = false; updateStatus();
    pushLog("Engine stopped","warn");
    if (S.tab === "engine") renderTab("engine");
  } else {
    const exePath = await api.engine.getExePath();
    pushLog(`Launching: ${exePath}`,"dim");
    const r = await api.engine.start();
    if (!r.ok) { pushLog(`Error: ${r.err}`,"error"); toast(r.err.split("\n")[0]); }
    else setRunning((await api.engine.status()).running);
  }
};

const clockEl = $("#tb-clock", tb);
const tickClock = () => { clockEl.textContent = new Date().toLocaleTimeString("en-US",{ hour:"numeric", minute:"2-digit" }); };
tickClock(); setInterval(tickClock, 15_000);

const content = mk("div","content");
mainCol.appendChild(content);
root.appendChild(mainCol);
const panes = {};
TABS.forEach(t => {
  const p = mk("div",`pane${t===S.tab?" active":""}`);
  p.id = `pane-${t}`; panes[t] = p; content.appendChild(p);
});

// header subtitle per page, from what's already loaded
const count = (obj, fn) => Object.values(obj || {}).reduce((a, v) => a + fn(v || ""), 0);
const lines = v => v.split("\n").filter(x => x.trim()).length;
const csvRows = v => Math.max(0, lines(v) - (/^profileGroup|^profileName/i.test(v.trim()) ? 1 : 0));
function subtitleFor(t) {
  const n = o => Object.keys(o || {}).length, pl = (k, w) => `${k.toLocaleString()} ${w}${k === 1 ? "" : "s"}`;
  switch (t) {
    case "dashboard": {
      const last = S.checkouts.find(c => c.status === "success");
      return last ? `Last checkout ${new Date(last.ts).toLocaleString("en-US",{ month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}` : "No checkouts recorded yet";
    }
    case "checkouts": return `${pl(S.checkouts.filter(c => c.status === "success").length, "checkout")} saved · captured from the engine's Discord webhook`;
    case "engine":    return S.engineRunning ? `Running · ${pl(S.stats.active || 0, "active task")}` : "The engine is not running";
    case "taskgroups": { const ng = n(S.taskFiles); return `${pl(ng, "group")} · ${S.engineRunning ? pl(S.stats.active || 0, "active task") : "Engine idle"}`; }
    case "tasks":     return `${pl(n(S.taskFiles), "group")} · ${pl(count(S.taskFiles, csvRows), "task")}`;
    case "profiles":  return `${pl(n(S.profiles), "group")} · ${pl(count(S.profiles, csvRows), "profile")}`;
    case "proxies":   return `${pl(n(S.proxies), "list")} · ${pl(count(S.proxies, lines), "proxy")}`.replace("proxys", "proxies");
    case "accounts":  return `${pl(n(S.accounts), "list")} · ${pl(count(S.accounts, lines), "account")}`;
    case "precookie": return `${pl(n(S.precookies), "list")} · ${pl(count(S.precookies, lines), "account")}`;
    case "settings":  return "Engine, webhook, notifications and appearance";
  }
  return "";
}
function setHeader(t) {
  $("#pg-title").textContent = TITLES[t] || t;
  $("#pg-sub").textContent = subtitleFor(t);
}

function switchTab(t) {
  S.tab = t;
  $$(".nav-item").forEach(d => d.classList.toggle("active", d.dataset.tab===t));
  if (t==="checkouts") { S.coUnseen = 0; updateDashBadge(); }
  $$(".pane").forEach(p => p.classList.remove("active"));
  panes[t].classList.add("active");
  renderTab(t);
}

// ── STATUS ────────────────────────────────────────────────────────────────────
function updateStatus() {
  const on = S.engineRunning;
  const lbl = on ? "Engine running" : "Engine stopped";
  for (const [d, l] of [["#eng-dot","#eng-lbl"],["#side-dot","#side-lbl"]]) {
    const dot = $(d), t = $(l);
    if (dot) dot.className = "dot" + (on ? " on" : "");
    if (t) t.textContent = lbl;
  }
  const b = $("#tb-engine");
  if (b) { b.textContent = on ? "Stop engine" : "Launch engine"; b.className = `btn ${on ? "dg" : "pr"} no-drag`; }
  const exe = $("#side-exe");
  if (exe) { const p = S.engineExePath || ""; exe.textContent = p ? p.split(/[\\/]/).pop() : "not set"; exe.title = p; }
  const act = $("#side-active");
  if (act) act.textContent = (S.stats.active || 0).toLocaleString();
  if (S.tab === "engine") setHeader("engine");
}

// ── LOG ───────────────────────────────────────────────────────────────────────
// Engine entries: { ts, msg, type, task, site, level, comp }
// Rendering is batched per animation frame — with thousands of tasks the engine
// can print hundreds of lines a second.
const LOG_CAP = 5000, DOM_CAP = 1500;
let logQueue = [], logRaf = 0;

function pushLog(msg, type="info") {
  addLogEntry({ ts:nowStr(), msg, type });
}

function addLogEntry(entry) {
  S.log.push(entry);
  if (S.log.length > LOG_CAP) S.log.splice(0, S.log.length - LOG_CAP);
  if (S.tab !== "engine" || !passesFilter(entry)) return;
  logQueue.push(entry);
  if (!logRaf) logRaf = requestAnimationFrame(flushLog);
}

function passesFilter(e) {
  const f = S.logFilter;
  if (!f) return true;
  if (f === "checkout") return e.type === "checkout" || e.type === "captcha";
  return e.type === f;
}

function flushLog() {
  logRaf = 0;
  const body = $("#con-body");
  if (!body) { logQueue = []; return; }
  const stick = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  const frag = document.createDocumentFragment();
  logQueue.slice(-DOM_CAP).forEach(e => frag.appendChild(logRow(e)));
  logQueue = [];
  body.appendChild(frag);
  while (body.childElementCount > DOM_CAP) body.firstElementChild.remove();
  if (stick) body.scrollTop = body.scrollHeight;
}

function logRow(e) {
  const row = mk("div", `ll ${e.type==="success" ? "success" : ""}`);
  const bar = mk("span","lbar"); if (T[e.type]) bar.style.background = T[e.type];
  row.appendChild(bar);
  row.appendChild(mk("span","lt", esc(e.ts || "")));
  if (e.task || e.comp) {
    row.appendChild(mk("span","ltask", esc(e.task || e.comp)));
    row.appendChild(mk("span","lsite", esc(e.site || "")));
  }
  row.appendChild(mk("span",`lm ${e.type||"info"}`, esc(e.msg)));
  return row;
}

// legacy name used by the stdin bar
function appendLine(entry) { logQueue.push(entry); if (!logRaf) logRaf = requestAnimationFrame(flushLog); }

// ── LIVE TASK STATS ───────────────────────────────────────────────────────────
function tileCount(t) {
  const c = S.stats || {};
  return (c[t.k] || 0) + (t.plus || []).reduce((a,k)=>a+(c[k]||0), 0);
}

function buildStateTiles({ clickable=true } = {}) {
  const row = mk("div","st-row");
  STATE_TILES.forEach(t => {
    const d = mk("div", `st-tile${S.logFilter===t.k?" on":""}`);
    d.style.setProperty("--c", T[t.k]);
    d.dataset.st = t.k;
    d.innerHTML = `<div class="st-val">${tileCount(t)}</div><div class="st-lbl">${t.l}</div>`;
    if (t.k === "checkout") d.title = "Includes tasks solving checkout captcha";
    if (t.k === "fail")     d.title = "Tasks whose latest step failed (they usually retry)";
    if (t.k === "success")  d.title = "Unique tasks that reached success this run";
    if (clickable) d.onclick = () => setLogFilter(S.logFilter===t.k ? null : t.k);
    row.appendChild(d);
  });
  return row;
}

function statMetaHtml() {
  const c = S.stats || {};
  return `<span>Loaded <b>${(c.totalLoaded||0).toLocaleString()}</b></span>
          <span>Active <b>${(c.active||0).toLocaleString()}</b></span>
          <span>Init <b>${c.init||0}</b></span>
          <span>Captcha <b>${c.captcha||0}</b></span>
          <span>Fail events <b>${(c.failEvents||0).toLocaleString()}</b></span>`;
}

function updateStatTiles() {
  $$("[data-st]").forEach(d => {
    const t = STATE_TILES.find(x => x.k === d.dataset.st);
    const v = $(".st-val", d); if (t && v) v.textContent = tileCount(t);
  });
  $$(".st-meta").forEach(m => m.innerHTML = statMetaHtml());
}

function setLogFilter(f) {
  S.logFilter = f;
  if (S.tab === "engine") renderTab("engine");
}

// ── CHECKOUTS (from Discord webhook) ──────────────────────────────────────────
function startOfToday() { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }

function coMatches(co) {
  const f = S.coFilter;
  // ORDER/SETUP "other" records are merged into success cards — hide them
  if (co.status === "other") return false;
  if (f.status !== "all" && co.status !== f.status) return false;
  if (f.range === "today" && co.ts < startOfToday()) return false;
  if (f.range === "7d"    && co.ts < Date.now() - 7*864e5) return false;
  if (f.q) {
    const hay = [co.product,co.site,co.size,co.order,co.profile,co.account,co.headline].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false;
  }
  return true;
}

function updateDashBadge() {
  const badge = $("#dash-badge");
  if (!badge) return;
  const n = S.coUnseen;
  badge.textContent = n > 99 ? "99+" : n;
  badge.classList.toggle("show", n > 0);
}

// product image fallback: scrape og:image from the product page when the embed has none
const imgTried = new Set();
function ensureImage(co, onImage) {
  if (co.image || !co.productUrl || imgTried.has(co.id)) return;
  imgTried.add(co.id);
  api.fetch.ogImage(co.productUrl).then(url => {
    if (!url) return;
    if (url.startsWith("//")) url = "https:" + url;
    co.image = url;
    api.checkouts.setImage(co.id, url);
    onImage?.(url);
  });
}

api.checkouts.onNew(co => {
  co._fresh = true;
  S.checkouts.unshift(co);
  if (S.tab !== "checkouts") { S.coUnseen++; updateDashBadge(); }
  if (S.tab === "checkouts" && coMatches(co)) {
    const grid = $("#co-grid"), empty = $("#co-empty");
    if (empty) empty.remove();
    if (grid) grid.insertBefore(buildCoCard(co), grid.firstChild);
    refreshCoStats();
  }
  if (S.tab === "dashboard") renderTab("dashboard");
  if (co.status === "success") toast(`Checkout: ${co.product || co.site || "success"}`);
});
api.checkouts.onUpdated(co => {
  const i = S.checkouts.findIndex(c => c.id === co.id);
  if (i >= 0) S.checkouts[i] = { ...S.checkouts[i], ...co };
});

api.webhook.onStatus(st => {
  S.webhook = st;
  const panel = $("#wh-panel");
  if (panel) fillWebhookPanel(panel);
});

api.schedule.onChanged(list => {
  S.schedules = list;
  $$(".sch-list").forEach(fillScheduleList);
});

// ── ENGINE EVENTS ─────────────────────────────────────────────────────────────
api.engine.onLog(entry => addLogEntry(entry));
api.engine.onStats(c => { S.stats = c; updateStatTiles(); updateStatus(); });
api.engine.onMenu(async () => {
  S.webhook = await api.webhook.status();
  const panel = $("#wh-panel"); if (panel) fillWebhookPanel(panel);
});
// The process being alive is what "running" means — don't wait for startup text
function setRunning(on) {
  if (S.engineRunning === on) return;
  S.engineRunning = on; updateStatus();
  if (S.tab==="engine" || S.tab==="checkouts") renderTab(S.tab);
}
api.engine.onStarted(() => { setRunning(true); pushLog("Engine process started","dim"); });
// safety net: resync with the main process every 3s (covers missed events / reloads)
setInterval(async () => {
  try { const st = await api.engine.status(); setRunning(!!st.running); } catch {}
}, 3000);
api.engine.onReady(() => {
  S.engineRunning = true; updateStatus();
  pushLog("Engine ready","ok");
  if (S.tab==="engine") renderTab("engine");
});
api.engine.onStopped(() => {
  S.engineRunning = false; updateStatus();
  pushLog("Engine stopped","warn");
  if (S.tab==="engine") renderTab("engine");
});

// ── COPY LOGS ─────────────────────────────────────────────────────────────────
async function copyLogs() {
  const text = S.log.filter(passesFilter).map(l=>`[${l.ts}]${l.task?` [${l.task}]`:""}${l.site?` [${l.site}]`:""} ${l.msg}`).join("\n");
  await api.clipboard.write(text);
  toast("Logs copied to clipboard");
}

// ── SPREADSHEET COMPONENT ─────────────────────────────────────────────────────
// Full Excel-like editor: multi-select cells/rows/cols, copy/paste, context menu,
// keyboard shortcuts, column insert/delete, drag-fill handle placeholder.
function renderSheet(container, cols, rows, onChange) {
  container.innerHTML = "";

  // ── selection state ────────────────────────────────────────────────────────
  // sel: { anchor:{r,c}, focus:{r,c} } — r=row index, c=col index (-1 = whole row)
  let sel       = null;   // current selection range
  let colSel    = null;   // selected column index (whole col), null if none
  let isEditing = false;  // true when a cell input is focused/typing

  // ── clipboard state (internal) ─────────────────────────────────────────────
  // iClip: { type:"cells"|"rows"|"col", data, colIdx? }
  let iClip = null;

  // ── helpers ────────────────────────────────────────────────────────────────
  const numCols = cols.length;
  const selMin  = () => sel ? { r: Math.min(sel.anchor.r, sel.focus.r), c: Math.min(sel.anchor.c, sel.focus.c) } : null;
  const selMax  = () => sel ? { r: Math.max(sel.anchor.r, sel.focus.r), c: Math.max(sel.anchor.c, sel.focus.c) } : null;
  const inSel   = (r, c) => {
    if (!sel) return false;
    const mn = selMin(), mx = selMax();
    return r >= mn.r && r <= mx.r && c >= mn.c && c <= mx.c;
  };
  const inColSel = (c) => colSel !== null && c === colSel;

  function allInputs() { return $$("input[data-r]", tbody); }
  function inputAt(r, c) { return $(`input[data-r="${r}"][data-c="${c}"]`, tbody); }

  function focusCell(r, c, select=false) {
    const inp = inputAt(r, c);
    if (!inp) return;
    inp.focus();
    if (select) inp.select();
  }

  // ── build DOM ──────────────────────────────────────────────────────────────
  const wrap  = mk("div","sheet-wrap");
  const table = mk("table","sheet");
  const thead = mk("thead");
  const hrow  = mk("tr");

  // row-number corner
  const thCorner = mk("th","row-num sh-corner");
  thCorner.title = "Click to select all";
  thCorner.onclick = () => {
    colSel = null;
    sel = { anchor:{r:0,c:0}, focus:{r:rows.length-1,c:numCols-1} };
    repaintSel();
  };
  hrow.appendChild(thCorner);

  // column headers
  cols.forEach((c, ci) => {
    const th = mk("th","sh-col-hdr");
    th.textContent = c.l;
    th.style.width = th.style.minWidth = (c.w||100)+"px";
    th.title = "Click to select column · Right-click for column options";
    th.onclick = e => {
      e.stopPropagation();
      colSel = ci;
      sel    = { anchor:{r:0,c:ci}, focus:{r:rows.length-1,c:ci} };
      repaintSel();
    };
    th.oncontextmenu = e => { e.preventDefault(); showColMenu(e, ci); };
    hrow.appendChild(th);
  });

  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = mk("tbody");

  // ── repaint selection highlight ────────────────────────────────────────────
  function repaintSel() {
    // clear all
    $$(".sh-sel", table).forEach(e => e.classList.remove("sh-sel"));
    $$(".sh-sel-col", table).forEach(e => e.classList.remove("sh-sel-col"));
    $$("tr", tbody).forEach((tr, ri) => {
      tr.classList.remove("sh-row-sel");
      $$("td:not(.row-num)", tr).forEach((td, ci) => {
        if (inSel(ri, ci)) td.classList.add("sh-sel");
        if (inColSel(ci))  td.classList.add("sh-sel-col");
      });
    });
    // column header highlight
    $$(".sh-col-hdr", thead).forEach((th, ci) => {
      th.classList.toggle("sh-col-active", colSel===ci);
    });
  }

  // ── render all rows ────────────────────────────────────────────────────────
  function renderRows() {
    tbody.innerHTML = "";
    rows.forEach((row, ri) => {
      const tr = mk("tr");

      // row number — click to select row, right-click for row menu
      const tdNum = mk("td","row-num");
      tdNum.textContent = ri+1;
      tdNum.title = "Click to select row · Right-click for row options";
      tdNum.onclick = e => {
        e.stopPropagation();
        colSel = null;
        if (e.shiftKey && sel) {
          sel.focus = {r:ri, c:numCols-1};
          sel.anchor.c = 0;
        } else {
          sel = { anchor:{r:ri,c:0}, focus:{r:ri,c:numCols-1} };
        }
        repaintSel();
      };
      tdNum.oncontextmenu = e => { e.preventDefault(); showRowMenu(e, ri); };
      tr.appendChild(tdNum);

      cols.forEach((c, ci) => {
        const td  = mk("td", PRIVATE_KEYS.has(c.k) ? "pv" : "");
        td.style.width = td.style.minWidth = (c.w||100)+"px";

        const inp = mk("input");
        inp.value = row[c.k] ?? "";
        inp.setAttribute("data-r", ri);
        inp.setAttribute("data-c", ci);
        inp.setAttribute("data-k", c.k);

        // ── cell input handlers ────────────────────────────────────────────
        inp.onfocus = () => {
          isEditing = true;
          if (!e_shiftHeld && !e_ctrlHeld) {
            colSel = null;
            sel = { anchor:{r:ri,c:ci}, focus:{r:ri,c:ci} };
            repaintSel();
          }
        };
        inp.onblur  = () => { isEditing = false; };
        inp.oninput = () => { rows[ri][c.k] = inp.value; onChange(rows); };

        inp.onmousedown = e => {
          if (e.button !== 0) return;
          if (e.shiftKey && sel) {
            sel.focus = {r:ri, c:ci};
            repaintSel(); e.preventDefault();
          } else if (e.ctrlKey || e.metaKey) {
            // extend selection — simplistic: update focus
            if (!sel) sel = { anchor:{r:ri,c:ci}, focus:{r:ri,c:ci} };
            else       sel.focus = {r:ri, c:ci};
            repaintSel(); e.preventDefault();
          }
        };

        inp.oncontextmenu = e => { e.preventDefault(); showCellMenu(e, ri, ci); };

        inp.onkeydown = e => {
          const allInp = allInputs();
          const idx    = allInp.indexOf(inp);

          // ── navigation ─────────────────────────────────────────────────
          if (e.key==="Tab") {
            e.preventDefault();
            const next = allInp[e.shiftKey ? idx-1 : idx+1];
            if (next) { next.focus(); next.select(); }
            return;
          }
          if (e.key==="Enter") {
            e.preventDefault();
            if (e.shiftKey) {
              const up = inputAt(ri-1, ci);
              if (up) { up.focus(); up.select(); }
            } else {
              const dn = inputAt(ri+1, ci);
              if (dn) { dn.focus(); dn.select(); }
              else { addBlankRow(); setTimeout(()=>{ const n=inputAt(rows.length-1,ci); if(n){n.focus();n.select();} },20); }
            }
            return;
          }
          if (e.key==="ArrowRight" && !e.altKey) {
            if (inp.selectionStart===inp.value.length || e.ctrlKey) {
              e.preventDefault();
              const next = inputAt(ri, ci+1);
              if (next) { next.focus(); next.select(); }
            }
            return;
          }
          if (e.key==="ArrowLeft" && !e.altKey) {
            if (inp.selectionStart===0 || e.ctrlKey) {
              e.preventDefault();
              const prev = inputAt(ri, ci-1);
              if (prev) { prev.focus(); prev.select(); }
            }
            return;
          }
          if (e.key==="ArrowDown") {
            e.preventDefault();
            const dn = inputAt(ri+1, ci);
            if (dn) { dn.focus(); dn.select(); }
            return;
          }
          if (e.key==="ArrowUp") {
            e.preventDefault();
            const up = inputAt(ri-1, ci);
            if (up) { up.focus(); up.select(); }
            return;
          }

          // ── shortcuts ──────────────────────────────────────────────────
          if ((e.ctrlKey||e.metaKey) && e.key==="c") { e.preventDefault(); copySelection(); return; }
          if ((e.ctrlKey||e.metaKey) && e.key==="x") { e.preventDefault(); cutSelection();  return; }
          if ((e.ctrlKey||e.metaKey) && e.key==="v") { e.preventDefault(); pasteAt(ri, ci); return; }
          if ((e.ctrlKey||e.metaKey) && e.key==="d") { e.preventDefault(); fillDown();      return; }  // fill down
          if ((e.ctrlKey||e.metaKey) && e.key==="r") { e.preventDefault(); fillRight();     return; }  // fill right
          if ((e.ctrlKey||e.metaKey) && e.key==="a") { e.preventDefault(); selectAll();     return; }
          if (e.key==="Delete" && (e.ctrlKey||e.metaKey)) { e.preventDefault(); deleteSelectedRows(); return; }
          if (e.key==="Escape") { inp.blur(); sel=null; repaintSel(); return; }

          // shift+space = select row
          if (e.key===" " && e.shiftKey) {
            e.preventDefault();
            sel = { anchor:{r:ri,c:0}, focus:{r:ri,c:numCols-1} };
            repaintSel(); return;
          }
          // ctrl+space = select col
          if (e.key===" " && (e.ctrlKey||e.metaKey)) {
            e.preventDefault();
            colSel = ci;
            sel = { anchor:{r:0,c:ci}, focus:{r:rows.length-1,c:ci} };
            repaintSel(); return;
          }
        };

        td.appendChild(inp);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    repaintSel();
  }

  // track modifier keys globally for mouse selection
  let e_shiftHeld = false, e_ctrlHeld = false;
  const keyTracker = e => { e_shiftHeld=e.shiftKey; e_ctrlHeld=e.ctrlKey||e.metaKey; };
  document.addEventListener("keydown", keyTracker, true);
  document.addEventListener("keyup",   keyTracker, true);

  // ── selection helpers ──────────────────────────────────────────────────────
  function selectAll() {
    colSel=null;
    sel={anchor:{r:0,c:0},focus:{r:rows.length-1,c:numCols-1}};
    repaintSel();
  }

  function getSelRows() {
    if (!sel) return [];
    const mn=selMin(), mx=selMax();
    return rows.slice(mn.r, mx.r+1);
  }

  function getSelCells() {
    if (!sel) return [];
    const mn=selMin(), mx=selMax();
    const out=[];
    for (let r=mn.r; r<=mx.r; r++) {
      const rowData=[];
      for (let c=mn.c; c<=mx.c; c++) rowData.push(rows[r]?.[cols[c].k]??"");
      out.push(rowData);
    }
    return out;
  }

  // ── copy / cut ─────────────────────────────────────────────────────────────
  function copySelection() {
    if (!sel) return;
    const cells = getSelCells();
    const tsv   = cells.map(r=>r.join("\t")).join("\n");
    iClip = { type:"cells", data: cells, sel: JSON.parse(JSON.stringify(sel)) };
    // also write to system clipboard as TSV so it pastes into Excel
    api.clipboard.write(tsv);
    flashSel("copy");
    toast(`Copied ${cells.length} row${cells.length!==1?"s":""}`);
  }

  function cutSelection() {
    if (!sel) return;
    copySelection();
    // clear selected cells
    const mn=selMin(), mx=selMax();
    for (let r=mn.r; r<=mx.r; r++)
      for (let c=mn.c; c<=mx.c; c++)
        if (rows[r]) rows[r][cols[c].k]="";
    onChange(rows); renderRows();
    toast("Cut");
  }

  // ── paste ──────────────────────────────────────────────────────────────────
  async function pasteAt(startR, startC) {
    // prefer internal clipboard (preserves structure), fall back to system TSV
    let grid = null;
    if (iClip?.type==="cells") {
      grid = iClip.data;
    } else {
      // read system clipboard — may be TSV from Excel/Sheets
      try {
        // Electron doesn't expose clipboard read in renderer — use a workaround:
        // create a temp textarea and let the browser paste event fill it
        grid = await readSystemClipboard();
      } catch { return; }
    }
    if (!grid || !grid.length) return;

    // grow rows if needed
    while (startR + grid.length > rows.length) {
      const blank={}; cols.forEach(c=>{blank[c.k]="";}); rows.push(blank);
    }
    grid.forEach((rowData, ri) => {
      rowData.forEach((val, ci) => {
        const colIdx = startC + ci;
        if (colIdx < numCols && rows[startR+ri]) {
          rows[startR+ri][cols[colIdx].k] = val;
        }
      });
    });
    onChange(rows);
    // update selection to cover pasted area
    sel = { anchor:{r:startR,c:startC}, focus:{r:startR+grid.length-1, c:startC+(grid[0].length||1)-1} };
    renderRows();
    toast(`Pasted ${grid.length} row${grid.length!==1?"s":""}`);
  }

  // Read system clipboard as TSV grid
  function readSystemClipboard() {
    return new Promise(resolve => {
      const ta = document.createElement("textarea");
      ta.style.cssText="position:fixed;opacity:0;top:0;left:0;width:1px;height:1px";
      document.body.appendChild(ta);
      ta.focus();
      document.execCommand("paste");
      const text = ta.value;
      document.body.removeChild(ta);
      if (!text) { resolve(null); return; }
      const grid = text.split("\n").filter(r=>r).map(r=>r.split("\t"));
      resolve(grid);
    });
  }

  // ── fill down / right ──────────────────────────────────────────────────────
  function fillDown() {
    if (!sel) return;
    const mn=selMin(), mx=selMax();
    // source: top row of selection
    for (let c=mn.c; c<=mx.c; c++) {
      const srcVal = rows[mn.r]?.[cols[c].k] ?? "";
      for (let r=mn.r+1; r<=mx.r; r++) {
        if (rows[r]) rows[r][cols[c].k] = srcVal;
      }
    }
    onChange(rows); renderRows();
    toast("Fill Down");
  }

  function fillRight() {
    if (!sel) return;
    const mn=selMin(), mx=selMax();
    for (let r=mn.r; r<=mx.r; r++) {
      const srcVal = rows[r]?.[cols[mn.c].k] ?? "";
      for (let c=mn.c+1; c<=mx.c; c++) {
        if (rows[r]) rows[r][cols[c].k] = srcVal;
      }
    }
    onChange(rows); renderRows();
    toast("Fill Right");
  }

  // ── row operations ─────────────────────────────────────────────────────────
  function addBlankRow(atIndex) {
    const blank={}; cols.forEach(c=>{blank[c.k]="";}); 
    if (atIndex !== undefined) rows.splice(atIndex, 0, blank);
    else rows.push(blank);
    onChange(rows); renderRows();
  }

  function deleteSelectedRows() {
    if (!sel) return;
    const mn=selMin(), mx=selMax();
    rows.splice(mn.r, mx.r-mn.r+1);
    sel=null; onChange(rows); renderRows();
    toast(`Deleted ${mx.r-mn.r+1} row${mx.r-mn.r+1!==1?"s":""}`);
  }

  function duplicateSelectedRows() {
    if (!sel) return;
    const mn=selMin(), mx=selMax();
    const dupes = rows.slice(mn.r, mx.r+1).map(r=>({...r}));
    rows.splice(mx.r+1, 0, ...dupes);
    sel={anchor:{r:mx.r+1,c:0},focus:{r:mx.r+dupes.length,c:numCols-1}};
    onChange(rows); renderRows();
    toast(`Duplicated ${dupes.length} row${dupes.length!==1?"s":""}`);
  }

  function insertRowAbove(ri) {
    addBlankRow(ri);
    sel={anchor:{r:ri,c:0},focus:{r:ri,c:numCols-1}};
  }

  function insertRowBelow(ri) {
    addBlankRow(ri+1);
    sel={anchor:{r:ri+1,c:0},focus:{r:ri+1,c:numCols-1}};
  }

  function moveRowUp(ri) {
    if (ri===0) return;
    [rows[ri-1],rows[ri]]=[rows[ri],rows[ri-1]];
    sel={anchor:{r:ri-1,c:0},focus:{r:ri-1,c:numCols-1}};
    onChange(rows); renderRows();
  }

  function moveRowDown(ri) {
    if (ri>=rows.length-1) return;
    [rows[ri+1],rows[ri]]=[rows[ri],rows[ri+1]];
    sel={anchor:{r:ri+1,c:0},focus:{r:ri+1,c:numCols-1}};
    onChange(rows); renderRows();
  }

  // ── column operations ──────────────────────────────────────────────────────
  function copyCol(ci) {
    const data = rows.map(r=>[r[cols[ci].k]??""]);
    iClip = { type:"col", data, colIdx:ci };
    const tsv = data.map(r=>r[0]).join("\n");
    api.clipboard.write(tsv);
    toast(`Copied column: ${cols[ci].l}`);
  }

  function clearCol(ci) {
    rows.forEach(r=>{ r[cols[ci].k]=""; });
    onChange(rows); renderRows();
    toast(`Cleared column: ${cols[ci].l}`);
  }

  function fillColWith(ci) {
    const val = prompt(`Fill entire column "${cols[ci].l}" with:`);
    if (val===null) return;
    rows.forEach(r=>{ r[cols[ci].k]=val; });
    onChange(rows); renderRows();
    toast(`Filled "${cols[ci].l}" with "${val}"`);
  }

  // ── flash selection ────────────────────────────────────────────────────────
  function flashSel(mode) {
    const cls = mode==="copy" ? "sh-flash-copy" : "sh-flash-cut";
    $$(".sh-sel", table).forEach(td => {
      td.classList.add(cls);
      setTimeout(()=>td.classList.remove(cls), 500);
    });
  }

  // ── context menus ──────────────────────────────────────────────────────────
  function showMenu(x, y, items) {
    // remove any existing
    const old = $("#sh-ctx");
    if (old) old.remove();

    const menu = mk("div","sh-ctx"); menu.id="sh-ctx";
    menu.style.cssText=`left:${x}px;top:${y}px`;

    items.forEach(item => {
      if (item==="---") {
        const sep=mk("div","sh-ctx-sep"); menu.appendChild(sep); return;
      }
      const opt = mk("div","sh-ctx-item");
      opt.innerHTML = `<span>${item.label}</span>${item.key?`<span class="sh-ctx-key">${item.key}</span>`:""}`;
      opt.onclick   = () => { menu.remove(); item.action(); };
      if (item.danger) opt.classList.add("danger");
      menu.appendChild(opt);
    });

    document.body.appendChild(menu);

    // auto-flip if off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right  > window.innerWidth)  menu.style.left = (x - rect.width)  + "px";
    if (rect.bottom > window.innerHeight) menu.style.top  = (y - rect.height) + "px";

    const dismiss = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("mousedown",dismiss,true); }};
    setTimeout(()=>document.addEventListener("mousedown",dismiss,true),0);
  }

  function showCellMenu(e, ri, ci) {
    sel = sel || { anchor:{r:ri,c:ci}, focus:{r:ri,c:ci} };
    const mn=selMin(), mx=selMax();
    const rowCount = mx.r-mn.r+1;
    showMenu(e.clientX, e.clientY, [
      { label:"Copy",           key:"Ctrl+C",  action: copySelection },
      { label:"Cut",            key:"Ctrl+X",  action: cutSelection },
      { label:"Paste",          key:"Ctrl+V",  action: ()=>pasteAt(ri,ci) },
      "---",
      { label:"Fill Down",      key:"Ctrl+D",  action: fillDown },
      { label:"Fill Right",     key:"Ctrl+R",  action: fillRight },
      "---",
      { label:"Insert Row Above",               action: ()=>insertRowAbove(ri) },
      { label:"Insert Row Below",               action: ()=>insertRowBelow(ri) },
      { label:`Duplicate Row${rowCount>1?"s":""}`, action: duplicateSelectedRows },
      "---",
      { label:`Delete Row${rowCount>1?"s":""}`, action: deleteSelectedRows, danger:true },
    ]);
  }

  function showRowMenu(e, ri) {
    sel = { anchor:{r:ri,c:0}, focus:{r:ri,c:numCols-1} };
    repaintSel();
    showMenu(e.clientX, e.clientY, [
      { label:"Copy Row",          key:"Ctrl+C",  action: copySelection },
      { label:"Duplicate Row",                    action: duplicateSelectedRows },
      "---",
      { label:"Insert Row Above",                 action: ()=>insertRowAbove(ri) },
      { label:"Insert Row Below",                 action: ()=>insertRowBelow(ri) },
      "---",
      { label:"Move Row Up",                      action: ()=>moveRowUp(ri) },
      { label:"Move Row Down",                    action: ()=>moveRowDown(ri) },
      "---",
      { label:"Delete Row",                       action: deleteSelectedRows, danger:true },
    ]);
  }

  function showColMenu(e, ci) {
    colSel=ci;
    sel={anchor:{r:0,c:ci},focus:{r:rows.length-1,c:ci}};
    repaintSel();
    showMenu(e.clientX, e.clientY, [
      { label:`Copy Column: ${cols[ci].l}`,      action: ()=>copyCol(ci) },
      { label:`Paste Into Column`,                action: ()=>{ if(iClip) { rows.forEach((r,ri)=>{ r[cols[ci].k]=iClip.data[ri]?.[0]??""; }); onChange(rows); renderRows(); } } },
      "---",
      { label:`Fill Column With…`,               action: ()=>fillColWith(ci) },
      { label:`Clear Column`,                    action: ()=>clearCol(ci), danger:true },
    ]);
  }

  // ── assemble ───────────────────────────────────────────────────────────────
  renderRows();
  table.appendChild(tbody);
  wrap.appendChild(table);

  // keyboard shortcut hint bar
  const hints = mk("div","sh-hints");
  hints.innerHTML=[
    "Ctrl+C Copy","Ctrl+X Cut","Ctrl+V Paste","Ctrl+D Fill Down",
    "Ctrl+R Fill Right","Ctrl+A Select All","Ctrl+Del Delete Rows",
    "Right-click for more"
  ].map(h=>`<span>${h}</span>`).join("");

  // add row button
  const addRow = mk("div","add-row-btn");
  addRow.innerHTML=`<span style="color:${C.accentDim};font-size:14px">+</span> Add Row`;
  addRow.onclick = () => {
    addBlankRow();
    setTimeout(()=>{
      const all=allInputs();
      const last=all[all.length-numCols];
      if(last){last.focus();last.select();last.scrollIntoView({block:"nearest"});}
    },20);
  };

  container.appendChild(wrap);
  container.appendChild(hints);
  container.appendChild(addRow);

  // cleanup listeners when container is replaced
  const obs = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      document.removeEventListener("keydown", keyTracker, true);
      document.removeEventListener("keyup",   keyTracker, true);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList:true, subtree:true });
}

// ── TASK GROUPS PAGE ─────────────────────────────────────────────────────────
function renderTaskGroups(p) {
  const wrap = mk("div","tg-wrap");

  // ── left: group list ─────────────────────────────────────────────────────
  const listPanel = mk("div","tg-list-panel");
  const listHdr = mk("div","tg-list-hdr");
  const groupNames = Object.keys(S.taskFiles).filter(n => n !== "example_tasks");
  listHdr.innerHTML = `<span class="tg-list-title">Task Groups</span><span class="tg-list-count">${groupNames.length} groups</span>`;
  listPanel.appendChild(listHdr);

  const search = mk("input","finput tg-search");
  search.placeholder = "Search groups";
  listPanel.appendChild(search);

  const listBody = mk("div","tg-list-body");

  // parse each group for meta: task count + site from first data row
  function groupMeta(name) {
    const raw = S.taskFiles[name] || "";
    const rows = raw.trim().split("\n").filter(x => x.trim());
    const hasHdr = rows[0] && TASK_COLS.some(c => rows[0].toLowerCase().includes(c.k.toLowerCase()));
    const dataRows = hasHdr ? rows.slice(1) : rows;
    let site = "";
    if (dataRows.length) {
      const vals = dataRows[0].split(",");
      const siteIdx = TASK_COLS.findIndex(c => c.k === "site");
      if (siteIdx >= 0) site = (vals[siteIdx] || "").trim();
    }
    return { count: dataRows.length, site };
  }

  let selectedGroup = null;
  const detailPanel = mk("div","tg-detail-panel");

  function buildGroupList(filter) {
    listBody.innerHTML = "";
    const filtered = filter ? groupNames.filter(n => n.toLowerCase().includes(filter.toLowerCase())) : groupNames;
    if (!filtered.length) {
      listBody.appendChild(mk("div","info-dim", filter ? "No matching groups" : "No task groups found — create CSVs in the Tasks tab"));
      return;
    }
    filtered.forEach(name => {
      const meta = groupMeta(name);
      const row = mk("div",`tg-row${selectedGroup === name ? " active" : ""}`);
      const info = mk("div","tg-row-info");
      info.appendChild(mk("div","tg-row-name", esc(name)));
      const sub = [meta.site, `${meta.count} task${meta.count !== 1 ? "s" : ""}`].filter(Boolean).join(" · ");
      info.appendChild(mk("div","tg-row-sub", esc(sub)));
      row.appendChild(info);

      const actions = mk("div","tg-row-actions");
      const startBtn = mkBtn("Start","sm pr", async () => {
        if (!S.engineRunning) {
          const exePath = await api.engine.getExePath();
          pushLog(`Launching: ${exePath}`,"dim");
          const r = await api.engine.start();
          if (!r.ok) { pushLog(`Error: ${r.err}`,"error"); toast(r.err.split("\n")[0]); return; }
          await new Promise(r => setTimeout(r, 2000));
        }
        pushLog(`> 2) Start task group: ${name}`,"dim");
        await api.engine.sendThenWait("2","Enter group name",name,4000);
        toast(`Started ${name}`);
      });
      const stopBtn = mkBtn("Stop","sm dg", async () => {
        if (!S.engineRunning) { toast("Engine not running"); return; }
        pushLog(`> 4) Stop task group: ${name} (sending×3)`,"dim");
        // send "4" then wait for prompt and send group name, repeat for reliability
        await api.engine.sendThenWait("4","Enter group name",name,4000);
        toast(`Stopping ${name}`);
      });
      actions.appendChild(startBtn);
      actions.appendChild(stopBtn);
      row.appendChild(actions);

      row.onclick = (e) => {
        if (e.target.closest(".btn")) return;
        selectedGroup = name;
        buildGroupList(search.value);
        renderGroupDetail(name);
      };
      listBody.appendChild(row);
    });
  }

  search.oninput = () => buildGroupList(search.value);
  buildGroupList("");
  listPanel.appendChild(listBody);
  wrap.appendChild(listPanel);

  // ── right: detail panel ──────────────────────────────────────────────────
  function renderGroupDetail(name) {
    detailPanel.innerHTML = "";
    if (!name) {
      detailPanel.appendChild(mk("div","tg-empty","Select a task group to view details"));
      return;
    }
    const meta = groupMeta(name);

    // header
    const hdr = mk("div","tg-detail-hdr");
    hdr.innerHTML = `<div class="tg-detail-name">${esc(name)}</div><div class="tg-detail-sub">${esc(meta.site)} · ${meta.count} tasks</div>`;
    detailPanel.appendChild(hdr);

    // per-group stats from logs
    const groupLogs = S.log.filter(e => {
      if (!e.site) return false;
      // match by site field — the engine's [site] field is a hyphenated domain like shop-topps-com
      // the CSV site field is a url/domain like shop.topps.com
      const normSite = meta.site.replace(/^https?:\/\//, "").replace(/\//g, "").replace(/\./g, "-").toLowerCase();
      const logSite = (e.site || "").toLowerCase();
      return logSite === normSite || logSite.includes(normSite) || normSite.includes(logSite);
    });

    const statCounts = { cart:0, checkout:0, success:0, fail:0, error:0 };
    groupLogs.forEach(e => { if (statCounts[e.type] !== undefined) statCounts[e.type]++; });

    const statsBar = mk("div","tg-stats-bar");
    [
      {v:statCounts.cart,     l:"Carts",        c:"var(--text)"},
      {v:statCounts.checkout, l:"Checking Out",  c:"var(--text)"},
      {v:statCounts.success,  l:"Success",       c:"var(--accent)"},
      {v:statCounts.fail,     l:"Declines",      c:"var(--text)"},
      {v:statCounts.error,    l:"Errors",        c:"var(--red,#e74c3c)"},
    ].forEach(s => {
      const d = mk("div","tg-stat");
      d.innerHTML = `<div class="tg-stat-val" style="color:${s.c}">${s.v}</div><div class="tg-stat-lbl">${s.l}</div>`;
      statsBar.appendChild(d);
    });
    detailPanel.appendChild(statsBar);

    // live task counts from TaskTracker if running
    if (S.engineRunning && S.stats) {
      const liveCard = mk("div","card"); liveCard.style.marginTop = "12px";
      const liveHdr = mk("div","card-hdr"); liveHdr.textContent = "Live Tasks";
      liveCard.appendChild(liveHdr);
      const liveBody = mk("div","card-body");
      const liveTiles = mk("div","tg-live-tiles");
      const states = ["init","monitor","queue","cart","checkout","captcha"];
      // count tasks in this group by site match
      let inGroup = 0, inQueue = 0;
      if (S.stats.trackerDump) {
        // If we have per-task data, filter it
      }
      liveBody.appendChild(mk("div","info-dim","Live per-group task breakdown requires the engine to be running with this group active."));
      liveCard.appendChild(liveBody);
      detailPanel.appendChild(liveCard);
    }

    // filtered console
    const conCard = mk("div","card"); conCard.style.marginTop = "12px";
    const conHdr = mk("div","card-hdr");
    conHdr.innerHTML = `<span>Console · ${esc(name)}</span><span class="spacer"></span>`;
    conHdr.appendChild(mkBtn("Open in Engine →","sm", () => { S.logFilter = null; switchTab("engine"); }));
    conCard.appendChild(conHdr);

    const conBody = mk("div","tg-con-body");
    const MAX_LINES = 200;
    const relevantLogs = groupLogs.slice(-MAX_LINES);

    if (!relevantLogs.length) {
      conBody.appendChild(mk("div","info-dim","No log entries for this group yet. Start the group to see output here."));
    } else {
      relevantLogs.forEach(e => conBody.appendChild(logRow(e)));
      requestAnimationFrame(() => { conBody.scrollTop = conBody.scrollHeight; });
    }
    conCard.appendChild(conBody);
    detailPanel.appendChild(conCard);
  }

  renderGroupDetail(null);
  wrap.appendChild(detailPanel);
  p.appendChild(wrap);
}

// ── TASKS TAB ────────────────────────────────────────────────────────────────
function renderTasks(p) {
  // persist mode in localStorage
  try { if (!S._taskMode) S._taskMode = localStorage.getItem("mb_taskMode") || "basic"; } catch(e) { if (!S._taskMode) S._taskMode = "basic"; }

  let activeGroup = S.activeGroups.tasks || Object.keys(S.taskFiles)[0] || null;

  function build() {
    p.innerHTML = "";
    const sl = mk("div","sl");

    // ── shared sidebar ────────────────────────────────────────────────────────
    const sidebar = mk("div","sidebar");
    const scard   = mk("div","card");

    // header with mode toggle
    const shdr = mk("div","card-hdr bt-sidebar-hdr");
    shdr.innerHTML = `<span>Task Groups</span>`;
    const toggleWrap = mk("div","task-mode-toggle");
    ["basic","advanced"].forEach(m => {
      const btn = mk("button",`task-mode-btn${S._taskMode===m?" active":""}`);
      btn.textContent = m === "basic" ? "Basic" : "Adv";
      btn.onclick = () => {
        S._taskMode = m;
        try { localStorage.setItem("mb_taskMode", m); } catch(e) {}
        build();
      };
      toggleWrap.appendChild(btn);
    });
    shdr.appendChild(toggleWrap);

    const glist = mk("div","g-list");
    Object.keys(S.taskFiles).forEach(g => {
      const item = mk("div",`g-item${g===activeGroup?" active":""}`);
      const nm   = mk("span"); nm.textContent = g;
      const cnt  = mk("span","g-count");
      const rows = csvToRows(S.taskFiles[g]||"", TASK_COLS);
      cnt.textContent = rows.length;
      item.appendChild(nm); item.appendChild(cnt);
      item.onclick = () => { activeGroup=g; S.activeGroups.tasks=g; build(); };
      glist.appendChild(item);
    });
    scard.appendChild(shdr); scard.appendChild(glist);
    sidebar.appendChild(scard);

    sidebar.appendChild(mkBtn("+ New Group","sm", async ()=>{
      const name = await newGroupModal("task");
      if (!name) return;
      S.taskFiles[name] = TASK_COLS.map(c=>c.k).join(",") + "\n";
      const result = await api.fs.writeFile("task", name, ".csv", S.taskFiles[name]);
      if (!result?.ok) { pushLog(`Failed to create ${name}.csv`,"error"); toast("Create failed"); return; }
      activeGroup = name; S.activeGroups.tasks = name;
      toast(`Created ${name}.csv`);
      build();
    }));

    if (activeGroup && Object.keys(S.taskFiles).length>1) {
      sidebar.appendChild(mkBtn("✕ Delete","dg sm", async ()=>{
        if (!confirm(`Delete "${activeGroup}"?`)) return;
        await api.fs.deleteFile("task", activeGroup, ".csv");
        delete S.taskFiles[activeGroup];
        activeGroup=Object.keys(S.taskFiles)[0]||null;
        S.activeGroups.tasks=activeGroup;
        build();
      }));
    }
    sl.appendChild(sidebar);

    // ── main area ─────────────────────────────────────────────────────────────
    const main = mk("div","sidebar-main");

    if (S._taskMode === "advanced") {
      // ── Advanced: spreadsheet ──────────────────────────────────────────────
      const card = mk("div","card full-card");
      const hdr = mk("div","card-hdr file-hdr");
      hdr.innerHTML = `<span>${activeGroup||"—"}</span>
        <span style="color:var(--text-muted);font-weight:400;margin-left:5px">
          — \\task\\${activeGroup||""}.csv
        </span>`;

      let saveTimer = null;
      function scheduleSave(rows) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async ()=>{
          if (!activeGroup) return;
          const content = rowsToCsv(rows, TASK_COLS, true);
          S.taskFiles[activeGroup] = content;
          await api.fs.writeFile("task", activeGroup, ".csv", content);
        }, 600);
      }

      const saveBtn = mkBtn("Save","pr sm", async ()=>{
        if (!activeGroup) return;
        const rows = csvToRows(S.taskFiles[activeGroup]||"", TASK_COLS);
        const content = rowsToCsv(rows, TASK_COLS, true);
        await api.fs.writeFile("task", activeGroup, ".csv", content);
        toast(`Saved ${activeGroup}.csv`);
      });
      const importBtn = mkBtn("↑ Import","sm", async ()=>{
        const r = await api.fs.importFile([{name:"CSV",extensions:["csv"]}]);
        if (!r) return;
        S.taskFiles[activeGroup] = r.content;
        await api.fs.writeFile("task", activeGroup, ".csv", r.content);
        toast("Imported"); build();
      });
      hdr.appendChild(saveBtn); hdr.appendChild(importBtn);
      card.appendChild(hdr);

      if (activeGroup !== null) {
        const rows = csvToRows(S.taskFiles[activeGroup]||"", TASK_COLS);
        const sheetContainer = mk("div");
        sheetContainer.style.cssText="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden";
        renderSheet(sheetContainer, TASK_COLS, rows, updatedRows => {
          const content = rowsToCsv(updatedRows, TASK_COLS, true);
          S.taskFiles[activeGroup] = content;
          scheduleSave(updatedRows);
        });
        card.appendChild(sheetContainer);
      }
      main.appendChild(card);
    } else {
      // ── Basic: card view + builder ─────────────────────────────────────────
      renderBasicMain(main, activeGroup, build);
    }

    sl.appendChild(main); p.appendChild(sl);
  }
  build();
}

/* ── BASIC TASK VIEW — card view + builder ──────────────────────────────────── */
function renderBasicMain(main, activeGroup, rebuild) {
  if (!activeGroup || !S.taskFiles[activeGroup]) {
    main.appendChild(mk("div","info-dim","Select a task group from the sidebar"));
    return;
  }

  const scroll = mk("div","bt-main-scroll");

  // header
  const hdr = mk("div","bt-main-hdr");
  hdr.innerHTML = `<span class="bt-grp-name">${esc(activeGroup)}</span>
    <span class="bt-grp-file">task/${activeGroup}.csv</span>`;
  const addBtn = mkBtn("+ Add Task","pr sm", () => { addEmptyTask(); });
  const dupeBtn = mkBtn("Duplicate","sm", () => { duplicateSelected(); });
  const saveBtn = mkBtn("Save","sm", async () => {
    const content = rowsToCsv(rows, TASK_COLS, true);
    S.taskFiles[activeGroup] = content;
    await api.fs.writeFile("task", activeGroup, ".csv", content);
    toast(`Saved ${activeGroup}.csv`);
  });
  hdr.appendChild(addBtn); hdr.appendChild(dupeBtn); hdr.appendChild(saveBtn);
  scroll.appendChild(hdr);

  // helper: dropdown from object keys with preselected value
  const makeDropdown = (obj, val, placeholder) => {
    const sel = mk("select","finput bt-card-sel");
    const blank = mk("option"); blank.value = ""; blank.textContent = placeholder;
    sel.appendChild(blank);
    Object.keys(obj).forEach(k => {
      const o = mk("option"); o.value = o.textContent = k;
      if (k === val) o.selected = true;
      sel.appendChild(o);
    });
    if (val && !obj[val]) { const o = mk("option"); o.value = o.textContent = val; o.selected = true; sel.appendChild(o); }
    return sel;
  };

  // parse rows
  let rows = csvToRows(S.taskFiles[activeGroup]||"", TASK_COLS);
  let selectedCards = new Set();

  // auto-save on change
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const content = rowsToCsv(rows, TASK_COLS, true);
      S.taskFiles[activeGroup] = content;
      await api.fs.writeFile("task", activeGroup, ".csv", content);
    }, 800);
  }

  // pick-tasks bar
  const pickBar = mk("div","bt-pick-bar");
  const pickCb = mk("input"); pickCb.type = "checkbox"; pickCb.className = "bt-cb";
  pickCb.onchange = () => {
    selectedCards = pickCb.checked ? new Set(rows.map((_,i)=>i)) : new Set();
    renderCards();
  };
  const pickLabel = mk("span","bt-pick-label"); pickLabel.textContent = "Pick tasks";
  const pickHint = mk("span","bt-hint"); pickHint.textContent = "to set a field on several at once";
  pickBar.appendChild(pickCb); pickBar.appendChild(pickLabel); pickBar.appendChild(pickHint);
  scroll.appendChild(pickBar);

  // cards container
  const cardsWrap = mk("div","bt-cards");

  function renderCards() {
    cardsWrap.innerHTML = "";
    if (!rows.length) {
      cardsWrap.appendChild(mk("div","info-dim","No tasks yet — click + Add Task above"));
      return;
    }
    rows.forEach((r, idx) => {
      const card = mk("div","bt-task-card");

      // left: checkbox + number
      const leftCol = mk("div","bt-card-left");
      const cb = mk("input"); cb.type = "checkbox"; cb.className = "bt-cb";
      cb.checked = selectedCards.has(idx);
      cb.onchange = () => { if (cb.checked) selectedCards.add(idx); else selectedCards.delete(idx); };
      const num = mk("span","bt-card-num"); num.textContent = idx + 1;
      leftCol.appendChild(cb); leftCol.appendChild(num);
      card.appendChild(leftCol);

      // main content
      const body = mk("div","bt-card-body");

      // row 1: profile group, profile, proxy list, account list
      const row1 = mk("div","bt-card-row");
      const pgSel = makeDropdown(S.profiles, r.profileGroup, "Profile Group");
      pgSel.onchange = () => { r.profileGroup = pgSel.value; scheduleSave(); };
      const pfInp = mk("input","finput bt-card-inp"); pfInp.value = r.profileName||""; pfInp.placeholder = "Profile";
      pfInp.oninput = () => { r.profileName = pfInp.value; scheduleSave(); };
      const pxSel = makeDropdown(S.proxies, r.proxyGroup, "Proxy List");
      pxSel.onchange = () => { r.proxyGroup = pxSel.value; scheduleSave(); };
      const acSel = makeDropdown(S.accounts, r.accountGroup, "Account List");
      acSel.onchange = () => { r.accountGroup = acSel.value; scheduleSave(); };

      [["PROFILE GROUP",pgSel],["PROFILE",pfInp],["PROXY LIST",pxSel],["ACCOUNT LIST",acSel]].forEach(([lbl,el])=>{
        const col = mk("div","bt-card-col");
        const lb = mk("div","bt-card-lbl"); lb.textContent = lbl;
        col.appendChild(lb); col.appendChild(el);
        row1.appendChild(col);
      });
      body.appendChild(row1);

      // row 2: keywords, site, mode, size, colour, qty, delay
      const row2 = mk("div","bt-card-row");

      // keywords bubble field
      const kwCol = mk("div","bt-card-col bt-card-kw-col");
      const kwLbl = mk("div","bt-card-lbl"); kwLbl.textContent = "KEYWORDS";
      const kwContainer = mk("div","bt-kw-container bt-card-kw");
      const kwBubbles = mk("div","bt-kw-bubbles");
      const kwArr = (r.input||"").split(",").map(s=>s.trim()).filter(Boolean);

      function renderKw() {
        kwBubbles.innerHTML = "";
        kwArr.forEach((kw, ki) => {
          const neg = kw.startsWith("-");
          const chip = mk("span", neg ? "bt-kw-chip bt-kw-neg" : "bt-kw-chip");
          chip.textContent = kw;
          const x = mk("span","bt-kw-x"); x.textContent = "×";
          x.onclick = () => { kwArr.splice(ki, 1); r.input = kwArr.join(","); renderKw(); scheduleSave(); };
          chip.appendChild(x);
          kwBubbles.appendChild(chip);
        });
      }
      renderKw();
      const kwInp = mk("input","bt-kw-input"); kwInp.placeholder = "add term…";
      kwInp.style.minWidth = "70px";
      kwInp.addEventListener("keydown", ev => {
        if (ev.key === "Enter" && kwInp.value.trim()) {
          ev.preventDefault();
          kwArr.push(kwInp.value.trim()); kwInp.value = "";
          r.input = kwArr.join(","); renderKw(); scheduleSave();
        }
        if (ev.key === "Backspace" && !kwInp.value && kwArr.length) {
          kwArr.pop(); r.input = kwArr.join(","); renderKw(); scheduleSave();
        }
      });
      kwContainer.appendChild(kwBubbles); kwContainer.appendChild(kwInp);
      kwCol.appendChild(kwLbl); kwCol.appendChild(kwContainer);
      row2.appendChild(kwCol);

      // inline fields
      [["SITE","site"],["MODE","mode"],["SIZE","size"],["COLOUR","color"],["QTY","cartQuantity"],["DELAY","delay"]].forEach(([lbl,key])=>{
        const col = mk("div","bt-card-col bt-card-sm-col");
        const lb = mk("div","bt-card-lbl"); lb.textContent = lbl;
        const inp = mk("input","finput bt-card-inp");
        inp.value = r[key]||""; inp.placeholder = lbl.toLowerCase();
        inp.oninput = () => { r[key] = inp.value; scheduleSave(); };
        col.appendChild(lb); col.appendChild(inp);
        row2.appendChild(col);
      });
      body.appendChild(row2);
      card.appendChild(body);

      // right: delete + duplicate
      const actions = mk("div","bt-card-actions");
      const dupI = mk("span","bt-card-act"); dupI.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
      dupI.title = "Duplicate";
      dupI.onclick = () => { rows.splice(idx+1, 0, {...r}); renderCards(); scheduleSave(); };
      const delI = mk("span","bt-card-act bt-card-del"); delI.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
      delI.title = "Delete";
      delI.onclick = () => { rows.splice(idx, 1); selectedCards.delete(idx); renderCards(); scheduleSave(); };
      actions.appendChild(dupI); actions.appendChild(delI);
      card.appendChild(actions);

      cardsWrap.appendChild(card);
    });
  }
  renderCards();
  scroll.appendChild(cardsWrap);

  // ── builder section (bottom) ──────────────────────────────────────────────
  const builderCard = mk("div","card bt-builder");
  const builderHdr = mk("div","card-hdr bt-builder-hdr");
  builderHdr.innerHTML = `<span>Quick Builder</span>`;
  builderCard.appendChild(builderHdr);

  const bBody = mk("div","bt-builder-body");

  // helper
  const bDropdown = (obj, placeholder) => {
    const sel = mk("select","finput bt-card-sel");
    const blank = mk("option"); blank.value = ""; blank.textContent = placeholder;
    sel.appendChild(blank);
    Object.keys(obj).filter(k => !k.startsWith("example")).forEach(k => { const o = mk("option"); o.value = o.textContent = k; sel.appendChild(o); });
    return sel;
  };

  // builder row 1
  const bRow1 = mk("div","bt-card-row");
  const bProfGrp = bDropdown(S.profiles, "Profile Group");
  const bProfile = mk("input","finput bt-card-inp"); bProfile.placeholder = "ALL";
  const bProxy = bDropdown(S.proxies, "Proxy List");
  const bAcct = bDropdown(S.accounts, "Account List");
  [["PROFILE GROUP",bProfGrp],["PROFILE",bProfile],["PROXY LIST",bProxy],["ACCOUNT LIST",bAcct]].forEach(([l,el])=>{
    const col = mk("div","bt-card-col"); const lb = mk("div","bt-card-lbl"); lb.textContent = l;
    col.appendChild(lb); col.appendChild(el); bRow1.appendChild(col);
  });
  bBody.appendChild(bRow1);

  // builder row 2
  const bRow2 = mk("div","bt-card-row");

  // keywords
  const bKwCol = mk("div","bt-card-col bt-card-kw-col");
  const bKwLbl = mk("div","bt-card-lbl"); bKwLbl.textContent = "KEYWORDS";
  const bKwContainer = mk("div","bt-kw-container bt-card-kw");
  const bKwBubbles = mk("div","bt-kw-bubbles");
  const bKwArr = [];
  function renderBKw() {
    bKwBubbles.innerHTML = "";
    bKwArr.forEach((kw, i) => {
      const neg = kw.startsWith("-");
      const chip = mk("span", neg ? "bt-kw-chip bt-kw-neg" : "bt-kw-chip");
      chip.textContent = kw;
      const x = mk("span","bt-kw-x"); x.textContent = "×";
      x.onclick = () => { bKwArr.splice(i, 1); renderBKw(); updatePreviewCount(); };
      chip.appendChild(x);
      bKwBubbles.appendChild(chip);
    });
  }
  const bKwInp = mk("input","bt-kw-input"); bKwInp.placeholder = "add term…"; bKwInp.style.minWidth = "70px";
  bKwInp.addEventListener("keydown", ev => {
    if (ev.key === "Enter" && bKwInp.value.trim()) { ev.preventDefault(); bKwArr.push(bKwInp.value.trim()); bKwInp.value = ""; renderBKw(); updatePreviewCount(); }
    if (ev.key === "Backspace" && !bKwInp.value && bKwArr.length) { bKwArr.pop(); renderBKw(); updatePreviewCount(); }
  });
  bKwContainer.appendChild(bKwBubbles); bKwContainer.appendChild(bKwInp);
  bKwCol.appendChild(bKwLbl); bKwCol.appendChild(bKwContainer);
  bRow2.appendChild(bKwCol);

  const bSite = mk("input","finput bt-card-inp"); bSite.placeholder = "site";
  const bMode = mk("input","finput bt-card-inp"); bMode.placeholder = "mode";
  const bSize = mk("input","finput bt-card-inp"); bSize.placeholder = "size";
  const bColor = mk("input","finput bt-card-inp"); bColor.placeholder = "colour";
  const bQty = mk("input","finput bt-card-inp"); bQty.placeholder = "qty"; bQty.value = "1";
  const bDelay = mk("input","finput bt-card-inp"); bDelay.placeholder = "delay"; bDelay.value = "3500";
  [["SITE",bSite],["MODE",bMode],["SIZE",bSize],["COLOUR",bColor],["QTY",bQty],["DELAY",bDelay]].forEach(([l,el])=>{
    const col = mk("div","bt-card-col bt-card-sm-col"); const lb = mk("div","bt-card-lbl"); lb.textContent = l;
    col.appendChild(lb); col.appendChild(el); bRow2.appendChild(col);
  });
  bBody.appendChild(bRow2);

  // profile multi-select for builder (generates N tasks, one per profile)
  const bProfWrap = mk("div","bt-builder-profs");
  const bProfHdr = mk("div","bt-prof-list-hdr");
  bProfHdr.innerHTML = `<span>Select Profiles to Generate</span><span class="bt-hint">Each checked profile = 1 task row · Shift-click for range</span>`;
  const bProfBody = mk("div","bt-prof-body");
  let bProfRows = [];
  let bLastIdx = -1;

  function buildBProfList() {
    bProfBody.innerHTML = "";
    bProfRows = [];
    const grp = bProfGrp.value;
    if (!grp || !S.profiles[grp]) {
      bProfBody.appendChild(mk("div","info-dim","Select a profile group to pick individual profiles"));
      updatePreviewCount();
      return;
    }
    const csv = S.profiles[grp] || "";
    const lines = csv.trim().split("\n").filter(x => x.trim());
    lines.forEach((line, idx) => {
      const name = line.split(",")[0].trim();
      if (!name) return;
      const row = mk("div","bt-prof-row");
      const cb = mk("input"); cb.type = "checkbox"; cb.className = "bt-cb"; cb.checked = true;
      const lbl = mk("span","bt-prof-name"); lbl.textContent = name;
      row.appendChild(cb); row.appendChild(lbl);
      bProfRows.push({ name, cb, line });

      const handleClick = (e) => {
        if (e.target === cb && !e.shiftKey) { bLastIdx = idx; updatePreviewCount(); return; }
        e.preventDefault();
        if (e.shiftKey && bLastIdx >= 0) {
          const lo = Math.min(bLastIdx, idx), hi = Math.max(bLastIdx, idx);
          bProfRows.forEach((pr, pi) => { if (pi >= lo && pi <= hi) pr.cb.checked = true; });
        } else { cb.checked = !cb.checked; }
        bLastIdx = idx;
        updatePreviewCount();
      };
      row.addEventListener("click", handleClick);
      bProfBody.appendChild(row);
    });
    updatePreviewCount();
  }
  bProfGrp.addEventListener("change", buildBProfList);
  bProfWrap.appendChild(bProfHdr); bProfWrap.appendChild(bProfBody);
  bBody.appendChild(bProfWrap);

  // preview count + generate
  const genRow = mk("div","bt-builder-gen");
  const previewCount = mk("span","bt-gen-preview");
  previewCount.textContent = "0 tasks will be generated";
  function updatePreviewCount() {
    const checked = bProfRows.filter(pr => pr.cb.checked).length;
    const n = checked || (bProfile.value.trim() ? 1 : 0);
    previewCount.textContent = `${n} task${n!==1?"s":""} will be generated`;
    previewCount.style.color = n > 0 ? "var(--accent)" : "var(--text-muted)";
  }
  bProfile.addEventListener("input", updatePreviewCount);

  const genBtn = mkBtn("Generate","pr", async () => {
    const profGrp = bProfGrp.value;
    const site = bSite.value.trim();
    if (!site) { toast("Enter a site"); bSite.focus(); return; }

    let newTasks = [];
    const checkedProfs = bProfRows.filter(pr => pr.cb.checked);
    if (checkedProfs.length) {
      checkedProfs.forEach(pr => {
        newTasks.push({
          profileGroup: profGrp, profileName: pr.name,
          proxyGroup: bProxy.value, accountGroup: bAcct.value,
          input: bKwArr.join(","), size: bSize.value.trim(), color: bColor.value.trim(),
          site, mode: bMode.value.trim(), cartQuantity: bQty.value.trim()||"1", delay: bDelay.value.trim()||"3500"
        });
      });
    } else if (bProfile.value.trim()) {
      newTasks.push({
        profileGroup: profGrp, profileName: bProfile.value.trim(),
        proxyGroup: bProxy.value, accountGroup: bAcct.value,
        input: bKwArr.join(","), size: bSize.value.trim(), color: bColor.value.trim(),
        site, mode: bMode.value.trim(), cartQuantity: bQty.value.trim()||"1", delay: bDelay.value.trim()||"3500"
      });
    }
    if (!newTasks.length) { toast("Select profiles or type a profile name"); return; }

    rows.push(...newTasks);
    const content = rowsToCsv(rows, TASK_COLS, true);
    S.taskFiles[activeGroup] = content;
    await api.fs.writeFile("task", activeGroup, ".csv", content);
    toast(`Added ${newTasks.length} task${newTasks.length>1?"s":""}`);
    renderCards();
    // scroll to bottom
    requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
  });
  genRow.appendChild(previewCount); genRow.appendChild(genBtn);
  bBody.appendChild(genRow);

  builderCard.appendChild(bBody);
  scroll.appendChild(builderCard);

  main.appendChild(scroll);

  // helpers
  function addEmptyTask() {
    rows.push({ profileGroup:"", profileName:"", proxyGroup:"", accountGroup:"", input:"", size:"", color:"", site:"", mode:"", cartQuantity:"1", delay:"3500" });
    renderCards(); scheduleSave();
    requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
  }
  function duplicateSelected() {
    if (!selectedCards.size) { toast("Check tasks to duplicate"); return; }
    const sorted = [...selectedCards].sort((a,b)=>a-b);
    sorted.forEach(i => { rows.push({...rows[i]}); });
    toast(`Duplicated ${sorted.length} task${sorted.length>1?"s":""}`);
    renderCards(); scheduleSave();
  }
}

async function engineCmd(cmd) {
  if (cmd==="startAll") {
    if (!S.engineRunning) {
      const exePath = await api.engine.getExePath();
      pushLog(`Launching: ${exePath}`,"dim");
      const r = await api.engine.start();
      if (!r.ok) { pushLog(`Error: ${r.err}`,"error"); return; }
    }
    await api.engine.send("1");
  } else if (cmd==="stopAll") {
    await api.engine.send("3");
    S.engineRunning=false;
  }
  updateStatus();
}

// ── NEW GROUP MODAL ───────────────────────────────────────────────────────────
// Returns a Promise<string|null> — resolves with trimmed name or null on cancel.
// Uses an inline modal instead of prompt() which can be swallowed by Electron.
function newGroupModal(folderLabel) {
  return new Promise(resolve => {
    const ov  = mk("div","overlay");
    const m   = mk("div","modal"); m.style.width="340px";
    const ttl = mk("div","modal-title"); ttl.textContent=`New ${folderLabel} Group`;
    const row = mk("div","form-row"); row.style.marginBottom="0";
    const lbl = mk("label"); lbl.textContent="File Name (no extension)";
    const inp = mk("input","finput");
    inp.placeholder=`e.g. my_${folderLabel}`;
    inp.style.marginTop="4px";
    row.appendChild(lbl); row.appendChild(inp);
    const act = mk("div","modal-actions");
    const cancel = mkBtn("Cancel","", ()=>{ ov.remove(); resolve(null); });
    const create = mkBtn("Create File","pr", ()=>{
      const v = inp.value.trim();
      if (!v) { inp.style.borderColor="#c45454"; inp.focus(); return; }
      ov.remove(); resolve(v);
    });
    inp.onkeydown = e => { if(e.key==="Enter") create.click(); if(e.key==="Escape") cancel.click(); };
    act.appendChild(cancel); act.appendChild(create);
    m.appendChild(ttl); m.appendChild(row); m.appendChild(act);
    ov.appendChild(m);
    ov.onclick = e=>{ if(e.target===ov) cancel.click(); };
    document.body.appendChild(ov);
    setTimeout(()=>inp.focus(), 50);
  });
}

// ── PROFILES TAB (spreadsheet) ───────────────────────────────────────────────
function csvToRows(csv, cols) {
  const lines = (csv||"").trim().split("\n").filter(x=>x.trim());
  // skip header if present and matches col keys
  const first = lines[0] || "";
  const hasHeader = cols.some(c => first.toLowerCase().includes(c.k.toLowerCase()));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map(line => {
    const vals = line.split(",");
    const row  = {};
    cols.forEach((c,i) => { row[c.k] = (vals[i]||"").trim(); });
    return row;
  });
}

function rowsToCsv(rows, cols, includeHeader=false) {
  const lines = rows.map(r => cols.map(c => r[c.k]??"").join(","));
  if (includeHeader) lines.unshift(cols.map(c=>c.k).join(","));
  return lines.join("\n");
}

function renderProfilesTab(p) {
  renderSheetTab(p, {
    stateKey:  "profiles",
    folder:    "profile",
    ext:       ".csv",
    cols:      PROFILE_COLS,
    includeHeader: false,    // makebot profile CSVs don't have headers
    tabLabel:  "profiles",
  });
}

function renderSheetTab(p, { stateKey, folder, ext, cols, includeHeader, tabLabel }) {
  let activeGroup = S.activeGroups[tabLabel] || Object.keys(S[stateKey])[0] || null;

  function build() {
    p.innerHTML = "";
    const sl = mk("div","sl");

    // ── sidebar ───────────────────────────────────────────────────────────
    const sidebar = mk("div","sidebar");
    const scard   = mk("div","card");
    const shdr    = mk("div","card-hdr"); shdr.textContent = ({ tasks:"Task groups", profiles:"Profile groups" })[tabLabel] || "Groups";
    const glist   = mk("div","g-list");

    Object.keys(S[stateKey]).forEach(g => {
      const item = mk("div",`g-item${g===activeGroup?" active":""}`);
      const nm   = mk("span"); nm.textContent = g;
      const cnt  = mk("span","g-count");
      const rows = csvToRows(S[stateKey][g]||"", cols);
      cnt.textContent = rows.length;
      item.appendChild(nm); item.appendChild(cnt);
      item.onclick = () => { activeGroup=g; S.activeGroups[tabLabel]=g; build(); };
      glist.appendChild(item);
    });
    scard.appendChild(shdr); scard.appendChild(glist);
    sidebar.appendChild(scard);

    sidebar.appendChild(mkBtn("+ New Group","sm", async ()=>{
      const name = await newGroupModal(folder);
      if (!name) return;
      // seed content: task CSVs get the header row, everything else empty
      const seed = (stateKey === "taskFiles")
        ? TASK_COLS.map(c=>c.k).join(",") + "\n"
        : "";
      S[stateKey][name] = seed;
      const result = await api.fs.writeFile(folder, name, ext, seed);
      if (!result?.ok) { pushLog(`Failed to create ${name}${ext}`,"error"); toast("Create failed — check console"); return; }
      activeGroup = name; S.activeGroups[tabLabel] = name;
      pushLog(`Created \\${folder}\\${name}${ext}`,"ok");
      toast(`Created ${name}${ext}`);
      build();
    }));

    if (activeGroup && Object.keys(S[stateKey]).length>1) {
      sidebar.appendChild(mkBtn("✕ Delete","dg sm", async ()=>{
        if (!confirm(`Delete "${activeGroup}"?`)) return;
        await api.fs.deleteFile(folder, activeGroup, ext);
        delete S[stateKey][activeGroup];
        activeGroup=Object.keys(S[stateKey])[0]||null;
        S.activeGroups[tabLabel]=activeGroup;
        build();
      }));
    }
    sl.appendChild(sidebar);

    // ── main editor ───────────────────────────────────────────────────────
    const main = mk("div","sidebar-main");
    const card = mk("div","card full-card");

    const hdr = mk("div","card-hdr file-hdr");
    hdr.innerHTML = `<span>${activeGroup||"—"}</span>
      <span style="color:${C.textDim};font-weight:400;margin-left:5px">
        — \\${folder}\\${activeGroup||""}${ext}
      </span>`;

    // autosave
    let saveTimer = null;
    function scheduleSave(rows) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async ()=>{
        if (!activeGroup) return;
        const content = rowsToCsv(rows, cols, includeHeader);
        S[stateKey][activeGroup] = content;
        await api.fs.writeFile(folder, activeGroup, ext, content);
        // update count in sidebar
        $$(".g-item").forEach(el=>{
          if (el.querySelector("span")?.textContent===activeGroup) {
            el.querySelector(".g-count").textContent = rows.length;
          }
        });
      }, 600);
    }

    const saveBtn = mkBtn("Save","pr sm", async ()=>{
      if (!activeGroup) return;
      const rows = csvToRows(S[stateKey][activeGroup]||"", cols);
      const content = rowsToCsv(rows, cols, includeHeader);
      await api.fs.writeFile(folder, activeGroup, ext, content);
      toast(`Saved ${activeGroup}${ext}`);
    });
    const importBtn = mkBtn("↑ Import","sm", async ()=>{
      const r = await api.fs.importFile([{name:ext===".csv"?"CSV":"Text",extensions:[ext.replace(".","")]}]);
      if (!r) return;
      S[stateKey][activeGroup] = r.content;
      await api.fs.writeFile(folder, activeGroup, ext, r.content);
      toast(`Imported`); build();
    });
    hdr.appendChild(saveBtn); hdr.appendChild(importBtn);
    card.appendChild(hdr);

    if (activeGroup !== null) {
      const rows = csvToRows(S[stateKey][activeGroup]||"", cols);
      const sheetContainer = mk("div");
      sheetContainer.style.cssText="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden";
      renderSheet(sheetContainer, cols, rows, updatedRows => {
        const content = rowsToCsv(updatedRows, cols, includeHeader);
        S[stateKey][activeGroup] = content;
        scheduleSave(updatedRows);
      });
      card.appendChild(sheetContainer);
    }

    main.appendChild(card); sl.appendChild(main); p.appendChild(sl);
  }
  build();
}

// ── PLAIN TEXT TAB (proxies / accounts / precookies) ─────────────────────────
function renderTextTab(p, { stateKey, folder, ext, hint, ph, tabLabel }) {
  let activeGroup = S.activeGroups[tabLabel] || Object.keys(S[stateKey])[0] || null;

  function build() {
    p.innerHTML = "";
    const sl = mk("div","sl");

    const sidebar = mk("div","sidebar");
    const scard   = mk("div","card");
    const shdr    = mk("div","card-hdr"); shdr.textContent = ({ proxies:"Proxy lists", accounts:"Account lists", precookie:"Pre-cookie lists" })[tabLabel] || "Groups";
    const glist   = mk("div","g-list");

    Object.keys(S[stateKey]).forEach(g => {
      const item = mk("div",`g-item${g===activeGroup?" active":""}`);
      const nm   = mk("span"); nm.textContent = g;
      const cnt  = mk("span","g-count");
      cnt.textContent = (S[stateKey][g]||"").split("\n").filter(x=>x.trim()).length;
      item.appendChild(nm); item.appendChild(cnt);
      item.onclick = () => { activeGroup=g; S.activeGroups[tabLabel]=g; build(); };
      glist.appendChild(item);
    });
    scard.appendChild(shdr); scard.appendChild(glist);
    sidebar.appendChild(scard);

    sidebar.appendChild(mkBtn("+ New Group","sm", async ()=>{
      const name = await newGroupModal(folder);
      if (!name) return;
      S[stateKey][name] = "";
      const result = await api.fs.writeFile(folder, name, ext, "");
      if (!result?.ok) { pushLog(`Failed to create ${name}${ext}`,"error"); toast("Create failed — check console"); return; }
      activeGroup = name; S.activeGroups[tabLabel] = name;
      pushLog(`Created \\${folder}\\${name}${ext}`,"ok");
      toast(`Created ${name}${ext}`);
      build();
    }));

    if (activeGroup && Object.keys(S[stateKey]).length>1) {
      sidebar.appendChild(mkBtn("✕ Delete","dg sm", async ()=>{
        if (!confirm(`Delete "${activeGroup}"?`)) return;
        await api.fs.deleteFile(folder, activeGroup, ext);
        delete S[stateKey][activeGroup];
        activeGroup=Object.keys(S[stateKey])[0]||null;
        S.activeGroups[tabLabel]=activeGroup;
        build();
      }));
    }
    sl.appendChild(sidebar);

    const main = mk("div","sidebar-main");
    const card = mk("div","card full-card");
    const hdr  = mk("div","card-hdr file-hdr");
    hdr.innerHTML = `<span>${activeGroup||"—"}</span>
      <span style="color:${C.textDim};font-weight:400;margin-left:5px">— \\${folder}\\${activeGroup||""}${ext}</span>`;

    let saveTimer = null;
    const saveBtn = mkBtn("Save","pr sm", async ()=>{
      if (!activeGroup) return;
      await api.fs.writeFile(folder, activeGroup, ext, S[stateKey][activeGroup]||"");
      toast(`Saved ${activeGroup}${ext}`);
    });
    const importBtn = mkBtn("↑ Import","sm", async ()=>{
      const r = await api.fs.importFile([{name:ext===".csv"?"CSV":"Text",extensions:[ext.replace(".","")]}]);
      if (!r) return;
      S[stateKey][activeGroup] = r.content;
      await api.fs.writeFile(folder, activeGroup, ext, r.content);
      toast("Imported"); build();
    });
    hdr.appendChild(saveBtn); hdr.appendChild(importBtn);
    card.appendChild(hdr);

    if (activeGroup !== null) {
      const hintEl = mk("div","info-dim");
      hintEl.style.cssText="padding:7px 13px;border-bottom:1px solid "+C.border;
      hintEl.textContent = hint;
      card.appendChild(hintEl);

      const ta = mk("textarea", `txt-editor${stateKey==="accounts"||stateKey==="precookies" ? " pv" : ""}`);
      ta.placeholder = ph;
      ta.value = S[stateKey][activeGroup] || "";
      ta.style.userSelect="text";
      ta.oninput = () => {
        S[stateKey][activeGroup] = ta.value;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async ()=>{
          await api.fs.writeFile(folder, activeGroup, ext, ta.value);
        }, 800);
      };
      card.appendChild(ta);
    }

    main.appendChild(card); sl.appendChild(main); p.appendChild(sl);
  }
  build();
}

// ── ENGINE TAB ────────────────────────────────────────────────────────────────
function renderEngine(p) {
  // ── live task-state tiles (click one to filter the console) ──────────────
  p.appendChild(buildStateTiles());
  const meta = mk("div","st-meta"); meta.innerHTML = statMetaHtml();
  p.appendChild(meta);

  // ── engine controls card ──────────────────────────────────────────────────
  const card = mk("div","card");
  const hdr  = mk("div","card-hdr"); hdr.textContent="Engine Controls";
  const body = mk("div","card-body");
  body.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center";

  const bStart  = mkBtn("▶ Start Engine","pr", async ()=>{
    const exePath = await api.engine.getExePath();
    pushLog(`Launching: ${exePath}`,"dim");
    const r = await api.engine.start();
    if (!r.ok) pushLog(`Error: ${r.err}`,"error");
    else setRunning((await api.engine.status()).running);
  });
  const bStop   = mkBtn("■ Stop Engine","dg", async ()=>{
    await api.engine.stop(); S.engineRunning=false; updateStatus();
    pushLog("Engine stopped","warn");
  });

  bStart.disabled = S.engineRunning;
  bStop.disabled  = !S.engineRunning;

  const bSettings = mkBtn("Engine path, webhook & IMAP →","sm", ()=>switchTab("settings"));
  [bStart, bStop, mk("div","spacer"), bSettings].forEach(b=>body.appendChild(b));
  card.appendChild(hdr); card.appendChild(body); p.appendChild(card);

  // ── quick-action command palette ──────────────────────────────────────────
  const qCard = mk("div","card");
  const qHdr  = mk("div","card-hdr"); qHdr.textContent = "Quick Commands";
  const qBody = mk("div","card-body");
  qBody.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center";

  // task group selector — populated from S.taskFiles keys
  const grpSelect = mk("select","finput");
  grpSelect.style.cssText="width:160px;padding:4px 8px;font-size:11px";
  Object.keys(S.taskFiles).forEach(name=>{
    const o=mk("option"); o.value=o.textContent=name; grpSelect.appendChild(o);
  });

  function notRunning() {
    pushLog("Engine not running — launch it first","warn"); toast("Engine not running");
  }

  async function sendCmd(num, label) {
    if (!S.engineRunning) { notRunning(); return; }
    await api.engine.send(num);
    pushLog(`> ${num}) ${label}`,"dim");
  }

  async function sendStop(num, label) {
    if (!S.engineRunning) { notRunning(); return; }
    // repeat 3× — engine may be mid-task and miss a single write
    pushLog(`> ${num}) ${label} (sending×3)…`,"dim");
    await api.engine.sendRepeat(num, 3, 350);
  }

  async function sendCmdWithGroup(num, label) {
    if (!S.engineRunning) { notRunning(); return; }
    const grp = grpSelect.value;
    if (!grp) { toast("No task group selected"); return; }
    pushLog(`> ${num}) ${label}: ${grp}`,"dim");
    // wait for the exact prompt the engine prints, then send group name
    await api.engine.sendThenWait(
      num,
      "Enter group name",   // exact string the engine prints
      grp,
      4000
    );
  }

  const cmds = [
    { label:"↺ Reload Data",    action: ()=>sendCmd("0","Reload User Data") },
    { label:"▶ Start All",      action: ()=>sendCmd("1","Start all tasks"),  cls:"pr" },
    { label:"■ Stop All",       action: ()=>sendStop("3","Stop all tasks"),  cls:"dg" },
    { label:"▶ Start Group →",  action: ()=>sendCmdWithGroup("2","Start task group") },
    { label:"■ Stop Group →",   action: ()=>sendCmdWithGroup("4","Stop task group"), cls:"dg" },
    { label:"▶ IMAP Clients",   action: ()=>sendCmd("7","Start IMAP clients") },
    { label:"🔍 Property View", action: ()=>sendCmd("8","Property view") },
  ];

  cmds.forEach(({ label, action, cls }) => {
    qBody.appendChild(mkBtn(label, cls||"", action));
  });

  // group selector sits between the group commands
  const grpWrap = mk("div");
  grpWrap.style.cssText="display:flex;align-items:center;gap:5px;margin-left:4px";
  const grpLbl = mk("span","info-dim"); grpLbl.textContent="Group:";
  grpWrap.appendChild(grpLbl); grpWrap.appendChild(grpSelect);
  // insert before "Start Group" button — find its index
  const startGrpBtn = qBody.children[3]; // 0=reload,1=startall,2=stopall,3=startgrp
  qBody.insertBefore(grpWrap, startGrpBtn);

  qCard.appendChild(qHdr); qCard.appendChild(qBody); p.appendChild(qCard);

  // ── scheduled starts ──────────────────────────────────────────────────────
  p.appendChild(buildScheduleCard());

  // ── console ───────────────────────────────────────────────────────────────
  const cw = mk("div","con-wrap");

  const ch = mk("div","con-hdr");
  ch.innerHTML=`<span>● Console</span>`;
  if (S.logFilter) {
    const t = STATE_TILES.find(x=>x.k===S.logFilter);
    const pill = mk("span","filter-pill", `${esc(t?.l||S.logFilter)} only ✕`);
    pill.style.setProperty("--c", T[S.logFilter]);
    pill.title = "Clear filter";
    pill.onclick = () => setLogFilter(null);
    ch.appendChild(pill);
  }
  ch.appendChild(mk("span","spacer"));
  const copyBtn = mkBtn("Copy All","sm", copyLogs);
  const clrBtn  = mkBtn("Clear","sm", ()=>{ S.log=[]; cb.innerHTML=""; });
  ch.appendChild(copyBtn); ch.appendChild(clrBtn);
  cw.appendChild(ch);

  // log body
  const cb = mk("div","con-body"); cb.id="con-body";
  cb.style.userSelect="text";
  const initFrag = document.createDocumentFragment();
  S.log.filter(passesFilter).slice(-DOM_CAP).forEach(l => initFrag.appendChild(logRow(l)));
  cb.appendChild(initFrag);
  cw.appendChild(cb);

  // ── stdin input bar ───────────────────────────────────────────────────────
  const inputBar = mk("div","con-input-bar");
  const prompt_  = mk("span","con-prompt"); prompt_.textContent = "stdin ›";
  const stdinInp = mk("input","con-stdin");
  stdinInp.placeholder = "Type a command or response and press Enter…";
  stdinInp.setAttribute("autocomplete","off");
  stdinInp.setAttribute("spellcheck","false");
  stdinInp.style.userSelect="text";

  // input history (↑/↓ to cycle)
  const history = []; let histIdx = -1;

  stdinInp.onkeydown = async e => {
    if (e.key==="Enter") {
      const val = stdinInp.value;
      // empty Enter is sent as a bare newline (for "Press ENTER to exit" prompts)
      if (!S.engineRunning) { toast("Engine not running"); return; }
      // echo to console
      const echoed = mk("div","ll");
      echoed.innerHTML=`<span class="lt">${nowStr()}</span><span class="lm dim">› ${esc(val)}</span>`;
      cb.appendChild(echoed);
      cb.scrollTop=cb.scrollHeight;
      // send to engine
      await api.engine.send(val);
      // history
      if (val.trim()) { history.unshift(val); if(history.length>50)history.pop(); }
      histIdx=-1;
      stdinInp.value="";
    } else if (e.key==="ArrowUp") {
      e.preventDefault();
      if (histIdx < history.length-1) { histIdx++; stdinInp.value=history[histIdx]; }
    } else if (e.key==="ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; stdinInp.value=history[histIdx]; }
      else { histIdx=-1; stdinInp.value=""; }
    }
  };

  const sendBtn = mkBtn("Send","pr sm", async ()=>{
    stdinInp.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  });
  sendBtn.style.flexShrink="0";

  inputBar.appendChild(prompt_);
  inputBar.appendChild(stdinInp);
  inputBar.appendChild(sendBtn);
  cw.appendChild(inputBar);

  p.appendChild(cw);
  setTimeout(()=>{ cb.scrollTop=cb.scrollHeight; },0);
}

// ── MODALS ────────────────────────────────────────────────────────────────────
const maskHook = u => String(u||"").replace(/(webhooks\/\d+\/)([\w-]{6})[\w-]+/, "$1$2••••");

function openWebhookModal() {
  const ov=mk("div","overlay"), m=mk("div","modal");
  const wh = S.webhook || {};
  m.innerHTML=`<div class="modal-title">Webhook Settings</div>
    <div class="info-dim" style="margin-bottom:12px;line-height:1.6">
      Your real Discord webhook. Checkouts are captured by routing the engine through
      MakeBot+'s local relay (Checkouts tab), which forwards everything to this URL.
    </div>`;
  const row=mk("div","form-row"); row.innerHTML=`<label>Discord Webhook URL</label>`;
  const inp=mk("input","finput"); inp.value=wh.realWebhook || S.webhookUrl || "";
  inp.placeholder="https://discord.com/api/webhooks/...";
  row.appendChild(inp); m.appendChild(row);
  const act=mk("div","modal-actions");
  act.appendChild(mkBtn("Cancel","",()=>ov.remove()));
  act.appendChild(mkBtn("Save","pr",async()=>{
    const r = await api.webhook.setReal(inp.value.trim());
    if (!r.ok) { toast(r.err); return; }
    S.webhookUrl = inp.value.trim();
    if (S.engineRunning) {
      // keep the engine pointed at the relay if it already was, otherwise at Discord
      const res = (S.webhook?.routed) ? await api.webhook.route() : await api.webhook.restore();
      toast(res.ok ? "Webhook updated in engine" : `Saved — ${res.err}`);
    } else toast("Webhook saved");
    S.webhook = await api.webhook.status();
    ov.remove();
  }));
  m.appendChild(act); ov.appendChild(m);
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
}

function openImapModal() {
  const ov=mk("div","overlay"), m=mk("div","modal");
  m.innerHTML=`<div class="modal-title">IMAP Settings</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
      <div class="form-row"><label>Host</label><input class="finput" id="ih" placeholder="imap.gmail.com"/></div>
      <div class="form-row"><label>Port</label><input class="finput" id="ip" value="993"/></div>
      <div class="form-row"><label>Email</label><input class="finput" id="ie" placeholder="user@gmail.com"/></div>
      <div class="form-row"><label>App Password</label><input class="finput" id="iw" type="password"/></div>
    </div>`;
  const act=mk("div","modal-actions");
  act.appendChild(mkBtn("Cancel","",()=>ov.remove()));
  act.appendChild(mkBtn("Connect","pr",async()=>{
    if(S.engineRunning) await api.engine.send("6");
    pushLog("IMAP configured","ok"); toast("IMAP configured"); ov.remove();
  }));
  m.appendChild(act); ov.appendChild(m);
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
}

// ── SCHEDULE CARD ─────────────────────────────────────────────────────────────
const DAYS = ["S","M","T","W","T","F","S"];
const fmtIn = ms => {
  if (ms == null) return "—";
  const d = Math.max(0, ms - Date.now()), h = Math.floor(d/36e5), m = Math.floor(d%36e5/6e4);
  return h >= 24 ? `in ${Math.floor(h/24)}d ${h%24}h` : h ? `in ${h}h ${m}m` : `in ${m}m`;
};

function fillScheduleList(list) {
  list.innerHTML = "";
  if (!S.schedules.length) {
    list.appendChild(mk("div","info-dim","No scheduled starts or stops. Add one below — the engine will be launched if it isn't running."));
    return;
  }
  [...S.schedules].sort((a,b)=>(a.nextRun??9e15)-(b.nextRun??9e15)).forEach(sc => {
    const isStop = sc.action === "stop";
    const r = mk("div",`sch-row${sc.enabled?"":" off"}`);
    const when = sc.repeat==="daily" ? (sc.days ? sc.days.map(d=>DAYS[d]).join("") : "Daily") : "Once";
    const actionTag = isStop ? `<span class="sch-action stop">STOP</span>` : `<span class="sch-action start">START</span>`;
    r.innerHTML = `<span class="sch-time">${esc(sc.time)}</span>
      ${actionTag}
      <span class="sch-grp">${esc(sc.group)} <span class="info-dim">· ${when}</span></span>
      <span class="sch-next" data-next="${sc.nextRun??""}">${sc.enabled ? fmtIn(sc.nextRun) : (sc.lastFired ? "fired "+esc(sc.lastFired.slice(5)) : "off")}</span>`;
    r.appendChild(mkBtn(sc.enabled?"Pause":"Enable","sm", ()=>api.schedule.toggle(sc.id)));
    if (isStop) {
      r.appendChild(mkBtn("■ Now","sm dg", async ()=>{ await api.schedule.stopNow(sc.group); toast(`Stopping ${sc.group}`); }));
    } else {
      r.appendChild(mkBtn("▶ Now","sm", async ()=>{ await api.schedule.runNow(sc.group); toast(`Starting ${sc.group}`); }));
    }
    r.appendChild(mkBtn("✕","sm dg", ()=>api.schedule.remove(sc.id)));
    list.appendChild(r);
  });
}

function buildScheduleCard() {
  const card = mk("div","card");
  const hdr  = mk("div","card-hdr"); hdr.textContent = "Task Scheduler";
  const body = mk("div","card-body");
  const list = mk("div","sch-list"); fillScheduleList(list);
  body.appendChild(list);

  // add form
  const form = mk("div","sch-form");
  const time = mk("input","finput"); time.type="time"; time.style.width="128px";
  const d = new Date(Date.now()+5*6e4); time.value = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  const grp = mk("select","finput"); grp.style.width="170px";
  Object.keys(S.taskFiles).forEach(n=>{ const o=mk("option"); o.value=o.textContent=n; grp.appendChild(o); });

  let action = "start";
  const actSeg = mk("div","seg");
  ["start","stop"].forEach(k=>{
    const label = k === "start" ? "▶ Start" : "■ Stop";
    const sp = mk("span", k===action?"on":"", label);
    sp.onclick = () => { action=k; $$("span",actSeg).forEach(x=>x.classList.toggle("on",x===sp)); };
    actSeg.appendChild(sp);
  });

  let repeat = "once"; const days = new Set([0,1,2,3,4,5,6]);
  const seg = mk("div","seg");
  const dayPick = mk("div","day-pick"); dayPick.style.display="none";
  ["once","daily"].forEach(k=>{
    const sp = mk("span", k===repeat?"on":"", k);
    sp.onclick = () => { repeat=k; $$("span",seg).forEach(x=>x.classList.toggle("on",x===sp)); dayPick.style.display = k==="daily"?"flex":"none"; };
    seg.appendChild(sp);
  });
  DAYS.forEach((l,i)=>{
    const sp = mk("span","on",l); sp.title = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i];
    sp.onclick = () => { days.has(i)?days.delete(i):days.add(i); sp.classList.toggle("on", days.has(i)); };
    dayPick.appendChild(sp);
  });

  const add = mkBtn("+ Schedule","pr sm", async ()=>{
    if (!time.value || !grp.value) { toast("Pick a time and group"); return; }
    if (repeat==="daily" && !days.size) { toast("Pick at least one day"); return; }
    const r = await api.schedule.save({ time: time.value, group: grp.value, action, repeat,
      days: repeat==="daily" && days.size<7 ? [...days].sort() : null });
    if (!r.ok) { toast(r.err); return; }
    toast(`Scheduled ${action} ${grp.value} at ${time.value}`);
  });

  [time, grp, actSeg, seg, dayPick, add].forEach(x=>form.appendChild(x));
  body.appendChild(form);
  body.appendChild(mk("div","info-dim",
    `Start: launch engine if needed → send 2 → group name. Stop: send 4 → group name. Runs while MakeBot+ is open.`));
  $$(".info-dim",body).slice(-1)[0].style.marginTop="8px";
  card.appendChild(hdr); card.appendChild(body);
  return card;
}

setInterval(() => {
  $$(".sch-next[data-next]").forEach(el => { const v = +el.dataset.next; if (v) el.textContent = fmtIn(v); });
}, 30_000);

// ── CHECKOUT CARDS ────────────────────────────────────────────────────────────
const fmtWhen = ts => {
  const d = new Date(ts), today = d.getTime() >= startOfToday();
  const t = d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  return today ? `Today ${t}` : `${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})} ${t}`;
};

function buildCoCard(co) {
  const card = mk("div",`co-card ${co.status}`);
  if (co._fresh) { card.classList.add("fresh"); co._fresh=false; }

  const imgWrap = mk("div","co-img-wrap");
  const setImg = url => {
    imgWrap.classList.remove("noimg");
    $$("img,.co-img-placeholder",imgWrap).forEach(x=>x.remove());
    const img = mk("img"); img.src=url; img.alt=co.product||"";
    img.onerror = ()=>{ img.remove(); imgWrap.classList.add("noimg"); imgWrap.appendChild(mk("span","co-img-placeholder","No Image")); };
    imgWrap.insertBefore(img, imgWrap.firstChild);
  };
  if (co.image) setImg(co.image);
  else {
    imgWrap.classList.add("noimg");
    imgWrap.appendChild(mk("span","co-img-placeholder", co.productUrl ? "Loading…" : "No Image"));
    ensureImage(co, setImg);
  }
  imgWrap.appendChild(mk("span",`co-status ${co.status}`, co.status==="other" ? esc(co.headline||"webhook").slice(0,22) : co.status));

  // order badge — top-left of product image
  if (co.order || co.hasOrder) {
    const oBadge = mk("span","co-badge order-badge","#");
    oBadge.title = co.order ? `Order ${co.order}` : "Order confirmed";
    imgWrap.appendChild(oBadge);
  }

  // setup badge (top-right gear icon)
  const hasSetup = co.hasSetup || co.fields?.some(f => /setup|initialized|init/i.test(f.name));
  if (hasSetup) {
    const sBadge = mk("span","co-badge setup-badge");
    sBadge.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;
    sBadge.title = "Setup detected";
    imgWrap.appendChild(sBadge);
  }

  card.appendChild(imgWrap);

  const body = mk("div","co-body");
  if (co.site) body.appendChild(mk("div","co-site", esc(co.site)));
  body.appendChild(mk("div","co-product", esc(co.product || co.headline || "Unknown product")));

  const meta = mk("div","co-meta");
  const pill = (text, cls="") => { if (text) meta.appendChild(mk("span",`co-pill ${cls}`, esc(text))); };
  if (co.size && !/default title/i.test(co.size)) pill(co.size, "size");
  pill(co.color);
  if (co.qty && co.qty !== "1") pill(`×${co.qty}`);
  if (co.order) pill(co.order.startsWith("#") ? co.order : `#${co.order}`, "order");
  body.appendChild(meta);

  const sub = [co.profile, co.account].filter(Boolean);
  if (sub.length) body.appendChild(mk("div","co-sub", sub.map(esc).join(" · ")));
  body.appendChild(mk("div","co-ts", fmtWhen(co.ts) + (co.source==="discord" ? " · via bot" : "")));

  card.appendChild(body);
  card.onclick = () => openCheckoutModal(co);
  return card;
}

async function openCheckoutModal(co) {
  const ov=mk("div","overlay"), m=mk("div","modal"); m.style.width="560px";
  m.appendChild(mk("div","modal-title", esc(co.product || co.headline || "Checkout")));
  if (co.image) {
    const img = mk("img"); img.src = co.image;
    img.style.cssText = "width:100%;max-height:220px;object-fit:contain;background:#f4f4f0;border-radius:5px;margin-bottom:14px";
    m.appendChild(img);
  }
  const kv = mk("div","kv");
  const rows = [["Product", co.product], ["Status", co.status], ["When", new Date(co.ts).toLocaleString()], ["Site", co.site],
    ["Size", co.size], ["Order", co.order], ["Profile", co.profile], ["Account", co.account],
    ["Mode", co.mode], ["Proxy", co.proxy], ["Source", co.source==="discord" ? "Discord bot" : "Local relay"]];
  const shown = new Set(rows.map(r=>r[0].toLowerCase()));
  (co.fields||[]).forEach(f => { if (!shown.has(f.name.toLowerCase())) rows.push([f.name, f.value]); });
  rows.forEach(([k,v]) => { if (!v) return; kv.appendChild(mk("div","k",esc(k))); kv.appendChild(mk("div", /profile|account|email|proxy/i.test(k) ? "v pv" : "v", esc(v))); });
  m.appendChild(kv);

  const act=mk("div","modal-actions");
  act.appendChild(mkBtn("Delete","dg sm", async ()=>{
    await api.checkouts.remove(co.id);
    S.checkouts = S.checkouts.filter(c=>c.id!==co.id);
    ov.remove(); renderTab(S.tab);
  }));
  act.appendChild(mk("div","spacer"));
  act.appendChild(mkBtn("Copy raw JSON","sm", async ()=>{
    const raw = await api.checkouts.raw(co.id);
    await api.clipboard.write(JSON.stringify(raw, null, 2)); toast("Embed JSON copied");
  }));
  if (co.orderUrl)   act.appendChild(mkBtn("Open order","sm", ()=>api.shell.open(co.orderUrl)));
  if (co.productUrl) act.appendChild(mkBtn("Open product","sm", ()=>api.shell.open(co.productUrl)));
  act.appendChild(mkBtn("Close","pr sm", ()=>ov.remove()));
  m.appendChild(act); ov.appendChild(m);
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
}

// ── CHECKOUTS TAB ─────────────────────────────────────────────────────────────
function coSummary(list) {
  const ok = list.filter(c=>c.status==="success");
  return {
    success: ok.length,
    declined: list.filter(c=>c.status==="declined").length,
    units: ok.reduce((a,c)=>a+(parseInt(c.qty)||1),0),
    products: new Set(ok.map(c=>c.product).filter(Boolean)).size,
    sites: new Set(ok.map(c=>c.site).filter(Boolean)).size,
  };
}

function refreshCoStats() {
  const box = $("#co-stats"); if (!box) return;
  const f = S.coFilter;
  // stats follow the date range but ignore the status/search filter
  const sm = coSummary(S.checkouts.filter(c => (f.range==="all" || (f.range==="today" ? c.ts>=startOfToday() : c.ts>=Date.now()-7*864e5))));
  box.innerHTML = "";
  [{v:sm.success,l:"Successful",hi:true},{v:sm.declined,l:"Declined"},{v:sm.units,l:"Units"},
   {v:sm.products,l:"Products"},{v:sm.sites,l:"Sites"}].forEach(x=>{
    const d=mk("div",`dash-stat${x.hi?" hi":""}`);
    d.innerHTML=`<div class="dash-stat-val">${x.v}</div><div class="dash-stat-lbl">${x.l}</div>`;
    box.appendChild(d);
  });
}

function fillWebhookPanel(panel) {
  const wh = S.webhook || {};
  const body = $(".card-body", panel); body.innerHTML = "";
  const line = (k, v, cls="") => { const r=mk("div","wh-line"); r.innerHTML=`<span class="wh-k">${k}</span><span class="wh-v ${cls}">${v}</span>`; body.appendChild(r); return r; };

  const relay = wh.relay || {};
  line("Local relay", relay.listening
    ? `<span class="okc">● listening</span> on 127.0.0.1:${relay.port} · ${relay.received||0} received · ${relay.forwarded||0} forwarded to Discord`
    : `<span class="badc">● not listening</span> ${esc(relay.lastError||"")}`);
  if (relay.lastError && relay.listening) line("Last relay error", esc(relay.lastError), "badc");

  line("Discord webhook", wh.realWebhook ? esc(maskHook(wh.realWebhook)) : `<span class="midc">unknown — start the engine once (read from menu option 5)</span>`);
  line("Engine sends to", !S.engineRunning ? `<span class="info-dim">engine not running</span>`
    : wh.engineWebhook ? (wh.routed ? `<span class="okc">MakeBot+ relay ✓</span>` : `${esc(maskHook(wh.engineWebhook))} <span class="midc">(direct — not captured)</span>`)
    : `<span class="info-dim">waiting for menu…</span>`);

  const btns = mk("div","wh-line");
  const route = mkBtn(wh.routed ? "Routed ✓" : "Route engine webhook through MakeBot+","pr sm", async ()=>{
    route.disabled = true;
    const r = await api.webhook.route();
    toast(r.ok ? "Engine now sends webhooks through MakeBot+" : r.err);
    S.webhook = await api.webhook.status(); fillWebhookPanel(panel);
  });
  route.disabled = !S.engineRunning || !wh.relayUrl || wh.routed;
  const restore = mkBtn("Restore direct Discord","sm", async ()=>{
    const r = await api.webhook.restore();
    toast(r.ok ? "Engine sends directly to Discord again" : r.err);
    S.webhook = await api.webhook.status(); fillWebhookPanel(panel);
  });
  restore.disabled = !S.engineRunning || !wh.routed;
  const copy = mkBtn("Copy relay URL","sm", async ()=>{ await api.clipboard.write(wh.relayUrl); toast("Relay URL copied — paste it into menu option 5"); });
  copy.disabled = !wh.relayUrl;
  [route, restore, copy].forEach(b=>btns.appendChild(b));
  body.appendChild(btns);

  body.appendChild(mk("div","info-dim",
    `Routing points the engine's webhook at this app. Each webhook is read for the dashboard, then forwarded unchanged to Discord, so Discord still gets every message.
     Note: the engine saves this setting. If you later run the engine without MakeBot+ open, click "Restore direct Discord" first or its webhooks will fail.`));
  $$(".info-dim",body).slice(-1)[0].style.cssText="margin:8px 0 10px;line-height:1.6";

  // bot fallback
  const bot = wh.bot || {};
  line("Fallback: Discord bot", bot.enabled
    ? (bot.ok ? `<span class="okc">● reading channel ${esc(bot.channelId||"")}</span> · ${bot.imported||0} imported` : `<span class="badc">● ${esc(bot.error||"connecting…")}</span>`)
    : `<span class="info-dim">off — only needed if the engine rejects the relay URL</span>`);
  const tokRow = mk("div","wh-line");
  const tok = mk("input","finput"); tok.type="password"; tok.style.width="320px";
  tok.placeholder = bot.hasToken ? "•••••••• (saved) — paste a new token to replace" : "Bot token (needs View Channel + Read Message History)";
  tokRow.appendChild(tok);
  tokRow.appendChild(mkBtn("Save token","sm", async ()=>{
    S.webhook = await api.webhook.setBotToken(tok.value); fillWebhookPanel(panel); toast(tok.value ? "Bot token saved" : "Bot disabled");
  }));
  if (bot.hasToken) tokRow.appendChild(mkBtn("Disable","sm dg", async ()=>{ S.webhook = await api.webhook.setBotToken(""); fillWebhookPanel(panel); }));
  body.appendChild(tokRow);
}

function exportCheckoutsCsv(list) {
  const cols = ["time","status","site","product","size","color","qty","order","profile","account","mode","productUrl","image"];
  const q = v => `"${String(v??"").replace(/"/g,'""')}"`;
  const csv = [cols.join(","), ...list.map(c => [new Date(c.ts).toISOString(),c.status,c.site,c.product,c.size,c.color,c.qty,c.order,c.profile,c.account,c.mode,c.productUrl,c.image].map(q).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = `checkouts-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}

function renderCheckouts(p) {
  // stats
  const st = mk("div","dash-header"); st.id = "co-stats"; p.appendChild(st);

  // toolbar
  const tb = mk("div","co-toolbar");
  const q = mk("input","finput"); q.placeholder="Search product, order #, profile…"; q.style.width="260px"; q.value=S.coFilter.q;
  q.oninput = () => { S.coFilter.q = q.value; drawGrid(); };
  tb.appendChild(q);
  const mkSeg = (key, opts) => {
    const seg = mk("div","seg");
    opts.forEach(([v,l]) => {
      const sp = mk("span", S.coFilter[key]===v?"on":"", l);
      sp.onclick = () => { S.coFilter[key]=v; $$("span",seg).forEach(x=>x.classList.toggle("on",x===sp)); drawGrid(); refreshCoStats(); };
      seg.appendChild(sp);
    });
    return seg;
  };
  tb.appendChild(mkSeg("status", [["success","Success"],["declined","Declined"],["all","All Checkouts"]]));
  tb.appendChild(mkSeg("range",  [["today","Today"],["7d","7 days"],["all","All time"]]));
  tb.appendChild(mk("div","spacer"));
  const whBtn = mkBtn("Webhook capture","sm", ()=>switchTab("settings"));
  tb.appendChild(whBtn);
  tb.appendChild(mkBtn("Export CSV","sm", ()=>exportCheckoutsCsv(S.checkouts.filter(coMatches))));
  tb.appendChild(mkBtn("Clear All","sm dg", async ()=>{
    if (!confirm("Delete all saved checkouts?")) return;
    await api.checkouts.clear(); S.checkouts=[]; renderTab("checkouts");
  }));
  p.appendChild(tb);

  // capture not set up yet → point at Settings
  if (!S.webhook?.routed && !S.checkouts.length) {
    const note = mk("div","card");
    const nb = mk("div","card-body"); nb.style.cssText = "display:flex;align-items:center;gap:12px";
    nb.appendChild(mk("div","info-dim","Checkouts appear here once the engine's webhook is routed through MakeBot+."));
    nb.appendChild(mk("div","spacer"));
    nb.appendChild(mkBtn("Set up webhook capture","pr sm", ()=>switchTab("settings")));
    note.appendChild(nb); p.appendChild(note);
  }

  // grid
  const grid = mk("div","co-grid"); grid.id="co-grid";
  p.appendChild(grid);

  function drawGrid() {
    grid.innerHTML = "";
    const list = S.checkouts.filter(coMatches);
    if (!list.length) {
      const empty = mk("div","co-empty"); empty.id="co-empty";
      empty.innerHTML = S.checkouts.length
        ? `<div class="co-empty-icon">⌕</div><div class="co-empty-lbl">No checkouts match</div>`
        : `<div class="co-empty-icon">🛒</div><div class="co-empty-lbl">Waiting for webhooks…</div>
           <div class="info-dim">Route the engine's webhook through MakeBot+ in Settings</div>`;
      grid.appendChild(empty);
      return;
    }
    list.slice(0, 400).forEach(co => grid.appendChild(buildCoCard(co)));
  }
  drawGrid();
  refreshCoStats();
}

// ── DASHBOARD (overview) ──────────────────────────────────────────────────────
function renderDashboard(p) {
  const allOk    = S.checkouts.filter(c => c.status === "success");
  const allDecl  = S.checkouts.filter(c => c.status === "declined");
  const today    = S.checkouts.filter(c => c.ts >= startOfToday());
  const smToday  = coSummary(today);
  const totalTasks = S.stats?.totalLoaded || 0;

  // ── stats header ───────────────────────────────────────────────────────────
  const header = mk("div","dash-header");
  [{v:totalTasks||"—",l:"Total Tasks"},{v:allOk.length+allDecl.length,l:"Checkout Attempts"},
   {v:allOk.length,l:"Successful Checkouts",hi:true},{v:smToday.success,l:"Today"},
   {v:S.engineRunning?"Running":"Idle",l:"Engine"}].forEach(x=>{
    const d=mk("div",`dash-stat${x.hi?" hi":""}`);
    d.innerHTML=`<div class="dash-stat-val">${x.v}</div><div class="dash-stat-lbl">${x.l}</div>`;
    header.appendChild(d);
  });
  p.appendChild(header);

  // ── live task tiles → click goes to engine ─────────────────────────────────
  const tiles = buildStateTiles({ clickable:false });
  $$(".st-tile",tiles).forEach(t => t.onclick = () => { S.logFilter = t.dataset.st; switchTab("engine"); });
  p.appendChild(tiles);
  const meta = mk("div","st-meta"); meta.innerHTML = statMetaHtml(); p.appendChild(meta);

  // ── calendar + day-detail side-by-side ───────────────────────────────────────
  const dashRow = mk("div","dash-row");

  // ── right: day detail panel (built first so calendar can reference it) ─────
  const dayCard = mk("div","card dash-day-card");
  const dayHdr = mk("div","card-hdr"); dayHdr.id = "dash-day-hdr"; dayHdr.textContent = "Select a day"; dayCard.appendChild(dayHdr);
  const dayBody = mk("div","card-body dash-day-body"); dayBody.id = "dash-day-body";
  dayBody.appendChild(mk("div","dash-day-empty","Click a day on the calendar to see checkouts"));
  dayCard.appendChild(dayBody);

  let selectedDay = null;

  function showDayDetail(day) {
    selectedDay = day;
    dayBody.innerHTML = "";
    const dayStart = new Date(calYear, calMonth, day).getTime();
    const dayEnd   = new Date(calYear, calMonth, day + 1).getTime();
    // dashboard only shows successful checkouts
    const dayCheckouts = S.checkouts.filter(c => c.status === "success" && c.ts >= dayStart && c.ts < dayEnd).sort((a,b) => b.ts - a.ts);

    const dateStr = new Date(calYear, calMonth, day).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
    dayHdr.textContent = `${dateStr} — ${dayCheckouts.length} checkout${dayCheckouts.length!==1?"s":""}`;

    if (!dayCheckouts.length) {
      dayBody.appendChild(mk("div","dash-day-empty","No successful checkouts this day"));
      return;
    }

    dayCheckouts.forEach(co => {
      const row = mk("div","dash-day-item");

      // thumbnail
      if (co.image) {
        const img = mk("img"); img.src = co.image; img.alt = co.product || "";
        img.onerror = () => { img.replaceWith(Object.assign(mk("div","noimg"), { textContent: "—" })); };
        row.appendChild(img);
      } else {
        row.appendChild(Object.assign(mk("div","noimg"), { textContent: "—" }));
      }

      // info
      const info = mk("div","dash-day-info");
      info.appendChild(mk("div","dash-day-prod", esc(co.product || co.headline || "Unknown")));
      const parts = [co.site, co.size && !/default title/i.test(co.size) ? co.size : null, co.color].filter(Boolean);
      if (parts.length) info.appendChild(mk("div","dash-day-sub", parts.map(esc).join(" · ")));
      const tParts = [new Date(co.ts).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})];
      if (co.profile || co.account) tParts.push(co.profile || co.account);
      info.appendChild(mk("div","dash-day-ts", tParts.map(esc).join(" · ")));
      row.appendChild(info);

      row.onclick = () => openCheckoutModal(co);
      dayBody.appendChild(row);
    });
  }

  // ── left: checkout calendar ────────────────────────────────────────────────
  const calCard = mk("div","card dash-cal-card");
  const calHdr = mk("div","card-hdr dash-cal-hdr");
  calHdr.innerHTML = `<span>Checkouts by Day</span>`;
  const backfillBtn = mkBtn("↓ Backfill","sm", async () => {
    backfillBtn.disabled = true;
    backfillBtn.textContent = "Scanning…";
    const res = await api.checkouts.backfill({ maxPages: 20 });
    if (res.ok) {
      toast(`Backfill complete: scanned ${res.totalScanned} messages, imported ${res.totalImported} checkouts`);
      pushLog(`Backfill: ${res.totalImported} checkouts imported from ${res.pages} pages (${res.totalScanned} messages scanned)`, res.totalImported ? "ok" : "info");
      S.checkouts = await api.checkouts.list();
      renderTab("dashboard");
    } else {
      toast(res.error || "Backfill failed");
      backfillBtn.disabled = false;
      backfillBtn.textContent = "↓ Backfill";
    }
  });
  backfillBtn.title = "Scrape Discord channel history for past checkout webhooks";
  calHdr.appendChild(backfillBtn);
  calCard.appendChild(calHdr);
  const calBody = mk("div","card-body");
  const calWrap = mk("div","dash-cal-wrap");

  const now = new Date();
  let calMonth = now.getMonth(), calYear = now.getFullYear();

  function drawCal() {
    calWrap.innerHTML = "";
    const first = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startDay = first.getDay();
    const monthName = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // count only successful checkouts per day
    const dayCounts = {};
    S.checkouts.filter(c => c.status === "success").forEach(c => {
      const d = new Date(c.ts);
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
        const day = d.getDate();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    });
    const maxCount = Math.max(1, ...Object.values(dayCounts));

    const navRow = mk("div","cal-nav");
    const prevBtn = mk("button","btn sm","◀");
    prevBtn.onclick = () => { calMonth--; if (calMonth<0){calMonth=11;calYear--;} selectedDay=null; drawCal(); dayHdr.textContent="Select a day"; dayBody.innerHTML=""; dayBody.appendChild(mk("div","dash-day-empty","Click a day on the calendar to see checkouts")); };
    const nextBtn = mk("button","btn sm","▶");
    nextBtn.onclick = () => { calMonth++; if (calMonth>11){calMonth=0;calYear++;} selectedDay=null; drawCal(); dayHdr.textContent="Select a day"; dayBody.innerHTML=""; dayBody.appendChild(mk("div","dash-day-empty","Click a day on the calendar to see checkouts")); };
    const label = mk("span","cal-month-lbl",monthName);
    navRow.appendChild(prevBtn); navRow.appendChild(label); navRow.appendChild(nextBtn);
    calWrap.appendChild(navRow);

    const hdrRow = mk("div","cal-grid cal-hdr-row");
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => hdrRow.appendChild(mk("div","cal-cell cal-day-hdr",d)));
    calWrap.appendChild(hdrRow);

    const grid = mk("div","cal-grid");
    for (let i = 0; i < startDay; i++) grid.appendChild(mk("div","cal-cell empty"));
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = mk("div","cal-cell");
      const isToday = d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
      if (isToday) cell.classList.add("today");
      if (d === selectedDay) cell.classList.add("selected");
      const count = dayCounts[d] || 0;
      if (count > 0) {
        cell.classList.add("has-co");
        cell.style.cursor = "pointer";
        const intensity = Math.min(1, count / maxCount);
        cell.style.setProperty("--co-intensity", intensity);
        cell.onclick = () => { selectedDay = d; drawCal(); showDayDetail(d); };
      }
      cell.innerHTML = `<span class="cal-day-num">${d}</span>${count ? `<span class="cal-count">${count}</span>` : ""}`;
      grid.appendChild(cell);
    }
    calWrap.appendChild(grid);

    const legend = mk("div","cal-legend");
    legend.innerHTML = `<span class="cal-legend-dot has-co"></span> Has checkouts`;
    calWrap.appendChild(legend);

    // Jump to Today button (show only when not viewing current month)
    const isCurrentMonth = calMonth === now.getMonth() && calYear === now.getFullYear();
    if (!isCurrentMonth) {
      const jumpBtn = mkBtn("↩ Jump to Today","sm", () => {
        calMonth = now.getMonth(); calYear = now.getFullYear();
        selectedDay = now.getDate(); drawCal(); showDayDetail(now.getDate());
      });
      jumpBtn.style.marginTop = "8px";
      calWrap.appendChild(jumpBtn);
    }
  }
  drawCal();
  calBody.appendChild(calWrap);
  calCard.appendChild(calBody);
  dashRow.appendChild(calCard);
  dashRow.appendChild(dayCard);
  p.appendChild(dashRow);

  // auto-select today if it has successful checkouts
  const todayOk = S.checkouts.filter(c => c.status === "success").filter(c => { const d = new Date(c.ts); return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  if (todayOk.length) { selectedDay = now.getDate(); drawCal(); showDayDetail(now.getDate()); }

  // ── recent successful checkouts (compact product cards) ────────────────────
  const prodCard = mk("div","card");
  const prodHdr = mk("div","card-hdr"); prodHdr.innerHTML = `<span>Recent Checkouts</span><span class="spacer"></span>`;
  prodHdr.appendChild(mkBtn("View all →","sm", ()=>switchTab("checkouts")));
  prodCard.appendChild(prodHdr);
  const prodBody = mk("div","card-body");
  const recent = allOk.slice(0, 6);
  if (!recent.length) {
    prodBody.appendChild(mk("div","info-dim", S.webhook?.routed
      ? "No checkouts yet — they'll appear here the moment the engine sends a webhook."
      : "Checkout capture isn't set up yet — open Settings and route the engine's webhook through MakeBot+."));
  } else {
    const prodGrid = mk("div","dash-prod-grid");
    recent.forEach(co => {
      const pc = mk("div","dash-prod-card");
      pc.onclick = () => openCheckoutModal(co);
      if (co.image) {
        const img = mk("img"); img.src = co.image; img.alt = co.product || "";
        img.onerror = () => img.remove();
        pc.appendChild(img);
      }
      const info = mk("div","dash-prod-info");
      info.appendChild(mk("div","dash-prod-name", esc(co.product || "Unknown")));
      const sub = [co.site, co.qty && co.qty !== "1" ? `×${co.qty}` : null].filter(Boolean).join(" · ");
      if (sub) info.appendChild(mk("div","dash-prod-sub", esc(sub)));
      const acct = [co.profile, co.account].filter(Boolean).join(" · ");
      if (acct) info.appendChild(mk("div","dash-prod-acct pv", esc(acct)));
      info.appendChild(mk("div","dash-prod-ts", fmtWhen(co.ts)));
      pc.appendChild(info);
      if (co.qty) {
        const qBadge = mk("div","dash-prod-qty"); qBadge.textContent = co.qty;
        pc.appendChild(qBadge);
      }
      prodGrid.appendChild(pc);
    });
    prodBody.appendChild(prodGrid);
  }
  prodCard.appendChild(prodBody); p.appendChild(prodCard);

  // ── schedules ──────────────────────────────────────────────────────────────
  p.appendChild(buildScheduleCard());
}

// ── RENDER DISPATCH ───────────────────────────────────────────────────────────
function renderTab(t) {
  const p = panes[t]; p.innerHTML = "";
  if      (t==="dashboard") renderDashboard(p);
  else if (t==="checkouts") renderCheckouts(p);
  else if (t==="taskgroups") renderTaskGroups(p);
  else if (t==="tasks")    renderTasks(p);
  else if (t==="profiles") renderProfilesTab(p);

  else if (t==="proxies")  renderTextTab(p,{ stateKey:"proxies",   folder:"proxy",     ext:".txt", hint:"host:port:user:pass — one per line", ph:"proxy.host.com:8080:user:pass", tabLabel:"proxies" });
  else if (t==="precookie")renderTextTab(p,{ stateKey:"precookies",folder:"precookie", ext:".txt", hint:"Accounts needing pre-cookie: email:password", ph:"user@example.com:password123", tabLabel:"precookie" });
  else if (t==="accounts") renderTextTab(p,{ stateKey:"accounts",  folder:"account",   ext:".txt", hint:"email:password — one per line", ph:"user@gmail.com:password123", tabLabel:"accounts" });
  else if (t==="engine")   renderEngine(p);
  else if (t==="settings") renderSettings(p);
  setHeader(t);
}

// ── SETTINGS (existing controls, gathered in one place) ───────────────────────
function setRow(k, sub, ...controls) {
  const r = mk("div","set-row");
  const kd = mk("div","set-k"); kd.innerHTML = `<b>${esc(k)}</b>${sub ? `<span>${sub}</span>` : ""}`;
  r.appendChild(kd); controls.forEach(c => c && r.appendChild(c));
  return r;
}
function mkSwitch(on, onChange) {
  const b = mk("button", `switch${on ? " on" : ""}`);
  b.onclick = () => { b.classList.toggle("on"); onChange(b.classList.contains("on")); };
  return b;
}
function renderSettings(p) {
  const grid = mk("div","set-grid");

  // Engine
  const eng = mk("div","card");
  eng.appendChild(mk("div","card-hdr","Engine"));
  const eb = mk("div","card-body");
  const pathSub = mk("span"); pathSub.className = "mono"; pathSub.textContent = S.engineExePath || "engine\\make-engine.exe";
  const pathRow = setRow("Engine executable", "",
    mkBtn("Set path","sm", async ()=>{
      const picked = await api.engine.pickExe();
      if (picked) {
        S.engineExePath = picked; pathSub.textContent = picked; updateStatus();
        pushLog(`Engine path set: ${picked}`,"ok"); toast("Engine path saved");
      }
    }),
    mkBtn("Open folder","sm", ()=>api.fs.openEngineDir()));
  $(".set-k", pathRow).appendChild(pathSub);
  eb.appendChild(pathRow);
  eb.appendChild(setRow("Discord webhook", "The webhook the engine posts to (menu option 5)", mkBtn("Edit","sm", ()=>openWebhookModal())));
  eb.appendChild(setRow("IMAP", "Mail settings the engine uses (menu option 6)", mkBtn("Edit","sm", ()=>openImapModal())));
  eng.appendChild(eb);
  grid.appendChild(eng);

  // Appearance
  const ap = mk("div","card");
  ap.appendChild(mk("div","card-hdr","Appearance"));
  const ab = mk("div","card-body");
  const seg = mk("div","seg");
  [["dark","Dark"],["light","Light"]].forEach(([v,l]) => {
    const sp = mk("span", (document.documentElement.dataset.theme || "dark") === v ? "on" : "", l);
    sp.onclick = () => { applyTheme(v); paintToggles(); renderTab("settings"); };
    seg.appendChild(sp);
  });
  ab.appendChild(setRow("Theme", "Also on the sun / moon button in the top bar", seg));
  ab.appendChild(setRow("Hide personal details", "Blurs emails, addresses, phone and card fields, account passwords and checkout profiles until you click or hover them",
    mkSwitch(document.body.classList.contains("privacy"), on => { applyPrivacy(on); paintToggles(); })));
  ap.appendChild(ab);
  grid.appendChild(ap);
  p.appendChild(grid);

  // Updates
  const upd = mk("div","card");
  upd.appendChild(mk("div","card-hdr","Updates"));
  const ub = mk("div","card-body");
  const updStatus = mk("span","mono");
  if (updateState.state === "current")       updStatus.textContent = "You're on the latest version";
  else if (updateState.state === "checking") updStatus.textContent = "Checking for updates…";
  else if (updateState.state === "downloading") updStatus.textContent = `Downloading v${updateState.version || ""}… ${updateState.percent||0}%`;
  else if (updateState.state === "ready")    updStatus.textContent = `v${updateState.version} ready — restart to apply`;
  else if (updateState.state === "error")    updStatus.textContent = updateState.error || "Update check failed";
  else updStatus.textContent = "Auto-updater inactive (dev mode)";
  const checkBtn = mkBtn("Check for updates","sm", () => { if (api.updater) { api.updater.check(); toast("Checking…"); } });
  ub.appendChild(setRow("Auto-update", "MakeBot+ checks GitHub for new releases on launch", checkBtn));
  $(".set-k", ub.lastChild)?.appendChild(updStatus);
  if (updateState.state === "ready") {
    ub.appendChild(setRow("", "", mkBtn("Restart & Update","pr sm", () => api.updater.install())));
  }
  upd.appendChild(ub);
  grid.appendChild(upd);

  // Webhook capture (same panel that used to sit on the Checkouts tab)
  const panel = mk("div","card"); panel.id = "wh-panel";
  panel.appendChild(mk("div","card-hdr","Webhook capture"));
  panel.appendChild(mk("div","card-body"));
  fillWebhookPanel(panel);
  p.appendChild(panel);
}

// ── FS INIT ───────────────────────────────────────────────────────────────────
async function loadGroups(folder, key, ext) {
  const groups = await api.fs.listGroup(folder);
  S[key] = {};
  for (const g of groups) {
    S[key][g] = await api.fs.readFile(folder, g, ext);
  }
}

async function init() {
  try {
    await loadGroups("task",      "taskFiles",  ".csv");
    await loadGroups("proxy",     "proxies",    ".txt");
    await loadGroups("profile",   "profiles",   ".csv");
    await loadGroups("account",   "accounts",   ".txt");
    await loadGroups("precookie", "precookies", ".txt");
  } catch(e) { pushLog(`FS init: ${e.message}`,"error"); }

  if (!Object.keys(S.taskFiles).length)  S.taskFiles  = { example_tasks: TASK_COLS.map(c=>c.k).join(",") };
  if (!Object.keys(S.proxies).length)    S.proxies    = { example:"" };
  if (!Object.keys(S.profiles).length)   S.profiles   = { example:"" };
  if (!Object.keys(S.accounts).length)   S.accounts   = { example:"" };
  if (!Object.keys(S.precookies).length) S.precookies = { example:"" };

  S.engineExePath = await api.engine.getExePath();
  try {
    S.checkouts = await api.checkouts.list();
    S.schedules = await api.schedule.list();
    S.webhook   = await api.webhook.status();
    const info  = await api.engine.info();
    S.stats     = info.stats || {};
  } catch(e) { pushLog(`Init: ${e.message}`,"error"); }
  const status = await api.engine.status();
  S.engineRunning = status.running;
  updateStatus();
  renderTab(S.tab);
}

// ── AUTO-UPDATER UI ──────────────────────────────────────────────────────────
const updateBar = mk("div","update-bar");
updateBar.innerHTML = `<span class="update-msg"></span>`;
document.body.appendChild(updateBar);

let updateState = { state: "current" };
if (api.updater) {
  api.updater.onStatus(status => {
    updateState = status;
    const msg = $(".update-msg", updateBar);
    if (status.state === "ready") {
      msg.textContent = `MakeBot+ v${status.version} is ready to install`;
      if (!$("button", updateBar)) {
        const btn = document.createElement("button");
        btn.textContent = "Restart & Update";
        btn.onclick = () => api.updater.install();
        updateBar.appendChild(btn);
      }
      updateBar.classList.add("show");
    } else if (status.state === "downloading" && status.percent) {
      msg.textContent = `Downloading update… ${status.percent}%`;
      updateBar.classList.add("show");
    } else {
      updateBar.classList.remove("show");
    }
    // refresh settings page if visible
    if (S.tab === "settings") renderTab("settings");
  });
}

init().catch(e => {
  document.getElementById("root").innerHTML =
    `<div style="color:#c45454;font-family:monospace;padding:40px;white-space:pre">Init error:\n${e.stack||e}</div>`;
});

} // end App()
