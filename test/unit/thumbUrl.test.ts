import { describe, expect, it } from 'vitest';

import { thumbUrl } from '../../src/services/cloudinary/thumbUrl';

const COVER =
  'https://res.cloudinary.com/juanevillam/image/upload/v1/sound-shaper/uid/cover.jpg';

describe('thumbUrl', () => {
  it('inserts a 2x width transformation into a Cloudinary image URL', () => {
    expect(thumbUrl(COVER, 56)).toBe(
      'https://res.cloudinary.com/juanevillam/image/upload/w_112,c_limit,q_auto,f_auto/v1/sound-shaper/uid/cover.jpg',
    );
  });

  it('caps the width at 2048', () => {
    expect(thumbUrl(COVER, 4000)).toContain('/w_2048,');
  });

  it('leaves an already-transformed URL alone', () => {
    const transformed = thumbUrl(COVER, 56);

    expect(thumbUrl(transformed, 56)).toBe(transformed);
  });

  it('leaves audio and non-Cloudinary URLs alone', () => {
    const audio =
      'https://res.cloudinary.com/juanevillam/video/upload/v1/a.mp3';
    const google = 'https://lh3.googleusercontent.com/a/photo=s96-c';

    expect(thumbUrl(audio, 56)).toBe(audio);
    expect(thumbUrl(google, 56)).toBe(google);
  });

  it('does not treat a URL that only mentions the host as Cloudinary', () => {
    const lookalikes = [
      'https://evil.example/res.cloudinary.com/image/upload/x.jpg',
      'https://res.cloudinary.com.evil.example/image/upload/x.jpg',
      'https://evil.example/?r=https://res.cloudinary.com/image/upload/x.jpg',
    ];

    for (const url of lookalikes) expect(thumbUrl(url, 56)).toBe(url);
  });
});
