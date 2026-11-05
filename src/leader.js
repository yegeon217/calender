// 핵 연출의 인물: 머리는 받은 사진을 그대로 입힌 입체 얼굴, 몸은 사진 속 차림(짙은 줄무늬 양복 · 흰 셔츠 · 점무늬 넥타이)을 직접 만든 것.
// 얼굴: 사진 윤곽을 부풀린 면에 코·눈두덩·볼·입술·턱 굴곡을 더하고 사진을 앞에서 그대로 비춤. 뒤통수는 따로 막음.
// 일반 사진(a)과 안경 고쳐 쓰는 사진(b)은 눈 위치를 맞춰 겹쳐 두고 바꿔 끼움. b일 땐 사진 속 손을 얼굴 앞에 띄우고 3D 오른손은 숨김.
// 단위는 미터 (위 +y, 앞 +z, 사람의 왼쪽 +x). 뼈대와 IK는 runner.js와 같은 방식.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tubeGeo, vRings, mix, sm } from "./runner.js";
import { noiseTex } from "./fx-util.js";
import urlA from "./assets/kim-a.webp?url";
import urlB from "./assets/kim-b.webp?url";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const AO = 0.16, armDir = side => V(Math.sin(AO) * side, -Math.cos(AO), 0);
const BN = ["hips", "spine", "chest", "neck", "head", "armL", "foreL", "handL", "armR", "foreR", "handR", "thighL", "shinL", "footL", "thighR", "shinR", "footR"];
const REST = {
  hips: [null, V(0, 0.93, 0)], spine: ["hips", V(0, 0.12, 0)], chest: ["spine", V(0, 0.2, 0)], neck: ["chest", V(0, 0.165, 0.012)], head: ["neck", V(0, 0.05, 0.012)],
  armL: ["chest", V(0.2, 0.1, -0.008)], foreL: ["armL", armDir(1).multiplyScalar(0.3)], handL: ["foreL", armDir(1).multiplyScalar(0.265)],
  armR: ["chest", V(-0.2, 0.1, -0.008)], foreR: ["armR", armDir(-1).multiplyScalar(0.3)], handR: ["foreR", armDir(-1).multiplyScalar(0.265)],
  thighL: ["hips", V(0.105, -0.05, 0)], shinL: ["thighL", V(0, -0.42, 0)], footL: ["shinL", V(0, -0.38, 0)],
  thighR: ["hips", V(-0.105, -0.05, 0)], shinR: ["thighR", V(0, -0.42, 0)], footR: ["shinR", V(0, -0.38, 0)],
};
const BI = Object.fromEntries(BN.map((n, i) => [n, i]));

// ── 사진 자료 (좌표는 원본 사진 픽셀) ──
const PA = [[262,122],[282,112],[310,106],[345,104],[380,101],[430,100],[480,100],[530,101],[570,105],[600,110],[625,118],[645,136],[658,158],[664,185],[664,240],[662,300],[660,345],[660,372],[670,374],[680,384],[686,404],[686,440],[681,470],[671,500],[661,520],[652,526],[649,540],[645,565],[637,595],[624,622],[610,645],[600,660],[575,674],[550,688],[525,705],[500,721],[480,732],[460,745],[440,756],[422,752],[408,744],[380,718],[350,695],[320,673],[287,650],[277,632],[268,605],[261,570],[254,535],[250,527],[240,526],[231,512],[224,490],[219,455],[218,420],[221,395],[229,381],[241,377],[250,379],[248,345],[244,300],[241,240],[241,185],[245,150],[252,132]];
const PB = [[127,60],[132,38],[146,22],[165,8],[182,0],[345,0],[350,12],[351,36],[352,58],[354,76],[364,84],[371,100],[372,118],[375,150],[372,176],[366,200],[352,226],[330,250],[312,266],[298,276],[270,272],[250,262],[232,248],[210,228],[196,205],[170,150],[152,118],[140,100],[128,76]];
const PH = [[108,258],[113,240],[116,205],[124,168],[133,138],[148,116],[165,100],[188,91],[214,96],[236,108],[247,120],[244,130],[241,143],[233,150],[241,160],[246,172],[238,181],[215,190],[205,197],[200,212],[186,228],[166,244],[160,258]];
const CROP_A = [200, 85, 512, 688], CROP_B = [100, 0, 288, 288];
const S_A = 0.00044, C_A = [455, 420];              // 미터/픽셀 · 머리 기준점 (코 높이)
const S_B = S_A * 165 / 70.0, C_B = [281.8, 142.5];   // 두 사진의 눈 사이 거리·눈 위치를 맞춤

