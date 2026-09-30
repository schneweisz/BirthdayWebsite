import * as THREE from 'three';
import { animate, Ease, clamp, lerp, pick, rand } from './anim.js';
import { flameTexture, heartShape } from './textures.js';

const PLATE_R = 1.8;
const BOTTOM = { r: 1.35, h: 0.85 };
const TOP = { r: 0.95, h: 0.65 };
const TOP_Y = BOTTOM.h + TOP.h; // a felső szint teteje

const SPRINKLE_COLORS = ['#ff5c9a', '#ffffff', '#c7a3ff', '#ffd36b', '#7fd8ff', '#ff9ec7'];

const CANDLE_GAP = 0.04;
const CANDLES_MAX_W = 1.6; // ennél szélesebb sor már lelógna a felső szintről

export function createCake(glowTex, smoke, age) {
  const root = new THREE.Group();
  const cake = new THREE.Group();
  root.add(cake);

  const standMat = new THREE.MeshPhysicalMaterial({ color: '#fffafc', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#e8c07a', metalness: 1, roughness: 0.25 });
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: '#fff6fb', roughness: 0.15, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.5,
  });

  // ── Tortaállvány ────────────────────────────────────────────
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(PLATE_R, PLATE_R - 0.1, 0.1, 96), standMat);
  plate.position.y = -0.05;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(PLATE_R, 0.03, 12, 128), goldMat);
  rim.rotation.x = Math.PI / 2;
  const stem = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.9, -1.3), new THREE.Vector2(0.92, -1.24), new THREE.Vector2(0.3, -1.12),
      new THREE.Vector2(0.14, -0.8), new THREE.Vector2(0.12, -0.45), new THREE.Vector2(0.2, -0.2),
      new THREE.Vector2(0.55, -0.1), new THREE.Vector2(0, -0.1),
    ], 64),
    standMat,
  );
  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.025, 12, 96), goldMat);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = -1.25;
  root.add(plate, rim, stem, baseRim);

  // ── Szintek ─────────────────────────────────────────────────
  const pinkMat = new THREE.MeshPhysicalMaterial({ color: '#ffb0cb', roughness: 0.65, sheen: 1, sheenColor: new THREE.Color('#ffe0ec') });
  const creamMat = new THREE.MeshPhysicalMaterial({ color: '#fff3ef', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  const creamIcing = new THREE.MeshPhysicalMaterial({ color: '#fffaf7', roughness: 0.3, clearcoat: 0.6 });
  const pinkIcing = new THREE.MeshPhysicalMaterial({ color: '#ff7fb0', roughness: 0.3, clearcoat: 0.6 });

  addTier(cake, BOTTOM.r, 0, BOTTOM.h, pinkMat, creamIcing, pearlMat);
  addTier(cake, TOP.r, BOTTOM.h, TOP.h, creamMat, pinkIcing, pearlMat);

  addSprinkles(cake, 0.1, TOP.r - 0.1, TOP_Y + 0.03, 160);
  addSprinkles(cake, TOP.r + 0.12, BOTTOM.r - 0.12, BOTTOM.h + 0.03, 150);

  // Szívecskék az alsó szint oldalán
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.22), {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3,
  });
  heartGeo.center();
  const heartMat = new THREE.MeshPhysicalMaterial({ color: '#e0407a', roughness: 0.25, clearcoat: 1 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const h = new THREE.Mesh(heartGeo, heartMat);
    h.position.set(Math.sin(a) * (BOTTOM.r + 0.02), BOTTOM.h * 0.42, Math.cos(a) * (BOTTOM.r + 0.02));
    h.rotation.y = a;
    cake.add(h);
  }

  // ── Számgyertyák lánggal (az életkor számjegyei egymás mellett) ─
  const flameTex = flameTexture();
  const candles = [];
  const digits = (String(age ?? '').replace(/\D/g, '') || '0').split('').map(createDigitCandle);
  const rowW = digits.reduce((w, d) => w + d.width, 0) + CANDLE_GAP * (digits.length - 1);
  const rowScale = Math.min(1, CANDLES_MAX_W / rowW);
  let left = -rowW / 2;
  digits.forEach((candle, i) => {
    const x = (left + candle.width / 2) * rowScale;
    left += candle.width + CANDLE_GAP;
    candle.mesh.position.set(x, TOP_Y - 0.02, 0.05);
    candle.mesh.rotation.y = -x * 0.3;
    candle.mesh.scale.setScalar(rowScale);
    candle.mesh.userData.candleIndex = i;
    cake.add(candle.mesh);

    candle.mesh.updateMatrix();
    const wickTip = candle.wickTop.clone().applyMatrix4(candle.mesh.matrix);

    const flameRoot = new THREE.Group();
    flameRoot.position.copy(wickTip);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.center.set(0.5, 0.06);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: '#ffb35c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.position.y = 0.1;
    glow.scale.setScalar(0.9);
    const light = new THREE.PointLight('#ffae5c', 1.2, 4, 2);
    light.position.y = 0.15;
    flameRoot.add(glow, flame, light);
    cake.add(flameRoot);

    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(wickTip).add(new THREE.Vector3(0, -0.15, 0));
    hit.userData.candleIndex = i;
    cake.add(hit);

    candles.push({ flameRoot, flame, glow, light, hit, candleMesh: candle.mesh, lit: true, level: 1, phase: Math.random() * 10 });
  });

  root.visible = false;
  const bodyTargets = [];
  root.traverse((o) => o.isMesh && bodyTargets.push(o));

  let time = 0;
  let wind = 0;

  return {
    root,
    hitTargets: candles.flatMap((c) => [c.hit, c.candleMesh]),
    bodyTargets,
    get allOut() {
      return candles.every((c) => !c.lit);
    },
    setWind(v) {
      wind = clamp(v);
    },

    update(dt) {
      time += dt;
      for (const c of candles) {
        const n = Math.sin(time * 13 + c.phase) * 0.5 + Math.sin(time * 23.7 + c.phase * 2) * 0.3 + Math.sin(time * 7.3) * 0.2;
        const w = c.lit ? wind : 0;
        const s = c.level * (1 - w * 0.45);
        c.flame.scale.set(0.13 * s * (1 + n * 0.05), 0.3 * s * (1 + n * 0.12), 1);
        c.flameRoot.rotation.z = -w * 0.9 + Math.sin(time * 3 + c.phase) * 0.04;
        c.glow.material.opacity = 0.55 * c.level * (0.9 + n * 0.1);
        c.light.intensity = 1.2 * c.level * (0.85 + n * 0.15);
      }
    },

    async rise() {
      root.visible = true;
      await animate(2.2, (e) => {
        root.position.y = lerp(-7, 0, e);
        root.rotation.y = lerp(-Math.PI * 1.5, 0, e);
      }, Ease.outBack);
    },

    /** Egy gyertya elfújása; true, ha most aludt ki */
    blow(i) {
      const c = candles[i];
      if (!c.lit) return false;
      c.lit = false;
      const lean = c.flameRoot.rotation.z;
      animate(0.4, (e) => {
        c.level = 1 - e;
        c.flameRoot.rotation.z = lerp(lean, -1.1, e);
      }, Ease.outCubic).then(() => {
        c.flameRoot.visible = false;
        const p = c.flameRoot.position.clone();
        cake.localToWorld(p);
        smoke.emit(p, 2.5);
      });
      return true;
    },

    blowAll() {
      candles.forEach((_, i) => this.blow(i));
    },

    /** A felső szint közepe világkoordinátában (konfetti-kilövéshez) */
    topCenter() {
      return cake.localToWorld(new THREE.Vector3(0, TOP_Y + 0.5, 0));
    },
  };
}

