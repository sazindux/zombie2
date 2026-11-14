import type { GameResult, Mode, Settings } from '../game/types';

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-block min-w-7 rounded-lg border-2 border-sky-200 bg-white px-1.5 text-center text-sm font-extrabold text-sky-700 shadow-[0_3px_0_#bfe0f5]">
      {children}
    </span>
  );
}

function Controls({ mode }: { mode: Mode }) {
  const rows: [React.ReactNode, string][] =
    mode === 'survival'
      ? [
          [<><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></>, 'Move'],
          [<><Key>Shift</Key></>, 'Sprint'],
          [<><Key>Space</Key></>, 'Jump'],
          [<><Key>Click</Key></>, 'Shoot'],
          [<><Key>1</Key><Key>2</Key><Key>3</Key></>, 'Swap toy'],
          [<><Key>R</Key></>, 'Reload'],
        ]
      : [
          [<><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></>, 'Shamble'],
          [<><Key>Shift</Key></>, 'Lunge-sprint'],
          [<><Key>Space</Key></>, 'Hop'],
          [<><Key>Click</Key></>, 'Chomp / infect'],
          [<><Key>E</Key></>, 'Rally groan'],
          [<><Key>P</Key></>, 'Pause'],
        ];
  return (
    <div className="grid grid-cols-1 gap-y-1.5 text-left">
      {rows.map(([k, t], i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-sm font-bold text-slate-600">
          <span>{t}</span>
          <span className="whitespace-nowrap">{k}</span>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="space-y-2 text-left text-sm font-bold text-slate-600">
      <label className="flex items-center gap-3">
        <span className="w-24">🖱️ Mouse</span>
        <input type="range" min={0.3} max={2.5} step={0.1} value={settings.sensitivity} onChange={(e) => onChange({ ...settings, sensitivity: +e.target.value })} className="flex-1" />
        <span className="w-8 text-right tabular-nums">{settings.sensitivity.toFixed(1)}</span>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24">🔊 Volume</span>
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => onChange({ ...settings, volume: +e.target.value })} className="flex-1" />
        <span className="w-8 text-right tabular-nums">{Math.round(settings.volume * 100)}</span>
      </label>
      <label className="flex cursor-pointer items-center gap-3">
        <span className="w-24">🎵 Music</span>
        <input type="checkbox" checked={settings.music} onChange={(e) => onChange({ ...settings, music: e.target.checked })} className="h-5 w-5" />
        <span>{settings.music ? 'On' : 'Off'}</span>
      </label>
    </div>
  );
}

export function MainMenu({
  onStart,
  settings,
  onSettings,
  best,
}: {
  onStart: (m: Mode) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  best: { survival: number; zombie: number };
}) {
  return (
    <div data-ui className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="flex w-full max-w-5xl flex-col items-center gap-5 py-4">
        <div className="text-center">
          <div className="anim-bob inline-block text-6xl">🧟‍♂️</div>
          <h1 className="title-bubble text-6xl leading-none md:text-8xl">Zombie Sunnyside</h1>
          <div className="title-sub mt-1 text-2xl md:text-3xl">A bright &amp; bouncy first-person zombie simulator</div>
        </div>

        <div className="grid w-full gap-5 md:grid-cols-2">
          <button
            onClick={() => onStart('survival')}
            className="glass chunky group relative overflow-hidden rounded-[28px] p-5 text-left"
          >
            <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-sky-300/50" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="anim-wiggle text-6xl">🔫</span>
                <div>
                  <div className="text-3xl font-extrabold text-sky-700">Survive the Parade</div>
                  <div className="text-sm font-extrabold uppercase tracking-wider text-sky-500">Play as a human · Wave survival</div>
                </div>
              </div>
              <p className="mt-3 text-base font-semibold leading-snug text-slate-600">
                Grab your toy blasters — confetti shotgun and pie cannon included — and pop endless waves of goofy zombies into confetti. Collect hearts and gift boxes!
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-sky-500 px-5 py-1.5 text-lg font-extrabold text-white shadow-[0_4px_0_#1c7ed6]">▶ Play</span>
                <span className="text-sm font-bold text-slate-500">Best: ⭐ {best.survival.toLocaleString()}</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => onStart('zombie')}
            className="glass chunky group relative overflow-hidden rounded-[28px] p-5 text-left"
          >
            <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full bg-lime-300/60" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="anim-wiggle text-6xl">🧠</span>
                <div>
                  <div className="text-3xl font-extrabold text-emerald-600">Be the Zombie</div>
                  <div className="text-sm font-extrabold uppercase tracking-wider text-emerald-500">Zombie POV · Sandbox simulator</div>
                </div>
              </div>
              <p className="mt-3 text-base font-semibold leading-snug text-slate-600">
                Shamble through a sunny town through a zombie's eyes. Chomp citizens to turn them into your horde, rally them with a mighty groan and dodge foam-dart guards!
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-emerald-500 px-5 py-1.5 text-lg font-extrabold text-white shadow-[0_4px_0_#2b8a3e]">▶ Play</span>
                <span className="text-sm font-bold text-slate-500">Best: ⭐ {best.zombie.toLocaleString()}</span>
              </div>
            </div>
          </button>
        </div>

        <div className="grid w-full gap-5 md:grid-cols-3">
          <div className="glass rounded-3xl p-4">
            <div className="mb-2 text-lg font-extrabold text-sky-700">🎯 Human controls</div>
            <Controls mode="survival" />
          </div>
          <div className="glass rounded-3xl p-4">
            <div className="mb-2 text-lg font-extrabold text-emerald-600">🧟 Zombie controls</div>
            <Controls mode="zombie" />
          </div>
          <div className="glass rounded-3xl p-4">
            <div className="mb-2 text-lg font-extrabold text-fuchsia-600">⚙️ Settings</div>
            <SettingsPanel settings={settings} onChange={onSettings} />
          </div>
        </div>
        <div className="rounded-full bg-white/70 px-4 py-1 text-sm font-bold text-slate-600">
          Your mouse is captured while playing · Press <Key>Esc</Key> or <Key>P</Key> to pause
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
  settings,
  onSettings,
  mode,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  mode: Mode;
}) {
  return (
    <div data-ui className="absolute inset-0 flex items-center justify-center bg-sky-200/40 p-4 backdrop-blur-sm">
      <div className="glass anim-pop w-full max-w-md rounded-[32px] p-6 text-center">
        <div className="text-5xl">⏸️</div>
        <div className="title-bubble text-6xl">Paused</div>
        <div className="mt-4 flex flex-col gap-3">
          <button onClick={onResume} className="chunky rounded-full bg-gradient-to-b from-lime-300 to-emerald-400 py-2.5 text-2xl font-extrabold text-white shadow-[0_6px_0_#2b8a3e]" style={{ textShadow: '0 2px 0 rgba(0,0,0,.2)' }}>
            ▶ Resume
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onRestart} className="chunky rounded-full bg-sky-400 py-2 text-lg font-extrabold text-white shadow-[0_5px_0_#1c7ed6]">
              🔄 Restart
            </button>
            <button onClick={onMenu} className="chunky rounded-full bg-pink-400 py-2 text-lg font-extrabold text-white shadow-[0_5px_0_#d6336c]">
              🏠 Menu
            </button>
          </div>
        </div>
        <div className="mt-5 rounded-2xl bg-white/70 p-3">
          <SettingsPanel settings={settings} onChange={onSettings} />
        </div>
        <div className="mt-4 rounded-2xl bg-white/70 p-3">
          <Controls mode={mode} />
        </div>
      </div>
    </div>
  );
}

export function ResultScreen({
  result,
  onAgain,
  onMenu,
  isBest,
}: {
  result: GameResult;
  onAgain: () => void;
  onMenu: () => void;
  isBest: boolean;
}) {
  return (
    <div data-ui className="absolute inset-0 flex items-center justify-center bg-white/20 p-4">
      <div className="glass anim-pop w-full max-w-lg rounded-[32px] p-6 text-center">
        <div className="text-6xl">{result.win ? '🏆' : '🫧'}</div>
        <div className="title-bubble text-5xl leading-tight md:text-6xl">{result.title}</div>
        <div className="mt-1 text-lg font-bold text-slate-600">{result.sub}</div>
        <div className="mx-auto mt-4 w-fit rounded-full border-[3px] border-white bg-gradient-to-r from-pink-400 to-orange-300 px-8 py-1 text-4xl font-extrabold text-white" style={{ textShadow: '0 3px 0 rgba(0,0,0,.18)' }}>
          ⭐ {result.score.toLocaleString()}
        </div>
        {isBest && <div className="anim-wiggle mt-2 text-xl font-extrabold text-fuchsia-500">🎉 New personal best! 🎉</div>}
        <div className="mt-4 space-y-1 rounded-2xl bg-white/70 p-3">
          {result.lines.map(([k, v]) => (
            <div key={k} className="flex justify-between text-lg font-bold text-slate-600">
              <span>{k}</span>
              <span className="font-extrabold text-sky-700">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onAgain} className="chunky rounded-full bg-gradient-to-b from-lime-300 to-emerald-400 py-2.5 text-xl font-extrabold text-white shadow-[0_6px_0_#2b8a3e]" style={{ textShadow: '0 2px 0 rgba(0,0,0,.2)' }}>
            🔄 Play again
          </button>
          <button onClick={onMenu} className="chunky rounded-full bg-pink-400 py-2.5 text-xl font-extrabold text-white shadow-[0_6px_0_#d6336c]">
            🏠 Menu
          </button>
        </div>
      </div>
    </div>
  );
}
