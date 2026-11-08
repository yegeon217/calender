// 태양 연출의 인물들: 윌 스미스(뒷모습 사진) · 이재용 · 젠슨 황 · 스티브 잡스 + 소품(닭다리 · 아이폰)
// 몸은 화성 연출의 일론과 같은 방식(뼈 + 옷 입은 관 + 진짜 손 모델)으로 사람마다 옷을 따로 만들고, 머리는 받은 사진을 부풀린 입체 얼굴.
// 넷 다 앞에서 찍은 사진이라 앞(정면 ±30도 안)에서 보이게 찍음.
// 단위는 미터 (위 +y, 앞 +z, 사람의 왼쪽 +x).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tubeGeo, vRings, mix, sm } from "./runner.js";
import { noiseTex } from "./fx-util.js";
import urlWf from "./assets/sun-wf.webp?url";
import urlLy from "./assets/sun-ly.webp?url";
import urlJh from "./assets/sun-jh.webp?url";
import urlSj from "./assets/sun-sj.webp?url";
import urlCk from "./assets/sun-ck.webp?url";

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
// P 머리 윤곽 · B 얼굴 굴곡 [x, y, 가로폭, 세로폭, 높이(m)] · shell 뒤통수 [x, y, 가로 반지름, 세로 반지름, 기울기, 깊이, 앞뒤] · yaw 사진을 찍은 방향(머리 기준)
const FACES = {
  // 윌 스미스: 앞에서 찍은 사진 (활짝 웃는 얼굴 · 왼쪽 귀 귀걸이)
  will: { url: urlWf, crop: [130, 60, 700, 890], S: 0.00048, C: [540, 905], yaw: 0, hz: 0.05, shellC: 0x15110e, shellHair: true, Z: 0.085, R: 0.05,
    P: [[500,72],[584,93],[658,145],[711,219],[742,303],[753,387],[758,440],[771,447],[795,485],[804,566],[790,640],[770,662],[750,690],[742,798],[711,851],[647,903],[563,929],[500,924],[437,914],[384,882],[332,840],[289,787],[258,714],[226,672],[186,672],[153,625],[143,535],[158,464],[205,451],[195,387],[193,293],[205,219],[258,156],[342,103],[416,80]], emi: 0.56, col: 0x4a4542,
    B: [[558, 568, 44, 50, 0.034], [550, 480, 26, 80, 0.014], [545, 395, 210, 34, 0.008], [416, 456, 56, 26, -0.011], [674, 451, 56, 26, -0.011], [550, 685, 100, 36, 0.012], [553, 860, 100, 44, 0.012], [320, 630, 80, 100, 0.016], [740, 620, 70, 100, 0.016], [520, 245, 230, 60, 0.008]],
    shell: [490, 330, 0.134, 0.128, 0, 0.105, -0.03] },
  lee: { url: urlLy, crop: [92, 8, 214, 272], S: 0.00152, C: [214, 262], yaw: 0, hz: 0.05, shellC: 0x15120f, shellHair: true, Z: 0.1, R: 0.09,
    P: [[200,16],[232,20],[268,36],[284,56],[292,80],[296,112],[292,132],[294,160],[288,188],[280,216],[268,240],[248,260],[228,272],[200,268],[176,252],[152,224],[140,204],[132,204],[104,180],[100,152],[112,132],[124,128],[120,100],[124,68],[144,40],[172,22]],
    B: [[244, 186, 13, 15, 0.032], [238, 155, 8, 24, 0.014], [222, 130, 62, 10, 0.008], [206, 148, 17, 8, -0.011], [272, 151, 17, 8, -0.011], [238, 215, 30, 11, 0.01], [226, 256, 30, 12, 0.012], [172, 194, 24, 30, 0.016], [284, 196, 14, 26, 0.012], [214, 82, 70, 18, 0.008]],
    shell: [206, 118, 0.128, 0.15, 0, 0.11, -0.03] },
  jensen: { url: urlJh, crop: [912, 72, 198, 236], S: 0.0016, C: [1018, 290], yaw: 0, hz: 0.05, shellC: 0xb4b1ab, shellHair: true, Z: 0.1, R: 0.09,
    P: [[1005,81],[1034,82],[1059,90],[1080,104],[1092,125],[1095,150],[1086,167],[1095,169],[1101,187],[1099,217],[1090,233],[1088,250],[1076,271],[1055,290],[1030,299],[1009,296],[986,283],[970,265],[957,242],[949,217],[942,196],[934,175],[924,154],[922,140],[930,123],[951,100],[976,85]],
    B: [[1001, 219, 12, 15, 0.032], [998, 192, 8, 22, 0.014], [998, 173, 62, 10, 0.008], [970, 201, 16, 8, -0.011], [1024, 189, 16, 8, -0.011], [1012, 247, 28, 10, 0.01], [1017, 284, 28, 12, 0.012], [960, 232, 22, 28, 0.016], [1056, 226, 18, 26, 0.015], [1005, 130, 66, 18, 0.008]],
    shell: [1010, 165, 0.132, 0.13, 0.06, 0.105, -0.03] },
  jobs: { url: urlSj, crop: [138, 104, 420, 530], S: 0.00076, C: [370, 612], yaw: 0, hz: 0.05, shellC: 0x86817b, shellHair: true, Z: 0.1, R: 0.09,
    P: [[351,111],[397,118],[443,142],[482,180],[508,226],[520,272],[520,311],[528,326],[547,342],[551,388],[543,434],[528,472],[520,480],[512,511],[489,557],[458,595],[420,618],[374,626],[343,622],[297,603],[258,572],[228,534],[212,495],[205,480],[182,472],[158,434],[147,388],[151,342],[170,326],[174,318],[178,280],[189,234],[212,188],[251,149],[297,122]],
    B: [[389, 440, 26, 30, 0.032], [385, 385, 16, 46, 0.014], [385, 330, 120, 20, 0.008], [312, 368, 32, 16, -0.011], [458, 365, 32, 16, -0.011], [395, 498, 56, 20, 0.01], [376, 600, 56, 24, 0.012], [262, 450, 46, 56, 0.016], [505, 450, 40, 56, 0.015], [376, 215, 130, 36, 0.008]],
    shell: [352, 300, 0.12, 0.13, 0, 0.105, -0.03], shellTop: 0xd29a80 },
};

