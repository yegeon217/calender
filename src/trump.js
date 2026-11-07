// 관세 연출의 인물: 머리는 받은 사진 세 장(춤 · 진지 · 우)을 그대로 입힌 입체 얼굴, 몸은 곤색 양복 · 흰 셔츠 · 긴 빨간 넥타이 · 국기 배지를 직접 만든 것.
// 얼굴: 사진 윤곽을 부풀린 면에 코·눈두덩·볼·입 굴곡을 더하고 사진을 앞에서 그대로 비춤. 뒤통수는 사진마다 따로 막음.
// 넥타이는 줄처럼 움직임: 춤추면 출렁이고, 거꾸로 박히면 아래로 쏟아짐.
// 단위는 미터 (위 +y, 앞 +z, 사람의 왼쪽 +x).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tubeGeo, vRings, mix, sm } from "./runner.js";
import { noiseTex } from "./fx-util.js";
import urlD from "./assets/tr-d.webp?url";
import urlS from "./assets/tr-s.webp?url";
import urlU from "./assets/tr-u.webp?url";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const AO = 0.16, armDir = side => V(Math.sin(AO) * side, -Math.cos(AO), 0);
const BN = ["hips", "spine", "chest", "neck", "head", "armL", "foreL", "handL", "armR", "foreR", "handR", "thighL", "shinL", "footL", "thighR", "shinR", "footR"];
const REST = {
  hips: [null, V(0, 0.98, 0)], spine: ["hips", V(0, 0.13, 0)], chest: ["spine", V(0, 0.22, 0)], neck: ["chest", V(0, 0.19, 0.012)], head: ["neck", V(0, 0.05, 0.012)],
  armL: ["chest", V(0.212, 0.11, -0.008)], foreL: ["armL", armDir(1).multiplyScalar(0.32)], handL: ["foreL", armDir(1).multiplyScalar(0.28)],
  armR: ["chest", V(-0.212, 0.11, -0.008)], foreR: ["armR", armDir(-1).multiplyScalar(0.32)], handR: ["foreR", armDir(-1).multiplyScalar(0.28)],
  thighL: ["hips", V(0.115, -0.05, 0)], shinL: ["thighL", V(0, -0.45, 0)], footL: ["shinL", V(0, -0.4, 0)],
  thighR: ["hips", V(-0.115, -0.05, 0)], shinR: ["thighR", V(0, -0.45, 0)], footR: ["shinR", V(0, -0.4, 0)],
};
const BI = Object.fromEntries(BN.map((n, i) => [n, i]));

