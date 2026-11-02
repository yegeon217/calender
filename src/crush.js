// 손으로 짓누르기 (3D): 진짜 손이 달력 조각을 빨아들여 꾸겨 뭉치고 → 세게 쥐어짜면 쇠공 → 누르면 총알이 날아와 박살
// 좌표: 화면 픽셀 = 월드 단위. z=0 평면이 화면과 1:1로 겹치도록 카메라를 놓아서 2D 조각을 그대로 이어받음.
// 손 좌표(hand.root): +y 손가락 방향, +z 손바닥이 보는 쪽(카메라), +x 엄지 쪽.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadHand, preloadHand } from "./hand.js";
import { bakeCrumple, sampleCrumple, BALL_R } from "./crumple.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V, buzz, noiseTex, radialTex } from "./fx-util.js";
import { buildDomain } from "./domain.js";

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
  // 종이 바스락: 아주 짧은 잡음 알갱이를 촘촘히 (높은 소리 위주, 가끔 낮은 '뚝')
  const crackle = (a, t, dur, n, k) => {
    for (let i = 0; i < n; i++) {
      const u = Math.pow(Math.random(), 0.8), at = t + u * dur, env = Math.sin(Math.PI * Math.min(1, u * 1.1)) * k;
      if (Math.random() < 0.82) noise(a, at, "bandpass", rnd(2200, 7800), rnd(1500, 5000), rnd(1.5, 5), rnd(0.04, 0.2) * env, 0.001, rnd(0.008, 0.03));
      else noise(a, at, "bandpass", rnd(500, 1400), rnd(300, 900), rnd(1, 3), rnd(0.1, 0.3) * env, 0.002, rnd(0.02, 0.05));
    }
  };
  return {
    whoosh(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 220, 2400, 0.8, 0.4, d * 0.75, d); noise(a, t, "lowpass", 90, 380, 0.7, 0.42, d * 0.6, d); },
    crumple(k = 1) { const a = A(); if (!a) return; crackle(a, a.c.currentTime, 0.22, 16, k); },
    grab() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 110, 42, 1, 0.004, 0.3); noise(a, t, "lowpass", 1200, 150, 0.7, 0.7, 0.003, 0.22); crackle(a, t, 0.35, 40, 1.1); },
    squeeze(k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime;
      crackle(a, t, 0.5, Math.round(50 * k), 1.2 * k);
      noise(a, t, "lowpass", 300, 70, 0.9, 0.6 * k, 0.015, 0.5); tone(a, t, "sine", 70, 45, 0.55 * k, 0.01, 0.35);
      tone(a, t + 0.04, "sawtooth", 58, 44, 0.09 * k, 0.05, 0.45); },
    strain() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sawtooth", 46, 52, 0.06, 0.2, 0.7); crackle(a, t, 0.6, 18, 0.5); },
    clink() { const a = A(); if (!a) return; const t = a.c.currentTime; ring(a, t, 1450, 0.4, 1.4); noise(a, t, "highpass", 5000, 3000, 1, 0.25, 0.001, 0.08); },
    clunk() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 160, 60, 0.7, 0.004, 0.25); ring(a, t, 880, 0.22, 0.9); },
    ting() { const a = A(); if (!a) return; ring(a, a.c.currentTime, 1880, 0.32, 1.6); },
    bang() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "highpass", 1400, 900, 0.7, 1.0, 0.002, 0.16); noise(a, t, "lowpass", 900, 120, 0.7, 0.95, 0.003, 0.55); tone(a, t, "sine", 160, 40, 0.9, 0.003, 0.35); },
    slowmo() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 70, 42, 0.5, 0.15, 1.4); noise(a, t, "lowpass", 200, 80, 0.8, 0.35, 0.2, 1.4); },
    impact() { const a = A(); if (!a) return; const t = a.c.currentTime; ring(a, t, 410, 0.55, 2.2); tone(a, t, "sine", 120, 30, 0.8, 0.004, 0.9); noise(a, t, "lowpass", 600, 60, 0.6, 0.7, 0.01, 1.2); },
    shatter() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "highpass", 3200, 2000, 0.7, 0.9, 0.002, 0.35); noise(a, t, "bandpass", 2400, 900, 1.2, 0.6, 0.004, 0.6); ring(a, t, 690, 0.35, 1.2);
      for (let i = 0; i < 46; i++) { const f = rnd(2600, 8200); tone(a, t + 0.05 + Math.pow(Math.random(), 1.6) * 1.8, "sine", f, f * 0.99, rnd(0.02, 0.07), 0.001, rnd(0.04, 0.16)); } },
    tink(k) { const a = A(); if (!a) return; const t = a.c.currentTime, f = rnd(3000, 9000); tone(a, t, "sine", f, f * 0.99, 0.05 * k, 0.001, rnd(0.03, 0.09)); },
    // ── 영역전개 ──
    swell(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 120, 2600, 0.9, 0.55, d * 0.95, d + 0.04); tone(a, t, "sawtooth", 38, 80, 0.12, d * 0.9, d + 0.04); },
    seal() { const a = A(); if (!a) return; const t = a.c.currentTime;
      noise(a, t, "highpass", 2600, 1800, 0.7, 0.9, 0.001, 0.07);   // 손바닥이 맞붙는 '탁'
      tone(a, t, "sine", 62, 26, 1, 0.004, 1.9); noise(a, t, "lowpass", 1400, 50, 0.7, 0.85, 0.005, 1.4);
      ring(a, t + 0.02, 98, 0.55, 5.5); ring(a, t + 0.02, 147, 0.28, 4.5); },   // 낮은 범종 울림
    title() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 49, 41, 0.8, 0.02, 2.6); ring(a, t, 392, 0.1, 3); noise(a, t, "bandpass", 300, 110, 1.2, 0.3, 0.05, 1.8); },
    rumble(d) { const a = A(); if (!a) return; const t = a.c.currentTime;
      noise(a, t, "lowpass", 150, 70, 0.8, 0.95, d * 0.3, d); noise(a, t, "bandpass", 420, 170, 1.5, 0.28, d * 0.4, d); tone(a, t, "sine", 36, 30, 0.7, d * 0.3, d);
      for (let i = 0; i < 46; i++) { const at = t + Math.pow(Math.random(), 0.7) * d * 0.9, f = rnd(2500, 7800); tone(a, at, "sine", f, f * 0.99, rnd(0.015, 0.05), 0.001, rnd(0.03, 0.08)); } },   // 바닥 위 쇠 파편이 부딪는 소리
    rise(d) { const a = A(); if (!a) return; const t = a.c.currentTime; [196, 247, 294, 392].forEach((f, i) => tone(a, t + i * 0.14, "sine", f, f * 1.8, 0.05, d * 0.6, d)); noise(a, t, "bandpass", 500, 2400, 2, 0.12, d * 0.7, d); },
    release() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 1800, 400, 0.8, 0.5, 0.01, 0.35); tone(a, t, "sine", 120, 60, 0.4, 0.005, 0.3); },
    wind(d) { const a = A(); if (!a) return; const t = a.c.currentTime;
      noise(a, t, "bandpass", 240, 1150, 2.2, 0.6, d * 0.85, d + 0.3); noise(a, t, "bandpass", 700, 2700, 5, 0.22, d * 0.9, d + 0.3); noise(a, t, "lowpass", 150, 260, 0.8, 0.55, d * 0.6, d + 0.3); },
    launch() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 500, 3800, 0.9, 1, 0.04, 1.3); noise(a, t, "lowpass", 600, 60, 0.7, 0.8, 0.01, 1.1); tone(a, t, "sine", 90, 30, 0.8, 0.005, 0.9); },
    close() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 2000, 150, 0.8, 0.35, 0.3, 0.9); ring(a, t + 0.35, 196, 0.12, 2.4); },
  };
}

