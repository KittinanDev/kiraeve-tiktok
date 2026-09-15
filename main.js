const { app, BrowserWindow, Tray, Menu, shell, dialog, clipboard, ipcMain } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

// อนุญาตให้เล่นเสียง Audio/TTS อัตโนมัติใน Electron โดยไม่ต้องรอ User Gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// ป้องกันปัญหาหน้าต่างกระพริบ (Flickering / Stuttering) บนการ์ดจอ Windows บางรุ่น
app.commandLine.appendSwitch("disable-gpu-compositing");

// ============================================================
// Single Instance Lock (ป้องกันการเปิดโปรแกรมซ้อนกันหลายตัว)
// ============================================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ============================================================
// Auto-Updater (electron-updater + GitHub Releases)
// ============================================================
const { autoUpdater } = require("electron-updater");

// ตั้งค่า: ไม่ดาวน์โหลดอัตโนมัติ — ให้ผู้ใช้กดเองผ่าน Dashboard
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Log ข้อมูลการอัปเดตไปยัง console (เพื่อ debug)
autoUpdater.logger = require("electron").session;
autoUpdater.logger = console;

// ============================================================

const PORT = 8765;
const SERVER_URL = `http://localhost:${PORT}/`;
const OVERLAY_URL = `http://localhost:${PORT}/overlay.html`;

// เมื่อ build เป็น .exe แล้ว server.py ฯลฯ จะถูกก็อปไปไว้ที่ resources/app (ดู extraResources ใน package.json)
const PROJECT_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "app")
  : __dirname;

let pyProc = null;
let mainWindow = null;
let tray = null;
let quitting = false;

// ------------------------------------------------------------------
// Helper: ส่ง Updater Event ไปยัง Dashboard renderer
// ------------------------------------------------------------------
function sendUpdateStatus(event, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater-event", { event, ...payload });
  }
}

// ------------------------------------------------------------------
// Auto-Updater Event Handlers
// ------------------------------------------------------------------
autoUpdater.on("checking-for-update", () => {
  sendUpdateStatus("checking");
});

autoUpdater.on("update-available", (info) => {
  sendUpdateStatus("update-available", {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes || "",
  });
});

autoUpdater.on("update-not-available", (info) => {
  sendUpdateStatus("up-to-date", { version: info.version });
});

autoUpdater.on("download-progress", (progress) => {
  sendUpdateStatus("downloading", {
    percent: Math.round(progress.percent),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  });
});

autoUpdater.on("update-downloaded", (info) => {
  sendUpdateStatus("downloaded", {
    version: info.version,
    releaseNotes: info.releaseNotes || "",
  });
});

autoUpdater.on("error", (err) => {
  sendUpdateStatus("error", { message: err.message });
});

