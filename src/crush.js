// 손으로 짓누르기 (3D): 장갑 낀 손이 달력 조각을 빨아들여 꾸겨 쥐고 → 펴면 쇠공 → 누르면 총알이 날아와 박살
// 좌표: 화면 픽셀 = 월드 단위. z=0 평면이 화면과 1:1로 겹치도록 카메라를 놓아서 2D 조각을 그대로 이어받음.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const sstep = x => x * x * (3 - 2 * x);
const eOut = t => 1 - Math.pow(1 - t, 3), eIn = t => t * t * t, eInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = sstep(x - xi), v = sstep(y - yi), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const ridged = (x, y) => 1 - Math.abs(vnoise(x, y) * 2 - 1);
const buzz = s => { try { Haptics.impact({ style: s === 3 ? ImpactStyle.Heavy : s === 2 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {}); } catch (e) {} };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ── 소리 (WebAudio 합성) ──
function makeSound(get) {
  const A = () => get && get();
  const noise = (a, t, type, f0, f1, q, gain, att, dur) => {
    const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain();
    s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  };
  const tone = (a, t, type, f0, f1, gain, att, dur) => {
    const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.out); o.start(t); o.stop(t + dur + 0.05);
  };
  const ring = (a, t, f0, gain, decay) => [1, 2.32, 4.25, 6.63, 9.4].forEach((m, i) => tone(a, t, "sine", f0 * m, f0 * m * 0.995, gain / (1 + i * 1.3), 0.002, decay / (1 + i * 0.5)));
  return {
    whoosh(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 260, 2600, 0.9, 0.42, d * 0.7, d); noise(a, t, "lowpass", 120, 420, 0.7, 0.35, d * 0.6, d); },
    crumple(k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime; for (let i = 0; i < 7; i++) noise(a, t + rnd(0, 0.14), "bandpass", rnd(1400, 5200), rnd(900, 3000), rnd(1, 3), rnd(0.05, 0.16) * k, 0.003, rnd(0.02, 0.05)); },
    thud() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 95, 38, 0.9, 0.006, 0.32); noise(a, t, "lowpass", 900, 140, 0.7, 0.5, 0.005, 0.25); },
    crunch(k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime;
      for (let i = 0; i < 24; i++) noise(a, t + rnd(0, 0.28), "bandpass", rnd(700, 4200), rnd(500, 2500), rnd(1, 4), rnd(0.08, 0.26) * k, 0.002, rnd(0.02, 0.07));
      noise(a, t, "lowpass", 260, 90, 0.8, 0.55 * k, 0.01, 0.4); tone(a, t, "sawtooth", 62, 48, 0.12 * k, 0.02, 0.3); },
    ting() { const a = A(); if (!a) return; ring(a, a.c.currentTime, 1880, 0.32, 1.6); },
    bang() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "highpass", 1400, 900, 0.7, 1.0, 0.002, 0.16); noise(a, t, "lowpass", 900, 120, 0.7, 0.95, 0.003, 0.55); tone(a, t, "sine", 160, 40, 0.9, 0.003, 0.35); },
    slowmo() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 70, 42, 0.5, 0.15, 1.4); noise(a, t, "lowpass", 200, 80, 0.8, 0.35, 0.2, 1.4); },
    impact() { const a = A(); if (!a) return; const t = a.c.currentTime; ring(a, t, 410, 0.55, 2.2); tone(a, t, "sine", 120, 30, 0.8, 0.004, 0.9); noise(a, t, "lowpass", 600, 60, 0.6, 0.7, 0.01, 1.2); },
    shatter() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "highpass", 3200, 2000, 0.7, 0.9, 0.002, 0.35); noise(a, t, "bandpass", 2400, 900, 1.2, 0.6, 0.004, 0.6); ring(a, t, 690, 0.35, 1.2);
      for (let i = 0; i < 46; i++) { const f = rnd(2600, 8200); tone(a, t + 0.05 + Math.pow(Math.random(), 1.6) * 1.8, "sine", f, f * 0.99, rnd(0.02, 0.07), 0.001, rnd(0.04, 0.16)); } },
    tink(k) { const a = A(); if (!a) return; const t = a.c.currentTime, f = rnd(3000, 9000); tone(a, t, "sine", f, f * 0.99, 0.05 * k, 0.001, rnd(0.03, 0.09)); },
  };
}

