const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close:    () => ipcRenderer.send("window:close"),
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke("clipboard:write", text),
  },
  engine: {
    start:      ()    => ipcRenderer.invoke("engine:start"),
    stop:       ()    => ipcRenderer.invoke("engine:stop"),
    send:         (cmd)                              => ipcRenderer.invoke("engine:send", cmd),
    sendThenWait: (cmd, patternStr, followUp, ms)   => ipcRenderer.invoke("engine:sendThenWait", { cmd, patternStr, followUp, timeoutMs: ms }),
    sendRepeat:   (cmd, times, delayMs)              => ipcRenderer.invoke("engine:sendRepeat",   { cmd, times, delayMs }),
    status:       ()                                 => ipcRenderer.invoke("engine:status"),
    pickExe:    ()    => ipcRenderer.invoke("engine:pickExe"),
    getExePath: ()    => ipcRenderer.invoke("engine:getExePath"),
    onLog:     (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("engine:log",     h); return ()=>ipcRenderer.off("engine:log",     h); },
    onStarted: (cb) => { const h=()=>cb();     ipcRenderer.on("engine:started", h); return ()=>ipcRenderer.off("engine:started", h); },
    onReady:   (cb) => { const h=()=>cb();     ipcRenderer.on("engine:ready",   h); return ()=>ipcRenderer.off("engine:ready",   h); },
    onStopped: (cb) => { const h=()=>cb();     ipcRenderer.on("engine:stopped", h); return ()=>ipcRenderer.off("engine:stopped", h); },
    onStats:   (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("engine:stats",   h); return ()=>ipcRenderer.off("engine:stats",   h); },
    onMenu:    (cb) => { const h=()=>cb();     ipcRenderer.on("engine:menu",    h); return ()=>ipcRenderer.off("engine:menu",    h); },
    info:      ()   => ipcRenderer.invoke("engine:info"),
  },
  checkouts: {
    list:     ()          => ipcRenderer.invoke("checkouts:list"),
    raw:      (id)        => ipcRenderer.invoke("checkouts:raw", id),
    clear:    ()          => ipcRenderer.invoke("checkouts:clear"),
    remove:   (id)        => ipcRenderer.invoke("checkouts:remove", id),
    setImage: (id, image) => ipcRenderer.invoke("checkouts:setImage", { id, image }),
    onNew:     (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("checkouts:new",     h); return ()=>ipcRenderer.off("checkouts:new",     h); },
    onUpdated: (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("checkouts:updated", h); return ()=>ipcRenderer.off("checkouts:updated", h); },
    backfill:  (opts) => ipcRenderer.invoke("checkouts:backfill", opts),
    onBackfillProgress: (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("checkouts:backfillProgress", h); return ()=>ipcRenderer.off("checkouts:backfillProgress", h); },
    onBackfillDone:     (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("checkouts:backfillDone",     h); return ()=>ipcRenderer.off("checkouts:backfillDone",     h); },
  },
  webhook: {
    status:      ()      => ipcRenderer.invoke("webhook:status"),
    route:       ()      => ipcRenderer.invoke("webhook:route"),
    restore:     ()      => ipcRenderer.invoke("webhook:restore"),
    setReal:     (url)   => ipcRenderer.invoke("webhook:setReal", url),
    setBotToken: (token) => ipcRenderer.invoke("webhook:setBotToken", token),
    onStatus:  (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("webhook:status", h); return ()=>ipcRenderer.off("webhook:status", h); },
  },
  schedule: {
    list:   ()      => ipcRenderer.invoke("schedule:list"),
    save:   (s)     => ipcRenderer.invoke("schedule:save", s),
    remove: (id)    => ipcRenderer.invoke("schedule:remove", id),
    toggle: (id)    => ipcRenderer.invoke("schedule:toggle", id),
    runNow:  (group) => ipcRenderer.invoke("schedule:runNow", group),
    stopNow: (group) => ipcRenderer.invoke("schedule:stopNow", group),
    onChanged: (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("schedule:changed", h); return ()=>ipcRenderer.off("schedule:changed", h); },
  },
  shell: {
    open: (url) => ipcRenderer.invoke("shell:open", url),
  },
  updater: {
    onStatus: (cb) => { const h=(_,d)=>cb(d); ipcRenderer.on("updater:status", h); return ()=>ipcRenderer.off("updater:status", h); },
    check:    ()   => ipcRenderer.invoke("updater:check"),
    install:  ()   => ipcRenderer.invoke("updater:install"),
  },
  config: {
    getGhToken: ()      => ipcRenderer.invoke("config:getGhToken"),
    setGhToken: (token) => ipcRenderer.invoke("config:setGhToken", token),
  },
  ws: {
    info: () => ipcRenderer.invoke("ws:info"),
  },
  fetch: {
    ogImage: (url) => ipcRenderer.invoke("fetch:ogImage", url),
  },
  fs: {
    listGroup:     (folder)                     => ipcRenderer.invoke("fs:listGroup",    { folder }),
    readFile:      (folder, name, ext)          => ipcRenderer.invoke("fs:readFile",     { folder, name, ext }),
    writeFile:     (folder, name, ext, content) => ipcRenderer.invoke("fs:writeFile",    { folder, name, ext, content }),
    deleteFile:    (folder, name, ext)          => ipcRenderer.invoke("fs:deleteFile",   { folder, name, ext }),
    importFile:    (filters)                    => ipcRenderer.invoke("fs:importFile",   { filters }),
    openEngineDir: ()                           => ipcRenderer.invoke("fs:openEngineDir"),
  },
});
