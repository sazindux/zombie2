import * as THREE from 'three';

const N = 900;

export class Particles {
  mesh: THREE.InstancedMesh;
  private pos = new Float32Array(N * 3);
  private vel = new Float32Array(N * 3);
  private life = new Float32Array(N);
  private maxLife = new Float32Array(N);
  private size = new Float32Array(N);
  private grav = new Float32Array(N);
  private rot = new Float32Array(N * 3);
  private spin = new Float32Array(N * 3);
  private active = new Uint8Array(N);
  private next = 0;
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();

  constructor() {
    const geo = new THREE.BoxGeometry(1, 0.6, 0.15);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, m, N);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < N; i++) {
      this.col.setRGB(1, 1, 1);
      this.mesh.setColorAt(i, this.col);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav = 9) {
    const i = this.next;
    this.next = (this.next + 1) % N;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.rot[i * 3] = Math.random() * 6;
    this.rot[i * 3 + 1] = Math.random() * 6;
    this.rot[i * 3 + 2] = Math.random() * 6;
    this.spin[i * 3] = (Math.random() - 0.5) * 14;
    this.spin[i * 3 + 1] = (Math.random() - 0.5) * 14;
    this.spin[i * 3 + 2] = (Math.random() - 0.5) * 14;
    this.active[i] = 1;
    this.col.setHex(color);
    this.mesh.setColorAt(i, this.col);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  burst(x: number, y: number, z: number, count: number, colors: number[], speed = 5, size = 0.18, life = 0.9, up = 3, grav = 9) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 1.2 - 0.1;
      const sp = speed * (0.35 + Math.random() * 0.8);
      this.emit(
        x,
        y,
        z,
        Math.cos(a) * sp * Math.cos(e),
        Math.sin(e) * sp + up * Math.random(),
        Math.sin(a) * sp * Math.cos(e),
        life * (0.6 + Math.random() * 0.6),
        size * (0.6 + Math.random() * 0.8),
        colors[Math.floor(Math.random() * colors.length)],
        grav
      );
    }
  }

  update(dt: number) {
    const d = this.dummy;
    for (let i = 0; i < N; i++) {
      if (!this.active[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        d.scale.setScalar(0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05) {
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.35;
        this.vel[i3] *= 0.7;
        this.vel[i3 + 2] *= 0.7;
      }
      // air drag
      const drag = 1 - Math.min(1, dt * 1.2);
      this.vel[i3] *= drag;
      this.vel[i3 + 2] *= drag;
      this.rot[i3] += this.spin[i3] * dt;
      this.rot[i3 + 1] += this.spin[i3 + 1] * dt;
      this.rot[i3 + 2] += this.spin[i3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      const s = this.size[i] * Math.min(1, k * 3);
      d.position.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      d.rotation.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2]);
      d.scale.setScalar(s);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.active.fill(0);
    this.life.fill(0);
    const d = this.dummy;
    d.scale.setScalar(0);
    d.updateMatrix();
    for (let i = 0; i < N; i++) this.mesh.setMatrixAt(i, d.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- floating texts
const texCache = new Map<string, THREE.CanvasTexture>();
function textTexture(text: string, color: string) {
  const key = text + color;
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '900 64px "Baloo 2", "Fredoka", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.strokeText(text, 128, 50);
  g.fillStyle = color;
  g.fillText(text, 128, 50);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

interface FT {
  s: THREE.Sprite;
  life: number;
  max: number;
  vy: number;
}

export class FloatTexts {
  group = new THREE.Group();
  private pool: FT[] = [];
  private next = 0;
  constructor() {
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, fog: false }));
      s.visible = false;
      s.renderOrder = 20;
      this.group.add(s);
      this.pool.push({ s, life: 0, max: 1, vy: 1 });
    }
  }
  spawn(text: string, color: string, x: number, y: number, z: number, scale = 1) {
    const f = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    f.s.material.map = textTexture(text, color);
    f.s.material.needsUpdate = true;
    f.s.material.opacity = 1;
    f.s.position.set(x, y, z);
    f.s.scale.set(2.2 * scale, 0.825 * scale, 1);
    f.s.visible = true;
    f.life = f.max = 1.1;
    f.vy = 1.6;
  }
  update(dt: number) {
    for (const f of this.pool) {
      if (!f.s.visible) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.s.visible = false;
        continue;
      }
      f.s.position.y += f.vy * dt;
      f.vy *= 1 - dt * 1.5;
      const k = f.life / f.max;
      f.s.material.opacity = Math.min(1, k * 3);
    }
  }
  clear() {
    for (const f of this.pool) f.s.visible = false;
  }
}
