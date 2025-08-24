const path = require('path');

// Security: cap input sizes for normalization and tokenization to avoid
// pathological regex/Unicode operations on attacker-controlled huge strings.
// These values are conservative and can be increased if needed, but ensure
// any regex work remains linear and bounded.
const MAX_NORMALIZE_LENGTH = 4096; // max chars for path normalization
const MAX_TOKEN_LENGTH = 512; // max chars for token normalization

function safeTruncate(s, max) {
  if (typeof s !== 'string') return s;
  return s.length > max ? s.slice(0, max) : s;
}

function looksLikePercentEncoded(str) {
  if (typeof str !== 'string') return false;
  for (let i = 0; i + 2 < str.length; i++) {
    if (str.charCodeAt(i) === 37) { // '%'
      const a = str.charCodeAt(i + 1);
      const b = str.charCodeAt(i + 2);
      const isHex = (cc) =>
        (cc >= 48 && cc <= 57) || // 0-9
        (cc >= 65 && cc <= 70) || // A-F
        (cc >= 97 && cc <= 102); // a-f
      if (isHex(a) && isHex(b)) return true;
    }
  }
  return false;
}

function normalizeForCompare(p) {
  if (!p) return "";
  p = safeTruncate(p, MAX_NORMALIZE_LENGTH);
  let decoded = p;
  if (looksLikePercentEncoded(p)) {
    try {
      decoded = decodeURIComponent(p);
    } catch (e) {
      decoded = p;
      console.warn('normalizeForCompare: decodeURIComponent failed, using original path', e?.message);
    }
  }

  function mapUnicodeSpacesToSpace(str) {
    if (!str) return str;
    const spaceSet = new Set([
      0x00A0, 0x1680,
      0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
      0x2008, 0x2009, 0x200A, 0x200B, 0x202F, 0x205F, 0x3000,
    ]);
    let out = "";
    for (let i = 0; i < str.length; i++) {
      const cp = str.charCodeAt(i);
      out += spaceSet.has(cp) ? " " : str[i];
    }
    return out;
  }

  function normalizeDashesToMinus(str) {
    if (!str) return str;
    const dashSet = new Set([0x2010, 0x2011, 0x2013, 0x2014, 0x2212]);
    let out = "";
    for (const ch of str) {
      const cp = ch.charCodeAt(0);
      out += dashSet.has(cp) ? "-" : ch;
    }
    return out;
  }

  function collapseAsciiSpaces(str) {
    if (!str) return str;
    let out = "";
    let inSpace = false;
    for (const ch of str) {
      if (ch === " ") {
        if (!inSpace) {
          out += ch;
          inSpace = true;
        }
      } else {
        out += ch;
        inSpace = false;
      }
    }
    return out;
  }

  function collapseSlashesAndTrim(str) {
    if (!str) return str;
    let out = "";
    for (const ch of str) {
      if (ch === "/") {
        if (out.length === 0 || !out.endsWith("/")) out += "/";
      } else {
        out += ch;
      }
    }
    if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
    return out;
  }

  function removeTrailingDotsFromSegments(str) {
    if (!str) return str;
    const parts = str.split("/");
    for (let i = 0; i < parts.length; i++) {
      let seg = parts[i];
      while (seg.length > 0 && seg.endsWith(".")) {
        seg = seg.slice(0, -1);
      }
      parts[i] = seg;
    }
    return parts.join("/");
  }

  let norm = decoded.replace(/\\/g, "/");
  norm = mapUnicodeSpacesToSpace(norm);
  norm = norm.normalize("NFC");
  norm = normalizeDashesToMinus(norm);
  norm = collapseAsciiSpaces(norm);
  norm = collapseSlashesAndTrim(norm);
  norm = norm.toLowerCase();

  norm = removeTrailingDotsFromSegments(norm);

  return norm;
}

function trimTrailingDots(str) {
  if (!str) return str;
  let end = str.length - 1;
  while (end >= 0 && str[end] === ".") end--;
  return str.slice(0, end + 1);
}

function buildFolderPatterns(inputPath) {
  const patterns = new Set();
  const normFull = normalizeForCompare(inputPath);
  const normFullTrimDot = trimTrailingDots(normFull);

  for (const variant of [normFull, normFullTrimDot]) {
    if (variant) patterns.add(`${variant}/`);
  }

  const base = normalizeForCompare(path.basename(inputPath));
  const baseTrimDot = trimTrailingDots(base);
  for (const b of [base, baseTrimDot]) {
    if (b) patterns.add(`/${b}/`);
  }

  return Array.from(patterns);
}

function normalizeToken(s) {
  s = safeTruncate(s || "", MAX_TOKEN_LENGTH);
  s = s.toLowerCase().normalize("NFC");
  let out = "";
  const dashSet = new Set([0x2010, 0x2011, 0x2013, 0x2014, 0x2212]);
  const spaceSet = new Set([
    0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
    0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x200B, 0x202F, 0x205F, 0x3000,
  ]);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const cp = s.charCodeAt(i);
    if (spaceSet.has(cp)) {
      continue;
    }
    if (dashSet.has(cp)) {
      continue;
    }
    const code = s.charCodeAt(i);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
      out += ch;
    }
  }
  return out;
}

module.exports = {
  MAX_NORMALIZE_LENGTH,
  MAX_TOKEN_LENGTH,
  safeTruncate,
  looksLikePercentEncoded,
  normalizeForCompare,
  trimTrailingDots,
  buildFolderPatterns,
  normalizeToken,
};