// ── 질감용 작은 텍스처 ──
function noiseTex(size, rep, amp) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), im = x.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const u = i % size, v = (i / size) | 0, n = 128 + (vnoise(u * 0.35, v * 0.35) - 0.5) * amp + (Math.random() - 0.5) * amp * 0.6 + ((u + v) % 4 < 2 ? 6 : -6); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = n; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
function radialTex(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── 장갑 낀 손 (손바닥이 카메라 쪽 +z, 손가락은 +y, 오른손이라 엄지는 +x) ──
const FINGERS = [
  { x: 0.33, y: 0.46, len: [0.4, 0.26, 0.21], r: [0.112, 0.104, 0.096], spread: -0.14, curl: [1.5, 1.72, 1.15] },
  { x: 0.11, y: 0.5, len: [0.45, 0.29, 0.23], r: [0.116, 0.108, 0.1], spread: -0.04, curl: [1.52, 1.75, 1.15] },
  { x: -0.11, y: 0.48, len: [0.42, 0.27, 0.21], r: [0.112, 0.104, 0.096], spread: 0.06, curl: [1.55, 1.75, 1.15] },
  { x: -0.32, y: 0.41, len: [0.33, 0.21, 0.18], r: [0.098, 0.092, 0.086], spread: 0.18, curl: [1.6, 1.72, 1.1] },
];
function basis(dir, curlToward) {   // 손가락 방향(y)과 굽는 쪽(z)으로 회전 만들기
  const y = dir.clone().normalize(), x = new THREE.Vector3().crossVectors(y, curlToward).normalize(), z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function buildHand(S, dark) {
  const fabric = noiseTex(128, 3, 26);
  const glove = new THREE.MeshPhysicalMaterial({ color: 0xf3f0ea, roughness: 0.72, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), bumpMap: fabric, bumpScale: 0.9 });
  const stitch = new THREE.MeshStandardMaterial({ color: 0x8d8a85, roughness: 0.9 });
  const sleeve = new THREE.MeshStandardMaterial({ color: dark ? 0x3b4a6b : 0x27324a, roughness: 0.82, bumpMap: fabric, bumpScale: 1.2 });
  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(S); root.add(body);
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };
  // 손바닥 · 엄지 두덩 · 새끼 두덩
  body.add(mesh(new RoundedBoxGeometry(1, 1.05, 0.42, 6, 0.19), glove));
  const pad = (x, y, z, sx, sy, sz) => { const o = mesh(new THREE.SphereGeometry(1, 28, 20), glove); o.position.set(x, y, z); o.scale.set(sx, sy, sz); body.add(o); return o; };
  pad(0.3, -0.16, 0.1, 0.3, 0.36, 0.17); pad(-0.31, -0.14, 0.08, 0.22, 0.34, 0.14); pad(0, 0.38, 0.07, 0.48, 0.14, 0.15);
  // 손등 바느질 세 줄
  for (const x of [-0.2, 0, 0.2]) { const s = mesh(new THREE.CapsuleGeometry(0.013, 0.46, 4, 8), stitch); s.position.set(x, 0.05, -0.205); body.add(s); }
  // 소매 끝(접힌 장갑 목) · 팔
  const cuff = mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.26, 40), glove); cuff.position.y = -0.64; body.add(cuff);
  const roll = mesh(new THREE.TorusGeometry(0.475, 0.055, 14, 44), glove); roll.rotation.x = Math.PI / 2; roll.position.y = -0.51; body.add(roll);
  const arm = mesh(new THREE.CylinderGeometry(0.49, 0.6, 3.2, 40), sleeve); arm.position.y = -0.77 - 1.6; body.add(arm);
  // 손가락: 마디 사이가 이음매 없이 매끈하게 굽도록 손가락 하나를 한 메시로 만들고 뼈 3개로 굽힘 (관절은 살짝 볼록)
  const finger = (len, r) => {
    const L = len[0] + len[1] + len[2], tip = r[2], j1 = len[0], j2 = len[0] + len[1], y0 = -r[0] * 0.8, pts = [new THREE.Vector2(0.001, y0)];
    const rad = y => lerp(r[0], r[2], clamp(y / L, 0, 1)) + r[0] * 0.07 * (Math.exp(-(((y - j1) / (r[0] * 0.7)) ** 2)) + Math.exp(-(((y - j2) / (r[0] * 0.7)) ** 2)));
    for (let i = 0; i <= 30; i++) { const y = y0 + (L - tip - y0) * i / 30; pts.push(new THREE.Vector2(rad(y), y)); }
    for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * rad(L - tip)), L - tip + Math.sin(a) * tip)); }
    const g = new THREE.LatheGeometry(pts, 28), p = g.attributes.position, si = [], sw = [], b = r[0] * 0.6;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), t1 = sstep(clamp((y - j1 + b) / (2 * b), 0, 1)), t2 = sstep(clamp((y - j2 + b) / (2 * b), 0, 1)); si.push(0, 1, 2, 0); sw.push(1 - t1, t1 - t2, t2, 0); }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    const bones = [new THREE.Bone(), new THREE.Bone(), new THREE.Bone()]; bones[1].position.y = j1; bones[2].position.y = len[1]; bones[0].add(bones[1]); bones[1].add(bones[2]);
    const m = new THREE.SkinnedMesh(g, glove); m.add(bones[0]); m.bind(new THREE.Skeleton(bones)); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    return { m, bones };
  };
  const fingers = FINGERS.map(F => { const base = new THREE.Group(); base.position.set(F.x, F.y, 0); body.add(base); const f = finger(F.len, F.r); base.add(f.m); return { F, base, joints: f.bones }; });
  // 엄지: 펼 때는 오른쪽 위로, 쥘 때는 접은 손가락 앞을 가로질러 왼쪽으로
  const tBase = new THREE.Group(); tBase.position.set(0.4, -0.2, 0.08); body.add(tBase);
  const th = finger([0.3, 0.25, 0.21], [0.135, 0.125, 0.112]), tJ = th.bones; tBase.add(th.m);
  const qOpen = basis(V(0.78, 0.55, 0.3), V(-0.5, -0.15, 0.85)), qClosed = basis(V(-0.55, 0.62, 0.62), V(-0.15, -0.55, -0.8)), qTmp = new THREE.Quaternion();
  // pose: curl 0(펴짐)~1(주먹), spread 벌림, thumb 엄지 접힘, squeeze 꽉 쥐기 정도
  function pose(curl, spread, thumb, squeeze = 0) {
    for (const { F, base, joints } of fingers) {
      base.rotation.z = F.spread * spread;
      joints.forEach((j, k) => (j.rotation.x = lerp([0.1, 0.12, 0.08][k], F.curl[k], curl) + squeeze * [0.1, 0.12, 0.06][k]));
    }
    tBase.quaternion.copy(qTmp.copy(qOpen).slerp(qClosed, thumb));
    tJ[1].rotation.x = lerp(0.12, 0.42, thumb) + squeeze * 0.12; tJ[2].rotation.x = lerp(0.1, 0.55, thumb) + squeeze * 0.1;
    body.scale.set(S * (1 - squeeze * 0.035), S * (1 - squeeze * 0.02), S * (1 + squeeze * 0.02));
  }
  return { root, body, pose, mats: [glove, stitch, sleeve], tex: [fabric] };
}

