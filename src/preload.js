const { contextBridge, ipcRenderer } = require("electron");

// Read the data passed in the URL query string
const urlParams = new URLSearchParams(globalThis.location.search);
const dataFromMain = Object.fromEntries(urlParams.entries());

// Expose data to the renderer process
contextBridge.exposeInMainWorld("electronData", {
  data: dataFromMain,
});

contextBridge.exposeInMainWorld("ipcRenderer", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) =>
    ipcRenderer.on(channel, (event, ...args) => callback(...args)),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
