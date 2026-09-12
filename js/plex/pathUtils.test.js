/**
 * Tests for symlink resolution helpers.
 * Run with: node --test js/plex/pathUtils.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { resolveSymlinks, preparePlexPath, isSymlink, scanFolderRealPaths } from './pathUtils.js';

test('resolveSymlinks returns a regular (non-symlinked) path unchanged', () => {
  const regularPath = '/usr/bin';
  assert.equal(resolveSymlinks(regularPath), regularPath);
});

test('resolveSymlinks handles null, undefined, and empty string without throwing', () => {
  assert.equal(resolveSymlinks(null), null);
  assert.equal(resolveSymlinks(undefined), undefined);
  assert.equal(resolveSymlinks(''), '');
});

test('resolveSymlinks returns the original path when it does not exist', () => {
  const fakePath = '/path/to/nowhere/that/does/not/exist';
  assert.equal(resolveSymlinks(fakePath), fakePath);
});

test('resolveSymlinks and isSymlink resolve a real symlink to its target', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plex-symlink-test-'));
  try {
    const targetDir = path.join(testDir, 'real-folder');
    const symlinkDir = path.join(testDir, 'link-folder');

    fs.mkdirSync(targetDir);
    fs.symlinkSync(targetDir, symlinkDir);

    assert.equal(resolveSymlinks(symlinkDir), fs.realpathSync(targetDir));
    assert.equal(isSymlink(symlinkDir), true);
    assert.equal(isSymlink(targetDir), false);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('preparePlexPath strips trailing slashes', () => {
  const messyPath = '/home/user/music///';
  const cleaned = preparePlexPath(messyPath);
  assert.equal(cleaned, '/home/user/music');
});

test('preparePlexPath preserves the root path', () => {
  assert.equal(preparePlexPath('/'), '/');
});

test('scanFolderRealPaths rejects relative and traversal paths', () => {
  assert.deepEqual(scanFolderRealPaths('../music'), []);
  assert.deepEqual(scanFolderRealPaths(`${os.tmpdir()}/music/../../private`), []);
});

test('scanFolderRealPaths scans an absolute directory without escaping it', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plex-path-scan-test-'));
  try {
    const trackPath = path.join(testDir, 'track.mp3');
    const ignoredPath = path.join(testDir, 'notes.txt');
    fs.writeFileSync(trackPath, '');
    fs.writeFileSync(ignoredPath, '');

    assert.deepEqual(scanFolderRealPaths(testDir), [fs.realpathSync(trackPath)]);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
