const fetch = require("node-fetch");
const { XMLParser } = require("fast-xml-parser");
const os = require("os");

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
  return `${proto}://${hostname}${port ? `:${port}` : ""}`;
}

function buildUrl(baseUrl, path, token) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const sep = normalizedPath.includes("?") ? "&" : "?";
  return `${baseUrl}${normalizedPath}${token ? `${sep}X-Plex-Token=${encodeURIComponent(token)}` : ""}`;
}

function defaultTimeoutMs(timeout) {
  const parsed = Number(timeout);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
}

function createPlexClient(hostname, port, plextoken, timeoutMs) {
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
      console.log(`[PlexClient] Querying: ${maskedUrl}`);
      try {
        const res = await fetch(url, { method: "GET", headers, timeout });
        console.log(`[PlexClient] Response Status: ${res.status}`);

        if (!res.ok) {
          throw createError(res);
        }

        const text = await res.text();
        // Check for empty response
        if (!text || text.trim() === "") {
          console.warn("[PlexClient] Empty response text received.");
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
          console.warn("[PlexClient] Parsing failed, returning text:", e.message);
          return text;
        }
      } catch (err) {
        console.error(`[PlexClient] Request failed: ${err.message}`);
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
        return text;
      }
    },
  };
}

function createPlexClientWithTimeout(hostname, port, plextoken, timeout) {
  validateHostname(hostname);
  return createPlexClient(hostname, port, plextoken, timeout);
}

async function testConnection(hostname, port, plextoken, timeout) {
  try {
    const client = createPlexClientWithTimeout(hostname, port, plextoken, timeout);
    const serverInfo = await client.query("/");
    return { success: true, data: serverInfo };
  } catch (error) {
    console.error("Error in plexClient.js at testConnection: Error connecting to Plex server:", error);
    const safeError = {
      message: error?.message ?? String(error),
      name: error?.name ?? "Error",
      statusCode: error?.statusCode ?? null,
    };
    return { success: false, error: safeError };
  }
}

module.exports = {
  createPlexClient,
  createPlexClientWithTimeout,
  testConnection,
};
