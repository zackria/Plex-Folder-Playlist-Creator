import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as logger from './logger.js';

/**
 * Validates a user-supplied path before it is used in any filesystem call.
 * This app intentionally lets users point at any file or folder on disk
 * (there is no single safe "base" directory to confine paths to), but the
 * raw string still comes straight from renderer text input, so it must be
 * checked for the classic path-traversal poison inputs - embedded NUL
 * bytes and non-string/empty values - and canonicalized to an absolute
 * path before being handed to fs.*Sync().
 *
 * @param {string} inputPath - Raw, user-supplied path
 * @returns {string} Canonicalized absolute path, safe to pass to fs calls
 * @throws {Error} If the path is not a safe, well-formed filesystem path
 */
function validatePath(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.length === 0) {
    throw new Error('Path must be a non-empty string');
  }

  // Poison null byte: some native fs implementations truncate at \0,
  // which can be abused to bypass extension/suffix checks elsewhere.
  if (inputPath.includes('\0')) {
    throw new Error('Path contains an invalid NUL byte');
  }

  // Folder paths arrive over IPC. Requiring an absolute path prevents their
  // interpretation relative to the application's working directory.
  if (!path.isAbsolute(inputPath)) {
    throw new Error('Path must be absolute');
  }

  // Reject traversal syntax rather than merely normalizing it away. This
  // ensures an input such as /allowed/music/../../private is never accepted
  // by a filesystem operation under the guise of its normalized value.
  const segments = inputPath.split(/[\\/]+/u);
  if (segments.includes('..')) {
    throw new Error('Path traversal segments are not allowed');
  }

  return path.normalize(inputPath);
}

/**
 * Builds a child path and verifies that it remains inside its parent.
 * Directory-entry names normally cannot contain separators, but retaining
 * this invariant at the filesystem boundary protects against unexpected or
 * mocked Dirent values as well.
 */
function resolveContainedPath(parentPath, entryName) {
  const childPath = path.resolve(parentPath, entryName);
  const relativePath = path.relative(parentPath, childPath);

  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`Directory entry escapes the selected folder: "${entryName}"`);
  }

  return childPath;
}

/**
 * Resolves symlinks and aliases to their real filesystem path.
 * Returns the original path if resolution fails or if in browser context.
 *
 * Platform support:
 * - macOS: Handles Finder aliases and Unix symlinks
 * - Linux: Resolves symlinks created with ln -s
 * - Windows: Resolves symlinks, junction points, and hard links
 *   Note: Creating symlinks on Windows requires admin rights or Developer Mode
 *
 * @param {string} inputPath - Path that may contain symlinks
 * @returns {string} Resolved real path, or original if unavailable
 */
export function resolveSymlinks(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return inputPath;
  }

  // Check if fs is available (main process only, not browser)
  if (typeof fs?.realpathSync !== 'function') {
    logger.warn('[pathUtils] fs.realpathSync unavailable (browser context?)');
    return inputPath;
  }

  try {
    const validatedPath = validatePath(inputPath);
    const realPath = fs.realpathSync(validatedPath);
    if (realPath !== inputPath) {
      logger.log(`[pathUtils] Resolved symlink: "${inputPath}" → "${realPath}"`);
    }
    return realPath;
  } catch (err) {
    // Path doesn't exist, permission error, or broken symlink
    logger.warn(`[pathUtils] Failed to resolve "${inputPath}": ${err.message}`);
    return inputPath;
  }
}

/**
 * Strips wrapping quote characters some tools add around paths containing
 * spaces or special characters (e.g. `ls`'s shell-quoting style, common
 * when a path list is built by copy-pasting a directory listing). Only
 * strips when both the leading and trailing character match, so a path
 * that legitimately starts and ends with a quote is left untouched.
 *
 * @param {string} inputPath - Path that may be wrapped in quotes
 * @returns {string} Path with matching wrapping quotes removed
 */
export function stripWrappingQuotes(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return inputPath;
  }

  const trimmed = inputPath.trim();
  const first = trimmed[0];
  const last = trimmed.at(-1);

  if (trimmed.length >= 2 && (first === "'" || first === '"') && first === last) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Normalizes and resolves a playlist path for Plex matching.
 * 
 * Steps:
 * 1. Resolve symlinks/aliases to real paths
 * 2. Normalize path separators and trailing slashes
 * 3. Return cleaned path for comparison with Plex database paths
 * 
 * @param {string} playlistPath - User-provided path from dialog or text input
 * @returns {string} Resolved and normalized path
 */
export function preparePlexPath(playlistPath) {
  if (!playlistPath || typeof playlistPath !== 'string') {
    return playlistPath;
  }

  // Resolve symlinks first
  const resolved = resolveSymlinks(playlistPath);

  // Normalize path (handles /../, /./), then strip any trailing separator
  // left behind by normalize() (it collapses "///" to "/" but does not
  // remove a single trailing slash), except for the root path itself.
  const normalized = path.normalize(resolved);
  let cleaned = normalized;
  while (cleaned.length > 1 && (cleaned.endsWith('/') || cleaned.endsWith('\\'))) {
    cleaned = cleaned.slice(0, -1);
  }

  logger.debug(`[pathUtils] preparePlexPath: "${playlistPath}" → "${cleaned}"`);
  return cleaned;
}

