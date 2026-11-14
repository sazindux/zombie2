import { useEffect, useState } from 'react';
import type { HudState } from '../game/types';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function HitMarker({ seq, head, kill }: { seq: number; head: number; kill: number }) {
  if (!seq) return null;
  return (
    <>
      <div key={`h${seq}`} className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: 0, height: 0, animation: 'hitMarker 0.28s ease-out both' }}>
        {[45, 135, 225, 315].map((r) => (
          <div key={r} className="hit-bar" style={{ transform: `rotate(${r}deg) translateY(-14px)`, left: -2, top: -5 }} />
        ))}
      </div>
      {head > 0 && (
        <div key={`hd${head}`} className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: 0, height: 0, animation: 'hitMarker 0.4s ease-out both' }}>
          {[45, 135, 225, 315].map((r) => (
            <div key={r} className="hit-bar" style={{ background: '#ff3d7f', width: 5, height: 15, transform: `rotate(${r}deg) translateY(-22px)`, left: -2.5, top: -7 }} />
          ))}
        </div>
      )}
      {kill > 0 && (
        <div
          key={`k${kill}`}
          className="pointer-events-none absolute left-1/2 top-1/2 text-3xl"
          style={{ animation: 'hitMarker 0.5s ease-out both' }}
        >
          ✨
        </div>
      )}
    </>
  );
}

function Bar({ value, max, from, to, h = 18 }: { value: number; max: number; from: string; to: string; h?: number }) {
  return (
    <div className="overflow-hidden rounded-full border-[3px] border-white bg-white/60" style={{ height: h }}>
      <div
        className="h-full rounded-full transition-[width] duration-150"
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
    </div>
  );
}

