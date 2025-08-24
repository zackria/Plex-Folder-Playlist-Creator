const path = require("path");
const { createPlexClient, createPlexClientWithTimeout } = require("./plexClient");

// Security: cap input sizes for normalization and tokenization to avoid
// pathological regex/Unicode operations on attacker-controlled huge strings.
// These values are conservative and can be increased if needed, but ensure
// any regex work remains linear and bounded.
const MAX_NORMALIZE_LENGTH = 4096; // max chars for path normalization
const MAX_TOKEN_LENGTH = 512; // max chars for token normalization

function safeTruncate(s, max) {
  if (typeof s !== "string") return s;
  return s.length > max ? s.slice(0, max) : s;
}

// Detect percent-encoded sequences using a linear scan to avoid regex
// patterns that can be vulnerable to catastrophic backtracking on
// attacker-controlled input. This is intentionally simple and bounded
// because we always truncate inputs earlier with safeTruncate.
function looksLikePercentEncoded(str) {
  if (typeof str !== "string") return false;
  // Fast path: '%' must appear before any two hex chars
  for (let i = 0; i + 2 < str.length; i++) {
    if (str.charCodeAt(i) === 37) { // '%'
      const a = str.charCodeAt(i + 1);
      const b = str.charCodeAt(i + 2);
      const isHex = (cc) =>
        (cc >= 48 && cc <= 57) || // 0-9
        (cc >= 65 && cc <= 70) || // A-F
        (cc >= 97 && cc <= 102); // a-f
      if (isHex(a) && isHex(b)) return true;
    }
  }
  return false;
}

// Normalize paths for reliable substring comparison across OSes and encodings
function normalizeForCompare(p) {
  if (!p) return "";
  // Truncate early to avoid expensive regex/unicode ops on huge inputs
  p = safeTruncate(p, MAX_NORMALIZE_LENGTH);
  let decoded = p;
  // Only attempt decode if it contains a percent-encoded sequence; use
  // a linear-time check to avoid regex backtracking issues.
  if (looksLikePercentEncoded(p)) {
    try {
      decoded = decodeURIComponent(p);
    } catch (e) {
      // Keep original if decoding fails, but record a warning for diagnostics
      decoded = p; // fall back to original on decode failure
  console.warn('normalizeForCompare: decodeURIComponent failed, using original path', e?.message);
    }
  }
  // Replace a wide range of unicode spaces with a normal space
  const unicodeSpaceRegex = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;
  let norm = decoded
    .replace(/\\/g, "/")              // backslashes -> slashes
    .replace(unicodeSpaceRegex, " ")     // unicode spaces -> space
    .normalize("NFC")                    // unicode normalization (fix macOS vs Linux)
    .replace(/[‐‑–—−]/g, "-")            // normalize various dashes to hyphen-minus
    .replace(/\s+/g, " ")               // collapse multiple spaces
    .replace(/\/+$/g, "")               // trim trailing slashes
    .replace(/\/+/g, "/")               // collapse duplicate slashes
    .toLowerCase();                       // case-insensitive compare

  // Remove trailing dots from each path segment to account for FS/Plex trimming
  norm = norm
    .split("/")
    .map((seg) => seg.replace(/\.+$/g, ""))
    .join("/");

  return norm;
}

// Build candidate folder patterns to match against file paths
function buildFolderPatterns(inputPath) {
  const patterns = new Set();
  const normFull = normalizeForCompare(inputPath);
  const normFullTrimDot = normFull.replace(/\.+$/g, ""); // ignore trailing dots

  for (const variant of [normFull, normFullTrimDot]) {
    if (variant) patterns.add(`${variant}/`);
  }

  const base = normalizeForCompare(path.basename(inputPath));
  const baseTrimDot = base.replace(/\.+$/g, "");
  for (const b of [base, baseTrimDot]) {
    if (b) patterns.add(`/${b}/`);
  }

  return Array.from(patterns);
}

// Token normalization (remove all non a-z0-9) for punctuation-insensitive compare
function normalizeToken(s) {
  s = safeTruncate(s || "", MAX_TOKEN_LENGTH);
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[‐‑–—−]/g, "-")
    .replace(/[^a-z0-9]/g, "");
}

// --- Helper utilities to reduce duplication ---
async function getMachineIdentifier(client) {
  const serverInfo = await client.query("/");
  return serverInfo.MediaContainer.machineIdentifier;
}

async function getMusicLibraryByTitle(client, title) {
  const sections = await client.query("/library/sections");
  return sections.MediaContainer.Directory.find((section) => section.title === title);
}

function buildUriFromItemKeys(machineIdentifier, itemKeys) {
  return `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${itemKeys.join(",")}`;
}

async function postPlaylistByKeys(client, machineIdentifier, playlistName, itemKeys) {
  const uri = buildUriFromItemKeys(machineIdentifier, itemKeys);
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
      const fileNorm = normalizeForCompare(part.file);
      return patterns.some((p) => fileNorm.includes(p));
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

    await client.postQuery(
      `/playlists/upload?sectionID=${musicLibrary.key}&path=${playlistPath}`
    );
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
};