// ------------------------------------------------------------------
// IPC Handlers (รับคำสั่งจาก Dashboard)
// ------------------------------------------------------------------
ipcMain.handle("updater:check", async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("updater:download", async () => {
  try {
    autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("updater:install", () => {
  quitting = true;
  console.log("[updater] Preparing to quit and install: cleaning up child processes...");
  if (tray) {
    try { tray.destroy(); } catch (_) {}
    tray = null;
  }
  if (pyProc) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${pyProc.pid}`, { windowsHide: true });
      } else {
        pyProc.kill("SIGKILL");
      }
    } catch (_) {}
    pyProc = null;
  }
  killPortOccupant(PORT);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.destroy(); } catch (_) {}
    mainWindow = null;
  }
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 500);
});

ipcMain.handle("updater:get-version", () => {
  return app.getVersion();
});

// ------------------------------------------------------------------

function findPython() {
  const embeddedPython = path.join(PROJECT_DIR, "python_embed", "python.exe");
  if (fs.existsSync(embeddedPython)) {
    return embeddedPython;
  }
  const candidates = process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];
  return candidates[0];
}

function killPortOccupant(port) {
  if (process.platform !== "win32") return;
  try {
    const stdout = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", windowsHide: true });
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      // Example line: TCP 127.0.0.1:8765 0.0.0.0:0 LISTENING 1234
      if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid && pid !== process.pid) {
          console.log(`[main] Killing conflicting process on port ${port} (PID: ${pid})`);
          try {
            execSync(`taskkill /F /PID ${pid}`, { windowsHide: true });
          } catch (_) {}
        }
      }
    }
  } catch (_) {
    // findstr exits with code 1 if no matching port found
  }
}

let lastServerStderr = "";

function startServer() {
  // เคลียร์ process เก่าที่อาจค้างอยู่ที่ port 8765 ก่อนเสมอ
  killPortOccupant(PORT);

  const pythonExe = process.env.NPC_OVERLAY_PYTHON || findPython();
  const embeddedDir = path.join(PROJECT_DIR, "python_embed");
  lastServerStderr = "";

  // เพิ่ม python_embed เข้า PATH เพื่อให้คำสั่ง 'node' และโมดูลทำงานได้สมบูรณ์ในเครื่องปลายทาง
  const customPath = fs.existsSync(embeddedDir)
    ? `${embeddedDir};${process.env.PATH}`
    : process.env.PATH;

  console.log(`[main] Launching Python Server using: ${pythonExe}`);
  pyProc = spawn(pythonExe, ["server.py"], {
    cwd: PROJECT_DIR,
    windowsHide: true,
    env: { ...process.env, PATH: customPath, PYTHONUNBUFFERED: "1" }
  });

  pyProc.stdout.on("data", (d) => {
    process.stdout.write(`[server] ${d}`);
  });
  pyProc.stderr.on("data", (d) => {
    const text = d.toString();
    lastServerStderr += text;
    process.stderr.write(`[server] ${text}`);
  });

  pyProc.on("error", (err) => {
    dialog.showErrorBox(
      "เปิดเซิร์ฟเวอร์ไม่ได้",
      `ไม่สามารถรันเซิร์ฟเวอร์ได้:\n\n${err.message}\n\nที่ตำแหน่ง: ${PROJECT_DIR}`
    );
  });

  pyProc.on("exit", (code, signal) => {
    pyProc = null;
    if (!quitting && code !== 0) {
      const detail = lastServerStderr.trim() || `Exit code: ${code}`;
      dialog.showErrorBox(
        "เซิร์ฟเวอร์หยุดทำงานกะทันหัน",
        `Server ปิดตัวเองลง (code ${code})\n\nรายละเอียด Error:\n${detail}`
      );
    }
  });
}

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(SERVER_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (n <= 0) {
          reject(new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (timeout)"));
          return;
        }
        setTimeout(() => attempt(n - 1), 500);
      });
    };
    attempt(retries);
  });
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    title: "Kiraeve TikTok",
    icon: path.join(__dirname, "icons", "tray.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      // preload สำหรับส่ง IPC จาก renderer ไปยัง main
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[renderer] ${sourceId.split("/").pop()}:${line} ${message}`);
  });
  // เซิร์ฟเวอร์แก้ dashboard/overlay บ่อยตอนพัฒนา กันแคชเก่าค้าง โหลดใหม่ทุกครั้งที่เปิดหน้าต่าง
  mainWindow.webContents.session.clearCache().finally(() => {
    mainWindow.loadURL(SERVER_URL);
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.warn(`[renderer] Page failed to load (${errorCode}: ${errorDescription}). Retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(SERVER_URL);
      }
    }, 1000);
  });

  // ปิดหน้าต่าง = แค่ซ่อน ไม่ปิดเซิร์ฟเวอร์ (เผื่อกำลังไลฟ์อยู่ overlay ใน OBS ต้องใช้เซิร์ฟเวอร์ต่อ)
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "icons", "tray.png"));
  tray.setToolTip("Kiraeve TikTok — เซิร์ฟเวอร์กำลังทำงาน");

  const menu = Menu.buildFromTemplate([
    { label: "เปิดแผงควบคุม (Dashboard)", click: () => createWindow() },
    {
      label: "คัดลอก URL สำหรับ OBS Browser Source",
      click: () => clipboard.writeText(OVERLAY_URL),
    },
    { label: "เปิดโฟลเดอร์ media/", click: () => shell.openPath(path.join(PROJECT_DIR, "media")) },
    { type: "separator" },
    { label: "ตรวจสอบอัปเดต...", click: () => { createWindow(); autoUpdater.checkForUpdates(); } },
    { type: "separator" },
    { label: "ออกจากโปรแกรม (ปิดเซิร์ฟเวอร์ด้วย)", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => createWindow());
}

app.whenReady().then(async () => {
  const hasServer = fs.existsSync(path.join(PROJECT_DIR, "server.exe")) || fs.existsSync(path.join(PROJECT_DIR, "server.py"));
  if (!hasServer) {
    dialog.showErrorBox("หา Server ไม่เจอ", `ไม่พบไฟล์ server.exe หรือ server.py ที่ ${PROJECT_DIR}`);
    app.quit();
    return;
  }

  startServer();
  createTray();

  try {
    await waitForServer();
  } catch (e) {
    dialog.showErrorBox("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", e.message);
  }

  createWindow();

  // เช็กอัปเดตอัตโนมัติหลังเปิดแอป 5 วินาที (เฉพาะ Packaged / Production)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
  }

  app.on("activate", () => {
    createWindow();
  });
});

app.on("window-all-closed", () => {
  // ไม่ quit อัตโนมัติ — ให้เซิร์ฟเวอร์รันต่อผ่าน tray แม้ปิดหน้าต่างแล้ว
});

app.on("before-quit", () => {
  quitting = true;
  if (tray) {
    try { tray.destroy(); } catch (_) {}
    tray = null;
  }
  if (pyProc) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${pyProc.pid}`, { windowsHide: true });
      } else {
        pyProc.kill("SIGKILL");
      }
    } catch (_) {}
    pyProc = null;
  }
  killPortOccupant(PORT);
});
