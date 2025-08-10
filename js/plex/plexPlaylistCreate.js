const path = require("path");
const { createPlexClient } = require("./plexClient");

/**
 * Creates a playlist from an M3U file
 */
async function createM3UPlaylist(hostname, port, plextoken, timeout, parametersArray) {
  //console.log("createM3UPlaylist: ", hostname, port, plextoken, parametersArray);

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

    retunMessage.message += `Successfully queried all song tracks. Found: ${tracks.MediaContainer.Metadata.length} tracks. <br/>`;

    const foundPlaylistTracks = tracks.MediaContainer.Metadata.filter((track) =>
      track.Media[0].Part.some((part) => part.file.includes(playlistPath))
    );

    if (foundPlaylistTracks.length === 0) {
      retunMessage.message += `No tracks found for folder: ${playlistPath} <br/>`;
      retunMessage.status = "error";
      return retunMessage;
    }

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

      const foundPlaylistTracks = tracks.MediaContainer.Metadata.filter(
        (track) =>
          track.Media[0].Part.some((part) => part.file.includes(playlistFolder))
      );

      if (foundPlaylistTracks.length === 0) {
        retunMessage.message +=
          "No tracks found for folder: " + playlistFolder + " <br/>";
        continue;
      }

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
    const playlists = await client.query("/playlists");
    const existingPlaylist = playlists.MediaContainer.Metadata?.find(
      (playlist) => playlist.title === playlistName
    );

    if (existingPlaylist) {
      await client.deleteQuery(`/playlists/${existingPlaylist.ratingKey}`);
      retunMessage.message += `Existing playlist "${playlistName}" deleted. <br/>`;
    }

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
    let recentTracks = [];
    for (const library of musicLibraries) {
      const tracks = await client.query(
        `/library/sections/${library.key}/all?type=10&sort=lastViewedAt:desc&limit=50`
      );

      if (tracks.MediaContainer.Metadata) {
        recentTracks.push(
          ...tracks.MediaContainer.Metadata.filter(
            (track) => track.lastViewedAt // Only include tracks that have been played
          )
        );
      }
    }

    // Sort by last viewed date and limit to 100 most recent
    recentTracks.sort((a, b) => b.lastViewedAt - a.lastViewedAt);
    recentTracks = recentTracks.slice(0, 100);

    if (recentTracks.length === 0) {
      retunMessage.message += "No recently played tracks found. <br/>";
      retunMessage.status = "warning";
      return retunMessage;
    }

    retunMessage.message += `Found ${recentTracks.length} recently played tracks. <br/>`;

    // Extract rating keys and construct the URI
    const itemKeys = recentTracks.map((track) => track.ratingKey);
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
    const playlists = await client.query("/playlists");
    const existingPlaylist = playlists.MediaContainer.Metadata?.find(
      (playlist) => playlist.title === playlistName
    );

    if (existingPlaylist) {
      await client.deleteQuery(`/playlists/${existingPlaylist.ratingKey}`);
      retunMessage.message += `Existing playlist "${playlistName}" deleted. <br/>`;
    }

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

    // Fetch recently added tracks from each music library
    let recentTracks = [];
    for (const library of musicLibraries) {
      const tracks = await client.query(
        `/library/sections/${library.key}/all?type=10&sort=addedAt:desc&limit=50`
      );

      if (tracks.MediaContainer.Metadata) {
        recentTracks.push(...tracks.MediaContainer.Metadata);
      }
    }

    // Sort by added date and limit to 100 most recent
    recentTracks.sort((a, b) => b.addedAt - a.addedAt);
    recentTracks = recentTracks.slice(0, 100);

    if (recentTracks.length === 0) {
      retunMessage.message += "No recently added tracks found. <br/>";
      retunMessage.status = "warning";
      return retunMessage;
    }

    retunMessage.message += `Found ${recentTracks.length} recently added tracks. <br/>`;

    // Extract rating keys and construct the URI
    const itemKeys = recentTracks.map((track) => track.ratingKey);
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
