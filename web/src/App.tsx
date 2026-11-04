import { useRef, useState } from 'react';

import { audioEngine } from '@app/lib/audioEngine';
import {
  EFFECT_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  type EffectLevel,
} from '@app/lib/shapeDsp';
import { translations } from '@app/i18n/translations';

import { asHandle } from './shims/audio-api';

/**
 * STEP 1 OF docs/web.md — proof that the web plays through the iOS app's OWN
 * engine: a local file, the five bands, Echo and Next Room, all applied by
 * `src/lib/audioEngine.ts` unchanged. The real screens replace this.
 */
const t = translations.en;

export function App() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [gains, setGains] = useState(() => EQ_BANDS.map(() => 0));
  const [echo, setEcho] = useState<EffectLevel>('off');
  const [room, setRoom] = useState<EffectLevel>('off');

  const load = (file: File) => {
    audioEngine.pause();
    audio.current?.removeAttribute('src');
    const el = asHandle(new Audio());
    el.src = URL.createObjectURL(file);
    el.preload = 'auto';
    el.addEventListener('play', () => setPlaying(true));
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener(
      'canplay',
      () => {
        audioEngine.registerHandle(el);
        audioEngine.buildGraph(el);
        audioEngine.apply(gains, room, echo);
      },
      { once: true },
    );
    audio.current = el;
    setName(file.name);
  };

  const toggle = async () => {
    // A browser starts its audio context only from a gesture.
    await audioEngine.getContext().resume();
    if (playing) audioEngine.pause();
    else audioEngine.play();
  };

  return (
    <main className="proof">
      <h1>Sound Shaper</h1>
      <p className="lede">{t.welcome.features.library.title}</p>
      <label className="pick">
        <input
          type="file"
          accept="audio/*"
          onChange={e => e.target.files?.[0] && load(e.target.files[0])}
        />
        {name ?? 'Choose a Sound'}
      </label>
      <button type="button" disabled={!name} onClick={toggle}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <section className="bands">
        {EQ_BANDS.map((band, i) => (
          <label key={band.hz}>
            <input
              type="range"
              min={EQ_MIN_DB}
              max={EQ_MAX_DB}
              step={1}
              value={gains[i]}
              onChange={e => {
                const db = Number(e.target.value);
                setGains(g => g.map((v, j) => (j === i ? db : v)));
                audioEngine.setBandGain(i, db);
              }}
            />
            <span>{band.label}</span>
          </label>
        ))}
      </section>
      {(
        [
          ['Echo', echo, setEcho, audioEngine.setEcho],
          ['Next Room', room, setRoom, audioEngine.setNextRoom],
        ] as const
      ).map(([label, value, set, apply]) => (
        <label key={label} className="level">
          {label}
          <select
            value={value}
            onChange={e => {
              const level = e.target.value as EffectLevel;
              set(level);
              apply.call(audioEngine, level);
            }}
          >
            {EFFECT_LEVELS.map(l => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      ))}
    </main>
  );
}