function maskTex(poly, crop, res, blur) {
  const c = document.createElement("canvas"), k = res / Math.max(crop[2], crop[3]); c.width = Math.round(crop[2] * k); c.height = Math.round(crop[3] * k); const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.filter = `blur(${blur}px)`; x.fillStyle = "#fff"; x.beginPath();
  poly.forEach(([a, b], i) => { const u = (a - crop[0]) * k, v = (b - crop[1]) * k; i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const segD = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
function inP(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
// 사진 윤곽을 부풀린 면: 가장자리에서 둥글게 말려 들어가고, 얼굴 굴곡을 더함
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

// ── 질감 ──
const rs = n => (Math.random() - 0.5) * 2 * n;
function canvasTex(w, h, draw, srgb, rep) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t; }
const hairTex = () => canvasTex(256, 256, (x) => { x.fillStyle = "#c9c9c9"; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { const y = Math.random() * 256, a = Math.random() * 256, l = 40 + Math.random() * 130, v = 150 + Math.random() * 105; x.strokeStyle = `rgba(${v},${v},${v},.5)`; x.lineWidth = 0.7 + Math.random() * 1.5; x.beginPath(); x.moveTo(a, y); x.quadraticCurveTo(a + l * 0.5, y + rs(8), a + l, y + rs(11)); x.stroke(); } }, true, [2, 2]);
// 짧게 깎은 머리 (윌 스미스 껍데기 대신 쓰지 않음 · 뒤통수용 고운 점)
const buzzTex = () => canvasTex(256, 256, (x) => { x.fillStyle = "#909090"; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { const v = Math.random() < 0.5 ? 40 : 200; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1.2, 1.2); } }, false, [3, 3]);
// 니트: 세로 골지 + 코
const knitTex = () => canvasTex(256, 256, (x) => { x.fillStyle = "#808080"; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 256; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, "#3c3c3c"); g.addColorStop(0.5, "#d8d8d8"); g.addColorStop(1, "#3c3c3c"); x.fillStyle = g; x.fillRect(i, 0, 8, 256); }
  for (let j = 0; j < 256; j += 6) for (let i = 0; i < 256; i += 8) { x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.ellipse(i + 4, j + 3, 3.2, 1.2, 0, 0, Math.PI * 2); x.fill(); } }, false, [6, 6]);
function denimTex() { return canvasTex(128, 128, (x) => { x.fillStyle = "#3a5578"; x.fillRect(0, 0, 128, 128); for (let i = -128; i < 256; i += 3) { x.strokeStyle = i % 2 ? "rgba(255,255,255,.08)" : "rgba(10,20,40,.13)"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); } for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"; x.fillRect(Math.random() * 128, Math.random() * 128, 1, Math.random() * 4 + 1); } }, true, [3, 9]); }

function shoeGeos(k = 1, soleH = 0.02) {
  const prof = [[-0.08, 0.034], [-0.07, 0.046], [-0.04, 0.05], [0.0, 0.048], [0.05, 0.054], [0.1, 0.058], [0.15, 0.054], [0.19, 0.044], [0.22, 0.026], [0.235, 0.008]].map(([z, w]) => [z, w * k]);
  const hw = z => { for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) { const [z0, w0] = prof[i - 1], [z1, w1] = prof[i]; return w0 + (w1 - w0) * (z - z0) / (z1 - z0); } return 0.006; };
  const sh = new THREE.Shape(), pts = []; for (const [z, w] of prof) pts.push([w, -z]); for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], -prof[i][0]]); pts.forEach(([a, b], i) => (i ? sh.lineTo(a * 1.06, b * 1.03) : sh.moveTo(a * 1.06, b * 1.03)));
  const sole = new THREE.ExtrudeGeometry(sh, { depth: soleH, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 }); sole.rotateX(-Math.PI / 2); sole.translate(0, -0.08 + 0.003, 0);
  const top = -0.08 + soleH + 0.001, hgt = z => (z < 0.02 ? 0.11 : z < 0.13 ? 0.11 - ((z - 0.02) / 0.11) * 0.05 : 0.06 - ((z - 0.13) / 0.105) * 0.028) * (k > 1 ? 1.08 : 1), rings = [], N = 18;
  for (let i = 0; i <= 30; i++) { const z = -0.08 + (i / 30) * 0.315, e = Math.sqrt(Math.max(0.0004, Math.min(1, (z + 0.08) / 0.016, (0.235 - z) / 0.03))); rings.push({ z, w: Math.max(0.0006, hw(z) - 0.002) * e, h: hgt(z) * (0.55 + 0.45 * e) }); }
  const pos = [], idx = []; rings.forEach(({ z, w, h }) => { for (let j = 0; j <= N; j++) { const a = (j / N) * Math.PI, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.4; pos.push(Math.sign(c) * Math.pow(Math.abs(c), e) * w, top + Math.pow(s, e) * h, z); } });
  for (let q = 0; q < rings.length - 1; q++) for (let j = 0; j < N; j++) { const a = q * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const up = new THREE.BufferGeometry(); up.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); up.setIndex(idx); up.computeVertexNormals(); return { sole, up };
}

