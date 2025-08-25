const path = require("path");
const { createPlexClient, createPlexClientWithTimeout } = require("./plexClient");
const normalizeUtils = require("./normalizeUtils");

const {
  safeTruncate,
  looksLikePercentEncoded,
  normalizeForCompare,
  normalizeForCompareNoDecode,
  trimTrailingDots,
  buildFolderPatterns,
  normalizeToken,
} = normalizeUtils;
function buildUriFromItemKeys(machineIdentifier, itemKeys) {
  return `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${itemKeys.join(",")}`;
}

async function postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys) {
  const uri = buildUriFromItemKeys(machineIdentifier, itemKeys);
  // Ensure the uri is passed safely as a query parameter. URLSearchParams
  // will percent-encode reserved characters so '&' and '%' in paths are safe.
  const queryParameters = new URLSearchParams({
    type: "audio",
    title: playlistName,
    smart: "0",
    uri,
  }).toString();
  const queryPath = `/playlists?${queryParameters}`;
  await client.postQuery(queryPath);
}

function findPlaylistTracks(allTracks, playlistPath) {
  const patterns = buildFolderPatterns(playlistPath);

  let found = allTracks.filter((track) =>
    track?.Media?.[0]?.Part?.some((part) => {
      const file = part.file || "";
      // Normalize both decoded and raw variants to handle stored paths that
      // may contain literal '%' sequences or unescaped '&'.
      const fileNormDecoded = normalizeForCompare(file);
      const fileNormRaw = normalizeForCompareNoDecode(file);

      // Fast path: direct normalized contains
      if (patterns.some((p) => fileNormDecoded.includes(p) || fileNormRaw.includes(p))) return true;

      // Aggressive fallback: try decoding and replacing common encodings on-the-fly
      try {
        const variants = new Set();
        variants.add(file);
        // single decode if looks percent encoded
        if (looksLikePercentEncoded(file)) {
          try { variants.add(decodeURIComponent(file)); } catch (e) { console.debug('decodeURIComponent failed (single):', e.message); }
        }
        // double-decode only if it looks double-encoded (contains %25)
        try {
          if (file.includes('%25')) {
            variants.add(decodeURIComponent(decodeURIComponent(file)));
          }
        } catch (e) {
          // Log once per file to avoid extremely noisy output
          console.debug('double-decode failed for file (skipping double-decode):', String(e && e.message).slice(0,200));
        }

        // common replacements
        variants.add(file.replace(/%26/g, '&'));
        variants.add(file.replace(/\+/g, ' '));
        variants.add(file.replace(/%20/g, ' '));
        variants.add(file.replace(/&amp;/g, '&'));
        variants.add(file.replace(/%2526/g, '%26'));

        for (const v of variants) {
          const vn = normalizeForCompareNoDecode(v);
          if (patterns.some((p) => vn.includes(p))) return true;
        }
      } catch (e) {
        console.debug('aggressive match generation failed:', e && e.message);
      }

      return false;
    })
  );

  if (found.length === 0) {
    const baseToken = normalizeToken(path.basename(playlistPath));
    found = allTracks.filter((track) => {
      const parts = track?.Media?.[0]?.Part || [];
      return parts.some((p) => {
        const dir = normalizeForCompare(path.posix.dirname(p.file || ""));
        const segments = dir.split("/");
        const last = segments[segments.length - 1] || "";
        return normalizeToken(last) === baseToken;
      });
    });
  }

  return found;
}

async function checkAndDeletePlaylistIfExists(client, playlistName) {
  const playlists = await client.query("/playlists");
  const existingPlaylist = playlists.MediaContainer.Metadata?.find(
    (playlist) => playlist.title === playlistName
  );
  if (existingPlaylist) {
    await client.deleteQuery(`/playlists/${existingPlaylist.ratingKey}`);
    return true;
  }
  return false;
}

async function fetchRecentTracks(client, sortField, limit = 100) {
  const sections = await client.query("/library/sections");
  const musicLibraries = sections.MediaContainer.Directory.filter(
    (section) => section.type === "artist"
  );

  if (!musicLibraries.length) return [];

  let recentTracks = [];
  for (const library of musicLibraries) {
    const tracks = await client.query(
      `/library/sections/${library.key}/all?type=10&sort=${sortField}:desc&limit=50`
    );

    if (tracks.MediaContainer.Metadata) {
      recentTracks.push(...tracks.MediaContainer.Metadata);
    }
  }

  recentTracks.sort((a, b) => b[sortField] - a[sortField]);
  return recentTracks.slice(0, limit);
}
// --- end helpers ---

/**
 * Creates a playlist from an M3U file
 */
