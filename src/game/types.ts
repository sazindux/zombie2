export type Mode = 'survival' | 'zombie';
export type Phase = 'menu' | 'playing' | 'paused' | 'over';

export interface Settings {
  sensitivity: number; // 0.3 .. 2.5
  volume: number; // 0 .. 1
  music: boolean;
}

export interface Banner {
  id: number;
  title: string;
  sub: string;
}

export interface Toast {
  id: number;
  text: string;
  color: string;
}

export interface HudState {
  mode: Mode;
  hp: number;
  maxHp: number;
  stamina: number;
  weapon: number;
  weaponName: string;
  ammo: string;
  ammoLow: boolean;
  reloading: boolean;
  wave: number;
  enemies: number;
  score: number;
  kills: number;
  combo: number;
  humansLeft: number;
  humansTotal: number;
  allies: number;
  time: number;
  groanReady: number; // 0..1
  sprinting: boolean;
  hitSeq: number;
  killSeq: number;
  headSeq: number;
  hurtSeq: number;
  healSeq: number;
  banner: Banner | null;
  toast: Toast | null;
  fallback: boolean;
}

export interface GameResult {
  win: boolean;
  title: string;
  sub: string;
  score: number;
  lines: [string, string][];
}

export interface GameCallbacks {
  onHud: (h: HudState) => void;
  onPhase: (p: Phase) => void;
  onResult: (r: GameResult) => void;
}