// ── 옷 (몸통 고리 [높이, 가로 반지름, 앞뒤 반지름, 앞뒤 치우침]) ──
const TORSO = {
  tux: [[1.54, 0.085, 0.085, 0.006], [1.515, 0.155, 0.1, 0.002], [1.485, 0.208, 0.112, -0.004], [1.45, 0.236, 0.124, -0.006], [1.4, 0.236, 0.134, 0], [1.33, 0.226, 0.14, 0.01], [1.25, 0.212, 0.142, 0.014], [1.15, 0.204, 0.142, 0.014], [1.05, 0.208, 0.14, 0.01], [0.96, 0.22, 0.14, 0.006], [0.9, 0.238, 0.146, 0.002], [0.85, 0.25, 0.15, 0], [0.838, 0.228, 0.132, 0], [0.832, 0.03, 0.03, 0]],
  sweater: [[1.545, 0.078, 0.078, 0.008], [1.525, 0.15, 0.1, 0.004], [1.495, 0.205, 0.114, -0.004], [1.455, 0.23, 0.126, -0.006], [1.4, 0.236, 0.138, 0], [1.33, 0.232, 0.146, 0.012], [1.25, 0.226, 0.15, 0.018], [1.15, 0.222, 0.15, 0.018], [1.05, 0.218, 0.146, 0.014], [0.97, 0.214, 0.14, 0.008], [0.935, 0.21, 0.134, 0.004], [0.925, 0.198, 0.122, 0], [0.92, 0.03, 0.03, 0]],
  tee: [[1.545, 0.076, 0.076, 0.008], [1.525, 0.145, 0.098, 0.004], [1.495, 0.2, 0.11, -0.004], [1.455, 0.222, 0.122, -0.006], [1.4, 0.226, 0.132, 0], [1.33, 0.222, 0.14, 0.012], [1.25, 0.216, 0.144, 0.018], [1.15, 0.212, 0.144, 0.018], [1.05, 0.21, 0.14, 0.014], [0.97, 0.208, 0.134, 0.008], [0.93, 0.206, 0.128, 0.004], [0.922, 0.196, 0.118, 0], [0.918, 0.03, 0.03, 0]],
  turtle: [[1.55, 0.07, 0.07, 0.008], [1.53, 0.135, 0.092, 0.004], [1.5, 0.19, 0.104, -0.004], [1.46, 0.212, 0.116, -0.006], [1.4, 0.214, 0.124, 0], [1.33, 0.206, 0.13, 0.01], [1.25, 0.198, 0.132, 0.014], [1.15, 0.194, 0.13, 0.012], [1.05, 0.194, 0.128, 0.01], [0.97, 0.196, 0.124, 0.006], [0.93, 0.196, 0.118, 0.002], [0.922, 0.186, 0.11, 0], [0.918, 0.03, 0.03, 0]],
};
// 소매 [팔 따라 거리, 가로, 앞뒤] (어깨 0 · 팔꿈치 0.32 · 손목 0.6)
const SLV = [[-0.08, 0.03, 0.03], [-0.066, 0.054, 0.054], [-0.03, 0.073, 0.073], [0.03, 0.08, 0.08], [0.11, 0.08, 0.078], [0.2, 0.077, 0.074], [0.31, 0.073, 0.07], [0.4, 0.068, 0.065], [0.49, 0.06, 0.057], [0.55, 0.054, 0.05], [0.578, 0.052, 0.048], [0.584, 0.04, 0.038]];
const SHORT = [[-0.08, 0.03, 0.03], [-0.066, 0.054, 0.054], [-0.03, 0.072, 0.072], [0.03, 0.076, 0.076], [0.11, 0.074, 0.072], [0.18, 0.072, 0.07], [0.2, 0.068, 0.066], [0.206, 0.05, 0.048]];
const BARE = [[0.12, 0.052, 0.05], [0.2, 0.05, 0.048], [0.29, 0.045, 0.043], [0.34, 0.043, 0.04], [0.44, 0.039, 0.036], [0.53, 0.031, 0.027], [0.58, 0.027, 0.022], [0.6, 0.025, 0.02], [0.612, 0.012, 0.01]];
const WHO = {
  will: { fit: "tux", skin: 0x6a412b, neck: 0x5a3523, slvK: 1.02 },
  lee: { fit: "sweater", skin: 0xe9b99b, neck: 0xd7a283, slvK: 1.04 },
  jensen: { fit: "tee", skin: 0xe2aa8a, neck: 0xcf9474, slvK: 1 },
  jobs: { fit: "turtle", skin: 0xe4ab91, neck: 0xcb9176, slvK: 0.88 },
};

