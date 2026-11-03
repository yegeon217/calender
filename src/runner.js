// 짓누르기 연출의 저격수 (직접 만든 3D 사람)
// 뼈대(THREE.Bone) 위에 후드티·청바지를 입힌 몸통·팔·다리를 한 덩어리로 만들어 관절에서 매끄럽게 굽고(스키닝),
// 손은 진짜 손 모델에 장갑 재질, 머리는 후드를 눌러쓰고 넥워머로 얼굴을 가린 모습, 발은 갈색 워커, 등에는 저격총.
// 단위는 미터 (위 +y, 앞 +z, 사람의 왼쪽 +x). 다리·팔은 두 마디 IK로 발목·손목을 원하는 자리에 놓음.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { noiseTex } from "./fx-util.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sm = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const AO = 0.2;   // 쉬는 자세에서 팔이 몸에서 벌어진 각도
const armDir = side => V(Math.sin(AO) * side, -Math.cos(AO), 0);

// 뼈: 이름 → [부모, 쉴 때 부모 기준 위치]
const BN = ["hips", "spine", "chest", "neck", "head", "armL", "foreL", "handL", "armR", "foreR", "handR", "thighL", "shinL", "footL", "thighR", "shinR", "footR"];
const REST = {
  hips: [null, V(0, 0.98, 0)], spine: ["hips", V(0, 0.1, -0.01)], chest: ["spine", V(0, 0.2, 0)], neck: ["chest", V(0, 0.22, 0.012)], head: ["neck", V(0, 0.1, 0.01)],
  armL: ["chest", V(0.185, 0.15, -0.015)], foreL: ["armL", armDir(1).multiplyScalar(0.29)], handL: ["foreL", armDir(1).multiplyScalar(0.26)],
  armR: ["chest", V(-0.185, 0.15, -0.015)], foreR: ["armR", armDir(-1).multiplyScalar(0.29)], handR: ["foreR", armDir(-1).multiplyScalar(0.26)],
  thighL: ["hips", V(0.095, -0.06, 0)], shinL: ["thighL", V(0, -0.43, 0)], footL: ["shinL", V(0, -0.41, 0)],
  thighR: ["hips", V(-0.095, -0.06, 0)], shinR: ["thighR", V(0, -0.43, 0)], footR: ["shinR", V(0, -0.41, 0)],
};
const BI = Object.fromEntries(BN.map((n, i) => [n, i]));
export const LEN = { thigh: 0.43, shin: 0.41, arm: 0.29, fore: 0.26, ankle: 0.08 };

// ── 관(옷 입은 몸통·팔·다리): 고리(단면)를 이어 붙임 ──
// 고리: c 중심, a 관이 뻗는 방향, u 단면 가로 방향, ax·az 반지름, n 모양(2 타원, 클수록 네모에 가까움)
function tubeGeo(rings, N, weightFn) {
  const pos = [], nor = [], uv = [], si = [], sw = [], idx = [];
  let vacc = 0;
  for (let k = 0; k < rings.length; k++) {
    const R = rings[k], b = V().crossVectors(R.a, R.u), P = rings[Math.max(0, k - 1)], Q = rings[Math.min(rings.length - 1, k + 1)];
    const ds = Q.c.distanceTo(P.c) || 1e-6, dax = (Q.ax - P.ax) / ds, daz = (Q.az - P.az) / ds;
    if (k) vacc += R.c.distanceTo(rings[k - 1].c);
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), e = 2 / (R.n || 2);
      const cx = Math.sign(c) * Math.pow(Math.abs(c), e), sz = Math.sign(s) * Math.pow(Math.abs(s), e);
      const p = R.c.clone().addScaledVector(R.u, R.ax * cx).addScaledVector(b, R.az * sz);
      const n = R.u.clone().multiplyScalar(cx / R.ax).addScaledVector(b, sz / R.az).normalize().addScaledVector(R.a, -(dax * Math.abs(cx) + daz * Math.abs(sz))).normalize();
      pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(i / N, vacc);
      const w = weightFn(p, k).filter(q => q[1] > 0.001).sort((a, b2) => b2[1] - a[1]).slice(0, 4), tot = w.reduce((a, q) => a + q[1], 0) || 1;
      for (let j = 0; j < 4; j++) { si.push(w[j] ? w[j][0] : 0); sw.push(w[j] ? w[j][1] / tot : 0); }
    }
  }
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) { const a = k * (N + 1) + i, b2 = a + N + 1; idx.push(a, a + 1, b2, a + 1, b2 + 1, b2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx);
  return g;
}
const DOWN = V(0, -1, 0), XA = V(1, 0, 0);
const vRings = (list, x0, n) => list.map(([y, ax, az, zo]) => ({ c: V(x0, y, zo || 0), a: DOWN, u: XA, ax, az, n }));
const mix = (a, b, t) => [[a, 1 - t], [b, t]];