function addTier(parent, r, y, h, bodyMat, icingMat, pearlMat) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96), bodyMat);
  body.position.y = y + h / 2;
  parent.add(body);

  // Máz a tetején + lecsorgások
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.05, 96), icingMat);
  cap.position.y = y + h + 0.005;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.045, 12, 128), icingMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = y + h - 0.01;
  parent.add(cap, lip);

  const dripCount = Math.round(r * 30);
  const drips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 1, 4, 10), icingMat, dripCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < dripCount; i++) {
    const a = (i / dripCount) * Math.PI * 2 + rand(-0.04, 0.04);
    const len = rand(0.06, h * 0.45);
    m.compose(
      new THREE.Vector3(Math.sin(a) * (r + 0.005), y + h - len / 2, Math.cos(a) * (r + 0.005)),
      q,
      new THREE.Vector3(1, len, 1),
    );
    drips.setMatrixAt(i, m);
  }
  parent.add(drips);

  // Gyöngysor az alján
  const pearlCount = Math.round(r * 44);
  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 14, 10), pearlMat, pearlCount);
  for (let i = 0; i < pearlCount; i++) {
    const a = (i / pearlCount) * Math.PI * 2;
    m.compose(new THREE.Vector3(Math.sin(a) * (r + 0.02), y + 0.05, Math.cos(a) * (r + 0.02)), q, new THREE.Vector3(1, 1, 1));
    pearls.setMatrixAt(i, m);
  }
  parent.add(pearls);
}

