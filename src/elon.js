// 화성 연출의 인물: 머리는 받은 사진 두 장(손가락질 · 엄지척)을 입힌 입체 얼굴, 몸은 사진 속 옷(검은 가죽 재킷 · 무늬 티셔츠 · 검은 바지)을 직접 만든 것.
// 얼굴: 사진 윤곽을 부풀린 면에 코·눈두덩·볼·입 굴곡을 더하고 사진을 앞에서 그대로 비춤. 뒤통수는 사진마다 따로 막음.
// 단위는 미터 (위 +y, 앞 +z, 사람의 왼쪽 +x).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tubeGeo, vRings, mix, sm } from "./runner.js";
import { noiseTex } from "./fx-util.js";
import urlA from "./assets/el-a.webp?url";
import urlB from "./assets/el-b.webp?url";
import urlTee from "./assets/el-tee.webp?url";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const AO = 0.16, armDir = side => V(Math.sin(AO) * side, -Math.cos(AO), 0);
const BN = ["hips", "spine", "chest", "neck", "head", "armL", "foreL", "handL", "armR", "foreR", "handR", "thighL", "shinL", "footL", "thighR", "shinR", "footR"];
const REST = {
  hips: [null, V(0, 0.98, 0)], spine: ["hips", V(0, 0.13, 0)], chest: ["spine", V(0, 0.22, 0)], neck: ["chest", V(0, 0.19, 0.012)], head: ["neck", V(0, 0.05, 0.012)],
  armL: ["chest", V(0.205, 0.11, -0.008)], foreL: ["armL", armDir(1).multiplyScalar(0.32)], handL: ["foreL", armDir(1).multiplyScalar(0.28)],
  armR: ["chest", V(-0.205, 0.11, -0.008)], foreR: ["armR", armDir(-1).multiplyScalar(0.32)], handR: ["foreR", armDir(-1).multiplyScalar(0.28)],
  thighL: ["hips", V(0.115, -0.05, 0)], shinL: ["thighL", V(0, -0.45, 0)], footL: ["shinL", V(0, -0.4, 0)],
  thighR: ["hips", V(-0.115, -0.05, 0)], shinR: ["thighR", V(0, -0.45, 0)], footR: ["shinR", V(0, -0.4, 0)],
};
const BI = Object.fromEntries(BN.map((n, i) => [n, i]));

// ── 사진 자료 (좌표는 원본 사진 픽셀) ──
const FACES = {
  // 손가락질하며 씩 웃는 사진
  a: { url: urlA, crop: [28, 0, 222, 226], S: 0.00153, C: [122, 196], hair: 0x2c211b, shell: [128, 108, 0.126, 0.14, -0.2, 0.1, -0.032],
    P: [[113,14],[128,10],[145,9],[165,12],[182,18],[195,26],[205,36],[214,48],[219,60],[219,72],[224,82],[236,87],[225,92],[212,93],[206,100],[205,112],[212,125],[214,132],[205,140],[198,143],[196,152],[193,160],[188,172],[181,184],[174,194],[168,196],[163,190],[152,203],[135,212],[118,210],[100,202],[80,193],[62,184],[52,170],[49,150],[43,146],[41,130],[43,110],[47,99],[52,96],[56,82],[60,66],[63,52],[70,42],[80,35],[92,28],[103,19]],
    B: [[134, 124, 14, 16, 0.032], [127, 96, 8, 26, 0.014], [135, 74, 62, 11, 0.008], [112, 92, 18, 9, -0.011], [166, 112, 16, 9, -0.011], [122, 150, 30, 13, 0.01], [122, 190, 32, 13, 0.012], [82, 135, 26, 30, 0.016], [172, 145, 20, 28, 0.015], [130, 40, 72, 18, 0.008]] },
  // 엄지척하며 활짝 웃는 사진
  b: { url: urlB, crop: [278, 4, 120, 156], S: 0.0023, C: [340, 141], hair: 0x3a2618, shell: [336, 76, 0.11, 0.136, 0, 0.1, -0.032],
    P: [[288,48],[290,40],[295,33],[303,27],[312,21],[323,15],[335,13],[350,13],[362,15],[371,19],[375,27],[373,34],[376,39],[378,48],[379,58],[380,68],[382,76],[384,86],[386,97],[386,110],[384,124],[379,135],[372,143],[362,148],[350,151],[339,148],[328,141],[320,132],[313,123],[306,118],[302,112],[299,102],[296,92],[291,87],[290,80],[292,74],[290,62]],
    B: [[358, 100, 10, 11, 0.03], [352, 82, 5, 14, 0.014], [340, 66, 40, 7, 0.008], [332, 81, 11, 5, -0.011], [365, 79, 10, 5, -0.011], [358, 120, 18, 7, 0.01], [345, 142, 17, 7, 0.012], [318, 105, 12, 16, 0.016], [380, 105, 6, 14, 0.012], [335, 26, 42, 10, 0.008]] },
};

