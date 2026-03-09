import fs from 'node:fs';
import path from 'node:path';
import * as logger from './logger.js';

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
    const realPath = fs.realpathSync(inputPath);
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
  
  // Normalize path (handles /../, /./, removes trailing slash except root)
  const normalized = path.normalize(resolved);
  
  logger.debug(`[pathUtils] preparePlexPath: "${playlistPath}" → "${normalized}"`);
  return normalized;
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
    const stats = fs.lstatSync(inputPath);
    return stats.isSymbolicLink();
  } catch (err) {
    return false;
  }
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
    // First resolve the folder itself if it's a symlink
    const resolvedFolder = fs.realpathSync(folderPath);
    logger.log(`[pathUtils] Scanning playlist folder: "${resolvedFolder}"`);
    
    const entries = fs.readdirSync(resolvedFolder, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(resolvedFolder, entry.name);
      
      try {
        if (entry.isDirectory() && recursive) {
          // Recurse into subdirectories
          const subPaths = scanFolderRealPaths(fullPath, options);
          realPaths.push(...subPaths);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          // Resolve symlink to real path
          const realPath = fs.realpathSync(fullPath);
          
          // Filter by audio extension
          const ext = path.extname(realPath).toLowerCase();
          if (extensions.length === 0 || extensions.includes(ext)) {
            realPaths.push(realPath);
            
            if (fullPath !== realPath) {
              logger.debug(`[pathUtils] Resolved symlink: "${entry.name}" → "${realPath}"`);
            }
          }
        }
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
  scanFolderRealPaths
};