export function Hud({ hud, active }: { hud: HudState; active: boolean }) {
  const [showBanner, setShowBanner] = useState<number | null>(null);
  const [showToast, setShowToast] = useState<number | null>(null);
  const bannerId = hud.banner?.id ?? 0;
  const toastId = hud.toast?.id ?? 0;

  useEffect(() => {
    if (!bannerId) return;
    setShowBanner(bannerId);
    const t = setTimeout(() => setShowBanner(null), 3200);
    return () => clearTimeout(t);
  }, [bannerId]);
  useEffect(() => {
    if (!toastId) return;
    setShowToast(toastId);
    const t = setTimeout(() => setShowToast(null), 2400);
    return () => clearTimeout(t);
  }, [toastId]);

  const survival = hud.mode === 'survival';
  const low = hud.hp <= 30;
  const hpFrom = low ? '#ff6b6b' : '#ff8fab';
  const hpTo = low ? '#ff9f43' : '#8ce99a';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: active ? 1 : 0, transition: 'opacity .3s' }}>
      {/* hurt / heal flashes */}
      {hud.hurtSeq > 0 && (
        <div
          key={`hurt${hud.hurtSeq}`}
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,120,150,0) 40%, rgba(255,70,120,0.65) 100%)',
            animation: 'hurtFlash 0.55s ease-out both',
          }}
        />
      )}
      {hud.healSeq > 0 && (
        <div
          key={`heal${hud.healSeq}`}
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(120,255,170,0) 45%, rgba(110,240,160,0.55) 100%)',
            animation: 'hurtFlash 0.7s ease-out both',
          }}
        />
      )}
      {low && hud.hp > 0 && (
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px 10px rgba(255,80,130,0.35)' }} />
      )}

      {/* crosshair */}
      {survival ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-0 h-2.5 w-[3px] -translate-x-1/2 rounded bg-white" style={{ boxShadow: '0 0 0 1.5px rgba(30,40,80,.55)' }} />
            <div className="absolute bottom-0 left-1/2 h-2.5 w-[3px] -translate-x-1/2 rounded bg-white" style={{ boxShadow: '0 0 0 1.5px rgba(30,40,80,.55)' }} />
            <div className="absolute left-0 top-1/2 h-[3px] w-2.5 -translate-y-1/2 rounded bg-white" style={{ boxShadow: '0 0 0 1.5px rgba(30,40,80,.55)' }} />
            <div className="absolute right-0 top-1/2 h-[3px] w-2.5 -translate-y-1/2 rounded bg-white" style={{ boxShadow: '0 0 0 1.5px rgba(30,40,80,.55)' }} />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400" style={{ boxShadow: '0 0 0 1.5px #fff' }} />
          </div>
        </div>
      ) : (
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-lime-300/80" style={{ boxShadow: '0 0 0 1.5px rgba(30,40,80,.4)' }} />
      )}
      <HitMarker seq={hud.hitSeq} head={hud.headSeq} kill={hud.killSeq} />

      {/* top-left stats */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        {survival ? (
          <>
            <div className="hud-card flex items-center gap-3 px-4 py-2">
              <span className="text-3xl">🌊</span>
              <div className="leading-none">
                <div className="text-xs font-bold uppercase tracking-wider text-sky-700/70">Wave</div>
                <div className="text-3xl font-extrabold text-sky-700">{hud.wave}</div>
              </div>
              <div className="mx-1 h-9 w-[3px] rounded bg-sky-200" />
              <span className="text-3xl">🧟</span>
              <div className="leading-none">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700/70">Zombies</div>
                <div className="text-3xl font-extrabold text-emerald-600">{hud.enemies}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="hud-card flex items-center gap-3 px-4 py-2">
            <span className="text-3xl">🏃</span>
            <div className="leading-none">
              <div className="text-xs font-bold uppercase tracking-wider text-orange-700/70">Humans left</div>
              <div className="text-3xl font-extrabold text-orange-500">
                {hud.humansLeft}
                <span className="text-lg text-orange-400">/{hud.humansTotal}</span>
              </div>
            </div>
            <div className="mx-1 h-9 w-[3px] rounded bg-orange-200" />
            <span className="text-3xl">🧟</span>
            <div className="leading-none">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700/70">Horde</div>
              <div className="text-3xl font-extrabold text-emerald-600">{hud.allies + 1}</div>
            </div>
          </div>
        )}
        <div className="hud-card flex items-center gap-3 self-start px-4 py-1.5">
          <span className="text-2xl">⭐</span>
          <div className="text-2xl font-extrabold tabular-nums text-fuchsia-600">{hud.score.toLocaleString()}</div>
          <div className="text-sm font-bold text-slate-500">⏱ {fmtTime(hud.time)}</div>
        </div>
        {hud.combo > 1 && (
          <div key={hud.combo} className="anim-pop self-start rounded-full border-[3px] border-white bg-gradient-to-r from-pink-400 to-orange-300 px-4 py-0.5 text-xl font-extrabold text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,.2)' }}>
            Combo x{hud.combo}!
          </div>
        )}
      </div>

      {/* bottom-left vitals */}
      <div className="absolute bottom-4 left-4 w-72">
        <div className={`hud-card p-3 ${low ? 'anim-low' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{low ? '💔' : '❤️'}</span>
            <div className="flex-1">
              <Bar value={hud.hp} max={hud.maxHp} from={hpFrom} to={hpTo} h={22} />
            </div>
            <div className="w-10 text-right text-xl font-extrabold tabular-nums text-rose-500">{hud.hp}</div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xl">{hud.sprinting ? '💨' : '👟'}</span>
            <div className="flex-1">
              <Bar value={hud.stamina} max={100} from="#74c0fc" to="#38d9a9" h={12} />
            </div>
          </div>
        </div>
      </div>

      {/* bottom-right weapon / ability */}
      <div className="absolute bottom-4 right-4 flex items-end gap-3">
        {survival ? (
          <div className="hud-card px-4 py-3">
            <div className="mb-1 flex gap-2">
              {['🔫', '🎉', '🥧'].map((e, i) => (
                <div
                  key={i}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border-[3px] text-2xl transition-all"
                  style={{
                    borderColor: hud.weapon === i ? '#ff5d9e' : '#fff',
                    background: hud.weapon === i ? '#ffe3ef' : 'rgba(255,255,255,.6)',
                    transform: hud.weapon === i ? 'translateY(-4px) scale(1.08)' : 'none',
                  }}
                >
                  {e}
                  <span className="absolute -bottom-2 -right-1 rounded-full bg-sky-500 px-1.5 text-[11px] font-extrabold leading-4 text-white">{i + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-500">{hud.weaponName}</div>
            <div className={`text-4xl font-extrabold tabular-nums ${hud.ammoLow ? 'anim-low text-rose-500' : 'text-sky-700'}`}>{hud.ammo}</div>
          </div>
        ) : (
          <div className="hud-card flex items-center gap-4 px-4 py-3">
            <div className="relative h-16 w-16">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${hud.groanReady >= 1 ? '#b197fc' : '#b197fc'} ${hud.groanReady * 360}deg, rgba(200,200,230,.5) 0)` }}
              />
              <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-white text-3xl">{hud.groanReady >= 1 ? '😮' : '😶'}</div>
              <span className="absolute -bottom-1 -right-1 rounded-full bg-violet-500 px-2 text-xs font-extrabold leading-5 text-white">E</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold uppercase tracking-wide text-slate-500">Rally Groan</div>
              <div className={`text-lg font-extrabold ${hud.groanReady >= 1 ? 'text-violet-600' : 'text-slate-400'}`}>
                {hud.groanReady >= 1 ? 'Ready!' : 'Recharging…'}
              </div>
              <div className="text-xs font-semibold text-slate-500">Click = chomp 🧠</div>
            </div>
          </div>
        )}
      </div>

      {/* banner */}
      {hud.banner && showBanner === hud.banner.id && (
        <div key={hud.banner.id} className="anim-banner absolute left-1/2 top-[15%] -translate-x-1/2 text-center">
          <div className="title-bubble text-6xl md:text-7xl" style={{ WebkitTextStroke: '2px #2d6a4f' }}>
            {hud.banner.title}
          </div>
          <div className="mx-auto mt-2 w-fit rounded-full border-[3px] border-white bg-white/80 px-5 py-1 text-lg font-bold text-sky-800">{hud.banner.sub}</div>
        </div>
      )}

      {/* toast */}
      {hud.toast && showToast === hud.toast.id && (
        <div key={hud.toast.id} className="anim-toast absolute left-1/2 top-[30%] -translate-x-1/2">
          <div className="rounded-full border-[3px] border-white px-5 py-1.5 text-xl font-extrabold text-white" style={{ background: hud.toast.color, boxShadow: '0 5px 0 rgba(0,0,0,.15)' }}>
            {hud.toast.text}
          </div>
        </div>
      )}

      {/* early hints */}
      {hud.time < 14 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
          <div className="hud-card px-4 py-1.5 text-center text-sm font-bold text-slate-600">
            {survival
              ? 'WASD move · Shift sprint · Space jump · Click shoot · 1-2-3 swap · R reload'
              : 'WASD move · Shift lunge · Click chomp · E / Right-click groan · eat 🧁 to heal'}
          </div>
        </div>
      )}
      {hud.fallback && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <div className="rounded-full border-[3px] border-white bg-amber-300/90 px-4 py-1 text-xs font-extrabold text-amber-900">
            Mouse capture unavailable here – hold Right Mouse and move to look (or use arrow keys). Click / F to {survival ? 'shoot' : 'chomp'}.
          </div>
        </div>
      )}
    </div>
  );
}
