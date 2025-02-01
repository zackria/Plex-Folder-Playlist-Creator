const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const settings = require("electron-settings");
const plexLocalAPI = require("./js/plexapi.js");
const { Module } = require("module");
const electronDialog = require("electron").dialog;

let mainWindow;

if (require("electron-squirrel-startup")) app.quit();

app.whenReady().then(async () => {
  mainWindow = createWindow();
  let apiData = await getAPIData();
  mainWindow.loadFile("index.html", { query: apiData });
  //mainWindow.webContents.openDevTools();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("navigate-to", async (event, page) => {
  const filePath = path.join(__dirname, `${page}.html`);
  if (mainWindow && filePath) {
    let apiData = await getAPIData();
    mainWindow.loadFile(filePath, { query: apiData });
  }
});

ipcMain.handle("save-config", async (event, data) => {
  let result = settings.set("key", {
    apiKey: data[0],
    ipAddress: data[1],
    port: data[2],
  });
  return result;
});

ipcMain.on("save-theme", (event, data) => {
  settings.set("userPreferences", {
    theme: data,
  });
  //console.log(`Theme saved ${data}`);
});

ipcMain.handle("test-connection", async () => {
  let apiData = await getAPIData();
  let result = await plexLocalAPI.testConnection(
    apiData.ipaddress,
    apiData.port,
    apiData.key
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

ipcMain.handle("get-playlists", async () => {
  let apiData = await getAPIData();
  let result = await plexLocalAPI.getPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

ipcMain.handle("create-m3u-playlist", async (event, data) => {
  let apiData = await getAPIData();
  let result = await plexLocalAPI.createM3UPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    data.trim()
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

ipcMain.handle("create-playlist", async (event, data) => {
  let apiData = await getAPIData();
  let result = await plexLocalAPI.createPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    data
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

ipcMain.handle("bulk-playlist", async (event, data) => {
  let apiData = await getAPIData();
  let result = await plexLocalAPI.bulkPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    data
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

ipcMain.handle("refresh-playlists", async () => {
  let apiData = await getAPIData();
  let result = await plexLocalAPI.refreshPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

ipcMain.handle("delete-playlist", async (event, data) => {
  //console.log(`Delete Playlist Function invoked ${data}`);

  let apiData = await getAPIData();

  let result = await plexLocalAPI.deletePlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    data
  );

  //console.log(`Connection ${result ? "Result" : "Error Result"} - ${result}`);
  return result;
});

async function getAPIData() {
  const [ipAddress, port, apiKey, theme] = await Promise.all([
    settings.get("key.ipAddress"),
    settings.get("key.port"),
    settings.get("key.apiKey"),
    settings.get("userPreferences.theme"),
  ]);

  return { ipaddress: ipAddress, port: port, key: apiKey, theme: theme };
}

ipcMain.handle("openDialog", async (event, data) => {
  return (
    electronDialog
      .showMessageBox(mainWindow, {
        type: "question",
        title: "Confirmation",
        message: `Are you sure you want to delete this playlist ${data[0]} ${data[1]} ${data[2]}?`,
        buttons: ["Yes", "No"],
      })
      // Dialog returns a promise so let's handle it correctly
      .then((result) => {
        // Bail if the user pressed "No" or escaped (ESC) from the dialog box
        if (result.response !== 0) {
          //console.log('The "No" button was pressed (main process)');
          return false;
        }

        // Testing.
        if (result.response === 0) {
          //console.log('The "Yes" button was pressed (main process)');
          return true;
        }

        // Reply to the render process
        return false;
      })
  );
});

ipcMain.handle("releaseVersion", async (event, data) => {
  const version = app.getVersion();
  return electronDialog.showMessageBox(mainWindow, {
    type: "info",
    title: `Plex Folder Playlist Creator - ${version}`,
    message: `Plex Folder Playlist Creator \n Version ${version} \n MIT License \n Copyright (c) 2025 Zack Dawood`,
    buttons: ["Ok"],
  });
});

function createWindow() {
  return new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });
}
