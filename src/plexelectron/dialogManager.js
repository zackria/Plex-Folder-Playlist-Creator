const { dialog } = require("electron");
const { app } = require("electron");

/**
 * Shows a confirmation dialog for playlist deletion
 */
/**
 * Shows a confirmation dialog for playlist deletion
 */
async function confirmDeletePlaylist(window, data) {
  let message;
  if (!data || data.length === 0) {
    message = "Are you sure you want to delete all playlists?";
  } else {
    message = `Are you sure you want to delete this playlist ${data[0]} ${data[1]} ${data[2]}?`;
  }

  return dialog
    .showMessageBox(window, {
      type: "question",
      title: "Confirmation",
      message: message,
      buttons: ["Yes", "No"],
    })
    .then((result) => {
      return result.response === 0;
    });
}

/**
 * Shows app version information
 */
async function showVersionInfo(window) {
  const version = app.getVersion();
  return dialog.showMessageBox(window, {
    type: "info",
    title: `Plex Folder Playlist Creator - ${version}`,
    message: `Plex Folder Playlist Creator \n Version ${version} \n MIT License \n Copyright (c) 2025 Zack Dawood`,
    buttons: ["Ok"],
  });
}

module.exports = {
  confirmDeletePlaylist,
  showVersionInfo
};