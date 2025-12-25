const { createPlexClient, createPlexClientWithTimeout } = require("./plexClient");

/**
 * Gets all playlists from the Plex server
 */
async function getPlaylist(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    const result = await client.query("/playlists");
    const playlists = result.MediaContainer.Metadata || [];
    return playlists;
  } catch (error) {
    console.error(
      "Error in plexPlaylistOps.js at playlist operations: Error connecting to Plex server:",
      error
    );
    return false;
  }
}

/**
 * Deletes a playlist by ID
 */
async function deletePlaylist(hostname, port, plextoken, timeout, playlistId) {
  if (!playlistId) {
    console.error("Error: Playlist ID is required to delete a playlist.");
    return false;
  }

  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    await client.deleteQuery(`/playlists/${playlistId}`);
    return true;
  } catch (error) {
    if (error.response?.statusCode === 404) {
      console.error(
        `Error in plexPlaylistOps.js at playlist operations: Playlist with ID ${playlistId} not found on the server.`
      );
    } else {
      console.error(
        `Error in plexPlaylistOps.js at playlist operations: Error deleting playlist with ID ${playlistId}:`,
        error.message
      );
    }
    return false;
  }
}

/**
 * Deletes All Playlists
 */
async function deleteAllPlaylist(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    const playlists = await getPlaylist(hostname, port, plextoken, timeout);
    // Use a for-of loop for simple iteration over playlists
    for (const playlist of playlists) {
      await client.deleteQuery(`/playlists/${playlist.ratingKey}`);
    }
    return true;
  } catch (error) {
    console.error(
      `Error in plexPlaylistOps.js at playlist operations: Error deleting playlists:`,
      error.message
    );
    return false;
  }
}

/**
 * Refreshes the Plex library
 */
async function refreshPlaylist(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    await client.perform("/library/sections/all/refresh");
    return true;
  } catch (error) {
    console.error(`Error refreshing playlist: `, error.message);
    return false;
  }
}

/**
 * Deletes selected playlists by IDs
 */
async function deleteSelectedPlaylists(hostname, port, plextoken, timeout, playlistIds) {
  if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
    console.error('Error: No playlist IDs provided for deletion.');
    return false;
  }

  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    for (const playlistId of playlistIds) {
      await client.deleteQuery(`/playlists/${playlistId}`);
    }
    return true;
  } catch (error) {
    console.error('Error deleting selected playlists:', error.message);
    return false;
  }
}

module.exports = {
  getPlaylist,
  deletePlaylist,
  deleteAllPlaylist,
  refreshPlaylist,
  deleteSelectedPlaylists,
};