// ── 손가락 자세 (관절마다 X축으로 음수 = 손바닥 쪽으로 굽힘) ──
const FIST = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] };
const THUMB_FIST = [[-0.6, 0.3, 0], [-0.5, 0, 0], [-0.6, 0, 0]];
const FINGERS = ["index", "middle", "ring", "pinky"];
const fingerRot = (n, c, ext = 0) => { const f = FIST[n]; return [null, [f[0] * c + ext, 0, 0], [f[1] * c + ext * 0.5, 0, 0], [f[2] * c + ext * 0.3, 0, 0]]; };
const thumbRot = (c, ext = 0) => THUMB_FIST.map((r, i) => [r[0] * c + (i ? ext * 0.4 : ext * 0.2), r[1] * c, r[2] * c]);

// ── 종이 꾸기기 계산: 비율이 비슷한 조각끼리 같은 결과를 씀 (화면을 멈추지 않게 작업 스레드에서, 한 번 계산한 건 계속 씀) ──
const aspectKey = a => Math.round(Math.log2(a) * 2) / 2, VARIANTS = 2;
const baked = new Map();   // "비율|번호" → Promise<계산 결과>
function bake(ids) {
  const todo = ids.filter(id => !baked.has(id)); if (!todo.length) return;
  const jobs = todo.map(id => { const [k, v] = id.split("|"); return { id, aspect: Math.pow(2, +k), seed: 3 + +v * 17 }; });
  let workers = [];
  try { workers = Array.from({ length: Math.min(3, jobs.length) }, () => new Worker(new URL("./crumple.worker.js", import.meta.url), { type: "module" })); } catch (e) { workers = []; }
  if (!workers.length) { jobs.forEach(j => baked.set(j.id, Promise.resolve(bakeCrumple(j.aspect, j.seed)))); return; }
  const wait = new Map();
  jobs.forEach(j => baked.set(j.id, new Promise(res => wait.set(j.id, res))));
  let left = jobs.length;
  workers.forEach((w, wi) => {
    w.onmessage = e => { wait.get(e.data.id)(e.data.T); if (--left === 0) workers.forEach(x => x.terminate()); };
    w.onerror = () => jobs.filter((_, i) => i % workers.length === wi).forEach(j => wait.get(j.id)(bakeCrumple(j.aspect, j.seed)));
    jobs.filter((_, i) => i % workers.length === wi).forEach(j => w.postMessage(j));
  });
}
const idsFor = list => [...new Set(list.flatMap(p => Array.from({ length: VARIANTS }, (_, v) => `${aspectKey(p.W / p.H)}|${v}`)))];
async function bakeAll(pieces) {
  bake(idsFor(pieces));
  const out = new Map(); for (const id of idsFor(pieces)) out.set(id, await baked.get(id));
  return (p, i) => out.get(`${aspectKey(p.W / p.H)}|${i % VARIANTS}`);
}

// ── 달력 조각 → 꾸겨지는 종이 (앞면은 칸 그림, 뒷면은 그냥 종이) ──
const texCache = new Map();
const backPatch = sh => { sh.uniforms.paperBack = { value: sh.__paper }; sh.fragmentShader = "uniform vec3 paperBack;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb = paperBack;"); };
function makePaper(p, T, backColor) {
  const geo = new THREE.PlaneGeometry(p.W, p.H, T.nx - 1, T.ny - 1);
  let tex = texCache.get(p.tex);
  if (!tex) { tex = new THREE.CanvasTexture(p.tex); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texCache.set(p.tex, tex); }
  // 처음엔 빛을 받지 않고 원래 색 그대로(emissive) → 꾸겨질수록 빛을 받아 접힌 자국이 드러남
  const front = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, color: 0x000000, roughness: 0.86, flatShading: true, alphaTest: 0.4, toneMapped: false, transparent: p.alpha < 1, opacity: p.alpha });
  const back = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.9, flatShading: true, side: THREE.BackSide, alphaTest: 0.4, transparent: p.alpha < 1, opacity: p.alpha });
  back.onBeforeCompile = sh => { sh.__paper = backColor; backPatch(sh); };
  back.customProgramCacheKey = () => "paperBack";
  const g = new THREE.Group(), mf = new THREE.Mesh(geo, front), mb = new THREE.Mesh(geo, back);
  mf.castShadow = true; mf.frustumCulled = mb.frustumCulled = false; g.add(mf, mb);
  const area = Math.sqrt(p.W * p.H), a = p.W / p.H, ta = T.w / T.h;
  return { p, T, g, geo, front, R: BALL_R * area, area, fx: Math.sqrt(a / ta), fy: Math.sqrt(ta / a), c: -1, size: 1 };
}
function crumple(pp, c, size = 1) {
  if (Math.abs(c - pp.c) < 0.002 && size === pp.size) return; pp.c = c; pp.size = size;
  const P = pp.geo.attributes.position.array; sampleCrumple(pp.T, c, pp.area * size, P);
  // 계산해 둔 종이와 비율이 조금 다르면 처음엔 그 비율로 늘려 맞추고, 꾸겨질수록 원래 공 모양으로
  const e = sstep(Math.min(1, c * 2.5)), sx = lerp(pp.fx, 1, e), sy = lerp(pp.fy, 1, e);
  if (sx !== 1 || sy !== 1) for (let i = 0; i < P.length; i += 3) { P[i] *= sx; P[i + 1] *= sy; }
  pp.geo.attributes.position.needsUpdate = true;
  const lit = Math.min(1, c * 3); pp.front.color.setScalar(0.92 * lit); pp.front.emissiveIntensity = 1 - 0.78 * lit;
}

