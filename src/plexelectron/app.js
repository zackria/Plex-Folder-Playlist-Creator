import { app, BrowserWindow } from "electron";
import { createWindow } from "./windowManager.js";
import { getAPIData } from "./settingsManager.js";
import { setupIPC } from "./ipcHandlers.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let mainWindow;

// Handle squirrel startup with error handling
try {
  if (require("electron-squirrel-startup")) {
    app.quit();
  }
} catch (error) {
  console.warn("electron-squirrel-startup module not found, continuing without it:", error.message);
}

app.on('ready', async () => {
  mainWindow = createWindow();
  let apiData = await getAPIData();
  mainWindow.loadFile("index.html", { query: apiData });

  // Set up all IPC handlers
  setupIPC(mainWindow);

  // Optional, remove for production
  //mainWindow.webContents.openDevTools();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    let apiData = await getAPIData();
    mainWindow.loadFile("index.html", { query: apiData }); // Load the content

    // Optional, remove for production
    //mainWindow.webContents.openDevTools();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