const PV = (q) => q; // (읽기 쉬우라고 남김)
export async function buildPerson(who, hands, tex) {
  const W = WHO[who], F = FACES[who], fit = W.fit, root = new THREE.Group(), weave = noiseTex(128, 12, 22, 0.8);
  const skin = new THREE.MeshPhysicalMaterial({ color: W.skin, roughness: 0.5, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(who === "will" ? 0xb07050 : 0xff9a78), clearcoat: 0.08, bumpMap: noiseTex(256, 6, 26, 0.9), bumpScale: 0.25, emissive: new THREE.Color(W.skin).multiplyScalar(0.45), emissiveIntensity: 0.3 });
  const knit = fit === "sweater" || fit === "turtle" ? knitTex() : null;
  const cloth = {
    tux: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0f, roughness: 0.6, sheen: 0.55, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x40404c), bumpMap: weave, bumpScale: 0.3 }),
    sweater: new THREE.MeshPhysicalMaterial({ color: 0xc9bfaa, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color(0xfff4e0), bumpMap: knit, bumpScale: 1.8 }),
    tee: new THREE.MeshPhysicalMaterial({ color: 0x1a2134, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x3a4460), bumpMap: weave, bumpScale: 0.35 }),
    turtle: new THREE.MeshPhysicalMaterial({ color: 0x0e0e10, roughness: 0.86, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x34343c), bumpMap: knit, bumpScale: 0.5 }),
  }[fit];
  const pants = fit === "turtle" ? new THREE.MeshStandardMaterial({ map: denimTex(), roughness: 0.9, bumpMap: weave, bumpScale: 0.5 }) : new THREE.MeshStandardMaterial({ color: fit === "sweater" ? 0x2b2d33 : fit === "tux" ? 0x0d0d10 : 0x15161a, roughness: 0.8, bumpMap: weave, bumpScale: 0.35 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) });
  // ── 뼈 ──
  const B = {}; BN.forEach(n => { const b = new THREE.Bone(); b.name = n; B[n] = b; });
  BN.forEach(n => { const [par, off] = REST[n]; B[n].position.copy(off); if (par) B[par].add(B[n]); });
  const restW = {}; { const acc = n => { const [par, off] = REST[n]; return par ? acc(par).add(off) : off.clone(); }; BN.forEach(n => (restW[n] = acc(n))); }
  const JK = TORSO[fit], NJ = 2.3;
  const torsoW = p => { const y = p.y, ax = Math.abs(p.x), side = p.x > 0 ? "L" : "R"; let w;
    if (y < 1.03) w = [[BI.hips, 1]]; else if (y < 1.2) w = mix(BI.hips, BI.spine, sm((y - 1.03) / 0.17)); else if (y < 1.37) w = mix(BI.spine, BI.chest, sm((y - 1.2) / 0.17)); else if (y < 1.5) w = [[BI.chest, 1]]; else w = mix(BI.chest, BI.neck, sm((y - 1.5) / 0.04) * 0.4);
    const sh = sm((ax - 0.13) / 0.09) * sm((y - 1.33) / 0.1) * 0.6; if (sh > 0) { w = w.map(q => [q[0], q[1] * (1 - sh)]); w.push([BI["arm" + side], sh]); } return w; };
  const legW = side => p => { const y = p.y, T = BI["thigh" + side], S = BI["shin" + side], Fb = BI["foot" + side]; if (y > 0.9) return mix(T, BI.hips, sm((y - 0.9) / 0.14) * 0.5); if (y > 0.57) return [[T, 1]]; if (y > 0.45) return mix(T, S, sm((0.57 - y) / 0.12)); if (y > 0.16) return [[S, 1]]; return mix(S, Fb, sm((0.16 - y) / 0.06) * 0.3); };
  const legR = x0 => vRings([[1.06, 0.11, 0.118, -0.01], [0.98, 0.12, 0.126, -0.012], [0.89, 0.114, 0.12, -0.006], [0.76, 0.1, 0.106, 0], [0.64, 0.09, 0.094, 0.004], [0.54, 0.084, 0.09, 0.006], [0.46, 0.082, 0.086, 0], [0.33, 0.08, 0.082, 0], [0.2, 0.08, 0.084, 0.004], [0.122, 0.088, 0.092, 0.012], [0.112, 0.082, 0.086, 0.012]], x0, 2.05);
  const armRings = (side, list, k = 1) => { const s0 = restW["arm" + (side > 0 ? "L" : "R")], d = armDir(side), u = V(Math.cos(AO), Math.sin(AO) * side, 0).multiplyScalar(side > 0 ? 1 : -1); return list.map(([s, ax, az]) => ({ c: s0.clone().addScaledVector(d, s), a: d, u, ax: ax * k, az: az * k, n: 2, s })); };
  const armW = side => p => { const S = side > 0 ? "L" : "R", s = p.clone().sub(restW["arm" + S]).dot(armDir(side)), A = BI["arm" + S], Fo = BI["fore" + S], H = BI["hand" + S]; if (s < 0.05) return mix(A, BI.chest, sm((0.05 - s) / 0.1) * 0.45); if (s < 0.27) return [[A, 1]]; if (s < 0.37) return mix(A, Fo, sm((s - 0.27) / 0.1)); if (s < 0.57) return [[Fo, 1]]; return mix(Fo, H, sm((s - 0.57) / 0.04) * 0.3); };
  // 재질 번호: 0 윗옷 · 1 바지 · 2 피부 · 3 흰 셔츠
  const parts = [[tubeGeo(vRings(JK, 0, NJ), 40, torsoW), 0], [tubeGeo(legR(0.115), 22, legW("L")), 1], [tubeGeo(legR(-0.115), 22, legW("R")), 1]];
  for (const side of [1, -1]) {
    if (fit === "tee") { parts.push([tubeGeo(armRings(side, SHORT, W.slvK), 20, armW(side)), 0]); parts.push([tubeGeo(armRings(side, BARE), 16, armW(side)), 2]); }
    else { parts.push([tubeGeo(armRings(side, SLV.map(([s, a, b]) => [s * (fit === "tux" ? 0.97 : 1), a, b]), W.slvK), 20, armW(side)), 0]);
      if (fit === "tux") parts.push([tubeGeo(armRings(side, [[0.535, 0.046, 0.043], [0.545, 0.05, 0.047], [0.592, 0.05, 0.046], [0.598, 0.036, 0.034]]), 18, armW(side)), 3]); }
  }
  // 앞판: 몸 표면을 따라 붙인 띠 (몸통과 같은 뼈 가중치)
  const ringAt = y => { let i = 0; while (i < JK.length - 2 && y < JK[i + 1][0]) i++; const a = JK[i], b = JK[i + 1], t = clamp((a[0] - y) / (a[0] - b[0]), 0, 1); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; };
  const zS = (x, y) => { const [ax, az, zo] = ringAt(y); return zo + az * Math.pow(Math.max(0, 1 - Math.pow(Math.min(Math.abs(x) / ax, 1), NJ)), 1 / NJ); };
  function patch(rows, off, mi, nx = 8) { const pos = [], uv = [], idx = [], si = [], sw = [];
    rows.forEach(([y, x0, x1]) => { for (let i = 0; i <= nx; i++) { const x = lerp(x0, x1, i / nx), p = V(x, y, zS(x, y) + off); pos.push(p.x, p.y, p.z); uv.push(x * 8, y * 8); const w = torsoW(p).filter(q => q[1] > 0.001).sort((c, d) => d[1] - c[1]).slice(0, 4), tot = w.reduce((c, q) => c + q[1], 0) || 1; for (let j = 0; j < 4; j++) { si.push(w[j] ? w[j][0] : 0); sw.push(w[j] ? w[j][1] / tot : 0); } } });
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals(); parts.push([g, mi]); }
  const rowsOf = (y0, y1, n, f) => Array.from({ length: n + 1 }, (_, i) => { const y = lerp(y0, y1, i / n), [a, b] = f(y, i / n); return [y, a, b]; });
  const satin = new THREE.MeshPhysicalMaterial({ color: 0x060607, roughness: 0.22, clearcoat: 0.55, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: new THREE.Color(0x50505a) });
  if (fit === "tux") { const vH = y => lerp(0.082, 0.008, Math.pow(clamp((1.535 - y) / 0.36, 0, 1), 0.85));
    patch(rowsOf(1.54, 1.175, 22, y => [-vH(y) - 0.004, vH(y) + 0.004]), 0.0018, 3, 10);
    for (const sd of [-1, 1]) { patch(rowsOf(1.54, 1.17, 22, (y, u) => { const v = vH(y), w = lerp(0.03, 0.062, Math.sin(Math.min(1, u * 1.6) * Math.PI / 2)) * (1 - 0.6 * Math.max(0, u - 0.65) / 0.35); return sd > 0 ? [v, v + w] : [-v - w, -v]; }), 0.0048, 4, 5); } }
  const body = new THREE.SkinnedMesh(mergeGeometries(parts.map(p => p[0]), true), [cloth, pants, skin, white, satin]); body.geometry.groups.forEach((g, i) => (g.materialIndex = parts[i][1]));
  body.add(B.hips); body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(BN.map(n => B[n]))); body.castShadow = body.receiveShadow = true; body.frustumCulled = false; root.add(body);
  const mesh = (g, m, par, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.frustumCulled = false; par.add(o); return o; };
  // ── 목 · 깃 ──
  const neckM = new THREE.MeshStandardMaterial({ color: W.neck, roughness: 0.6, emissive: new THREE.Color(W.neck).multiplyScalar(0.5), emissiveIntensity: 0.3 });
  if (fit === "turtle") { const tn = mesh(new THREE.CylinderGeometry(0.083, 0.098, 0.15, 28), cloth, B.neck); tn.position.y = 0.01; const roll = mesh(new THREE.TorusGeometry(0.086, 0.014, 10, 28), cloth, B.neck); roll.rotation.x = Math.PI / 2; roll.position.y = 0.08; }
  else { const nk = mesh(new THREE.CylinderGeometry(0.074, 0.092, 0.16, 24), neckM, B.neck); nk.position.y = 0.012; }
  if (fit === "tux") { // 흰 셔츠 깃 (뒤에서 잘 보임) + 재킷 깃
    const sc = mesh(new THREE.CylinderGeometry(0.068, 0.084, 0.07, 28, 1, true), white, B.neck); sc.position.set(0, -0.012, -0.004); sc.material.side = THREE.DoubleSide;
    // 나비넥타이 · 단추 (가슴뼈에 붙임)
    const bs = new THREE.Shape(); bs.moveTo(0, 0); bs.lineTo(0.052, 0.024); bs.quadraticCurveTo(0.06, 0, 0.052, -0.024); bs.lineTo(0, 0); bs.lineTo(-0.052, -0.024); bs.quadraticCurveTo(-0.06, 0, -0.052, 0.024); bs.lineTo(0, 0);
    const bow = new THREE.ExtrudeGeometry(bs, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 }); const zb = zS(0, 1.505);
    const bt = mesh(bow, satin, B.chest); bt.position.set(0, 1.505 - 1.33, zb + 0.004); const knot = mesh(new THREE.SphereGeometry(0.014, 12, 10), satin, B.chest); knot.scale.set(1, 1.1, 0.8); knot.position.set(0, 1.505 - 1.33, zb + 0.016);
    const btn = mesh(new THREE.SphereGeometry(0.009, 10, 8), satin, B.chest); btn.position.set(0, 1.15 - 1.33, zS(0, 1.15) + 0.004); }
  if (fit === "sweater" || fit === "tee") { const cr = mesh(new THREE.TorusGeometry(0.082, fit === "sweater" ? 0.016 : 0.011, 10, 32), cloth, B.chest); cr.rotation.x = Math.PI / 2; cr.position.set(0, 0.205, 0.006); }
  // ── 신발 ──
  const SG = fit === "turtle" ? shoeGeos(1.12, 0.03) : shoeGeos(1, 0.02);
  const shoeU = fit === "turtle" ? new THREE.MeshStandardMaterial({ color: 0x8e9095, roughness: 0.95, bumpMap: weave, bumpScale: 0.6 }) : new THREE.MeshPhysicalMaterial({ color: 0x0b0a09, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18 });
  const shoeS = fit === "turtle" ? new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color: 0x060505, roughness: 0.8 });
  for (const S of ["L", "R"]) { const g = new THREE.Group(); B["foot" + S].add(g); mesh(SG.sole, shoeS, g); mesh(SG.up, shoeU, g); }
  // ── 손 ──
  const HAND = [];
  hands.forEach((H, i) => { const side = i ? 1 : -1, S = side > 0 ? "L" : "R"; H.mesh.material = skin; H.mesh.castShadow = true;
    const orient = new THREE.Group(); orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    H.scene.position.copy(V().setFromMatrixPosition(H.restM.wrist)).negate(); orient.add(H.scene);
    const fr = new THREE.Group(), fd = armDir(-1), pn = V(Math.cos(AO), -Math.sin(AO), 0); fr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), fd, pn)); fr.add(orient);
    const holder = new THREE.Group(); holder.scale.setScalar(1.2); if (side > 0) holder.scale.x = -1.2; holder.add(fr); B["hand" + S].add(holder); HAND.push({ H, S, holder }); });
  const FIST = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] };
  const SPREAD = { index: 0.12, middle: 0.02, ring: -0.08, pinky: -0.2 };
  const handOf = S => HAND.find(q => q.S === S);
  // 쫙 편 손 (뺨 때리기): k 0 = 살짝 오므림 · 1 = 쭉 폄
  function flat(S, k = 1) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) h.H.setChain(n, [null, [lerp(-0.25, 0.04, k), SPREAD[n] * k, 0], [lerp(-0.25, 0.02, k), 0, 0], [lerp(-0.18, 0.02, k), 0, 0]]); h.H.setChain("thumb", [[lerp(-0.25, 0.05, k), lerp(0.2, 0.42, k), 0], [-0.05, 0, 0], [-0.05, 0, 0]]); }
  // 쥐기: 막대(닭다리 뼈) · 폰
  function hold(S, k = 1) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n]; h.H.setChain(n, [null, [f[0] * 0.92 * k, 0, 0], [f[1] * 0.78 * k, 0, 0], [f[2] * 0.7 * k, 0, 0]]); } h.H.setChain("thumb", [[-0.5 * k, 0.32 * k, 0], [-0.55 * k, 0, 0], [-0.45 * k, 0, 0]]); }
  function pinch(S, k = 1) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n], q = n === "index" || n === "middle" ? 0.45 : 0.8; h.H.setChain(n, [null, [f[0] * q * k, SPREAD[n] * 0.5, 0], [f[1] * q * 0.8 * k, 0, 0], [f[2] * q * 0.6 * k, 0, 0]]); } h.H.setChain("thumb", [[-0.3 * k, 0.5 * k, 0], [-0.25 * k, 0, 0], [-0.2 * k, 0, 0]]); }
  function relax(S) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) h.H.setChain(n, [null, [-0.3, SPREAD[n] * 0.5, 0], [-0.35, 0, 0], [-0.25, 0, 0]]); h.H.setChain("thumb", [[-0.1, 0.25, 0], [-0.15, 0, 0], [-0.1, 0, 0]]); }
  function thumbUp(S, k = 1) { const h = handOf(S); if (!h) return; for (const n of ["index", "middle", "ring", "pinky"]) { const f = FIST[n]; h.H.setChain(n, [null, [f[0] * k, 0, 0], [f[1] * k, 0, 0], [f[2] * k, 0, 0]]); } h.H.setChain("thumb", [[0.2 * k, -0.38 * k, 0], [0.12 * k, 0, 0], [0.12 * k, 0, 0]]); }

  // ── 머리: 사진 얼굴 + 뒤통수 껍데기 + 목 ──
  const HS = 1.2, headG = new THREE.Group(); headG.position.set(0, -0.058 + (W.headUp || 0), F.hz); headG.scale.setScalar(HS); B.head.add(headG);
  const tx = await new THREE.TextureLoader().loadAsync(F.url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
  const fg = new THREE.Group(); fg.rotation.y = F.yaw; headG.add(fg);
  const faceM = new THREE.MeshStandardMaterial({ map: tx, alphaMap: maskTex(F.P, F.crop, 1024, 2), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, color: F.col || 0x3c3c3c, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: F.emi || 0.76, roughness: 0.62 });
  mesh(relief(F.P, F.crop, F.S, F.C, F.B, { nx: 88, ny: 110, R: F.R, Z: F.Z, mar: 0.006 }), faceM, fg);
  { const [cx, cy, rx, ry, roll, rz, z0] = F.shell, sh = new THREE.SphereGeometry(1, 32, 22); sh.scale(rx, ry, rz); sh.rotateZ(roll); sh.translate((cx - F.C[0]) * F.S, (F.C[1] - cy) * F.S, z0 - 0.018);
    const hm = F.shellHair ? new THREE.MeshStandardMaterial({ color: F.shellC, map: hairTex(), bumpMap: buzzTex(), bumpScale: 0.6, roughness: 0.66 }) : new THREE.MeshStandardMaterial({ color: F.shellC, roughness: 0.55, emissive: new THREE.Color(F.shellC).multiplyScalar(0.4), emissiveIntensity: 0.3 });
    mesh(sh, hm, fg);
    // 정수리가 벗어진 머리 (잡스): 위쪽은 피부
    if (F.shellTop) { const cap = new THREE.SphereGeometry(1.012, 32, 12, 0, Math.PI * 2, 0, 0.95); cap.scale(rx, ry, rz); cap.rotateZ(roll); cap.translate((cx - F.C[0]) * F.S, (F.C[1] - cy) * F.S, z0 - 0.018); mesh(cap, new THREE.MeshStandardMaterial({ color: F.shellTop, roughness: 0.45, emissive: new THREE.Color(F.shellTop).multiplyScalar(0.35), emissiveIntensity: 0.4 }), fg); } }
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  function tint(c, k) { faceM.emissive.setRGB(1, 1, 1).lerp(c, k); }

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
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  // 손의 방향: F 손가락이 뻗는 쪽, N 손바닥이 보는 쪽 (root 기준)
  function handQ(S, Fd, N, out = new THREE.Quaternion()) { const side = S === "L" ? 1 : -1, f0 = armDir(side), n0 = V(-side * Math.cos(AO), -Math.sin(AO), 0), t0 = f0.clone().cross(n0), f = Fd.clone().normalize(), n = N.clone().addScaledVector(f, -N.dot(f)).normalize(), t = f.clone().cross(n); mA.makeBasis(f0, n0, t0).invert(); mB.makeBasis(f, n, t); return out.setFromRotationMatrix(mB.multiply(mA)); }
  const palmAt = (S, out = V()) => { const h = handOf(S).H.bones; const a = h["middle-finger-phalanx-proximal"].getWorldPosition(V()), b = h["wrist"].getWorldPosition(V()); return out.copy(a).lerp(b, 0.3); };
  // 손에 소품 붙이기: 손뼈 기준 · along 손가락 쪽 거리, out 손바닥 쪽 거리, 소품의 +y = 엄지 쪽(axis "thumb") 또는 손가락 쪽("finger"), +z = 손바닥 쪽
  function attach(S, obj, along, out, axis = "thumb") { const side = S === "L" ? 1 : -1, f0 = armDir(side), n0 = V(-side * Math.cos(AO), -Math.sin(AO), 0), th = f0.clone().cross(n0).multiplyScalar(-side);
    const y = axis === "thumb" ? th : f0, z = n0, x = y.clone().cross(z); obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); obj.position.copy(f0).multiplyScalar(along).addScaledVector(n0, out); B["hand" + S].add(obj); }
  return { who, HS, root, B, begin, sync, ik, leg, arm, setE, flat, hold, pinch, relax, thumbUp, handQ, palmAt, posOf, quatOf, tint, headG, restW, HAND, attach, faceM,
    dispose() { root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { for (const k of ["map", "alphaMap", "emissiveMap", "bumpMap", "roughnessMap"]) if (m[k] && m[k] !== tex) m[k].dispose(); m.dispose(); }); } }); } };
}