// ── 달력 조각 → 꾸겨지는 종이 ──
const texCache = new Map();
function makePaper(p) {
  const sx = clamp(Math.round(p.W / 9), 4, 18), sy = clamp(Math.round(p.H / 9), 4, 18);
  const geo = new THREE.PlaneGeometry(p.W, p.H, sx, sy);
  let tex = texCache.get(p.tex);
  if (!tex) { tex = new THREE.CanvasTexture(p.tex); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texCache.set(p.tex, tex); }
  // 처음엔 빛을 받지 않고 원래 색 그대로(emissive) → 꾸겨질수록 빛을 받아 주름이 드러남
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, color: 0x000000, roughness: 0.82, side: THREE.DoubleSide, alphaTest: 0.4, flatShading: true, toneMapped: false, transparent: p.alpha < 1, opacity: p.alpha });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.frustumCulled = false;
  const pos = geo.attributes.position, n = pos.count, R = Math.sqrt(p.W * p.H) * 0.23, seed = rnd(0, 500);
  const bx = new Float32Array(n), by = new Float32Array(n), tg = new Float32Array(n * 3), wr = new Float32Array(n), wx = new Float32Array(n), wy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), u = x / p.W, v = y / p.H; bx[i] = x; by[i] = y;
    // 종이 가운데가 앞쪽 극, 가장자리가 뒤로 말려 들어가는 공 + 접힌 자국(ridged noise)
    const m = Math.max(Math.abs(u), Math.abs(v)) * 2, r = Math.min(1, Math.hypot(u, v) * 1.414), th = (m * 0.6 + r * 0.4) * Math.PI * 0.93, ph = Math.atan2(y, x);
    const crease = ridged(u * 3.2 + seed, v * 3.2) * 0.55 + ridged(u * 7.5 + seed * 2, v * 7.5 - seed) * 0.3, rad = R * (0.72 + 0.5 * crease);
    tg[i * 3] = Math.sin(th) * Math.cos(ph) * rad; tg[i * 3 + 1] = Math.sin(th) * Math.sin(ph) * rad; tg[i * 3 + 2] = Math.cos(th) * rad;
    wr[i] = vnoise(u * 4 + seed, v * 4) * 2 - 1 + (ridged(u * 9 - seed, v * 9) - 0.5); wx[i] = vnoise(u * 5, v * 5 + seed) - 0.5; wy[i] = vnoise(u * 5 + 9, v * 5 - seed) - 0.5;
  }
  return { p, mesh, geo, mat, n, bx, by, tg, wr, wx, wy, R, c: -1 };
}
function crumple(pp, c) {
  if (Math.abs(c - pp.c) < 0.002) return; pp.c = c;
  const P = pp.geo.attributes.position.array, e = sstep(c), s = Math.sin(Math.PI * Math.min(1, c * 1.15)) * pp.R;
  for (let i = 0; i < pp.n; i++) {
    const w = pp.wr[i] * s;
    P[i * 3] = pp.bx[i] + (pp.tg[i * 3] - pp.bx[i]) * e + pp.wx[i] * s * 0.7;
    P[i * 3 + 1] = pp.by[i] + (pp.tg[i * 3 + 1] - pp.by[i]) * e + pp.wy[i] * s * 0.7;
    P[i * 3 + 2] = pp.tg[i * 3 + 2] * e + w * 0.85;
  }
  pp.geo.attributes.position.needsUpdate = true;
  const lit = Math.min(1, c * 2.4); pp.mat.color.setScalar(0.95 * lit); pp.mat.emissiveIntensity = 1 - 0.8 * lit;
}

