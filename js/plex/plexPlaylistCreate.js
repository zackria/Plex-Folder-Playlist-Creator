import path from "node:path";
import { createPlexClientWithTimeout } from "./plexClient.js";
import * as normalizeUtils from "./normalizeUtils.js";
import logger from "./logger.js";

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

async function postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys, type = "audio") {
  const uri = buildUriFromItemKeys(machineIdentifier, itemKeys);
  // Ensure the uri is passed safely as a query parameter. URLSearchParams
  // will percent-encode reserved characters so '&' and '%' in paths are safe.
  const queryParameters = new URLSearchParams({
    type,
    title: playlistName,
    smart: "0",
    uri,
  }).toString();
  const queryPath = `/playlists?${queryParameters}`;
  await client.postQuery(queryPath);
}

/**
 * Helper to get library section and detect its media type
 */
async function getLibraryAndType(client, libraryTitle) {
  const sections = await client.query("/library/sections");

  if (!sections?.MediaContainer?.Directory) {
    logger.error("[getLibraryAndType] No sections found in MediaContainer.");
    return null;
  }

  logger.log(`[getLibraryAndType] Searching for library: "${libraryTitle}"`);

  // Log all available sections for debugging
  sections.MediaContainer.Directory.forEach(s => {
    logger.log(`[getLibraryAndType] Available Library: Title="${s.title}", Type="${s.type}", Key="${s.key}"`);
  });

  const section = sections.MediaContainer.Directory.find(
    (s) => s.title.trim().toLowerCase() === libraryTitle.trim().toLowerCase()
  );

  if (!section) {
    logger.warn(`[getLibraryAndType] Library "${libraryTitle}" not found in available sections.`);
    return null;
  }

  logger.log(`[getLibraryAndType] Found section: "${section.title}" (Type: ${section.type})`);

  let mediaType = "10"; // Default to Track (Music)
  let playlistType = "audio";

  if (section.type === "movie") {
    mediaType = "1";
    playlistType = "video";
  } else if (section.type === "artist") {
    mediaType = "10";
    playlistType = "audio";
  } else if (section.type === "show") {
    mediaType = "4"; // Episode
    playlistType = "video";
  }

  logger.log(`[getLibraryAndType] Result: mediaType=${mediaType}, playlistType=${playlistType}`);
  return { section, mediaType, playlistType };
}

