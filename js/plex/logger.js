// Set to true to enable INFO, WARN, and DEBUG logs; false for only ERROR logs.
let debugMode = false;

export function setDebugMode(enabled) {
    debugMode = !!enabled;
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

/**
 * Logs debug info if debugMode is enabled
 */
export function debug(...args) {
    if (debugMode) {
        console.debug(...args);
    }
}

export default {
    setDebugMode,
    log,
    info,
    warn,
    error,
    debug
};
