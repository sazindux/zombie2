import * as THREE from 'three';

export type PickupType = 'heart' | 'gift' | 'cupcake';

const mats = new Map<number, THREE.MeshLambertMaterial>();
const mat = (c: number) => {
  let m = mats.get(c);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c });
    mats.set(c, m);
  }
  return m;
};

let heartGeo: THREE.BufferGeometry | null = null;
function getHeart() {
  if (heartGeo) return heartGeo;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector2(x / 30, y / 30));
  }
  const shape = new THREE.Shape(pts);
  heartGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 3 });
  heartGeo.center();
  return heartGeo;
}

const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 7, 14, 1, true);
const ringGeo = new THREE.RingGeometry(0.55, 0.85, 28);

export interface PickupObj {
  type: PickupType;
  group: THREE.Group;
  body: THREE.Group;
  x: number;
  z: number;
  t: number;
  life: number;
  amount: number;
}

export function makePickup(type: PickupType, x: number, z: number, amount = 0): PickupObj {
  const group = new THREE.Group();
  const body = new THREE.Group();
  let color = 0xff6b9d;
  if (type === 'heart') {
    const m = new THREE.Mesh(getHeart(), mat(0xff4d6d));
    m.scale.setScalar(0.95);
    body.add(m);
    color = 0xff4d6d;
  } else if (type === 'gift') {
    body.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), mat(0x4cc9f0)));
    body.add(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.52, 0.12), mat(0xffd166)));
    body.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.64), mat(0xffd166)));
    const bow1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat(0xff6b9d));
    bow1.position.set(0.1, 0.34, 0);
    const bow2 = bow1.clone();
    bow2.position.x = -0.1;
    body.add(bow1, bow2);
    color = 0x4cc9f0;
  } else {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.28, 12), mat(0xff8fab));
    wrap.position.y = -0.1;
    const frost = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8), mat(0xfff0f5));
    frost.scale.y = 0.75;
    frost.position.y = 0.12;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.28, 10), mat(0xffe3ec));
    top.position.y = 0.38;
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xe63946));
    cherry.position.y = 0.56;
    const sprinkles = [0xffd166, 0x4cc9f0, 0x8ac926];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), mat(sprinkles[i % 3]));
      const a = i * 1.05;
      s.position.set(Math.cos(a) * 0.24, 0.2 + (i % 2) * 0.05, Math.sin(a) * 0.24);
      s.rotation.y = a;
      body.add(s);
    }
    body.add(wrap, frost, top, cherry);
    body.scale.setScalar(1.25);
    color = 0xff8fab;
  }
  body.position.y = 1.1;
  body.traverse((o) => (o.castShadow = true));
  group.add(body);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false })
  );
  beam.position.y = 3.5;
  group.add(beam);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  group.position.set(x, 0, z);
  return { type, group, body, x, z, t: Math.random() * 6, life: 0, amount };
}
