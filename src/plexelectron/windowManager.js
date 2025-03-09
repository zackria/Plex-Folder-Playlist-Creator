const { BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  return new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });
}

module.exports = {
  createWindow
};