// ── 질감 ──
function denimTex() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  x.fillStyle = "#3d5b82"; x.fillRect(0, 0, 128, 128);
  for (let i = -128; i < 256; i += 3) { x.strokeStyle = i % 2 ? "rgba(255,255,255,.07)" : "rgba(10,20,40,.12)"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); }
  for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"; x.fillRect(Math.random() * 128, Math.random() * 128, 1, Math.random() * 4 + 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 9); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ── 워커 (발목뼈 기준, 앞 +z · 밑창 바닥 y = -0.08) ──
function bootGeos() {
  // 위에서 본 밑창 모양: 뒤꿈치 → 발볼 → 둥근 앞코 (z, 반폭)
  const prof = [[-0.075, 0.03], [-0.07, 0.04], [-0.05, 0.044], [-0.02, 0.043], [0.02, 0.046], [0.07, 0.052], [0.11, 0.054], [0.15, 0.05], [0.18, 0.042], [0.2, 0.028], [0.21, 0.012]];
  const hw = z => { for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) { const [z0, w0] = prof[i - 1], [z1, w1] = prof[i]; return w0 + (w1 - w0) * (z - z0) / (z1 - z0); } return 0.01; };
  const sh = new THREE.Shape(); const pts = [];
  for (const [z, w] of prof) pts.push([w, -z]); for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], -prof[i][0]]);
  pts.forEach(([a, b], i) => (i ? sh.lineTo(a * 1.1, b * 1.04) : sh.moveTo(a * 1.1, b * 1.04)));
  const sole = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 4 });
  sole.rotateX(-Math.PI / 2); sole.translate(0, -0.08 + 0.004, 0);
  // 갑피: 앞뒤로 단면을 이어 붙임 (뒤는 발목을 감싸 높고, 발등으로 내려가 둥근 앞코)
  const hgt = z => (z < 0.0 ? 0.2 : z < 0.11 ? 0.2 - (z / 0.11) * 0.13 : 0.07 - ((z - 0.11) / 0.1) * 0.035);
  const rings = [], N = 18, top = -0.058;
  for (let i = 0; i <= 30; i++) {
    const z = -0.075 + (i / 30) * 0.287, e = Math.sqrt(Math.max(0.0004, Math.min(1, (z + 0.075) / 0.016, (0.212 - z) / 0.032)));
    rings.push({ z, w: Math.max(0.0006, hw(z) - 0.003) * e, h: hgt(z) * (0.55 + 0.45 * e) });
  }
  const pos = [], uv = [], idx = [];
  rings.forEach(({ z, w, h }) => { for (let j = 0; j <= N; j++) { const a = (j / N) * Math.PI, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.6;
    pos.push(Math.sign(c) * Math.pow(Math.abs(c), e) * w, top + Math.pow(s, e) * h, z); uv.push(j / N, z * 4); } });
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < N; j++) { const a = k * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const upper = new THREE.BufferGeometry(); upper.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); upper.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); upper.setIndex(idx); upper.computeVertexNormals();
  // 끈: 발등 비탈을 따라 엇갈려 묶인 끈 + 놋쇠 고리
  const laces = [], eyes = [];
  for (let i = 0; i < 5; i++) {
    const z = 0.012 + i * 0.022, y = top + hgt(z) + 0.004, w = hw(z) * 0.55;
    const g = new THREE.CylinderGeometry(0.0028, 0.0028, w * 2.1, 5); g.rotateZ(Math.PI / 2); g.rotateY(i % 2 ? 0.35 : -0.35); g.translate(0, y, z); laces.push(g);
    for (const s of [-1, 1]) { const e = new THREE.TorusGeometry(0.0045, 0.0016, 4, 8); e.rotateX(-Math.PI / 2 + 0.9); e.translate(s * w, y - 0.002, z); eyes.push(e); }
  }
  return { sole, upper, laces: mergeGeometries(laces), eyes: mergeGeometries(eyes) };
}

