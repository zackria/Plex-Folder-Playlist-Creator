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
  getLibraries,
} from "./plexManager.js";
import logger from "../../js/plex/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fixed lookup table of pages the renderer is allowed to navigate to. The
// page name arrives over IPC from the renderer, so it is used only as a key
// into this table of hardcoded filenames - it is never concatenated into a
// filesystem path itself, which rules out path traversal regardless of what
// the renderer sends.
const NAVIGABLE_PAGE_FILES = new Map([
  ["index", "index.html"],
  ["actions", "actions.html"],
  ["createplaylist", "createplaylist.html"],
  ["bulkplaylist", "bulkplaylist.html"],
  ["m3uplaylist", "m3uplaylist.html"],
]);

/**
 * Sets up all IPC communication channels
 */
export function setupIPC(mainWindow) {
  // Navigation
  ipcMain.on("navigate-to", async (event, page) => {
    const pageFile = NAVIGABLE_PAGE_FILES.get(page);
    if (!pageFile) {
      logger.error(`Rejected navigate-to request for unknown page: ${page}`);
      return;
    }
    const filePath = path.join(__dirname, "../../", pageFile);

    // Get the current window from the event sender
    const currentWindow = BrowserWindow.fromWebContents(event.sender);

    if (!currentWindow || currentWindow.isDestroyed()) {
      logger.error("Current window is not available or has been destroyed.");
      return;
    }

    try {
      let apiData = await getAPIData();
      await currentWindow.loadFile(filePath, { query: apiData });
    } catch (error) {
      logger.error("Error loading file in navigate-to handler:", error.message);
    }
  });

  // Configuration
  ipcMain.handle("save-config", async (event, data) => {
    logger.log("[IPC] save-config called with:", data);
    const [apiKey, ipAddress, port, timeout] = [
      data[0], // Access array elements directly
      data[1],
      data[2],
      data[3] || 60000, // Default timeout to 60 seconds if not provided
    ];

    try {
      await saveConfig([apiKey, ipAddress, port, timeout]);
      logger.log("[IPC] save-config successful.");
      return true;
    } catch (error) {
      logger.error("[IPC] save-config failed:", error);
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
  ipcMain.handle("get-libraries", (event) => getLibraries());
  ipcMain.handle("refresh-playlists", (event, data) => refreshPlaylists(data));
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
      logger.error('Error in delete-selected-playlists handler:', error);
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