// ── 닭다리: 사진 굵기 그대로 돌려 깎은 몸 + 사진을 앞뒤로 입힘 (원점 = 뼈 끝 손잡이, +y = 살 쪽) ──
const CK = { A: [40, 208], B: [292, 66], ext: 11.5, prof: [[0, 17.5, 15.5], [0.025, 22.5, 22], [0.05, 26, 27], [0.075, 31, 29], [0.1, 32, 29.5], [0.125, 32.5, 28], [0.15, 32.5, 25], [0.175, 33, 23.5], [0.2, 33, 22], [0.225, 33.5, 20], [0.25, 34, 17.5], [0.275, 34.5, 16], [0.3, 36, 18], [0.325, 39.5, 21], [0.35, 41.5, 24], [0.375, 45.5, 26], [0.4, 48.5, 29], [0.425, 53, 32.5], [0.45, 57, 35], [0.475, 63, 36.5], [0.5, 65.5, 39], [0.525, 69, 40.5], [0.55, 71, 43], [0.575, 73, 44.5], [0.6, 73.5, 44.5], [0.625, 74.5, 45.5], [0.65, 76.5, 47.5], [0.675, 81, 47], [0.7, 83, 49.5], [0.725, 80.5, 50], [0.75, 77.5, 48], [0.775, 75.5, 47.5], [0.8, 74, 46.5], [0.825, 76, 45.5], [0.85, 75.5, 42], [0.875, 77.5, 40], [0.9, 77.5, 38.5], [0.925, 64.5, 29.5], [0.95, 49, 24], [0.975, 41, 12], [1, 30.5, 0]] };
export async function buildDrumstick(len = 0.3) {
  const tx = await new THREE.TextureLoader().loadAsync(urlCk).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
  const [ax0, ay0] = CK.A, [bx, by] = CK.B, L = Math.hypot(bx - ax0, by - ay0), ax = [(bx - ax0) / L, (by - ay0) / L], pr = [-ax[1], ax[0]], k = len / L, IW = 320, IH = 245;
  // 단면: 가운데 = (hi - lo)/2 만큼 치우침 · 반지름 = (lo + hi)/2 → 끝을 둥글게 막음
  const P = CK.prof.map(([s, lo, hi]) => [s, (lo + hi) / 2, (hi - lo) / 2]);
  const sm2 = []; for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[i], c = P[Math.min(P.length - 1, i + 1)]; sm2.push([b[0], (a[1] + b[1] * 2 + c[1]) / 4, (a[2] + b[2] * 2 + c[2]) / 4]); }
  const r0 = sm2[0][1], s0 = -CK.ext / L, rows = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; rows.push([s0 + (1 - Math.sin(a)) * (r0 / L) * 0.7 + 0, r0 * Math.sin(a) * 0.85 + 0.0001, sm2[0][2]]); }
  for (const q of sm2.slice(1, -3)) rows.push(q);
  const tail = sm2[sm2.length - 4], rT = tail[1]; for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; rows.push([tail[0] + Math.sin(a) * (rT / L) * 0.85, rT * Math.cos(a) + 0.0001, tail[2] * Math.cos(a)]); }
  const N = 40, pos = [], uv = [], idx = [];
  rows.forEach(([s, r, c]) => { for (let j = 0; j <= N; j++) { const ph = (j / N) * Math.PI * 2, lat = Math.sin(ph), dep = Math.cos(ph); const x = (c + r * lat) * k, z = r * dep * k * 0.86, y = s * L * k; pos.push(x, y, z); const ix = ax0 + ax[0] * s * L + pr[0] * (c + r * lat * 0.95), iy = ay0 + ax[1] * s * L + pr[1] * (c + r * lat * 0.95); uv.push(ix / IW, 1 - iy / IH); } });
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshPhysicalMaterial({ map: tx, color: 0x8a8a8a, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.42, roughness: 0.42, clearcoat: 0.75, clearcoatRoughness: 0.28, bumpMap: noiseTex(128, 3, 40, 1.2), bumpScale: 0.6 });
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.frustumCulled = false; const root = new THREE.Group(); root.add(mesh);
  return { root, mesh, len, dispose() { g.dispose(); m.dispose(); tx.dispose(); if (m.bumpMap) m.bumpMap.dispose(); } };
}