// ── 저격총 (원점 = 손잡이, 총열 방향 +z, 조준경 쪽 +y) ──
function buildRifle(M) {
  const g = new THREE.Group(), add = (geo, m, cast = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
  // 개머리판·몸통 (옆모습을 그려서 두께만큼 밀어냄)
  const s = new THREE.Shape();
  [[-0.38, -0.1], [-0.38, 0.035], [-0.3, 0.05], [-0.2, 0.06], [-0.08, 0.05], [-0.05, 0.02], [0.3, 0.02], [0.33, 0.0], [0.33, -0.03], [0.3, -0.04], [0.06, -0.04], [0.03, -0.06],
    [0.005, -0.135], [-0.035, -0.135], [-0.03, -0.06], [-0.07, -0.045], [-0.16, -0.06], [-0.3, -0.09]].forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const stock = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.006, bevelSegments: 3, curveSegments: 6 });
  stock.rotateY(-Math.PI / 2); stock.translate(0.018, 0, 0); add(stock, M.stock);
  const pad = new THREE.BoxGeometry(0.05, 0.14, 0.02); pad.translate(0, -0.03, -0.39); add(pad, M.rubber);
  const cyl = (r0, r1, z0, z1, m, seg = 20, y = 0, x = 0) => { const geo = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg); geo.rotateX(Math.PI / 2); geo.translate(x, y, (z0 + z1) / 2); return add(geo, m); };
  cyl(0.018, 0.018, -0.06, 0.2, M.metal, 20, 0.03);                 // 기관부
  cyl(0.013, 0.0095, 0.2, 0.78, M.metal, 16, 0.03);                 // 총열
  cyl(0.017, 0.017, 0.78, 0.85, M.metal, 16, 0.03);                 // 소염기
  for (const z of [0.8, 0.83]) cyl(0.0175, 0.0175, z - 0.004, z + 0.004, M.dark, 16, 0.03);
  // 노리쇠 손잡이 (오른쪽)
  const bolt = new THREE.CylinderGeometry(0.0045, 0.0045, 0.06, 8); bolt.rotateZ(Math.PI / 2 - 0.35); bolt.translate(-0.035, 0.022, -0.02); add(bolt, M.metal);
  const knob = new THREE.SphereGeometry(0.011, 12, 8); knob.translate(-0.064, 0.012, -0.02); add(knob, M.metal);
  // 탄창 · 방아쇠울
  const mag = new THREE.BoxGeometry(0.032, 0.07, 0.085); mag.translate(0, -0.065, 0.1); add(mag, M.dark);
  const tg = new THREE.TorusGeometry(0.03, 0.004, 6, 16, Math.PI); tg.rotateY(Math.PI / 2); tg.rotateX(Math.PI); tg.translate(0, -0.04, 0.035); add(tg, M.metal);
  // 접힌 양각대
  for (const x of [-0.011, 0.011]) cyl(0.0045, 0.0045, 0.27, 0.56, M.metal, 8, -0.05, x);
  const hinge = new THREE.BoxGeometry(0.035, 0.02, 0.03); hinge.translate(0, -0.045, 0.27); add(hinge, M.dark);
  // 조준경: 접안부 → 몸통 → 손잡이(다이얼) → 대물렌즈 쪽으로 벌어짐
  const SY = 0.095;
  const lp = [[0.0, -0.13], [0.021, -0.13], [0.022, -0.115], [0.02, -0.05], [0.0155, -0.035], [0.0155, 0.17], [0.019, 0.2], [0.027, 0.25], [0.027, 0.275], [0.0, 0.275]].map(([r, z]) => new THREE.Vector2(r, z));
  const scope = new THREE.LatheGeometry(lp, 28); scope.rotateX(Math.PI / 2); scope.translate(0, SY, 0); add(scope, M.scope);
  const turret = (x, y, ax) => { const geo = new THREE.CylinderGeometry(0.014, 0.014, 0.03, 18); if (ax) geo.rotateZ(Math.PI / 2); geo.translate(x, y, 0.07); add(geo, M.scope); };
  turret(0, SY + 0.026, false); turret(0.026, SY, true);
  const sad = new THREE.BoxGeometry(0.032, 0.03, 0.05); sad.translate(0, SY, 0.07); add(sad, M.scope);
  for (const z of [0.0, 0.15]) { const r = new THREE.TorusGeometry(0.019, 0.004, 6, 18); r.translate(0, SY, z); add(r, M.dark); const b = new THREE.BoxGeometry(0.02, SY - 0.045, 0.02); b.translate(0, (SY + 0.045) / 2, z); add(b, M.dark); }
  const lensF = new THREE.CircleGeometry(0.024, 24); lensF.translate(0, SY, 0.2755); add(lensF, M.lens, false);
  const lensB = new THREE.CircleGeometry(0.019, 20); lensB.rotateY(Math.PI); lensB.translate(0, SY, -0.1305); add(lensB, M.lens, false);
  g.userData = { grip: V(0, -0.07, -0.01), fore: V(0, -0.035, 0.24), butt: V(0, -0.02, -0.39), eye: V(0, SY, -0.13), muzzle: V(0, 0.03, 0.86) };
  return g;
}

