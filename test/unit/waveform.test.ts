import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory file system: just enough of `expo-file-system/legacy` for the
// waveform cache to read, write and move its JSON.
const files = new Map<string, string>();
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: async () => {},
  readDirectoryAsync: async () => [],
  getInfoAsync: async (path: string) => ({
    exists: files.has(path),
    size: files.get(path)?.length ?? 0,
  }),
  readAsStringAsync: async (path: string) => files.get(path) ?? '',
  writeAsStringAsync: async (path: string, body: string) =>
    void files.set(path, body),
  // A path ending in `/` is a directory: delete everything under it.
  deleteAsync: async (path: string) => {
    for (const key of [...files.keys()])
      if (path.endsWith('/') ? key.startsWith(path) : key === path)
        files.delete(key);
  },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    files.set(to, files.get(from) ?? '');
    files.delete(from);
  },
  downloadAsync: async (_url: string, path: string) =>
    void files.set(path, 'mp3'),
}));

const decode = vi.fn();
vi.mock('react-native-audio-api', () => ({
  decodeAudioData: (...args: unknown[]) => decode(...args),
}));

vi.mock('@/lib/offlineAudio', () => ({
  offlineAudioPath: (id: string) => `file:///docs/audio/${id}.mp3`,
}));

const { clearWaveforms, forgetWaveform, getWaveform, peekWaveform } =
  await import('../../src/lib/waveform');

const jsonPath = (id: string) => `file:///cache/waveforms/v2-${id}.json`;

const buffer = () => ({
  sampleRate: 8000,
  duration: 1,
  getChannelData: () => Float32Array.from({ length: 8000 }, (_, i) => i % 7),
});

beforeEach(() => {
  files.clear();
  decode.mockReset();
});

describe('peekWaveform', () => {
  it('holds nothing before a decode and the waveform after one', async () => {
    decode.mockResolvedValue(buffer());
    expect(peekWaveform('a')).toBeUndefined();
    const waveform = await getWaveform('a', 'https://x/a.mp3');
    expect(waveform).not.toBeNull();
    expect(peekWaveform('a')).toBe(waveform);
    forgetWaveform('a');
  });

  it('never caches a failure', async () => {
    decode.mockRejectedValue(new Error('offline'));
    expect(await getWaveform('b', 'https://x/b.mp3')).toBeNull();
    expect(peekWaveform('b')).toBeUndefined();
  });

  it('is emptied by forgetWaveform', async () => {
    decode.mockResolvedValue(buffer());
    await getWaveform('c', 'https://x/c.mp3');
    forgetWaveform('c');
    expect(peekWaveform('c')).toBeUndefined();
  });
});

describe('the JSON cache', () => {
  it('writes through a temp file and leaves none behind', async () => {
    decode.mockResolvedValue(buffer());
    await getWaveform('d', 'https://x/d.mp3');
    expect(files.has(jsonPath('d'))).toBe(true);
    expect(files.has(`${jsonPath('d')}.tmp`)).toBe(false);
    forgetWaveform('d');
  });

  it('treats a corrupt file as a miss and decodes again', async () => {
    files.set(jsonPath('e'), '{"buckets":[0.1,');
    decode.mockResolvedValue(buffer());
    const waveform = await getWaveform('e', 'https://x/e.mp3');
    expect(waveform?.buckets.length).toBeGreaterThan(0);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(JSON.parse(files.get(jsonPath('e')) ?? '')).toEqual(waveform);
    forgetWaveform('e');
  });

  it('reads a valid file without decoding', async () => {
    const stored = { bucketMs: 50, buckets: [0.5, 1] };
    files.set(jsonPath('f'), JSON.stringify(stored));
    expect(await getWaveform('f', 'https://x/f.mp3')).toEqual(stored);
    expect(decode).not.toHaveBeenCalled();
    forgetWaveform('f');
  });
});

describe('clearWaveforms', () => {
  it('empties the session and deletes every cached file', async () => {
    decode.mockResolvedValue(buffer());
    await getWaveform('g', 'https://x/g.mp3');
    await getWaveform('h', 'https://x/h.mp3');
    expect(files.has(jsonPath('g'))).toBe(true);

    await clearWaveforms();

    expect(peekWaveform('g')).toBeUndefined();
    expect(peekWaveform('h')).toBeUndefined();
    expect(files.has(jsonPath('g'))).toBe(false);
    expect(files.has(jsonPath('h'))).toBe(false);
  });

  it('decodes again after a wipe rather than answering from memory', async () => {
    decode.mockResolvedValue(buffer());
    await getWaveform('i', 'https://x/i.mp3');
    await clearWaveforms();
    await getWaveform('i', 'https://x/i.mp3');
    expect(decode).toHaveBeenCalledTimes(2);
    forgetWaveform('i');
  });
});
