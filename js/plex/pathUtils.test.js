/**
 * Manual test script for symlink resolution
 * Run with: node js/plex/pathUtils.test.js
 */

import { resolveSymlinks, preparePlexPath, isSymlink } from './pathUtils.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

console.log('🔗 Testing Symlink Resolution\n');

// Test 1: Non-symlink path
console.log('Test 1: Regular path');
const regularPath = '/usr/bin';
const resolved1 = resolveSymlinks(regularPath);
console.log(`  Input:  ${regularPath}`);
console.log(`  Output: ${resolved1}`);
console.log(`  Status: ${resolved1 === regularPath ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Null/undefined handling
console.log('Test 2: Null/undefined handling');
console.log(`  null → ${resolveSymlinks(null)}`);
console.log(`  undefined → ${resolveSymlinks(undefined)}`);
console.log(`  empty string → "${resolveSymlinks('')}"`);
console.log(`  Status: ✅ PASS (no crash)\n`);

// Test 3: Non-existent path
console.log('Test 3: Non-existent path');
const fakePath = '/path/to/nowhere/that/does/not/exist';
const resolved3 = resolveSymlinks(fakePath);
console.log(`  Input:  ${fakePath}`);
console.log(`  Output: ${resolved3}`);
console.log(`  Status: ${resolved3 === fakePath ? '✅ PASS (returned original)' : '❌ FAIL'}\n`);

// Test 4: Create and test real symlink
console.log('Test 4: Real symlink');
try {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plex-symlink-test-'));
  const targetDir = path.join(testDir, 'real-folder');
  const symlinkDir = path.join(testDir, 'link-folder');
  
  fs.mkdirSync(targetDir);
  fs.symlinkSync(targetDir, symlinkDir);
  
  const resolved4 = resolveSymlinks(symlinkDir);
  const prepared4 = preparePlexPath(symlinkDir);
  const isSym = isSymlink(symlinkDir);
  
  console.log(`  Target:   ${targetDir}`);
  console.log(`  Symlink:  ${symlinkDir}`);
  console.log(`  Resolved: ${resolved4}`);
  console.log(`  Prepared: ${prepared4}`);
  console.log(`  isSymlink: ${isSym}`);
  console.log(`  Status: ${resolved4 === targetDir && isSym ? '✅ PASS' : '❌ FAIL'}`);
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log(`  Cleanup: ✅ Done\n`);
} catch (err) {
  console.error(`  ❌ ERROR: ${err.message}\n`);
}

// Test 5: preparePlexPath integration
console.log('Test 5: preparePlexPath with trailing slashes');
const messyPath = '/home/user/music///';
const cleaned = preparePlexPath(messyPath);
console.log(`  Input:  "${messyPath}"`);
console.log(`  Output: "${cleaned}"`);
console.log(`  Status: ${!cleaned.endsWith('/') || cleaned === '/' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('✅ All tests completed!');