async function createM3UPlaylist(hostname, port, plextoken, timeout, parametersArray) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };

  // Safely extract and trim playlistPath
  const playlistPath = parametersArray[0] ? parametersArray[0].trim() : "";
  if (!playlistPath) {
    retunMessage.status = "error";
    retunMessage.message = "Playlist path is required.";
    return retunMessage;
  }

  // Safely extract and trim library
  let library = parametersArray[1] ? parametersArray[1].trim() : "";
  if (!library) {
    library = "Music";
  }
  retunMessage.message += `Library: ${library}. <br/>`;

  try {
    const sections = await client.query("/library/sections");
    const musicLibrary = sections.MediaContainer.Directory.find(
      (section) => section.title === library
    );

    if (!musicLibrary) {
      console.error(`Music library ${library} not found.`);
      retunMessage.message += `Music library ${library} not found. <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    // Ensure the path and sectionID are properly URL-encoded so that
    // folder names containing '&' or '%' don't break the query string.
    const uploadParams = new URLSearchParams({
      sectionID: String(musicLibrary.key),
      path: playlistPath,
    }).toString();

    await client.postQuery(`/playlists/upload?${uploadParams}`);
    retunMessage.message = "Playlist will be created if path exists";

    return retunMessage;
  } catch (error) {
    console.error(
      `Error in plexPlaylistCreate.js at playlist creation with name ${playlistPath}:`,
      error.message
    );
    retunMessage.status = "error";
    retunMessage.message += `Error creating playlist with name ${playlistPath}: ${error.message}`;
    return retunMessage;
  }
}

/**
 * Creates a playlist from a folder
 */
async function createPlaylist(hostname, port, plextoken, timeout, parametersArray) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };

  // Safely extract and trim playlistPath
  const playlistPath = parametersArray[0] ? parametersArray[0].trim() : "";
  if (!playlistPath) {
    console.error("Error: Playlist path is required.");
    retunMessage.status = "error";
    retunMessage.message = "Playlist path is required.";
    return retunMessage;
  }

  // Safely extract and trim playlistName
  let playlistName = parametersArray[1] ? parametersArray[1].trim() : "";
  if (!playlistName) {
    playlistName = path.basename(playlistPath);
  }
  retunMessage.message += `Playlist name: ${playlistName}. <br/>`;

  // Safely extract and trim library
  let library = parametersArray[2] ? parametersArray[2].trim() : "";
  if (!library) {
    library = "Music";
  }
  retunMessage.message += `Library: ${library}. <br/>`;

  try {
    const serverInfo = await client.query("/");
    const machineIdentifier = serverInfo.MediaContainer.machineIdentifier;

    const sections = await client.query("/library/sections");
    const musicLibrary = sections.MediaContainer.Directory.find(
      (section) => section.title === library
    );

    if (!musicLibrary) {
      console.error(`Music library "${library}" not found.`);
      retunMessage.message += `Music library "${library}" not found. <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    const tracks = await client.query(
      `/library/sections/${musicLibrary.key}/all?type=10`
    );
  

    const allTracks = tracks.MediaContainer.Metadata || [];
    const foundPlaylistTracks = findPlaylistTracks(allTracks, playlistPath);

    if (foundPlaylistTracks.length === 0) {
      const patterns = buildFolderPatterns(playlistPath);
      console.warn(`No tracks found for folder: ${playlistPath}`);
      console.warn(`Tried patterns: ${patterns.join(" | ")}`);
      const sample = tracks.MediaContainer.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.file;
      if (sample) {
        console.warn(`Example library file path: ${sample}`);
      }
      retunMessage.message += `No tracks found for folder: ${playlistPath} <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    retunMessage.message += `Creating playlist: "${playlistName}" with ${foundPlaylistTracks.length} tracks. <br/>`;

    const itemKeys = foundPlaylistTracks.map((track) => track.ratingKey);
    await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys);

    return retunMessage;
  } catch (error) {
    console.error(
      `Error in plexPlaylistCreate.js at playlist creation with name ${playlistPath}:`,
      error.message
    );
    retunMessage.status = "error";
    retunMessage.message += `Error creating playlist with name ${playlistPath}: ${error.message}`;
    return retunMessage;
  }
}

/**
 * Creates multiple playlists from an array of folders
 */
async function bulkPlaylist(hostname, port, plextoken, timeout, playlistArray) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };

  // Validate the playlistArray
  if (!playlistArray) {
    retunMessage.status = "error";
    retunMessage.message = "Playlist array is required.";
    return retunMessage;
  }

  try {
    const serverInfo = await client.query("/");
    const machineIdentifier = serverInfo.MediaContainer.machineIdentifier;

    const sections = await client.query("/library/sections");

    const musicLibrary = sections.MediaContainer.Directory.find(
      (section) => section.title === "Music"
    );

    if (!musicLibrary) {
      console.error(`Music library "Music" not found.`);
      retunMessage.status = "error";
      retunMessage.message += `Music library "Music" not found. <br/>`;
      return retunMessage;
    }

    const tracks = await client.query(
      `/library/sections/${musicLibrary.key}/all?type=10`
    );

    const configData = JSON.parse(playlistArray);
    const playlistFolders = Array.isArray(configData)
      ? configData
      : [configData];

    for (const playlistFolder of playlistFolders) {
      // Skip null or undefined playlist folders
      if (!playlistFolder) {
        retunMessage.message +=
          "Skipping undefined playlist folder entry.<br/>";
        continue;
      }

      const playlistName = path.basename(playlistFolder);

      // use helper to find matching tracks
      const allTracks = tracks.MediaContainer.Metadata || [];
      const foundPlaylistTracks = findPlaylistTracks(allTracks, playlistFolder);

      if (foundPlaylistTracks.length === 0) {
        retunMessage.message += "No tracks found for folder: " + playlistFolder + " <br/>";
        continue;
      }

      retunMessage.message += `Creating playlist: "${playlistName}" with ${foundPlaylistTracks.length} tracks. <br/>`;

      const itemKeys = foundPlaylistTracks.map((track) => track.ratingKey);
      await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys);
      retunMessage.message += `Playlist "${playlistName}" created successfully.<br/>`;
    }

    return retunMessage;
  } catch (error) {
    retunMessage.status = "error";
    retunMessage.message += `Error creating playlist: ${error.message}`;
    console.error(`Error creating playlist: `, error.message);
    return retunMessage;
  }
}

/**
 * Creates a playlist of recently played tracks. If the playlist name already exists, it will be deleted first.
 */
async function createRecentlyPlayedPlaylist(
  hostname,
  port,
  plextoken, 
  timeout,  
  parametersArray
) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };
  const playlistName = "Recently Played Tracks";

  try {
    const serverInfo = await client.query("/");
    const machineIdentifier = serverInfo.MediaContainer.machineIdentifier;

    // Check if the playlist already exists and delete it
    const deleted = await checkAndDeletePlaylistIfExists(client, playlistName);
    if (deleted) retunMessage.message += `Existing playlist "${playlistName}" deleted. <br/>`;

    // Get all music libraries
    const sections = await client.query("/library/sections");
    const musicLibraries = sections.MediaContainer.Directory.filter(
      (section) => section.type === "artist"
    );

    if (!musicLibraries.length) {
      retunMessage.message += "No music libraries found. <br/>";
      retunMessage.status = "error";
      return retunMessage;
    }

    // Fetch recently played tracks from each music library
    let recentTracks = await fetchRecentTracks(client, "lastViewedAt", 100);
    recentTracks = recentTracks.filter((t) => t.lastViewedAt);

    if (recentTracks.length === 0) {
      retunMessage.message += "No recently played tracks found. <br/>";
      retunMessage.status = "warning";
      return retunMessage;
    }

    retunMessage.message += `Found ${recentTracks.length} recently played tracks. <br/>`;

    const itemKeys = recentTracks.map((track) => track.ratingKey);
    await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys);
    retunMessage.message += `Playlist "${playlistName}" created successfully with ${recentTracks.length} tracks. <br/>`;
    return retunMessage;
  } catch (error) {
    console.error(
      `Error creating recently played playlist "${playlistName}":`,
      error.message
    );
    retunMessage.status = "error";
    retunMessage.message += `Error creating recently played playlist "${playlistName}": ${error.message}`;
    return retunMessage;
  }
}

/**
 * Creates a playlist of recently added tracks. If the playlist name already exists, it will be deleted first.
 */
async function createRecentlyAddedPlaylist(
  hostname,
  port,
  plextoken,
  timeout,
  parametersArray
) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };
  const playlistName = "Recently Added Tracks";

  try {
    const serverInfo = await client.query("/");
    const machineIdentifier = serverInfo.MediaContainer.machineIdentifier;

    // Check if the playlist already exists and delete it
    const deleted = await checkAndDeletePlaylistIfExists(client, playlistName);
    if (deleted) retunMessage.message += `Existing playlist "${playlistName}" deleted. <br/>`;

    let recentTracks = await fetchRecentTracks(client, "addedAt", 100);

    if (recentTracks.length === 0) {
      retunMessage.message += "No recently added tracks found. <br/>";
      retunMessage.status = "warning";
      return retunMessage;
    }

    retunMessage.message += `Found ${recentTracks.length} recently added tracks. <br/>`;

    const itemKeys = recentTracks.map((track) => track.ratingKey);
    await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys);
    retunMessage.message += `Playlist "${playlistName}" created successfully with ${recentTracks.length} tracks. <br/>`;
    return retunMessage;
  } catch (error) {
    console.error(
      `Error creating recently added playlist "${playlistName}":`,
      error.message
    );
    retunMessage.status = "error";
    retunMessage.message += `Error creating recently added playlist "${playlistName}": ${error.message}`;
    return retunMessage;
  }
}
module.exports = {
  createM3UPlaylist,
  createPlaylist,
  bulkPlaylist,
  createRecentlyPlayedPlaylist,
  createRecentlyAddedPlaylist,
  findPlaylistTracks,
};
