const { app, BrowserWindow } = require("electron");
const { createWindow } = require("./windowManager");
const { getAPIData } = require("./settingsManager");
const { setupIPC } = require("./ipcHandlers");

let mainWindow;

if (require("electron-squirrel-startup")) app.quit();

app.whenReady().then(async () => {
  mainWindow = createWindow();
  let apiData = await getAPIData();
  mainWindow.loadFile("index.html", { query: apiData });

  // Set up all IPC handlers
  setupIPC(mainWindow);

  // Optional, remove for production
  //mainWindow.webContents.openDevTools();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      let apiData = await getAPIData();
      mainWindow.loadFile("index.html", { query: apiData }); // Load the content
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
