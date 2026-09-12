// preload.js — Bridge ระหว่าง Electron Main Process และ Dashboard Web Page
// contextIsolation = true ทำให้ต้องใช้ contextBridge ในการส่งข้อมูลข้ามโลก
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kiraeveUpdater", {
  // ส่งคำสั่งไปยัง Main Process
  check:      () => ipcRenderer.invoke("updater:check"),
  download:   () => ipcRenderer.invoke("updater:download"),
  install:    () => ipcRenderer.invoke("updater:install"),
  getVersion: () => ipcRenderer.invoke("updater:get-version"),

  // รับ Event จาก Main Process → Dashboard UI
  onEvent: (callback) => {
    ipcRenderer.on("updater-event", (_event, data) => callback(data));
  },

  // ลบ Listener ออก (เพื่อกัน memory leak)
  removeEventListeners: () => {
    ipcRenderer.removeAllListeners("updater-event");
  },
});