/**
 * Checks if a path is likely a symlink (doesn't guarantee, requires fs.lstat)
 * This is a helper for UI feedback, not for resolution logic.
 * 
 * @param {string} inputPath - Path to check
 * @returns {boolean} True if path is a symlink
 */
export function isSymlink(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }

  if (typeof fs?.lstatSync !== 'function') {
    return false;
  }

  try {
    const validatedPath = validatePath(inputPath);
    const stats = fs.lstatSync(validatedPath);
    return stats.isSymbolicLink();
  } catch (err) {
    logger.debug(`[pathUtils] isSymlink: unable to stat "${inputPath}": ${err.message}`);
    return false;
  }
}

/**
 * Resolves a single directory entry to the real path(s) it represents,
 * recursing into subdirectories when requested and filtering by extension.
 * Extracted from scanFolderRealPaths to keep its cognitive complexity low.
 *
 * @param {string} resolvedFolder - Real path of the containing folder
 * @param {import('node:fs').Dirent} entry - Directory entry being processed
 * @param {{ recursive: boolean, extensions: string[] }} options
 * @returns {string[]} Real paths contributed by this entry
 */
function collectRealPathsForEntry(resolvedFolder, entry, { recursive, extensions }) {
  const fullPath = resolveContainedPath(resolvedFolder, entry.name);

  if (entry.isDirectory() && recursive) {
    return scanFolderRealPaths(fullPath, { recursive, extensions });
  }

  if (!entry.isFile() && !entry.isSymbolicLink()) {
    return [];
  }

  const realPath = fs.realpathSync(fullPath);
  const ext = path.extname(realPath).toLowerCase();
  if (extensions.length > 0 && !extensions.includes(ext)) {
    return [];
  }

  if (fullPath !== realPath) {
    logger.debug(`[pathUtils] Resolved symlink: "${entry.name}" → "${realPath}"`);
  }

  return [realPath];
}

/**
 * Scans a folder and returns the real paths of all files (resolving symlinks).
 *
 * This is the KEY function for symlink playlist support:
 * - Reads all files in the folder (including symlinks)
 * - Resolves each symlink to its real target path
 * - Returns the real paths that Plex has stored
 *
 * @param {string} folderPath - Path to playlist folder
 * @param {object} options - { recursive: boolean, extensions: string[] }
 * @returns {string[]} Array of resolved real file paths
 */
export function scanFolderRealPaths(folderPath, options = {}) {
  const {
    recursive = false,  // Don't recurse by default for playlists
    extensions = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.aac', '.wma', '.ape', '.opus']
  } = options;

  if (!folderPath || typeof folderPath !== 'string') {
    logger.warn('[pathUtils] scanFolderRealPaths: Invalid folder path');
    return [];
  }

  // Check if fs methods are available (main process only)
  if (!fs?.readdirSync || !fs?.statSync || !fs?.realpathSync) {
    logger.warn('[pathUtils] File system methods unavailable (browser context?)');
    return [];
  }

  const realPaths = [];

  try {
    // Validate the raw user-supplied path before it touches the filesystem,
    // then resolve the folder itself (in case it's a symlink).
    const validatedFolder = validatePath(folderPath);
    const resolvedFolder = fs.realpathSync(validatedFolder);

    // Convert the validated canonical path to an encoded file URL before it
    // reaches a filesystem API. This avoids passing renderer-controlled path
    // text directly to stat/readdir and safely represents characters such as
    // '#', '%' and spaces on every supported platform.
    const resolvedFolderUrl = pathToFileURL(resolvedFolder);

    // realpathSync above proves the target exists; stat verifies that the
    // resolved target is a directory rather than a file or special node.
    if (!fs.statSync(resolvedFolderUrl).isDirectory()) {
      logger.warn(`[pathUtils] "${resolvedFolder}" is not a directory, skipping scan`);
      return [];
    }

    logger.log(`[pathUtils] Scanning playlist folder: "${resolvedFolder}"`);

    const entries = fs.readdirSync(resolvedFolderUrl, { withFileTypes: true });

    for (const entry of entries) {
      try {
        realPaths.push(...collectRealPathsForEntry(resolvedFolder, entry, { recursive, extensions }));
      } catch (err) {
        logger.warn(`[pathUtils] Skipping "${entry.name}": ${err.message}`);
        // Continue processing other files even if one fails
      }
    }

    logger.log(`[pathUtils] Found ${realPaths.length} audio files in folder`);
    return realPaths;

  } catch (err) {
    logger.error(`[pathUtils] Failed to scan folder "${folderPath}": ${err.message}`);
    return [];
  }
}

export default {
  resolveSymlinks,
  preparePlexPath,
  isSymlink,
  scanFolderRealPaths,
  stripWrappingQuotes
};
