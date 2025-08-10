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
  createRecentlyPlayedPlaylist,
  createRecentlyAddedPlaylist,
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
    console.log("Received data from UI for save-config:", data);

    const [apiKey, ipAddress, port, timeout] = [
      data[0], // Access array elements directly
      data[1],
      data[2],
      data[3] || 60000, // Default timeout to 60 seconds if not provided
    ];

    return saveConfig([apiKey, ipAddress, port, timeout]);
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
  ipcMain.handle("recent-played-playlists", (event, data) => createRecentlyPlayedPlaylist(data));
  ipcMain.handle("recent-added-playlists", (event, data) => createRecentlyAddedPlaylist(data));
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