// ── 흰색 아이폰 4 (원점 = 가운데 · +y 위쪽 · +z 화면 쪽) ──
function rrect(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function homeScreen() {
  return canvasTex(256, 384, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#1b3a6b"); g.addColorStop(0.5, "#3a6fb0"); g.addColorStop(1, "#0d1f3c"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 3, 0, 7); x.fill(); }
    x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, w, 14); x.fillStyle = "#fff"; x.font = "bold 10px sans-serif"; x.textAlign = "center"; x.fillText("12:00", w / 2, 11);
    const cols = ["#4cd964", "#ff9500", "#5ac8fa", "#ff3b30", "#ffcc00", "#34aadc", "#8e8e93", "#ff2d55", "#5856d6", "#4cd964", "#ffcc00", "#ff9500", "#007aff", "#e0e0e0", "#ff3b30", "#5ac8fa"];
    const box = (cx, cy, c) => { const s = 40, r = 9; x.fillStyle = c; x.beginPath(); x.moveTo(cx - s / 2 + r, cy - s / 2); x.arcTo(cx + s / 2, cy - s / 2, cx + s / 2, cy + s / 2, r); x.arcTo(cx + s / 2, cy + s / 2, cx - s / 2, cy + s / 2, r); x.arcTo(cx - s / 2, cy + s / 2, cx - s / 2, cy - s / 2, r); x.arcTo(cx - s / 2, cy - s / 2, cx + s / 2, cy - s / 2, r); x.fill(); const gl = x.createLinearGradient(0, cy - s / 2, 0, cy); gl.addColorStop(0, "rgba(255,255,255,.45)"); gl.addColorStop(1, "rgba(255,255,255,.05)"); x.fillStyle = gl; x.fill(); };
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) box(34 + i * 63, 48 + j * 72, cols[j * 4 + i]);
    x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(0, h - 74, w, 74); ["#4cd964", "#5ac8fa", "#007aff", "#ff9500"].forEach((c, i) => box(34 + i * 63, h - 37, c)); }, true);
}
export function buildPhone() {
  const Wd = 0.0586, Hd = 0.1152, Dd = 0.0093, R = 0.0085, root = new THREE.Group();
  const band = new THREE.ExtrudeGeometry(rrect(Wd, Hd, R), { depth: Dd * 0.62, bevelEnabled: true, bevelThickness: 0.0009, bevelSize: 0.0006, bevelSegments: 3, curveSegments: 10 }); band.translate(0, 0, -Dd * 0.31);
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd9dbe0, metalness: 1, roughness: 0.22, clearcoat: 0.4 });
  const front = new THREE.ShapeGeometry(rrect(Wd - 0.0012, Hd - 0.0012, R * 0.92), 10), back = front.clone();
  const fm = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }), bm = fm.clone();
  const scr = new THREE.PlaneGeometry(0.0495, 0.0742), sm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: homeScreen(), emissiveIntensity: 0.9, roughness: 0.05, metalness: 0 });
  const btn = new THREE.CircleGeometry(0.0052, 28), btnM = new THREE.MeshStandardMaterial({ color: 0xe6e6e4, roughness: 0.3 }), ring = new THREE.RingGeometry(0.0052, 0.0058, 28), ringM = new THREE.MeshStandardMaterial({ color: 0xb8b8b6, roughness: 0.4 });
  const slot = new THREE.PlaneGeometry(0.009, 0.0012), slotM = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
  const add = (g, m, z, y = 0, flip = false) => { const o = new THREE.Mesh(g, m); o.position.set(0, y, z); if (flip) o.rotation.y = Math.PI; o.castShadow = true; o.frustumCulled = false; root.add(o); return o; };
  add(band, steel, 0); add(front, fm, Dd / 2 + 0.0003); add(back, bm, -Dd / 2 - 0.0003, 0, true); add(scr, sm, Dd / 2 + 0.0006, 0.002); add(btn, btnM, Dd / 2 + 0.0007, -0.0485); add(ring, ringM, Dd / 2 + 0.0007, -0.0485); add(slot, slotM, Dd / 2 + 0.0007, 0.049);
  const cam = add(new THREE.CircleGeometry(0.0022, 20), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 }), -Dd / 2 - 0.0006, 0.05, true); cam.position.x = -0.02;
  return { root, size: [Wd, Hd, Dd], dispose() { root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const m = o.material; if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); } }); } };
}