function maskTex(poly, crop, res, blur) {
  const c = document.createElement("canvas"), k = res / Math.max(crop[2], crop[3]); c.width = Math.round(crop[2] * k); c.height = Math.round(crop[3] * k); const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.filter = `blur(${blur}px)`; x.fillStyle = "#fff"; x.beginPath();
  poly.forEach(([a, b], i) => { const u = (a - crop[0]) * k, v = (b - crop[1]) * k; i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill(); x.strokeStyle = "#000"; x.lineWidth = 6 * k; x.lineJoin = "round"; x.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const segD = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
function inP(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
// 사진 윤곽을 부풀린 면: 가장자리에서 둥글게 말려 들어가고, 얼굴 굴곡(g: [x, y, 가로폭, 세로폭, 높이], 픽셀 좌표)을 더함
function relief(P, crop, S, C, bumps, o) {
  const NX = o.nx, NY = o.ny, pos = [], uv = [], idx = [], keep = new Int32Array((NX + 1) * (NY + 1)).fill(-1), R = o.R, Z = o.Z, mar = o.mar / S;
  const dist = new Float32Array((NX + 1) * (NY + 1)), inside = new Uint8Array((NX + 1) * (NY + 1));
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const px = crop[0] + (i / NX) * crop[2], py = crop[1] + (j / NY) * crop[3]; let d = 1e9; for (let k = 0; k < P.length; k++) d = Math.min(d, segD(px, py, P[k], P[(k + 1) % P.length])); dist[j * (NX + 1) + i] = d; inside[j * (NX + 1) + i] = inP(P, px, py) ? 1 : 0; }
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i, d = dist[k]; if (!inside[k] && d > mar) continue;
    const px = crop[0] + (i / NX) * crop[2], py = crop[1] + (j / NY) * crop[3], dm = (inside[k] ? d : -d) * S; let z = dm > 0 ? Z * Math.sqrt(1 - Math.pow(1 - Math.min(dm / R, 1), 2)) : dm * 0.6;
    for (const [bx, by, sx, sy, h] of bumps) { const u = (px - bx) / sx, v = (py - by) / sy; z += h * Math.exp(-(u * u + v * v)); }
    keep[k] = pos.length / 3; pos.push((px - C[0]) * S, (C[1] - py) * S, z + (o.z0 || 0)); uv.push((px - crop[0]) / crop[2], 1 - (py - crop[1]) / crop[3]); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = keep[j * (NX + 1) + i], b = keep[j * (NX + 1) + i + 1], c = keep[(j + 1) * (NX + 1) + i], d = keep[(j + 1) * (NX + 1) + i + 1]; if (a < 0 || b < 0 || c < 0 || d < 0) continue; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// 얼굴 굴곡 (사진 a) · 눈 두덩이 들어가고 코·입·볼이 나옴
const BUMP_A = [[460, 450, 34, 44, 0.030], [461, 385, 16, 70, 0.015], [462, 480, 46, 16, 0.008], [460, 318, 150, 26, 0.010], [380, 368, 42, 18, -0.012], [545, 368, 42, 18, -0.012], [455, 548, 52, 26, 0.012], [455, 612, 60, 30, 0.012],
  [325, 490, 62, 74, 0.016], [590, 490, 62, 74, 0.016], [455, 690, 130, 34, -0.012], [455, 260, 170, 60, 0.004]];
const BUMP_B = [[296, 165, 15, 19, 0.030], [288, 125, 8, 30, 0.015], [320, 115, 19, 8, -0.008], [305, 203, 22, 12, 0.012], [316, 240, 26, 14, 0.012], [345, 172, 26, 34, 0.016], [262, 205, 26, 30, 0.016], [270, 90, 60, 12, 0.008]];

function fabricTex(base, line, every) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  const im = x.getImageData(0, 0, 256, 256), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
  if (line) { x.strokeStyle = line; x.lineWidth = 1.2; for (let i = 0; i < 256; i += every) { x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, 256); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function tieTex() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#2a2c33"; x.fillRect(0, 0, 128, 128); x.fillStyle = "rgba(225,225,232,.55)";
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(i * 21.3 + (j % 2 ? 10.6 : 0) + 5, j * 21.3 + 10, 1.3, 0, 7); x.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
function shoeGeos() {
  const prof = [[-0.08, 0.03], [-0.07, 0.042], [-0.04, 0.046], [0.0, 0.044], [0.05, 0.05], [0.1, 0.054], [0.15, 0.05], [0.19, 0.04], [0.215, 0.024], [0.225, 0.008]];
  const hw = z => { for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) { const [z0, w0] = prof[i - 1], [z1, w1] = prof[i]; return w0 + (w1 - w0) * (z - z0) / (z1 - z0); } return 0.006; };
  const sh = new THREE.Shape(), pts = []; for (const [z, w] of prof) pts.push([w, -z]); for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], -prof[i][0]]); pts.forEach(([a, b], i) => (i ? sh.lineTo(a * 1.06, b * 1.03) : sh.moveTo(a * 1.06, b * 1.03)));
  const sole = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 }); sole.rotateX(-Math.PI / 2); sole.translate(0, -0.08 + 0.003, 0);
  const hgt = z => (z < 0.02 ? 0.085 : z < 0.13 ? 0.085 - ((z - 0.02) / 0.11) * 0.03 : 0.055 - ((z - 0.13) / 0.095) * 0.025), rings = [], N = 18, top = -0.062;
  for (let i = 0; i <= 30; i++) { const z = -0.08 + (i / 30) * 0.305, e = Math.sqrt(Math.max(0.0004, Math.min(1, (z + 0.08) / 0.016, (0.225 - z) / 0.03)));
    rings.push({ z, w: Math.max(0.0006, hw(z) - 0.002) * e, h: hgt(z) * (0.55 + 0.45 * e) }); }
  const pos = [], idx = []; rings.forEach(({ z, w, h }) => { for (let j = 0; j <= N; j++) { const a = (j / N) * Math.PI, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.4; pos.push(Math.sign(c) * Math.pow(Math.abs(c), e) * w, top + Math.pow(s, e) * h, z); } });
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < N; j++) { const a = k * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const up = new THREE.BufferGeometry(); up.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); up.setIndex(idx); up.computeVertexNormals(); return { sole, up };
}