function maskTex(poly, crop, res, blur) {
  const c = document.createElement("canvas"), k = res / Math.max(crop[2], crop[3]); c.width = Math.round(crop[2] * k); c.height = Math.round(crop[3] * k); const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.filter = `blur(${blur}px)`; x.fillStyle = "#fff"; x.beginPath();
  poly.forEach(([a, b], i) => { const u = (a - crop[0]) * k, v = (b - crop[1]) * k; i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const segD = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
function inP(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
// 사진 윤곽을 부풀린 면: 가장자리에서 둥글게 말려 들어가고, 얼굴 굴곡(b: [x, y, 가로폭, 세로폭, 높이], 픽셀 좌표)을 더함
function relief(P, crop, S, C, bumps, o) {
  const NX = o.nx, NY = o.ny, pos = [], uv = [], idx = [], keep = new Int32Array((NX + 1) * (NY + 1)).fill(-1), R = o.R, Z = o.Z, mar = o.mar / S;
  const dist = new Float32Array((NX + 1) * (NY + 1)), inside = new Uint8Array((NX + 1) * (NY + 1));
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const px = crop[0] + (i / NX) * crop[2], py = crop[1] + (j / NY) * crop[3]; let d = 1e9; for (let k = 0; k < P.length; k++) d = Math.min(d, segD(px, py, P[k], P[(k + 1) % P.length])); dist[j * (NX + 1) + i] = d; inside[j * (NX + 1) + i] = inP(P, px, py) ? 1 : 0; }
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i, d = dist[k]; if (!inside[k] && d > mar) continue;
    const px = crop[0] + (i / NX) * crop[2], py = crop[1] + (j / NY) * crop[3], dm = (inside[k] ? d : -d) * S; let z = dm > 0 ? Z * Math.sqrt(1 - Math.pow(1 - Math.min(dm / R, 1), 2)) : dm * 0.6;
    for (const [bx, by, sx, sy, h] of bumps) { const u = (px - bx) / sx, v = (py - by) / sy; z += h * Math.exp(-(u * u + v * v)); }
    keep[k] = pos.length / 3; pos.push((px - C[0]) * S, (C[1] - py) * S, z); uv.push((px - crop[0]) / crop[2], 1 - (py - crop[1]) / crop[3]); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = keep[j * (NX + 1) + i], b = keep[j * (NX + 1) + i + 1], c = keep[(j + 1) * (NX + 1) + i], d = keep[(j + 1) * (NX + 1) + i + 1]; if (a < 0 || b < 0 || c < 0 || d < 0) continue; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// 가죽: 어두운 바탕에 잔주름과 큰 구김
function leatherTex() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { const a = Math.random() * 512, b = Math.random() * 512, v = Math.random() < 0.5 ? 30 : 215; x.strokeStyle = `rgba(${v},${v},${v},.1)`; x.lineWidth = 0.6 + Math.random() * 1.1; x.beginPath(); x.moveTo(a, b); x.bezierCurveTo(a + rs(14), b + rs(14), a + rs(22), b + rs(22), a + rs(30), b + rs(30)); x.stroke(); }
  for (let i = 0; i < 46; i++) { const a = Math.random() * 512, b = Math.random() * 512, l = 60 + Math.random() * 160; x.strokeStyle = `rgba(20,20,20,.34)`; x.lineWidth = 2 + Math.random() * 4; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + rs(50), b + l * 0.5, a + rs(40), b + l); x.stroke(); x.strokeStyle = `rgba(240,240,240,.14)`; x.lineWidth = 2; x.beginPath(); x.moveTo(a + 4, b); x.quadraticCurveTo(a + 4 + rs(50), b + l * 0.5, a + 4 + rs(40), b + l); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.anisotropy = 4; return t;
}
const rs = n => (Math.random() - 0.5) * 2 * n;
function hairTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#c9c9c9"; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { const y = Math.random() * 256, a = Math.random() * 256, l = 40 + Math.random() * 130, v = 150 + Math.random() * 105; x.strokeStyle = `rgba(${v},${v},${v},.5)`; x.lineWidth = 0.7 + Math.random() * 1.5; x.beginPath(); x.moveTo(a, y); x.quadraticCurveTo(a + l * 0.5, y + (Math.random() - 0.5) * 16, a + l, y + (Math.random() - 0.5) * 22); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); return t; }
function shoeGeos() {
  const prof = [[-0.08, 0.034], [-0.07, 0.046], [-0.04, 0.05], [0.0, 0.048], [0.05, 0.054], [0.1, 0.058], [0.15, 0.054], [0.19, 0.044], [0.22, 0.026], [0.235, 0.008]];
  const hw = z => { for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) { const [z0, w0] = prof[i - 1], [z1, w1] = prof[i]; return w0 + (w1 - w0) * (z - z0) / (z1 - z0); } return 0.006; };
  const sh = new THREE.Shape(), pts = []; for (const [z, w] of prof) pts.push([w, -z]); for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], -prof[i][0]]); pts.forEach(([a, b], i) => (i ? sh.lineTo(a * 1.06, b * 1.03) : sh.moveTo(a * 1.06, b * 1.03)));
  const sole = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 }); sole.rotateX(-Math.PI / 2); sole.translate(0, -0.08 + 0.003, 0);
  const hgt = z => (z < 0.02 ? 0.11 : z < 0.13 ? 0.11 - ((z - 0.02) / 0.11) * 0.05 : 0.06 - ((z - 0.13) / 0.105) * 0.028), rings = [], N = 18, top = -0.062;
  for (let i = 0; i <= 30; i++) { const z = -0.08 + (i / 30) * 0.315, e = Math.sqrt(Math.max(0.0004, Math.min(1, (z + 0.08) / 0.016, (0.235 - z) / 0.03))); rings.push({ z, w: Math.max(0.0006, hw(z) - 0.002) * e, h: hgt(z) * (0.55 + 0.45 * e) }); }
  const pos = [], idx = []; rings.forEach(({ z, w, h }) => { for (let j = 0; j <= N; j++) { const a = (j / N) * Math.PI, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.4; pos.push(Math.sign(c) * Math.pow(Math.abs(c), e) * w, top + Math.pow(s, e) * h, z); } });
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < N; j++) { const a = k * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const up = new THREE.BufferGeometry(); up.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); up.setIndex(idx); up.computeVertexNormals(); return { sole, up };
}

