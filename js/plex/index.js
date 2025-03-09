// Main export file that re-exports all Plex API functionality
const { createPlexClient, testConnection } = require("./plexClient");
const {
  getPlaylist,
  deletePlaylist,
  deleteAllPlaylist,
  refreshPlaylist,
} = require("./plexPlaylistOps");
const {
  createM3UPlaylist,
  createPlaylist,
  bulkPlaylist,
} = require("./plexPlaylistCreate");

module.exports = {
  // Client functions
  createPlexClient,
  testConnection,

  // Playlist operations
  getPlaylist,
  deletePlaylist,
  deleteAllPlaylist,
  refreshPlaylist,

  // Playlist creation
  createM3UPlaylist,
  createPlaylist,
  bulkPlaylist,
};
