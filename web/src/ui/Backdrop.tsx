import { useEffect, useRef, useState } from 'react';

import { thumbUrl } from '@app/services/cloudinary/thumbUrl';

import { usePlayer } from '../player';

/**
 * Two layers and a front: a new picture is LOADED before it takes the front,
 * so the old wash holds until there is something to fade to. Flipping on the
 * prop alone faded the old cover out over an image still on the network —
 * the column dropped to bare ground for a beat on every change of sound.
 */
function useCrossfade(src: string): {
  layers: [string, string];
  front: number;
} {
  const [state, setState] = useState<{
    layers: [string, string];
    front: number;
  }>({ layers: ['', ''], front: 0 });

  useEffect(() => {
    let live = true;
    const show = () =>
      live &&
      setState(({ layers, front }) => {
        if (layers[front] === src) return { layers, front };
        const back = 1 - front;
        const next: [string, string] = [...layers];
        next[back] = src;
        return { layers: next, front: back };
      });

    if (!src) {
      show();
      return () => {
        live = false;
      };
    }
    const img = new Image();
    img.src = src;
    img.decode().then(show, show);
    return () => {
      live = false;
    };
  }, [src]);

  return state;
}

/**
 * The app's PlayerBackdrop, on the web: the playing sound's cover, blurred
 * and dimmed, behind everything. Two layers, so a new cover fades in over the
 * last rather than snapping.
 */
export function Backdrop({ artUrl }: { artUrl: string }) {
  const { layers, front } = useCrossfade(artUrl ? thumbUrl(artUrl, 160) : '');

  return (
    <div className="backdrop" aria-hidden="true">
      {layers.map((src, i) =>
        src ? (
          <img
            key={i}
            src={src}
            alt=""
            className={i === front ? 'is-on' : undefined}
          />
        ) : null,
      )}
    </div>
  );
}

/**
 * THE FLOW — the app's, number for number (PlayerBackdrop.tsx there carries
 * the reasoning and the measurement): two copies of the cover, blurred less
 * than the still wash, turning in opposite directions about pivots off the
 * column's centre, so the colours drift and pool. One clock advances by real
 * time × playback speed while the sound plays and stops on pause, so the
 * colours freeze where they are. Reduce Motion keeps the still wash.
 */
const FLOW_LAYERS = [
  { periodS: 24, direction: 1, opacity: 0.85, x: -0.3, y: -0.2 },
  { periodS: 33, direction: -1, opacity: 0.7, x: 0.32, y: 0.22 },
] as const;

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Drives every `.flow` turner under `root` from one music-time clock. */
function useFlow(root: React.RefObject<HTMLDivElement | null>) {
  const playing = usePlayer(s => s.playing);
  const rate = usePlayer(s => s.rate);
  const phase = useRef(0);
  const speed = useRef(rate);
  speed.current = rate;

  useEffect(() => {
    if (!playing || reducedMotion()) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      // A long gap is a hidden tab coming back, not music played.
      if (dt < 100) phase.current += (dt / 1000) * speed.current;
      root.current?.querySelectorAll<HTMLElement>('.flow').forEach(turner => {
        const layer = FLOW_LAYERS[Number(turner.dataset.layer)];
        const turn =
          ((phase.current / layer.periodS) * 360 * layer.direction) % 360;
        turner.style.transform = `rotate(${turn}deg)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, root]);
}

/**
 * THE APP'S PlayerBackdrop, LITERALLY: the cover fetched small (w_320, so
 * w_640 at 2x), blurred 60, at 0.75 over the page colour, with the same
 * fade laid over it — the app's stops, moved from its overscanned box into
 * the column's own height (screen y = offset × 1514 − 320 on the 874pt
 * phone they were measured on). An art-less sound takes the app's stand-in:
 * the ink, in two crossing ramps.
 */
export function PlayerBackdrop({ artUrl }: { artUrl: string }) {
  const { layers, front } = useCrossfade(artUrl ? thumbUrl(artUrl, 320) : '');
  const root = useRef<HTMLDivElement>(null);
  useFlow(root);

  return (
    <div className="player-backdrop" aria-hidden="true" ref={root}>
      <div className={layers[front] ? 'standin' : 'standin is-on'} />
      {layers.map((src, i) =>
        src ? (
          <div key={i} className={i === front ? 'wash is-on' : 'wash'}>
            <img src={src} alt="" />
            {FLOW_LAYERS.map((layer, n) => (
              <div
                key={n}
                className="flow"
                data-layer={n}
                style={
                  {
                    '--x': layer.x,
                    '--y': layer.y,
                    opacity: layer.opacity,
                  } as React.CSSProperties
                }
              >
                <img src={src} alt="" />
              </div>
            ))}
          </div>
        ) : null,
      )}
      <div className="fade" />
    </div>
  );
}
