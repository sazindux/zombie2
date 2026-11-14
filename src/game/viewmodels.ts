import * as THREE from 'three';

const mats = new Map<number, THREE.MeshLambertMaterial>();
const mat = (c: number) => {
  let m = mats.get(c);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c });
    mats.set(c, m);
  }
  return m;
};
const B = (w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  return m;
};
// cylinder oriented along -z
const C = (rt: number, rb: number, len: number, c: number, x = 0, y = 0, z = 0, seg = 14) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg), mat(c));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
};
const S = (r: number, c: number, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(c));
  m.position.set(x, y, z);
  return m;
};

function flashMesh() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.05), m);
    p.rotation.z = (i / 3) * Math.PI;
    g.add(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  g.add(core);
  g.visible = false;
  return g;
}

export interface ViewModels {
  weapons: THREE.Group[];
  flashes: THREE.Group[];
  arms: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
}

export function buildViewModels(): ViewModels {
  // ---------------- Splat Blaster ----------------
  const w1 = new THREE.Group();
  w1.add(B(0.09, 0.13, 0.38, 0x2ec4b6, 0, 0, 0));
  w1.add(B(0.07, 0.05, 0.3, 0xffffff, 0, 0.085, -0.02));
  w1.add(C(0.032, 0.032, 0.22, 0xff9f1c, 0, 0.01, -0.28));
  w1.add(C(0.045, 0.045, 0.05, 0xffd166, 0, 0.01, -0.4));
  w1.add(B(0.07, 0.17, 0.09, 0xff6b9d, 0, -0.13, 0.1));
  w1.add(B(0.05, 0.1, 0.08, 0x118ab2, 0, -0.1, -0.08));
  const hopper = S(0.07, 0x9bf6ff, 0, 0.17, 0.02);
  (hopper.material as THREE.MeshLambertMaterial) = new THREE.MeshLambertMaterial({ color: 0x9bf6ff, transparent: true, opacity: 0.7 });
  w1.add(hopper);
  w1.add(S(0.025, 0xff595e, -0.02, 0.16, 0.02), S(0.025, 0xffca3a, 0.02, 0.15, 0.04), S(0.025, 0x8ac926, 0.0, 0.2, 0.0));
  w1.add(B(0.05, 0.05, 0.08, 0xff595e, 0, 0.0, 0.22));

  // ---------------- Confetti Scatter ----------------
  const w2 = new THREE.Group();
  w2.add(C(0.04, 0.04, 0.62, 0x8338ec, 0, 0.02, -0.18));
  w2.add(C(0.032, 0.032, 0.6, 0xc77dff, 0, -0.05, -0.16));
  w2.add(C(0.09, 0.045, 0.14, 0xff6bd6, 0, 0.02, -0.55));
  w2.add(B(0.075, 0.075, 0.16, 0xffd166, 0, -0.05, -0.12));
  w2.add(B(0.08, 0.12, 0.3, 0xff9f1c, 0, -0.02, 0.2));
  w2.add(B(0.06, 0.15, 0.08, 0x4cc9f0, 0, -0.12, 0.12));
  w2.add(S(0.02, 0xffffff, 0, 0.07, -0.45));

  // ---------------- Pie Cannon ----------------
  const w3 = new THREE.Group();
  w3.add(C(0.085, 0.085, 0.5, 0xff595e, 0, 0.0, -0.1, 18));
  w3.add(C(0.087, 0.087, 0.07, 0xffffff, 0, 0, -0.18, 18));
  w3.add(C(0.087, 0.087, 0.07, 0xffffff, 0, 0, 0.02, 18));
  w3.add(C(0.13, 0.085, 0.12, 0xffd166, 0, 0, -0.41, 18));
  w3.add(S(0.04, 0xe63946, 0, 0.09, -0.4));
  w3.add(B(0.07, 0.16, 0.08, 0x2ec4b6, 0, -0.14, 0.04));
  w3.add(B(0.09, 0.1, 0.18, 0x118ab2, 0, -0.03, 0.26));

  const weapons = [w1, w2, w3];
  const flashes = [flashMesh(), flashMesh(), flashMesh()];
  const muzzleZ = [-0.45, -0.64, -0.5];
  weapons.forEach((w, i) => {
    flashes[i].position.set(0, 0.015, muzzleZ[i]);
    w.add(flashes[i]);
    w.traverse((o) => (o.matrixAutoUpdate = true));
  });

  // ---------------- Zombie arms ----------------
  const arms = new THREE.Group();
  const mkArm = (sx: number) => {
    const a = new THREE.Group();
    a.position.set(sx * 0.3, -0.42, -0.05);
    a.rotation.set(0.22, -sx * 0.1, 0);
    a.add(B(0.19, 0.19, 0.34, 0xff7eb6, 0, 0, -0.1));
    a.add(B(0.2, 0.2, 0.06, 0xffffff, 0, 0, -0.26));
    a.add(B(0.14, 0.14, 0.42, 0x8ee58a, 0, 0, -0.47));
    a.add(B(0.155, 0.155, 0.06, 0xffffff, 0, 0, -0.44));
    a.add(B(0.17, 0.08, 0.2, 0x8ee58a, 0, -0.005, -0.76));
    for (let i = -1; i <= 1; i++) {
      const f = B(0.045, 0.045, 0.14, 0x8ee58a, i * 0.055, -0.01, -0.92);
      f.rotation.x = 0.35;
      a.add(f);
    }
    const th = B(0.05, 0.05, 0.11, 0x8ee58a, sx * -0.1, -0.02, -0.74);
    th.rotation.y = sx * 0.6;
    a.add(th);
    arms.add(a);
    return a;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  return { weapons, flashes, arms, armL, armR };
}
