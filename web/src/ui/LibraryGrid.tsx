import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { t } from '../i18n';
import type { Sound } from '../library';
import { playSound, usePlayer } from '../player';

import { Artwork } from './Artwork';
import { Bars, PlusGlyph } from './glyphs';

/** The grid draws a tile at most this wide; Cloudinary serves 2x of it. */
const TILE_WIDTH = 220;

/** The add tile's key in the order — the app's `ADD_TILE_KEY`. */
const ADD_KEY = '__add__';

type Cell =
  | { key: string; kind: 'sound'; sound: Sound; position: number | null }
  | { key: string; kind: 'add'; position: number | null };

/**
 * The app's `toGridCells`: the sounds in their order, with the add tile
 * placed by its own position — first while nobody has moved it.
 */
const toCells = (sounds: Sound[], addTilePosition: number | null): Cell[] => {
  const cells: Cell[] = sounds.map(sound => ({
    key: sound.id,
    kind: 'sound',
    sound,
    position: sound.position,
  }));
  const add: Cell = { key: ADD_KEY, kind: 'add', position: addTilePosition };

  if (addTilePosition === null) return [add, ...cells];

  const slot = cells.findIndex(
    cell => cell.position !== null && cell.position > addTilePosition,
  );

  return slot === -1
    ? [...cells, add]
    : [...cells.slice(0, slot), add, ...cells.slice(slot)];
};

const SoundTile = ({ sound }: { sound: Sound }) => {
  const isCurrent = usePlayer(s => s.loaded && s.current?.id === sound.id);
  const playing = usePlayer(s => s.playing);
  const rate = usePlayer(s => s.rate);

  return (
    <button
      type="button"
      className={isCurrent ? 'tile is-current' : 'tile'}
      aria-current={isCurrent || undefined}
      onClick={() => playSound(sound)}
    >
      <span className="tile-art">
        <Artwork artUrl={sound.artUrl} name={sound.name} width={TILE_WIDTH} />
        {isCurrent && <Bars live={playing} rate={rate} />}
      </span>
      <span className="tile-name">{sound.name}</span>
      {sound.artist && <span className="tile-sub">{sound.artist}</span>}
    </button>
  );
};

/**
 * The app's add tile: the empty-media box with a plus, "Add Sound" under it
 * and the one rule the picker enforces.
 */
const AddTile = ({ onPick }: { onPick: (file: File) => void }) => {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="tile is-add"
        onClick={() => input.current?.click()}
      >
        <span className="tile-art">
          <span className="artwork is-empty" aria-hidden="true">
            <PlusGlyph />
          </span>
        </span>
        <span className="tile-name">{t('home.addSound')}</span>
        <span className="tile-sub">{t('home.addSoundFormat')}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".mp3,audio/mpeg"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </>
  );
};

export function LibraryGrid({
  sounds,
  addTilePosition,
  onPick,
}: {
  sounds: Sound[];
  addTilePosition: number | null;
  onPick: (file: File) => void;
}) {
  const cells = useMemo(
    () => toCells(sounds, addTilePosition),
    [sounds, addTilePosition],
  );
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (entered) return;
    const id = setTimeout(() => setEntered(true), 750);
    return () => clearTimeout(id);
  }, [entered]);

  const tile = (cell: Cell): ReactNode =>
    cell.kind === 'add' ? (
      <AddTile onPick={onPick} />
    ) : (
      <SoundTile sound={cell.sound} />
    );

  return (
    <ul className={entered ? 'grid is-entered' : 'grid'}>
      {cells.map((cell, i) => (
        <li
          key={cell.key}
          style={
            {
              '--i': Math.min(i, 24),
              viewTransitionName:
                cell.key === ADD_KEY ? 'tile-add' : `tile-${cell.key}`,
            } as React.CSSProperties
          }
        >
          {tile(cell)}
        </li>
      ))}
    </ul>
  );
}