export async function buildElon({ hands }) {
  const root = new THREE.Group(), load = u => new THREE.TextureLoader().loadAsync(u).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
  const [tA, tB, tTee] = await Promise.all([load(FACES.a.url), load(FACES.b.url), load(urlTee)]), faceT = { a: tA, b: tB };
  const lea = leatherTex(), weave = noiseTex(128, 12, 22, 0.8);
  const leather = (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0x241b16, roughness: 0.44, metalness: 0.05, bumpMap: lea, bumpScale: 1.5, roughnessMap: lea, clearcoat: 0.3, clearcoatRoughness: 0.42, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x6a5a50), ...o });
  const M = { jacket: leather(), collar: leather({ color: 0x1a1411 }), tee: new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.92, bumpMap: weave, bumpScale: 0.2 }), jeans: new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.82, bumpMap: weave, bumpScale: 0.4 }),
    skin: new THREE.MeshPhysicalMaterial({ color: 0xe6ab90, roughness: 0.5, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xff9a78), clearcoat: 0.08, bumpMap: noiseTex(256, 6, 26, 0.9), bumpScale: 0.25, emissive: 0x70402c, emissiveIntensity: 0.28 }),
    neck: new THREE.MeshStandardMaterial({ color: 0xd19a7e, roughness: 0.6, emissive: 0x6a3c2a, emissiveIntensity: 0.3 }), shoe: new THREE.MeshPhysicalMaterial({ color: 0x0c0a09, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }), sole: new THREE.MeshStandardMaterial({ color: 0x060505, roughness: 0.8 }), zip: new THREE.MeshStandardMaterial({ color: 0x34343a, roughness: 0.32, metalness: 0.85 }) };
  // ── 뼈 ──
  const B = {}; BN.forEach(n => { const b = new THREE.Bone(); b.name = n; B[n] = b; });
  BN.forEach(n => { const [par, off] = REST[n]; B[n].position.copy(off); if (par) B[par].add(B[n]); });
  const restW = {}; { const acc = n => { const [par, off] = REST[n]; return par ? acc(par).add(off) : off.clone(); }; BN.forEach(n => (restW[n] = acc(n))); }
  // ── 재킷 몸통 (허리에서 끝나는 짧은 가죽 재킷) ──
  const JK = [[1.54, 0.085, 0.085, 0.006], [1.515, 0.15, 0.098, 0.002], [1.485, 0.196, 0.11, -0.004], [1.45, 0.222, 0.122, -0.006], [1.4, 0.228, 0.134, 0], [1.33, 0.224, 0.142, 0.01], [1.25, 0.216, 0.146, 0.016], [1.15, 0.212, 0.146, 0.016], [1.05, 0.216, 0.142, 0.012], [0.96, 0.222, 0.138, 0.008], [0.915, 0.222, 0.132, 0.004], [0.905, 0.2, 0.116, 0], [0.9, 0.03, 0.03, 0]];
  const NJ = 2.3, ringAt = y => { let i = 0; while (i < JK.length - 2 && y < JK[i + 1][0]) i++; const a = JK[i], b = JK[i + 1], t = clamp((a[0] - y) / (a[0] - b[0]), 0, 1); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; };
  const zS = (x, y) => { const [ax, az, zo] = ringAt(y); return zo + az * Math.pow(Math.max(0, 1 - Math.pow(Math.min(Math.abs(x) / ax, 1), NJ)), 1 / NJ); };
  const torsoW = p => { const y = p.y, ax = Math.abs(p.x), side = p.x > 0 ? "L" : "R"; let w;
    if (y < 1.03) w = [[BI.hips, 1]]; else if (y < 1.2) w = mix(BI.hips, BI.spine, sm((y - 1.03) / 0.17)); else if (y < 1.37) w = mix(BI.spine, BI.chest, sm((y - 1.2) / 0.17)); else if (y < 1.5) w = [[BI.chest, 1]]; else w = mix(BI.chest, BI.neck, sm((y - 1.5) / 0.04) * 0.4);
    const sh = sm((ax - 0.13) / 0.09) * sm((y - 1.33) / 0.1) * 0.6; if (sh > 0) { w = w.map(q => [q[0], q[1] * (1 - sh)]); w.push([BI["arm" + side], sh]); } return w; };
  const legW = side => p => { const y = p.y, T = BI["thigh" + side], S = BI["shin" + side], F = BI["foot" + side]; if (y > 0.9) return mix(T, BI.hips, sm((y - 0.9) / 0.14) * 0.5); if (y > 0.57) return [[T, 1]]; if (y > 0.45) return mix(T, S, sm((0.57 - y) / 0.12)); if (y > 0.16) return [[S, 1]]; return mix(S, F, sm((0.16 - y) / 0.06) * 0.3); };
  const legR = x0 => vRings([[1.06, 0.11, 0.118, -0.01], [0.98, 0.12, 0.126, -0.012], [0.89, 0.114, 0.12, -0.006], [0.76, 0.1, 0.106, 0], [0.64, 0.09, 0.094, 0.004], [0.54, 0.084, 0.09, 0.006], [0.46, 0.082, 0.086, 0], [0.33, 0.08, 0.082, 0], [0.2, 0.08, 0.084, 0.004], [0.122, 0.088, 0.092, 0.012], [0.112, 0.082, 0.086, 0.012]], x0, 2.05);
  const armRings = (side, list) => { const s0 = restW["arm" + (side > 0 ? "L" : "R")], d = armDir(side), u = V(Math.cos(AO), Math.sin(AO) * side, 0).multiplyScalar(side > 0 ? 1 : -1); return list.map(([s, ax, az]) => ({ c: s0.clone().addScaledVector(d, s), a: d, u, ax, az, n: 2, s })); };
  const armW = side => p => { const S = side > 0 ? "L" : "R", s = p.clone().sub(restW["arm" + S]).dot(armDir(side)), A = BI["arm" + S], F = BI["fore" + S], H = BI["hand" + S]; if (s < 0.05) return mix(A, BI.chest, sm((0.05 - s) / 0.1) * 0.45); if (s < 0.27) return [[A, 1]]; if (s < 0.37) return mix(A, F, sm((s - 0.27) / 0.1)); if (s < 0.57) return [[F, 1]]; return mix(F, H, sm((s - 0.57) / 0.04) * 0.3); };
  const SLV = [[-0.08, 0.03, 0.03], [-0.066, 0.054, 0.054], [-0.03, 0.073, 0.073], [0.03, 0.08, 0.08], [0.11, 0.08, 0.078], [0.2, 0.077, 0.074], [0.31, 0.073, 0.07], [0.4, 0.068, 0.065], [0.49, 0.06, 0.057], [0.55, 0.054, 0.05], [0.578, 0.052, 0.048], [0.584, 0.04, 0.038]];
  const parts = [[tubeGeo(vRings(JK, 0, NJ), 40, torsoW), 0], [tubeGeo(legR(0.115), 22, legW("L")), 1], [tubeGeo(legR(-0.115), 22, legW("R")), 1], [tubeGeo(armRings(1, SLV), 20, armW(1)), 0], [tubeGeo(armRings(-1, SLV), 20, armW(-1)), 0]];
  // ── 앞판: 몸 표면을 따라 붙인 띠들 (티셔츠 · 지퍼 · 깃) · 몸통과 같은 뼈 가중치로 함께 휨 ──
  function patch(rows, off, mi, nx = 8, uvF) { const pos = [], uv = [], idx = [], si = [], sw = [];
    rows.forEach(([y, x0, x1]) => { for (let i = 0; i <= nx; i++) { const x = lerp(x0, x1, i / nx), p = V(x, y, zS(x, y) + off); pos.push(p.x, p.y, p.z); uvF ? uv.push(...uvF(x, y)) : uv.push(x * 8, y * 8); const w = torsoW(p).filter(q => q[1] > 0.001).sort((c, d) => d[1] - c[1]).slice(0, 4), tot = w.reduce((c, q) => c + q[1], 0) || 1; for (let j = 0; j < 4; j++) { si.push(w[j] ? w[j][0] : 0); sw.push(w[j] ? w[j][1] / tot : 0); } } });
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals(); parts.push([g, mi]); }
  const rowsOf = (y0, y1, n, f) => Array.from({ length: n + 1 }, (_, i) => { const y = lerp(y0, y1, i / n), [a, b] = f(y, i / n); return [y, a, b]; });
  const vHalf = y => lerp(0.1, 0.13, clamp((1.5 - y) / 0.5, 0, 1)) * (0.72 + 0.28 * clamp((1.53 - y) / 0.1, 0, 1));   // 재킷 앞섶이 벌어진 폭
  patch(rowsOf(1.53, 0.92, 24, y => [-vHalf(y) - 0.004, vHalf(y) + 0.004]), 0.0012, 2, 10);
  // 티셔츠 무늬 (사진에서 그대로)
  { const w = 0.092, y0 = 1.38, y1 = 1.13; patch(rowsOf(y0, y1, 10, () => [-w, w]), 0.0036, 3, 6, (x, y) => [(x + w) / (2 * w), (y - y1) / (y0 - y1)]); }
  for (const s of [-1, 1]) {
    // 깃: 목을 감싸고 앞으로 접힌 가죽
    patch(rowsOf(1.552, 1.46, 8, (y, u) => { const a = lerp(0.1, 0.156, Math.pow(u, 0.8)), b = lerp(0.062, 0.1, u); return s > 0 ? [b, a] : [-a, -b]; }), 0.012, 4, 5);
    // 지퍼
    patch(rowsOf(1.5, 0.92, 26, y => { const v = vHalf(y); return s > 0 ? [v - 0.002, v + 0.012] : [-v - 0.012, -v + 0.002]; }), 0.0048, 5, 2);
    // 가슴 절개선과 주머니
    patch(rowsOf(1.385, 1.378, 1, () => (s > 0 ? [0.14, 0.222] : [-0.222, -0.14])), 0.0034, 4, 6);
    patch(rowsOf(1.1, 1.02, 8, (y, u) => { const x = lerp(0.135, 0.195, u); return s > 0 ? [x, x + 0.012] : [-x - 0.012, -x]; }), 0.0032, 5, 2);
    // 허리단
    patch(rowsOf(0.945, 0.915, 2, () => (s > 0 ? [vHalf(0.93) + 0.01, 0.222] : [-0.222, -vHalf(0.93) - 0.01])), 0.0036, 4, 8);
  }
  const teeM = new THREE.MeshStandardMaterial({ map: tTee, roughness: 0.85, emissive: 0xffffff, emissiveMap: tTee, emissiveIntensity: 0.3 });
  const body = new THREE.SkinnedMesh(mergeGeometries(parts.map(p => p[0]), true), [M.jacket, M.jeans, M.tee, teeM, M.collar, M.zip]); body.geometry.groups.forEach((g, i) => (g.materialIndex = parts[i][1]));
  body.add(B.hips); body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(BN.map(n => B[n]))); body.castShadow = body.receiveShadow = true; body.frustumCulled = false; root.add(body);
  const mesh = (g, m, par, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.frustumCulled = false; par.add(o); return o; };
  // ── 신발 ──
  const SG = shoeGeos(); for (const S of ["L", "R"]) { const g = new THREE.Group(); B["foot" + S].add(g); mesh(SG.sole, M.sole, g); mesh(SG.up, M.shoe, g); }
  // ── 손 ──
  const HAND = [];
  hands.forEach((H, i) => { const side = i ? 1 : -1, S = side > 0 ? "L" : "R"; H.mesh.material = M.skin; H.mesh.castShadow = true;
    const orient = new THREE.Group(); orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    H.scene.position.copy(V().setFromMatrixPosition(H.restM.wrist)).negate(); orient.add(H.scene);
    const fr = new THREE.Group(), fd = armDir(-1), pn = V(Math.cos(AO), -Math.sin(AO), 0); fr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), fd, pn)); fr.add(orient);
    const holder = new THREE.Group(); holder.scale.setScalar(1.2); if (side > 0) holder.scale.x = -1.2; holder.add(fr); B["hand" + S].add(holder); HAND.push({ H, S, holder }); });
  const FIST = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] };
  const handOf = S => HAND.find(q => q.S === S);
  // curl: 네 손가락 굽힘 · thumb: 엄지 굽힘 · idx: 집게만 따로 (0이면 쭉 폄)
  function fingers(S, curl, thumb = curl * 0.6, idx = curl) { const h = handOf(S); if (!h) return;
    for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n], c = n === "index" ? idx : curl; h.H.setChain(n, [null, [f[0] * c, 0, 0], [f[1] * c, 0, 0], [f[2] * c, 0, 0]]); }
    h.H.setChain("thumb", [[-0.6 * thumb + 0.1, 0.3 * thumb - 0.15, 0], [-0.5 * thumb, 0, 0], [-0.6 * thumb, 0, 0]]); }
  // 엄지척: 네 손가락은 주먹, 엄지는 쭉 뻗어 위로
  function thumbUp(S, k = 1) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n]; h.H.setChain(n, [null, [f[0] * k, 0, 0], [f[1] * k, 0, 0], [f[2] * k, 0, 0]]); } h.H.setChain("thumb", [[0.2 * k, -0.38 * k, 0], [0.12 * k, 0, 0], [0.12 * k, 0, 0]]); }
  // 공 쥐기: 손가락을 벌려 둥글게 감쌈
  const SPREAD = { index: 0.2, middle: 0.04, ring: -0.1, pinky: -0.26 };
  function grip(S, k) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) h.H.setChain(n, [null, [-0.5 * k, SPREAD[n] * k, 0], [-0.62 * k, 0, 0], [-0.5 * k, 0, 0]]); h.H.setChain("thumb", [[-0.42 * k, 0.5 * k, 0], [-0.3 * k, 0, 0], [-0.32 * k, 0, 0]]); }

  // ── 머리: 사진 얼굴 둘 · 사진마다 맞춘 뒤통수 · 목 ──
  const HS = 1.2, headG = new THREE.Group(); headG.position.set(0, -0.058, 0.05); headG.scale.setScalar(HS); B.head.add(headG);
  const hairT = hairTex(), FG = {};
  for (const k of ["a", "b"]) { const F = FACES[k], g = new THREE.Group(), tx = faceT[k]; headG.add(g);
    const m = new THREE.MeshStandardMaterial({ map: tx, alphaMap: maskTex(F.P, F.crop, 1024, 2), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, color: 0x3c3c3c, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.76, roughness: 0.72, toneMapped: false });
    mesh(relief(F.P, F.crop, F.S, F.C, F.B, { nx: 88, ny: 110, R: 0.09, Z: 0.1, mar: 0.006 }), m, g);
    const [cx, cy, rx, ry, roll, rz, z0] = F.shell, sh = new THREE.SphereGeometry(1, 32, 22); sh.scale(rx, ry, rz); sh.rotateZ(roll); sh.translate((cx - F.C[0]) * F.S, (F.C[1] - cy) * F.S, z0 - 0.018);
    mesh(sh, new THREE.MeshStandardMaterial({ color: F.hair, map: hairT, bumpMap: hairT, bumpScale: 0.5, roughness: 0.62 }), g);
    g.visible = false; FG[k] = { g, m }; }
  const neckM = mesh(new THREE.CylinderGeometry(0.074, 0.092, 0.16, 24), M.neck, B.neck); neckM.position.y = 0.012;
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  let cur = null; function show(k) { if (cur === k) return; cur = k; for (const n in FG) FG[n].g.visible = k === "all" || n === k; }
  function tint(c, k) { for (const n in FG) FG[n].m.emissive.setRGB(1, 1, 1).lerp(c, k); }

  // ── 자세 도구 (root 기준 · 미터) ──
  const qRoot = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), rootInv = new THREE.Matrix4();
  const posOf = (bone, out = V()) => out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(rootInv);
  const quatOf = (obj, out = new THREE.Quaternion()) => { obj.getWorldQuaternion(out); return out.premultiply(qRoot.clone().invert()); };
  function begin() { BN.forEach(n => { B[n].position.copy(REST[n][1]); B[n].quaternion.identity(); }); sync(); }
  function sync() { root.updateMatrixWorld(true); rootInv.copy(root.matrixWorld).invert(); root.getWorldQuaternion(qRoot); }
  function aim(bone, rest, dir) { const pq = quatOf(bone.parent, tmpQ), d = dir.clone().applyQuaternion(pq.invert()).normalize(); bone.quaternion.setFromUnitVectors(rest.clone().normalize(), d); bone.updateMatrixWorld(true); }
  function ik(a, b, end, target, pole) { const Ap = posOf(a), l1 = REST[b.name][1].length(), l2 = REST[end.name][1].length(), T = target.clone(), dv = T.clone().sub(Ap); let d = dv.length(); const dir = dv.normalize();
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995); const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)), pv = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E = Ap.clone().addScaledVector(dir, x).addScaledVector(pv, h), Tc = Ap.clone().addScaledVector(dir, d); aim(a, REST[b.name][1], E.clone().sub(Ap)); aim(b, REST[end.name][1], Tc.sub(E)); }
  function leg(S, ankle, pitch = 0, yaw = 0, knee = V(0, 0, 1)) { ik(B["thigh" + S], B["shin" + S], B["foot" + S], ankle, knee); const want = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")), pq = quatOf(B["shin" + S], tmpQ); B["foot" + S].quaternion.copy(pq.invert().multiply(want)); B["foot" + S].updateMatrixWorld(true); }
  function arm(S, wrist, pole, hq) { ik(B["arm" + S], B["fore" + S], B["hand" + S], wrist, pole); if (hq) { const pq = quatOf(B["fore" + S], tmpQ); B["hand" + S].quaternion.copy(pq.invert().multiply(hq)); B["hand" + S].updateMatrixWorld(true); } }
  const setE = (n, x = 0, y = 0, z = 0) => B[n].quaternion.setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
  // 손의 방향: F 손가락이 뻗는 쪽, N 손바닥이 보는 쪽 (root 기준) → arm()에 넘길 회전
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  function handQ(S, F, N, out = new THREE.Quaternion()) { const side = S === "L" ? 1 : -1, f0 = armDir(side), n0 = V(-side * Math.cos(AO), -Math.sin(AO), 0), t0 = f0.clone().cross(n0), f = F.clone().normalize(), n = N.clone().addScaledVector(f, -N.dot(f)).normalize(), t = f.clone().cross(n); mA.makeBasis(f0, n0, t0).invert(); mB.makeBasis(f, n, t); return out.setFromRotationMatrix(mB.multiply(mA)); }
  // 손바닥 한가운데 (월드 좌표) · 공을 놓을 자리
  const palmAt = (S, out = V()) => { const h = handOf(S).H.bones; const a = h["middle-finger-phalanx-proximal"].getWorldPosition(V()), b = h["wrist"].getWorldPosition(V()); return out.copy(a).lerp(b, 0.3); };
  const tipOf = (S, name, out = V()) => handOf(S).H.bones[name].getWorldPosition(out);
  return { HS, root, B, M, begin, sync, ik, leg, arm, setE, fingers, thumbUp, grip, handQ, palmAt, tipOf, posOf, quatOf, show, tint, headG, restW, HAND };
}
