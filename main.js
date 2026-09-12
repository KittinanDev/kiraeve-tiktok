const { app, BrowserWindow, Tray, Menu, shell, dialog, clipboard, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

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
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("updater:get-version", () => {
  return app.getVersion();
});

// ------------------------------------------------------------------

function findPython() {
  const candidates = process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];
  return candidates[0]; // spawn จะ resolve ผ่าน PATH เอง ลอง fallback ถ้า exit ทันที
}

function startServer() {
  const exePath = path.join(PROJECT_DIR, "server.exe");
  const pythonExe = process.env.NPC_OVERLAY_PYTHON || findPython();

  if (fs.existsSync(exePath)) {
    console.log(`[main] Launching standalone binary: ${exePath}`);
    pyProc = spawn(exePath, [], {
      cwd: PROJECT_DIR,
      windowsHide: true,
    });
  } else {
    console.log(`[main] Launching Python script: ${pythonExe} server.py`);
    pyProc = spawn(pythonExe, ["server.py"], {
      cwd: PROJECT_DIR,
      windowsHide: true,
    });
  }

  pyProc.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  pyProc.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  pyProc.on("error", (err) => {
    dialog.showErrorBox(
      "เปิดเซิร์ฟเวอร์ไม่ได้",
      `หา Python ไม่เจอ (สั่ง "${pythonExe}") หรือรันไม่ได้\n\n${err.message}\n\n` +
      `ตรวจสอบว่าติดตั้ง Python 3.9+ แล้ว และรัน "pip install -r requirements.txt" ในโฟลเดอร์โปรเจกต์`
    );
  });

  pyProc.on("exit", (code, signal) => {
    pyProc = null;
    if (!quitting && code !== 0) {
      dialog.showErrorBox(
        "เซิร์ฟเวอร์หยุดทำงานกะทันหัน",
        `python server.py ปิดตัวเอง (code ${code})\nลองเปิดแอปใหม่ หรือรัน "python server.py" เองในโฟลเดอร์โปรเจกต์เพื่อดู error เต็ม ๆ`
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
  if (!fs.existsSync(path.join(PROJECT_DIR, "server.py"))) {
    dialog.showErrorBox("หา server.py ไม่เจอ", `ไม่พบไฟล์ server.py ที่ ${PROJECT_DIR}`);
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
  if (pyProc) {
    pyProc.kill();
  }
});
