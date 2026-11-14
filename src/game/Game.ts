import * as THREE from 'three';
import { createWorld, MAP_HALF, ROAD_HALF, type World } from './world';
import {
  buildRig,
  setFlash,
  poseRig,
  humanOptions,
  zombieOptions,
  zombieFromHuman,
  type Rig,
  type HumanKind,
  type ZombieKind,
} from './characters';
import { Particles, FloatTexts } from './fx';
import { buildViewModels, type ViewModels } from './viewmodels';
import { makePickup, type PickupObj, type PickupType } from './pickups';
import { Sfx } from './audio';
import type { GameCallbacks, GameResult, HudState, Mode, Phase, Settings } from './types';

type Team = 'z' | 'h';

interface Actor {
  team: Team;
  kind: string;
  rig: Rig;
  x: number;
  z: number;
  y: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  dmg: number;
  scale: number;
  phase: number;
  flashT: number;
  dead: boolean;
  deadT: number;
  spawnT: number;
  detourT: number;
  detourDir: number;
  blockT: number;
  retargetT: number;
  target: Actor | null;
  wx: number;
  wz: number;
  waitT: number;
  panicT: number;
  shootT: number;
  biteT: number;
  atkT: number;
  lungeT: number;
  tire: number;
  offsetAng: number;
  offsetR: number;
  kx: number;
  kz: number;
  moving: number;
  state: string;
}

interface Proj {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
}

const WEAPONS = [
  { name: 'Splat Blaster', interval: 0.11, auto: true },
  { name: 'Confetti Scatter', interval: 0.72, auto: false },
  { name: 'Pie Cannon', interval: 1.0, auto: false },
];

const RAINBOW = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff99c8, 0x4cc9f0];
const GREENISH = [0x8ee58a, 0xb8f27a, 0xffe66d, 0xffffff];
const CAM_H = 1.68;

