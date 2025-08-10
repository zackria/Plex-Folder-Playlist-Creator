const PlexAPI = require("plex-api");

/**
 * Creates a Plex API client
 */
function createPlexClient(hostname, port, plextoken) {
  if (!hostname || typeof hostname !== "string" || hostname.trim() === "") {
    throw new Error("Invalid Plex Server hostname: Hostname must be a non-empty string.");
  }

  //console.log(`Creating Plex client with hostname: ${hostname}, port: ${port}`);

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
  const validTimeout = typeof timeout === "number" && timeout > 0 ? timeout : 60000; // Default to 60 seconds if invalid

  return new PlexAPI({
    hostname,
    port,
    token: plextoken,
    requestOptions: {
      timeout: validTimeout, // Use validated timeout value
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
    //console.log("Test connection successful. Server Info:", serverInfo);
    return serverInfo;
  } catch (error) {
    console.error("Error in plexClient.js at testConnection: Error connecting to Plex server:", error);
    console.error("Hostname:", hostname, "Port:", port, "Token:", plextoken, "Timeout:", timeout);
    return false;
  }
}

module.exports = {
  createPlexClient,
  createPlexClientWithTimeout,
  testConnection,
};
