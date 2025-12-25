/**
 * Global logging utility for Plex API modules.
 * Allows toggling non-error logs via a global configuration.
 */

let debugMode = true;

// Attempt to self-initialize from global electron data if present (renderer process context)
if (typeof globalThis !== "undefined" && globalThis.electronData?.data) {
    const flag = globalThis.electronData.data.enableConsole;
    debugMode = flag !== false && flag !== "false";
}

/**
 * Sets the global debug mode (enable/disable console logging)
 * @param {boolean|string} enabled 
 */
export function setDebugMode(enabled) {
    debugMode = enabled !== false && enabled !== "false";
}

/**
 * Logs data to console if debugMode is enabled
 */
export function log(...args) {
    if (debugMode) {
        console.log(...args);
    }
}

/**
 * Logs info to console if debugMode is enabled
 */
export function info(...args) {
    if (debugMode) {
        console.info(...args);
    }
}

/**
 * Logs warning to console if debugMode is enabled
 */
export function warn(...args) {
    if (debugMode) {
        console.warn(...args);
    }
}

/**
 * Always logs errors to the console
 */
export function error(...args) {
    console.error(...args);
}

export default {
    setDebugMode,
    log,
    info,
    warn,
    error
};
