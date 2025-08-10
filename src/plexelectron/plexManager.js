const plexLocalAPI = require("../../js/plexapi.js");
const { getAPIData } = require("./settingsManager");

/**
 * Tests connection to Plex server
 */
async function testConnection() {
  const apiData = await getAPIData();
  return plexLocalAPI.testConnection(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Gets all playlists from Plex server
 */
async function getPlaylists() {
  const apiData = await getAPIData();
  return plexLocalAPI.getPlaylist(apiData.ipaddress, apiData.port, apiData.key, apiData.timeout);
}

/**
 * Creates M3U playlist
 */
async function createM3UPlaylist(data) {
  const apiData = await getAPIData();
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
async function createPlaylist(data) {
  const apiData = await getAPIData();
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
async function bulkPlaylist(data) {
  const apiData = await getAPIData();
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
async function refreshPlaylists() {
  const apiData = await getAPIData();
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
async function deletePlaylist(playlistId) {
  const apiData = await getAPIData();
  return plexLocalAPI.deletePlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout,
    playlistId
  );
}

/**
 * Deletes a playlist by ID
 */
async function deleteAllPlaylist() {
  const apiData = await getAPIData();
  return plexLocalAPI.deleteAllPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Refreshes Plex playlists
 */
async function createRecentlyPlayedPlaylist() {
  const apiData = await getAPIData();
  return plexLocalAPI.createRecentlyPlayedPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

/**
 * Refreshes Plex playlists
 */
async function createRecentlyAddedPlaylist() {
  const apiData = await getAPIData();
  return plexLocalAPI.createRecentlyAddedPlaylist(
    apiData.ipaddress,
    apiData.port,
    apiData.key,
    apiData.timeout
  );
}

module.exports = {
  testConnection,
  getPlaylists,
  createM3UPlaylist,
  createPlaylist,
  bulkPlaylist,
  refreshPlaylists,
  deletePlaylist,
  deleteAllPlaylist,
  createRecentlyPlayedPlaylist,
  createRecentlyAddedPlaylist
};
