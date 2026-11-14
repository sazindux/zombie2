import * as THREE from 'three';

export const MAP_HALF = 70;
export const ROAD_HALF = 5;

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
  color: string;
}
export interface CircleCollider {
  x: number;
  z: number;
  r: number;
  color: string;
  solidBullet: number; // radius that blocks bullets
}

export interface World {
  group: THREE.Group;
  sky: THREE.Group;
  sun: THREE.DirectionalLight;
  boxes: BoxCollider[];
  circles: CircleCollider[];
  update(dt: number, t: number): void;
  isFree(x: number, z: number, r: number): boolean;
  pushOut(p: { x: number; z: number }, r: number): boolean;
  rayBlock(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map<number, THREE.MeshLambertMaterial>();
function mat(c: number) {
  let m = matCache.get(c);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c });
    matCache.set(c, m);
  }
  return m;
}

function box(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  return m;
}
function cyl(rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
  m.position.set(x, y, z);
  return m;
}
function sphere(r: number, c: number, x = 0, y = 0, z = 0, detail = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, detail, Math.max(6, detail - 4)), mat(c));
  m.position.set(x, y, z);
  return m;
}

function stripeTexture(a: string, b: string, n: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 8;
  const g = c.getContext('2d')!;
  const w = 256 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect(i * w, 0, w + 1, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8fe388';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#7fd97a';
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  const r = mulberry32(7);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(40,140,60,0.12)';
    const s = 2 + r() * 5;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(45, 45);
  t.anisotropy = 4;
  return t;
}

const PASTEL = [0xffadad, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xa0c4ff, 0xbdb2ff, 0xffc6ff, 0xffe5ec, 0xb8f2e6];
const ROOFS = [0xe63946, 0xf77f00, 0x3a86ff, 0x8338ec, 0x06d6a0, 0xef476f, 0xfb5607, 0x118ab2];

export function createWorld(): World {
  const group = new THREE.Group();
  const rng = mulberry32(1337);
  const R = (a: number, b: number) => a + rng() * (b - a);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

  const boxes: BoxCollider[] = [];
  const circles: CircleCollider[] = [];
  const spinners: ((dt: number, t: number) => void)[] = [];

  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xdff3ff, 0xa6e88c, 1.15);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cf, 2.4);
  sun.position.set(40, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -55;
  sc.right = 55;
  sc.top = 55;
  sc.bottom = -55;
  sc.near = 1;
  sc.far = 220;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  group.add(sun);
  group.add(sun.target);

  // ---------- Sky ----------
  const sky = new THREE.Group();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3fa9f5) },
      mid: { value: new THREE.Color(0x8fd3ff) },
      bot: { value: new THREE.Color(0xdff6ff) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP;
uniform vec3 top;
uniform vec3 mid;
uniform vec3 bot;
void main(){
  float h = normalize(vP).y;
  vec3 c = mix(bot, mid, smoothstep(0.0,0.25,h));
  c = mix(c, top, smoothstep(0.2,0.8,h));
  gl_FragColor = vec4(c,1.0);
#include <colorspace_fragment>
}`,
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), skyMat);
  skyMesh.renderOrder = -10;
  sky.add(skyMesh);
  const sunDir = sun.position.clone().normalize();
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6c2, fog: false }));
  sunBall.position.copy(sunDir).multiplyScalar(420);
  sky.add(sunBall);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(32, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.28, fog: false, depthWrite: false })
  );
  halo.position.copy(sunBall.position);
  sky.add(halo);

  // clouds
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xaab8c8 });
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(R(4, 8), 10, 8), cloudMat);
      s.position.set(k * 5 - n * 2.5 + R(-2, 2), R(-1, 2), R(-3, 3));
      s.scale.y = 0.65;
      c.add(s);
    }
    c.position.set(R(-170, 170), R(42, 70), R(-170, 170));
    group.add(c);
    clouds.push(c);
  }

  // ---------- Ground ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshLambertMaterial({ map: grassTexture() }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // roads
  const roadMat = mat(0x9aa7bf);
  const road1 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, MAP_HALF * 2), roadMat);
  road1.rotation.x = -Math.PI / 2;
  road1.position.y = 0.02;
  road1.receiveShadow = true;
  const road2 = road1.clone();
  road2.rotation.z = Math.PI / 2;
  road2.position.y = 0.021;
  group.add(road1, road2);

  // sidewalks
  for (const s of [-1, 1]) {
    const w1 = box(1.6, 0.1, MAP_HALF * 2, 0xf2ece4, s * (ROAD_HALF + 0.8), 0.05, 0);
    const w2 = box(MAP_HALF * 2, 0.1, 1.6, 0xf2ece4, 0, 0.052, s * (ROAD_HALF + 0.8));
    w1.receiveShadow = w2.receiveShadow = true;
    group.add(w1, w2);
  }
  // plaza
  const plaza = cyl(11, 11, 0.12, 0xffe3b8, 0, 0.06, 0, 40);
  plaza.receiveShadow = true;
  group.add(plaza);
  const plazaRing = cyl(11.4, 11.4, 0.1, 0xff9f9f, 0, 0.05, 0, 40);
  group.add(plazaRing);
  // road dashes
  const dashGeo = new THREE.BoxGeometry(0.35, 0.05, 2.2);
  const dashes: THREE.Matrix4[] = [];
  for (let d = 14; d < MAP_HALF - 2; d += 5) {
    for (const s of [-1, 1]) {
      dashes.push(new THREE.Matrix4().makeTranslation(0, 0.05, s * d));
      dashes.push(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(s * d, 0.05, 0));
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, mat(0xfff3a3), dashes.length);
  dashes.forEach((m, i) => dashMesh.setMatrixAt(i, m));
  group.add(dashMesh);

  // ---------- Boundary fence ----------
  {
    const seg = 3;
    const per = Math.floor((MAP_HALF * 2) / seg);
    const count = per * 4;
    const geo = new THREE.BoxGeometry(2.6, 2.2, 0.5);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    let i = 0;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < per; k++) {
        const along = -MAP_HALF + seg / 2 + k * seg;
        let x = 0,
          z = 0,
          rot = 0;
        if (side === 0) { x = along; z = -MAP_HALF; }
        if (side === 1) { x = along; z = MAP_HALF; }
        if (side === 2) { z = along; x = -MAP_HALF; rot = Math.PI / 2; }
        if (side === 3) { z = along; x = MAP_HALF; rot = Math.PI / 2; }
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        m4.compose(new THREE.Vector3(x, 1.1, z), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, m4);
        col.setHex(PASTEL[(k + side) % PASTEL.length]);
        inst.setColorAt(i, col);
        i++;
      }
    }
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }

  // hills / mountains
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + R(-0.05, 0.05);
    const dist = R(105, 150);
    const r = R(22, 38);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), mat(pick([0x7bd96a, 0x8be07c, 0x6fd180, 0x9be58b])));
    hill.scale.y = R(0.35, 0.6);
    hill.position.set(Math.cos(a) * dist, -r * 0.1, Math.sin(a) * dist);
    group.add(hill);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + R(-0.1, 0.1);
    const dist = R(185, 215);
    const h = R(40, 75);
    const m = new THREE.Mesh(new THREE.ConeGeometry(R(28, 42), h, 7), mat(pick([0xb8a9f0, 0x9fc5f8, 0xd4b8f0, 0xa8d8ea])));
    m.position.set(Math.cos(a) * dist, h / 2 - 2, Math.sin(a) * dist);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.2, h * 0.28, 7), mat(0xffffff));
    cap.position.set(m.position.x, h - 2 - h * 0.14 + 0.5, m.position.z);
    group.add(m, cap);
  }

  // ---------- Collider helpers ----------
  const addBox = (cx: number, cz: number, w: number, d: number, h: number, color: string) =>
    boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h, color });
  const addCircle = (x: number, z: number, r: number, color: string, bullet = r * 0.7) =>
    circles.push({ x, z, r, color, solidBullet: bullet });

  const free = (x: number, z: number, r: number) => {
    if (Math.abs(x) > MAP_HALF - 3 - r || Math.abs(z) > MAP_HALF - 3 - r) return false;
    for (const b of boxes) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false;
    }
    for (const c of circles) {
      const dx = x - c.x,
        dz = z - c.z;
      if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return false;
    }
    return true;
  };
  const offRoad = (x: number, z: number, m = 3) => Math.abs(x) > ROAD_HALF + m + 1.6 && Math.abs(z) > ROAD_HALF + m + 1.6;

  // ---------- Landmarks ----------
  const FERRIS = { x: -42, z: -42 };
  const TENT = { x: 42, z: -42 };
  const POND = { x: -44, z: 43 };
  const MILL = { x: 47, z: 41 };

  // Fountain
  {
    const f = new THREE.Group();
    f.add(cyl(3.6, 3.8, 0.8, 0xfff0f5, 0, 0.4, 0, 28));
    f.add(cyl(3.1, 3.1, 0.2, 0x6fd8ff, 0, 0.72, 0, 28));
    f.add(cyl(0.45, 0.6, 2.2, 0xffd6e8, 0, 1.6, 0, 12));
    f.add(cyl(1.7, 1.2, 0.35, 0xfff0f5, 0, 2.5, 0, 20));
    f.add(cyl(1.4, 1.4, 0.1, 0x6fd8ff, 0, 2.62, 0, 20));
    const jet = sphere(0.35, 0x9ae8ff, 0, 3.2, 0, 10);
    jet.scale.y = 2;
    f.add(jet);
    const drops: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const d = sphere(0.14, 0xb5efff, 0, 3, 0, 8);
      f.add(d);
      drops.push(d);
    }
    f.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    group.add(f);
    addCircle(0, 0, 3.9, '#ffb3d1', 3.7);
    spinners.push((_dt, t) => {
      jet.scale.y = 2 + Math.sin(t * 5) * 0.4;
      drops.forEach((d, i) => {
        const a = (i / 8) * Math.PI * 2;
        const ph = (t * 1.3 + i * 0.37) % 1;
        const rr = ph * 1.3;
        d.position.set(Math.cos(a) * rr, 3.2 + Math.sin(ph * Math.PI) * 1.1 - ph * 0.7, Math.sin(a) * rr);
      });
    });
  }

  // Ferris wheel
  {
    const g = new THREE.Group();
    g.position.set(FERRIS.x, 0, FERRIS.z);
    const cy = 12.5;
    const Rr = 9;
    // legs
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const leg = box(0.6, 14.5, 0.6, 0xff6b9d);
        leg.position.set(sx * 3.2, cy / 2, sz * 1.8);
        leg.rotation.z = sx * -Math.atan(3.2 / cy);
        leg.scale.y = 1.02;
        g.add(leg);
      }
    }
    g.add(cyl(0.8, 0.8, 4.6, 0xffd166, 0, cy, 0, 12).rotateX(Math.PI / 2));
    const wheel = new THREE.Group();
    wheel.position.y = cy;
    for (const sz of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Rr, 0.28, 8, 40), mat(0xffd166));
      ring.position.z = sz * 1.5;
      wheel.add(ring);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(Rr * 0.5, 0.18, 6, 28), mat(0x4cc9f0));
      inner.position.z = sz * 1.5;
      wheel.add(inner);
    }
    for (let i = 0; i < 6; i++) {
      for (const sz of [-1, 1]) {
        const spoke = box(Rr * 2, 0.2, 0.2, 0xffffff, 0, 0, sz * 1.5);
        spoke.rotation.z = (i / 6) * Math.PI;
        wheel.add(spoke);
      }
    }
    const cars: THREE.Group[] = [];
    const palette = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff924c];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const car = new THREE.Group();
      const c = palette[i % palette.length];
      car.add(box(2, 1.5, 2.6, c, 0, -1.2, 0));
      car.add(box(2.2, 0.2, 2.8, 0xffffff, 0, -0.4, 0));
      car.add(box(0.12, 1, 0.12, 0xffffff, 0, -0.1, 0));
      car.position.set(Math.cos(a) * Rr, Math.sin(a) * Rr, 0);
      wheel.add(car);
      cars.push(car);
    }
    g.add(wheel);
    g.traverse((o) => {
      o.castShadow = true;
    });
    group.add(g);
    addCircle(FERRIS.x - 3.8, FERRIS.z, 1.6, '#ff6b9d', 1.4);
    addCircle(FERRIS.x + 3.8, FERRIS.z, 1.6, '#ff6b9d', 1.4);
    spinners.push((dt) => {
      wheel.rotation.z += dt * 0.18;
      cars.forEach((c) => (c.rotation.z = -wheel.rotation.z));
    });
  }

  // Circus tent
  {
    const g = new THREE.Group();
    g.position.set(TENT.x, 0, TENT.z);
    const tex1 = stripeTexture('#ff5d73', '#ffffff', 8);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 4.2, 24, 1, true), new THREE.MeshLambertMaterial({ map: tex1, side: THREE.DoubleSide }));
    base.position.y = 2.1;
    const tex2 = stripeTexture('#4cc9f0', '#ffffff', 8);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 5.5, 24, 1, true), new THREE.MeshLambertMaterial({ map: tex2, side: THREE.DoubleSide }));
    roof.position.y = 4.2 + 2.75;
    g.add(base, roof);
    g.add(box(0.15, 3, 0.15, 0xffffff, 0, 10.6, 0));
    const flag = box(1.6, 0.9, 0.08, 0xffd166, 0.8, 11.6, 0);
    g.add(flag);
    // door
    const door = box(2.6, 3.2, 0.2, 0xffd166, 0, 1.6, 7.05);
    g.add(door);
    g.traverse((o) => (o.castShadow = true));
    group.add(g);
    addCircle(TENT.x, TENT.z, 7.2, '#ff5d73', 7);
    spinners.push((_dt, t) => (flag.rotation.y = Math.sin(t * 3) * 0.25));
  }

  // Pond
  const ducks: { m: THREE.Group; a: number; r: number; s: number }[] = [];
  {
    const g = new THREE.Group();
    g.position.set(POND.x, 0, POND.z);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(9, 36),
      new THREE.MeshLambertMaterial({ color: 0x5ad2f4, emissive: 0x1a5f80, transparent: true, opacity: 0.92 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.06;
    g.add(water);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const s = sphere(R(0.55, 0.9), pick([0xe9ecef, 0xced4da, 0xdee2e6]), Math.cos(a) * 9.3, 0.3, Math.sin(a) * 9.3, 8);
      s.scale.y = 0.7;
      s.castShadow = true;
      g.add(s);
    }
    for (let i = 0; i < 7; i++) {
      const a = R(0, 6.28);
      const d = R(2, 7);
      const pad = cyl(0.7, 0.7, 0.04, 0x52b788, Math.cos(a) * d, 0.1, Math.sin(a) * d, 12);
      g.add(pad);
      if (i % 2 === 0) g.add(sphere(0.2, 0xff8fab, Math.cos(a) * d, 0.22, Math.sin(a) * d, 8));
    }
    for (let i = 0; i < 4; i++) {
      const duck = new THREE.Group();
      const b = sphere(0.5, 0xffe14d, 0, 0.45, 0, 10);
      b.scale.set(1, 0.8, 1.3);
      const h = sphere(0.3, 0xffe14d, 0, 0.95, 0.5, 10);
      const beak = box(0.22, 0.1, 0.25, 0xff9f1c, 0, 0.9, 0.78);
      const e1 = sphere(0.05, 0x222222, 0.14, 1.02, 0.72, 6);
      const e2 = sphere(0.05, 0x222222, -0.14, 1.02, 0.72, 6);
      duck.add(b, h, beak, e1, e2);
      duck.traverse((o) => (o.castShadow = true));
      g.add(duck);
      ducks.push({ m: duck, a: R(0, 6.28), r: R(2.5, 6.5), s: R(0.15, 0.35) * (i % 2 ? 1 : -1) });
    }
    group.add(g);
    addCircle(POND.x, POND.z, 9.4, '#5ad2f4', 9);
    spinners.push((dt, t) => {
      for (const d of ducks) {
        d.a += d.s * dt;
        d.m.position.set(Math.cos(d.a) * d.r, 0.05 + Math.sin(t * 2 + d.r) * 0.04, Math.sin(d.a) * d.r);
        d.m.rotation.y = -d.a + (d.s > 0 ? Math.PI : 0);
      }
    });
  }

  // Windmill
  {
    const g = new THREE.Group();
    g.position.set(MILL.x, 0, MILL.z);
    g.add(cyl(1.8, 3, 9, 0xfff1d6, 0, 4.5, 0, 12));
    g.add(cyl(0.4, 2.4, 3, 0xe63946, 0, 10.4, 0, 12));
    g.add(box(1.4, 2.4, 0.2, 0x8d5524, 0, 1.2, 2.95));
    const blades = new THREE.Group();
    blades.position.set(0, 9, 2.2);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      b.add(box(0.35, 8, 0.2, 0x8d5524, 0, 4, 0));
      b.add(box(1.7, 6, 0.1, i % 2 ? 0xffd166 : 0xff8fab, 0.9, 4.2, 0.05));
      b.rotation.z = (i / 4) * Math.PI * 2;
      blades.add(b);
    }
    blades.add(sphere(0.55, 0xe63946, 0, 0, 0.2, 10));
    g.add(blades);
    g.traverse((o) => (o.castShadow = true));
    group.add(g);
    addCircle(MILL.x, MILL.z, 3.3, '#fff1d6', 3.1);
    spinners.push((dt) => (blades.rotation.z += dt * 0.7));
  }

  const nearLandmark = (x: number, z: number, m = 0) =>
    Math.hypot(x - FERRIS.x, z - FERRIS.z) < 20 + m ||
    Math.hypot(x - TENT.x, z - TENT.z) < 16 + m ||
    Math.hypot(x - POND.x, z - POND.z) < 17 + m ||
    Math.hypot(x - MILL.x, z - MILL.z) < 9 + m;

  // ---------- Houses ----------
  const winMat = mat(0xbdf1ff);
  function makeHouse(w: number, d: number, h: number, wall: number, roof: number) {
    const g = new THREE.Group();
    g.add(box(w, h, d, wall, 0, h / 2, 0));
    g.add(box(w + 0.2, 0.35, d + 0.2, 0xffffff, 0, 0.17, 0));
    const rh = 2.8;
    const geo = new THREE.ConeGeometry(1, 1, 4);
    geo.rotateY(Math.PI / 4);
    const rf = new THREE.Mesh(geo, mat(roof));
    rf.scale.set((w / 2 + 0.7) * Math.SQRT2, rh, (d / 2 + 0.7) * Math.SQRT2);
    rf.position.y = h + rh / 2;
    g.add(rf);
    // chimney
    g.add(box(0.9, 2.2, 0.9, 0xc77d5b, w * 0.25, h + 1.4, -d * 0.15));
    // door
    const doorC = pick([0xe63946, 0x3a86ff, 0xffbe0b, 0x8338ec]);
    g.add(box(1.3, 2.3, 0.2, doorC, 0, 1.2, d / 2 + 0.05));
    g.add(sphere(0.1, 0xffd700, 0.4, 1.2, d / 2 + 0.2, 6));
    g.add(box(2.4, 0.2, 1.2, 0xffffff, 0, 0.1, d / 2 + 0.6));
    // awning
    g.add(box(2.2, 0.15, 1.1, doorC, 0, 2.7, d / 2 + 0.55));
    // windows
    const wy = Math.min(h - 1.2, 2.9);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 1.3);
      g.add(box(1.5, 1.4, 0.15, 0xffffff, x, wy, d / 2 + 0.03));
      g.add(box(1.25, 1.15, 0.2, 0xbdf1ff, x, wy, d / 2 + 0.05));
      g.add(box(0.08, 1.15, 0.22, 0xffffff, x, wy, d / 2 + 0.06));
      const wm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.4), mat(pick([0xff8fab, 0xffd166, 0xff6b6b])));
      wm.position.set(x, wy - 0.85, d / 2 + 0.25);
      g.add(wm);
    }
    for (const sx of [-1, 1]) {
      const wd = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 1.3), winMat);
      wd.position.set(sx * (w / 2 + 0.02), wy, 0);
      g.add(wd);
    }
    g.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return g;
  }

  const steps = [15, 31, 47, 62];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const bx of steps) {
        for (const bz of steps) {
          if (rng() < 0.42) continue;
          const x = sx * bx + R(-2, 2);
          const z = sz * bz + R(-2, 2);
          if (nearLandmark(x, z)) continue;
          const w = R(7, 10);
          const d = R(7, 9);
          const h = R(4, 6);
          // face nearest road
          let dirx = 0,
            dirz = 0;
          if (Math.abs(x) < Math.abs(z)) dirx = -Math.sign(x);
          else dirz = -Math.sign(z);
          const yaw = Math.atan2(dirx, dirz);
          const house = makeHouse(w, d, h, pick(PASTEL), pick(ROOFS));
          house.position.set(x, 0, z);
          house.rotation.y = yaw;
          group.add(house);
          const swap = dirx !== 0;
          const ew = swap ? d : w;
          const ed = swap ? w : d;
          addBox(x, z, ew + 0.4, ed + 0.4, h + 3, hex(0xffffff));
          boxes[boxes.length - 1].color = hex(PASTEL[0]);
        }
      }
    }
  }
  // fix minimap colors: use a soft tone for houses
  boxes.forEach((b) => (b.color = '#ffb4a2'));

  // ---------- Parked cars ----------
  const carColors = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xda77f2, 0xff922b];
  function makeCar(c: number) {
    const g = new THREE.Group();
    g.add(box(2, 0.8, 4.2, c, 0, 0.75, 0));
    const cab = box(1.8, 0.75, 2.2, c, 0, 1.5, -0.2);
    g.add(cab);
    g.add(box(1.82, 0.5, 1.9, 0xbdf1ff, 0, 1.5, -0.2));
    g.add(box(1.9, 0.12, 2.0, 0xffffff, 0, 1.92, -0.2));
    for (const sx of [-1, 1])
      for (const sz of [-1.3, 1.3]) {
        const w = cyl(0.45, 0.45, 0.35, 0x333b4a, sx * 1.0, 0.45, sz, 12);
        w.rotation.z = Math.PI / 2;
        g.add(w);
      }
    g.add(sphere(0.2, 0xfff3a0, 0.7, 0.85, 2.1, 6));
    g.add(sphere(0.2, 0xfff3a0, -0.7, 0.85, 2.1, 6));
    g.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return g;
  }
  const carSpots: [number, number, boolean][] = [
    [3.0, 22, true],
    [-3.2, 40, true],
    [3.0, -30, true],
    [-3.0, -52, true],
    [26, -3.0, false],
    [-36, 3.0, false],
    [48, 3.0, false],
    [-18, -3.0, false],
  ];
  carSpots.forEach(([x, z, alongZ], i) => {
    const car = makeCar(carColors[i % carColors.length]);
    car.position.set(x, 0, z);
    car.rotation.y = alongZ ? (i % 2 ? Math.PI : 0) : Math.PI / 2;
    group.add(car);
    if (alongZ) addBox(x, z, 2.2, 4.4, 2, '#ffd43b');
    else addBox(x, z, 4.4, 2.2, 2, '#ffd43b');
  });

  // ---------- Lamp posts ----------
  {
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
    const spots: [number, number][] = [];
    for (const d of [-60, -46, -32, -20, 20, 32, 46, 60]) {
      spots.push([ROAD_HALF + 0.8, d], [-(ROAD_HALF + 0.8), d], [d, ROAD_HALF + 0.8], [d, -(ROAD_HALF + 0.8)]);
    }
    for (const [x, z] of spots) {
      if (!free(x, z, 0.4)) continue;
      const g = new THREE.Group();
      g.add(cyl(0.12, 0.16, 4.4, 0x4cc9a8, 0, 2.2, 0, 8));
      g.add(cyl(0.3, 0.3, 0.3, 0x4cc9a8, 0, 0.15, 0, 8));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), bulbMat);
      bulb.position.y = 4.7;
      g.add(bulb);
      g.add(cyl(0.05, 0.5, 0.35, 0xff6b9d, 0, 5.1, 0, 10));
      g.position.set(x, 0, z);
      g.traverse((o) => (o.castShadow = true));
      group.add(g);
      addCircle(x, z, 0.3, '#4cc9a8', 0.2);
    }
  }

  // ---------- Trees ----------
  const trunkMat = mat(0x9c6644);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 8);
  const foliageGeo = new THREE.IcosahedronGeometry(1, 1);
  const pineGeo = new THREE.ConeGeometry(1, 1.8, 8);
  const greens = [0x52b788, 0x40c057, 0x74c69d, 0x69db7c, 0x38b000];
  const blossoms = [0xffb3c7, 0xff8fab, 0xffc2d1];
  const autumn = [0xffb703, 0xfb8500, 0xffd166];
  const treeTrunks: THREE.Mesh[] = [];
  function makeTree(kind: number) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.2;
    g.add(trunk);
    treeTrunks.push(trunk);
    if (kind === 3) {
      const c = pick(greens);
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(pineGeo, mat(c));
        const s = 2.4 - i * 0.6;
        cone.scale.set(s, 1, s);
        cone.position.y = 3 + i * 1.1;
        g.add(cone);
      }
    } else {
      const pal = kind === 1 ? blossoms : kind === 2 ? autumn : greens;
      const c = pick(pal);
      const s = R(1.6, 2.2);
      const a = new THREE.Mesh(foliageGeo, mat(c));
      a.scale.set(s, s * 0.9, s);
      a.position.y = 3.4;
      const b = new THREE.Mesh(foliageGeo, mat(pick(pal)));
      b.scale.set(s * 0.7, s * 0.7, s * 0.7);
      b.position.set(s * 0.6, 3.0, s * 0.2);
      const c2 = new THREE.Mesh(foliageGeo, mat(pick(pal)));
      c2.scale.set(s * 0.65, s * 0.65, s * 0.65);
      c2.position.set(-s * 0.5, 3.1, -s * 0.3);
      g.add(a, b, c2);
    }
    g.traverse((o) => (o.castShadow = true));
    return g;
  }
  let placed = 0;
  let tries = 0;
  while (placed < 70 && tries < 900) {
    tries++;
    const x = R(-MAP_HALF + 4, MAP_HALF - 4);
    const z = R(-MAP_HALF + 4, MAP_HALF - 4);
    if (!offRoad(x, z, 1.5) || !free(x, z, 1.6) || nearLandmark(x, z, -4)) {
      // sprinkle some along the edges of the plaza roads
      continue;
    }
    const t = makeTree(Math.floor(rng() * 4));
    const sc = R(0.9, 1.35);
    t.scale.setScalar(sc);
    t.position.set(x, 0, z);
    t.rotation.y = R(0, 6.28);
    group.add(t);
    addCircle(x, z, 0.65 * sc, '#74c69d', 0.4 * sc);
    placed++;
  }

  // ---------- Bushes ----------
  for (let i = 0; i < 60; i++) {
    const x = R(-MAP_HALF + 3, MAP_HALF - 3);
    const z = R(-MAP_HALF + 3, MAP_HALF - 3);
    if (!offRoad(x, z, 0.5) || !free(x, z, 1.2) || nearLandmark(x, z, -3)) continue;
    const b = new THREE.Mesh(foliageGeo, mat(pick([0x80ed99, 0x57cc99, 0x38b000, 0x9ef01a])));
    const s = R(0.7, 1.2);
    b.scale.set(s * 1.3, s, s * 1.3);
    b.position.set(x, s * 0.7, z);
    b.castShadow = true;
    group.add(b);
    addCircle(x, z, s * 1.0, '#80ed99', s * 0.8);
  }

  // ---------- Flowers (instanced) ----------
  {
    const N = 500;
    const headGeo = new THREE.SphereGeometry(0.17, 6, 5);
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 4);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    const stems = new THREE.InstancedMesh(stemGeo, mat(0x2d9a4f), N);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const fcol = [0xff6b9d, 0xffd166, 0xffffff, 0xc77dff, 0xff9f1c, 0x4cc9f0];
    let n = 0;
    let tr = 0;
    while (n < N && tr < 5000) {
      tr++;
      const x = R(-MAP_HALF + 2, MAP_HALF - 2);
      const z = R(-MAP_HALF + 2, MAP_HALF - 2);
      if (!offRoad(x, z, 0) || !free(x, z, 0.3) || nearLandmark(x, z, -5)) continue;
      m4.makeTranslation(x, 0.45, z);
      heads.setMatrixAt(n, m4);
      col.setHex(pick(fcol));
      heads.setColorAt(n, col);
      m4.makeTranslation(x, 0.22, z);
      stems.setMatrixAt(n, m4);
      n++;
    }
    heads.count = n;
    stems.count = n;
    group.add(heads, stems);
  }

  // ---------- Balloons ----------
  const balloonGroups: THREE.Group[] = [];
  {
    const bc = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff99c8];
    const spots: [number, number][] = [
      [9, 9], [-9, 9], [9, -9], [-9, -9], [24, 14], [-24, -14], [14, -26], [-16, 28], [30, 30], [-30, -28], [0, 36], [0, -36],
    ];
    spots.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const n = 4 + (i % 3);
      for (let k = 0; k < n; k++) {
        const bx = R(-0.8, 0.8);
        const bz = R(-0.8, 0.8);
        const by = 4.2 + R(0, 1.6);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), mat(pick(bc)));
        b.scale.y = 1.2;
        b.position.set(bx, by, bz);
        b.castShadow = true;
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, by, 3), mat(0xffffff));
        string.position.set(bx / 2, by / 2, bz / 2);
        string.rotation.z = -Math.atan2(bx, by);
        string.rotation.x = Math.atan2(bz, by);
        g.add(b, string);
      }
      g.add(cyl(0.2, 0.28, 0.5, 0xffd166, 0, 0.25, 0, 8));
      group.add(g);
      balloonGroups.push(g);
    });
  }

  // ---------- Update ----------
  const update = (dt: number, t: number) => {
    for (const c of clouds) {
      c.position.x += dt * 1.6;
      if (c.position.x > 190) c.position.x = -190;
    }
    balloonGroups.forEach((g, i) => {
      g.rotation.z = Math.sin(t * 1.1 + i) * 0.05;
      g.rotation.x = Math.cos(t * 0.9 + i * 2) * 0.05;
    });
    for (const s of spinners) s(dt, t);
  };

  // ---------- Collision API ----------
  const pushOut = (p: { x: number; z: number }, r: number) => {
    let hit = false;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const k = (r - d) / d;
        p.x += dx * k;
        p.z += dz * k;
      } else {
        const l = p.x - b.minX,
          rr = b.maxX - p.x,
          tt = p.z - b.minZ,
          bb = b.maxZ - p.z;
        const m = Math.min(l, rr, tt, bb);
        if (m === l) p.x = b.minX - r;
        else if (m === rr) p.x = b.maxX + r;
        else if (m === tt) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
    }
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const rr = r + c.r;
      if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      hit = true;
      const d = Math.sqrt(d2) || 0.0001;
      const k = (rr - d) / d;
      p.x += dx * k;
      p.z += dz * k;
    }
    const lim = MAP_HALF - 1.2 - r;
    if (p.x > lim) { p.x = lim; hit = true; }
    if (p.x < -lim) { p.x = -lim; hit = true; }
    if (p.z > lim) { p.z = lim; hit = true; }
    if (p.z < -lim) { p.z = -lim; hit = true; }
    return hit;
  };

  // Distance along ray to the nearest world blocker (box walls, tree trunks, ground).
  const rayBlock = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => {
    let best = max;
    // ground
    if (dy < -1e-5) {
      const t = -oy / dy;
      if (t > 0 && t < best) best = t;
    }
    // boxes (slab test)
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      let t0 = 0,
        t1 = best;
      const slab = (o: number, d: number, mn: number, mx: number) => {
        if (Math.abs(d) < 1e-8) return o >= mn && o <= mx;
        let a = (mn - o) / d;
        let c = (mx - o) / d;
        if (a > c) [a, c] = [c, a];
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        return t0 <= t1;
      };
      if (slab(ox, dx, b.minX, b.maxX) && slab(oy, dy, 0, b.h) && slab(oz, dz, b.minZ, b.maxZ)) {
        if (t0 < best) best = t0;
      }
    }
    // circles (vertical cylinders up to ~3.2m)
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const fx = ox - c.x,
        fz = oz - c.z;
      const a = dx * dx + dz * dz;
      if (a < 1e-8) continue;
      const bq = fx * dx + fz * dz;
      const cq = fx * fx + fz * fz - c.solidBullet * c.solidBullet;
      const disc = bq * bq - a * cq;
      if (disc < 0) continue;
      const t = (-bq - Math.sqrt(disc)) / a;
      if (t > 0 && t < best) {
        const y = oy + dy * t;
        if (y < 3.2 && y > 0) best = t;
      }
    }
    return best;
  };

  return { group, sky, sun, boxes, circles, update, isFree: free, pushOut, rayBlock };
}
