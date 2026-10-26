// ── MakeBot+ auto-updater ─────────────────────────────────────────────────────
// Uses electron-updater to check GitHub Releases for new versions.
// On launch: checks silently → downloads in background → notifies renderer.
// The user sees a toast + "Restart to update" button.

const { autoUpdater } = require("electron-updater");
const { ipcMain }     = require("electron");
const path            = require("path");
const fs              = require("fs");

let win = null;

function init(mainWindow) {
  win = mainWindow;

  // Don't auto-install on download — let user choose when to restart
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Suppress default error dialogs
  autoUpdater.logger = null;

  // Private repo — read GH_TOKEN from config so updater can authenticate
  try {
    const cfgPath = path.join(require("electron").app.getPath("userData"), "config.json");
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (cfg.ghToken) {
        autoUpdater.requestHeaders = { Authorization: `token ${cfg.ghToken}` };
        process.env.GH_TOKEN = cfg.ghToken;
      }
    }
  } catch {}


  autoUpdater.on("checking-for-update", () => {
    send("updater:status", { state: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    send("updater:status", {
      state: "downloading",
      version: info.version,
      releaseNotes: info.releaseNotes || "",
    });
  });

  autoUpdater.on("update-not-available", () => {
    send("updater:status", { state: "current" });
  });

  autoUpdater.on("download-progress", (prog) => {
    send("updater:status", {
      state: "downloading",
      percent: Math.round(prog.percent),
      speed: prog.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("updater:status", {
      state: "ready",
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    // Silently ignore update errors — not critical
    send("updater:status", { state: "error", error: err?.message || "Update check failed" });
  });

  // IPC: renderer asks to install now
  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // IPC: renderer asks to check manually
  ipcMain.handle("updater:check", () => {
    autoUpdater.checkForUpdates().catch(() => {});
  });

  // Check on launch (wait a few seconds so the window loads first)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

function send(channel, data) {
  try { win?.webContents?.send(channel, data); } catch {}
}

module.exports = { init };
