import * as THREE from 'three';

export type Hat = 'none' | 'cone' | 'bucket' | 'cap' | 'tophat' | 'guard' | 'party';

export interface RigOptions {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  zombie: boolean;
  hat: Hat;
  scale: number;
  armed?: boolean;
  bandage?: boolean;
}

export interface Rig {
  group: THREE.Group;
  upper: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  meshes: THREE.Mesh[];
  orig: THREE.Material[];
  opts: RigOptions;
  flashing: boolean;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function bgeo(w: number, h: number, d: number) {
  const k = `b${w},${h},${d}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(k, g);
  }
  return g;
}
function sgeo(r: number) {
  const k = `s${r}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.SphereGeometry(r, 10, 8);
    geoCache.set(k, g);
  }
  return g;
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
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

function B(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(bgeo(w, h, d), mat(c));
  m.position.set(x, y, z);
  return m;
}
function S(r: number, c: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(sgeo(r), mat(c));
  m.position.set(x, y, z);
  return m;
}

const coneGeo = new THREE.ConeGeometry(0.24, 0.6, 12);
const partyGeo = new THREE.ConeGeometry(0.2, 0.55, 10);
const cylGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.45, 12);
const tophatGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12);
const brimGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14);

function makeHat(hat: Hat): THREE.Object3D | null {
  const g = new THREE.Group();
  switch (hat) {
    case 'cone': {
      const c = new THREE.Mesh(coneGeo, mat(0xff8c1a));
      c.position.y = 0.3;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.185, 0.1, 12), mat(0xffffff));
      band.position.y = 0.3;
      const base = B(0.56, 0.05, 0.56, 0xff8c1a, 0, 0.02, 0);
      g.add(c, band, base);
      return g;
    }
    case 'bucket': {
      const c = new THREE.Mesh(cylGeo, mat(0x9db4c0));
      c.position.y = 0.22;
      g.add(c, S(0.06, 0xffffff, 0.12, 0.3, 0.2));
      return g;
    }
    case 'cap': {
      g.add(B(0.6, 0.18, 0.6, 0xff5d73, 0, 0.09, 0), B(0.5, 0.05, 0.3, 0xff5d73, 0, 0.05, 0.38));
      return g;
    }
    case 'guard': {
      g.add(B(0.62, 0.2, 0.62, 0x3a6ff7, 0, 0.1, 0), B(0.54, 0.05, 0.32, 0x1f4fd1, 0, 0.04, 0.4), B(0.14, 0.12, 0.05, 0xffd43b, 0, 0.12, 0.32));
      return g;
    }
    case 'tophat': {
      const c = new THREE.Mesh(tophatGeo, mat(0x7950f2));
      c.position.y = 0.26;
      const br = new THREE.Mesh(brimGeo, mat(0x7950f2));
      br.position.y = 0.04;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.08, 12), mat(0xffd43b));
      band.position.y = 0.12;
      g.add(c, br, band);
      return g;
    }
    case 'party': {
      const c = new THREE.Mesh(partyGeo, mat(0xff6bd6));
      c.position.y = 0.28;
      g.add(c, S(0.07, 0xffe14d, 0, 0.58, 0), B(0.3, 0.05, 0.3, 0x4cc9f0, 0, 0.02, 0));
      return g;
    }
    default:
      return null;
  }
}

