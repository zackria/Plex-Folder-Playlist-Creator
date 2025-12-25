import { XMLParser } from "fast-xml-parser";
import os from "node:os";
import { createRequire } from "node:module";

import logger from "./logger.js";

const require = createRequire(import.meta.url);
const fetch = require("node-fetch");

const CLIENT_IDENTIFIER = "PFPC-" + (os.hostname() || "node") + "-" + Date.now().toString(36);

function validateHostname(hostname) {
  if (!hostname || typeof hostname !== "string" || hostname.trim() === "") {
    throw new Error("Invalid Plex Server hostname: Hostname must be a non-empty string.");
  }
}

function buildBaseUrl(hostname, port) {
  // Allow hostname to include protocol. Default to http if not provided.
  if (/^https?:\/\//i.test(hostname)) {
    return port ? `${hostname.replace(/\/$/, "")}:${port}` : hostname.replace(/\/$/, "");
  }
  const proto = port === 443 ? "https" : "http";
  const portSuffix = port ? `:${port}` : "";
  return `${proto}://${hostname}${portSuffix}`;
}

function buildUrl(baseUrl, path, token) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const sep = normalizedPath.includes("?") ? "&" : "?";
  const tokenQuery = token ? `${sep}X-Plex-Token=${encodeURIComponent(token)}` : "";
  return `${baseUrl}${normalizedPath}${tokenQuery}`;
}

function defaultTimeoutMs(timeout) {
  const parsed = Number(timeout);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
}

export function createPlexClient(hostname, port, plextoken, timeoutMs) {
  validateHostname(hostname);
  const baseUrl = buildBaseUrl(hostname, port);
  const options = {
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: true, // Auto-convert numbers and booleans
    allowBooleanAttributes: true,
    isArray: (name, jpath, isLeafNode, isAttribute) => {
      // Comprehensive list based on Plex API Schema
      return [
        "Metadata", "Directory", "Media", "Part", "Stream",
        "Server", "Hub", "Provider", "Genre", "Country",
        "Director", "Writer", "Producer", "Role", "Playlist", "User",
        "Photo", "Video", "Artist", "Album", "Track", "Collection", "Field",
        "Image", "Guid", "Tag", "Label", "Similar", "Studio", "Rating",
        "Network", "SeasonType", "Location", "Device", "Setting"
      ].includes(name);
    }
  };
  const parser = new XMLParser(options);
  const timeout = defaultTimeoutMs(timeoutMs);

  const headers = {
    "X-Plex-Client-Identifier": CLIENT_IDENTIFIER,
    "X-Plex-Product": "Plex Folder Playlist Creator",
    "X-Plex-Version": "1.0.5",
    "X-Plex-Device": os.platform(),
    "X-Plex-Device-Name": os.hostname(),
    "X-Plex-Platform": "Node.js",
    "X-Plex-Platform-Version": process.version,
    "X-Plex-Provides": "controller",
    "Accept": "application/xml"
  };

  if (plextoken) {
    headers["X-Plex-Token"] = plextoken;
  }

  const createError = (res) => {
    const err = new Error(`Request failed with status ${res.status}`);
    err.statusCode = res.status;
    // Mimic plex-api error structure which typically includes a response object
    err.response = {
      statusCode: res.status,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers
    };
    return err;
  };

  return {
    async query(path) {
      const url = buildUrl(baseUrl, path, plextoken);
      // Mask token in logs
      const maskedUrl = url.replace(/X-Plex-Token=[^&]+/, "X-Plex-Token=REDACTED");
      logger.log(`[PlexClient] Querying: ${maskedUrl}`);
      try {
        const res = await fetch(url, { method: "GET", headers, timeout });
        logger.log(`[PlexClient] Response Status: ${res.status}`);

        if (!res.ok) {
          throw createError(res);
        }

        const text = await res.text();
        // Check for empty response
        if (!text || text.trim() === "") {
          logger.warn("[PlexClient] Empty response text received.");
          return {};
        }

        try {
          const parsed = parser.parse(text);
          // NEW: fast-xml-parser returns direct children as properties.
          // If <Playlist> tags exist, they are under parsed.MediaContainer.Playlist
          // Old plex-api might have normalized this to Metadata, but here we see raw structure is Playlist.
          // We need to support both or verify where the caller expects it.
          // Since existing code expects Metadata, let's polyfill it.
          if (parsed.MediaContainer) {
            // Polyfill: If Playlist exists but Metadata doesn't, map Playlist to Metadata
            if (parsed.MediaContainer.Playlist && !parsed.MediaContainer.Metadata) {
              parsed.MediaContainer.Metadata = parsed.MediaContainer.Playlist;
            }
            // Polyfill: If Directory exists but Metadata doesn't (some endpoints return Directory)
            if (parsed.MediaContainer.Directory && !parsed.MediaContainer.Metadata) {
              parsed.MediaContainer.Metadata = parsed.MediaContainer.Directory;
            }
            // Polyfill: If Track exists but Metadata doesn't (some endpoints return Track for type=10)
            if (parsed.MediaContainer.Track && !parsed.MediaContainer.Metadata) {
              parsed.MediaContainer.Metadata = parsed.MediaContainer.Track;
            }
          }
          return parsed;
        } catch (e) {
          // Fallback for non-XML responses
          logger.warn("[PlexClient] Parsing failed, returning text:", e.message);
          return text;
        }
      } catch (err) {
        logger.error(`[PlexClient] Request failed: ${err.message}`);
        throw err;
      }
    },

    async postQuery(path) {
      const url = buildUrl(baseUrl, path, plextoken);
      const res = await fetch(url, { method: "POST", headers, timeout });

      if (!res.ok) {
        throw createError(res);
      }

      const text = await res.text();
      try {
        return parser.parse(text);
      } catch (e) {
        logger.warn("[PlexClient] postQuery parsing failed, returning text:", e.message);
        return text;
      }
    },

    async deleteQuery(path) {
      const url = buildUrl(baseUrl, path, plextoken);
      const res = await fetch(url, { method: "DELETE", headers, timeout });

      if (!res.ok) {
        throw createError(res);
      }
      return true;
    },

    async perform(path) {
      const url = buildUrl(baseUrl, path, plextoken);
      const res = await fetch(url, { method: "POST", headers, timeout });

      if (!res.ok) {
        throw createError(res);
      }

      const text = await res.text();
      try {
        return parser.parse(text);
      } catch (e) {
        logger.warn("[PlexClient] perform parsing failed, returning text:", e.message);
        return text;
      }
    },
  };
}

export function createPlexClientWithTimeout(hostname, port, plextoken, timeout) {
  validateHostname(hostname);
  return createPlexClient(hostname, port, plextoken, timeout);
}

export async function testConnection(hostname, port, plextoken, timeout) {
  logger.log(`[PlexClient] Testing connection to ${hostname}:${port}...`);
  try {
    const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
    const serverInfo = await client.query("/");
    logger.log("[PlexClient] Connection successful.");
    return { success: true, data: serverInfo };
  } catch (error) {
    logger.error(`[PlexClient] Connection failed for ${hostname}:${port}:`, error);
    const safeError = {
      message: error?.message ?? String(error),
      name: error?.name ?? "Error",
      stack: error?.stack,
      statusCode: error?.statusCode ?? error?.response?.statusCode ?? null,
    };
    return { success: false, error: safeError };
  }
}