// ── 사진 자료 (좌표는 원본 사진 픽셀) ──
const FACES = {
  d: { url: urlD, crop: [490, 45, 390, 480], S: 0.00071, C: [748, 462], hair: 0x8e7a63, shell: [680, 270, 0.1, 0.122, 0.36, 0.11, 0],
    P: [[517,150],[534,140],[565,124],[600,107],[625,99],[650,87],[680,77],[705,69],[735,68],[760,76],[776,92],[786,112],[790,132],[796,150],[810,178],[824,205],[836,232],[846,256],[856,300],[853,325],[842,338],[840,362],[841,392],[839,420],[830,442],[816,470],[790,492],[760,505],[725,505],[690,495],[655,478],[630,455],[618,440],[603,430],[590,412],[575,392],[556,362],[549,338],[539,325],[530,290],[520,255],[514,220],[512,178]],
    B: [[705, 292, 27, 32, 0.032], [700, 240, 14, 48, 0.014], [692, 180, 100, 30, 0.008], [640, 266, 32, 15, -0.011], [752, 224, 32, 15, -0.011], [742, 370, 44, 42, -0.012], [752, 438, 52, 24, 0.012], [628, 345, 48, 60, 0.016], [806, 320, 38, 60, 0.015], [690, 120, 120, 34, 0.006]] },
  s: { url: urlS, crop: [30, 12, 180, 230], S: 0.00138, C: [133, 226], hair: 0xb39368, shell: [120, 122, 0.098, 0.122, 0, 0.11, 0],
    P: [[45,82.5],[47.5,62.5],[51,47.5],[60,37.5],[72.5,30],[85,25],[105,23],[130,23],[147.5,24.5],[160,31],[170,41],[185,46],[195,57.5],[199,75],[199,95],[196,115],[195,135],[190,150],[187.5,160],[182.5,182.5],[176,202.5],[170,212.5],[155,222.5],[140,227.5],[130,230],[115,227.5],[102.5,218.75],[92.5,207.5],[84,190],[79,172.5],[70,168.75],[62.5,162.5],[56,145],[51,127.5],[45,117.5],[41,100],[42.5,85]],
    B: [[135, 165, 11, 14, 0.03], [133, 138, 6, 22, 0.014], [133, 117, 48, 7, 0.008], [106, 134, 13, 6, -0.011], [159, 130, 13, 6, -0.011], [134, 194, 17, 7, 0.01], [135, 216, 22, 9, 0.012], [95, 175, 17, 22, 0.014], [172, 170, 15, 22, 0.014], [120, 60, 62, 18, 0.008]] },
  u: { url: urlU, crop: [610, 10, 640, 745], S: 0.00042, C: [905, 712], hair: 0xc6a778, shell: [965, 365, 0.112, 0.128, 0, 0.115, -0.022],
    P: [[627,223],[640,170],[663,127],[697,100],[743,73],[797,50],[850,33],[910,27],[983,25],[1037,33],[1077,57],[1092,85],[1115,115],[1140,140],[1165,175],[1192,210],[1215,262],[1228,340],[1222,425],[1198,475],[1172,500],[1163,560],[1148,620],[1100,680],[1050,715],[990,735],[930,738],[870,722],[815,708],[780,680],[760,630],[740,563],[720,523],[700,463],[693,410],[677,383],[650,303],[633,263]],
    B: [[793, 438, 44, 54, 0.036], [775, 360, 24, 74, 0.015], [723, 350, 34, 17, -0.011], [900, 303, 44, 20, -0.012], [832, 545, 56, 42, 0.024], [846, 660, 70, 44, 0.012], [990, 470, 110, 120, 0.018], [716, 468, 24, 40, 0.006], [870, 180, 190, 60, 0.01]] },
};

function maskTex(poly, crop, res, blur) {
  const c = document.createElement("canvas"), k = res / Math.max(crop[2], crop[3]); c.width = Math.round(crop[2] * k); c.height = Math.round(crop[3] * k); const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.filter = `blur(${blur}px)`; x.fillStyle = "#fff"; x.beginPath();
  poly.forEach(([a, b], i) => { const u = (a - crop[0]) * k, v = (b - crop[1]) * k; i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill(); x.strokeStyle = "#000"; x.lineWidth = 5 * k * (crop[2] > 300 ? 1 : 0.5); x.lineJoin = "round"; x.stroke();
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

function fabricTex(base) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  const im = x.getImageData(0, 0, 256, 256), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function tieTex() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#a80c18"; x.fillRect(0, 0, 128, 128); x.strokeStyle = "rgba(60,0,6,.45)"; x.lineWidth = 2.2; for (let i = -128; i < 256; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function flagTex() { const c = document.createElement("canvas"); c.width = 96; c.height = 60; const x = c.getContext("2d"); for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? "#f4f4f4" : "#c8102e"; x.fillRect(0, (i * 60) / 13, 96, 60 / 13 + 0.6); } x.fillStyle = "#1d2f6f"; x.fillRect(0, 0, 42, 32); x.fillStyle = "#fff"; for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) x.fillRect(4 + i * 6.3 + (j % 2) * 2, 3 + j * 6, 2, 2); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// 빗어 넘긴 머리결 (뒤통수·정수리에 씀)
function hairTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#c9c9c9"; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { const y = Math.random() * 256, a = Math.random() * 256, l = 40 + Math.random() * 130, v = 150 + Math.random() * 105; x.strokeStyle = `rgba(${v},${v},${v},.5)`; x.lineWidth = 0.7 + Math.random() * 1.5; x.beginPath(); x.moveTo(a, y); x.quadraticCurveTo(a + l * 0.5, y + (Math.random() - 0.5) * 16, a + l, y + (Math.random() - 0.5) * 22); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); return t; }
function shoeGeos() {
  const prof = [[-0.08, 0.034], [-0.07, 0.046], [-0.04, 0.05], [0.0, 0.048], [0.05, 0.054], [0.1, 0.058], [0.15, 0.054], [0.19, 0.044], [0.22, 0.026], [0.235, 0.008]];
  const hw = z => { for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) { const [z0, w0] = prof[i - 1], [z1, w1] = prof[i]; return w0 + (w1 - w0) * (z - z0) / (z1 - z0); } return 0.006; };
  const sh = new THREE.Shape(), pts = []; for (const [z, w] of prof) pts.push([w, -z]); for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], -prof[i][0]]); pts.forEach(([a, b], i) => (i ? sh.lineTo(a * 1.06, b * 1.03) : sh.moveTo(a * 1.06, b * 1.03)));
  const sole = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 }); sole.rotateX(-Math.PI / 2); sole.translate(0, -0.08 + 0.003, 0);
  const hgt = z => (z < 0.02 ? 0.085 : z < 0.13 ? 0.085 - ((z - 0.02) / 0.11) * 0.03 : 0.055 - ((z - 0.13) / 0.105) * 0.025), rings = [], N = 18, top = -0.062;
  for (let i = 0; i <= 30; i++) { const z = -0.08 + (i / 30) * 0.315, e = Math.sqrt(Math.max(0.0004, Math.min(1, (z + 0.08) / 0.016, (0.235 - z) / 0.03))); rings.push({ z, w: Math.max(0.0006, hw(z) - 0.002) * e, h: hgt(z) * (0.55 + 0.45 * e) }); }
  const pos = [], idx = []; rings.forEach(({ z, w, h }) => { for (let j = 0; j <= N; j++) { const a = (j / N) * Math.PI, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.4; pos.push(Math.sign(c) * Math.pow(Math.abs(c), e) * w, top + Math.pow(s, e) * h, z); } });
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < N; j++) { const a = k * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const up = new THREE.BufferGeometry(); up.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); up.setIndex(idx); up.computeVertexNormals(); return { sole, up };
}

