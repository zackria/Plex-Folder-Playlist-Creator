const PlexAPI = require("plex-api");

/**
 * Creates a Plex API client
 */
function createPlexClient(hostname, port, plextoken) {
  return new PlexAPI({
    hostname,
    port,
    token: plextoken,
    requestOptions: {
      timeout: 10000,
    },
  });
}

/**
 * Tests connection to the Plex server
 */
async function testConnection(hostname, port, plextoken) {
  const client = createPlexClient(hostname, port, plextoken);

  try {
    const serverInfo = await client.query("/");
    return serverInfo;
  } catch (error) {
    console.error("Error connecting to Plex server:", error);
    return false;
  }
}

module.exports = {
  createPlexClient,
  testConnection,
};
