const PlexAPI = require("plex-api");

/**
 * Creates a Plex API client
 */
function createPlexClient(hostname, port, plextoken) {
  if (!hostname || typeof hostname !== "string" || hostname.trim() === "") {
    throw new Error("Invalid Plex Server hostname: Hostname must be a non-empty string.");
  }


  return new PlexAPI({
    hostname,
    port,
    token: plextoken,
    requestOptions: {
      timeout: 30000, // Increased timeout to 30 seconds
    },
  });
}

/**
 * Creates a Plex API client with custom timeout
 */
function createPlexClientWithTimeout(hostname, port, plextoken, timeout) {
  // Accept numeric strings from UI (e.g. "10") by coercing to Number.
  const parsed = Number(timeout);
  const validTimeout = Number.isFinite(parsed) && parsed > 0 ? parsed : 60000; // Default to 60 seconds if invalid

  return new PlexAPI({
    hostname,
    port,
    token: plextoken,
    requestOptions: {
      timeout: validTimeout, // Use validated timeout value (number)
    },
  });
}

/**
 * Tests connection to the Plex server
 */
async function testConnection(hostname, port, plextoken, timeout) {
  const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);

  try {
    const serverInfo = await client.query("/");
    // return structured success object so callers (UI) can easily distinguish
    // between success/failure and access error details when available
    return { success: true, data: serverInfo };
  } catch (error) {
    console.error("Error in plexClient.js at testConnection: Error connecting to Plex server:", error);
    console.error("Hostname:", hostname, "Port:", port, "Token:", plextoken, "Timeout:", timeout);
    // Build a compact, safe-to-serialize error object for the UI
    const safeError = {
      message: error?.message ?? String(error),
      name: error?.name ?? "Error",
      // plex-api errors may carry a response.statusCode
      statusCode: error?.statusCode ?? error?.response?.statusCode ?? null,
    };

    return { success: false, error: safeError };
  }
}

module.exports = {
  createPlexClient,
  createPlexClientWithTimeout,
  testConnection,
};