export function buildRig(o: RigOptions): Rig {
  const root = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.y = 0.72;
  root.add(upper);

  const skin = o.skin;
  // torso
  upper.add(B(0.64, 0.74, 0.38, o.shirt, 0, 0.37, 0));
  if (o.zombie) {
    // cute patchy tear + belly patch
    upper.add(B(0.2, 0.2, 0.04, 0xfff1c9, 0.15, 0.3, 0.2));
    upper.add(B(0.62, 0.06, 0.4, 0xffffff, 0, 0.7, 0)); // collar band stripe
  } else {
    upper.add(B(0.66, 0.1, 0.4, 0xffffff, 0, 0.06, 0)); // belt line
  }

  // head
  const head = new THREE.Group();
  head.position.y = 1.02;
  upper.add(head);
  const hm = B(0.58, 0.54, 0.54, skin, 0, 0, 0);
  head.add(hm);
  // face
  if (o.zombie) {
    const eyeL = S(0.12, 0xffffff, -0.14, 0.06, 0.25);
    const eyeR = S(0.09, 0xffffff, 0.14, 0.05, 0.25);
    eyeL.scale.z = 0.5;
    eyeR.scale.z = 0.5;
    head.add(eyeL, eyeR);
    head.add(S(0.05, 0x222222, -0.12, 0.04, 0.3), S(0.04, 0x222222, 0.16, 0.08, 0.29));
    head.add(B(0.34, 0.1, 0.05, 0x7a2e4d, 0, -0.14, 0.27));
    head.add(B(0.07, 0.07, 0.05, 0xffffff, -0.1, -0.1, 0.285), B(0.07, 0.07, 0.05, 0xffffff, 0.08, -0.1, 0.285));
    head.add(B(0.4, 0.04, 0.04, 0x5aa86a, -0.02, 0.2, 0.275)); // stitch
    if (o.bandage) head.add(B(0.6, 0.1, 0.56, 0xffffff, 0, 0.14, 0));
  } else {
    head.add(S(0.055, 0x2b2d42, -0.14, 0.05, 0.27), S(0.055, 0x2b2d42, 0.14, 0.05, 0.27));
    head.add(B(0.2, 0.05, 0.04, 0xd6336c, 0, -0.12, 0.275));
    head.add(S(0.05, 0xff9aa2, -0.21, -0.06, 0.26), S(0.05, 0xff9aa2, 0.21, -0.06, 0.26));
  }
  // hair
  if (o.hat === 'none' || o.hat === 'party') {
    if (o.zombie) {
      for (let i = -1; i <= 1; i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), mat(o.hair));
        t.position.set(i * 0.15, 0.36, 0);
        head.add(t);
      }
    } else {
      head.add(B(0.62, 0.14, 0.58, o.hair, 0, 0.3, -0.02), B(0.62, 0.36, 0.14, o.hair, 0, 0.1, -0.26));
    }
  }
  const hat = makeHat(o.hat);
  if (hat) {
    hat.position.y = 0.27;
    head.add(hat);
  }

  // arms
  const mkArm = (sx: number) => {
    const a = new THREE.Group();
    a.position.set(sx * 0.42, 0.68, 0);
    a.add(B(0.22, 0.32, 0.22, o.shirt, 0, -0.14, 0));
    a.add(B(0.19, 0.36, 0.19, skin, 0, -0.46, 0));
    a.add(B(0.21, 0.12, 0.21, skin, 0, -0.68, 0.01));
    upper.add(a);
    return a;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  if (o.armed) {
    const gun = new THREE.Group();
    gun.add(B(0.14, 0.2, 0.46, 0xff9f1c, 0, 0, 0.18));
    gun.add(B(0.08, 0.08, 0.2, 0xffd43b, 0, 0.05, 0.5));
    gun.add(B(0.1, 0.14, 0.12, 0x4cc9f0, 0, -0.14, 0.05));
    gun.position.set(0, -0.68, 0.0);
    gun.rotation.x = Math.PI / 2;
    armR.add(gun);
  }

  // legs
  const mkLeg = (sx: number) => {
    const l = new THREE.Group();
    l.position.set(sx * 0.17, 0.72, 0);
    l.add(B(0.27, 0.6, 0.3, o.pants, 0, -0.3, 0));
    l.add(B(0.29, 0.14, 0.4, 0xffffff, 0, -0.65, 0.04));
    root.add(l);
    return l;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  head.traverse((m) => (m.userData.part = 'head'));

  const meshes: THREE.Mesh[] = [];
  root.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      m.castShadow = true;
      meshes.push(m);
    }
  });
  const orig = meshes.map((m) => m.material as THREE.Material);
  root.scale.setScalar(o.scale);
  return { group: root, upper, head, armL, armR, legL, legR, meshes, orig, opts: o, flashing: false };
}

export function setFlash(rig: Rig, on: boolean) {
  if (rig.flashing === on) return;
  rig.flashing = on;
  for (let i = 0; i < rig.meshes.length; i++) rig.meshes[i].material = on ? flashMat : rig.orig[i];
}

export type Pose = 'zombie' | 'walk' | 'flee' | 'aim' | 'idle' | 'bite';

