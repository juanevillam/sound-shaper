import { beforeEach, describe, expect, it, vi } from 'vitest';

// The tag is built in memory here, byte by byte — never read from a fixture
// file. `readId3Tags` reads ranges of a file as base64, so the mock serves
// slices of whatever buffer the test last installed.
let file = new Uint8Array();
vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: async (
    _uri: string,
    { position, length }: { position: number; length: number },
  ) =>
    Buffer.from(file.subarray(position, position + length)).toString('base64'),
}));

const { readId3Tags } = await import('../../src/lib/id3');

const bytes = (...parts: (number[] | Uint8Array | string)[]) =>
  Uint8Array.from(
    parts.flatMap(part =>
      typeof part === 'string'
        ? [...Buffer.from(part, 'latin1')]
        : Array.from(part),
    ),
  );

const synchsafe = (n: number) => [
  (n >> 21) & 0x7f,
  (n >> 14) & 0x7f,
  (n >> 7) & 0x7f,
  n & 0x7f,
];
const uint32 = (n: number) => [
  (n >>> 24) & 0xff,
  (n >> 16) & 0xff,
  (n >> 8) & 0xff,
  n & 0xff,
];

/** An ID3v2.3/2.4 frame: 4-char id, 4-byte size, 2 flag bytes, body. */
const frame = (major: 3 | 4, id: string, body: Uint8Array) =>
  bytes(
    id,
    major === 4 ? synchsafe(body.length) : uint32(body.length),
    [0, 0],
    body,
  );

/** An ID3v2.2 frame: 3-char id, 3-byte size, no flags. */
const frameV2 = (id: string, body: Uint8Array) =>
  bytes(
    id,
    [(body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff],
    body,
  );

const tag = (major: number, ...frames: Uint8Array[]) => {
  const body = bytes(...frames, new Uint8Array(16)); // trailing padding
  return bytes('ID3', [major, 0, 0], synchsafe(body.length), body);
};

const latin1Text = (s: string) => bytes([0], s);
const utf8Text = (s: string) =>
  bytes([3], new Uint8Array(Buffer.from(s, 'utf8')));
const utf16Text = (s: string) =>
  bytes([1, 0xff, 0xfe], new Uint8Array(Buffer.from(s, 'utf16le')), [0, 0]);

describe('readId3Tags', () => {
  beforeEach(() => {
    file = new Uint8Array();
  });

  it('reads v2.3 text frames in each encoding', async () => {
    file = tag(
      3,
      frame(3, 'TIT2', latin1Text('Immortals')),
      frame(3, 'TPE1', utf16Text('Fall Out Boy')),
      frame(3, 'TALB', utf8Text('Big Hero 6 — OST')),
      frame(3, 'TYER', latin1Text('2014')),
    );
    expect(await readId3Tags('file:///a.mp3')).toEqual({
      title: 'Immortals',
      artist: 'Fall Out Boy',
      album: 'Big Hero 6 — OST',
      year: '2014',
      picture: null,
    });
  });

  it('reads v2.4 synchsafe frame sizes and trims TDRC to a year', async () => {
    // 200 bytes needs the synchsafe encoding to differ from a plain uint32.
    const long = 'x'.repeat(200);
    file = tag(
      4,
      frame(4, 'TIT2', utf8Text(long)),
      frame(4, 'TDRC', latin1Text('2019-05-03')),
    );
    const tags = await readId3Tags('file:///a.mp3');
    expect(tags.title).toBe(long);
    expect(tags.year).toBe('2019');
  });

  it('reads v2.2 three-letter frames and a PIC cover', async () => {
    const png = [0x89, 0x50, 0x4e, 0x47];
    file = tag(
      2,
      frameV2('TT2', latin1Text('Voice Memo')),
      // encoding, 3-char format, picture type, empty description, data
      frameV2('PIC', bytes([0], 'PNG', [3], [0], png)),
    );
    const tags = await readId3Tags('file:///a.mp3');
    expect(tags.title).toBe('Voice Memo');
    expect(tags.picture).toEqual({
      mime: 'image/png',
      base64: Buffer.from(png).toString('base64'),
    });
  });

  it('reads an APIC cover past a UTF-16 description', async () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x00];
    file = tag(
      3,
      frame(
        3,
        'APIC',
        bytes(
          [1],
          'image/jpeg',
          [0],
          [3],
          new Uint8Array(Buffer.from('﻿Cover', 'utf16le')),
          [0, 0],
          jpeg,
        ),
      ),
    );
    expect((await readId3Tags('file:///a.mp3')).picture).toEqual({
      mime: 'image/jpeg',
      base64: Buffer.from(jpeg).toString('base64'),
    });
  });

  it('keeps the first value when a frame repeats', async () => {
    file = tag(
      3,
      frame(3, 'TIT2', latin1Text('First')),
      frame(3, 'TIT2', latin1Text('Second')),
    );
    expect((await readId3Tags('file:///a.mp3')).title).toBe('First');
  });

  it('stops at a frame that overruns the tag instead of reading past it', async () => {
    const overrun = bytes('TPE1', uint32(9999), [0, 0], latin1Text('x'));
    file = tag(3, frame(3, 'TIT2', latin1Text('Kept')), overrun);
    const tags = await readId3Tags('file:///a.mp3');
    expect(tags.title).toBe('Kept');
    expect(tags.artist).toBeNull();
  });

  it('resolves all-null for a file with no tag', async () => {
    file = bytes([0xff, 0xfb, 0x90, 0x00], new Uint8Array(32));
    expect(await readId3Tags('file:///a.mp3')).toEqual({
      title: null,
      artist: null,
      album: null,
      year: null,
      picture: null,
    });
  });

  it('resolves all-null for a file shorter than a header', async () => {
    file = bytes('ID3');
    expect((await readId3Tags('file:///a.mp3')).title).toBeNull();
  });
});
