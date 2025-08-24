const settings = require("electron-settings");
const { app } = require("electron");

/**
 * Gets API connection data and user preferences from settings
 */
async function getAPIData() {
  const [ipAddress, port, apiKey, theme, versionNo, timeout] = await Promise.all([
    settings.get("key.ipAddress"),
    settings.get("key.port"),
    settings.get("key.apiKey"),
    settings.get("userPreferences.theme"),
    settings.get("userPreferences.versionNo"),
    settings.get("key.timeout"), // Retrieve timeout
  ]);
  // Log what was retrieved so debugging can confirm stored values
  console.log('getAPIData: retrieved settings', {
    ipAddress,
    port,
    apiKey: apiKey ? '***' : undefined, // avoid printing tokens
    timeout,
  });

  // Ensure timeout returned is a positive number; fall back to 60000 only
  // when stored value is missing or invalid.
  let timeoutValue;
  if (typeof timeout === 'number' && timeout > 0) {
    timeoutValue = timeout;
  } else {
    const p = Number(timeout);
    timeoutValue = Number.isFinite(p) && p > 0 ? p : 60000;
  }

  console.log('getAPIData: returning timeout value', timeoutValue);

  return {
    ipaddress: ipAddress,
    port: port,
    key: apiKey,
    theme: theme,
    versionNo: versionNo,
    timeout: timeoutValue,
  };
}

/**
 * Saves API connection configuration
 */
async function saveConfig(data) {
  // Coerce timeout to a number when saving so later reads are numeric.
  const rawTimeout = data[3];
  const parsed = Number(rawTimeout);
  const timeoutToSave = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

  // Log what we're saving for troubleshooting; hide token value
  console.log('saveConfig: saving settings', {
    apiKey: data[0] ? '***' : undefined,
    ipAddress: data[1],
    port: data[2],
    rawTimeout,
    timeoutToSave,
  });

  return settings.set("key", {
    apiKey: data[0],
    ipAddress: data[1],
    port: data[2],
    timeout: timeoutToSave, // Save numeric timeout when valid
  });
}

/**
 * Saves theme preference
 */
function saveTheme(theme) {
  const versionNo = app.getVersion();
  settings.set("userPreferences", {
    theme: theme,
    versionNo: `v${versionNo}`,
  });
}

module.exports = {
  getAPIData,
  saveConfig,
  saveTheme,
};
