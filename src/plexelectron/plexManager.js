import * as plexLocalAPI from "../../js/plexapi.js";
import { getAPIData } from "./settingsManager.js";
import logger from "../../js/plex/logger.js";

/**
 * Tests connection to Plex server
 */
export async function testConnection() {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  logger.log("[PlexManager] testConnection called.");
  logger.log("[PlexManager] Using API data:", { ...apiData, key: "REDACTED" });
  try {
    const result = await plexLocalAPI.testConnection(
      apiData.ipaddress,
      apiData.port,
      apiData.key,
      apiData.timeout
    );
    logger.log("[PlexManager] plexLocalAPI.testConnection result:", result);
    return result;
  } catch (error) {
    logger.error("[PlexManager] plexLocalAPI.testConnection failed:", error);
    return { success: false, error: { message: error.message } };
  }
}

/**
 * Gets all playlists from Plex server
 */
export async function getPlaylists() {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.getPlaylist(apiData.ipaddress, apiData.port, apiData.key, apiData.timeout);
}

/**
 * Creates M3U playlist
 */
export async function createM3UPlaylist(data) {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.createM3UPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout,
    data
  );
}

/**
 * Creates playlist from folder
 */
export async function createPlaylist(data) {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.createPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout,
    data
  );
}

/**
 * Creates multiple playlists in bulk
 */
export async function bulkPlaylist(data) {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.bulkPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout,
    data
  );
}

/**
 * Refreshes Plex playlists
 */
export async function refreshPlaylists() {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.refreshPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Deletes a playlist by ID
 */
export async function deletePlaylist(playlistId) {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.deletePlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout,
    playlistId
  );
}

/**
 * Deletes all playlists
 */
export async function deleteAllPlaylist() {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.deleteAllPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Creates recently played tracks playlist
 */
export async function createRecentlyPlayedPlaylist() {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.createRecentlyPlayedPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Creates recently added tracks playlist
 */
export async function createRecentlyAddedPlaylist() {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.createRecentlyAddedPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Deletes multiple playlists by IDs
 */
export async function deleteSelectedPlaylists(playlistIds) {
  const apiData = await getAPIData();
  logger.setDebugMode(apiData.enableConsole);
  return plexLocalAPI.deleteSelectedPlaylists(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout,
    playlistIds
  );
}
