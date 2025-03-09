const { createPlexClient } = require("./plexClient");

/**
 * Gets all playlists from the Plex server
 */
async function getPlaylist(hostname, port, plextoken) {
  const client = createPlexClient(hostname, port, plextoken);

  try {
    const result = await client.query("/playlists");
    const playlists = result.MediaContainer.Metadata || [];
    return playlists;
  } catch (error) {
    console.error("Error connecting to Plex server:", error);
    return false;
  }
}

/**
 * Deletes a playlist by ID
 */
async function deletePlaylist(hostname, port, plextoken, playlistId) {
  if (!playlistId) {
    return false;
  }

  const client = createPlexClient(hostname, port, plextoken);

  try {
    await client.deleteQuery(`/playlists/${playlistId}`);
    return true;
  } catch (error) {
    console.error(
      `Error deleting playlist with ID ${playlistId}:`,
      error.message
    );
    return false;
  }
}

/**
 * Deletes All Playlists
 */
async function deleteAllPlaylist(hostname, port, plextoken) {
  const client = createPlexClient(hostname, port, plextoken);

  try {
    const playlists = await getPlaylist(hostname, port, plextoken);
    for (let i = 0; i < playlists.length; i++) {
      await client.deleteQuery(`/playlists/${playlists[i].ratingKey}`);
    }
    return true;
  } catch (error) {
    console.error(
      `Error deleting playlist with ID ${playlistId}:`,
      error.message
    );
    return false;
  }
}

/**
 * Refreshes the Plex library
 */
async function refreshPlaylist(hostname, port, plextoken) {
  const client = createPlexClient(hostname, port, plextoken);

  try {
    await client.perform("/library/sections/all/refresh");
    return true;
  } catch (error) {
    console.error(`Error refreshing playlist: `, error.message);
    return false;
  }
}

module.exports = {
  getPlaylist,
  deletePlaylist,
  deleteAllPlaylist,
  refreshPlaylist,
};