// 준비(셰이더 미리 컴파일)가 끝나면 첫 화면을 그리고 돌아옴 → 호출한 쪽은 그때 2D를 지우면 끊김이 없음
export async function startCrush({ pieces, sfx, onDone }) {
  const vw = innerWidth, vh = innerHeight, dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const snd = makeSound(sfx);
  // ── 렌더러 · 카메라 · 빛 ──
  const cv = document.createElement("canvas"); cv.id = "gCrush"; document.body.append(cv);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(vw, vh, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex; scene.environmentIntensity = 0.62;
  const fov = 35, D = vh / 2 / Math.tan((fov / 2) * Math.PI / 180), M = Math.max(vw, vh);
  const cam = new THREE.PerspectiveCamera(fov, vw / vh, 20, D * 5); cam.position.set(0, 0, D);
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x30384a : 0x9aa3b2, 1.1));
  const key = new THREE.DirectionalLight(0xfff4e8, 2.7); key.position.set(-0.45 * D, 0.75 * D, 1.15 * D); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -M * 0.8, right: M * 0.8, top: M * 0.8, bottom: -M * 0.8, near: D * 0.4, far: D * 3.2 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.8; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc6d8ff, 1.5); rim.position.set(0.7 * D, 0.35 * D, -0.5 * D); scene.add(rim);
  // 뒤 벽과 바닥은 그림자만 받음 (그림자는 시작할 때 서서히 생김 → 2D 달력에서 끊김 없이)
  const SHADOW = dark ? 0.35 : 0.17, FLOOR = -vh * 0.36;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(vw * 4, vh * 4), new THREE.ShadowMaterial({ opacity: 0 })); wall.position.z = -30; wall.receiveShadow = true; scene.add(wall);
  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(vw * 4, D * 2), new THREE.ShadowMaterial({ opacity: SHADOW * 1.3 })); floorM.rotation.x = -Math.PI / 2; floorM.position.set(0, FLOOR, D * 0.4); floorM.receiveShadow = true; floorM.visible = false; scene.add(floorM);
  const toWorld = (x, y) => V(x - vw / 2, vh / 2 - y, 0);

  // ── 화면 위 글자·버튼 ──
  const ui = document.createElement("div"); ui.id = "gCrushUI";
  ui.innerHTML = `<div class="cr-title" hidden>쏘세요</div><div class="cr-vig"></div><div class="cr-flash"></div><button class="cr-again" hidden>다시 하기</button>`;
  document.body.append(ui);
  const title = ui.querySelector(".cr-title"), vig = ui.querySelector(".cr-vig"), flash = ui.querySelector(".cr-flash"), again = ui.querySelector(".cr-again");
  document.documentElement.classList.add("crush-on");

  // ── 손 ──
  const S = Math.min(vw * 0.42, vh * 0.22), hand = buildHand(S, dark);
  const HY = -vh * 0.03, HZ = 90, startY = -vh / 2 - S * 2.2;
  hand.root.position.set(0, startY, HZ); scene.add(hand.root); hand.pose(0, 1, 0);
  const clump = new THREE.Group(); hand.root.add(clump);
  const clumpHome = V(0, S * 0.08, S * 0.21);

  // ── 종이 ──
  const papers = pieces.map(makePaper), N = papers.length;
  const palmW = V(0, HY + S * 0.08, HZ + S * 0.3);
  papers.forEach(pp => {
    const p = pp.p, w = toWorld(p.cx, p.cy); pp.mesh.position.copy(w); pp.mesh.rotation.z = -p.th; pp.q0 = pp.mesh.quaternion.clone(); pp.p0 = w;
    pp.dist = w.distanceTo(palmW); crumple(pp, 0); scene.add(pp.mesh);
  });
  papers.sort((a, b) => a.dist - b.dist);
  // 손바닥 앞 덩어리 속 자리 (공 모양으로 쌓임)
  const rAvg = papers.reduce((a, pp) => a + pp.R, 0) / Math.max(1, N), Rc = Math.max(S * 0.16, rAvg * Math.cbrt(N) * 0.95);
  const SUCK = 0.6, SPAN = Math.min(1.25, 0.25 + N * 0.022), FLY = 0.78;
  papers.forEach((pp, i) => {
    const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-0.2, 1)).normalize(), r = Math.cbrt((i + 0.5) / N) * Rc;
    pp.slot = d.multiplyScalar(Math.max(0, r - pp.R * 0.4));
    pp.t0 = SUCK + (i / Math.max(1, N - 1)) * SPAN + rnd(-0.03, 0.03); pp.t1 = pp.t0 + FLY * rnd(0.85, 1.12);
    const side = V(-(palmW.y - pp.p0.y), palmW.x - pp.p0.x, 0).normalize().multiplyScalar(pp.dist * rnd(-0.45, 0.45));
    pp.ctrl = pp.p0.clone().lerp(palmW, 0.35).add(side).add(V(0, 0, rnd(60, 220)));
    pp.axis = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); pp.spin = rnd(4, 9) * (Math.random() < 0.5 ? -1 : 1); pp.landed = false; pp.sounded = false;
  });
  const T_SUCKED = Math.max(...papers.map(pp => pp.t1), SUCK + 0.6) + 0.12;
  const T = { close: T_SUCKED, closed: T_SUCKED + 0.38, turn: T_SUCKED + 0.5, pulses: [T_SUCKED + 0.85, T_SUCKED + 1.3, T_SUCKED + 1.78], reveal: T_SUCKED + 2.35 };
  T.open = T.reveal + 0.38; T.lift = T.open + 0.42; T.float = T.lift + 0.85;

  // ── 소용돌이 바람 줄: 손바닥 주위를 돌며 빨려 들어가는 짧은 나선 (꼬리로 갈수록 흐려짐) ──
  const NS = 70, NSEG = 6, streakPos = new Float32Array(NS * NSEG * 6), streakCol = new Float32Array(NS * NSEG * 8), streaks = [];
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3)); sGeo.setAttribute("color", new THREE.BufferAttribute(streakCol, 4));
  const sMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const streakLines = new THREE.LineSegments(sGeo, sMat); streakLines.frustumCulled = false; hand.root.add(streakLines);
  const sc0 = new THREE.Color(dark ? 0xe6edff : 0x2c3a58);
  for (let i = 0; i < NS; i++) streaks.push({ a: rnd(0, 6.28), off: rnd(0, 1), h: rnd(-0.5, 0.9), sp: rnd(0.9, 1.5), ry: rnd(0.65, 1) });

  // ── 꽉 쥘 때 주먹 둘레로 터지는 집중선 (만화처럼 '꽉!') ──
  // 쐐기 모양: 주먹 쪽은 뾰족, 바깥으로 갈수록 두꺼움
  const NI = 22, inkPos = new Float32Array(NI * 9), inkCol = new Float32Array(NI * 12), inkGeo = new THREE.BufferGeometry();
  inkGeo.setAttribute("position", new THREE.BufferAttribute(inkPos, 3)); inkGeo.setAttribute("color", new THREE.BufferAttribute(inkCol, 4));
  const ink = new THREE.Mesh(inkGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  ink.frustumCulled = false; ink.renderOrder = 5; scene.add(ink);
  const inkC = new THREE.Color(dark ? 0xffffff : 0x1b2230), inkA = Array.from({ length: NI }, (_, i) => (i / NI) * 6.283 + rnd(-0.12, 0.12)), inkL = Array.from({ length: NI }, () => rnd(0.22, 0.5));
  function inkPhase(t) {   // 마지막으로 쥔 순간부터 0.28초 동안 바깥으로 뻗으며 사라짐
    let u = 9, big = 0; T.pulses.forEach((pt, i) => { if (t >= pt && t - pt < u) { u = t - pt; big = i === 2 ? 1.25 : 1; } });
    const k = u < 0.28 ? 1 - u / 0.28 : 0, c = hand.root.localToWorld(V(0, S * 0.28, S * 0.45)), z = c.z + 30;
    for (let i = 0; i < NI; i++) {
      const a = inkA[i], r0 = S * (0.78 + 0.3 * (1 - k)) * big, r1 = r0 + S * inkL[i] * big, w = S * 0.022 * big / r1 * S;
      const P = (r, aa) => [c.x + Math.cos(aa) * r, c.y + Math.sin(aa) * r * 1.15, z];
      inkPos.set([...P(r0, a), ...P(r1, a - w / S), ...P(r1, a + w / S)], i * 9);
      const kk = Math.sin(a) < -0.6 ? 0 : 0.85 * k;   // 바로 아래(팔 쪽)로는 긋지 않음
      inkCol.set([inkC.r, inkC.g, inkC.b, 0, inkC.r, inkC.g, inkC.b, kk, inkC.r, inkC.g, inkC.b, kk], i * 12);
    }
    inkGeo.attributes.position.needsUpdate = inkGeo.attributes.color.needsUpdate = true;
    return k * big;
  }

  // ── 종이 부스러기 (꽉 쥘 때 손가락 사이로 튀어나옴) ──
  const NF = 260, flakeGeo = new THREE.PlaneGeometry(1, 1), flakeMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
  const flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, NF); flakes.castShadow = true; flakes.frustumCulled = false; scene.add(flakes);
  const fl = []; const colors = pieces.flatMap(p => p.colors || []).filter(Boolean); if (!colors.length) colors.push("#ffffff");
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), sc4 = V(), p4 = V();
  for (let i = 0; i < NF; i++) { fl.push({ life: 0 }); flakes.setMatrixAt(i, m4.makeScale(0, 0, 0)); flakes.setColorAt(i, col.set("#ffffff")); }
  const burstFlakes = (n, k) => { const c0 = hand.root.localToWorld(V(0, S * 0.32, S * 0.4));
    for (let j = 0; j < n; j++) { const i = fl.findIndex(f => f.life <= 0); if (i < 0) break; const a = rnd(0, 6.28), up = rnd(0.2, 1);
      fl[i] = { p: c0.clone().add(V(Math.cos(a) * S * 0.35, rnd(-0.2, 0.35) * S, rnd(0, 0.2) * S)), v: V(Math.cos(a) * rnd(150, 520) * k, up * rnd(150, 600) * k, rnd(40, 380) * k),
        r: V(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: V(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14)), s: rnd(3, 9) * (S / 160), life: rnd(1, 1.8) };
      flakes.setColorAt(i, col.set(Math.random() < 0.72 ? "#f4f2ec" : colors[(Math.random() * colors.length) | 0])); }   // 대부분 흰 종이, 가끔 일정 색
    flakes.instanceColor.needsUpdate = true; };

  // ── 쇠공 ──
  const rb = clamp(Math.min(vw, vh) * 0.085, 24, 48);
  const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.13, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 1.7, bumpMap: noiseTex(64, 2, 10), bumpScale: 0.25 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(rb, 64, 48), ballMat); ball.castShadow = true; ball.visible = false; hand.root.add(ball);
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,250,235,.6)"], [1, "rgba(255,240,210,0)"]]), transparent: true, depthWrite: false, opacity: 0 }));
  glint.scale.setScalar(rb * 4); scene.add(glint);
  const ballHome = V(0, 0, 40);

  // ── 총알 · 파편 ──
  const shot = { on: false };
  const bulletGeo = new THREE.LatheGeometry([V(0, 1.15), V(0.12, 1.1), V(0.27, 0.95), V(0.37, 0.72), V(0.42, 0.45), V(0.43, 0), V(0.4, -0.06), V(0.36, -0.08), V(0, -0.08)].map(v => new THREE.Vector2(v.x, v.y)), 40);
  const bullet = new THREE.Mesh(bulletGeo, new THREE.MeshPhysicalMaterial({ color: 0xc9844f, metalness: 1, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 1.6 }));
  bullet.scale.setScalar(rb * 1.05); bullet.castShadow = true; bullet.visible = false; scene.add(bullet);
  // 총알 꼬리: 위(총알 쪽)가 밝고 꼬리로 갈수록 투명
  const trailTex = (() => { const c = document.createElement("canvas"); c.width = 4; c.height = 128; const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(255,245,225,.95)"); g.addColorStop(0.25, "rgba(255,210,150,.55)"); g.addColorStop(1, "rgba(255,190,120,0)"); x.fillStyle = g; x.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.24, rb * 0.02, 1, 16, 1, true), new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  trail.visible = false; scene.add(trail);
  const rings = []; const ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 48);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: dark ? 0xcfe0ff : 0x7d93b8, transparent: true, opacity: 0.6, depthWrite: false });
  const flashSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, "rgba(255,255,245,1)"], [0.18, "rgba(255,228,160,.95)"], [0.45, "rgba(255,150,60,.5)"], [1, "rgba(255,90,20,0)"]]), transparent: true, depthWrite: false, opacity: 0 }));
  scene.add(flashSpr);
  const boomLight = new THREE.PointLight(0xffb066, 0, rb * 30, 0); scene.add(boomLight);
  const NFRAG = (navigator.hardwareConcurrency || 4) >= 6 ? 3200 : 2200;
  const fragGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 0), a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * rnd(0.55, 1.25), a.getY(i) * rnd(0.4, 1.3), a.getZ(i) * rnd(0.3, 1.1)); g.computeVertexNormals(); return g; })();
  const frags = new THREE.InstancedMesh(fragGeo, new THREE.MeshStandardMaterial({ color: 0xcfd3d9, metalness: 1, roughness: 0.28, flatShading: true, envMapIntensity: 1.6 }), NFRAG);
  frags.castShadow = true; frags.visible = false; frags.frustumCulled = false; scene.add(frags);
  const FR = []; const NSP = 320, spPos = new Float32Array(NSP * 6), spCol = new Float32Array(NSP * 8), sparks = [];
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute("color", new THREE.BufferAttribute(spCol, 4));
  const spLines = new THREE.LineSegments(spGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })); spLines.frustumCulled = false; scene.add(spLines);

  // ── 진행 ──
  let raf = 0, last = 0, tReal = 0, simT = 0, shake = 0, punch = 0, done = false, phase = "suck";
  const camBase = V(0, 0, D), look = V(0, 0, 0), camLook = V(0, 0, 0);
  const st = { get phase() { return phase; }, ball, cam, vw, vh, rb, T, debugT: null };
  if (import.meta.env.DEV) window.__crush = st;
  const pulseHit = new Set();

  function handPhase(t) {
    const H = hand.root; let curl = 0, spread = 1, thumb = 0, squeeze = 0;
    // 올라오기
    const rise = eBack(seg(t, 0, 0.7), 1.3);
    H.position.set(0, lerp(startY, HY, rise), HZ); H.rotation.set(lerp(0.35, 0.05, rise), 0, lerp(-0.18, 0, rise));
    // 빨아들이는 동안 살짝 떨림
    if (t > SUCK && t < T.close) { const k = Math.sin(Math.PI * seg(t, SUCK, T.close)); H.rotation.z += Math.sin(t * 38) * 0.012 * k; H.position.x += Math.sin(t * 51) * 1.4 * k; H.rotation.x += 0.05 * k; }
    // 주먹 쥐기
    const c = seg(t, T.close, T.closed); curl = eBack(c, 1.1); spread = 1 - c; thumb = eOut(seg(t, T.close + 0.08, T.closed + 0.1));
    // 주먹을 앞으로 돌려 들이밀고 세 번 꽉
    const turn = eInOut(seg(t, T.turn, T.turn + 0.3)) * (1 - eInOut(seg(t, T.reveal, T.reveal + 0.3)));
    H.rotation.y += -0.5 * turn; H.rotation.x += 0.22 * turn; H.position.z += 70 * turn; H.position.y += S * 0.15 * turn;
    for (const [i, pt] of T.pulses.entries()) {
      const u = t - pt; if (u < 0 || u > 0.45) continue;
      const amp = (i === 2 ? 1.25 : 0.85) * (u < 0.07 ? eOut(u / 0.07) : Math.exp(-(u - 0.07) * 7));
      squeeze = Math.max(squeeze, amp);
      H.rotation.z += Math.sin(t * 95 + i) * 0.03 * amp; H.position.x += Math.sin(t * 120) * 3.2 * amp; H.position.y += Math.cos(t * 107) * 2.4 * amp;
    }
    if (t > T.turn && t < T.reveal) { const k = seg(t, T.turn, T.pulses[0]); H.rotation.z += Math.sin(t * 70) * 0.006 * k; }   // 내내 힘이 들어가 미세하게 떨림
    // 손바닥을 위로 돌려 펴기
    const up = eInOut(seg(t, T.reveal, T.reveal + 0.35)); H.rotation.x += -0.62 * up; H.position.y += S * 0.2 * up;
    const o = seg(t, T.open, T.open + 0.42);
    if (o > 0) { const e = eBack(o, 1.4); curl = lerp(1, 0.05, e); spread = lerp(0, 0.8, e); thumb = lerp(1, 0.1, e); }
    // 공을 넘겨주고 아래로 사라지기
    const down = eIn(seg(t, T.lift + 0.15, T.lift + 0.85)); H.position.y -= (vh * 0.75 + S * 2) * down; H.rotation.x -= 0.4 * down;
    hand.pose(curl, spread, thumb, squeeze);
    return curl;
  }

  function papersPhase(t, curl) {
    hand.root.updateMatrixWorld(true);
    // 덩어리: 주먹 쥘 때 줄어들어 손 안으로
    const cs = lerp(1, 0.42, eInOut(seg(t, T.close - 0.05, T.closed)));
    clump.position.copy(clumpHome).add(V(0, 0, Rc * cs * 0.85)); clump.scale.setScalar(cs); clump.rotation.y = t * 0.6; clump.visible = t < T.closed + 0.05;
    const target = V();
    for (const pp of papers) {
      const m = pp.mesh;
      if (t < pp.t0) {   // 날아가기 직전 바르르 떨림
        const k = seg(t, pp.t0 - 0.22, pp.t0); m.position.copy(pp.p0).add(V(Math.sin(t * 90 + pp.dist) * 2.2 * k, Math.cos(t * 83) * 1.6 * k, 0)); m.quaternion.copy(pp.q0); crumple(pp, 0.04 * k); continue;
      }
      if (!pp.landed) {
        const u = seg(t, pp.t0, pp.t1), e = Math.pow(u, 2.1);
        target.copy(pp.slot).applyMatrix4(clump.matrixWorld);
        const a = pp.p0, b = pp.ctrl, c = target;
        m.position.set((1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * b.x + e * e * c.x, (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * b.y + e * e * c.y, (1 - e) * (1 - e) * a.z + 2 * (1 - e) * e * b.z + e * e * c.z);
        m.quaternion.copy(pp.q0).multiply(q4.setFromAxisAngle(pp.axis, pp.spin * e));
        crumple(pp, Math.min(1, sstep(clamp((u - 0.05) / 0.8, 0, 1))));
        if (!pp.sounded && u > 0.55) { pp.sounded = true; if (Math.random() < 0.6) snd.crumple(0.7); }
        if (u >= 1) { pp.landed = true; clump.attach(m); m.position.copy(pp.slot); crumple(pp, 1); buzz(1); }
      } else { m.position.copy(pp.slot).multiplyScalar(1 + Math.sin(t * 24 + pp.dist) * 0.02 * Math.exp(-(t - pp.t1) * 4)); }
    }
  }

  function streaksPhase(t) {
    const k = Math.sin(Math.PI * seg(t, SUCK - 0.1, T.close)); sMat.opacity = (dark ? 0.55 : 0.4) * k;
    if (k <= 0) return;
    const c0 = clumpHome.clone().add(V(0, 0, Rc * 0.8));
    streaks.forEach((s, i) => {
      const ph = (t * s.sp + s.off) % 1, fade = Math.sin(Math.PI * ph);
      for (let j = 0; j < NSEG; j++) {   // 머리(j=0)에서 꼬리로: 반지름은 커지고 각도는 뒤로
        const pt = q => { const r = lerp(S * 1.55, S * 0.12, Math.pow(Math.max(0, ph - q * 0.035), 1.3)), a = s.a + ph * 6 - q * 0.16; return [c0.x + Math.cos(a) * r, c0.y + Math.sin(a) * r * s.ry, c0.z + s.h * S * (1 - ph) * 0.5 + q * 2]; };
        const o = (i * NSEG + j) * 6, oc = (i * NSEG + j) * 8, A = fade * (1 - j / NSEG), B = fade * (1 - (j + 1) / NSEG);
        streakPos.set([...pt(j), ...pt(j + 1)], o); streakCol.set([sc0.r, sc0.g, sc0.b, A, sc0.r, sc0.g, sc0.b, B], oc);
      }
    });
    sGeo.attributes.position.needsUpdate = sGeo.attributes.color.needsUpdate = true;
  }

  function flakesPhase(dt) {
    let any = false;
    fl.forEach((f, i) => {
      if (f.life <= 0) return; any = true; f.life -= dt;
      f.v.y -= 1500 * dt; f.v.multiplyScalar(Math.exp(-1.2 * dt)); f.p.addScaledVector(f.v, dt); f.r.addScaledVector(f.w, dt);
      const s = f.life > 0 ? f.s * Math.min(1, f.life * 2) : 0;
      flakes.setMatrixAt(i, m4.compose(f.p, q4.setFromEuler(e4.set(f.r.x, f.r.y, f.r.z)), sc4.set(s, s * 0.8, s)));
    });
    if (any) flakes.instanceMatrix.needsUpdate = true;
  }

  function ballPhase(t) {
    if (t >= T.open - 0.05 && !ball.userData.shown) { ball.userData.shown = true; ball.visible = true; ball.position.copy(clumpHome).add(V(0, 0, rb * 0.9)); }
    if (!ball.visible) return;
    if (t < T.lift) { ball.rotation.y = t * 1.5; glint.material.opacity = 0; return; }
    if (ball.parent === hand.root) { scene.attach(ball); ball.userData.from = ball.position.clone(); snd.ting(); buzz(2); }
    const u = eInOut(seg(t, T.lift, T.float)), bob = t > T.float ? Math.sin((t - T.float) * 2.2) * 6 : 0;
    ball.position.copy(ball.userData.from).lerp(ballHome, u); ball.position.y += Math.sin(u * Math.PI) * 40 + bob;
    ball.rotation.y = t * 0.8; ball.rotation.x = Math.sin(t * 0.7) * 0.3;
    glint.position.copy(ball.position).add(V(-rb * 0.35, rb * 0.4, rb)); glint.material.opacity = (0.55 + 0.25 * Math.sin(t * 3)) * u;
    if (t >= T.float && phase === "suck") { phase = "float"; title.hidden = false; requestAnimationFrame(() => title.classList.add("on")); }
  }

  // ── 쏘기 ──
  function fire() {
    phase = "shot"; title.classList.remove("on"); snd.bang(); buzz(3);
    // 옆(왼쪽)에서 비스듬히 날아와 총알 옆모습이 보이게
    const dir = V(1, 0.1, -0.42).normalize(), start = ball.position.clone().addScaledVector(dir, -(vw * 0.62 + rb * 4));
    Object.assign(shot, { on: true, dir, start, pos: start.clone(), speed: D * 2.6, hit: false, ringAcc: 0, slowAt: 0 });
    bullet.visible = trail.visible = true; bullet.quaternion.setFromUnitVectors(V(0, 1, 0), dir); trail.quaternion.copy(bullet.quaternion);
    vig.classList.add("on"); snd.slowmo();
  }
  function explode() {
    shot.hit = true; bullet.visible = false; ball.visible = false; glint.visible = false; frags.visible = true;
    const C = ball.position.clone(), I = C.clone().addScaledVector(shot.dir, -rb);
    for (let i = 0; i < NFRAG; i++) {
      const p = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); if (p.lengthSq() > 1) { i--; continue; }
      p.multiplyScalar(rb * 0.95).add(C);
      const away = p.clone().sub(I).normalize(), near = 1 - Math.min(1, p.distanceTo(I) / (2 * rb)), back = Math.random() < 0.14;
      const v = back ? away.clone().reflect(shot.dir).multiplyScalar(-1).add(V(rnd(-0.4, 0.4), rnd(-0.2, 0.7), 0)).normalize().multiplyScalar(rnd(220, 800))
        : away.multiplyScalar(rnd(200, 950) * (0.6 + near)).addScaledVector(shot.dir, rnd(150, 800)).add(V(0, rnd(0, 380), 0));
      const big = Math.random() < 0.08, s = rb * (big ? rnd(0.11, 0.2) : 0.025 + Math.pow(Math.random(), 2.4) * 0.09);
      FR[i] = { p, v, r: V(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: V(rnd(-25, 25), rnd(-25, 25), rnd(-25, 25)), s: V(s * rnd(0.6, 1.4), s * rnd(0.5, 1.3), s * rnd(0.4, 1)), rest: false };
    }
    floorM.visible = true;
    for (let i = 0; i < NSP; i++) { const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().addScaledVector(shot.dir, -0.6).normalize(); sparks[i] = { p: I.clone(), v: d.multiplyScalar(rnd(400, 2200)), life: rnd(0.25, 0.8), max: 0 }; sparks[i].max = sparks[i].life; }
    flashSpr.position.copy(I); flashSpr.material.opacity = 1; boomLight.position.copy(I); boomLight.intensity = 9;
    shake = 26; snd.impact(); buzz(3); flash.classList.add("on"); setTimeout(() => flash.classList.remove("on"), 90);
    shot.hitReal = tReal;
  }
  function shotPhase(dt) {
    if (!shot.on) return;
    if (!shot.hit) {
      const total = shot.start.distanceTo(ball.position), left = shot.pos.distanceTo(ball.position);
      shot.pos.addScaledVector(shot.dir, shot.speed * dt);
      bullet.position.copy(shot.pos); bullet.rotateY(dt * 40);
      const tl = Math.min(total - left, rb * 9); trail.scale.set(1, tl, 1); trail.position.copy(shot.pos).addScaledVector(shot.dir, -tl / 2 - rb * 0.3);
      shot.ringAcc += shot.speed * dt;
      if (shot.ringAcc > rb * 2.2) { shot.ringAcc = 0; const r = new THREE.Mesh(ringGeo, ringMat()); r.position.copy(shot.pos).addScaledVector(shot.dir, -rb * 0.4); r.quaternion.setFromUnitVectors(V(0, 0, 1), shot.dir); r.scale.setScalar(rb * 0.5); r.userData.age = 0; scene.add(r); rings.push(r); }
      if (left <= rb * 0.75) explode();
    }
    rings.forEach(r => { r.userData.age += dt; const a = r.userData.age; r.scale.setScalar(rb * (0.5 + a * 9)); r.material.opacity = Math.max(0, 0.6 - a * 2.2); });
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].material.opacity <= 0) { scene.remove(rings[i]); rings[i].material.dispose(); rings.splice(i, 1); }
    if (!shot.hit) return;
    // 맞은 뒤 총알 꼬리는 빠르게 사라짐
    if (trail.visible) { trail.material.opacity = (trail.material.opacity ?? 1) - dt * 12; if (trail.material.opacity <= 0) trail.visible = false; }
    // 파편: 뒤 벽·화면 양옆에 튕기고 바닥에 떨어져 쌓임 (화면 밖으로 다 날아가 버리지 않게)
    const floor = FLOOR; let tinks = 0;
    for (let i = 0; i < NFRAG; i++) {
      const f = FR[i];
      if (!f.rest) {
        f.v.y -= 2300 * dt; f.v.multiplyScalar(Math.exp(-0.5 * dt)); f.p.addScaledVector(f.v, dt); f.r.addScaledVector(f.w, dt);
        if (f.p.z < -24) { f.p.z = -24; f.v.z = -f.v.z * 0.35; f.v.x *= 0.8; f.v.y *= 0.8; }
        if (f.p.z > D * 0.45) { f.p.z = D * 0.45; f.v.z = -Math.abs(f.v.z) * 0.3; }
        const side = (vw / 2 - 4) * (D - f.p.z) / D;
        if (Math.abs(f.p.x) > side) { f.p.x = Math.sign(f.p.x) * side; f.v.x = -f.v.x * 0.3; f.w.multiplyScalar(0.7); }
        if (f.p.y < floor + f.s.y) { f.p.y = floor + f.s.y; if (Math.abs(f.v.y) > 120 && tinks < 3 && Math.random() < 0.03) { tinks++; snd.tink(Math.min(1, Math.abs(f.v.y) / 900)); }
          f.v.y = -f.v.y * 0.32; f.v.x *= 0.7; f.v.z *= 0.7; f.w.multiplyScalar(0.55); if (Math.abs(f.v.y) < 60) { f.v.y = 0; if (f.v.lengthSq() < 900) f.rest = true; } }
      }
      frags.setMatrixAt(i, m4.compose(f.p, q4.setFromEuler(e4.set(f.r.x, f.r.y, f.r.z)), f.s));
    }
    frags.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NSP; i++) {
      const s = sparks[i]; if (!s || s.life <= 0) { spCol[i * 8 + 3] = spCol[i * 8 + 7] = 0; continue; }
      s.life -= dt; s.v.y -= 1600 * dt; s.v.multiplyScalar(Math.exp(-2 * dt)); s.p.addScaledVector(s.v, dt);
      const k = Math.max(0, s.life / s.max), tail = s.p.clone().addScaledVector(s.v, -0.022);
      spPos.set([s.p.x, s.p.y, s.p.z, tail.x, tail.y, tail.z], i * 6);
      spCol.set([1, 0.93, 0.7, k, 1, 0.55, 0.15, 0], i * 8);
    }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.color.needsUpdate = true;
    flashSpr.material.opacity = Math.max(0, flashSpr.material.opacity - dt * 4.5); flashSpr.scale.setScalar(rb * (3 + (1 - flashSpr.material.opacity) * 9));
    boomLight.intensity = Math.max(0, boomLight.intensity - dt * 24);
  }

  // 느린 화면: 총알이 다가올수록 느려지고, 맞는 순간 거의 멈췄다가 다시 빨라짐
  function timeScale() {
    if (!shot.on) return 1;
    if (!shot.hit) { const left = shot.pos.distanceTo(ball.position), total = shot.start.distanceTo(ball.position); return lerp(0.05, 0.2, clamp((left - rb * 2) / (total * 0.6), 0, 1)); }
    const u = tReal - shot.hitReal; if (u < 0.5) return 0.045;
    const s = eIn(seg(u, 0.5, 1.25)); if (s > 0.2 && !shot.shattered) { shot.shattered = true; snd.shatter(); vig.classList.remove("on"); }
    return lerp(0.045, 1, s);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dtR = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; tReal += dtR;
    const t = st.debugT ?? tReal, ts = timeScale(), dt = dtR * ts; simT += dt;
    if (phase === "suck" || phase === "float") {
      wall.material.opacity = SHADOW * clamp(t / 0.8, 0, 1);
      const curl = handPhase(t); papersPhase(t, curl); streaksPhase(t);
      if (t >= T.closed && !pulseHit.has("c")) { pulseHit.add("c"); snd.thud(); snd.crumple(1.2); buzz(2); shake = 7; }
      T.pulses.forEach((pt, i) => { if (t >= pt && !pulseHit.has(i)) { pulseHit.add(i); snd.crunch(i === 2 ? 1.3 : 0.9); buzz(3); shake = i === 2 ? 15 : 9; burstFlakes(i === 2 ? 110 : 60, i === 2 ? 1.3 : 0.9); } });
      punch = inkPhase(t);
      ballPhase(t);
    } else { ball.rotation.y += dt * 0.8; }
    flakesPhase(dtR); shotPhase(dt);
    // 카메라: 흔들림 + 느린 화면일 때 공 쪽으로 다가감
    shake *= Math.exp(-dtR * 8);
    const zoom = shot.on ? eInOut(clamp(1 - Math.abs(ts - 0.045) / 0.6, 0, 1)) : 0;
    look.copy(ball.visible || shot.on ? ball.position : V()).multiplyScalar(zoom * 0.6);
    camLook.lerp(look, Math.min(1, dtR * 6));
    cam.position.copy(camBase).add(V(rnd(-1, 1) * shake, rnd(-1, 1) * shake, 0)).add(V(camLook.x * 0.3, camLook.y * 0.3, -D * 0.12 * zoom - D * 0.035 * punch));
    cam.lookAt(camLook);
    renderer.render(scene, cam);
    if (shot.hit && !done && tReal - shot.hitReal > 3.4) { done = true; again.hidden = false; requestAnimationFrame(() => again.classList.add("on")); }
  }

  // 공 누르기 (공 근처를 누르면 맞힌 것으로)
  const onDown = e => {
    if (phase !== "float") return;
    const sp = ball.position.clone().project(cam), x = (sp.x + 1) / 2 * vw, y = (1 - sp.y) / 2 * vh;
    const rad = rb * D / (D - ball.position.z);
    if (Math.hypot(e.clientX - x, e.clientY - y) < rad * 1.5 + 14) { e.preventDefault(); fire(); }
  };
  cv.addEventListener("pointerdown", onDown);
  again.onclick = () => { finish(); onDone && onDone(); };

  function finish() {
    cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", onDown);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { for (const k in x) if (x[k] && x[k].isTexture) x[k].dispose(); x.dispose(); }); });
    texCache.forEach(t => t.dispose()); texCache.clear(); envTex.dispose(); pmrem.dispose(); renderer.dispose();
    cv.remove(); ui.remove(); document.documentElement.classList.remove("crush-on");
  }
  // 셰이더를 미리 다 만들어 둠: 처음 그릴 때(그리고 쇠공·파편이 처음 나올 때) 멈칫하지 않도록,
  // 숨겨 둔 것까지 잠깐 보이게 한 채 백그라운드로 컴파일하고 안 보이는 상태로 한 번 그려 그림자용까지 준비
  cv.style.opacity = "0";
  const later = [ball, frags, flakes, bullet, trail, floorM, glint, flashSpr, spLines, ink].filter(o => !o.visible);
  later.forEach(o => (o.visible = true));
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, cam); else renderer.compile(scene, cam); } catch (e) {}
  renderer.render(scene, cam);
  later.forEach(o => (o.visible = false));
  // 첫 화면은 2D 조각과 똑같은 자리에서 시작
  handPhase(0); papersPhase(0, 0); renderer.render(scene, cam);
  cv.style.opacity = "";
  snd.whoosh(T_SUCKED - SUCK + 0.4); buzz(1);
  raf = requestAnimationFrame(frame);
  return { finish };
}
