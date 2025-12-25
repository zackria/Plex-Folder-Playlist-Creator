import { app } from "electron";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const settings = require("electron-settings");

/**
 * Gets API connection data and user preferences from settings
 */
export async function getAPIData() {
  console.log("[Settings] settings object:", typeof settings, Object.keys(settings));
  const [ipAddress, port, apiKey, theme, versionNo, timeout] = await Promise.all([
    settings.get("key.ipAddress"),
    settings.get("key.port"),
    settings.get("key.apiKey"),
    settings.get("userPreferences.theme"),
    settings.get("userPreferences.versionNo"),
    settings.get("key.timeout"), // Retrieve timeout
  ]);


  // Ensure timeout returned is a positive number; fall back to 60000 only
  // when stored value is missing or invalid.
  let timeoutValue;
  if (typeof timeout === 'number' && timeout > 0) {
    timeoutValue = timeout;
  } else {
    const p = Number(timeout);
    timeoutValue = Number.isFinite(p) && p > 0 ? p : 60000;
  }

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
export async function saveConfig(data) {
  console.log("[Settings] saveConfig called with:", data);
  // Coerce timeout to a number when saving so later reads are numeric.
  const rawTimeout = data[3];
  const parsed = Number(rawTimeout);
  const timeoutToSave = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

  try {
    await settings.set("key", {
      apiKey: data[0],
      ipAddress: data[1],
      port: data[2],
      timeout: timeoutToSave, // Save numeric timeout when valid
    });
    console.log("[Settings] settings.set successful.");
    return true;
  } catch (error) {
    console.error("[Settings] settings.set failed:", error);
    throw error;
  }
}

/**
 * Saves theme preference
 */
export function saveTheme(theme) {
  const versionNo = app.getVersion();
  settings.set("userPreferences", {
    theme: theme,
    versionNo: `v${versionNo}`,
  });
}
