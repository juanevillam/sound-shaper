import * as FileSystem from 'expo-file-system/legacy';

import { EMPTY_ID3, id3TagSize, parseId3, type Id3Tags } from '@/lib/id3Parse';

export type { Id3Picture, Id3Tags } from '@/lib/id3Parse';

// Reads an ID3v2 tag off a local file; the parsing itself is the
// platform-free `id3Parse.ts`, which the web app shares. No ID3v2 tag → all
// null, and the person fills the form by hand.

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = (globalThis as unknown as { atob: (s: string) => string }).atob(
    b64,
  );
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

// Read a byte range straight from disk (base64), so we only pull the tag, not
// the whole multi-MB sound.
const readRange = async (
  uri: string,
  position: number,
  length: number,
): Promise<Uint8Array> => {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return base64ToBytes(b64);
};

/**
 * Read ID3v2 tags from a local audio file. Never throws — on any read/parse
 * problem (or no tag) it resolves to all-null so the upload form falls back to
 * hand-filled metadata.
 */
export const readId3Tags = async (uri: string): Promise<Id3Tags> => {
  try {
    const size = id3TagSize(await readRange(uri, 0, 10));
    if (size === null) return EMPTY_ID3;

    return parseId3(await readRange(uri, 0, size));
  } catch {
    return EMPTY_ID3;
  }
};

/** A freshly picked .mp3, parsed: the document picker and the ID3 read run
 *  BEFORE the editor opens, so the form opens already prefilled. */
export type PickedSoundFile = {
  uri: string;
  fileName: string;
  tags: Id3Tags;
};
