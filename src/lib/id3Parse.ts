// Client-side ID3v2 tag parsing over raw bytes — hand-rolled (no library) so
// it runs the same in Hermes and in a browser. Handles ID3v2.2 / 2.3 / 2.4 text
// frames (title/artist/album/year) + embedded cover art (APIC / PIC). Not
// handled (rare in real downloads; hand-fill covers them): the
// unsynchronisation flag and extended headers.
//
// PLATFORM-FREE ON PURPOSE: the app reads the bytes off disk (`lib/id3.ts`),
// the web reads them off a picked `File` — both hand them here.

export type Id3Picture = { mime: string; base64: string };

export type Id3Tags = {
  title: string | null;
  artist: string | null;
  album: string | null;
  year: string | null;
  picture: Id3Picture | null;
};

export const EMPTY_ID3: Id3Tags = {
  title: null,
  artist: null,
  album: null,
  year: null,
  picture: null,
};

// Hermes and every browser provide btoa globally; reach it without depending on the
// DOM lib being in tsconfig.
const g = globalThis as unknown as {
  btoa: (s: string) => string;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  // Chunk to avoid a huge argument spread on big cover art.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return g.btoa(bin);
};

// 28-bit synchsafe integer (7 bits per byte) — ID3 header + v2.4 frame sizes.
const synchsafe = (b: Uint8Array, o: number): number =>
  ((b[o] & 0x7f) << 21) |
  ((b[o + 1] & 0x7f) << 14) |
  ((b[o + 2] & 0x7f) << 7) |
  (b[o + 3] & 0x7f);

// Plain big-endian uint32 — v2.3 frame sizes.
const uint32 = (b: Uint8Array, o: number): number =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

const latin1 = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

const utf8 = (b: Uint8Array): string => {
  let s = '';
  let i = 0;
  while (i < b.length) {
    const c = b[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0)
      s += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f));
    else if (c < 0xf0)
      s += String.fromCharCode(
        ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f),
      );
    else {
      const cp =
        ((c & 0x07) << 18) |
        ((b[i++] & 0x3f) << 12) |
        ((b[i++] & 0x3f) << 6) |
        (b[i++] & 0x3f);
      const u = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return s;
};

// UTF-16: BOM picks endianness (encoding byte 1); default BE (encoding byte 2).
const utf16 = (b: Uint8Array, defaultBE: boolean): string => {
  let start = 0;
  let le = !defaultBE;
  if (b.length >= 2) {
    if (b[0] === 0xff && b[1] === 0xfe) {
      le = true;
      start = 2;
    } else if (b[0] === 0xfe && b[1] === 0xff) {
      le = false;
      start = 2;
    }
  }
  let s = '';
  for (let i = start; i + 1 < b.length; i += 2) {
    const code = le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1];
    if (code === 0) break;
    s += String.fromCharCode(code);
  }
  return s;
};

const decodeText = (b: Uint8Array): string => {
  if (b.length === 0) return '';
  const enc = b[0];
  const body = b.subarray(1);
  let s: string;
  if (enc === 1) s = utf16(body, false);
  else if (enc === 2) s = utf16(body, true);
  else if (enc === 3) s = utf8(body);
  else s = latin1(body);
  return s.replace(/\0+$/, '').trim();
};

type TextField = 'title' | 'artist' | 'album' | 'year';

const TEXT_FIELDS_V2: Record<string, TextField> = {
  TT2: 'title',
  TP1: 'artist',
  TAL: 'album',
  TYE: 'year',
};
const TEXT_FIELDS_V34: Record<string, TextField> = {
  TIT2: 'title',
  TPE1: 'artist',
  TALB: 'album',
  TYER: 'year',
  TDRC: 'year',
};

const parsePicture = (b: Uint8Array, v2: boolean): Id3Picture | null => {
  let i = 0;
  const enc = b[i++];
  let mime: string;
  if (v2) {
    // PIC: 3-char image format ("JPG"/"PNG").
    const fmt = latin1(b.subarray(i, i + 3)).toUpperCase();
    i += 3;
    mime = fmt.includes('PNG') ? 'image/png' : 'image/jpeg';
  } else {
    // APIC: null-terminated latin1 MIME string.
    let s = '';
    while (i < b.length && b[i] !== 0) s += String.fromCharCode(b[i++]);
    i++;
    mime = s || 'image/jpeg';
  }
  i++; // picture-type byte
  // Description, terminated by 1 null (latin1/utf8) or 2 nulls (utf16).
  if (enc === 1 || enc === 2) {
    while (i + 1 < b.length && !(b[i] === 0 && b[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < b.length && b[i] !== 0) i++;
    i++;
  }
  const data = b.subarray(i);
  if (data.length === 0) return null;
  return { mime, base64: bytesToBase64(data) };
};

const parseFrames = (
  buf: Uint8Array,
  major: number,
  tagSize: number,
): Id3Tags => {
  const out: Id3Tags = { ...EMPTY_ID3 };
  const v2 = major === 2;
  const idLen = v2 ? 3 : 4;
  const sizeLen = v2 ? 3 : 4;
  const flagsLen = v2 ? 0 : 2;
  const end = Math.min(buf.length, 10 + tagSize);
  let pos = 10;

  while (pos + idLen + sizeLen + flagsLen <= end) {
    const id = latin1(buf.subarray(pos, pos + idLen));
    if (buf[pos] === 0) break; // padding

    let size: number;
    if (v2) size = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
    else if (major === 4) size = synchsafe(buf, pos + 4);
    else size = uint32(buf, pos + 4);

    const frameStart = pos + idLen + sizeLen + flagsLen;
    const frameEnd = frameStart + size;
    if (size <= 0 || frameEnd > end) break;

    const body = buf.subarray(frameStart, frameEnd);
    const field = v2 ? TEXT_FIELDS_V2[id] : TEXT_FIELDS_V34[id];
    if (field) {
      const text = decodeText(body);
      if (text && !out[field])
        out[field] = field === 'year' ? text.slice(0, 4) : text;
    } else if ((v2 && id === 'PIC') || (!v2 && id === 'APIC')) {
      if (!out.picture) out.picture = parsePicture(body, v2);
    }

    pos = frameEnd;
  }

  return out;
};

/** The tag's total size from its 10-byte header, or null for no ID3v2 tag. */
export const id3TagSize = (header: Uint8Array): number | null => {
  if (
    header.length < 10 ||
    header[0] !== 0x49 ||
    header[1] !== 0x44 ||
    header[2] !== 0x33
  )
    return null;

  const size = synchsafe(header, 6);

  return size > 0 ? 10 + size : null;
};

/** Parse a whole tag — the file's first `id3TagSize(header)` bytes. */
export const parseId3 = (tag: Uint8Array): Id3Tags => {
  const size = id3TagSize(tag);

  return size === null ? EMPTY_ID3 : parseFrames(tag, tag[3], size - 10);
};
