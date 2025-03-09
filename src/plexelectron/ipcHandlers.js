const { ipcMain } = require("electron");
const path = require("path");
const { saveConfig, saveTheme, getAPIData } = require("./settingsManager");
const { confirmDeletePlaylist, showVersionInfo } = require("./dialogManager");
const {
  testConnection,
  getPlaylists,
  createM3UPlaylist,
  createPlaylist,
  bulkPlaylist,
  refreshPlaylists,
  deletePlaylist,
  deleteAllPlaylist,
} = require("./plexManager");

/**
 * Sets up all IPC communication channels
 */
function setupIPC(mainWindow) {
  // Navigation
  ipcMain.on("navigate-to", async (event, page) => {
    const filePath = path.join(__dirname, "../../", `${page}.html`);
    if (mainWindow && filePath) {
      let apiData = await getAPIData();
      mainWindow.loadFile(filePath, { query: apiData });
    }
  });

  // Configuration
  ipcMain.handle("save-config", async (event, data) => {
    return saveConfig(data);
  });

  ipcMain.on("save-theme", (event, data) => {
    saveTheme(data);
  });

  // Plex API Operations
  ipcMain.handle("test-connection", testConnection);
  ipcMain.handle("get-playlists", getPlaylists);
  ipcMain.handle("create-m3u-playlist", (event, data) =>
    createM3UPlaylist(data)
  );
  ipcMain.handle("create-playlist", (event, data) => createPlaylist(data));
  ipcMain.handle("bulk-playlist", (event, data) => bulkPlaylist(data));
  ipcMain.handle("refresh-playlists", refreshPlaylists);
  ipcMain.handle("delete-playlist", (event, data) => deletePlaylist(data));
  ipcMain.handle("delete-all-playlist", (event, data) =>
    deleteAllPlaylist(data)
  );

  // Dialogs
  ipcMain.handle("openDialog", (event, data) =>
    confirmDeletePlaylist(mainWindow, data)
  );
  ipcMain.handle("releaseVersion", () => showVersionInfo(mainWindow));
}

module.exports = {
  setupIPC,
};
