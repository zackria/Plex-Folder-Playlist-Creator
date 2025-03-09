const settings = require("electron-settings");
const { app } = require("electron");

/**
 * Gets API connection data and user preferences from settings
 */
async function getAPIData() {
  const [ipAddress, port, apiKey, theme, versionNo] = await Promise.all([
    settings.get("key.ipAddress"),
    settings.get("key.port"),
    settings.get("key.apiKey"),
    settings.get("userPreferences.theme"),
    settings.get("userPreferences.versionNo"),
  ]);

  return {
    ipaddress: ipAddress,
    port: port,
    key: apiKey,
    theme: theme,
    versionNo: versionNo,
  };
}

/**
 * Saves API connection configuration
 */
async function saveConfig(data) {
  return settings.set("key", {
    apiKey: data[0],
    ipAddress: data[1],
    port: data[2],
  });
}

/**
 * Saves theme preference
 */
function saveTheme(theme) {
  const versionNo = app.getVersion();
  settings.set("userPreferences", {
    theme: theme,
    versionNo: `v ${versionNo}`,
  });
}

module.exports = {
  getAPIData,
  saveConfig,
  saveTheme
};