// ── 미리 준비해 둔 장면 ──
// 렌더러·빛·손·쇠공·총알·파편을 만들고 셰이더까지 다 컴파일하는 데 1~2초가 걸려서, 앱이 한가할 때 미리 해 둠.
// 버튼을 누르면 그때 화면의 종이 조각만 넣어 바로 시작 (화면 크기나 다크 모드가 바뀌었으면 새로 준비).
let stage = null;
const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
export function prewarm(pieces) {
  preloadHand(); bake(idsFor(pieces));
  if (!stage) stage = prepare().catch(e => { console.error(e); stage = null; return null; });
}
// 첫 화면을 그린 뒤에 돌아옴 → 호출한 쪽은 그때 2D를 지우면 끊김이 없음
export async function startCrush(opts) {
  let s = stage && (await stage); stage = null;
  if (!s || s.vw !== innerWidth || s.vh !== innerHeight || s.dark !== isDark() || s.lost) { if (s) s.dispose(); s = await prepare(); }
  return s.run(opts);
}

async function prepare() {
  const vw = innerWidth, vh = innerHeight, dark = isDark();
  const t0 = performance.now(), mark = s => import.meta.env.DEV && console.log(`[crush] ${s} ${Math.round(performance.now() - t0)}ms`);
  // ── 렌더러 · 카메라 · 빛 ── (캔버스는 시작할 때 화면에 붙임)
  const cv = document.createElement("canvas"); cv.id = "gCrush"; cv.style.opacity = "0";
  const stg = { vw, vh, dark, lost: false };
  cv.addEventListener("webglcontextlost", () => (stg.lost = true));
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(vw, vh, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex; scene.environmentIntensity = 0.62;
  const fov = 35, D = vh / 2 / Math.tan((fov / 2) * Math.PI / 180), M = Math.max(vw, vh);
  const cam = new THREE.PerspectiveCamera(fov, vw / vh, 20, D * 5); cam.position.set(0, 0, D);
  const hemi = new THREE.HemisphereLight(0xffffff, dark ? 0x30384a : 0x9aa3b2, 1.1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e2, 2.7); key.position.set(-0.45 * D, 0.75 * D, 1.15 * D); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -M * 0.8, right: M * 0.8, top: M * 0.8, bottom: -M * 0.8, near: D * 0.4, far: D * 3.2 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.8; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc6d8ff, 1.6); rim.position.set(0.7 * D, 0.35 * D, -0.5 * D); scene.add(rim);
  // 뒤 벽과 바닥은 그림자만 받음 (그림자는 시작할 때 서서히 생김 → 2D 달력에서 끊김 없이)
  const SHADOW = dark ? 0.35 : 0.17, FLOOR = -vh * 0.36;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(vw * 4, vh * 4), new THREE.ShadowMaterial({ opacity: 0 })); wall.position.z = -30; wall.receiveShadow = true; scene.add(wall);
  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(vw * 4, D * 2), new THREE.ShadowMaterial({ opacity: SHADOW * 1.3 })); floorM.rotation.x = -Math.PI / 2; floorM.position.set(0, FLOOR, D * 0.4); floorM.receiveShadow = true; floorM.visible = false; scene.add(floorM);
  const toWorld = (x, y) => V(x - vw / 2, vh / 2 - y, 0);

  // ── 손: 실제 손 모델 + 따뜻한 피부 + 소매 ──
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe8a578, roughness: 0.52, sheen: 0.85, sheenRoughness: 0.42, sheenColor: new THREE.Color(0xff8a66), clearcoat: 0.1, clearcoatRoughness: 0.6, bumpMap: noiseTex(256, 6, 30, 0.9), bumpScale: 0.35 });
  mark("renderer"); const [H, H2] = await Promise.all([loadHand(skin), loadHand(skin)]); mark("hand");
  const S = Math.min(vw * 0.42, vh * 0.22), K = S / 0.08;   // 손바닥 너비 ≈ S
  const sleeveMat = new THREE.MeshStandardMaterial({ color: dark ? 0x3b4a6b : 0x27324a, roughness: 0.85, bumpMap: noiseTex(128, 4, 40), bumpScale: 0.8 });
  // 손 하나 꾸미기: 모델 방향을 맞추고, 손바닥 가운데를 손 좌표의 원점으로, 손목에 소매
  function rig(H) {
    const root = new THREE.Group(), orient = new THREE.Group(), arm = H.bones.wrist.parent;
    orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));   // 모델 → 손가락 위·손바닥 앞·엄지 오른쪽
    orient.scale.setScalar(K); orient.add(H.scene); root.add(orient);
    const restPos = n => V().setFromMatrixPosition(H.restM[n]);
    H.scene.position.copy(restPos("wrist").add(restPos("index-finger-phalanx-proximal")).add(restPos("pinky-finger-phalanx-proximal")).add(restPos("middle-finger-phalanx-proximal")).multiplyScalar(0.25)).negate();
    root.updateMatrixWorld(true);
    const toRoot = m => root.worldToLocal(arm.localToWorld(m.clone()));
    // 소매: 손목 잘린 곳을 덮고 화면 아래로 (영역전개 때 팔을 꺾을 수 있게 손목을 축으로)
    const wristR = toRoot(restPos("wrist")), elbowDir = wristR.clone().sub(toRoot(restPos("middle-finger-phalanx-proximal"))).normalize();
    const sleeve = new THREE.Group(), sl = 5 * S;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.034 * K, 0.043 * K, sl, 40, 1, true), sleeveMat); tube.position.y = -sl / 2; tube.castShadow = tube.receiveShadow = true;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.034 * K, 0.0045 * K, 12, 40), sleeveMat); cuff.rotation.x = Math.PI / 2; cuff.castShadow = true;
    sleeve.add(tube, cuff); sleeve.scale.set(1, 1, 0.8); sleeve.position.copy(wristR).addScaledVector(elbowDir, 0.006 * K);
    sleeve.quaternion.setFromUnitVectors(V(0, -1, 0), elbowDir); root.add(sleeve);
    return { root, H, arm, restPos, toRoot, sleeve, sleeveQ0: sleeve.quaternion.clone() };
  }
  const hand = rig(H), arm = hand.arm, restPos = hand.restPos, toRoot = hand.toRoot; scene.add(hand.root);
  // 영역전개 때 같이 나오는 왼손: 오른손 모델을 좌우로 뒤집어서
  const hand2 = rig(H2), mir = new THREE.Group(); mir.scale.x = -1; mir.add(hand2.root); mir.visible = false; scene.add(mir);
  const PALM_Z = 0.015 * K;   // 손바닥 겉면까지
  // 손가락 뿌리 관절 줄의 높이: 쥔 물건은 이 바로 아래, 손가락 첫마디가 감싸는 자리에 들어감
  const MCP_Y = FINGERS.reduce((a, n) => a + toRoot(restPos(`${n}-finger-phalanx-proximal`)).y, 0) / 4;
  const HY = -vh * 0.06, HZ = 90, startY = -vh / 2 - S * 2.6;
  hand.root.position.set(0, startY, HZ);

  // 손가락 자세 · 물체를 쥘 때 닿는 데까지만 굽힘 (손가락별로 이분 탐색)
  const tmpV = V(), ctrM = V();
  const FR = 0.0088;   // 손가락 굵기(반지름, 모델 단위)
  const minDist = (chain, c) => { let m = 1e9; for (let i = 1; i < chain.length; i++) { const p = tmpV.setFromMatrixPosition(H.world[chain[i]]); m = Math.min(m, p.distanceTo(c)); if (i > 1) { const q = V().setFromMatrixPosition(H.world[chain[i - 1]]).lerp(p, 0.5); m = Math.min(m, q.distanceTo(c)); } } return m; };
  function solveGrip(name, rM, cMin, extra) {
    const rot = c => (name === "thumb" ? thumbRot(c) : fingerRot(name, c)), chain = H.chains[name];
    const touches = c => { H.setChain(name, rot(c)); return minDist(chain, ctrM) <= rM + FR; };
    let lo = cMin, hi = 1;
    if (!touches(hi)) { H.setChain(name, rot(1)); return 1; }
    if (touches(lo)) hi = lo; else for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (touches(m)) hi = m; else lo = m; }
    const c = Math.min(1, hi + extra); H.setChain(name, rot(c)); return c;
  }
  // 손 전체 자세: open(0 펼침~1 오므림) 또는 쥔 물체(gripR>0)에 맞춰
  function poseHand(open, ext, gripR, squeeze) {
    if (gripR > 0) {
      hand.root.updateMatrixWorld(true); arm.worldToLocal(ctrM.copy(mass.position).applyMatrix4(hand.root.matrixWorld));
      const rM = gripR / K;
      FINGERS.forEach(n => solveGrip(n, rM, open, squeeze * 0.06)); solveGrip("thumb", rM, open * 0.6, squeeze * 0.05);
    } else {
      FINGERS.forEach((n, i) => H.setChain(n, fingerRot(n, open * (1 + i * 0.04), ext))); H.setChain("thumb", thumbRot(open * 0.55, ext));
    }
  }

  const mass = new THREE.Group(); hand.root.add(mass);   // 손바닥 위 종이 뭉치 (마지막엔 그 자리에 쇠공)
  const rb = clamp(Math.min(vw, vh) * 0.085, 24, 48);

  // ── 꽉 쥘 때 주먹 둘레로 터지는 집중선 (만화처럼 '꽉!') ── 쐐기 모양: 주먹 쪽은 뾰족, 바깥으로 갈수록 두꺼움
  const NI = 22, inkPos = new Float32Array(NI * 9), inkCol = new Float32Array(NI * 12), inkGeo = new THREE.BufferGeometry();
  inkGeo.setAttribute("position", new THREE.BufferAttribute(inkPos, 3)); inkGeo.setAttribute("color", new THREE.BufferAttribute(inkCol, 4));
  const ink = new THREE.Mesh(inkGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  ink.frustumCulled = false; ink.renderOrder = 5; scene.add(ink);
  const inkC = new THREE.Color(dark ? 0xffffff : 0x1b2230), inkA = Array.from({ length: NI }, (_, i) => (i / NI) * 6.283 + rnd(-0.12, 0.12)), inkL = Array.from({ length: NI }, () => rnd(0.22, 0.5));

  // ── 종이 부스러기 (꽉 쥘 때 손가락 사이로 튀어나옴) ──
  const NF = 300, flakeGeo = new THREE.PlaneGeometry(1, 1), flakeMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
  const flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, NF); flakes.castShadow = true; flakes.frustumCulled = false; scene.add(flakes);
  const fl = [];
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), sc4 = V();
  for (let i = 0; i < NF; i++) { fl.push({ life: 0 }); flakes.setMatrixAt(i, m4.makeScale(0, 0, 0)); flakes.setColorAt(i, col.set("#ffffff")); }
  const jointW = n => H.bones[n].getWorldPosition(V());

  // ── 쇠로 변할 때 주먹 틈새로 새어 나오는 빛 ──
  const leak = new THREE.PointLight(0xffe2a8, 0, S * 2.4, 0); mass.add(leak);
  const leakSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, "rgba(255,248,220,1)"], [0.25, "rgba(255,206,92,.85)"], [0.6, "rgba(255,170,40,.35)"], [1, "rgba(255,150,20,0)"]]), transparent: true, depthWrite: false, opacity: 0 }));
  leakSpr.scale.setScalar(S * 1.9); mass.add(leakSpr);
  // 빛줄기: 주먹 둘레로 뻗어 나가는 금빛 쐐기 (밝은 배경에서도 보이게 진한 금색으로)
  const NRY = 16, ryPos = new Float32Array(NRY * 9), ryCol = new Float32Array(NRY * 12), ryGeo = new THREE.BufferGeometry();
  ryGeo.setAttribute("position", new THREE.BufferAttribute(ryPos, 3)); ryGeo.setAttribute("color", new THREE.BufferAttribute(ryCol, 4));
  const rays = new THREE.Mesh(ryGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
  rays.frustumCulled = false; rays.renderOrder = 6; scene.add(rays);
  const ryA = Array.from({ length: NRY }, (_, i) => (i / NRY) * 6.283 + rnd(-0.15, 0.15)), ryL = Array.from({ length: NRY }, () => rnd(0.6, 1.4));

  // ── 쇠공 ──
  const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.13, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 1.7, bumpMap: noiseTex(64, 2, 10), bumpScale: 0.25 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(rb, 64, 48), ballMat); ball.castShadow = true; ball.visible = false; mass.add(ball);
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
  const FRG = []; const NSP = 320, spPos = new Float32Array(NSP * 6), spCol = new Float32Array(NSP * 8), sparks = [];
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute("color", new THREE.BufferAttribute(spCol, 4));
  const spLines = new THREE.LineSegments(spGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })); spLines.frustumCulled = false; scene.add(spLines);

  // ── 영역전개 (박살 낸 뒤 "다음") ──
  const dom = buildDomain({ scene, cam, renderer, vw, vh, D, S, K, PALM_Z, FLOOR, R: hand, L: hand2, mir, hemi, key, rim, frags, floorM });

  // ── 셰이더를 미리 다 만들어 둠 ──
  // 나중에 나오는 것(쇠공·파편·총알…)까지 잠깐 보이게 하고, 종이 셰이더는 가짜 종이 한 장으로
  // 백그라운드 컴파일 → 안 보이는 캔버스에 한 번 그려 그림자용 셰이더까지 준비
  const backColor = new THREE.Color(dark ? 0x2a303c : 0xf3f1ec);
  const dummyCv = document.createElement("canvas"); dummyCv.width = dummyCv.height = 4;
  // 불투명·반투명(지난 날짜 칸) 종이는 셰이더가 따로라 둘 다
  const dummies = [1, 0.5].map((alpha, i) => { const d = makePaper({ tex: dummyCv, W: 40, H: 40, alpha }, { nx: 2, ny: 2, w: 1, h: 1, keys: [] }, backColor); d.g.position.set(i * 50, 0, 10); scene.add(d.g); return d; });
  const later = [ball, frags, flakes, bullet, trail, floorM, glint, flashSpr, spLines, ink, leakSpr, rays, mir, ...dom.warm].filter(o => !o.visible);
  later.forEach(o => (o.visible = true)); leak.intensity = 1; boomLight.intensity = 1;
  hand.root.position.set(0, 0, HZ); mark("built");
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, cam); else renderer.compile(scene, cam); } catch (e) {}
  mark("compiled"); renderer.render(scene, cam); mark("warm render");
  later.forEach(o => (o.visible = false)); leak.intensity = 0; boomLight.intensity = 0;
  dummies.forEach(d => { scene.remove(d.g); d.geo.dispose(); d.g.children.forEach(m => m.material.dispose()); }); texCache.get(dummyCv)?.dispose(); texCache.delete(dummyCv);
  hand.root.position.set(0, startY, HZ);

  stg.dispose = () => {
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { for (const k in x) if (x[k] && x[k].isTexture) x[k].dispose(); x.dispose(); }); });
    texCache.forEach(t => t.dispose()); texCache.clear(); envTex.dispose(); pmrem.dispose(); renderer.dispose(); cv.remove();
  };

  // ── 실행: 화면의 종이 조각을 넣고 시작 ──
  stg.run = async function run({ pieces, sfx, onDone }) {
  const r0t = performance.now(), mark = s => import.meta.env.DEV && console.log(`[crush run] ${s} ${Math.round(performance.now() - r0t)}ms`);
  const snd = makeSound(sfx);
  const pickT = await bakeAll(pieces); mark("baked");
  // 화면 위 글자·버튼
  const ui = document.createElement("div"); ui.id = "gCrushUI";
  ui.innerHTML = `<div class="cr-vig"></div><div class="cr-flash"></div><div class="cr-inv"></div><div class="cr-title" hidden>쏘세요</div>`
    + `<div class="cr-dom" hidden><small>領域展開</small><b>료이키 텐카이</b><i></i></div><button class="cr-again" hidden>다음</button>`;
  document.body.append(ui);
  const title = ui.querySelector(".cr-title"), vig = ui.querySelector(".cr-vig"), flash = ui.querySelector(".cr-flash"), again = ui.querySelector(".cr-again");
  document.documentElement.classList.add("crush-on");

  // ── 종이 ──
  const papers = pieces.map((p, i) => makePaper(p, pickT(p, i), backColor)), N = papers.length;
  const palmW = V(0, HY, HZ + PALM_Z + S * 0.3);
  papers.forEach(pp => {
    const p = pp.p, w = toWorld(p.cx, p.cy); pp.g.position.copy(w); pp.g.rotation.z = -p.th; pp.q0 = pp.g.quaternion.clone(); pp.p0 = w;
    pp.dist = w.distanceTo(palmW); crumple(pp, 0); scene.add(pp.g);
  });
  papers.sort((a, b) => a.dist - b.dist); mark("papers");
  // 손바닥 위 종이 뭉치: 도착할수록 눈덩이처럼 커짐. 조각을 덜 압축해 크게 두고 서로 겹치게 쌓아서
  // 작은 종이공 무더기가 아니라 하나의 큰 종이 뭉치로 보이게 (너무 크면 조각을 조금 더 작게)
  const PS = 1.25, PACK = 0.85;
  const rawR = Math.cbrt(papers.reduce((a, pp) => a + (pp.R * PS) ** 3, 0)) * PACK, MAXR = S * 0.62, shrink = Math.min(1, MAXR / Math.max(1, rawR)), RM = rawR * shrink;
  const SUCK = 0.5, SPAN = clamp(0.3 + N * 0.017, 0.6, 1.45), FLY = 0.72;
  papers.forEach((pp, i) => {
    const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-0.6, 1)).normalize(), r = Math.cbrt((i + 0.5) / N) * RM;
    pp.slot = d.multiplyScalar(Math.max(0, r - pp.R * PS * shrink * 0.7)); pp.order = i;
    pp.t0 = SUCK + (i / Math.max(1, N - 1)) * SPAN + rnd(-0.03, 0.03); pp.t1 = pp.t0 + FLY * rnd(0.88, 1.1);
    const side = V(-(palmW.y - pp.p0.y), palmW.x - pp.p0.x, 0).normalize().multiplyScalar(pp.dist * rnd(-0.5, 0.5));
    pp.ctrl = pp.p0.clone().lerp(palmW, 0.4).add(side).add(V(0, 0, rnd(120, 300)));
    pp.axis = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); pp.spin = rnd(3, 7) * (Math.random() < 0.5 ? -1 : 1); pp.landed = false; pp.sounded = false;
  });
  const T_SUCKED = Math.max(...papers.map(pp => pp.t1), SUCK + 0.6) + 0.12;
  // 순서: 쫙 펴기(예비 동작) → 덥석 쥐기 → 주먹을 들이밀고 세 번 꽉 → 쇠로 변하는 빛 → 손바닥 위로 돌려 펴기 → 공을 띄우고 손은 퇴장
  const T = { stretch: T_SUCKED, close: T_SUCKED + 0.2, closed: T_SUCKED + 0.36, turn: T_SUCKED + 0.48, pulses: [T_SUCKED + 0.95, T_SUCKED + 1.5, T_SUCKED + 2.1] };
  T.glow = T.pulses[2] + 0.45; T.reveal = T.glow + 0.5; T.open = T.reveal + 0.38; T.lift = T.open + 0.75; T.float = T.lift + 0.85;
  // 쥐어짤 때마다 뭉치가 단계적으로 작아짐 (마지막엔 쇠공 크기)
  const R_STEPS = [RM, RM * 0.8, RM * 0.64, rb];
  const massR = t => {
    if (t < T.close) { const got = papers.filter(pp => pp.landed).reduce((a, pp) => a + (pp.R * PS * shrink) ** 3, 0); return Math.max(RM * 0.35, Math.cbrt(got) * PACK); }
    let r = RM; T.pulses.forEach((pt, i) => { const u = seg(t, pt - 0.02, pt + 0.12); r = lerp(r, R_STEPS[i + 1], eOut(u)); }); return r;
  };

  function inkPhase(t) {   // 마지막으로 쥔 순간부터 0.28초 동안 바깥으로 뻗으며 사라짐
    let u = 9, big = 0; T.pulses.forEach((pt, i) => { if (t >= pt && t - pt < u) { u = t - pt; big = i === 2 ? 1.25 : 1; } });
    const k = u < 0.28 ? 1 - u / 0.28 : 0, c = mass.getWorldPosition(V()), z = c.z + 30;
    for (let i = 0; i < NI; i++) {
      const a = inkA[i], r0 = S * (0.95 + 0.3 * (1 - k)) * big, r1 = r0 + S * inkL[i] * big, w = S * 0.022 * big / r1 * S;
      const P = (r, aa) => [c.x + Math.cos(aa) * r, c.y + Math.sin(aa) * r * 1.15, z];
      inkPos.set([...P(r0, a), ...P(r1, a - w / S), ...P(r1, a + w / S)], i * 9);
      const kk = Math.sin(a) < -0.6 ? 0 : 0.85 * k;   // 바로 아래(팔 쪽)로는 긋지 않음
      inkCol.set([inkC.r, inkC.g, inkC.b, 0, inkC.r, inkC.g, inkC.b, kk, inkC.r, inkC.g, inkC.b, kk], i * 12);
    }
    inkGeo.attributes.position.needsUpdate = inkGeo.attributes.color.needsUpdate = true;
    return k * big;
  }
  const colors = pieces.flatMap(p => p.colors || []).filter(Boolean); if (!colors.length) colors.push("#ffffff");
  const burstFlakes = (n, k) => {   // 이웃한 손가락 사이 틈에서 바깥으로
    const c0 = mass.getWorldPosition(V()), gaps = [];
    for (let f = 0; f < 3; f++) gaps.push(jointW(`${FINGERS[f]}-finger-phalanx-intermediate`).lerp(jointW(`${FINGERS[f + 1]}-finger-phalanx-intermediate`), 0.5));
    gaps.push(jointW("thumb-phalanx-distal").lerp(jointW("index-finger-phalanx-distal"), 0.5), jointW("pinky-finger-phalanx-distal"));
    for (let j = 0; j < n; j++) {
      const i = fl.findIndex(f => f.life <= 0); if (i < 0) break;
      const g = gaps[(Math.random() * gaps.length) | 0], out = g.clone().sub(c0).normalize();
      fl[i] = { p: g.clone().add(V(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4))), v: out.multiplyScalar(rnd(160, 560) * k).add(V(rnd(-90, 90), rnd(60, 320) * k, rnd(-60, 160))),
        r: V(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: V(rnd(-16, 16), rnd(-16, 16), rnd(-16, 16)), s: rnd(2.5, 8) * (S / 160), life: rnd(0.9, 1.7) };
      flakes.setColorAt(i, col.set(Math.random() < 0.72 ? (dark ? "#2e3442" : "#f4f2ec") : colors[(Math.random() * colors.length) | 0]));
    }
    flakes.instanceColor.needsUpdate = true;
  };
  function raysPhase(t) {
    const k = Math.sin(Math.PI * seg(t, T.glow - 0.1, T.glow + 0.55)), c = mass.getWorldPosition(V()), z = c.z + 40;
    for (let i = 0; i < NRY; i++) {
      const a = ryA[i] + t * 0.35, L = S * ryL[i] * (0.6 + 0.4 * Math.sin(t * 23 + i * 1.7)) * k, w = 0.06 + 0.03 * Math.sin(t * 17 + i);
      const P = (r, aa) => [c.x + Math.cos(aa) * r, c.y + Math.sin(aa) * r, z], r0 = S * 0.42;
      ryPos.set([...P(r0, a - w), ...P(r0, a + w), ...P(r0 + L, a)], i * 9);
      ryCol.set([1, 0.82, 0.32, 0.85 * k, 1, 0.82, 0.32, 0.85 * k, 1, 0.9, 0.55, 0], i * 12);
    }
    ryGeo.attributes.position.needsUpdate = ryGeo.attributes.color.needsUpdate = true;
  }

  // ── 진행 ──
  let raf = 0, last = 0, tReal = 0, tl = 0, simT = 0, shake = 0, punch = 0, freeze = 0, done = false, phase = "suck";
  const camBase = V(0, 0, D), look = V(0, 0, 0), camLook = V(0, 0, 0), handCam = V();
  // 손이 받는 충격: 종이가 도착할 때마다 살짝 밀렸다가 탄성 있게 돌아옴 (용수철)
  const recoil = { z: 0, vz: 0, rx: 0, vrx: 0, y: 0, vy: 0 };
  const kick = (z, rx, y = 0) => { recoil.vz += z; recoil.vrx += rx; recoil.vy += y; };
  const st = { get phase() { return phase; }, ball, cam, vw, vh, rb, T, debugT: null, dom };
  if (import.meta.env.DEV) window.__crush = st;
  const hit = new Set(), once = (k, fn) => { if (!hit.has(k)) { hit.add(k); fn(); } };

  function handPhase(t, dt) {
    const Hr = hand.root;
    // 용수철 (k=170, 감쇠 14)
    for (const [x, v] of [["z", "vz"], ["rx", "vrx"], ["y", "vy"]]) { recoil[v] += (-170 * recoil[x] - 14 * recoil[v]) * dt; recoil[x] += recoil[v] * dt; }
    // 올라오기: 아래에서 솟아올라 살짝 지나쳤다가 자리 잡음
    const rise = eBack(seg(t, 0, 0.75), 1.25);
    Hr.position.set(0, lerp(startY, HY, rise), HZ + recoil.z); Hr.rotation.set(lerp(0.5, 0.12, rise) + recoil.rx, lerp(-0.25, 0, rise), lerp(-0.22, 0, rise));
    Hr.position.y += recoil.y;
    // 받는 동안: 손가락을 살짝 오므려 받치고, 미세하게 떨림
    let open = lerp(0.05, 0.22, seg(t, SUCK, SUCK + 0.3)), ext = 0, gripR = 0, squeeze = 0;
    if (t > SUCK && t < T.stretch) { const k = Math.sin(Math.PI * seg(t, SUCK, T.stretch)); Hr.rotation.z += Math.sin(t * 31) * 0.01 * k; Hr.position.x += Math.sin(t * 47) * 1.2 * k; }
    // 쥐기 직전: 손가락을 쫙 펴며 살짝 뒤로 (예비 동작)
    const pre = sstep(seg(t, T.stretch, T.close)) * (1 - seg(t, T.close, T.close + 0.05));
    open = lerp(open, 0, pre); ext = 0.32 * pre; Hr.position.z -= 26 * pre; Hr.rotation.x -= 0.08 * pre;
    // 덥석: 뭉치 표면에 닿을 때까지 손가락을 빠르게 감음
    if (t >= T.close) {
      const c = eBack(seg(t, T.close, T.closed), 1.6); gripR = massR(t) * lerp(1.9, 1, c); open = 0.15;
      // 주먹을 들이밀며 비스듬히 (손가락이 감싼 모양이 보이게)
      const turn = eInOut(seg(t, T.turn, T.turn + 0.35)) * (1 - eInOut(seg(t, T.reveal, T.reveal + 0.35)));
      Hr.rotation.y -= 0.55 * turn; Hr.rotation.x += 0.1 * turn; Hr.position.z += 95 * turn; Hr.position.y += S * 0.25 * turn; Hr.position.x += S * 0.08 * turn;
      // 세 번 꽉: 빠르게 힘이 들어갔다가 조금 풀림, 갈수록 세게
      for (const [i, pt] of T.pulses.entries()) {
        const u = t - pt; if (u < -0.05 || u > 0.6) continue;
        const amp = (0.7 + i * 0.25) * (u < 0 ? 0 : u < 0.06 ? eOut(u / 0.06) : Math.exp(-(u - 0.06) * 5));
        squeeze = Math.max(squeeze, amp);
        Hr.rotation.z += Math.sin(t * 88 + i) * 0.035 * amp; Hr.position.x += Math.sin(t * 117) * 3.4 * amp; Hr.position.y += Math.cos(t * 103) * 2.6 * amp;
      }
      // 쥐는 내내 힘이 들어가 부들부들 (갈수록 세짐)
      if (t > T.closed && t < T.reveal) { const k = 0.4 + seg(t, T.pulses[0], T.glow + 0.3) * 1.2; Hr.rotation.z += Math.sin(t * 63) * 0.008 * k + Math.sin(t * 91) * 0.005 * k; Hr.position.x += Math.sin(t * 77) * 1.1 * k; }
      // 펴기: 손바닥을 위로 돌리고 천천히 손가락을 폄 (안의 쇠공이 보이게)
      const up = eInOut(seg(t, T.reveal, T.reveal + 0.4)); Hr.rotation.x -= 0.85 * up; Hr.position.y += S * 0.1 * up;
      const o = eOut(seg(t, T.open, T.open + 0.55));
      if (o > 0) { gripR = 0; open = lerp(0.85, 0.08, o); ext = 0.08 * o; }
      // 공을 넘겨주고 아래로 퇴장
      const down = eIn(seg(t, T.lift + 0.2, T.lift + 0.95)); Hr.position.y -= (vh * 0.8 + S * 2.5) * down; Hr.rotation.x -= 0.5 * down;
    }
    Hr.updateMatrixWorld(true);
    // 뭉치 위치: 손바닥 바로 앞 (반지름만큼 떨어져서) · 손가락은 gripR(덥석 쥘 땐 크게 시작해 실제 크기로)에 닿을 때까지 감음
    const R = massR(t);
    mass.position.set(0, MCP_Y - R * 0.6, PALM_Z + R * 0.93);
    poseHand(open, ext, gripR, squeeze);
    return { R, squeeze };
  }

  function papersPhase(t, R) {
    // 뭉치 크기에 맞춰 안의 종이도 함께 줄어듦 (쥐어짤 때는 눌리는 쪽으로 납작하게 출렁)
    const sc = R / RM, sq = t > T.close ? Math.sin(Math.max(0, t - T.close) * 38) * 0.04 * Math.exp(-(t - T.close) * 3) : 0;
    const target = V(), gone = t >= T.glow + 0.32;   // 쇠로 바뀌는 순간 종이 뭉치는 사라지고 그 자리에 쇠공
    for (const pp of papers) {
      const g = pp.g;
      if (t < pp.t0) {   // 날아가기 직전 바르르 떨며 들뜸
        const k = seg(t, pp.t0 - 0.25, pp.t0); g.position.copy(pp.p0).add(V(Math.sin(t * 90 + pp.dist) * 2.5 * k, Math.cos(t * 83) * 1.8 * k, 18 * k * k));
        g.quaternion.copy(pp.q0); crumple(pp, 0.05 * k); continue;
      }
      if (!pp.landed) {
        const u = seg(t, pp.t0, pp.t1), e = Math.pow(u, 1.9);
        target.copy(pp.slot).multiplyScalar(sc).applyMatrix4(mass.matrixWorld);
        const a = pp.p0, b = pp.ctrl, c = target;
        g.position.set((1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * b.x + e * e * c.x, (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * b.y + e * e * c.y, (1 - e) * (1 - e) * a.z + 2 * (1 - e) * e * b.z + e * e * c.z);
        g.quaternion.copy(pp.q0).multiply(q4.setFromAxisAngle(pp.axis, pp.spin * e));
        crumple(pp, 0.05 + 0.85 * sstep(clamp((u - 0.02) / 0.9, 0, 1)), lerp(1, shrink * PS, sstep(u)));
        if (!pp.sounded && u > 0.5) { pp.sounded = true; if (Math.random() < 0.7) snd.crumple(0.6); }
        if (u >= 1) { pp.landed = true; mass.attach(g); g.position.copy(pp.slot).multiplyScalar(sc); pp.qLand = g.quaternion.clone(); kick(-130 * Math.sqrt(pp.R / 18), -0.5, -40); buzz(1); }
      } else {
        // 뭉치 안에서 마저 꾸겨지고, 뭉치가 작아지는 만큼 안쪽으로
        const u = seg(t, pp.t1, pp.t1 + 0.25); crumple(pp, 0.9 + 0.1 * u, shrink * PS * (t > T.close ? clamp(sc * 1.05, 0.5, 1) : 1));
        g.position.copy(pp.slot).multiplyScalar(sc * (1 + sq * Math.sign(pp.slot.z)));
        g.visible = !gone;
      }
    }
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

  // 쇠로 변하는 빛 → 펼치면 쇠공 → 화면 가운데로 떠오름
  function ballPhase(t) {
    const g = seg(t, T.glow - 0.15, T.glow + 0.3), fade = 1 - seg(t, T.glow + 0.3, T.reveal + 0.2);
    leak.intensity = 6 * Math.sin(Math.PI * Math.min(1, g)) * fade + 1.5 * g * fade; leakSpr.material.opacity = 0.9 * Math.sin(Math.PI * Math.min(1, g * 1.1)) * fade;
    if (t >= T.glow + 0.3 && !ball.visible && !ball.userData.out) { ball.visible = true; }
    if (!ball.visible) return;
    if (t < T.lift) { ball.rotation.y = t * 1.5; glint.material.opacity = 0; ball.position.set(0, 0, 0); return; }
    if (ball.parent === mass) { scene.attach(ball); ball.userData.from = ball.position.clone(); ball.userData.out = true; snd.ting(); buzz(2); }
    const u = eInOut(seg(t, T.lift, T.float)), bob = t > T.float ? Math.sin((t - T.float) * 2.2) * 6 : 0;
    ball.position.copy(ball.userData.from).lerp(ballHome, u); ball.position.y += Math.sin(u * Math.PI) * 40 + bob;
    ball.rotation.y = t * 0.8; ball.rotation.x = Math.sin(t * 0.7) * 0.3;
    glint.position.copy(ball.position).add(V(-rb * 0.35, rb * 0.4, rb)); glint.material.opacity = (0.55 + 0.25 * Math.sin(t * 3)) * u;
    if (t >= T.float && phase === "suck") { phase = "float"; title.hidden = false; requestAnimationFrame(() => title.classList.add("on")); }
  }

  // 때맞춰 나는 소리·진동·흔들림·멈칫
  function beats(t, R) {
    if (t >= SUCK) once("whoosh", () => { snd.whoosh(T.stretch - SUCK + 0.3); buzz(1); });
    if (t >= T.closed) once("grab", () => { snd.grab(); buzz([3, 70, 2]); shake = 10; freeze = 0.08; });
    T.pulses.forEach((pt, i) => { if (t >= pt) once("p" + i, () => { snd.squeeze(0.85 + i * 0.25); buzz(i === 2 ? [3, 60, 3, 60, 3] : [3, 70, 2]); shake = 8 + i * 5; freeze = 0.05 + i * 0.025; burstFlakes(40 + i * 35, 0.8 + i * 0.25); }); });
    if (t >= T.pulses[0] + 0.3) once("strain", () => snd.strain());
    if (t >= T.glow) once("clink", () => { snd.clink(); buzz([2, 50, 3]); shake = 6; });
    if (t >= T.open + 0.12) once("clunk", () => { snd.clunk(); buzz(2); kick(0, 0.6, -170); });   // 쇠공 무게에 손이 출렁
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
      FRG[i] = { p, v, r: V(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: V(rnd(-25, 25), rnd(-25, 25), rnd(-25, 25)), s: V(s * rnd(0.6, 1.4), s * rnd(0.5, 1.3), s * rnd(0.4, 1)), rest: false };
    }
    floorM.visible = true;
    for (let i = 0; i < NSP; i++) { const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().addScaledVector(shot.dir, -0.6).normalize(); sparks[i] = { p: I.clone(), v: d.multiplyScalar(rnd(400, 2200)), life: rnd(0.25, 0.8), max: 0 }; sparks[i].max = sparks[i].life; }
    flashSpr.position.copy(I); flashSpr.material.opacity = 1; boomLight.position.copy(I); boomLight.intensity = 9;
    shake = 26; snd.impact(); buzz([3, 40, 3, 40, 3]); flash.classList.add("on"); setTimeout(() => flash.classList.remove("on"), 90);
    shot.hitReal = tReal;
  }
  function shotPhase(dt) {
    if (!shot.on) return;
    if (!shot.hit) {
      const total = shot.start.distanceTo(ball.position), left = shot.pos.distanceTo(ball.position);
      shot.pos.addScaledVector(shot.dir, shot.speed * dt);
      bullet.position.copy(shot.pos); bullet.rotateY(dt * 40);
      const tl2 = Math.min(total - left, rb * 9); trail.scale.set(1, tl2, 1); trail.position.copy(shot.pos).addScaledVector(shot.dir, -tl2 / 2 - rb * 0.3);
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
      const f = FRG[i];
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
    if (phase === "domain") { dom.tick(dtR); if (!closed) renderer.render(scene, cam); return; }
    // 멈칫(히트스톱): 세게 쥐는 순간 시간이 아주 잠깐 거의 멈춤
    const tdt = freeze > 0 ? dtR * 0.04 : dtR; freeze -= dtR; tl += tdt;
    const t = st.debugT ?? tl, ts = timeScale(), dt = dtR * ts; simT += dt;
    if (phase === "suck" || phase === "float") {
      wall.material.opacity = SHADOW * clamp(t / 0.8, 0, 1);
      const { R } = handPhase(t, tdt); papersPhase(t, R); beats(t, R);
      punch = inkPhase(t); raysPhase(t);
      ballPhase(t);
    } else { ball.rotation.y += dt * 0.8; }
    flakesPhase(dtR); shotPhase(dt);
    // 카메라: 흔들림 · 쥐어짤 때 주먹 쪽으로 다가가 살짝 돌아봄 · 느린 화면일 때 공 쪽으로
    shake *= Math.exp(-dtR * 8);
    const zoom = shot.on ? eInOut(clamp(1 - Math.abs(ts - 0.045) / 0.6, 0, 1)) : 0;
    const grip = phase === "suck" ? eInOut(seg(t, T.closed, T.turn + 0.4)) * (1 - eInOut(seg(t, T.reveal + 0.2, T.lift + 0.3))) : 0;
    look.copy(ball.visible || shot.on ? ball.position : V()).multiplyScalar(zoom * 0.6);
    if (grip > 0) look.lerp(handCam.copy(mass.getWorldPosition(V())).multiplyScalar(0.5), grip);
    camLook.lerp(look, Math.min(1, dtR * 6));
    cam.position.copy(camBase).add(V(rnd(-1, 1) * shake, rnd(-1, 1) * shake, 0)).add(V(camLook.x * 0.3 + D * 0.12 * grip, camLook.y * 0.3, -D * 0.12 * zoom - D * 0.035 * punch - D * 0.1 * grip));
    cam.lookAt(camLook);
    renderer.render(scene, cam);
    if (shot.hit && !done && tReal - shot.hitReal > 3.4) {
      done = true; again.hidden = false; requestAnimationFrame(() => again.classList.add("on"));
      // 영역전개 글자를 미리 거의 투명하게 그려 둠 (큰 글꼴을 처음 그리는 순간 멈칫하지 않게)
      const de = ui.querySelector(".cr-dom"); de.style.opacity = "0.004"; de.hidden = false;
    }
  }

  // 공 누르기 (공 근처를 누르면 맞힌 것으로)
  const onDown = e => {
    if (phase !== "float") return;
    const sp = ball.position.clone().project(cam), x = (sp.x + 1) / 2 * vw, y = (1 - sp.y) / 2 * vh;
    const rad = rb * D / (D - ball.position.z);
    if (Math.hypot(e.clientX - x, e.clientY - y) < rad * 1.5 + 14) { e.preventDefault(); fire(); }
  };
  cv.addEventListener("pointerdown", onDown);
  // 다음 → 영역전개. 어둠이 걷히기 전에 달력을 밑에 다시 깔아 두고, 다 걷히면 정리
  const startDomain = () => {
    if (phase === "domain") return;
    again.classList.remove("on"); again.hidden = true; phase = "domain";
    dom.start({ snd, ui, frg: FRG, onRestore: () => { document.documentElement.classList.remove("crush-on"); onDone && onDone(); }, onEnd: finish });
  };
  again.onclick = startDomain;
  if (import.meta.env.DEV) st.devDomain = () => {   // 시험용: 바로 쏴서 파편을 바닥에 깔고 영역전개 시작
    papers.forEach(pp => (pp.g.visible = false)); hand.root.position.y = startY - vh;
    if (ball.parent !== scene) scene.attach(ball);
    ball.visible = true; ball.position.copy(ballHome); shot.dir = V(1, 0.1, -0.42).normalize(); shot.on = true; explode();
    for (let i = 0; i < 300; i++) shotPhase(1 / 60);
    flash.classList.remove("on"); startDomain();
  };

  let closed = false;
  function finish() {
    if (closed) return; closed = true;
    cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", onDown);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { for (const k in x) if (x[k] && x[k].isTexture) x[k].dispose(); x.dispose(); }); });
    texCache.forEach(t => t.dispose()); texCache.clear(); envTex.dispose(); pmrem.dispose(); renderer.dispose();
    cv.remove(); ui.remove(); document.documentElement.classList.remove("crush-on");
  }
  // 첫 화면은 2D 조각과 똑같은 자리에서 시작
  document.body.append(cv);
  const r0 = handPhase(0, 0); papersPhase(0, r0.R); renderer.render(scene, cam); mark("first frame");
  cv.style.opacity = "";
  raf = requestAnimationFrame(frame);
  return { finish };
  };
  return stg;
}