function addSprinkles(parent, rMin, rMax, y, count) {
  const mesh = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.012, 0.045, 3, 6),
    new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    count,
  );
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(rand(rMin * rMin, rMax * rMax));
    q.setFromEuler(e.set(Math.PI / 2, 0, Math.random() * Math.PI));
    m.compose(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.set(pick(SPRINKLE_COLORS)));
  }
  parent.add(mesh);
}

// ── Számgyertyák (0–9) ────────────────────────────────────────
// A számjegyek körvonala egységnyi magasságú (y: 0..1) mezőben, 0.2 vonalvastagsággal;
// egy számjegy több, egymást átfedő alakzatból is állhat. A kanóc mindig a tetején (y = 1) ül.
const DIGIT_H = 0.6; // a gyertya magassága
const HALF = 0.1; // fél vonalvastagság
const d2r = Math.PI / 180;

function poly(...pts) {
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

const rect = (x0, y0, x1, y1) => poly([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/** Körív-sáv az r sugarú középvonal mentén, a0-tól a1 fokig (az óramutatóval ellentétesen) */
function band(cx, cy, r, a0, a1) {
  const ro = r + HALF;
  const ri = r - HALF;
  const shape = new THREE.Shape();
  shape.moveTo(cx + ro * Math.cos(a0 * d2r), cy + ro * Math.sin(a0 * d2r));
  shape.absarc(cx, cy, ro, a0 * d2r, a1 * d2r, false);
  shape.lineTo(cx + ri * Math.cos(a1 * d2r), cy + ri * Math.sin(a1 * d2r));
  shape.absarc(cx, cy, ri, a1 * d2r, a0 * d2r, true);
  shape.closePath();
  return shape;
}

function ring(cx, cy, r) {
  const shape = new THREE.Shape();
  shape.absarc(cx, cy, r + HALF, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(cx, cy, r - HALF, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function zeroShape() {
  const stadium = (path, r) => {
    path.moveTo(0.35 + r, 0.32);
    path.lineTo(0.35 + r, 0.68);
    path.absarc(0.35, 0.68, r, 0, Math.PI, false);
    path.lineTo(0.35 - r, 0.32);
    path.absarc(0.35, 0.32, r, Math.PI, Math.PI * 2, false);
    return path;
  };
  const shape = stadium(new THREE.Shape(), 0.32);
  shape.holes.push(stadium(new THREE.Path(), 0.12));
  return shape;
}

function twoShape() {
  const C = [0.35, 0.68];
  const R = 0.32;
  const r = 0.12;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.72, 0);
  shape.lineTo(0.72, 0.2);
  shape.lineTo(0.34, 0.2);
  shape.lineTo(C[0] + R * Math.cos(-30 * d2r), C[1] + R * Math.sin(-30 * d2r));
  shape.absarc(C[0], C[1], R, -30 * d2r, 165 * d2r, false);
  shape.lineTo(C[0] + r * Math.cos(165 * d2r), C[1] + r * Math.sin(165 * d2r));
  shape.absarc(C[0], C[1], r, 165 * d2r, -35 * d2r, true);
  shape.lineTo(0, 0.2);
  shape.closePath();
  return shape;
}

// számjegy → { shapes, wickX }
const DIGITS = {
  0: () => ({ shapes: [zeroShape()], wickX: 0.35 }),
  1: () => ({
    shapes: [rect(0.3, 0, 0.5, 1), poly([0.06, 0.74], [0.2, 0.6], [0.45, 0.85], [0.32, 1])],
    wickX: 0.4,
  }),
  2: () => ({ shapes: [twoShape()], wickX: 0.35 }),
  3: () => ({ shapes: [band(0.35, 0.7, 0.2, -90, 150), band(0.35, 0.3, 0.2, -150, 90)], wickX: 0.35 }),
  4: () => ({
    shapes: [
      rect(0.44, 0, 0.64, 1),
      rect(0.02, 0.24, 0.74, 0.44),
      poly([0.02, 0.34], [0.195, 0.34], [0.5, 0.747], [0.5, 1], [0.44, 1], [0.02, 0.44]),
    ],
    wickX: 0.54,
  }),
  5: () => ({
    shapes: [
      rect(0.12, 0.8, 0.64, 1),
      poly([0.12, 1], [0.12, 0.5615], [0.251, 0.411], [0.32, 0.5], [0.32, 1]),
      band(0.33, 0.32, 0.22, -150, 131),
    ],
    wickX: 0.38,
  }),
  6: () => ({
    shapes: [ring(0.35, 0.32, 0.22), rect(0.03, 0.3, 0.23, 0.7), band(0.35, 0.68, 0.22, 35, 180)],
    wickX: 0.35,
  }),
  7: () => ({
    shapes: [rect(0.05, 0.8, 0.65, 1), poly([0.2, 0], [0.41, 0], [0.65, 0.9], [0.44, 0.9])],
    wickX: 0.35,
  }),
  8: () => ({ shapes: [ring(0.35, 0.7, 0.2), ring(0.35, 0.3, 0.2)], wickX: 0.35 }),
  9: () => ({
    shapes: [ring(0.35, 0.68, 0.22), rect(0.47, 0.3, 0.67, 0.7), band(0.35, 0.32, 0.22, 215, 360)],
    wickX: 0.35,
  }),
};

let candleMats = null;

/** Kihúzott számgyertya; visszaadja a mesh-t, a szélességét és a kanóc helyét */
function createDigitCandle(digit) {
  const { shapes, wickX } = DIGITS[digit]();
  const depth = 0.1;
  const bevel = 0.018;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth, curveSegments: 32, bevelEnabled: true, bevelThickness: 0.025, bevelSize: bevel / DIGIT_H, bevelSegments: 4,
  });
  geo.scale(DIGIT_H, DIGIT_H, 1);
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const cx = (min.x + max.x) / 2;
  geo.translate(-cx, bevel, -depth / 2);

  candleMats ??= [
    new THREE.MeshPhysicalMaterial({
      color: '#ff86b9', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#ffe4f0'),
    }),
    new THREE.MeshStandardMaterial({ color: '#f1c67a', metalness: 0.9, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#2b2023', roughness: 0.9 }),
  ];
  const [face, side, wickMat] = candleMats;
  const mesh = new THREE.Mesh(geo, [face, side]);

  const topY = DIGIT_H + bevel * 2;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 8), wickMat);
  wick.position.set(wickX * DIGIT_H - cx, topY + 0.03, 0);
  mesh.add(wick);

  return { mesh, width: max.x - min.x, wickTop: new THREE.Vector3(wickX * DIGIT_H - cx, topY + 0.065, 0) };
}