export function buildRunner({ hands, dark }) {
  const root = new THREE.Group();
  // ── 재질 ──
  const fleece = noiseTex(128, 10, 34, 0.6), leatherBump = noiseTex(128, 6, 40, 0.8);
  const M = {
    hoodie: new THREE.MeshStandardMaterial({ color: 0x353b3d, roughness: 0.96, bumpMap: fleece, bumpScale: 0.6 }),
    hoodIn: new THREE.MeshStandardMaterial({ color: 0x1b1f21, roughness: 1, side: THREE.BackSide }),
    denim: new THREE.MeshStandardMaterial({ map: denimTex(), roughness: 0.88, bumpMap: fleece, bumpScale: 0.35 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc98b64, roughness: 0.6 }),
    gaiter: new THREE.MeshStandardMaterial({ color: 0x23272a, roughness: 0.95, bumpMap: fleece, bumpScale: 0.4 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.25 }),
    cord: new THREE.MeshStandardMaterial({ color: 0xcfd2cf, roughness: 0.8 }),
    aglet: new THREE.MeshStandardMaterial({ color: 0x9a9fa4, metalness: 0.8, roughness: 0.35 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x74502f, roughness: 0.62, bumpMap: leatherBump, bumpScale: 0.5 }),
    sole: new THREE.MeshStandardMaterial({ color: 0x1e1b19, roughness: 0.92 }),
    lace: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb28a46, metalness: 0.85, roughness: 0.35 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.72, bumpMap: noiseTex(128, 6, 26, 0.9), bumpScale: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x23262a, metalness: 0.6, roughness: 0.42 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x141517, metalness: 0.3, roughness: 0.6 }),
    stock: new THREE.MeshStandardMaterial({ color: 0x4b5240, roughness: 0.86 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 }),
    scope: new THREE.MeshStandardMaterial({ color: 0x17191b, metalness: 0.35, roughness: 0.5 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x0a2830, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4 }),
  };

  // ── 뼈 ──
  const B = {}; BN.forEach(n => { const b = new THREE.Bone(); b.name = n; B[n] = b; });
  BN.forEach(n => { const [par, off] = REST[n]; B[n].position.copy(off); if (par) B[par].add(B[n]); });
  const restW = {}; { const acc = n => { const [par, off] = REST[n]; return par ? acc(par).add(off) : off.clone(); }; BN.forEach(n => (restW[n] = acc(n))); }

  // ── 몸통 (후드티 + 청바지 허리) ──
  const torsoW = (p) => {
    const y = p.y, ax = Math.abs(p.x), side = p.x > 0 ? "L" : "R"; let w;
    if (y < 0.95) w = [[BI.hips, 1]];
    else if (y < 1.12) w = mix(BI.hips, BI.spine, sm((y - 0.95) / 0.17));
    else if (y < 1.3) w = mix(BI.spine, BI.chest, sm((y - 1.12) / 0.18));
    else if (y < 1.5) w = [[BI.chest, 1]];
    else w = mix(BI.chest, BI.neck, sm((y - 1.5) / 0.08));
    const sh = sm((ax - 0.12) / 0.08) * sm((y - 1.3) / 0.1) * 0.55;   // 어깨: 팔을 들면 같이 들림
    if (sh > 0) { w = w.map(q => [q[0], q[1] * (1 - sh)]); w.push([BI["arm" + side], sh]); }
    const lg = sm((0.93 - y) / 0.12) * sm((ax - 0.02) / 0.06) * 0.7;   // 엉덩이 아래쪽은 허벅지를 따라감
    if (lg > 0) { w = w.map(q => [q[0], q[1] * (1 - lg)]); w.push([BI["thigh" + side], lg]); }
    return w;
  };
  const hood = vRings([[1.6, 0.045, 0.045, 0.01], [1.565, 0.062, 0.064, 0.012], [1.52, 0.078, 0.078, 0.006], [1.495, 0.125, 0.092, 0], [1.468, 0.172, 0.106, -0.008], [1.43, 0.203, 0.12, -0.01],
    [1.37, 0.2, 0.13, 0], [1.3, 0.186, 0.134, 0.012], [1.22, 0.171, 0.13, 0.012], [1.13, 0.161, 0.122, 0.006], [1.06, 0.164, 0.12, 0.002], [1.02, 0.174, 0.126, 0], [0.997, 0.172, 0.124, 0], [0.986, 0.158, 0.11, 0]], 0, 2.3);
  const pelvis = vRings([[0.995, 0.157, 0.108, 0], [0.95, 0.162, 0.113, -0.006], [0.9, 0.168, 0.118, -0.012], [0.85, 0.15, 0.11, -0.006], [0.8, 0.09, 0.07, 0], [0.77, 0.025, 0.025, 0]], 0, 2.3);
  // 주머니(캥거루 포켓) 자리: 앞쪽 아랫배를 살짝 볼록하게
  hood.forEach(r => { if (r.c.y > 1.03 && r.c.y < 1.2) r.az += 0.006; });
  // ── 다리 (청바지) ──
  const legW = side => p => {
    const y = p.y, T = BI["thigh" + side], S = BI["shin" + side], F = BI["foot" + side];
    if (y > 0.9) return mix(T, BI.hips, sm((y - 0.9) / 0.14) * 0.5);
    if (y > 0.56) return [[T, 1]];
    if (y > 0.44) return mix(T, S, sm((0.56 - y) / 0.12));
    if (y > 0.15) return [[S, 1]];
    return mix(S, F, sm((0.15 - y) / 0.06) * 0.35);
  };
  const legR = (x0) => vRings([[1.03, 0.08, 0.086, -0.01], [0.96, 0.088, 0.096, -0.012], [0.88, 0.084, 0.092, -0.005], [0.76, 0.074, 0.08, 0], [0.62, 0.066, 0.07, 0.003], [0.53, 0.06, 0.064, 0.006],
    [0.45, 0.06, 0.066, -0.004], [0.34, 0.06, 0.064, -0.002], [0.22, 0.059, 0.063, 0], [0.15, 0.061, 0.065, 0.004], [0.112, 0.066, 0.07, 0.008], [0.104, 0.06, 0.064, 0.008]], x0, 2.05);
  // ── 팔 (후드티 소매 + 시보리) ──
  const armRings = side => {
    const s0 = restW["arm" + (side > 0 ? "L" : "R")], d = armDir(side), u = V(Math.cos(AO), Math.sin(AO) * side, 0).multiplyScalar(side > 0 ? 1 : -1);
    return [[-0.06, 0.05, 0.05], [0, 0.066, 0.063], [0.08, 0.063, 0.061], [0.18, 0.058, 0.056], [0.28, 0.053, 0.053], [0.36, 0.053, 0.051], [0.47, 0.049, 0.047], [0.505, 0.047, 0.045], [0.52, 0.04, 0.038], [0.552, 0.039, 0.037], [0.558, 0.033, 0.031]]
      .map(([s, ax, az]) => ({ c: s0.clone().addScaledVector(d, s), a: d, u, ax, az, n: 2, s }));
  };
  const armW = side => (p) => {
    const S = side > 0 ? "L" : "R", s = p.clone().sub(restW["arm" + S]).dot(armDir(side)), A = BI["arm" + S], F = BI["fore" + S], H = BI["hand" + S];
    if (s < 0.05) return mix(A, BI.chest, sm((0.05 - s) / 0.1) * 0.45);
    if (s < 0.24) return [[A, 1]];
    if (s < 0.33) return mix(A, F, sm((s - 0.24) / 0.09));
    if (s < 0.5) return [[F, 1]];
    return mix(F, H, sm((s - 0.5) / 0.06) * 0.25);
  };
  const parts = [[tubeGeo(hood, 26, torsoW), 0], [tubeGeo(pelvis, 26, torsoW), 1], [tubeGeo(legR(0.095), 18, legW("L")), 1], [tubeGeo(legR(-0.095), 18, legW("R")), 1],
    [tubeGeo(armRings(1), 16, armW(1)), 0], [tubeGeo(armRings(-1), 16, armW(-1)), 0]];
  const body = new THREE.SkinnedMesh(mergeGeometries(parts.map(p => p[0]), true), [M.hoodie, M.denim]);
  body.geometry.groups.forEach((gr, i) => (gr.materialIndex = parts[i][1]));
  body.add(B.hips); body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(BN.map(n => B[n])));
  body.castShadow = body.receiveShadow = true; body.frustumCulled = false; root.add(body);

  // ── 머리: 얼굴(넥워머로 코까지 가림) + 후드 + 후드끈 ──
  const head = new THREE.Group(); B.head.add(head);
  const mesh = (geo, m, cast = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; o.frustumCulled = false; return o; };
  const face = new THREE.SphereGeometry(1, 24, 18); face.scale(0.07, 0.094, 0.084); face.translate(0, 0.065, 0.022); head.add(mesh(face, M.skin));
  const brow = new THREE.SphereGeometry(1, 16, 8); brow.scale(0.064, 0.016, 0.03); brow.translate(0, 0.098, 0.086); head.add(mesh(brow, M.skin));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.0095, 10, 8); e.scale(1.2, 0.75, 0.6); e.translate(s * 0.029, 0.083, 0.098); head.add(mesh(e, M.eye, false)); }
  const gai = new THREE.CylinderGeometry(0.074, 0.08, 0.12, 22, 1, true); gai.scale(1, 1, 1.1); gai.translate(0, 0.0, 0.016); head.add(mesh(gai, M.gaiter));
  const gtop = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5); gtop.scale(0.075, 0.03, 0.088); gtop.rotateX(Math.PI); gtop.translate(0, 0.062, 0.018);
  head.add(mesh(gtop, M.gaiter));
  const hoodTop = new THREE.SphereGeometry(1, 30, 10, 0, Math.PI * 2, 0, Math.PI * 0.34); hoodTop.scale(0.112, 0.138, 0.128); hoodTop.translate(0, 0.07, -0.004);
  const hoodLow = new THREE.SphereGeometry(1, 30, 16, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, Math.PI * 0.34, Math.PI * 0.46); hoodLow.scale(0.112, 0.138, 0.128); hoodLow.translate(0, 0.07, -0.004);
  const hoodG = mergeGeometries([hoodTop, hoodLow]);
  head.add(mesh(hoodG, M.hoodie), mesh(hoodG, M.hoodIn, false));
  // 후드 테두리: 얼굴 둘레를 감싸는 두툼한 끈 자리
  { const C = V(0, 0.07, -0.004), P = (phi, th) => V(-Math.cos(phi) * Math.sin(th) * 0.112, Math.cos(th) * 0.138, Math.sin(phi) * Math.sin(th) * 0.128).multiplyScalar(1.02).add(C);
    const pA = Math.PI / 2 - 0.8, pB = Math.PI / 2 + 0.8, t0 = Math.PI * 0.34, t1 = Math.PI * 0.8, pts = [];
    for (let i = 0; i <= 8; i++) pts.push(P(pA, t1 - ((t1 - t0) * i) / 8));
    for (let i = 1; i < 12; i++) pts.push(P(pA + ((pB - pA) * i) / 12, t0));
    for (let i = 0; i <= 8; i++) pts.push(P(pB, t0 + ((t1 - t0) * i) / 8));
    head.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.011, 8, false), M.hoodie)); }
  for (const s of [-1, 1]) {
    const c = new THREE.CylinderGeometry(0.0032, 0.0032, 0.16, 6); c.translate(0, -0.08, 0); c.rotateZ(s * 0.06); c.translate(s * 0.042, -0.035, 0.1); head.add(mesh(c, M.cord, false));
    const a = new THREE.CylinderGeometry(0.0042, 0.0042, 0.022, 6); a.translate(s * 0.052, -0.2, 0.1); head.add(mesh(a, M.aglet, false));
  }

  // ── 워커 ──
  const BG = bootGeos();
  for (const S of ["L", "R"]) {
    const g = new THREE.Group(); B["foot" + S].add(g);
    g.add(mesh(BG.sole, M.sole), mesh(BG.upper, M.leather), mesh(BG.laces, M.lace, false), mesh(BG.eyes, M.brass, false));
  }

  // ── 손 (장갑): 오른손 모델, 왼손은 좌우로 뒤집어서 ──
  // 손 모델 좌표 → 손 기준(+y 손가락, +z 손바닥, +x 엄지) → 뼈 기준(손가락은 팔 방향, 엄지는 앞, 손바닥은 몸 쪽)
  const HAND = [];
  hands.forEach((H, i) => {
    const side = i ? 1 : -1, S = side > 0 ? "L" : "R";
    H.mesh.material = M.glove;
    const orient = new THREE.Group(); orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    const wrist = V().setFromMatrixPosition(H.restM.wrist); H.scene.position.copy(wrist).negate(); orient.add(H.scene);
    const fr = new THREE.Group(), fd = armDir(-1), pn = V(Math.cos(AO), -Math.sin(AO), 0);
    fr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), fd, pn)); fr.add(orient);
    const holder = new THREE.Group(); if (side > 0) holder.scale.x = -1; holder.add(fr); B["hand" + S].add(holder);
    HAND.push({ H, S });
  });
  const FIST = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] };
  function fingers(S, curl, thumb = curl * 0.6, spread = 0) {
    const h = HAND.find(q => q.S === S); if (!h) return;
    for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n]; h.H.setChain(n, [null, [f[0] * curl, (n === "index" ? 1 : n === "pinky" ? -1 : 0) * spread, 0], [f[1] * curl, 0, 0], [f[2] * curl, 0, 0]]); }
    h.H.setChain("thumb", [[-0.6 * thumb + 0.1, 0.3 * thumb - 0.15, 0], [-0.5 * thumb, 0, 0], [-0.6 * thumb, 0, 0]]);
  }

  // ── 총 ──
  const rifle = buildRifle(M); root.add(rifle);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });

  // ── 자세 도구 (모두 root 기준 · 미터) ──
  const qRoot = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), tmpV = V(), m4 = new THREE.Matrix4();
  const rootInv = new THREE.Matrix4();
  const posOf = (bone, out = V()) => out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(rootInv);
  const quatOf = (obj, out = new THREE.Quaternion()) => { obj.getWorldQuaternion(out); return out.premultiply(qRoot.clone().invert()); };
  function begin() {   // 모든 뼈를 쉬는 자세로
    BN.forEach(n => { B[n].position.copy(REST[n][1]); B[n].quaternion.identity(); });
    root.updateMatrixWorld(true); rootInv.copy(root.matrixWorld).invert(); root.getWorldQuaternion(qRoot);
  }
  const sync = () => { root.updateMatrixWorld(true); rootInv.copy(root.matrixWorld).invert(); root.getWorldQuaternion(qRoot); };
  // 뼈가 root 기준 방향 dir을 보도록 (쉴 때 자식 쪽 방향 rest를 돌려서)
  function aim(bone, rest, dir) {
    const pq = quatOf(bone.parent, tmpQ), d = dir.clone().applyQuaternion(pq.invert()).normalize();
    bone.quaternion.setFromUnitVectors(rest.clone().normalize(), d); bone.updateMatrixWorld(true);
  }
  // 두 마디 IK: a(위 마디) → b(아래 마디) → 끝이 target에 닿게, 무릎·팔꿈치는 pole 쪽으로
  function ik(a, b, end, target, pole) {
    const A = posOf(a), l1 = REST[b.name][1].length(), l2 = REST[end.name][1].length();
    const T = target.clone(), dvec = T.clone().sub(A); let d = dvec.length(); const dir = dvec.normalize();
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const pv = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E = A.clone().addScaledVector(dir, x).addScaledVector(pv, h), Tc = A.clone().addScaledVector(dir, d);
    aim(a, REST[b.name][1], E.clone().sub(A)); aim(b, REST[end.name][1], Tc.sub(E));
  }
  // 발: 발목을 target에, 앞쪽(+z) 기준으로 pitch(+면 발끝이 아래)·yaw
  function leg(S, ankle, pitch = 0, yaw = 0, knee = V(0, 0, 1)) {
    ik(B["thigh" + S], B["shin" + S], B["foot" + S], ankle, knee);
    const want = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")), pq = quatOf(B["shin" + S], tmpQ);
    B["foot" + S].quaternion.copy(pq.invert().multiply(want)); B["foot" + S].updateMatrixWorld(true);
  }
  // 팔: 손목을 target에, 팔꿈치는 pole 쪽 · 손 방향은 hq(root 기준, 없으면 팔뚝 따라)
  function arm(S, wrist, pole, hq) {
    ik(B["arm" + S], B["fore" + S], B["hand" + S], wrist, pole);
    if (hq) { const pq = quatOf(B["fore" + S], tmpQ); B["hand" + S].quaternion.copy(pq.invert().multiply(hq)); B["hand" + S].updateMatrixWorld(true); }
  }
  const setE = (n, x = 0, y = 0, z = 0) => { B[n].quaternion.setFromEuler(new THREE.Euler(x, y, z, "YXZ")); };
  const toRoot = (obj, local) => local.clone().applyMatrix4(obj.matrixWorld).applyMatrix4(rootInv);
  // 총: 등에 멘 자리 (가슴뼈 기준)
  // 총열이 왼쪽 어깨 뒤로 비스듬히 솟고 개머리판은 오른쪽 엉덩이 쪽 · 조준경은 바깥(뒤)을 봄
  const bz = V(0.3, 0.84, -0.46).normalize(), by0 = V(0, 0, -1), bx = V().crossVectors(by0, bz).normalize(), by = V().crossVectors(bz, bx);
  const backQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx, by, bz)), backP = V(-0.02, 0.0, -0.2).addScaledVector(bz, -0.235);
  function rifleBack() {
    m4.copy(B.chest.matrixWorld).premultiply(rootInv);
    const p = backP.clone().applyMatrix4(m4), q = new THREE.Quaternion().setFromRotationMatrix(m4.extractRotation(m4)).multiply(backQ);
    return { p, q };
  }
  function placeRifle(p, q) { rifle.position.copy(p); rifle.quaternion.copy(q); rifle.updateMatrixWorld(true); }
  const rp = k => toRoot(rifle, rifle.userData[k]);
  return { root, B, M, rifle, begin, sync, aim, ik, leg, arm, setE, fingers, posOf, quatOf, toRoot, rifleBack, placeRifle, rp, restW, LEN };
}
