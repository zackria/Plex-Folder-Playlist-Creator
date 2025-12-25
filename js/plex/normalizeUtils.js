const path = require('node:path');

// Conservative limits to avoid excessive work on attacker-controlled inputs
const MAX_NORMALIZE_LENGTH = 4096;
const MAX_TOKEN_LENGTH = 512;

function safeTruncate(s, max) {
  if (typeof s !== 'string') return s;
  return s.length > max ? s.slice(0, max) : s;
}

function looksLikePercentEncoded(str) {
  if (typeof str !== 'string') return false;
  for (let i = 0; i + 2 < str.length; i++) {
    if (str.codePointAt(i) === 37) { // '%'
      const a = str.codePointAt(i + 1);
      const b = str.codePointAt(i + 2);
      const isHex = (cc) => (cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 70) || (cc >= 97 && cc <= 102);
      if (isHex(a) && isHex(b)) return true;
    }
  }
  return false;
}

const _SPACE_SET = new Set([0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x200B, 0x202F, 0x205F, 0x3000]);
const _DASH_SET = new Set([0x2010, 0x2011, 0x2013, 0x2014, 0x2212]);

function _mapUnicodeSpacesToSpace(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const cp = str.codePointAt(i);
    out += _SPACE_SET.has(cp) ? ' ' : ch;
  }
  return out;
}

function _normalizeDashesToMinus(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const cp = str.codePointAt(i);
    out += _DASH_SET.has(cp) ? '-' : ch;
  }
  return out;
}

function _collapseAsciiSpaces(str) {
  let out = '';
  let inSpace = false;
  for (const ch of str) {
    if (ch === ' ') {
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

function _collapseSlashesAndTrim(str) {
  let out = '';
  for (const ch of str) {
    if (ch === '/') {
      if (out.length === 0 || !out.endsWith('/')) out += '/';
    } else {
      out += ch;
    }
  }
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function _decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  // common ampersand encodings from HTML/XML
  return str.replaceAll(/&amp;/gi, '&').replaceAll(/&#x26;|&#38;/gi, '&');
}

function processNormalizedString(input) {
  let str = input.replaceAll('\\', '/');
  str = _mapUnicodeSpacesToSpace(str);
  str = str.normalize('NFC');
  str = _normalizeDashesToMinus(str);
  str = _collapseAsciiSpaces(str);
  str = _collapseSlashesAndTrim(str);
  str = str.toLowerCase();

  const parts = str.split('/');
  for (let i = 0; i < parts.length; i++) {
    let seg = parts[i];
    while (seg.length > 0 && seg.endsWith('.')) seg = seg.slice(0, -1);
    parts[i] = seg;
  }
  return parts.join('/');
}

function normalizeForCompare(p) {
  if (!p) return '';
  const truncated = safeTruncate(p, MAX_NORMALIZE_LENGTH);
  let decoded = truncated;
  // Decode HTML entities like &amp; which may appear in UI input or stored values
  decoded = _decodeHtmlEntities(decoded);
  if (looksLikePercentEncoded(truncated)) {
    try {
      decoded = decodeURIComponent(truncated);
    } catch (e) {
      decoded = truncated;
      console.warn('normalizeForCompare: failed to decode percent-encoding, using raw input', e?.message);
    }
  }
  return processNormalizedString(decoded);
}

function normalizeForCompareNoDecode(p) {
  if (!p) return '';
  const truncated = safeTruncate(p, MAX_NORMALIZE_LENGTH);
  // Decode HTML entities but do not run percent-decoding
  const withEntitiesDecoded = _decodeHtmlEntities(truncated);
  return processNormalizedString(withEntitiesDecoded);
}

function trimTrailingDots(str) {
  if (!str) return str;
  let end = str.length - 1;
  while (end >= 0 && str[end] === '.') end--;
  return str.slice(0, end + 1);
}

function buildFolderPatterns(inputPath) {
  const patterns = new Set();

  // include both decoded and no-decode variants
  // decode HTML entities on the inputPath first so inputs containing '&amp;' are normalized
  const inputSanitized = _decodeHtmlEntities(String(inputPath || ''));
  const candidates = [normalizeForCompare(inputSanitized), normalizeForCompareNoDecode(inputSanitized)];
  for (const normFull of candidates) {
    const normFullTrimDot = trimTrailingDots(normFull);
    for (const v of [normFull, normFullTrimDot]) if (v) patterns.add(`${v}/`);

    const base = processNormalizedString(path.basename(inputSanitized));
    const baseTrim = trimTrailingDots(base);
    for (const b of [base, baseTrim]) if (b) patterns.add(`/${b}/`);
  }

  // Add common encoded variants to handle libraries that store paths with
  // percent-encoding or plus-encoding for spaces. For example:
  //  "UAT & Live Gig" -> "UAT%20%26%20Live%20Gig" or "UAT+%26+Live+Gig".
  const extra = new Set();
  for (const p of patterns) {
    // percent-encode ampersand
    extra.add(p.replaceAll('&', '%26'));
    // plus for spaces
    extra.add(p.replaceAll(' ', '+'));
    // percent-encode spaces as %20 and ampersand as %26
    extra.add(p.replaceAll(' ', '%20').replaceAll('&', '%26'));
    // HTML-entity encoded ampersand (from XML escaping)
    extra.add(p.replaceAll('&', '&amp;'));
    // double-encoded percent sequences (e.g. %26 -> %2526)
    extra.add(p.replaceAll('%26', '%2526'));
    // alternate conversions between + and %20
    extra.add(p.replaceAll('%20', '+'));
    extra.add(p.replaceAll('+', '%20'));

    // Handle cases where spaces around ampersand might be missing or different
    extra.add(p.replaceAll(' & ', '&'));          // "UAT & Live" -> "UAT&Live"
    extra.add(p.replaceAll(' & ', ' &'));         // "UAT & Live" -> "UAT &Live" 
    extra.add(p.replaceAll(' & ', '& '));         // "UAT & Live" -> "UAT& Live"
    extra.add(p.replaceAll(' & ', '%26'));        // "UAT & Live" -> "UAT%26Live"
    extra.add(p.replaceAll(' & ', ' %26 '));      // "UAT & Live" -> "UAT %26 Live"
    extra.add(p.replaceAll(' & ', '%20%26%20'));  // "UAT & Live" -> "UAT%20%26%20Live"
  }
  for (const e of extra) patterns.add(e);

  return Array.from(patterns);
}

function normalizeToken(s) {
  s = safeTruncate(s || '', MAX_TOKEN_LENGTH);
  s = s.toLowerCase().normalize('NFC');
  let out = '';
  const dashSet = new Set([0x2010, 0x2011, 0x2013, 0x2014, 0x2212]);
  const spaceSet = new Set([0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x200B, 0x202F, 0x205F, 0x3000]);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const cp = s.codePointAt(i);
    if (spaceSet.has(cp) || dashSet.has(cp)) continue;
    const code = s.codePointAt(i);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) out += ch;
  }
  return out;
}

module.exports = {
  MAX_NORMALIZE_LENGTH,
  MAX_TOKEN_LENGTH,
  safeTruncate,
  looksLikePercentEncoded,
  normalizeForCompare,
  normalizeForCompareNoDecode,
  trimTrailingDots,
  buildFolderPatterns,
  normalizeToken,
};