const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Game {
  private container: HTMLElement;
  private cb: GameCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private particles = new Particles();
  private floats = new FloatTexts();
  private vm: ViewModels;
  private vmRoot = new THREE.Group();
  readonly sfx = new Sfx();
  private canvas: HTMLCanvasElement;
  private minimap: HTMLCanvasElement | null = null;
  private raf = 0;
  private last = performance.now();
  private clock = 0;
  private resizeObs: ResizeObserver;

  // state
  phase: Phase = 'menu';
  mode: Mode = 'survival';
  settings: Settings = { sensitivity: 1, volume: 0.7, music: true };
  private keys = new Set<string>();
  private mouseDown = false;
  private locked = false;
  private lockEverWorked = false;
  private fallback = false;
  private rmbDown = false;

  // player
  private px = 0;
  private py = 0;
  private pz = 20;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private yaw = 0;
  private pitch = 0;
  private onGround = true;
  private hp = 100;
  private maxHp = 100;
  private stamina = 100;
  private staminaWait = 0;
  private sprinting = false;
  private bobT = 0;
  private bobAmt = 0;
  private shake = 0;
  private invuln = 0;
  private fovKick = 0;
  private swayX = 0;
  private swayY = 0;
  private mdx = 0;
  private mdy = 0;
  private kick = 0;

  // weapons
  private weapon = 0;
  private ammo = [30, 14, 4];
  private maxAmmo = [30, 40, 15];
  private fireCD = 0;
  private reloadT = 0;
  private switchT = 0;
  private recoil = 0;
  private flashT = 0;

  // zombie-mode ability
  private swipeCD = 0;
  private swipeT = -1;
  private swipeHit = false;
  private groanCD = 0;
  private boostT = 0;

  // entities
  private actors: Actor[] = [];
  private projs: Proj[] = [];
  private tracers: Tracer[] = [];
  private pickups: PickupObj[] = [];
  private tmp = { x: 0, z: 0 };
  private raycaster = new THREE.Raycaster();
  private tracerGeo = new THREE.BoxGeometry(1, 1, 1);
  private tracerMats = new Map<number, THREE.MeshBasicMaterial>();

  // game flow
  private playTime = 0;
  private score = 0;
  private kills = 0;
  private headshots = 0;
  private combo = 0;
  private comboT = 0;
  private bestCombo = 0;
  private wave = 0;
  private toSpawn = 0;
  private spawnT = 0;
  private inter = 0;
  private humansTotal = 0;
  private infected = 0;
  private cupcakeT = 0;
  private moanT = 0;
  private hitSeq = 0;
  private killSeq = 0;
  private headSeq = 0;
  private hurtSeq = 0;
  private healSeq = 0;
  private bannerId = 0;
  private toastId = 0;
  private banner: HudState['banner'] = null;
  private toast: HudState['toast'] = null;
  private hudT = 0;
  private mapT = 0;
  private orbit = 0;
  private overT = 0;

  constructor(container: HTMLElement, cb: GameCallbacks) {
    this.container = container;
    this.cb = cb;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0xbfe9ff);
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 700);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0xcfeeff, 70, 270);

    this.world = createWorld();
    this.scene.add(this.world.group, this.world.sky);
    this.scene.add(this.particles.mesh, this.floats.group);

    this.vm = buildViewModels();
    this.camera.add(this.vmRoot);
    this.vm.weapons.forEach((w) => {
      w.visible = false;
      this.vmRoot.add(w);
    });
    this.vm.weapons.forEach((w) => w.scale.setScalar(0.8));
    this.vmRoot.add(this.vm.arms);
    this.vm.arms.visible = false;
    this.vmRoot.visible = false;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    document.addEventListener('contextmenu', this.onContext);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.buildMenuScene();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ public API
  setMinimap(c: HTMLCanvasElement | null) {
    this.minimap = c;
  }

  setSettings(s: Settings) {
    this.settings = s;
    this.sfx.setVolume(s.volume);
    this.sfx.setMusic(s.music);
  }

  start(mode: Mode) {
    this.sfx.init();
    this.sfx.setVolume(this.settings.volume);
    this.sfx.setMusic(this.settings.music);
    this.sfx.startMusic();
    this.mode = mode;
    this.clearAll();
    this.resetPlayer();
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.playTime = 0;
    this.infected = 0;
    this.wave = 0;
    this.banner = null;
    this.toast = null;
    this.ammo = [30, 14, 4];
    this.weapon = 0;
    this.reloadT = 0;
    this.fireCD = 0.3;
    this.groanCD = 0;
    this.boostT = 0;
    this.swipeT = -1;
    this.swipeCD = 0;
    this.cupcakeT = 6;
    this.vmRoot.visible = true;
    this.vm.arms.visible = mode === 'zombie';
    this.vm.weapons.forEach((w, i) => (w.visible = mode === 'survival' && i === 0));

    if (mode === 'survival') {
      this.px = 0;
      this.pz = 22;
      this.yaw = 0;
      this.startWave(1);
      this.spawnPickup('heart', 8, 14);
      this.spawnPickup('gift', -8, 14);
    } else {
      this.px = 0;
      this.pz = 30;
      this.yaw = 0;
      this.spawnHumans();
      for (let i = 0; i < 8; i++) this.spawnCupcake();
      this.showBanner('Be the Zombie!', 'Chomp the townsfolk and grow your horde. Infect everyone!');
    }
    this.setPhase('playing');
    this.requestLock();
    this.emitHud(true);
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.sfx.init();
    this.setPhase('playing');
    this.requestLock();
  }

  toMenu() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.clearAll();
    this.buildMenuScene();
    this.vmRoot.visible = false;
    this.setPhase('menu');
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.keys.clear();
    this.mouseDown = false;
    this.rmbDown = false;
    this.setPhase('paused');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    document.removeEventListener('contextmenu', this.onContext);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.sfx.stopMusic();
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    if (this.canvas.parentElement === this.container) this.container.removeChild(this.canvas);
  }

  // ------------------------------------------------------------------ input
  private setPhase(p: Phase) {
    this.phase = p;
    this.cb.onPhase(p);
  }

  private requestLock() {
    if (this.fallback) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => this.onLockError());
    } catch {
      this.onLockError();
    }
  }

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) {
      this.lockEverWorked = true;
      this.fallback = false;
      if (this.phase === 'paused') {
        this.setPhase('playing');
      }
    } else if (this.phase === 'playing' && !this.fallback) {
      this.pause();
    }
  };

  private onLockError = () => {
    if (!this.lockEverWorked) {
      this.fallback = true;
      if (this.phase === 'paused') this.setPhase('playing');
    } else if (this.phase === 'playing') {
      this.pause();
    }
  };

  private onVisibility = () => {
    if (document.hidden && this.phase === 'playing') this.pause();
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
  };

  private onContext = (e: Event) => {
    if (this.phase === 'playing') e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.phase !== 'playing') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'KeyP') this.pause();
    if (this.mode === 'survival') {
      if (e.code === 'Digit1') this.switchWeapon(0);
      if (e.code === 'Digit2') this.switchWeapon(1);
      if (e.code === 'Digit3') this.switchWeapon(2);
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'KeyQ') this.switchWeapon((this.weapon + 2) % 3);
    } else {
      if (e.code === 'KeyE' || e.code === 'KeyQ') this.groan();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (this.locked || (this.fallback && this.rmbDown)) {
      const s = 0.0022 * this.settings.sensitivity;
      const mx = clamp(e.movementX, -250, 250);
      const my = clamp(e.movementY, -250, 250);
      this.yaw -= mx * s;
      this.pitch = clamp(this.pitch - my * s, -1.5, 1.5);
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (e.target instanceof HTMLElement && e.target.closest('[data-ui]')) return;
    if (e.button === 0) {
      this.mouseDown = true;
      if (this.mode === 'zombie') this.swipe();
    }
    if (e.button === 2) {
      this.rmbDown = true;
      if (this.mode === 'zombie' && this.locked) this.groan();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rmbDown = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.mode !== 'survival') return;
    this.switchWeapon((this.weapon + (e.deltaY > 0 ? 1 : 2)) % 3);
  };

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ loop
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.phase === 'playing') {
      this.clock += dt;
      this.update(dt);
      this.world.update(dt, this.clock);
    } else if (this.phase === 'paused') {
      // frozen
    } else {
      this.clock += dt;
      this.idleUpdate(dt);
      this.world.update(dt, this.clock);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private idleUpdate(dt: number) {
    // menu / game over: orbit camera and keep ambient life going
    this.orbit += dt * 0.07;
    const r = 60;
    this.camera.position.set(Math.cos(this.orbit) * r, 20 + Math.sin(this.clock * 0.3) * 3, Math.sin(this.orbit) * r);
    this.camera.lookAt(0, 4, 0);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.vmRoot.visible = false;
    if (this.phase === 'menu') {
      this.actorsUpdate(dt, true);
      this.pickupsUpdate(dt);
    }
    this.particles.update(dt);
    this.floats.update(dt);
    this.followSun(0, 0);
    this.world.sky.position.copy(this.camera.position);
    if (this.phase === 'over') {
      this.overT += dt;
    }
  }

  private followSun(x: number, z: number) {
    const s = this.world.sun;
    s.position.set(x + 40, 70, z + 25);
    s.target.position.set(x, 0, z);
    s.target.updateMatrixWorld();
  }

  private update(dt: number) {
    this.playTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;

    this.playerUpdate(dt);
    if (this.mode === 'survival') {
      this.weaponUpdate(dt);
      this.waveUpdate(dt);
    } else {
      this.zombieModeUpdate(dt);
    }
    this.actorsUpdate(dt, false);
    this.projectilesUpdate(dt);
    this.pickupsUpdate(dt);
    this.tracersUpdate(dt);
    this.particles.update(dt);
    this.floats.update(dt);
    this.cameraUpdate(dt);
    this.followSun(this.px, this.pz);
    this.world.sky.position.copy(this.camera.position);

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.07;
      this.emitHud();
    }
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 0.05;
      this.drawMinimap();
    }
  }

  // ------------------------------------------------------------------ player
  private resetPlayer() {
    this.px = 0;
    this.py = 0;
    this.pz = 20;
    this.vx = this.vy = this.vz = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.stamina = 100;
    this.shake = 0;
    this.invuln = 0;
    this.mouseDown = false;
    this.keys.clear();
  }

  private playerUpdate(dt: number) {
    const k = this.keys;
    // arrow-key look
    const lookS = 2.0 * dt * this.settings.sensitivity;
    if (k.has('ArrowLeft')) this.yaw += lookS;
    if (k.has('ArrowRight')) this.yaw -= lookS;
    if (k.has('ArrowUp')) this.pitch = clamp(this.pitch + lookS * 0.8, -1.5, 1.5);
    if (k.has('ArrowDown')) this.pitch = clamp(this.pitch - lookS * 0.8, -1.5, 1.5);

    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let wx = fx * f + rx * s;
    let wz = fz * f + rz * s;
    const len = Math.hypot(wx, wz);
    const moving = len > 0.01;
    if (moving) {
      wx /= len;
      wz /= len;
    }

    const survival = this.mode === 'survival';
    const base = survival ? 6.4 : 4.7;
    const sprintSpd = survival ? 9.6 : 7.6;
    const wantSprint = (k.has('ShiftLeft') || k.has('ShiftRight')) && moving && f >= 0;
    if (wantSprint && (this.stamina > 12 || this.sprinting) && this.stamina > 0) this.sprinting = true;
    else this.sprinting = false;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - (survival ? 22 : 33) * dt);
      this.staminaWait = 0.9;
      if (this.stamina <= 0) this.sprinting = false;
    } else {
      this.staminaWait -= dt;
      if (this.staminaWait <= 0) this.stamina = Math.min(100, this.stamina + 24 * dt);
    }
    const spd = this.sprinting ? sprintSpd : base;
    const tx = wx * spd;
    const tz = wz * spd;
    const acc = this.onGround ? 14 : 3.5;
    const a = Math.min(1, dt * acc);
    this.vx += (tx - this.vx) * a;
    this.vz += (tz - this.vz) * a;

    if (k.has('Space') && this.onGround) {
      this.vy = survival ? 7.6 : 7.0;
      this.onGround = false;
      this.sfx.jump();
    }
    this.vy -= 22 * dt;
    this.py += this.vy * dt;
    if (this.py <= 0) {
      if (!this.onGround && this.vy < -6) this.sfx.land();
      this.py = 0;
      this.vy = 0;
      this.onGround = true;
    }
    this.tmp.x = this.px + this.vx * dt;
    this.tmp.z = this.pz + this.vz * dt;
    this.world.pushOut(this.tmp, 0.45);
    this.px = this.tmp.x;
    this.pz = this.tmp.z;

    const hs = Math.hypot(this.vx, this.vz);
    this.bobAmt += ((this.onGround ? hs / base : 0) - this.bobAmt) * Math.min(1, dt * 8);
    this.bobT += dt * (6 + hs * 0.9);
    this.fovKick += ((this.sprinting ? 9 : 0) - this.fovKick) * Math.min(1, dt * 6);
  }

  private hurtPlayer(d: number) {
    if (this.phase !== 'playing' || this.invuln > 0) return;
    this.hp -= d;
    this.hurtSeq++;
    this.shake = Math.min(1, this.shake + 0.3);
    this.invuln = 0.18;
    this.sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.endGame(false);
    }
  }

  private healPlayer(v: number) {
    this.hp = Math.min(this.maxHp, this.hp + v);
    this.healSeq++;
    this.sfx.heal();
  }

  private cameraUpdate(dt: number) {
    const cam = this.camera;
    const bob = Math.sin(this.bobT) * 0.035 * this.bobAmt;
    const bobX = Math.cos(this.bobT * 0.5) * 0.03 * this.bobAmt;
    const sh = this.shake * this.shake;
    cam.position.set(
      this.px + (Math.random() - 0.5) * sh * 0.25 + Math.cos(this.yaw) * bobX,
      this.py + CAM_H + bob + (Math.random() - 0.5) * sh * 0.2,
      this.pz + (Math.random() - 0.5) * sh * 0.25 - Math.sin(this.yaw) * bobX
    );
    const strafe = ((this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)) * -0.015;
    this.kick = Math.min(0.12, this.kick) * Math.max(0, 1 - dt * 9);
    cam.rotation.set(this.pitch + this.kick + (Math.random() - 0.5) * sh * 0.05, this.yaw, strafe + (Math.random() - 0.5) * sh * 0.06);
    const fov = 75 + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 10);
      cam.updateProjectionMatrix();
    }

    // viewmodel sway
    this.swayX += (clamp(-this.mdx * 0.0006, -0.05, 0.05) - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (clamp(this.mdy * 0.0006, -0.05, 0.05) - this.swayY) * Math.min(1, dt * 10);
    this.mdx = this.mdy = 0;
    const bx = Math.cos(this.bobT * 0.5) * 0.012 * this.bobAmt;
    const by = Math.abs(Math.sin(this.bobT)) * -0.014 * this.bobAmt;

    if (this.mode === 'survival') {
      const w = this.vm.weapons[this.weapon];
      const sw = this.switchT > 0 ? this.switchT / 0.25 : 0;
      const rel = this.reloadT > 0 ? Math.sin(clamp(this.reloadT / this.reloadDur(), 0, 1) * Math.PI) : 0;
      w.position.set(0.26 + bx + this.swayX, -0.25 + by + this.swayY - sw * 0.35 - rel * 0.18, -0.48 + this.recoil * 0.12);
      w.rotation.set(this.recoil * 0.22 + rel * 0.5 - sw * 0.6, this.swayX * 1.5 + (this.sprinting ? -0.25 : 0), (this.sprinting ? 0.15 : 0) + rel * -0.2);
      this.recoil = Math.max(0, this.recoil - dt * 9);
      this.switchT = Math.max(0, this.switchT - dt);
      this.flashT -= dt;
      this.vm.flashes[this.weapon].visible = this.flashT > 0;
      if (this.flashT > 0) this.vm.flashes[this.weapon].rotation.z = Math.random() * 3;
    } else {
      const t = this.clock;
      this.vm.arms.position.set(bx + this.swayX, by + this.swayY - (this.sprinting ? 0.04 : 0), 0);
      const idle = Math.sin(t * 2.2) * 0.04;
      const sprintFwd = this.sprinting ? -0.18 : 0;
      this.vm.armL.rotation.set(0.22 + idle + sprintFwd, 0.1, 0.02);
      this.vm.armR.rotation.set(0.22 - idle + sprintFwd, -0.1, -0.02);
      this.vm.armL.position.set(-0.3, -0.42, -0.05);
      this.vm.armR.position.set(0.3, -0.42, -0.05);
      if (this.swipeT >= 0) {
        this.swipeT += dt;
        const k = clamp(this.swipeT / 0.38, 0, 1);
        const sn = Math.sin(k * Math.PI);
        this.vm.armR.rotation.set(0.22 + sn * 0.1 - 0.5 * sn, -0.1 - sn * 1.1, -0.02 + sn * 0.4);
        this.vm.armR.position.x = 0.3 - sn * 0.28;
        this.vm.armL.rotation.set(0.22 - 0.35 * sn, 0.1 + sn * 0.7, 0.02);
        this.vm.armR.position.z = -0.05 - sn * 0.12;
        if (!this.swipeHit && k > 0.3) {
          this.swipeHit = true;
          this.applyBite();
        }
        if (k >= 1) this.swipeT = -1;
      }
      this.swipeCD = Math.max(0, this.swipeCD - dt);
    }
    cam.updateMatrixWorld(true);
  }

  // ------------------------------------------------------------------ survival: weapons
  private reloadDur() {
    return 1.15;
  }

  private switchWeapon(i: number) {
    if (i === this.weapon || this.mode !== 'survival') return;
    this.weapon = i;
    this.switchT = 0.25;
    this.reloadT = 0;
    this.vm.weapons.forEach((w, k) => (w.visible = k === i));
    this.vm.flashes.forEach((f) => (f.visible = false));
    this.sfx.pickup();
  }

  private startReload() {
    if (this.weapon !== 0 || this.reloadT > 0 || this.ammo[0] >= this.maxAmmo[0]) return;
    this.reloadT = this.reloadDur();
    this.sfx.reload();
  }

  private weaponUpdate(dt: number) {
    this.fireCD -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo[0] = this.maxAmmo[0];
        this.reloadT = 0;
      }
    }
    const fireKey = this.mouseDown || this.keys.has('KeyF') || this.keys.has('Enter');
    if (fireKey && this.fireCD <= 0 && this.reloadT <= 0 && this.switchT <= 0) {
      const w = WEAPONS[this.weapon];
      if (!w.auto && this.fireHeld) {
        // semi-auto: needs fresh press
      } else {
        this.fire();
      }
    }
    this.fireHeld = fireKey;
  }
  private fireHeld = false;

  private fire() {
    const wi = this.weapon;
    const w = WEAPONS[wi];
    if (this.ammo[wi] <= 0) {
      this.fireCD = 0.25;
      if (wi === 0) this.startReload();
      else this.sfx.empty();
      return;
    }
    this.ammo[wi]--;
    this.fireCD = w.interval;
    this.recoil = 1;
    this.flashT = 0.05;
    const moveSpread = clamp(Math.hypot(this.vx, this.vz) / 9, 0, 1) * 0.012;
    if (wi === 0) {
      this.sfx.shootBlaster();
      this.hitscan(14, 0.006 + moveSpread, 90, 0xffe66d, 0.03);
      this.kick += 0.006;
      this.shake = Math.min(1, this.shake + 0.04);
      if (this.ammo[0] <= 0) this.startReload();
    } else if (wi === 1) {
      this.sfx.shootScatter();
      for (let i = 0; i < 9; i++) this.hitscan(11, 0.075, 45, RAINBOW[i % RAINBOW.length], 0.04, i === 0);
      this.kick += 0.05;
      this.shake = Math.min(1, this.shake + 0.35);
      // confetti cone out the front
      const o = this.muzzlePos();
      const d = new THREE.Vector3();
      this.camera.getWorldDirection(d);
      for (let i = 0; i < 24; i++) {
        this.particles.emit(
          o.x,
          o.y,
          o.z,
          d.x * rnd(6, 14) + rnd(-2, 2),
          d.y * rnd(6, 14) + rnd(-1, 3),
          d.z * rnd(6, 14) + rnd(-2, 2),
          rnd(0.6, 1.1),
          rnd(0.1, 0.2),
          RAINBOW[i % RAINBOW.length],
          6
        );
      }
    } else {
      this.sfx.shootPie();
      this.launchPie();
      this.kick += 0.06;
      this.shake = Math.min(1, this.shake + 0.3);
    }
  }

  private muzzlePos() {
    const f = this.vm.flashes[this.weapon];
    f.updateWorldMatrix(true, false);
    return f.getWorldPosition(new THREE.Vector3());
  }

  private liveZombieGroups() {
    const out: THREE.Object3D[] = [];
    for (const a of this.actors) {
      if (a.team === 'z' && !a.dead && a.kind !== 'ally' && a.kind !== 'ambient') {
        a.rig.group.userData.actor = a;
        out.push(a.rig.group);
      }
    }
    return out;
  }

  private hitscan(dmg: number, spread: number, range: number, color: number, width: number, primary = true) {
    const cam = this.camera;
    cam.updateMatrixWorld(true);
    const origin = cam.getWorldPosition(new THREE.Vector3());
    const f = cam.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, f).normalize();
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * spread;
    const dir = f.clone().addScaledVector(right, Math.cos(ang) * rr).addScaledVector(up, Math.sin(ang) * rr).normalize();

    this.raycaster.set(origin, dir);
    this.raycaster.far = range;
    const hits = this.raycaster.intersectObjects(this.liveZombieGroups(), true);
    const wallT = this.world.rayBlock(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range);
    let endT = wallT;
    let hitActor = false;
    if (hits.length && hits[0].distance < wallT) {
      const h = hits[0];
      endT = h.distance;
      let o: THREE.Object3D | null = h.object;
      let actor: Actor | undefined;
      while (o) {
        if (o.userData.actor) {
          actor = o.userData.actor as Actor;
          break;
        }
        o = o.parent;
      }
      if (actor) {
        const head = h.object.userData.part === 'head';
        this.damageZombie(actor, head ? dmg * 2 : dmg, head, dir);
        hitActor = true;
        this.particles.burst(h.point.x, h.point.y, h.point.z, head ? 10 : 6, GREENISH, 2.5, 0.1, 0.45, 1.5, 7);
      }
    }
    const end = origin.clone().addScaledVector(dir, endT);
    if (!hitActor && wallT < range - 0.1) {
      this.particles.burst(end.x, Math.max(0.05, end.y), end.z, 5, [0xffffff, color, 0xffe66d], 2.2, 0.09, 0.4, 1, 8);
    }
    if (primary || this.weapon === 0) {
      const start = this.muzzlePos();
      this.addTracer(start, end, color, width);
    }
  }

  private addTracer(from: THREE.Vector3, to: THREE.Vector3, color: number, width: number) {
    let m = this.tracerMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false });
      this.tracerMats.set(color, m);
    }
    const mesh = new THREE.Mesh(this.tracerGeo, m);
    const len = from.distanceTo(to);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.scale.set(width, width, len);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07 });
  }

  private tracersUpdate(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
  }

  private launchPie() {
    const o = this.muzzlePos();
    const d = this.camera.getWorldDirection(new THREE.Vector3());
    const g = new THREE.Group();
    const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.1, 14), new THREE.MeshLambertMaterial({ color: 0xe0a45e }));
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 14), new THREE.MeshLambertMaterial({ color: 0xfff6e5 }));
    cream.position.y = 0.07;
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
    cherry.position.y = 0.15;
    g.add(crust, cream, cherry);
    g.position.copy(o);
    this.scene.add(g);
    const sp = 34;
    this.projs.push({ mesh: g, x: o.x, y: o.y, z: o.z, vx: d.x * sp, vy: d.y * sp + 1.5, vz: d.z * sp, life: 4 });
  }

  private projectilesUpdate(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt;
      p.vy -= 7 * dt;
      const mx = p.vx * dt,
        my = p.vy * dt,
        mz = p.vz * dt;
      const len = Math.hypot(mx, my, mz);
      let explode = false;
      let ex = p.x,
        ey = p.y,
        ez = p.z;
      if (len > 0) {
        const t = this.world.rayBlock(p.x, p.y, p.z, mx / len, my / len, mz / len, len);
        if (t < len - 1e-4) {
          explode = true;
          ex = p.x + (mx / len) * t;
          ey = p.y + (my / len) * t;
          ez = p.z + (mz / len) * t;
        }
      }
      if (!explode) {
        p.x += mx;
        p.y += my;
        p.z += mz;
        ex = p.x;
        ey = p.y;
        ez = p.z;
        for (const a of this.actors) {
          if (a.team !== 'z' || a.dead || a.kind === 'ally' || a.kind === 'ambient') continue;
          const dx = a.x - p.x,
            dz = a.z - p.z;
          if (dx * dx + dz * dz < (a.radius + 0.25) ** 2 && p.y < 2.2 * a.scale && p.y > -0.1) {
            explode = true;
            break;
          }
        }
        if (p.y < 0.1) explode = true;
      }
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y += dt * 12;
      p.mesh.rotation.x = 0.3;
      if (p.life <= 0) explode = true;
      if (explode) {
        this.explodePie(ex, Math.max(0.2, ey), ez);
        this.scene.remove(p.mesh);
        this.projs.splice(i, 1);
      }
    }
  }

  private explodePie(x: number, y: number, z: number) {
    this.sfx.explode();
    this.particles.burst(x, y, z, 70, [0xfff6e5, 0xffe3b0, 0xff99c8, 0xffffff, 0xe63946], 11, 0.28, 1.2, 4, 10);
    this.particles.burst(x, y, z, 40, RAINBOW, 8, 0.2, 1.1, 5, 8);
    // ring
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      this.particles.emit(x, 0.3, z, Math.cos(a) * 9, 0.6, Math.sin(a) * 9, 0.5, 0.22, 0xffffff, 2);
    }
    this.floats.spawn('SPLAT!', '#ff4d8d', x, y + 1.2, z, 1.3);
    const R = 5.2;
    const dcam = Math.hypot(this.px - x, this.pz - z);
    if (dcam < 18) this.shake = Math.min(1, this.shake + (1 - dcam / 18) * 0.8);
    for (const a of this.actors.slice()) {
      if (a.team !== 'z' || a.dead || a.kind === 'ally' || a.kind === 'ambient') continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < R + a.radius) {
        const k = 1 - d / (R + a.radius);
        const dm = 25 + 85 * k;
        this.damageZombie(a, dm, false, new THREE.Vector3(a.x - x, 0, a.z - z).normalize(), 6 * k + 2);
      }
    }
  }

  // ------------------------------------------------------------------ survival: zombies & waves
  private zombieStats(kind: ZombieKind) {
    const w = this.wave;
    switch (kind) {
      case 'runner':
        return { hp: 26, speed: 4.4 + Math.min(1.0, w * 0.05), dmg: 6, radius: 0.42, reach: 1.15 };
      case 'cone':
        return { hp: 90, speed: 2.0 + Math.min(0.6, w * 0.03), dmg: 10, radius: 0.5, reach: 1.25 };
      case 'tank':
        return { hp: 280 + w * 12, speed: 1.9 + Math.min(0.5, w * 0.02), dmg: 22, radius: 0.9, reach: 1.7 };
      default:
        return { hp: 42, speed: 2.2 + Math.min(1.0, w * 0.06), dmg: 8, radius: 0.45, reach: 1.2 };
    }
  }

  private makeActor(team: Team, kind: string, rig: Rig, x: number, z: number): Actor {
    const a: Actor = {
      team,
      kind,
      rig,
      x,
      z,
      y: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: 1,
      maxHp: 1,
      speed: 2,
      radius: 0.45,
      dmg: 5,
      scale: rig.opts.scale,
      phase: Math.random() * 6,
      flashT: 0,
      dead: false,
      deadT: 0,
      spawnT: 0,
      detourT: 0,
      detourDir: Math.random() < 0.5 ? -1 : 1,
      blockT: 0,
      retargetT: Math.random() * 0.3,
      target: null,
      wx: x,
      wz: z,
      waitT: Math.random() * 2,
      panicT: 0,
      shootT: 1 + Math.random(),
      biteT: 0,
      atkT: 0.6,
      lungeT: 0,
      tire: 0,
      offsetAng: Math.random() * Math.PI * 2,
      offsetR: 3 + Math.random() * 3,
      kx: 0,
      kz: 0,
      moving: 0,
      state: 'idle',
    };
    rig.group.position.set(x, 0, z);
    rig.group.userData.actor = a;
    this.scene.add(rig.group);
    this.actors.push(a);
    return a;
  }

  private spawnZombie(kind: ZombieKind, x: number, z: number) {
    const rig = buildRig(zombieOptions(kind));
    const a = this.makeActor('z', kind, rig, x, z);
    const st = this.zombieStats(kind);
    a.hp = a.maxHp = st.hp;
    a.speed = st.speed * rnd(0.9, 1.1);
    a.dmg = st.dmg;
    a.radius = st.radius;
    a.spawnT = 0.0001;
    rig.group.scale.setScalar(0.01);
    this.particles.burst(x, 0.3, z, 14, GREENISH, 3, 0.16, 0.6, 2, 5);
    return a;
  }

  private startWave(n: number) {
    this.wave = n;
    this.toSpawn = 6 + n * 3 + Math.floor(n * n * 0.25);
    this.spawnT = 2.2;
    this.inter = 0;
    this.sfx.wave();
    this.showBanner(`Wave ${n}`, n === 1 ? 'Pop the zombies with your toy blasters!' : n % 4 === 0 ? 'Big ones incoming!' : 'Here they come!');
  }

  private pickKind(): ZombieKind {
    const w = this.wave;
    const r = Math.random();
    if (w >= 4 && r < 0.05 + Math.min(0.08, w * 0.006)) return 'tank';
    if (w >= 3 && r < 0.3) return 'cone';
    if (w >= 2 && r < 0.55) return 'runner';
    return 'normal';
  }

  private aliveEnemies() {
    let n = 0;
    for (const a of this.actors) if (a.team === 'z' && !a.dead && a.kind !== 'ally' && a.kind !== 'ambient') n++;
    return n;
  }

  private waveUpdate(dt: number) {
    if (this.inter > 0) {
      this.inter -= dt;
      if (this.inter <= 0) this.startWave(this.wave + 1);
      return;
    }
    const alive = this.aliveEnemies();
    const cap = Math.min(10 + this.wave * 2, 24);
    this.spawnT -= dt;
    if (this.toSpawn > 0 && alive < cap && this.spawnT <= 0) {
      this.spawnT = Math.max(0.35, 1.5 - this.wave * 0.1);
      for (let tries = 0; tries < 14; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = rnd(26, 46);
        const x = clamp(this.px + Math.cos(a) * d, -MAP_HALF + 3, MAP_HALF - 3);
        const z = clamp(this.pz + Math.sin(a) * d, -MAP_HALF + 3, MAP_HALF - 3);
        if (Math.hypot(x - this.px, z - this.pz) < 20) continue;
        if (!this.world.isFree(x, z, 0.8)) continue;
        this.spawnZombie(this.pickKind(), x, z);
        this.toSpawn--;
        break;
      }
    }
    if (this.toSpawn <= 0 && alive === 0) {
      this.inter = 6;
      const bonus = this.wave * 50;
      this.score += bonus;
      this.sfx.win();
      this.showBanner('Wave cleared!', `+${bonus} bonus · supplies dropped nearby`);
      this.dropSupplies();
    }
  }

  private dropSupplies() {
    const kinds: PickupType[] = ['heart', 'gift', 'gift'];
    for (const k of kinds) {
      for (let t = 0; t < 12; t++) {
        const a = Math.random() * Math.PI * 2;
        const d = rnd(4, 10);
        const x = this.px + Math.cos(a) * d;
        const z = this.pz + Math.sin(a) * d;
        if (this.world.isFree(x, z, 0.6)) {
          this.spawnPickup(k, x, z);
          break;
        }
      }
    }
  }

  private damageZombie(a: Actor, dmg: number, head: boolean, dir: THREE.Vector3, knock = 0.6) {
    if (a.dead) return;
    a.hp -= dmg;
    a.flashT = 0.08;
    a.kx += dir.x * knock;
    a.kz += dir.z * knock;
    this.hitSeq++;
    if (head) {
      this.headSeq++;
      this.sfx.head();
    } else this.sfx.hit();
    this.floats.spawn(`${Math.round(dmg)}${head ? '!' : ''}`, head ? '#ff2d6f' : '#ff8a00', a.x, (head ? 2.1 : 1.6) * a.scale, a.z, head ? 1.1 : 0.8);
    if (a.hp <= 0) {
      this.killZombie(a, head);
    }
  }

  private killZombie(a: Actor, head: boolean) {
    a.dead = true;
    a.deadT = 0;
    this.kills++;
    this.killSeq++;
    if (head) this.headshots++;
    this.combo++;
    this.comboT = 3.2;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const base = a.kind === 'tank' ? 60 : a.kind === 'cone' ? 20 : a.kind === 'runner' ? 15 : 10;
    const pts = Math.round((base + (head ? 5 : 0)) * (1 + Math.min(this.combo - 1, 10) * 0.2));
    this.score += pts;
    this.sfx.pop();
    const cy = 1.1 * a.scale;
    this.particles.burst(a.x, cy, a.z, a.kind === 'tank' ? 90 : 38, RAINBOW, 6.5, 0.2, 1.3, 4, 9);
    this.particles.burst(a.x, cy, a.z, 12, [0xffffff, 0xffe66d], 4, 0.14, 0.7, 3, 5);
    this.floats.spawn(`+${pts}`, '#12b886', a.x, 2.4 * a.scale, a.z, 1);
    const r = Math.random();
    if (r < 0.13) this.spawnPickup('heart', a.x, a.z);
    else if (r < 0.33) this.spawnPickup('gift', a.x, a.z);
  }

  // ------------------------------------------------------------------ actors (shared)
  private moveActor(a: Actor, mx: number, mz: number) {
    this.tmp.x = a.x + mx;
    this.tmp.z = a.z + mz;
    this.world.pushOut(this.tmp, a.radius);
    const d = Math.hypot(this.tmp.x - a.x, this.tmp.z - a.z);
    a.x = this.tmp.x;
    a.z = this.tmp.z;
    return d;
  }

  private steer(a: Actor, dirx: number, dirz: number, speed: number, dt: number, turn = 9) {
    let dx = dirx,
      dz = dirz;
    if (a.detourT > 0) {
      a.detourT -= dt;
      const ang = a.detourDir * 1.25;
      const c = Math.cos(ang),
        s = Math.sin(ang);
      const nx = dx * c - dz * s;
      const nz = dx * s + dz * c;
      dx = nx;
      dz = nz;
    }
    const expect = speed * dt;
    const moved = this.moveActor(a, dx * expect, dz * expect);
    if (moved < expect * 0.45) {
      a.blockT += dt;
      if (a.blockT > 0.28 && a.detourT <= 0) {
        a.detourT = rnd(0.8, 1.7);
        a.detourDir = Math.random() < 0.5 ? -1 : 1;
        a.blockT = 0;
      }
    } else a.blockT = Math.max(0, a.blockT - dt);
    if (dx * dx + dz * dz > 1e-4) a.yaw = lerpAngle(a.yaw, Math.atan2(dirx, dirz), 1 - Math.exp(-turn * dt));
    a.moving = Math.min(1, moved / Math.max(1e-5, expect));
    a.phase += dt * (2.5 + speed * 1.9) * Math.max(0.3, a.moving);
  }

  private wander(a: Actor, dt: number, speed: number) {
    if (a.waitT > 0) {
      a.waitT -= dt;
      a.moving = 0;
      return;
    }
    const dx = a.wx - a.x,
      dz = a.wz - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.0) {
      a.waitT = rnd(0.8, 4);
      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = rnd(5, 14);
        const nx = clamp(a.x + Math.cos(ang) * r, -MAP_HALF + 4, MAP_HALF - 4);
        const nz = clamp(a.z + Math.sin(ang) * r, -MAP_HALF + 4, MAP_HALF - 4);
        if (this.world.isFree(nx, nz, 0.6)) {
          a.wx = nx;
          a.wz = nz;
          break;
        }
      }
      return;
    }
    this.steer(a, dx / d, dz / d, speed, dt, 5);
  }

  private separate() {
    const list = this.actors;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || a.team !== b.team) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        if (Math.abs(dx) > 1.6 || Math.abs(dz) > 1.6) continue;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001;
        const push = ((rr - d) / d) * 0.5;
        const ux = dx * push,
          uz = dz * push;
        a.x -= ux;
        a.z -= uz;
        b.x += ux;
        b.z += uz;
      }
    }
  }

  private actorsUpdate(dt: number, menu: boolean) {
    const playing = this.phase === 'playing';
    // threats for humans
    const threats: { x: number; z: number; a: Actor | null }[] = [];
    if (this.mode === 'zombie' && playing) threats.push({ x: this.px, z: this.pz, a: null });
    for (const a of this.actors) if (a.team === 'z' && !a.dead && a.kind === 'ally') threats.push({ x: a.x, z: a.z, a });

    for (const a of this.actors) {
      if (a.dead) continue;
      if (a.spawnT > 0) {
        a.spawnT += dt;
        const k = Math.min(1, a.spawnT / 0.45);
        const s = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1;
        a.rig.group.scale.setScalar(Math.max(0.01, a.scale * k * s));
        if (k >= 1) {
          a.spawnT = 0;
          a.rig.group.scale.setScalar(a.scale);
        }
      }
      // knockback
      if (Math.abs(a.kx) + Math.abs(a.kz) > 0.01) {
        this.moveActor(a, a.kx * dt * 8, a.kz * dt * 8);
        a.kx *= 1 - Math.min(1, dt * 9);
        a.kz *= 1 - Math.min(1, dt * 9);
      }
      if (a.team === 'z') {
        if (a.kind === 'ally') this.allyUpdate(a, dt);
        else if (a.kind === 'ambient') {
          this.wander(a, dt, 1.2);
          poseRig(a.rig, a.phase, 0.5 * a.moving, 'zombie', this.clock);
        } else if (playing) this.enemyUpdate(a, dt);
        else poseRig(a.rig, a.phase, 0, 'zombie', this.clock);
      } else {
        this.humanUpdate(a, dt, threats, menu);
      }
      if (a.flashT > 0) {
        a.flashT -= dt;
        setFlash(a.rig, a.flashT > 0);
      } else if (a.rig.flashing) setFlash(a.rig, false);
    }
    this.separate();

    // dying actors & transforms
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      if (a.dead) {
        a.deadT += dt;
        const k = a.deadT / 0.3;
        if (k >= 1) {
          this.scene.remove(a.rig.group);
          this.actors.splice(i, 1);
          continue;
        }
        a.rig.group.scale.setScalar(Math.max(0.01, a.scale * (1 - k) * (1 + k * 0.4)));
        a.rig.group.rotation.y += dt * 14;
        a.y = k * 0.8;
      }
      a.rig.group.position.set(a.x, a.y, a.z);
      if (!a.dead) a.rig.group.rotation.y = a.yaw;
    }
  }

  private enemyUpdate(a: Actor, dt: number) {
    const dx = this.px - a.x;
    const dz = this.pz - a.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const reach = a.radius + 0.45 + (a.kind === 'tank' ? 0.8 : 0.35);
    if (d > reach) {
      this.steer(a, dx / d, dz / d, a.speed, dt);
      a.atkT = 0.55;
      poseRig(a.rig, a.phase, Math.min(1, 0.4 + a.speed * 0.15) * a.moving, 'zombie', this.clock);
    } else {
      a.yaw = lerpAngle(a.yaw, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
      a.atkT -= dt;
      a.moving = 0;
      poseRig(a.rig, a.phase, 0, 'bite', this.clock);
      if (a.atkT <= 0) {
        a.atkT = a.kind === 'runner' ? 0.8 : 1.0;
        if (Math.abs(this.py) < 1.6) this.hurtPlayer(a.dmg);
        a.lungeT = 0.2;
      }
    }
    // distant moan
    if (this.moanT <= 0 && d < 28 && Math.random() < dt * 0.15) {
      this.moanT = 1.8;
      this.sfx.zombieMoan(clamp(1 - d / 30, 0.1, 1));
    }
    this.moanT -= dt * 0.2;
  }

  // ------------------------------------------------------------------ zombie mode
  private spawnHumans() {
    const plan: HumanKind[] = [];
    for (let i = 0; i < 17; i++) plan.push('civilian');
    for (let i = 0; i < 7; i++) plan.push('kid');
    for (let i = 0; i < 6; i++) plan.push('guard');
    this.humansTotal = plan.length;
    for (const kind of plan) this.spawnHuman(kind, 24);
  }

  private spawnHuman(kind: HumanKind, minDist: number) {
    for (let t = 0; t < 40; t++) {
      const x = rnd(-MAP_HALF + 6, MAP_HALF - 6);
      const z = rnd(-MAP_HALF + 6, MAP_HALF - 6);
      if (!this.world.isFree(x, z, 0.7)) continue;
      if (Math.hypot(x - this.px, z - this.pz) < minDist) continue;
      const rig = buildRig(humanOptions(kind));
      const a = this.makeActor('h', kind, rig, x, z);
      a.maxHp = a.hp = kind === 'guard' ? 2 : 1;
      a.speed = kind === 'kid' ? 5.4 : kind === 'guard' ? 4.5 : 5.0;
      a.radius = kind === 'kid' ? 0.34 : 0.42;
      return a;
    }
    return null;
  }

  private buildMenuScene() {
    this.px = 0;
    this.pz = 200; // far away so nobody cares
    this.phaseMenuMode();
    for (let i = 0; i < 14; i++) this.spawnHuman(i % 4 === 0 ? 'kid' : 'civilian', 0);
    for (let i = 0; i < 6; i++) {
      for (let t = 0; t < 20; t++) {
        const x = rnd(-50, 50);
        const z = rnd(-50, 50);
        if (!this.world.isFree(x, z, 0.7)) continue;
        const rig = buildRig(zombieOptions(i % 3 === 0 ? 'cone' : 'normal'));
        const a = this.makeActor('z', 'ambient', rig, x, z);
        a.radius = 0.45;
        break;
      }
    }
    for (let i = 0; i < 3; i++) this.spawnPickupAt('cupcake');
  }

  private phaseMenuMode() {
    this.mode = 'zombie';
  }

  private spawnPickupAt(type: PickupType) {
    for (let t = 0; t < 20; t++) {
      const x = rnd(-50, 50);
      const z = rnd(-50, 50);
      if (this.world.isFree(x, z, 0.8)) {
        this.spawnPickup(type, x, z);
        return;
      }
    }
  }

  private spawnCupcake() {
    for (let t = 0; t < 30; t++) {
      const x = rnd(-MAP_HALF + 6, MAP_HALF - 6);
      const z = rnd(-MAP_HALF + 6, MAP_HALF - 6);
      if (!this.world.isFree(x, z, 0.8)) continue;
      if (Math.hypot(x - this.px, z - this.pz) < 10) continue;
      this.spawnPickup('cupcake', x, z);
      return;
    }
  }

  private zombieModeUpdate(dt: number) {
    this.groanCD = Math.max(0, this.groanCD - dt);
    this.boostT = Math.max(0, this.boostT - dt);
    // cupcake respawn
    this.cupcakeT -= dt;
    if (this.cupcakeT <= 0) {
      this.cupcakeT = 18;
      const n = this.pickups.filter((p) => p.type === 'cupcake').length;
      if (n < 6) this.spawnCupcake();
    }
    // win check
    const humans = this.actors.filter((a) => a.team === 'h' && !a.dead).length;
    if (humans === 0 && this.humansTotal > 0 && this.phase === 'playing') this.endGame(true);
  }

  private swipe() {
    if (this.mode !== 'zombie' || this.swipeCD > 0 || this.swipeT >= 0) return;
    this.swipeCD = 0.55;
    this.swipeT = 0;
    this.swipeHit = false;
    this.sfx.swipe();
  }

  private applyBite() {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const reach = this.sprinting ? 3.7 : 3.1;
    let best: Actor | null = null;
    let bestD = Infinity;
    for (const a of this.actors) {
      if (a.team !== 'h' || a.dead) continue;
      const dx = a.x - this.px,
        dz = a.z - this.pz;
      const d = Math.hypot(dx, dz);
      if (d - a.radius > reach) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.5 && d > 1.0) continue;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best) {
      if (best.kind === 'guard' && best.hp > 1) {
        best.hp--;
        best.flashT = 0.12;
        best.kx += fx * 1.2;
        best.kz += fz * 1.2;
        this.sfx.hit();
        this.hitSeq++;
        this.floats.spawn('Ouch!', '#f59f00', best.x, 2.3, best.z, 1);
        this.shake = Math.min(1, this.shake + 0.15);
      } else {
        this.infect(best);
      }
    } else {
      this.particles.burst(this.px + fx * 1.5, 1.2, this.pz + fz * 1.5, 4, [0xffffff], 2, 0.08, 0.3, 0.5, 4);
    }
  }

  private infect(h: Actor) {
    const x = h.x,
      z = h.z,
      yaw = h.yaw;
    const wasKind = h.kind;
    h.dead = true;
    h.deadT = 10; // removed on next pass
    this.scene.remove(h.rig.group);
    const idx = this.actors.indexOf(h);
    if (idx >= 0) this.actors.splice(idx, 1);
    const rig = buildRig(zombieFromHuman(h.rig.opts));
    const a = this.makeActor('z', 'ally', rig, x, z);
    a.yaw = yaw;
    a.radius = wasKind === 'kid' ? 0.34 : 0.42;
    a.hp = a.maxHp = wasKind === 'guard' ? 40 : 25;
    a.speed = wasKind === 'kid' ? 4.9 : 4.2;
    a.spawnT = 0.0001;
    rig.group.scale.setScalar(0.01);
    this.infected++;
    this.kills++;
    const pts = wasKind === 'guard' ? 250 : wasKind === 'kid' ? 150 : 100;
    this.score += pts;
    this.hitSeq++;
    this.killSeq++;
    this.sfx.chomp();
    this.particles.burst(x, 1.1, z, 34, [0x8ee58a, 0xb8f27a, 0xffe66d, 0xffffff, 0x4cc9f0], 6, 0.18, 1.1, 3.5, 8);
    const left = this.actors.filter((q) => q.team === 'h' && !q.dead).length;
    const lines = ['Braaains!', 'Yum!', 'Chomp!', 'Nom nom!', 'Join us!', 'Zzzombie!'];
    this.floats.spawn(lines[Math.floor(Math.random() * lines.length)], '#37b24d', x, 2.4, z, 1.2);
    this.showToast(`+${pts}  ${wasKind === 'guard' ? 'Guard' : wasKind === 'kid' ? 'Kid' : 'Citizen'} infected! ${left} left`, '#37b24d');
  }

  private groan() {
    if (this.mode !== 'zombie' || this.groanCD > 0 || this.phase !== 'playing') return;
    this.groanCD = 9;
    this.boostT = 5;
    this.sfx.groan();
    this.shake = Math.min(1, this.shake + 0.5);
    this.fovKick += 6;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      this.particles.emit(this.px, 0.5, this.pz, Math.cos(a) * 18, 0.5, Math.sin(a) * 18, 0.7, 0.28, i % 2 ? 0x9bf6ff : 0xb8f27a, 1);
    }
    for (const a of this.actors) {
      if (a.team === 'h' && !a.dead && a.kind !== 'guard') {
        if (Math.hypot(a.x - this.px, a.z - this.pz) < 30) a.panicT = 5;
      }
    }
    const n = this.actors.filter((a) => a.team === 'z' && a.kind === 'ally' && !a.dead).length;
    this.showToast(n > 0 ? `GROOOAN! Your horde of ${n} charges!` : 'GROOOAN! Everyone panics!', '#7048e8');
  }

  private allyUpdate(a: Actor, dt: number) {
    if (this.phase !== 'playing') {
      poseRig(a.rig, a.phase, 0, 'zombie', this.clock);
      return;
    }
    const boost = this.boostT > 0;
    a.retargetT -= dt;
    if (a.retargetT <= 0 || (a.target && a.target.dead)) {
      a.retargetT = 0.5;
      let best: Actor | null = null;
      let bd = boost ? 90 : 48;
      for (const h of this.actors) {
        if (h.team !== 'h' || h.dead) continue;
        const d = Math.hypot(h.x - a.x, h.z - a.z);
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      a.target = best;
    }
    const spd = (boost ? 6.1 : a.speed) * (a.kind === 'ally' ? 1 : 1);
    const t = a.target;
    if (t && !t.dead) {
      const dx = t.x - a.x,
        dz = t.z - a.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d > a.radius + t.radius + 0.55) {
        this.steer(a, dx / d, dz / d, spd, dt);
        a.biteT = 0;
        poseRig(a.rig, a.phase, a.moving, 'zombie', this.clock);
      } else {
        a.yaw = lerpAngle(a.yaw, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
        a.moving = 0;
        a.biteT += dt;
        poseRig(a.rig, a.phase, 0, 'bite', this.clock);
        if (a.biteT > (t.kind === 'guard' ? 1.5 : 0.7)) {
          a.biteT = 0;
          this.infect(t);
        }
      }
    } else {
      // follow the player
      const tx = this.px + Math.cos(a.offsetAng) * a.offsetR;
      const tz = this.pz + Math.sin(a.offsetAng) * a.offsetR;
      const dx = tx - a.x,
        dz = tz - a.z;
      const d = Math.hypot(dx, dz);
      const far = Math.hypot(this.px - a.x, this.pz - a.z) > 9;
      if (d > 1.2) this.steer(a, dx / d, dz / d, far ? Math.max(spd, 5.2) : spd * 0.8, dt);
      else {
        a.moving = 0;
        a.yaw += Math.sin(this.clock + a.offsetAng) * dt * 0.5;
      }
      poseRig(a.rig, a.phase, a.moving * 0.8, 'zombie', this.clock);
    }
  }

  private humanUpdate(a: Actor, dt: number, threats: { x: number; z: number; a: Actor | null }[], menu: boolean) {
    if (menu || this.phase !== 'playing') {
      this.wander(a, dt, a.kind === 'kid' ? 2.0 : 1.6);
      poseRig(a.rig, a.phase, 0.7 * a.moving, 'walk', this.clock);
      return;
    }
    a.panicT = Math.max(0, a.panicT - dt);
    const sense = a.kind === 'kid' ? 14 : a.kind === 'guard' ? 11 : 16;
    let fx = 0,
      fz = 0,
      nearest = Infinity,
      near9 = 0;
    let nt: (typeof threats)[number] | null = null;
    for (const t of threats) {
      const dx = a.x - t.x,
        dz = a.z - t.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < nearest) {
        nearest = d;
        nt = t;
      }
      if (d < 9) near9++;
      const range = a.panicT > 0 ? 30 : sense;
      if (d < range) {
        const w = Math.pow((range - d) / range, 1.5) + 0.15;
        fx += (dx / d) * w;
        fz += (dz / d) * w;
      }
    }

    // armed guards
    if (a.kind === 'guard' && nt && nearest < 26 && near9 < 3) {
      const eye = 1.4;
      const tx = nt.x - a.x,
        tz = nt.z - a.z;
      const dl = Math.hypot(tx, tz);
      const clear = this.world.rayBlock(a.x, eye, a.z, tx / dl, 0, tz / dl, dl) >= dl - 0.01;
      if (clear) {
        a.yaw = lerpAngle(a.yaw, Math.atan2(tx, tz), 1 - Math.exp(-10 * dt));
        if (nearest < 7) this.steer(a, -tx / dl, -tz / dl, 3.4, dt);
        else a.moving = 0;
        poseRig(a.rig, a.phase, a.moving * 0.7, 'aim', this.clock);
        a.shootT -= dt;
        if (a.shootT <= 0) {
          a.shootT = rnd(0.85, 1.4);
          this.guardShoot(a, nt, dl);
        }
        return;
      }
    }

    const fl = Math.hypot(fx, fz);
    if (fl > 0.02 || (a.panicT > 0 && nearest < 40)) {
      // flee
      a.tire = Math.min(14, a.tire + dt);
      // pull toward the middle when near the fence
      const edge = MAP_HALF - 14;
      if (Math.abs(a.x) > edge) fx -= Math.sign(a.x) * clamp((Math.abs(a.x) - edge) / 14, 0, 1) * 1.1;
      if (Math.abs(a.z) > edge) fz -= Math.sign(a.z) * clamp((Math.abs(a.z) - edge) / 14, 0, 1) * 1.1;
      let l = Math.hypot(fx, fz);
      if (l < 0.001) {
        fx = a.x - (nt ? nt.x : 0);
        fz = a.z - (nt ? nt.z : 0);
        l = Math.hypot(fx, fz) || 1;
      }
      const tired = 1 - 0.32 * clamp((a.tire - 4) / 8, 0, 1);
      const spd = a.speed * tired * (a.panicT > 0 ? 1.08 : 1);
      this.steer(a, fx / l, fz / l, spd, dt, 12);
      poseRig(a.rig, a.phase, Math.max(0.6, a.moving), 'flee', this.clock);
      // little squeak
      if (Math.random() < dt * 0.4 && nearest < 12) {
        this.floats.spawn(Math.random() < 0.5 ? 'Eek!' : '!!', '#e8590c', a.x, 2.3 * a.scale, a.z, 0.7);
      }
    } else {
      a.tire = Math.max(0, a.tire - dt * 0.8);
      this.wander(a, dt, a.kind === 'kid' ? 2.1 : 1.7);
      poseRig(a.rig, a.phase, 0.7 * a.moving, 'walk', this.clock);
    }
  }

  private guardShoot(a: Actor, t: { x: number; z: number; a: Actor | null }, dist: number) {
    const from = new THREE.Vector3(a.x + Math.sin(a.yaw) * 0.6, 1.25 * a.scale, a.z + Math.cos(a.yaw) * 0.6);
    const isPlayer = t.a === null;
    const hit = Math.random() < (isPlayer ? 0.5 : 0.7);
    const to = new THREE.Vector3(t.x + (hit ? 0 : rnd(-1.5, 1.5)), 1.2, t.z + (hit ? 0 : rnd(-1.5, 1.5)));
    this.addTracer(from, to, 0xff6b9d, 0.07);
    if (dist < 40) this.sfx.dart();
    if (hit) {
      if (isPlayer) {
        this.hurtPlayer(5);
      } else if (t.a && !t.a.dead) {
        t.a.hp -= 10;
        t.a.flashT = 0.1;
        this.particles.burst(t.a.x, 1.2, t.a.z, 6, [0xff6b9d, 0xffffff], 3, 0.12, 0.5, 2, 6);
        if (t.a.hp <= 0) this.killAlly(t.a);
      }
    }
  }

  private killAlly(a: Actor) {
    a.dead = true;
    a.deadT = 0;
    this.sfx.pop();
    this.particles.burst(a.x, 1.1, a.z, 30, GREENISH, 5, 0.18, 1, 3, 8);
    this.floats.spawn('Poof!', '#868e96', a.x, 2.2, a.z, 0.9);
  }

  // ------------------------------------------------------------------ pickups
  private spawnPickup(type: PickupType, x: number, z: number) {
    const p = makePickup(type, x, z);
    this.scene.add(p.group);
    this.pickups.push(p);
  }

  private pickupsUpdate(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.life += dt;
      p.body.position.y = 1.1 + Math.sin(p.t * 2.4) * 0.18;
      p.body.rotation.y += dt * 2.2;
      const d = Math.hypot(p.x - this.px, p.z - this.pz);
      let take = false;
      if (d < 1.7) {
        if (p.type === 'heart' || p.type === 'cupcake') {
          if (this.hp < this.maxHp) {
            this.healPlayer(p.type === 'heart' ? 35 : 40);
            this.floats.spawn(p.type === 'heart' ? '+35 HP' : '+40 HP', '#e03131', p.x, 2, p.z, 1);
            take = true;
          } else if (this.mode === 'zombie' && p.type === 'cupcake') {
            this.score += 20;
            this.floats.spawn('Yum! +20', '#d6336c', p.x, 2, p.z, 1);
            this.sfx.pickup();
            take = true;
          }
        } else {
          const w = Math.random() < 0.6 ? 1 : 2;
          const n = w === 1 ? 10 : 3;
          this.ammo[w] = Math.min(this.maxAmmo[w], this.ammo[w] + n);
          this.floats.spawn(`+${n} ${w === 1 ? 'Confetti' : 'Pies'}`, '#1c7ed6', p.x, 2, p.z, 1);
          this.sfx.pickup();
          take = true;
        }
      }
      if (take || (p.type === 'gift' && p.life > 45) || (p.type === 'heart' && p.life > 45)) {
        if (take) this.particles.burst(p.x, 1.2, p.z, 16, RAINBOW, 4, 0.14, 0.8, 3, 6);
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------------ flow
  private clearAll() {
    for (const a of this.actors) this.scene.remove(a.rig.group);
    this.actors = [];
    for (const p of this.projs) this.scene.remove(p.mesh);
    this.projs = [];
    for (const t of this.tracers) this.scene.remove(t.mesh);
    this.tracers = [];
    for (const p of this.pickups) this.scene.remove(p.group);
    this.pickups = [];
    this.particles.clear();
    this.floats.clear();
    this.humansTotal = 0;
    this.toSpawn = 0;
    this.inter = 0;
  }

  private showBanner(title: string, sub: string) {
    this.banner = { id: ++this.bannerId, title, sub };
  }
  private showToast(text: string, color: string) {
    this.toast = { id: ++this.toastId, text, color };
  }

  private endGame(win: boolean) {
    if (this.phase !== 'playing') return;
    this.keys.clear();
    this.mouseDown = false;
    this.overT = 0;
    if (win) this.sfx.win();
    else this.sfx.lose();
    const t = Math.floor(this.playTime);
    const mm = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    let res: GameResult;
    if (this.mode === 'survival') {
      res = {
        win: false,
        title: 'Zombies partied too hard!',
        sub: `You made it to wave ${this.wave}`,
        score: this.score,
        lines: [
          ['Wave reached', String(this.wave)],
          ['Zombies popped', String(this.kills)],
          ['Headshots', String(this.headshots)],
          ['Best combo', `x${this.bestCombo}`],
          ['Time survived', mm],
        ],
      };
    } else if (win) {
      const bonus = Math.max(0, Math.round((420 - this.playTime) * 4));
      this.score += bonus;
      res = {
        win: true,
        title: 'Town Conquered!',
        sub: 'Every last citizen has joined the horde. Braaavo!',
        score: this.score,
        lines: [
          ['Citizens infected', `${this.infected}`],
          ['Horde size', `${this.actors.filter((a) => a.kind === 'ally' && !a.dead).length}`],
          ['Time', mm],
          ['Speed bonus', `+${bonus}`],
        ],
      };
    } else {
      res = {
        win: false,
        title: 'You got poofed!',
        sub: 'The guards popped your zombie bubble.',
        score: this.score,
        lines: [
          ['Citizens infected', `${this.infected} / ${this.humansTotal}`],
          ['Time', mm],
        ],
      };
    }
    this.setPhase('over');
    if (document.pointerLockElement) document.exitPointerLock();
    this.cb.onResult(res);
    this.emitHud(true);
  }

  // ------------------------------------------------------------------ HUD
  private emitHud(_force = false) {
    const survival = this.mode === 'survival';
    const w = WEAPONS[this.weapon];
    let ammo = '';
    let low = false;
    if (survival) {
      if (this.weapon === 0) {
        ammo = this.reloadT > 0 ? 'Reloading…' : `${this.ammo[0]} / ${this.maxAmmo[0]}`;
        low = this.ammo[0] <= 6;
      } else {
        ammo = `${this.ammo[this.weapon]}`;
        low = this.ammo[this.weapon] <= 2;
      }
    }
    const humansLeft = this.actors.filter((a) => a.team === 'h' && !a.dead).length;
    this.cb.onHud({
      mode: this.mode,
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      stamina: this.stamina,
      weapon: this.weapon,
      weaponName: survival ? w.name : 'Zombie Claws',
      ammo,
      ammoLow: low,
      reloading: this.reloadT > 0,
      wave: this.wave,
      enemies: survival ? this.aliveEnemies() + this.toSpawn : 0,
      score: this.score,
      kills: this.kills,
      combo: this.combo,
      humansLeft,
      humansTotal: this.humansTotal,
      allies: this.actors.filter((a) => a.kind === 'ally' && !a.dead).length,
      time: this.playTime,
      groanReady: this.groanCD <= 0 ? 1 : 1 - this.groanCD / 9,
      sprinting: this.sprinting,
      hitSeq: this.hitSeq,
      killSeq: this.killSeq,
      headSeq: this.headSeq,
      hurtSeq: this.hurtSeq,
      healSeq: this.healSeq,
      banner: this.banner,
      toast: this.toast,
      fallback: this.fallback,
    });
  }

  private drawMinimap() {
    const c = this.minimap;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const size = c.width;
    const view = 40;
    const s = size / 2 / view;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#c9f2b8';
    ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    ctx.rotate(this.yaw);
    ctx.scale(s, s);
    ctx.translate(-this.px, -this.pz);
    ctx.fillStyle = '#e9edf7';
    ctx.fillRect(-ROAD_HALF, -MAP_HALF, ROAD_HALF * 2, MAP_HALF * 2);
    ctx.fillRect(-MAP_HALF, -ROAD_HALF, MAP_HALF * 2, ROAD_HALF * 2);
    ctx.strokeStyle = '#ff8fab';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
    for (const b of this.world.boxes) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
    }
    for (const ci of this.world.circles) {
      ctx.fillStyle = ci.color;
      ctx.beginPath();
      ctx.arc(ci.x, ci.z, ci.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.pickups) {
      ctx.fillStyle = p.type === 'gift' ? '#1c7ed6' : '#f03e7e';
      ctx.beginPath();
      ctx.arc(p.x, p.z, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const a of this.actors) {
      if (a.dead) continue;
      if (a.team === 'h') ctx.fillStyle = a.kind === 'guard' ? '#1c4fd8' : '#ffa94d';
      else ctx.fillStyle = a.kind === 'ally' ? '#2f9e44' : '#d6336c';
      ctx.beginPath();
      ctx.arc(a.x, a.z, a.kind === 'tank' ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
      if (a.kind === 'ally' || (a.team === 'h' && a.kind === 'guard')) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
