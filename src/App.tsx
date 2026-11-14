import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import type { GameResult, HudState, Mode, Phase, Settings } from './game/types';
import { Hud } from './components/Hud';
import { MainMenu, PauseScreen, ResultScreen } from './components/Screens';

const EMPTY_HUD: HudState = {
  mode: 'survival',
  hp: 100,
  maxHp: 100,
  stamina: 100,
  weapon: 0,
  weaponName: '',
  ammo: '',
  ammoLow: false,
  reloading: false,
  wave: 0,
  enemies: 0,
  score: 0,
  kills: 0,
  combo: 0,
  humansLeft: 0,
  humansTotal: 0,
  allies: 0,
  time: 0,
  groanReady: 1,
  sprinting: false,
  hitSeq: 0,
  killSeq: 0,
  headSeq: 0,
  hurtSeq: 0,
  healSeq: 0,
  banner: null,
  toast: null,
  fallback: false,
};

const loadJSON = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? ({ ...fallback, ...JSON.parse(v) } as T) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const modeRef = useRef<Mode>('survival');

  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isBest, setIsBest] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadJSON<Settings>('zs-settings', { sensitivity: 1, volume: 0.7, music: true }));
  const [best, setBest] = useState(() => loadJSON('zs-best', { survival: 0, zombie: 0 }));
  const bestRef = useRef(best);
  bestRef.current = best;

  useEffect(() => {
    const game = new Game(mountRef.current!, {
      onHud: setHud,
      onPhase: setPhase,
      onResult: (r) => {
        setResult(r);
        const m = modeRef.current;
        const prev = bestRef.current[m];
        if (r.score > prev) {
          const nb = { ...bestRef.current, [m]: r.score };
          setBest(nb);
          setIsBest(true);
          try {
            localStorage.setItem('zs-best', JSON.stringify(nb));
          } catch {
            /* ignore */
          }
        } else setIsBest(false);
      },
    });
    gameRef.current = game;
    game.setMinimap(mapRef.current);
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setSettings(settings);
    try {
      localStorage.setItem('zs-settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const start = useCallback((m: Mode) => {
    modeRef.current = m;
    setResult(null);
    setHud({ ...EMPTY_HUD, mode: m });
    gameRef.current?.start(m);
  }, []);

  const playing = phase === 'playing' || phase === 'paused';
  const showHud = playing || phase === 'over';

  return (
    <div className="relative h-full w-full overflow-hidden bg-sky-200">
      <div ref={mountRef} className="absolute inset-0" />

      <Hud hud={hud} active={playing} />

      {/* minimap */}
      <div
        className="pointer-events-none absolute right-4 top-4 rounded-full border-[4px] border-white shadow-[0_6px_0_rgba(50,110,160,0.25),0_12px_28px_rgba(30,80,130,0.25)]"
        style={{ opacity: playing ? 1 : 0, transition: 'opacity .3s' }}
      >
        <canvas ref={mapRef} width={168} height={168} className="block rounded-full" />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 text-[10px] font-extrabold uppercase tracking-wider text-sky-600">Radar</div>
      </div>

      {phase === 'menu' && <MainMenu onStart={start} settings={settings} onSettings={setSettings} best={best} />}
      {phase === 'paused' && (
        <PauseScreen
          onResume={() => gameRef.current?.resume()}
          onRestart={() => start(modeRef.current)}
          onMenu={() => gameRef.current?.toMenu()}
          settings={settings}
          onSettings={setSettings}
          mode={modeRef.current}
        />
      )}
      {phase === 'over' && result && showHud && (
        <ResultScreen result={result} isBest={isBest} onAgain={() => start(modeRef.current)} onMenu={() => gameRef.current?.toMenu()} />
      )}
    </div>
  );
}