export function poseRig(rig: Rig, phase: number, speed01: number, pose: Pose, t: number) {
  const sw = Math.sin(phase) * 0.75 * speed01;
  rig.legL.rotation.x = sw;
  rig.legR.rotation.x = -sw;
  rig.upper.position.y = 0.72 + Math.abs(Math.sin(phase)) * 0.06 * speed01;
  switch (pose) {
    case 'zombie': {
      rig.armL.rotation.x = -1.45 + Math.sin(phase * 0.5) * 0.15;
      rig.armR.rotation.x = -1.3 + Math.cos(phase * 0.5) * 0.15;
      rig.armL.rotation.z = -0.08;
      rig.armR.rotation.z = 0.08;
      rig.upper.rotation.x = 0.14;
      rig.upper.rotation.z = Math.sin(phase * 0.5) * 0.06 * speed01;
      rig.head.rotation.z = Math.sin(t * 0.8) * 0.14;
      rig.head.rotation.x = -0.1;
      break;
    }
    case 'bite': {
      rig.armL.rotation.x = -1.9 + Math.sin(t * 20) * 0.4;
      rig.armR.rotation.x = -1.9 - Math.sin(t * 20) * 0.4;
      rig.upper.rotation.x = 0.35;
      rig.head.rotation.x = 0.2;
      break;
    }
    case 'flee': {
      rig.armL.rotation.x = -2.8 + Math.sin(phase * 1.3) * 0.4;
      rig.armR.rotation.x = -2.8 + Math.cos(phase * 1.3) * 0.4;
      rig.armL.rotation.z = -0.25;
      rig.armR.rotation.z = 0.25;
      rig.upper.rotation.x = -0.1;
      rig.upper.rotation.z = 0;
      rig.head.rotation.z = 0;
      rig.head.rotation.x = 0;
      break;
    }
    case 'aim': {
      rig.armR.rotation.x = -1.57;
      rig.armR.rotation.z = 0;
      rig.armL.rotation.x = -sw * 0.6;
      rig.armL.rotation.z = 0;
      rig.upper.rotation.x = 0;
      rig.upper.rotation.z = 0;
      rig.head.rotation.x = 0;
      rig.head.rotation.z = 0;
      break;
    }
    case 'walk':
    default: {
      rig.armL.rotation.x = -sw * 0.9;
      rig.armR.rotation.x = sw * 0.9;
      rig.armL.rotation.z = -0.05;
      rig.armR.rotation.z = 0.05;
      rig.upper.rotation.x = 0;
      rig.upper.rotation.z = 0;
      rig.head.rotation.x = 0;
      rig.head.rotation.z = pose === 'idle' ? Math.sin(t * 0.7 + phase) * 0.05 : 0;
      break;
    }
  }
}

const HUMAN_SKINS = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0xa06a3c, 0xffe0bd];
const ZOMBIE_SKINS = [0x8ee58a, 0xa3e66f, 0x6fd7a6, 0x9be5c0, 0xb8e986, 0x7bdff2];
const SHIRTS = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2, 0xf783ac, 0x38d9a9, 0x5c7cfa];
const PANTS = [0x4c6ef5, 0x5c7cfa, 0x7950f2, 0x74b816, 0x868e96, 0xff8787, 0x3bc9db];
const HAIRS = [0x5c3d2e, 0xffd166, 0x222222, 0xc9501c, 0xe9ecef, 0xd6336c, 0x4dabf7];

const rp = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export type HumanKind = 'civilian' | 'kid' | 'guard';

export function humanOptions(kind: HumanKind): RigOptions {
  if (kind === 'guard') {
    return { skin: rp(HUMAN_SKINS), shirt: 0x4263eb, pants: 0x364fc7, hair: rp(HAIRS), zombie: false, hat: 'guard', scale: 0.98, armed: true };
  }
  const hats: Hat[] = ['none', 'none', 'none', 'cap', 'tophat', 'party'];
  return {
    skin: rp(HUMAN_SKINS),
    shirt: rp(SHIRTS),
    pants: rp(PANTS),
    hair: rp(HAIRS),
    zombie: false,
    hat: rp(hats),
    scale: kind === 'kid' ? 0.68 : 0.88 + Math.random() * 0.14,
  };
}

export type ZombieKind = 'normal' | 'runner' | 'cone' | 'tank';

export function zombieOptions(kind: ZombieKind): RigOptions {
  const base: RigOptions = {
    skin: rp(ZOMBIE_SKINS),
    shirt: rp(SHIRTS),
    pants: rp(PANTS),
    hair: rp(HAIRS),
    zombie: true,
    hat: 'none',
    scale: 0.9 + Math.random() * 0.12,
    bandage: Math.random() < 0.15,
  };
  switch (kind) {
    case 'runner':
      return { ...base, skin: 0xd8ef5a, shirt: 0xff7ac8, scale: 0.84, hat: Math.random() < 0.5 ? 'party' : 'none' };
    case 'cone':
      return { ...base, hat: Math.random() < 0.5 ? 'cone' : 'bucket' };
    case 'tank':
      return { ...base, skin: 0x9a8cf2, shirt: 0xffc43d, pants: 0xff6b6b, scale: 1.55, hat: 'tophat', bandage: false };
    default:
      return { ...base, hat: Math.random() < 0.18 ? 'party' : 'none' };
  }
}

export function zombieFromHuman(h: RigOptions): RigOptions {
  return { ...h, skin: rp(ZOMBIE_SKINS), zombie: true, armed: false, bandage: Math.random() < 0.2 };
}
