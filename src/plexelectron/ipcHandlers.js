import { ipcMain, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveConfig, saveTheme, getAPIData } from "./settingsManager.js";
import { confirmDeletePlaylist, showVersionInfo } from "./dialogManager.js";
import {
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
  deleteSelectedPlaylists,
} from "./plexManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sets up all IPC communication channels
 */
export function setupIPC(mainWindow) {
  // Navigation
  ipcMain.on("navigate-to", async (event, page) => {
    const filePath = path.join(__dirname, "../../", `${page}.html`);

    // Get the current window from the event sender
    const currentWindow = BrowserWindow.fromWebContents(event.sender);

    if (!currentWindow || currentWindow.isDestroyed()) {
      console.error("Current window is not available or has been destroyed.");
      return;
    }

    try {
      let apiData = await getAPIData();
      await currentWindow.loadFile(filePath, { query: apiData });
    } catch (error) {
      console.error("Error loading file in navigate-to handler:", error.message);
    }
  });

  // Configuration
  ipcMain.handle("save-config", async (event, data) => {
    console.log("[IPC] save-config called with:", data);
    const [apiKey, ipAddress, port, timeout, enableConsole] = [
      data[0], // Access array elements directly
      data[1],
      data[2],
      data[3] || 60000, // Default timeout to 60 seconds if not provided
      data[4], // enableConsole
    ];

    try {
      await saveConfig([apiKey, ipAddress, port, timeout, enableConsole]);
      console.log("[IPC] save-config successful.");
      return true;
    } catch (error) {
      console.error("[IPC] save-config failed:", error);
      throw error;
    }
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
  ipcMain.handle('delete-selected-playlists', async (event, playlistIds) => {
    if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
      return { success: false, message: 'No playlists selected.' };
    }

    try {
      const result = await deleteSelectedPlaylists(playlistIds);
      return { success: result };
    } catch (error) {
      console.error('Error in delete-selected-playlists handler:', error);
      return { success: false, message: error.message };
    }
  });

  // Dialogs
  ipcMain.handle("openDialog", (event, data) => {
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    return confirmDeletePlaylist(currentWindow, data);
  });
  ipcMain.handle("releaseVersion", (event) => {
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    return showVersionInfo(currentWindow);
  });
}