export async function buildLeader({ hands }) {
  const root = new THREE.Group(), load = u => new THREE.TextureLoader().loadAsync(u).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
  const [texA, texB] = await Promise.all([load(urlA), load(urlB)]);
  const suitT = fabricTex("#2b2d32", "rgba(150,155,166,.2)", 11); suitT.repeat.set(7, 2);
  const plainT = fabricTex("#2b2d32", null, 0); plainT.repeat.set(4, 4);
  const weave = noiseTex(128, 12, 22, 0.8);
  const cloth = (map, o = {}) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.78, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x5a5f6a), bumpMap: weave, bumpScale: 0.25, ...o });
  const M = { suit: cloth(suitT), lapel: cloth(fabricTex("#1d1e22", null, 0), { roughness: 0.7, sheen: 0.18 }), shirt: new THREE.MeshStandardMaterial({ color: 0xf0efea, roughness: 0.62, bumpMap: weave, bumpScale: 0.12 }), tie: new THREE.MeshPhysicalMaterial({ map: tieTex(), roughness: 0.42, sheen: 0.4 }),
    skin: new THREE.MeshPhysicalMaterial({ color: 0xdba880, roughness: 0.52, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xff9a78), clearcoat: 0.08, bumpMap: noiseTex(256, 6, 26, 0.9), bumpScale: 0.25 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.62, bumpMap: noiseTex(128, 10, 40, 1.4), bumpScale: 0.6 }), neck: new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.6 }),
    shoe: new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.12 }), sole: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.7 }), btn: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.3, metalness: 0.2 }) };
  // ── 뼈 ──
  const B = {}; BN.forEach(n => { const b = new THREE.Bone(); b.name = n; B[n] = b; });
  BN.forEach(n => { const [par, off] = REST[n]; B[n].position.copy(off); if (par) B[par].add(B[n]); });
  const restW = {}; { const acc = n => { const [par, off] = REST[n]; return par ? acc(par).add(off) : off.clone(); }; BN.forEach(n => (restW[n] = acc(n))); }
  // ── 윗도리 몸통 (넓은 어깨 · 나온 배 · 엉덩이를 덮는 자락) ──
  const JK = [[1.462, 0.078, 0.08, 0.006], [1.44, 0.158, 0.094, 0.002], [1.415, 0.206, 0.108, -0.004], [1.385, 0.232, 0.122, -0.006], [1.34, 0.236, 0.138, 0], [1.27, 0.224, 0.155, 0.012], [1.19, 0.218, 0.172, 0.026], [1.1, 0.222, 0.19, 0.04], [1.0, 0.228, 0.192, 0.038], [0.92, 0.226, 0.178, 0.024], [0.85, 0.222, 0.162, 0.012], [0.795, 0.22, 0.152, 0.006], [0.786, 0.2, 0.13, 0], [0.775, 0.03, 0.03, 0]];
  const NJ = 2.3, ringAt = y => { let i = 0; while (i < JK.length - 2 && y < JK[i + 1][0]) i++; const a = JK[i], b = JK[i + 1], t = clamp((a[0] - y) / (a[0] - b[0]), 0, 1); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; };
  const zS = (x, y) => { const [ax, az, zo] = ringAt(y); return zo + az * Math.pow(Math.max(0, 1 - Math.pow(Math.min(Math.abs(x) / ax, 1), NJ)), 1 / NJ); };
  const torsoW = p => { const y = p.y, ax = Math.abs(p.x), side = p.x > 0 ? "L" : "R"; let w;
    if (y < 0.98) w = [[BI.hips, 1]]; else if (y < 1.14) w = mix(BI.hips, BI.spine, sm((y - 0.98) / 0.16)); else if (y < 1.3) w = mix(BI.spine, BI.chest, sm((y - 1.14) / 0.16)); else if (y < 1.44) w = [[BI.chest, 1]]; else w = mix(BI.chest, BI.neck, sm((y - 1.44) / 0.04) * 0.4);
    const sh = sm((ax - 0.13) / 0.09) * sm((y - 1.28) / 0.1) * 0.6; if (sh > 0) { w = w.map(q => [q[0], q[1] * (1 - sh)]); w.push([BI["arm" + side], sh]); } return w; };
  const legW = side => p => { const y = p.y, T = BI["thigh" + side], S = BI["shin" + side], F = BI["foot" + side]; if (y > 0.84) return mix(T, BI.hips, sm((y - 0.84) / 0.14) * 0.5); if (y > 0.52) return [[T, 1]]; if (y > 0.42) return mix(T, S, sm((0.52 - y) / 0.1)); if (y > 0.16) return [[S, 1]]; return mix(S, F, sm((0.16 - y) / 0.06) * 0.3); };
  const legR = x0 => vRings([[1.0, 0.102, 0.108, -0.01], [0.92, 0.108, 0.116, -0.012], [0.84, 0.104, 0.11, -0.006], [0.72, 0.092, 0.098, 0], [0.6, 0.084, 0.088, 0.004], [0.5, 0.08, 0.084, 0.006], [0.42, 0.078, 0.082, 0], [0.3, 0.076, 0.08, 0], [0.18, 0.078, 0.082, 0.004], [0.112, 0.084, 0.09, 0.012], [0.102, 0.078, 0.082, 0.012]], x0, 2.05);
  const armRings = (side, list) => { const s0 = restW["arm" + (side > 0 ? "L" : "R")], d = armDir(side), u = V(Math.cos(AO), Math.sin(AO) * side, 0).multiplyScalar(side > 0 ? 1 : -1); return list.map(([s, ax, az]) => ({ c: s0.clone().addScaledVector(d, s), a: d, u, ax, az, n: 2, s })); };
  const armW = side => p => { const S = side > 0 ? "L" : "R", s = p.clone().sub(restW["arm" + S]).dot(armDir(side)), A = BI["arm" + S], F = BI["fore" + S], H = BI["hand" + S]; if (s < 0.05) return mix(A, BI.chest, sm((0.05 - s) / 0.1) * 0.45); if (s < 0.25) return [[A, 1]]; if (s < 0.34) return mix(A, F, sm((s - 0.25) / 0.09)); if (s < 0.53) return [[F, 1]]; return mix(F, H, sm((s - 0.53) / 0.04) * 0.3); };
  const SLV = [[-0.085, 0.03, 0.03], [-0.07, 0.056, 0.056], [-0.03, 0.074, 0.074], [0.03, 0.08, 0.08], [0.1, 0.078, 0.075], [0.19, 0.071, 0.068], [0.29, 0.065, 0.062], [0.37, 0.061, 0.058], [0.46, 0.056, 0.053], [0.52, 0.052, 0.049], [0.54, 0.05, 0.047], [0.546, 0.038, 0.038]], CUF = [[0.53, 0.046, 0.044], [0.558, 0.045, 0.043], [0.564, 0.036, 0.034]];
  const parts = [[tubeGeo(vRings(JK, 0, NJ), 40, torsoW), 0], [tubeGeo(legR(0.105), 22, legW("L")), 0], [tubeGeo(legR(-0.105), 22, legW("R")), 0], [tubeGeo(armRings(1, SLV), 20, armW(1)), 0], [tubeGeo(armRings(-1, SLV), 20, armW(-1)), 0], [tubeGeo(armRings(1, CUF), 16, armW(1)), 1], [tubeGeo(armRings(-1, CUF), 16, armW(-1)), 1]];
  const body = new THREE.SkinnedMesh(mergeGeometries(parts.map(p => p[0]), true), [M.suit, M.shirt]); body.geometry.groups.forEach((g, i) => (g.materialIndex = parts[i][1]));
  body.add(B.hips); body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(BN.map(n => B[n]))); body.castShadow = body.receiveShadow = true; body.frustumCulled = false; root.add(body);
  const mesh = (g, m, par, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.frustumCulled = false; par.add(o); return o; };
  // ── 앞판: 몸 표면을 따라 붙인 띠들 (셔츠 · 넥타이 · 깃 · 라펠 · 주머니) · 줄(y)마다 왼쪽·오른쪽 x를 주면 표면을 따라 면을 만듦 ──
  const chestY = restW.chest, spineY = restW.spine;
  function patch(rows, off, ref, nx = 8, uvs = 1) { const pos = [], uv = [], idx = [];
    rows.forEach(([y, x0, x1], j) => { for (let i = 0; i <= nx; i++) { const x = lerp(x0, x1, i / nx); pos.push(x - ref.x, y - ref.y, zS(x, y) + off - ref.z); uv.push(x * uvs * 8, y * uvs * 8); } });
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
  const rowsOf = (y0, y1, n, f) => Array.from({ length: n + 1 }, (_, i) => { const y = lerp(y0, y1, i / n), [a, b] = f(y, i / n); return [y, a, b]; });
  const vHalf = y => 0.088 * Math.pow(clamp((y - 1.1) / 0.375, 0, 1), 1.15);   // 앞섶이 벌어진 폭
  mesh(patch(rowsOf(1.475, 1.1, 14, y => [-vHalf(y) - 0.004, vHalf(y) + 0.004]), 0.0012, chestY, 10), M.shirt, B.chest);
  mesh(patch(rowsOf(1.425, 1.12, 12, (y, u) => { const w = u < 0.1 ? lerp(0.02, 0.015, u / 0.1) : lerp(0.015, 0.034, Math.pow((u - 0.1) / 0.9, 0.8)); return [-w, w]; }), 0.0065, chestY, 4, 1.2), M.tie, B.chest);
  mesh(patch(rowsOf(1.45, 1.415, 3, (y, u) => { const w = lerp(0.026, 0.019, u); return [-w, w]; }), 0.012, chestY, 4, 1.2), M.tie, B.chest);   // 매듭
  for (const s of [-1, 1]) {
    // 셔츠 깃: 목 둘레에서 앞으로 뾰족하게
    mesh(patch(rowsOf(1.482, 1.388, 8, (y, u) => { const a = lerp(0.098, 0.07, Math.pow(u, 1.3)), b = lerp(0.012, 0.066, Math.pow(u, 0.8)); return s > 0 ? [b, a] : [-a, -b]; }), 0.0095, chestY, 4), M.shirt, B.chest);
    // 라펠: 앞섶 가장자리를 따라 내려오다 가슴에서 넓어지고, 위쪽에 홈이 있음
    mesh(patch(rowsOf(1.445, 1.1, 22, (y, u) => { const inX = vHalf(y), wTop = y > 1.375 ? lerp(0.048, 0.06, (1.445 - y) / 0.07) : lerp(0.088, 0.008, Math.pow((1.375 - y) / 0.275, 1.1)); return s > 0 ? [inX, inX + wTop] : [-inX - wTop, -inX]; }), 0.0052, chestY, 5), M.lapel, B.chest);
    // 앞주머니 덮개
    mesh(patch(rowsOf(0.985, 0.94, 2, () => (s > 0 ? [0.075, 0.215] : [-0.215, -0.075])), 0.0048, spineY, 8), M.lapel, B.spine);
  }
  mesh(patch(rowsOf(1.325, 1.298, 2, () => [0.1, 0.19]), 0.0042, chestY, 6), M.lapel, B.chest);   // 가슴 주머니 (그 사람의 왼쪽)
  mesh(patch(rowsOf(1.1, 0.8, 16, (y, u) => { const c = -0.012 - 0.09 * Math.pow(u, 2.2); return [c - 0.0022, c + 0.0022]; }), 0.0048, spineY, 2), M.btn, B.spine);   // 여민 선
  for (const y of [1.06, 0.96]) { const b = mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.006, 16).rotateX(Math.PI / 2), M.btn, B.spine); b.position.set(0.015 - spineY.x, y - spineY.y, zS(0.015, y) + 0.008 - spineY.z); }
  // 소매 단추 (3개씩)
  for (const S of ["L", "R"]) for (let i = 0; i < 3; i++) { const b = mesh(new THREE.SphereGeometry(0.0075, 10, 8), M.btn, B["fore" + S]); const d = armDir(S === "L" ? 1 : -1); b.position.copy(d).multiplyScalar(0.2 + i * 0.02).add(V(0, 0, -0.05)); }
  // ── 구두 ──
  const SG = shoeGeos(); for (const S of ["L", "R"]) { const g = new THREE.Group(); B["foot" + S].add(g); mesh(SG.sole, M.sole, g); mesh(SG.up, M.shoe, g); }
  // ── 손 ──
  const HAND = [];
  hands.forEach((H, i) => { const side = i ? 1 : -1, S = side > 0 ? "L" : "R"; H.mesh.material = M.skin; H.mesh.castShadow = true;
    const orient = new THREE.Group(); orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    H.scene.position.copy(V().setFromMatrixPosition(H.restM.wrist)).negate(); orient.add(H.scene);
    const fr = new THREE.Group(), fd = armDir(-1), pn = V(Math.cos(AO), -Math.sin(AO), 0); fr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), fd, pn)); fr.add(orient);
    const holder = new THREE.Group(); holder.scale.setScalar(1.12); if (side > 0) holder.scale.x = -1.12; holder.add(fr); B["hand" + S].add(holder); HAND.push({ H, S, holder }); });
  const FIST = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] };
  function fingers(S, curl, thumb = curl * 0.6, idx = curl) { const h = HAND.find(q => q.S === S); if (!h) return;
    for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n], c = n === "index" ? idx : curl; h.H.setChain(n, [null, [f[0] * c, 0, 0], [f[1] * c, 0, 0], [f[2] * c, 0, 0]]); }
    h.H.setChain("thumb", [[-0.6 * thumb + 0.1, 0.3 * thumb - 0.15, 0], [-0.5 * thumb, 0, 0], [-0.6 * thumb, 0, 0]]); }

  // ── 머리: 사진 얼굴 a·b · 손 사진 · 뒤통수 · 목 ──
  const HS = 1.14, headG = new THREE.Group(); headG.position.set(0, 0.1, 0.01); headG.scale.setScalar(HS); B.head.add(headG);   // 사진 기준점(코 높이)
  const photo = (map, poly, crop, res, blur) => new THREE.MeshStandardMaterial({ map, alphaMap: maskTex(poly, crop, res, blur), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, color: 0x8a8a8a, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.56, roughness: 0.72, toneMapped: false });
  const A = mesh(relief(PA, CROP_A, S_A, C_A, BUMP_A, { nx: 88, ny: 120, R: 0.085, Z: 0.094, mar: 0.006 }), photo(texA, PA, CROP_A, 1024, 2), headG);
  const Bf = mesh(relief(PB, CROP_B, S_B, C_B, BUMP_B, { nx: 80, ny: 80, R: 0.085, Z: 0.094, mar: 0.006 }), photo(texB, PB, CROP_B, 640, 1.5), headG); Bf.visible = false;
  const Hc = mesh(relief(PH, CROP_B, S_B, C_B, [], { nx: 80, ny: 80, R: 0.03, Z: 0.02, mar: 0.003, z0: 0.102 }), photo(texB, PH, CROP_B, 640, 1), headG); Hc.visible = false;
  // 뒤통수: 위는 납작 · 옆과 뒤는 짧은 머리
  const backG = new THREE.SphereGeometry(1, 36, 24); { const P = backG.attributes.position; for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y > 0.82) y = 0.82 + (y - 0.82) * 0.3; P.setXYZ(i, x * 0.09, y * 0.128 + 0.018, Math.min(z, 0.2) * 0.104 - 0.012); } backG.computeVertexNormals();
    const col = new Float32Array(P.count * 3), cs = new THREE.Color(0xc99a74), ch = new THREE.Color(0x202024), c = new THREE.Color(); for (let i = 0; i < P.count; i++) { c.copy(cs).lerp(ch, Math.max(sm((P.getY(i) + 0.03) / 0.05), 0.82 * sm((-P.getZ(i) - 0.012) / 0.04))); col.set([c.r, c.g, c.b], i * 3); } backG.setAttribute("color", new THREE.BufferAttribute(col, 3)); }
  mesh(backG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, bumpMap: M.hair.bumpMap, bumpScale: 0.5 }), headG);
  const neckM = mesh(new THREE.CylinderGeometry(0.07, 0.078, 0.14, 24), M.neck, B.neck); neckM.position.y = 0.03;
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  function show(k) { const b = k === "b"; A.visible = !b; Bf.visible = b; Hc.visible = b; const h = HAND.find(q => q.S === "R"); if (h) h.holder.visible = !b; }
  // 사진 속 손목 자리 (머리 기준 · 팔을 여기로 뻗음)
  const wristB = V((134 - C_B[0]) * S_B, (C_B[1] - 256) * S_B, 0.09).multiplyScalar(HS).add(headG.position);
  // 조명: 폭발 빛을 사진에도 조금 받게
  function tint(c, k) { for (const m of [A.material, Bf.material, Hc.material]) { m.emissive.setRGB(1, 1, 1).lerp(c, k); } }

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
  const toRoot = (obj, local) => local.clone().applyMatrix4(obj.matrixWorld).applyMatrix4(rootInv);
  return { root, B, M, begin, sync, ik, leg, arm, setE, fingers, posOf, quatOf, toRoot, show, tint, wristB, headG, restW, HAND };
}