export async function buildTrump({ hands }) {
  const root = new THREE.Group(), load = u => new THREE.TextureLoader().loadAsync(u).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
  const texs = await Promise.all(["d", "s", "u"].map(k => load(FACES[k].url)));
  const suitT = fabricTex("#1b2342"); suitT.repeat.set(5, 3);
  const weave = noiseTex(128, 12, 22, 0.8);
  const cloth = (map, o = {}) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.66, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x5f6c98), bumpMap: weave, bumpScale: 0.22, ...o });
  const M = { suit: cloth(suitT), lapel: cloth(fabricTex("#161d38"), { roughness: 0.6, sheen: 0.3 }), shirt: new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.6, bumpMap: weave, bumpScale: 0.1 }), tie: new THREE.MeshStandardMaterial({ map: tieTex(), roughness: 0.78, envMapIntensity: 0.18, side: THREE.DoubleSide }),
    skin: new THREE.MeshPhysicalMaterial({ color: 0xe0a273, roughness: 0.5, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xff9a78), clearcoat: 0.08, bumpMap: noiseTex(256, 6, 26, 0.9), bumpScale: 0.25 }),
    neck: new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.6 }), shoe: new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 }), sole: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.7 }), btn: new THREE.MeshStandardMaterial({ color: 0x10131f, roughness: 0.3, metalness: 0.2 }) };
  // ── 뼈 ──
  const B = {}; BN.forEach(n => { const b = new THREE.Bone(); b.name = n; B[n] = b; });
  BN.forEach(n => { const [par, off] = REST[n]; B[n].position.copy(off); if (par) B[par].add(B[n]); });
  const restW = {}; { const acc = n => { const [par, off] = REST[n]; return par ? acc(par).add(off) : off.clone(); }; BN.forEach(n => (restW[n] = acc(n))); }
  // ── 윗도리 몸통 (넓은 어깨 · 나온 배 · 길게 내려오는 자락) ──
  const JK = [[1.54, 0.09, 0.09, 0.006], [1.515, 0.158, 0.1, 0.002], [1.485, 0.205, 0.114, -0.004], [1.45, 0.235, 0.128, -0.006], [1.4, 0.242, 0.146, 0], [1.33, 0.238, 0.168, 0.016], [1.25, 0.236, 0.188, 0.03], [1.15, 0.246, 0.208, 0.046], [1.05, 0.256, 0.214, 0.05], [0.96, 0.254, 0.202, 0.036], [0.88, 0.25, 0.184, 0.02], [0.8, 0.246, 0.168, 0.01], [0.79, 0.222, 0.144, 0], [0.78, 0.03, 0.03, 0]];
  const NJ = 2.3, ringAt = y => { let i = 0; while (i < JK.length - 2 && y < JK[i + 1][0]) i++; const a = JK[i], b = JK[i + 1], t = clamp((a[0] - y) / (a[0] - b[0]), 0, 1); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; };
  const zS = (x, y) => { const [ax, az, zo] = ringAt(y); return zo + az * Math.pow(Math.max(0, 1 - Math.pow(Math.min(Math.abs(x) / ax, 1), NJ)), 1 / NJ); };
  const torsoW = p => { const y = p.y, ax = Math.abs(p.x), side = p.x > 0 ? "L" : "R"; let w;
    if (y < 1.03) w = [[BI.hips, 1]]; else if (y < 1.2) w = mix(BI.hips, BI.spine, sm((y - 1.03) / 0.17)); else if (y < 1.37) w = mix(BI.spine, BI.chest, sm((y - 1.2) / 0.17)); else if (y < 1.5) w = [[BI.chest, 1]]; else w = mix(BI.chest, BI.neck, sm((y - 1.5) / 0.04) * 0.4);
    const sh = sm((ax - 0.135) / 0.09) * sm((y - 1.33) / 0.1) * 0.6; if (sh > 0) { w = w.map(q => [q[0], q[1] * (1 - sh)]); w.push([BI["arm" + side], sh]); } return w; };
  const legW = side => p => { const y = p.y, T = BI["thigh" + side], S = BI["shin" + side], F = BI["foot" + side]; if (y > 0.9) return mix(T, BI.hips, sm((y - 0.9) / 0.14) * 0.5); if (y > 0.57) return [[T, 1]]; if (y > 0.45) return mix(T, S, sm((0.57 - y) / 0.12)); if (y > 0.16) return [[S, 1]]; return mix(S, F, sm((0.16 - y) / 0.06) * 0.3); };
  const legR = x0 => vRings([[1.06, 0.11, 0.118, -0.01], [0.98, 0.12, 0.128, -0.012], [0.89, 0.116, 0.122, -0.006], [0.76, 0.102, 0.108, 0], [0.64, 0.094, 0.098, 0.004], [0.54, 0.09, 0.094, 0.006], [0.46, 0.088, 0.092, 0], [0.33, 0.086, 0.09, 0], [0.2, 0.088, 0.092, 0.004], [0.122, 0.094, 0.1, 0.012], [0.112, 0.088, 0.092, 0.012]], x0, 2.05);
  const armRings = (side, list) => { const s0 = restW["arm" + (side > 0 ? "L" : "R")], d = armDir(side), u = V(Math.cos(AO), Math.sin(AO) * side, 0).multiplyScalar(side > 0 ? 1 : -1); return list.map(([s, ax, az]) => ({ c: s0.clone().addScaledVector(d, s), a: d, u, ax, az, n: 2, s })); };
  const armW = side => p => { const S = side > 0 ? "L" : "R", s = p.clone().sub(restW["arm" + S]).dot(armDir(side)), A = BI["arm" + S], F = BI["fore" + S], H = BI["hand" + S]; if (s < 0.05) return mix(A, BI.chest, sm((0.05 - s) / 0.1) * 0.45); if (s < 0.27) return [[A, 1]]; if (s < 0.37) return mix(A, F, sm((s - 0.27) / 0.1)); if (s < 0.57) return [[F, 1]]; return mix(F, H, sm((s - 0.57) / 0.04) * 0.3); };
  const SLV = [[-0.08, 0.03, 0.03], [-0.066, 0.054, 0.054], [-0.03, 0.073, 0.073], [0.03, 0.08, 0.08], [0.11, 0.08, 0.078], [0.2, 0.077, 0.074], [0.31, 0.073, 0.07], [0.4, 0.068, 0.065], [0.49, 0.062, 0.059], [0.55, 0.058, 0.055], [0.57, 0.056, 0.053], [0.576, 0.042, 0.042]], CUF = [[0.55, 0.05, 0.048], [0.598, 0.049, 0.047], [0.604, 0.04, 0.038]];
  const parts = [[tubeGeo(vRings(JK, 0, NJ), 40, torsoW), 0], [tubeGeo(legR(0.115), 22, legW("L")), 0], [tubeGeo(legR(-0.115), 22, legW("R")), 0], [tubeGeo(armRings(1, SLV), 20, armW(1)), 0], [tubeGeo(armRings(-1, SLV), 20, armW(-1)), 0], [tubeGeo(armRings(1, CUF), 16, armW(1)), 1], [tubeGeo(armRings(-1, CUF), 16, armW(-1)), 1]];
  const body = new THREE.SkinnedMesh(mergeGeometries(parts.map(p => p[0]), true), [M.suit, M.shirt]); body.geometry.groups.forEach((g, i) => (g.materialIndex = parts[i][1]));
  body.add(B.hips); body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(BN.map(n => B[n]))); body.castShadow = body.receiveShadow = true; body.frustumCulled = false; root.add(body);
  const mesh = (g, m, par, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.frustumCulled = false; par.add(o); return o; };
  // ── 앞판: 몸 표면을 따라 붙인 띠들 (셔츠 · 깃 · 라펠 · 주머니) ──
  const chestY = restW.chest, spineY = restW.spine;
  function patch(rows, off, ref, nx = 8, uvs = 1) { const pos = [], uv = [], idx = [];
    rows.forEach(([y, x0, x1]) => { for (let i = 0; i <= nx; i++) { const x = lerp(x0, x1, i / nx); pos.push(x - ref.x, y - ref.y, zS(x, y) + off - ref.z); uv.push(x * uvs * 8, y * uvs * 8); } });
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
  const rowsOf = (y0, y1, n, f) => Array.from({ length: n + 1 }, (_, i) => { const y = lerp(y0, y1, i / n), [a, b] = f(y, i / n); return [y, a, b]; });
  const vHalf = y => 0.098 * Math.pow(clamp((y - 1.1) / 0.43, 0, 1), 1.1);   // 앞섶이 벌어진 폭
  mesh(patch(rowsOf(1.53, 1.1, 14, y => [-vHalf(y) - 0.004, vHalf(y) + 0.004]), 0.0012, chestY, 10), M.shirt, B.chest);
  mesh(patch(rowsOf(1.5, 1.462, 3, (y, u) => { const w = lerp(0.03, 0.022, u); return [-w, w]; }), 0.013, chestY, 4, 1.2), M.tie, B.chest);   // 매듭
  for (const s of [-1, 1]) {
    mesh(patch(rowsOf(1.535, 1.44, 8, (y, u) => { const a = lerp(0.108, 0.08, Math.pow(u, 1.3)), b = lerp(0.014, 0.074, Math.pow(u, 0.8)); return s > 0 ? [b, a] : [-a, -b]; }), 0.0095, chestY, 4), M.shirt, B.chest);   // 셔츠 깃
    mesh(patch(rowsOf(1.5, 1.1, 22, (y, u) => { const inX = vHalf(y), wTop = y > 1.42 ? lerp(0.05, 0.066, (1.5 - y) / 0.08) : lerp(0.098, 0.008, Math.pow((1.42 - y) / 0.32, 1.1)); return s > 0 ? [inX, inX + wTop] : [-inX - wTop, -inX]; }), 0.0052, chestY, 5), M.lapel, B.chest);   // 라펠
    mesh(patch(rowsOf(1.03, 0.985, 2, () => (s > 0 ? [0.085, 0.24] : [-0.24, -0.085])), 0.0048, spineY, 8), M.lapel, B.spine);   // 앞주머니 덮개
  }
  mesh(patch(rowsOf(1.1, 0.8, 16, (y, u) => { const c = -0.012 - 0.1 * Math.pow(u, 2.2); return [c - 0.0022, c + 0.0022]; }), 0.0048, spineY, 2), M.btn, B.spine);   // 여민 선
  for (const y of [1.08, 0.98]) { const b = mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.006, 16).rotateX(Math.PI / 2), M.btn, B.spine); b.position.set(0.015 - spineY.x, y - spineY.y, zS(0.015, y) + 0.008 - spineY.z); }
  for (const S of ["L", "R"]) for (let i = 0; i < 3; i++) { const b = mesh(new THREE.SphereGeometry(0.0078, 10, 8), M.btn, B["fore" + S]); const d = armDir(S === "L" ? 1 : -1); b.position.copy(d).multiplyScalar(0.21 + i * 0.021).add(V(0, 0, -0.056)); }
  // 국기 배지 (왼쪽 가슴)
  { const f = mesh(new THREE.PlaneGeometry(0.036, 0.023), new THREE.MeshStandardMaterial({ map: flagTex(), roughness: 0.3, metalness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.25 }), B.chest, false); f.material.emissiveMap = f.material.map; f.position.set(0.15, 1.4 - chestY.y, zS(0.15, 1.4) + 0.012); f.rotation.set(-0.12, 0.42, 0.12); }
  // ── 구두 ──
  const SG = shoeGeos(); for (const S of ["L", "R"]) { const g = new THREE.Group(); B["foot" + S].add(g); mesh(SG.sole, M.sole, g); mesh(SG.up, M.shoe, g); }
  // ── 손 ──
  const HAND = [];
  hands.forEach((H, i) => { const side = i ? 1 : -1, S = side > 0 ? "L" : "R"; H.mesh.material = M.skin; H.mesh.castShadow = true;
    const orient = new THREE.Group(); orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    H.scene.position.copy(V().setFromMatrixPosition(H.restM.wrist)).negate(); orient.add(H.scene);
    const fr = new THREE.Group(), fd = armDir(-1), pn = V(Math.cos(AO), -Math.sin(AO), 0); fr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), fd, pn)); fr.add(orient);
    const holder = new THREE.Group(); holder.scale.setScalar(1.2); if (side > 0) holder.scale.x = -1.2; holder.add(fr); B["hand" + S].add(holder); HAND.push({ H, S, holder }); });
  const FIST = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] };
  function fingers(S, curl, thumb = curl * 0.6, idx = curl) { const h = HAND.find(q => q.S === S); if (!h) return;
    for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n], c = n === "index" ? idx : curl; h.H.setChain(n, [null, [f[0] * c, 0, 0], [f[1] * c, 0, 0], [f[2] * c, 0, 0]]); }
    h.H.setChain("thumb", [[-0.6 * thumb + 0.1, 0.3 * thumb - 0.15, 0], [-0.5 * thumb, 0, 0], [-0.6 * thumb, 0, 0]]); }

  // ── 머리: 사진 얼굴 셋 · 사진마다 맞춘 뒤통수 · 목 ──
  const HS = 1.24, headG = new THREE.Group(); headG.position.set(0, -0.092, 0.05); headG.scale.setScalar(HS); B.head.add(headG);
  const hairT = hairTex(), FG = {};
  ["d", "s", "u"].forEach((k, i) => { const F = FACES[k], g = new THREE.Group(); headG.add(g);
    const m = new THREE.MeshStandardMaterial({ map: texs[i], alphaMap: maskTex(F.P, F.crop, 1024, 2), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, color: 0x8a8a8a, emissive: 0xffffff, emissiveMap: texs[i], emissiveIntensity: 0.62, roughness: 0.72, toneMapped: false });
    const f = mesh(relief(F.P, F.crop, F.S, F.C, F.B, { nx: 88, ny: 110, R: 0.09, Z: 0.1, mar: 0.006 }), m, g);
    const [cx, cy, rx, ry, roll, rz, z0] = F.shell, sh = new THREE.SphereGeometry(1, 32, 22); sh.scale(rx, ry, rz); sh.rotateZ(roll); sh.translate((cx - F.C[0]) * F.S, (F.C[1] - cy) * F.S, z0 - 0.018);
    mesh(sh, new THREE.MeshStandardMaterial({ color: F.hair, map: hairT, bumpMap: hairT, bumpScale: 0.5, roughness: 0.62 }), g);
    g.visible = false; FG[k] = { g, m }; });
  const neckM = mesh(new THREE.CylinderGeometry(0.086, 0.098, 0.09, 24), M.neck, B.neck); neckM.position.y = -0.02;
  // ── 넥타이: 줄 하나 (매듭 아래부터 바지 앞까지 길게) ──
  const TN = 10, TLEN = 0.6, tieSeg = TLEN / TN, TP = Array.from({ length: TN + 1 }, () => ({ p: V(), o: V() }));
  const tieG = new THREE.BufferGeometry(), tieW = i => (i === TN ? 0 : lerp(0.024, 0.047, Math.pow(i / (TN - 1), 0.8))), tPos = new Float32Array((TN + 1) * 3 * 3), tUv = new Float32Array((TN + 1) * 3 * 2), tIdx = [];
  for (let i = 0; i <= TN; i++) { for (let c = 0; c < 3; c++) { tUv[(i * 3 + c) * 2] = c * 0.5; tUv[(i * 3 + c) * 2 + 1] = i * 0.4; } if (i < TN) for (let c = 0; c < 2; c++) { const a = i * 3 + c, b = a + 3; tIdx.push(a, b, a + 1, a + 1, b, b + 1); } }
  tieG.setAttribute("position", new THREE.BufferAttribute(tPos, 3)); tieG.setAttribute("uv", new THREE.BufferAttribute(tUv, 2)); tieG.setIndex(tIdx);
  const tieM = mesh(tieG, M.tie, B.chest), tieA = V(0, 1.466 - chestY.y, zS(0, 1.466) + 0.016), tl = V(), tInv = new THREE.Matrix4(), tGrav = V();
  function tieWrite() { B.chest.updateWorldMatrix(true, false); tInv.copy(B.chest.matrixWorld).invert(); const L = TP.map(q => q.p.clone().applyMatrix4(tInv));
    for (let i = 0; i <= TN; i++) { const a = L[Math.max(0, i - 1)], b = L[Math.min(TN, i + 1)], dir = b.clone().sub(a).normalize(), sd = V(1, 0, 0).sub(dir.clone().multiplyScalar(dir.x)).normalize(), w = tieW(i), nrm = sd.clone().cross(dir); for (let c = 0; c < 3; c++) { const o = (c - 1) * w, r = L[i].clone().addScaledVector(sd, o).addScaledVector(nrm, c === 1 ? -0.003 : 0); tPos.set([r.x, r.y, r.z], (i * 3 + c) * 3); } }
    tieG.attributes.position.needsUpdate = true; tieG.computeVertexNormals(); }
  function tieReset() { B.chest.updateWorldMatrix(true, false); TP.forEach((q, i) => { let y = 1.466 - i * tieSeg; q.p.set(0, y - chestY.y, zS(0, Math.max(y, 0.8)) + 0.014).applyMatrix4(B.chest.matrixWorld); q.o.copy(q.p); }); tieWrite(); }
  // 화면 단위(HU = 1미터의 픽셀)로 줄을 움직이고 몸 앞면에서 멈추게 함
  function tieStep(dt, HU, hold = 1) { dt = Math.min(dt, 1 / 30); if (dt <= 0) return; B.chest.updateWorldMatrix(true, false); tInv.copy(B.chest.matrixWorld).invert(); TP[0].p.copy(tieA).applyMatrix4(B.chest.matrixWorld); TP[0].o.copy(TP[0].p); tGrav.set(0, -13 * HU * dt * dt, 0); const seg = tieSeg * HU;
    for (let i = 1; i <= TN; i++) { const q = TP[i]; tl.copy(q.p).sub(q.o).multiplyScalar(0.95); q.o.copy(q.p); q.p.add(tl).add(tGrav); }
    for (let k = 0; k < 3; k++) for (let i = 1; i <= TN; i++) { const a = TP[i - 1].p, b = TP[i].p; tl.copy(b).sub(a); const l = tl.length() || 1; b.copy(a).addScaledVector(tl, seg / l);
      const c = b.clone().applyMatrix4(tInv), ya = c.y + chestY.y; if (ya > 0.8 && ya < 1.5) { const zs = zS(clamp(c.x, -0.2, 0.2), ya) + 0.012; if (c.z < zs) { c.z = zs; b.copy(c).applyMatrix4(B.chest.matrixWorld); } } }
    if (hold > 0) { const k = 1 - Math.exp(-dt * 30 * hold); for (let i = 1; i <= TN; i++) { const q = TP[i], c = q.p.clone().applyMatrix4(tInv), y = 1.466 - i * tieSeg; c.x += (0 - c.x) * k; c.y += (y - chestY.y - c.y) * k * 0.6; q.p.copy(c).applyMatrix4(B.chest.matrixWorld); } }
    tieWrite(); }
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
  return { HS, root, B, M, begin, sync, ik, leg, arm, setE, fingers, posOf, quatOf, show, tint, headG, restW, HAND, tieReset, tieStep };
}