export function findPlaylistTracks(allTracks, playlistPath) {
  const patterns = buildFolderPatterns(playlistPath);
  logger.log(`[findPlaylistTracks] Searching ${allTracks.length} items for path: "${playlistPath}"`);

  if (allTracks.length > 0) {
    const sample = allTracks[0]?.Media?.[0]?.Part?.[0]?.file;
    logger.log(`[findPlaylistTracks] Sample file path from library: "${sample}"`);
  }

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
          try { variants.add(decodeURIComponent(file)); } catch (e) { logger.log('decodeURIComponent failed (single):', e.message); }
        }
        // double-decode only if it looks double-encoded (contains %25)
        try {
          if (file.includes('%25')) {
            variants.add(decodeURIComponent(decodeURIComponent(file)));
          }
        } catch (e) {
          // Log once per file to avoid extremely noisy output
          logger.log('double-decode failed for file (skipping double-decode):', e?.message?.slice(0, 200));
        }

        // common replacements
        variants.add(file.replaceAll('%26', '&'));
        variants.add(file.replaceAll('+', ' '));
        variants.add(file.replaceAll('%20', ' '));
        variants.add(file.replaceAll('&amp;', '&'));
        variants.add(file.replaceAll('%2526', '%26'));

        for (const v of variants) {
          const vn = normalizeForCompareNoDecode(v);
          if (patterns.some((p) => vn.includes(p))) return true;
        }
      } catch (e) {
        logger.log('aggressive match generation failed:', e?.message);
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

async function fetchRecentItems(client, sortField, limit = 100) {
  const sections = await client.query("/library/sections");

  if (!sections?.MediaContainer?.Directory) return [];

  const targetLibraries = sections.MediaContainer.Directory.filter(
    (section) => section.type === "artist" || section.type === "movie" || section.type === "show"
  );

  logger.log(`[fetchRecentItems] Found ${targetLibraries.length} candidate libraries: ${targetLibraries.map(l => l.title).join(", ")}`);

  if (!targetLibraries.length) return [];

  let recentItems = [];
  for (const library of targetLibraries) {
    try {
      let type = "10"; // Default Music
      let pType = "audio";

      if (library.type === "movie") {
        type = "1";
        pType = "video";
      } else if (library.type === "show") {
        type = "4"; // Episode
        pType = "video";
      }

      logger.log(`[fetchRecentItems] Querying library "${library.title}" (ID: ${library.key}, Category: ${library.type}) with item type: ${type}`);

      const items = await client.query(
        `/library/sections/${library.key}/all?type=${type}&sort=${sortField}:desc&limit=50&includeGuids=1`
      );

      if (items?.MediaContainer?.Metadata) {
        items.MediaContainer.Metadata.forEach(item => item.playlistType = pType);
        recentItems.push(...items.MediaContainer.Metadata);
      }
    } catch (err) {
      logger.error(`[fetchRecentItems] Failed to fetch from library "${library.title}" (ID: ${library.key}):`, err.message);
    }
  }

  recentItems.sort((a, b) => b[sortField] - a[sortField]);
  return recentItems.slice(0, limit);
}

/**
 * Creates a playlist from an M3U file
 */
export async function createM3UPlaylist(hostname, port, plextoken, timeout, parametersArray) {
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
    const libraryData = await getLibraryAndType(client, library);

    if (!libraryData) {
      logger.error(`Library ${library} not found.`);
      retunMessage.message += `Library ${library} not found. <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    // Ensure the path and sectionID are properly URL-encoded so that
    // folder names containing '&' or '%' don't break the query string.
    const uploadParams = new URLSearchParams({
      sectionID: String(libraryData.section.key),
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
export async function createPlaylist(hostname, port, plextoken, timeout, parametersArray) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };

  // Safely extract and trim playlistPath
  const playlistPath = parametersArray[0] ? parametersArray[0].trim() : "";
  if (!playlistPath) {
    logger.error("Error: Playlist path is required.");
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

    const libraryData = await getLibraryAndType(client, library);

    if (!libraryData) {
      logger.error(`Library "${library}" not found.`);
      retunMessage.message += `Library "${library}" not found. <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    // Try to fetch items. For movie and show libraries, we might try to fetch without type filter if filtered query returns 0
    let items = await client.query(
      `/library/sections/${libraryData.section.key}/all?type=${libraryData.mediaType}`
    );

    let allItems = items?.MediaContainer?.Metadata || [];

    // If no items found with type filter, try fetching everything to see what types are present
    if (allItems.length === 0) {
      logger.warn(`[createPlaylist] No items found with type=${libraryData.mediaType}. Retrying without type filter...`);
      const unfilteredItems = await client.query(`/library/sections/${libraryData.section.key}/all?includeGuids=1&limit=100`);
      const rawItems = unfilteredItems?.MediaContainer?.Metadata || [];
      if (rawItems.length > 0) {
        const types = Array.from(new Set(rawItems.map(i => i.type)));
        logger.log(`[createPlaylist] Found ${rawItems.length} items without filter. Present types: ${types.join(", ")}`);
        // If the library is supposed to be movie but items are something else, we might want to adapt
        // or just use these items for matching.
        allItems = rawItems;
      }
    }
    logger.log(`[createPlaylist] Total items fetched from library: ${allItems.length}`);
    const foundItems = findPlaylistTracks(allItems, playlistPath);

    if (foundItems.length === 0) {
      const patterns = buildFolderPatterns(playlistPath);
      logger.warn(`No items found for folder: ${playlistPath}`);
      logger.warn(`Tried patterns: ${patterns.join(" | ")}`);
      const sample = items.MediaContainer.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.file;
      if (sample) {
        logger.warn(`Example library file path: ${sample}`);
      }
      retunMessage.message += `No items found for folder: ${playlistPath}. <br/>Tried searching in library: ${library} (ID: ${libraryData.section.key}, Type: ${libraryData.section.type})<br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    retunMessage.message += `Creating playlist: "${playlistName}" with ${foundItems.length} items. <br/>`;

    const itemKeys = foundItems.map((item) => item.ratingKey);
    await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys, libraryData.playlistType);

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
export async function bulkPlaylist(hostname, port, plextoken, timeout, parameters) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
  let retunMessage = { status: "success", message: "" };

  // Determine if parameters is an array (new format) or a string (old format)
  let playlistArrayStr, libraryName;
  if (Array.isArray(parameters)) {
    playlistArrayStr = parameters[0];
    libraryName = parameters[1] || "Music";
  } else {
    playlistArrayStr = parameters;
    libraryName = "Music";
  }

  if (!playlistArrayStr) {
    retunMessage.status = "error";
    retunMessage.message = "Playlist array is required.";
    return retunMessage;
  }

  try {
    const serverInfo = await client.query("/");
    const machineIdentifier = serverInfo.MediaContainer.machineIdentifier;

    const libraryData = await getLibraryAndType(client, libraryName);

    if (!libraryData) {
      logger.error(`Library "${libraryName}" not found.`);
      retunMessage.status = "error";
      retunMessage.message += `Library "${libraryName}" not found. <br/>`;
      return retunMessage;
    }

    // Try to fetch items.
    let items = await client.query(
      `/library/sections/${libraryData.section.key}/all?type=${libraryData.mediaType}`
    );

    let allItems = items?.MediaContainer?.Metadata || [];

    // Retry without type filter if 0 items found
    if (allItems.length === 0) {
      logger.warn(`[bulkPlaylist] No items found in "${libraryName}" with type=${libraryData.mediaType}. Retrying without type filter...`);
      const unfilteredItems = await client.query(`/library/sections/${libraryData.section.key}/all?includeGuids=1&limit=200`);
      const rawItems = unfilteredItems?.MediaContainer?.Metadata || [];
      if (rawItems.length > 0) {
        const types = Array.from(new Set(rawItems.map(i => i.type)));
        logger.log(`[bulkPlaylist] Found ${rawItems.length} items without filter. Present types: ${types.join(", ")}`);
        allItems = rawItems;
      }
    }

    const configData = JSON.parse(playlistArrayStr);
    const playlistFolders = Array.isArray(configData)
      ? configData
      : [configData];

    logger.log(`[bulkPlaylist] Processing ${playlistFolders.length} folders in library "${libraryName}" (ID: ${libraryData.section.key})`);

    for (const playlistFolder of playlistFolders) {
      if (!playlistFolder) {
        retunMessage.message += "Skipping empty folder path entry.<br/>";
        continue;
      }

      const playlistName = path.basename(playlistFolder);
      const foundItems = findPlaylistTracks(allItems, playlistFolder);

      if (foundItems.length === 0) {
        retunMessage.message += `No items found in library "${libraryName}" for folder: ${playlistFolder}<br/>`;
        continue;
      }

      retunMessage.message += `Creating playlist: "${playlistName}" with ${foundItems.length} items. <br/>`;

      const itemKeys = foundItems.map((item) => item.ratingKey);
      await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys, libraryData.playlistType);
      retunMessage.message += `Playlist "${playlistName}" created successfully.<br/>`;
    }

    return retunMessage;
  } catch (error) {
    retunMessage.status = "error";
    retunMessage.message += `Error creating playlist: ${error.message}`;
    logger.error(`Error creating playlist: `, error.message);
    return retunMessage;
  }
}

/**
 * Creates a playlist of recently played tracks. If the playlist name already exists, it will be deleted first.
 */
export async function createRecentlyPlayedPlaylist(
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

    // Fetch recently items from both music and movie libraries
    let recentItems = await fetchRecentItems(client, "lastViewedAt", 100);
    recentItems = recentItems.filter((t) => t.lastViewedAt);

    if (recentItems.length === 0) {
      retunMessage.message += "No recently played items found. <br/>";
      retunMessage.status = "warning";
      return retunMessage;
    }

    retunMessage.message += `Found ${recentItems.length} recently played items. <br/>`;

    // Since items might come from different playlist types, we need to group them
    // For now, let's just create one playlist based on the majority or first item's type
    const mainType = recentItems[0].playlistType || "audio";
    const itemKeys = recentItems.map((item) => item.ratingKey);
    await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys, mainType);
    retunMessage.message += `Playlist "${playlistName}" created successfully with ${recentItems.length} items. <br/>`;
    return retunMessage;
  } catch (error) {
    logger.error(
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
export async function createRecentlyAddedPlaylist(
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

    let recentItems = await fetchRecentItems(client, "addedAt", 100);

    if (recentItems.length === 0) {
      retunMessage.message += "No recently added items found. <br/>";
      retunMessage.status = "warning";
      return retunMessage;
    }

    retunMessage.message += `Found ${recentItems.length} recently added items. <br/>`;

    const mainType = recentItems[0].playlistType || "audio";
    const itemKeys = recentItems.map((item) => item.ratingKey);
    await postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys, mainType);
    retunMessage.message += `Playlist "${playlistName}" created successfully with ${recentItems.length} items. <br/>`;
    return retunMessage;
  } catch (error) {
    logger.error(
      `Error creating recently added playlist "${playlistName}":`,
      error.message
    );
    retunMessage.status = "error";
    retunMessage.message += `Error creating recently added playlist "${playlistName}": ${error.message}`;
    return retunMessage;
  }
}
