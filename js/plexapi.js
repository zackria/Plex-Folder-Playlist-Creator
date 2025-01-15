const PlexAPI = require("plex-api");
const path = require("path");

function createPlexClient( hostname, port, plextoken ) {
  return new PlexAPI({
    hostname,
    port,
    token: plextoken,
    requestOptions: {
      timeout: 10000,
    },
  });
}

async function testConnection(hostname, port, plextoken ) {
  const client = createPlexClient( hostname, port, plextoken );

  try {
    const serverInfo = await client.query("/");
    return serverInfo;
  } catch (error) {
    console.error("Error connecting to Plex server:", error);
    return false;
  }
}

async function getPlaylist(hostname, port, plextoken ) {
  const client = createPlexClient( hostname, port, plextoken );

  try {
    const result = await client.query("/playlists");
    const playlists = result.MediaContainer.Metadata || [];
    return playlists;
  } catch (error) {
    console.error("Error connecting to Plex server:", error);
    return false;
  }
}

async function deletePlaylist( hostname, port, plextoken, playlistId ) {
  if (!playlistId) {
    return false;
  }

  const client = createPlexClient( hostname, port, plextoken );

  try {
    await client.deleteQuery(`/playlists/${playlistId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting playlist with ID ${playlistId}:`, error.message);
    return false;
  }
}

async function refreshPlaylist(hostname, port, plextoken ) {
  const client = createPlexClient(hostname, port, plextoken );

  try {
    await client.perform("/library/sections/all/refresh");
    return true;
  } catch (error) {
    console.error(`Error refreshing playlist: `, error.message);
    return false;
  }
}

async function createM3UPlaylist( hostname, port, plextoken, playlistPath ) {
  const client = createPlexClient(hostname, port, plextoken );
  let retunMessage = {status: "success", message: ""};

  try {

    const sections = await client.query("/library/sections");
    const musicLibrary = sections.MediaContainer.Directory.find(
      (section) => section.title === "Music"
    );

    if (!musicLibrary) {
      console.error(`Music library "Music" not found.`);
      retunMessage.message += `Music library "Music" not found. <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    await client.postQuery(`/playlists/upload?sectionID=${musicLibrary.key}&path=${playlistPath}`);
    retunMessage.message = "Playlist will be created if path exists";

    return retunMessage;
  } catch (error) {
    console.error(`Error creating playlist with name ${playlistPath}:`, error.message);
    retunMessage.status = "error";
    retunMessage.message += `Error creating playlist with name ${playlistPath}: ${error.message}`;
    return retunMessage;
  }
}

async function createPlaylist( hostname, port, plextoken, playlistPath ) {
  const client = createPlexClient(hostname, port, plextoken );
  let retunMessage = {status: "success", message: ""};

  try {
    const serverInfo = await client.query("/");
    const machineIdentifier = serverInfo.MediaContainer.machineIdentifier;

    const sections = await client.query("/library/sections");
    const musicLibrary = sections.MediaContainer.Directory.find(
      (section) => section.title === "Music"
    );

    if (!musicLibrary) {
      console.error(`Music library "Music" not found.`);
      retunMessage.message += `Music library "Music" not found. <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

    const tracks = await client.query(
      `/library/sections/${musicLibrary.key}/all?type=10`
    );

    // console.log(
    //   `Successfully queried all song tracks. Found: ${tracks.MediaContainer.Metadata.length} tracks.`
    // );

    retunMessage.message += `Successfully queried all song tracks. Found: ${tracks.MediaContainer.Metadata.length} tracks. <br/>`;

    const playlistName = path.basename(playlistPath);
    const foundPlaylistTracks = tracks.MediaContainer.Metadata.filter((track) =>
      track.Media[0].Part.some((part) => part.file.includes(playlistPath))
    );

    if (foundPlaylistTracks.length === 0) {
      // console.log(`No tracks found for folder: ${playlistPath}`);
      retunMessage.message += `No tracks found for folder: ${playlistPath} <br/>`;

      retunMessage.status = "error";
      return retunMessage;
    }

    // console.log(
    //   `Creating playlist: "${playlistName}" with ${foundPlaylistTracks.length} tracks.`
    // );

    retunMessage.message += `Creating playlist: "${playlistName}" with ${foundPlaylistTracks.length} tracks. <br/>`;

    const itemKeys = foundPlaylistTracks.map((track) => track.ratingKey);
    const uri = `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${itemKeys.join(
      ","
    )}`;

    const queryParameters = new URLSearchParams({
      type: "audio",
      title: playlistName,
      smart: "0",
      uri,
    }).toString();
    const queryPath = `/playlists?${queryParameters}`;

    await client.postQuery(queryPath);
    return retunMessage;
  } catch (error) {
    console.error(`Error creating playlist with name ${playlistPath}:`, error.message);
    retunMessage.status = "error";
    retunMessage.message += `Error creating playlist with name ${playlistPath}: ${error.message}`;
    return retunMessage;
  }
}

async function bulkPlaylist( hostname, port, plextoken, playlistArray ) {
  const client = createPlexClient(hostname, port, plextoken );

  let retunMessage = {status: "success", message: ""};

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
    const playlistFolders = Array.isArray(configData) ? configData : [configData];

    for (const playlistFolder of playlistFolders) {
      const playlistName = path.basename(playlistFolder);

      const foundPlaylistTracks = tracks.MediaContainer.Metadata.filter((track) =>
        track.Media[0].Part.some((part) => part.file.includes(playlistFolder))
      );

      if (foundPlaylistTracks.length === 0) {
        // console.log(`No tracks found for folder: ${playlistFolder}`);
         retunMessage.message += "No tracks found for folder: "+playlistFolder+" <br/>";

        continue;
      }

      // console.log(
      //   `Creating playlist: "${playlistName}" with ${foundPlaylistTracks.length} tracks.`
      // );

      retunMessage.message += `Creating playlist: "${playlistName}" with ${foundPlaylistTracks.length} tracks. <br/>`;

  

      const itemKeys = foundPlaylistTracks.map((track) => track.ratingKey);
      const uri = `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${itemKeys.join(
        ","
      )}`;

      const queryParameters = new URLSearchParams({
        type: "audio",
        title: playlistName,
        smart: "0",
        uri,
      }).toString();
      const queryPath = `/playlists?${queryParameters}`;

      await client.postQuery(queryPath);
      // console.log(`Playlist "${playlistName}" created successfully.`);
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

module.exports = {
  testConnection,
  getPlaylist,
  deletePlaylist,
  refreshPlaylist,
  createPlaylist,
  bulkPlaylist,
  createM3UPlaylist,
};
