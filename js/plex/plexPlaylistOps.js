import { createPlexClientWithTimeout } from "./plexClient.js";
import logger from "./logger.js";

/**
 * Gets all playlists from the Plex server
 */
export async function getPlaylist(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    const result = await client.query("/playlists");
    const playlists = result.MediaContainer.Metadata || [];
    return playlists;
  } catch (error) {
    logger.error(
      "Error in plexPlaylistOps.js at playlist operations: Error connecting to Plex server:",
      error
    );
    return false;
  }
}

/**
 * Deletes a playlist by ID
 */
export async function deletePlaylist(hostname, port, plextoken, timeout, playlistId) {
  if (!playlistId) {
    logger.error("Error: Playlist ID is required to delete a playlist.");
    return false;
  }

  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    await client.deleteQuery(`/playlists/${playlistId}`);
    return true;
  } catch (error) {
    if (error.response?.statusCode === 404) {
      logger.error(
        `Error in plexPlaylistOps.js at playlist operations: Playlist with ID ${playlistId} not found on the server.`
      );
    } else {
      logger.error(
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
export async function deleteAllPlaylist(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    const playlists = await getPlaylist(hostname, port, plextoken, timeout);
    // Use a for-of loop for simple iteration over playlists
    for (const playlist of playlists) {
      await client.deleteQuery(`/playlists/${playlist.ratingKey}`);
    }
    return true;
  } catch (error) {
    logger.error(
      `Error in plexPlaylistOps.js at playlist operations: Error deleting playlists:`,
      error.message
    );
    return false;
  }
}

/**
 * Refreshes the Plex library
 */
export async function refreshPlaylist(hostname, port, plextoken, timeout, libraryName) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    let refreshPath = "/library/sections/all/refresh";

    if (libraryName) {
      const sections = await client.query("/library/sections");
      const section = sections?.MediaContainer?.Directory?.find(
        (s) => s.title.trim().toLowerCase() === libraryName.trim().toLowerCase()
      );

      if (section) {
        logger.log(`[refreshPlaylist] Refreshing specific library: "${section.title}" (ID: ${section.key})`);
        refreshPath = `/library/sections/${section.key}/refresh`;
      } else {
        logger.warn(`[refreshPlaylist] Library "${libraryName}" not found. Refreshing all sections instead.`);
      }
    }

    await client.perform(refreshPath);
    return true;
  } catch (error) {
    logger.error(`Error refreshing playlist: `, error.message);
    return false;
  }
}

/**
 * Deletes selected playlists by IDs
 */
export async function deleteSelectedPlaylists(hostname, port, plextoken, timeout, playlistIds) {
  if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
    logger.error('Error: No playlist IDs provided for deletion.');
    return false;
  }

  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    for (const playlistId of playlistIds) {
      await client.deleteQuery(`/playlists/${playlistId}`);
    }
    return true;
  } catch (error) {
    logger.error('Error deleting selected playlists:', error.message);
    return false;
  }
}

/**
 * Gets all libraries from the Plex server
 */
export async function getLibraries(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    const result = await client.query("/library/sections");
    return result?.MediaContainer?.Directory || [];
  } catch (error) {
    logger.error("Error fetching libraries:", error.message);
    return [];
  }
}
