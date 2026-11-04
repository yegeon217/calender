// 짓누르기 뒤 연출: 쇠공이 만들어지면
// 손이 빠지며 공이 바닥에 떨어져 튐 → 카메라가 돌아가며 바닥이 드러나고, 후드 쓴 사람이 달려와 공을 축구공처럼 뻥 →
// 공이 높이 포물선을 그리며 날아감 → 등에 멘 저격총을 견착 → (1인칭 조준경) 숨을 고르고 떨어지는 공을 탕! →
// 느린 화면으로 총알이 날아가 공이 박살, 파편이 앞으로 쏟아짐 → 노리쇠를 당기고 총을 다시 메고 파편 쪽으로 전력 질주 →
// 멈춰 서면 카메라가 그 사람의 눈으로 들어감 → "다음" (영역전개)
// 시간 k(초)는 느린 화면만큼 천천히 흐름. 위치는 화면 픽셀(=3D 단위), 사람은 미터 × U. 사람은 -z 쪽(앞)으로 감.
import * as THREE from "three";
import { buildRunner } from "./runner.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, V, buzz } from "./fx-util.js";

const K = { fp0: 0.38, fp1: 0.84, go: 0.48, kick: 2.52 };   // fp: 원래 화면 → 그 사람의 눈 · go: 달려 나감
K.draw = K.kick + 0.42; K.pov = K.kick + 0.86; K.fire = K.pov + 0.92;
const G_FLY = 8.2, VY0 = 10.7, VZ0 = 6.2, G_DROP = 2300, BUL = 650;   // 공 비행(미터·초) · 떨어질 때(화면 단위) · 총알 속도(m/s)

// Catmull-Rom 표 보간
const cat = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function curve(T, Y, t) {
  const n = T.length - 1; if (t <= T[0]) return Y[0]; if (t >= T[n]) return Y[n];
  let i = 0; while (t > T[i + 1]) i++; return cat(Y[Math.max(0, i - 1)], Y[i], Y[i + 1], Y[Math.min(n, i + 2)], (t - T[i]) / (T[i + 1] - T[i]));
}
// 발: 디딘 구간 [{s 앞뒤(m) · x 좌우(+왼쪽) · t0~t1 · run(뛰는 걸음이면 뒤꿈치가 들리며 발끝으로 차고 나감)}] 사이는 휘두르기
const SW = { T: [0, 0.1, 0.3, 0.5, 0.7, 0.85, 1], Y: [0.17, 0.42, 0.56, 0.5, 0.32, 0.15, 0.08], Z: [0, 0.12, 0.35, 0.62, 0.92, 1.08, 1], P: [0.75, 1.05, 0.65, 0.05, -0.2, -0.12, 0] };
function footAt(st, t, o, sh) {
  let i = 0; while (i < st.length && st[i].t0 <= t) i++;
  const a = st[Math.max(0, i - 1)];
  if (i === 0 || i >= st.length || t <= a.t1) {   // 디딘 채
    const q = i === 0 ? st[0] : a, r = isFinite(q.t1) ? clamp((t - q.t0) / (q.t1 - q.t0), 0, 1) : 0, lift = q.run ? Math.pow(clamp((r - 0.35) / 0.65, 0, 1), 1.6) : 0, p = 0.8 * lift;
    o.s = q.s + 0.05 * lift; o.y = 0.08 + 0.13 * Math.sin(p); o.x = q.x; o.p = p; o.st = true; return o;
  }
  const b = st[i], u = clamp((t - a.t1) / (b.t0 - a.t1), 0, 1), L = b.s - a.s, hk = clamp(Math.abs(L) / 3.2, 0.12, 1), h0 = a.run ? 0.17 : 0.08;
  // 몸을 따라가는 궤적: 차고 나간 발은 곧장 엉덩이 쪽으로 접혀 오르고, 무릎이 앞으로 나간 뒤 발이 뻗어 내려와 디딤
  const R0 = a.s - sh(a.t1), R1 = b.s - sh(b.t0);
  o.s = sh(t) + R0 + (R1 - R0) * curve(SW.T, SW.Z, u); o.y = Math.max(0.08, lerp(h0, 0.08, u) + (curve(SW.T, SW.Y, u) - lerp(0.17, 0.08, u)) * hk);
  o.x = lerp(a.x, b.x, u); o.p = curve(SW.T, SW.P, u) * (0.35 + 0.65 * hk); o.st = false; return o;
}

// 주기 P로 감싸는 값 잡음 (바닥 무늬를 이어 붙여도 이음매가 안 보이게)
const ph = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function pnoise(x, y, P) { const xi = Math.floor(x), yi = Math.floor(y), u = sstep(x - xi), v = sstep(y - yi), m = q => ((q % P) + P) % P;
  const a = ph(m(xi), m(yi)), b = ph(m(xi + 1), m(yi)), c = ph(m(xi), m(yi + 1)), d = ph(m(xi + 1), m(yi + 1)); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
// ── 점 입자 (먼지) ──
const PT_VS = `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vA = aAlpha; }`;
const PT_FS = `uniform vec3 uCol; varying float vA;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = (1.0 - smoothstep(0.0, 1.0, r)) * vA; if (a < 0.003) discard; gl_FragColor = vec4(uCol, a); }`;

export function buildKick(c) {
  const { scene, cam, renderer, vw, vh, D, FLOOR, rb, ball, glint, frags, FRG, NFRAG, key, wall, floorM, dark, sparkSys, hemi } = c;
  const U = -FLOOR / 1.665, PR = renderer.getPixelRatio();   // 1미터 = U (눈높이가 화면 가운데 높이가 되도록)
  const warm = [];
  // ── 사람 ──
  const man = buildRunner({ hands: c.hands, dark }); man.root.scale.setScalar(U); man.root.visible = false; scene.add(man.root); warm.push(man.root);
  // 1인칭: 눈 둘레(어깨·후드·뺨에 댄 개머리판)는 그리지 않음 → 화면을 덮는 큰 덩어리가 안 생김 (그림자는 그대로)
  const clipU = { uEye: { value: V() }, uClipR: { value: 0.22 * U } }, patched = new Set();
  man.root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (patched.has(m)) continue; patched.add(m);
    m.onBeforeCompile = sh => { sh.uniforms.uEye = clipU.uEye; sh.uniforms.uClipR = clipU.uClipR;
      sh.vertexShader = "varying vec3 vFpW;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vFpW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = "uniform vec3 uEye; uniform float uClipR; varying vec3 vFpW;\n" + sh.fragmentShader.replace("void main() {", "void main() {\n if (distance(vFpW, uEye) < uClipR) discard;"); };
    m.customProgramCacheKey = () => "fpClip"; } });
  // ── 바닥: 화면 바탕색 위에 은은한 얼룩 (멀수록 사라짐) + 그림자만 받는 판 ──
  // ── 바닥: 콘크리트 광장 (2m마다 줄눈 · 골재 알갱이 · 얼룩) — 무늬와 요철을 같이 쓰고, 멀수록 지평선 안개로 사라짐 ──
  const TILE = 4;   // 무늬 한 장 = 4m
  const gTex = (() => {
    const n = 512, cv = document.createElement("canvas"); cv.width = cv.height = n; const x = cv.getContext("2d"), im = x.createImageData(n, n), d = im.data;
    const base = dark ? [92, 92, 96] : [184, 181, 174], P = (u, v, f) => pnoise((u / n) * f, (v / n) * f, f);
    const stains = Array.from({ length: 7 }, () => [Math.random() * n, Math.random() * n, rnd(30, 90), rnd(0.04, 0.1)]);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let v = (P(i, j, 4) - 0.5) * 0.14 + (P(i, j, 13) - 0.5) * 0.08 + (P(i, j, 61) - 0.5) * 0.07 + (Math.random() - 0.5) * 0.07;
      const r = Math.random(); if (r < 0.018) v -= rnd(0.1, 0.26); else if (r < 0.03) v += rnd(0.06, 0.14);
      for (const [sx, sy, sr, sa] of stains) { let dx = Math.abs(i - sx), dy = Math.abs(j - sy); dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy); const q = 1 - Math.hypot(dx, dy) / sr; if (q > 0) v -= sa * q * q * (0.6 + 0.8 * P(i, j, 23)); }
      // 줄눈: 홈은 어둡고 바로 옆 모서리는 살짝 밝음
      const ji = Math.min(i % (n / 2), n / 2 - (i % (n / 2))), jj = Math.min(j % (n / 2), n / 2 - (j % (n / 2))), jm = Math.min(ji, jj);
      if (jm < 2.2) v -= 0.3 * (1 - jm / 2.2); else if (jm < 3.6) v += 0.05;
      const k = (j * n + i) * 4; d[k] = clamp(base[0] * (1 + v), 0, 255); d[k + 1] = clamp(base[1] * (1 + v), 0, 255); d[k + 2] = clamp(base[2] * (1 + v * 1.05), 0, 255); d[k + 3] = 255;
    }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260 / TILE, 260 / TILE); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bTex = gTex.clone(); bTex.colorSpace = THREE.NoColorSpace; bTex.needsUpdate = true;
  const fadeU = { uCam: { value: V() }, uNear: { value: 10 * U }, uFar: { value: 33 * U } };
  const gMat = new THREE.MeshStandardMaterial({ map: gTex, bumpMap: bTex, bumpScale: 1.6, roughness: 0.93, metalness: 0, transparent: true, depthWrite: false, opacity: 0 });
  gMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, fadeU);
    sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = "uniform vec3 uCam; uniform float uNear, uFar; varying vec3 vWp;\n" + sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.a *= 1.0 - smoothstep(uNear, uFar, length(vWp.xz - uCam.xz));");
  };
  gMat.customProgramCacheKey = () => "kickGround";
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260 * U, 260 * U), gMat); ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR - 0.6; ground.receiveShadow = true; ground.renderOrder = -5; ground.visible = false; scene.add(ground); warm.push(ground);
  // 불투명 단계에서 맨 먼저 그림 (깊이는 안 씀) · 처음엔 화면 바탕 위로 서서히 (미리 곱한 알파)
  // ── 하늘: 지평선은 옅은 안개 → 위로 갈수록 파랗고, 해(등 뒤) 쪽은 밝고 따뜻함 · 엷은 구름 (카메라를 따라다녀 끝없이 멂) ──
  const skyU = { uA: { value: 0 }, uSun: { value: V(0.35, 0.62, 0.7).normalize() }, uTop: { value: new THREE.Color(dark ? 0x0a1022 : 0x3b73c2) }, uHor: { value: new THREE.Color(dark ? 0x37324a : 0xdde6ee) },
    uGnd: { value: new THREE.Color(dark ? 0x3a3a40 : 0xc9c8c4) }, uSunC: { value: new THREE.Color(dark ? 0xff8a5a : 0xfff0d0) }, uCl: { value: dark ? 0.35 : 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(D * 4, 48, 24), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uA, uCl; uniform vec3 uSun, uTop, uHor, uGnd, uSunC; varying vec3 vD;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD); float y = d.y;
  vec3 c = mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.5));
  c = mix(c, uGnd, smoothstep(0.0, -0.05, y));
  float sd = max(dot(d, uSun), 0.0); c += uSunC * (pow(sd, 5.0) * 0.22 + pow(sd, 90.0) * 0.5);
  if (y > 0.0) { vec2 q = d.xz / (y + 0.1) * 1.4; float n = fbm(q + vec2(3.1, 0.7)); float cl = smoothstep(0.5, 0.82, n) * smoothstep(0.0, 0.2, y) * uCl;
    c = mix(c, mix(uHor, vec3(1.0), 0.55) * (0.9 + 0.1 * n), cl * 0.6); }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor *= uA;
}` }));
  sky.renderOrder = -10; sky.frustumCulled = false; sky.visible = false; scene.add(sky); warm.push(sky);
  let skyEnv = null, env0 = null, envI0 = 1;
  if (c.pmrem) { const es = new THREE.Scene(), sm = sky.material.clone(); sm.uniforms = THREE.UniformsUtils.clone(skyU); sm.uniforms.uA.value = 1; sm.uniforms.uCl.value *= 0.6; sm.uniforms.uGnd.value = new THREE.Color(dark ? 0x202024 : 0x6e6b66);   // 비친 바닥은 더 어둡게 (쇠 느낌)
    es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), sm)); skyEnv = c.pmrem.fromScene(es, 0.02, 1, 200).texture; sm.dispose(); }
  const hemi0 = hemi ? { c: hemi.color.clone(), g: hemi.groundColor.clone() } : null, hc = new THREE.Color();
  // ── 먼지 ──
  const NP = 320, pPos = new Float32Array(NP * 3), pSize = new Float32Array(NP), pAlpha = new Float32Array(NP), PS = [];
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute("aAlpha", new THREE.BufferAttribute(pAlpha, 1));
  const dust = new THREE.Points(pGeo, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR }, uCol: { value: new THREE.Color(dark ? 0x6c6a70 : 0xb9b2a6) } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false }));
  dust.frustumCulled = false; dust.visible = false; scene.add(dust); warm.push(dust);
  const puff = (x, z, n, sp, sz = 1, up = 1) => { for (let i = 0; i < n; i++) { if (PS.length >= NP) PS.shift(); const a = rnd(0, 6.283), v = rnd(0.3, 1) * sp;
    PS.push({ x: x + rnd(-0.08, 0.08) * U, y: FLOOR + rnd(2, 10), z: z + rnd(-0.08, 0.08) * U, vx: Math.cos(a) * v, vy: rnd(0.2, 0.9) * sp * 0.6 * up, vz: Math.sin(a) * v, life: 0, max: rnd(0.7, 1.5), s0: rnd(0.06, 0.12) * U * sz, s1: rnd(0.35, 0.7) * U * sz, a: rnd(0.25, 0.45) }); } };
  // ── 탄피 ──
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0065, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 0.9, roughness: 0.3 }));
  casing.scale.setScalar(U); casing.castShadow = true; casing.visible = false; scene.add(casing); warm.push(casing);
  const cas = { on: false, p: V(), v: V(), w: V(), tink: 0 };
  // ── 총알 (조준경 속에서 멀어지는 빛점 + 공기를 가르는 물결) ──
  const tracer = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.glowTex, color: 0xfff1d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  tracer.visible = false; scene.add(tracer); warm.push(tracer);
  const wakeMat = () => new THREE.MeshBasicMaterial({ color: dark ? 0xd8e4ff : 0x8a9bb8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const wakes = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), wakeMat()); m.visible = false; scene.add(m); warm.push(m); return m; });

  // ── 진행 상태 ──
  let wall0 = 0, on = false, k = 0, ts = 1, snd = null, ui = null, done = null, scv = null, sx = null, freeze = 0, shake = 0;
  const hit = new Set(), once = (n, fn) => { if (!hit.has(n)) { hit.add(n); fn(); } };
  const P0 = V(), B0 = V(), bp = V(), bv = V(), bspin = V();
  let bState = "drop", pathX = 0, kImp = Infinity, kExit = Infinity, kRun0 = Infinity, kStop = Infinity, kEnd = Infinity, impP = V(), impDir = V(0, 0, -1), pile = V();
  const stL = [], stR = [];   // 발 일정
  let run = null;             // 달리기 계획 {s0, s1, vmax, ta, tc, td}
  const camP = V(), camL = V(), tmp = V(), tmp2 = V();
  const keyOff0 = key.position.clone().sub(key.target.position), keyOff1 = V(0.35, 1, 0.6).normalize().multiplyScalar(D * 1.6);   // 뒤에서 비춰 내 그림자가 앞에 드리움
  const fov0 = cam.fov;
  const sway = { yaw: 0, pitch: 0, vy: 0, vp: 0, rec: 0, rv: 0 };   // 조준경 흔들림 · 반동 (도)
  const tr = { on: false, p0: V(), p1: V(), t0: 0, dur: 1, wake: 0, done: false };

  // 공이 날아가는 위치 (차고 나서 dt초 뒤)
  const ballAt = (dt, out = V()) => out.set(P0.x, P0.y + (VY0 * dt - 0.5 * G_FLY * dt * dt) * U, P0.z - VZ0 * dt * U);
  const AP = { s0: -6.5, t0: K.go, ta: 0.55, v: 3.8 };   // 다가가기: 원래 카메라 자리에 서 있다가 출발해 빨라짐
  const appS = t => { const u = t - AP.t0; if (u <= 0) return AP.s0; if (u < AP.ta) { const x = u / AP.ta; return AP.s0 + AP.v * AP.ta * (x * x * x - (x * x * x * x) / 2); } return AP.s0 + AP.v * AP.ta / 2 + AP.v * (u - AP.ta); };
  const appV = t => { const u = t - AP.t0; return u <= 0 ? 0 : u < AP.ta ? AP.v * sstep(u / AP.ta) : AP.v; };
  const hipS = t => {   // 엉덩이가 지나는 앞뒤 위치 (m)
    if (t < K.kick - 0.13) return appS(t);
    if (t < K.kick + 1.1) return curve([K.kick - 0.13, K.kick, K.kick + 0.18, K.kick + 0.5, K.kick + 0.78, K.kick + 1.1], [-0.3, -0.13, 0.08, 0.32, 0.6, 0.7], t);
    if (!run || t < kRun0) return 0.7;
    return runS(t);
  };
  const runV = t => { if (!run) return 0; const u = t - kRun0, { vmax, ta, tc, td } = run; if (u <= 0) return 0; if (u < ta) return vmax * sstep(u / ta); if (u < ta + tc) return vmax; return vmax * (1 - sstep(Math.min(1, (u - ta - tc) / td))); };
  function runS(t) {
    const u = t - kRun0, { s0, vmax, ta, tc, td } = run; if (u <= 0) return s0;
    if (u < ta) { const x = u / ta; return s0 + vmax * ta * (x * x * x - (x * x * x * x) / 2); }
    const sa = s0 + vmax * ta / 2; if (u < ta + tc) return sa + vmax * (u - ta);
    const x = Math.min(1, (u - ta - tc) / td); return sa + vmax * tc + vmax * td * (x - (x * x * x - (x * x * x * x) / 2));
  }
  // 다가오는 걸음 (마지막에 왼발을 공 옆에 딛고 오른발로 참)
  function planApproach() {
    stL.length = stR.length = 0;
    const Kp = K.kick - 0.13;
    AP.s0 = (P0.z - D) / U - 0.1; AP.v = (-0.3 - AP.s0) / (Kp - AP.t0 - AP.ta / 2);
    // 공 옆에 딛는 왼발 바로 앞의 오른발부터 거꾸로 거슬러 올라가며 (느릴수록 드물고 짧게)
    const steps = [{ s: appS(Kp - 0.32) + 0.28, x: -0.1, t0: Kp - 0.32, t1: Kp - 0.19, run: true, L: false }];
    KS[0] = steps[0].s;
    for (let t = steps[0].t0, L = true; ; L = !L) {
      const vr = appV(t) / AP.v, t0 = t - 1 / (2.2 + 1.2 * vr); if (t0 < AP.t0 + 0.12) break;
      const v0 = appV(t0) / AP.v; steps.push({ s: appS(t0) + 0.1 + 0.18 * v0, x: L ? 0.1 : -0.1, t0, t1: t0 + 0.2 - 0.07 * v0, run: v0 > 0.4, L }); t = t0;
    }
    steps.reverse();
    const f0 = steps[0];   // 처음엔 두 발로 서 있다가, 먼저 내딛는 발이 출발할 때 떨어짐
    stL.push({ s: AP.s0 + 0.06, x: 0.11, t0: -10, t1: f0.L ? AP.t0 : f0.t0 + 0.05 });
    stR.push({ s: AP.s0 - 0.04, x: -0.11, t0: -10, t1: f0.L ? f0.t0 + 0.05 : AP.t0 });
    for (const q of steps) (q.L ? stL : stR).push(q);
    stL.push({ s: -0.05, x: 0.11, t0: K.kick - 0.13, t1: K.kick + 0.2, run: true });   // 공 옆에 딛는 발
    stL.push({ s: 0.98, x: 0.13, t0: K.kick + 0.78, t1: Infinity });
    stR.push({ s: 0.5, x: -0.14, t0: K.kick + 0.5, t1: Infinity });                     // 차고 나서 앞에 내려놓는 발
  }
  // 차는 오른발 (공에 닿는 순간 = K.kick)
  const KT = [-0.32, -0.2, -0.1, -0.03, 0, 0.08, 0.2, 0.34, 0.5], KS = [-1.17, -0.88, -0.62, -0.37, -0.23, 0.12, 0.42, 0.55, 0.5], KY = [0.17, 0.46, 0.43, 0.25, 0.17, 0.4, 0.7, 0.45, 0.08], KP = [0.75, 1.15, 1.05, 0.95, 1.0, 0.7, 0.35, 0.1, 0];
  // 달리기 계획: 지금 선 자리에서 파편 앞(카메라가 눈으로 들어갈 자리)까지
  function planRun() {
    let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < NFRAG; i++) { const f = FRG[i]; if (!f) continue; cx += f.p.x + f.v.x * 0.15; cz += f.p.z + f.v.z * 0.15; n++; }
    pile.set(n ? cx / n : P0.x, FLOOR, n ? cz / n : P0.z - 18 * U);
    const s0 = 0.7, s1 = Math.max(s0 + 4, (P0.z - (pile.z + D)) / U - 0.06), d = s1 - s0;
    let vmax = 7, ta = 0.85, td = 0.75; if (d < vmax * (ta + td) / 2) vmax = d / ((ta + td) / 2);
    run = { s0, s1, vmax, ta, td, tc: Math.max(0, (d - vmax * (ta + td) / 2) / vmax) };
    kStop = kRun0 + ta + run.tc + td; kEnd = kStop + 0.8;
    // 걸음: 뒷발(오른발)부터 · 빠를수록 자주·길게, 디딘 시간은 짧게 · 멈출 땐 발을 앞에 놓아 버팀
    stL[stL.length - 1].t1 = kRun0 + 0.2; stR[stR.length - 1].t1 = kRun0;
    let t = kRun0, foot = stR, last = { L: stL[stL.length - 1], R: stR[stR.length - 1] };
    for (let guard = 0; guard < 40; guard++) {
      const v = runV(t + 0.1), r = v / 7, P = 1 / (2.5 + 1.5 * r), td0 = t + (guard ? P : 0.22);
      const vs = runV(td0), braking = td0 > kRun0 + run.ta + run.tc;
      let s = runS(td0) + 0.2 + 0.12 * (vs / 7) + (braking ? 0.18 : 0);
      const L = foot === stL, prev = last[L ? "L" : "R"];
      if (td0 >= kStop - 0.12 || s >= s1 + 0.25) {   // 마지막 두 걸음: 어깨너비로 멈춰 섬
        const fin = { s: s1 + (L ? 0.12 : -0.1), x: L ? 0.12 : -0.12, t0: Math.max(td0, prev.t1 + 0.18), t1: Infinity };
        foot.push(fin); const other = L ? stR : stL, o = other[other.length - 1];
        if (isFinite(o.t1)) other.push({ s: s1 + (L ? -0.1 : 0.12), x: L ? -0.12 : 0.12, t0: fin.t0 + 0.24, t1: Infinity });
        break;
      }
      const Tc = 0.22 - 0.11 * (vs / 7);
      foot.push({ s, x: L ? 0.095 : -0.095, t0: td0, t1: td0 + Tc, run: true });
      last[L ? "L" : "R"] = foot[foot.length - 1];
      t = td0; foot = L ? stR : stL;
      // 반대발은 이 발이 디딘 직후 떨어짐 (첫걸음은 조금 늦게)
      const oth = foot[foot.length - 1]; if (!isFinite(oth.t1) || oth.t1 > td0 + Tc * 0.4) oth.t1 = Math.max(oth.t0 + 0.05, td0 + Tc * 0.35);
    }
  }

  // ── 사람 자세 (매 프레임 처음부터) ──
  const fo = { s: 0, y: 0, x: 0, p: 0, st: true }, fo2 = { s: 0, y: 0, x: 0, p: 0, st: true };
  const RE = V(-0.031, 0.083, 0.1);   // 오른눈 (머리뼈 기준)
  let eyeW = V(), aimW = V(0, 0, -1);
  function poseMan(t, aimTarget) {
    const sH = hipS(t), B = man.B;
    man.root.position.set(pathX, FLOOR, P0.z - sH * U); man.root.rotation.set(0, Math.PI, 0); man.begin();
    // 다리 (차는 동안 오른발은 따로)
    footAt(stL, t, fo, hipS); const kick = t > K.kick - 0.32 && t < K.kick + 0.5;
    if (kick) { const u = t - K.kick; fo2.s = curve(KT, KS, u); fo2.y = curve(KT, KY, u); fo2.p = curve(KT, KP, u); fo2.x = -0.1; fo2.st = false; } else footAt(stR, t, fo2, hipS);
    // 속도·자세 기준값
    const v = t < K.kick - 0.13 ? appV(t) : run && t > kRun0 ? runV(t) : 0, r = v / 7, acc = run && t > kRun0 && t < kRun0 + run.ta ? 1 - (t - kRun0) / run.ta : t > AP.t0 && t < AP.t0 + AP.ta ? 0.6 * (1 - (t - AP.t0) / AP.ta) : 0;
    // 엉덩이 높이: 디딘 발 위에서 낮고 떠 있을 때 높음
    let hy = 0.955; const air = !fo.st && !fo2.st;
    if (v > 0.5) { const amp = 0.018 + 0.022 * r; hy = 0.965 - 0.02 * r + (air ? amp * 0.6 : -amp * 0.7); }
    let lean = 0.06 + 0.17 * r + 0.22 * acc, yaw = 0, roll = 0, back = 0;
    if (t > K.kick - 0.45 && t < K.kick + 1.1) {   // 차기: 디딜 때 낮게 → 맞히고 발끝으로 솟음 · 상체는 뒤로
      const u = t - K.kick;
      hy = curve([-0.45, -0.13, 0, 0.18, 0.5, 0.8, 1.1], [0.93, 0.89, 0.87, 0.97, 0.92, 0.94, 0.955], u);
      lean = curve([-0.45, -0.2, 0, 0.2, 0.5, 1.1], [0.12, 0.02, -0.08, -0.2, -0.05, 0.03], u);
      yaw = curve([-0.45, -0.15, 0, 0.25, 0.6, 1.1], [0, 0.28, 0.05, -0.22, -0.05, 0], u);
    }
    if (run && t > kStop - 0.5) { const u = seg(t, kStop - 0.5, kStop); back = Math.sin(Math.PI * u) * 0.16; }   // 멈출 때 상체를 뒤로 버팀
    const breathe = Math.sin(t * 2.6) * 0.012 * (v < 0.3 ? 1 : 0);
    // 걸음에 따라 골반·어깨가 엇갈려 돎
    const strideW = clamp((fo.s - fo2.s) / 1.6, -1, 1);
    if (v > 0.3) { yaw += -0.2 * strideW * r; roll += 0.05 * strideW * r; }
    B.hips.position.set(0, hy, 0);
    man.setE("hips", lean * 0.4 - back * 0.3, yaw, roll);
    man.setE("spine", lean * 0.3 - back * 0.4 + breathe, -yaw * 0.6, -roll);
    man.setE("chest", lean * 0.3 - back * 0.3 - breathe * 0.6, -yaw * 0.9, 0);
    man.setE("neck", -lean * 0.4 + back * 0.4, 0, 0); man.setE("head", -lean * 0.35 + back * 0.3, 0, 0);
    // 조준 (총을 견착하는 정도 aim 0~1)
    const aim = aimAmount(t);
    let el = 0;
    if (aim > 0 && aimTarget) {
      man.sync(); const E0 = man.posOf(B.head); const tl = man.root.worldToLocal(tmp.copy(aimTarget)); el = Math.atan2(tl.y - E0.y, Math.hypot(tl.x - E0.x, tl.z - E0.z));
      const a = aim;
      man.setE("hips", (lean * 0.4) * (1 - a), yaw * (1 - a) - 0.22 * a, roll * (1 - a));
      man.setE("spine", (lean * 0.3) * (1 - a) - el * 0.18 * a + 0.03 * a, -0.15 * a, 0);
      man.setE("chest", (lean * 0.3) * (1 - a) - el * 0.25 * a + 0.04 * a, -0.2 * a, 0.05 * a);
      man.setE("neck", -el * 0.2 * a + 0.05 * a, 0.3 * a, -0.08 * a);
      man.setE("head", -el * 0.3 * a + 0.1 * a, 0.25 * a, -0.14 * a);
    }
    man.sync();
    // 무릎은 앞쪽(살짝 바깥)으로
    const kn = side => V(side * 0.08, 0, 1);
    man.leg("L", V(fo.x, fo.y, fo.s - sH), fo.p, 0, kn(1)); man.leg("R", V(fo2.x, fo2.y, fo2.s - sH), fo2.p, 0, kn(-1));
    // 팔
    const hd = man.posOf(B.head), hq = man.quatOf(B.head);
    eyeW = man.root.localToWorld(hd.clone().add(RE.clone().applyQuaternion(hq)));
    const back0 = man.rifleBack();
    if (aim > 0 && aimTarget) {
      const E = hd.clone().add(RE.clone().applyQuaternion(hq)), T = man.root.worldToLocal(tmp.copy(aimTarget)), dir = T.sub(E).normalize();
      aimW.copy(dir).transformDirection(man.root.matrixWorld);
      const z = dir, x = V(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      const bo = Math.sin(Math.PI * boltAmount(t)), un = kExit < Infinity ? sstep(seg(t, kExit, kExit + 0.22)) : 0;
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.09 * bo + 0.12 * un, 0, -0.28 * bo)));
      const p = E.clone().addScaledVector(dir, 0.085 + 0.05 * bo + 0.2 * un).sub(man.rifle.userData.eye.clone().applyQuaternion(q)).add(V(-0.02 * un, -0.04 * bo - 0.13 * un, 0));
      const w = rifleW(t);
      // 등 → 시야 아래 허리 앞(총구를 앞아래로) → 아래에서 올라와 견착 · 내려서 멜 땐 거꾸로
      const fl = V(dir.x, 0, dir.z).normalize(), dl = fl.clone().multiplyScalar(Math.cos(0.62)).add(V(0, -Math.sin(0.62), 0)), xl = V(0, 1, 0).cross(dl).normalize(), yl = dl.clone().cross(xl);
      const ql = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xl, yl, dl)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.45)));
      const pl = E.clone().addScaledVector(fl, 0.22).add(V(-0.07, -0.42, 0)).sub(man.rifle.userData.eye.clone().applyQuaternion(ql));
      if (w < 0.45) { const u = sstep(w / 0.45), mid = Math.sin(Math.PI * u); man.placeRifle(back0.p.clone().lerp(pl, u).add(V(-0.2 * mid, -0.08 * mid, 0.04 * mid)), back0.q.clone().slerp(ql, u)); }
      else { const u = sstep((w - 0.45) / 0.55); man.placeRifle(pl.clone().lerp(p, u), ql.clone().slerp(q, u)); }
      const gR = man.rp("grip").add(V(-0.025, -0.035, -0.06).applyQuaternion(man.rifle.quaternion)), gL = man.rp("fore").add(V(0.02, -0.045, -0.07).applyQuaternion(man.rifle.quaternion));
      const bolt = boltAmount(t);
      if (bolt > 0) { const kb = man.toRoot(man.rifle, V(-0.07, 0.01 + 0.03 * Math.min(1, bolt * 3), -0.02 - 0.09 * Math.sin(Math.PI * Math.min(1, bolt * 1.1)))); gR.lerp(kb.add(V(-0.02, -0.03, -0.07)), Math.sin(Math.PI * bolt) > 0 ? Math.min(1, Math.sin(Math.PI * bolt) * 2.5) : 0); }
      const reachR = sstep(clamp(w * 5, 0, 1)), reachL = sstep(clamp((w - 0.45) / 0.4, 0, 1));
      man.arm("R", restHand("R", t, v).lerp(gR, reachR), V(-1, -0.8, -0.2));
      man.arm("L", restHand("L", t, v).lerp(gL, reachL), V(0.7, -1, 0));
      man.fingers("R", 0.55 + 0.2 * reachR, 0.5); man.fingers("L", 0.35 + 0.3 * reachL, 0.4);
    } else {
      man.placeRifle(back0.p, back0.q);
      armsFK(t, v, r, strideW, lean);
    }
  }
  // 걸을 때·서 있을 때 팔 (어깨·팔꿈치를 직접 돌림)
  const swingT = (S, u, r, lean) => {   // u: 1 앞 · 0 가운데 · -1 뒤
    const s = S === "L" ? 1 : -1, f = V(s * 0.08, 1.37, 0.36 + lean * 0.35), b = V(s * 0.21, 0.98, -0.22), m = V(s * 0.21, 1.12, 0.06 + lean * 0.2);
    const p = m.clone().addScaledVector(f.clone().sub(b), u / 2).addScaledVector(f.clone().add(b).multiplyScalar(0.5).sub(m), u * u);
    return m.lerp(p, clamp(r * 1.5, 0, 1));
  };
  function armsFK(t, v, r, sw, lean) {
    const B = man.B, kicking = t > K.kick - 0.45 && t < K.kick + 0.9;
    if (v > 0.3 && !kicking) {
      B.chest.updateMatrixWorld(true);
      man.arm("L", swingT("L", -sw, r, lean), V(0.6, -0.6, -0.7)); man.arm("R", swingT("R", sw, r, lean), V(-0.6, -0.6, -0.7));
      man.fingers("L", 0.75, 0.6); man.fingers("R", 0.75, 0.6); return;
    }
    let aL = 0, aR = 0, eL = -0.25, eR = -0.25, abL = 0.12, abR = 0.12;
    if (v > 0.3) { const A = 0.35 + 0.7 * r; aL = -A * sw; aR = A * sw; eL = -1.35 - 0.35 * Math.max(0, -aL / A) * r; eR = -1.35 - 0.35 * Math.max(0, -aR / A) * r; abL = abR = 0.12; }
    if (kicking) { const u = t - K.kick, w = Math.sin(Math.PI * clamp((u + 0.45) / 1.3, 0, 1));
      aL = lerp(aL, -0.5, w); abL = lerp(abL, 1.15, w); eL = lerp(eL, -0.5, w); aR = lerp(aR, curve([-0.45, -0.1, 0.1, 0.4, 0.9], [0, -0.3, -0.55, -0.35, 0], u), w); abR = lerp(abR, 0.75, w); eR = lerp(eR, -0.8, w); }
    if (v < 0.3 && !kicking) { const b = Math.sin(t * 2.6); aL = aR = 0.04 * b; eL = eR = -0.22; }
    man.setE("armL", aL - lean * 0.3, 0, abL); man.setE("armR", aR - lean * 0.3, 0, -abR);
    man.setE("foreL", eL, 0, 0); man.setE("foreR", eR, 0, 0); man.setE("handL", 0, 0, 0.15); man.setE("handR", 0, 0, -0.15);
    B.chest.updateMatrixWorld(true);
    const curl = v > 0.3 ? 0.62 : 0.3; man.fingers("L", curl, curl * 0.7); man.fingers("R", curl, curl * 0.7);
  }
  // 팔을 내렸을 때 손목 자리 (총을 잡으러 가기 전·놓은 뒤)
  function restHand(S, t, v) { const side = S === "L" ? 1 : -1; return V(side * 0.24, 0.86, 0.04); }
  // 총: 0 등에 멤 ~ 1 견착
  const rifleW = t => { const a = sstep(seg(t, K.draw, K.draw + 0.42)); const b = kExit < Infinity ? 1 - sstep(seg(t, kExit + 0.42, kExit + 0.8)) : 1; return Math.min(a, b); };
  const aimAmount = t => { const a = sstep(seg(t, K.draw - 0.05, K.draw + 0.2)); const b = kExit < Infinity ? 1 - sstep(seg(t, kExit + 0.62, kExit + 0.95)) : 1; return Math.min(a, b); };
  const boltAmount = t => (kExit < Infinity ? seg(t, kExit + 0.02, kExit + 0.38) * (t < kExit + 0.38 ? 1 : 0) : 0);

  // ── 파편 ──
  function burst(C, vb, dir) {
    frags.visible = true;
    for (let i = 0; i < NFRAG; i++) {
      const p = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); if (p.lengthSq() > 1) { i--; continue; }
      p.multiplyScalar(rb * 0.95).add(C);
      const away = p.clone().sub(C).normalize(), big = Math.random() < 0.1, s = rb * 1.7 * (big ? rnd(0.11, 0.2) : 0.03 + Math.pow(Math.random(), 2.2) * 0.1);   // 쇠공이 작아도 파편은 잘 보이게
      const v = vb.clone().multiplyScalar(rnd(0.4, 0.75)).addScaledVector(dir, rnd(1.2, 7.5) * U).addScaledVector(away, rnd(0.5, 4.5) * U).add(V(0, rnd(0, 2.6) * U, 0));
      if (Math.random() < 0.1) v.addScaledVector(dir, -rnd(2, 5) * U);   // 일부는 맞은 쪽으로 튀어나옴
      FRG[i] = { p, v, r: V(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: V(rnd(-25, 25), rnd(-25, 25), rnd(-25, 25)), s: V(s * rnd(0.6, 1.4), s * rnd(0.5, 1.3), s * rnd(0.4, 1)), rest: false };
    }
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
  let landN = 0;
  function fragStep(dt) {
    if (!frags.visible || bState !== "gone") return;
    let tinks = 0;
    for (let i = 0; i < NFRAG; i++) {
      const f = FRG[i]; if (!f) continue;
      if (!f.rest) {
        f.v.y -= G_FLY * U * dt; f.v.multiplyScalar(Math.exp(-0.4 * dt)); f.p.addScaledVector(f.v, dt); f.r.addScaledVector(f.w, dt);
        if (f.p.y < FLOOR + f.s.y) {
          f.p.y = FLOOR + f.s.y;
          if (f.v.y < -2.5 * U) { if (landN < 26 && Math.random() < 0.06) { landN++; puff(f.p.x, f.p.z, 1, 0.6 * U, 0.6, 0.6); } if (tinks < 3 && Math.random() < 0.04) { tinks++; snd && snd.tink(Math.min(1, -f.v.y / (8 * U))); } }
          f.v.y = -f.v.y * 0.3; f.v.x *= 0.62; f.v.z *= 0.62; f.w.multiplyScalar(0.5);
          if (Math.abs(f.v.y) < 0.5 * U) { f.v.y = 0; if (f.v.lengthSq() < (0.25 * U) ** 2) f.rest = true; }
        }
      }
      frags.setMatrixAt(i, m4.compose(f.p, q4.setFromEuler(e4.set(f.r.x, f.r.y, f.r.z)), f.s));
    }
    frags.instanceMatrix.needsUpdate = true;
  }

  // ── 조준경 그리기 (2D 덧그림) ──
  let povIn = 0;
  let drawn = true;
  function drawScope(a, fired, blk = 0) {
    const W = vw, H = vh, x = sx; x.setTransform(PR, 0, 0, PR, 0, 0);
    if (a <= 0) {   // 조준경 밖: 눈을 대기 직전·뗀 직후의 어둠만
      if (blk > 0.002) { x.clearRect(0, 0, W, H); x.fillStyle = `rgba(4,4,4,${blk})`; x.fillRect(0, 0, W, H); drawn = true; } else if (drawn) { x.clearRect(0, 0, W, H); drawn = false; }
      return;
    }
    drawn = true; x.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * 0.46 * lerp(0.55, 1, eOut(a)), cx = W / 2, cy = H / 2;
    // 눈이 접안렌즈 중심에서 벗어난 만큼 한쪽이 어둡게 가려짐 (흔들림·반동)
    const ex = clamp(sway.yaw * 22 + sway.rec * 0, -40, 40), ey = clamp(-sway.pitch * 22 - sway.rec * 26, -60, 60);
    x.save(); x.beginPath(); x.rect(0, 0, W, H); x.arc(cx, cy, R, 0, Math.PI * 2); x.fillStyle = "#050505"; x.fill("evenodd");
    x.beginPath(); x.arc(cx, cy, R + 0.5, 0, 6.283); x.clip();
    // 렌즈 가장자리 그늘 · 눈 위치 그늘
    let g = x.createRadialGradient(cx, cy, R * 0.62, cx, cy, R); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.82, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,.92)"); x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2);
    if (Math.hypot(ex, ey) > 1) { g = x.createRadialGradient(cx + ex * 1.8, cy + ey * 1.8, R * 0.85, cx + ex * 1.8, cy + ey * 1.8, R * 1.25); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,.75)"); g.addColorStop(1, "rgba(0,0,0,1)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    if (a < 1) { x.fillStyle = `rgba(0,0,0,${(1 - a) * 0.9})`; x.fillRect(0, 0, W, H); }
    // 레티클: 굵은 기둥 → 가는 십자선 → 밀도트 → 아래쪽 탄도 보정 눈금 → 가운데 붉은 점
    const ink = "rgba(8,8,8,.92)", m = R * 0.072;
    x.fillStyle = ink; x.strokeStyle = ink;
    const post = R * 0.34, pw = Math.max(3, R * 0.022);
    x.fillRect(cx - R, cy - pw / 2, R - post, pw); x.fillRect(cx + post, cy - pw / 2, R - post, pw); x.fillRect(cx - pw / 2, cy + post, pw, R - post); x.fillRect(cx - pw / 2, cy - R, pw, R - post);
    x.lineWidth = 1.1; x.beginPath(); x.moveTo(cx - post, cy); x.lineTo(cx + post, cy); x.moveTo(cx, cy - post); x.lineTo(cx, cy + post); x.stroke();
    for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { x.beginPath(); x.ellipse(cx + dx * m * i, cy + dy * m * i, dx ? 1.3 : 2.1, dx ? 2.1 : 1.3, 0, 0, 6.283); x.fill(); }
    x.font = `600 ${Math.round(R * 0.045)}px system-ui,sans-serif`; x.textBaseline = "middle";
    for (let i = 1; i <= 4; i++) { const w = m * (0.9 - i * 0.12) * 1.6, y = cy + m * i + m * 0.5; x.fillRect(cx - w / 2, y - 0.5, w, 1); if (i % 2 === 0) x.fillText(String(i + 1), cx + w / 2 + 4, y); }
    x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, m * 0.45, 0, 6.283); x.stroke();
    g = x.createRadialGradient(cx, cy, 0, cx, cy, 6); g.addColorStop(0, "rgba(255,70,50,1)"); g.addColorStop(0.35, "rgba(255,40,25,.85)"); g.addColorStop(1, "rgba(255,30,20,0)"); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 6, 0, 6.283); x.fill();
    // 거리 측정 눈금 (왼쪽 아래)
    x.strokeStyle = ink; x.lineWidth = 1; const bx = cx - R * 0.52, by = cy + R * 0.42; x.beginPath(); x.moveTo(bx, by - m * 2); x.lineTo(bx, by); x.lineTo(bx + m * 2.2, by); for (let i = 1; i <= 4; i++) { x.moveTo(bx, by - (m * i) / 2); x.lineTo(bx + 4, by - (m * i) / 2); x.moveTo(bx + (m * i) / 2, by); x.lineTo(bx + (m * i) / 2, by - 4); } x.stroke();
    // 렌즈: 위쪽 반사광 · 가장자리 색번짐
    g = x.createLinearGradient(cx - R, cy - R, cx + R * 0.2, cy); g.addColorStop(0, "rgba(255,255,255,.07)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(cx - R * 0.25, cy - R * 0.45, R * 0.75, R * 0.3, -0.5, 0, 6.283); x.fill();
    x.lineWidth = 2; x.strokeStyle = "rgba(255,70,40,.22)"; x.beginPath(); x.arc(cx + 0.8, cy, R - 2, 0, 6.283); x.stroke(); x.strokeStyle = "rgba(60,140,255,.22)"; x.beginPath(); x.arc(cx - 0.8, cy, R - 2, 0, 6.283); x.stroke();
    if (fired > 0) { g = x.createRadialGradient(cx, cy + R, 0, cx, cy + R, R * 1.1); g.addColorStop(0, `rgba(255,214,150,${0.9 * fired})`); g.addColorStop(1, "rgba(255,150,60,0)"); x.globalCompositeOperation = "lighter"; x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2); x.globalCompositeOperation = "source-over"; }
    x.restore();
    // 접안렌즈 고무 테
    x.lineWidth = Math.max(6, R * 0.05); x.strokeStyle = "#0e0e0f"; x.beginPath(); x.arc(cx, cy, R + x.lineWidth / 2, 0, 6.283); x.stroke();
    x.lineWidth = 1; x.strokeStyle = "rgba(255,255,255,.07)"; x.beginPath(); x.arc(cx, cy, R + 2, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
  }

  // ── 시간 흐름 (느린 화면) ──
  let fireReal = 0, tReal = 0, impReal = 0;
  function timeScale() {
    if (k < K.pov + 0.45) return 1;
    if (k < K.fire) return lerp(1, 0.72, sstep(seg(k, K.pov + 0.28, K.pov + 0.55)));
    if (kImp === Infinity || k < kImp) return 0.065;
    const u = tReal - impReal; if (u < 0.26) return 0.045;
    return lerp(0.045, 1, eIn(seg(u, 0.26, 0.78)));
  }

  function tick(dtR) {
    if (!on) return;
    tReal += dtR; freeze -= dtR;
    ts = timeScale(); let dt = dtR * ts * (freeze > 0 ? 0.05 : 1);
    if (import.meta.env.DEV && api.devStop != null) dt = Math.max(0, Math.min(dt, api.devStop - k));
    k += dt;
    // ── 공 ──
    if (bState === "drop") {
      bv.y -= G_DROP * dt; bp.addScaledVector(bv, dt); ball.rotation.x += dt * 2;
      if (bp.y < FLOOR + rb) { bp.y = FLOOR + rb; const imp = -bv.y; if (imp > 160) { bv.y = imp * 0.36; snd.clang(Math.min(1, imp / 1100)); buzz(imp > 600 ? 2 : 1); puff(bp.x, bp.z, Math.round(imp / 140), 0.9 * U, 0.8, 0.5); shake = Math.max(shake, imp / 160); } else { bv.y = 0; bState = "rest"; } }
      ball.position.copy(bp);
    } else if (bState === "rest") { ball.position.copy(P0); }
    if (bState !== "fly" && k >= K.kick && bState !== "gone") {   // 뻥!
      bState = "fly"; snd.kick(); buzz([3, 30, 2]); freeze = 0.07; shake = 9; puff(P0.x - 0.1 * U, P0.z + 0.05 * U, 9, 1.6 * U, 1, 0.7); puff(P0.x, P0.z, 6, 2.2 * U, 0.8, 0.4); snd.whoosh(1.1);
    }
    if (bState === "fly") { const d = k - K.kick; ballAt(d, ball.position); ball.rotation.x -= dt * 16; ball.rotation.z += dt * 3; }
    if (bState !== "gone") { glint.position.copy(ball.position).add(V(-rb * 0.35, rb * 0.4, rb)); glint.material.opacity = bState === "fly" ? 0.5 : 0.3; }
    // ── 사람·총 ──
    const tgt = bState === "fly" ? ballAt(Math.max(0, k - K.kick) + 0.15, tmp2) : tr.on ? tr.p1 : null;
    if (k > 0.3) { man.root.visible = !(k >= K.pov && k < kExit); poseMan(k, tgt || ballAt(K.fire - K.kick, tmp2)); }
    beats();
    // ── 총알 ──
    if (tr.on && !tr.done) {
      const u = clamp((k - tr.t0) / tr.dur, 0, 1), p = tr.p0.clone().lerp(tr.p1, u);
      tracer.visible = true; tracer.position.copy(p); tracer.scale.setScalar(rb * 0.55); tracer.material.opacity = 0.95;
      const L = tr.p0.distanceTo(tr.p1), n = Math.floor((u * L - 2.5 * U) / (1.1 * U));
      while (tr.wake < Math.min(n, wakes.length)) { const m = wakes[tr.wake++]; m.visible = true; m.position.copy(tr.p0).lerp(tr.p1, (2.5 * U + tr.wake * 1.1 * U) / L); m.lookAt(tr.p1); m.userData.t = k; m.scale.setScalar(rb * 0.08); }
      if (u >= 1) { tr.done = true; tracer.visible = false; impact(); }
    }
    for (const m of wakes) if (m.visible) { const a = (k - m.userData.t) / 0.06; m.scale.setScalar(rb * (0.05 + a * 0.22)); m.material.opacity = Math.max(0, 0.32 - a * 0.3); if (m.material.opacity <= 0) m.visible = false; }
    fragStep(dt);
    if (sparkSys) sparkSys.step(dt);
    // ── 탄피 ──
    if (cas.on) { cas.v.y -= G_FLY * U * dt; cas.p.addScaledVector(cas.v, dt); casing.rotation.x += cas.w.x * dt; casing.rotation.z += cas.w.z * dt;
      if (cas.p.y < FLOOR + 0.006 * U) { cas.p.y = FLOOR + 0.006 * U; if (cas.v.y < -0.8 * U && cas.tink < 3) { cas.tink++; snd.tink(0.5); } cas.v.y *= -0.35; cas.v.x *= 0.6; cas.v.z *= 0.6; cas.w.multiplyScalar(0.6); }
      casing.position.copy(cas.p); }
    // ── 먼지 ──
    for (let i = 0; i < NP; i++) {
      const q = PS[i]; if (!q) { pAlpha[i] = 0; continue; }
      q.life += dt; const u = q.life / q.max; if (u >= 1) { pAlpha[i] = 0; continue; }
      q.vx *= Math.exp(-2.4 * dt); q.vz *= Math.exp(-2.4 * dt); q.vy = q.vy * Math.exp(-2 * dt) + 0.08 * U * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      pPos[i * 3] = q.x; pPos[i * 3 + 1] = q.y; pPos[i * 3 + 2] = q.z; pSize[i] = lerp(q.s0, q.s1, eOut(u)); pAlpha[i] = q.a * Math.pow(Math.sin(Math.PI * u), 0.6);
    }
    for (let i = PS.length - 1; i >= 0; i--) if (PS[i].life >= PS[i].max) PS.splice(i, 1);
    pGeo.attributes.position.needsUpdate = pGeo.attributes.aSize.needsUpdate = pGeo.attributes.aAlpha.needsUpdate = true;
    camera(dtR);
    // 바닥·빛
    const gA = sstep(seg(k, 0.3, 1.2)); gMat.opacity = gA; ground.visible = sky.visible = gA > 0.001; skyU.uA.value = gA; sky.position.copy(cam.position); dust.visible = true;
    if (hemi0) { hemi.color.copy(hemi0.c).lerp(hc.copy(skyU.uHor.value).lerp(skyU.uTop.value, 0.22), gA * 0.55); hemi.groundColor.copy(hemi0.g).lerp(skyU.uGnd.value, gA); }
    // 공을 내려다보며 찰 땐 가슴·팔이 시야를 덮지 않게 더 넓게 비움 (다리와 차는 발만 보임)
    clipU.uEye.value.copy(eyeW); clipU.uClipR.value = U * lerp(0.26, 0.36, Math.sin(Math.PI * clamp((k - K.kick + 0.5) / 1.1, 0, 1)));
    if (skyEnv && gA > 0.5 && scene.environment !== skyEnv) { env0 = scene.environment; envI0 = scene.environmentIntensity; scene.environment = skyEnv; scene.environmentIntensity = 0.9; }
    wall.material.opacity = wall0 * (1 - sstep(seg(k, 0.25, 0.7))); floorM.visible = false;
    const fc = man.root.visible ? man.root.position : ball.position;
    key.target.position.set(fc.x, FLOOR, fc.z); key.position.copy(key.target.position).add(tmp.copy(keyOff0).lerp(keyOff1, sstep(seg(k, 0.4, 1.4))));
    fadeU.uCam.value.copy(cam.position);
    if (k >= kEnd && done) { const d = done; done = null; d(); }
  }

  // 때맞춘 소리·진동·사건
  function beats() {
    // 다가오는 발소리
    for (const [st, n] of [[stL, "L"], [stR, "R"]]) st.forEach((q, i) => { if (k >= q.t0 && q.t0 > 0.6 && k - q.t0 < 0.2) once(`st${n}${i}`, () => { const v = q.run ? 1 : 0.5; snd.step(v); fp.jolt = q.run ? 1 : 0.45; fp.side = n === "L" ? 1 : -1; if (q.run && run && q.t0 > kRun0) buzz(1); puff(pathX - q.x * U, P0.z - q.s * U, q.run ? 3 : 2, 0.5 * U, 0.7, 0.5); }); });
    if (k >= K.draw + 0.05) once("draw", () => { snd.cloth(); });
    if (k >= K.draw + 0.36) once("rack", () => { snd.rack(); buzz(1); });
    if (k >= K.pov) once("pov", () => { snd.zoom(); snd.breeze(3.2); buzz(1); });
    if (k >= K.pov + 0.12) once("in", () => snd.breath(0));
    if (k >= K.pov + 0.4) once("out", () => snd.breath(1));
    for (let i = 0; i < 3; i++) if (k >= K.pov + 0.5 + i * 0.13) once("hb" + i, () => { snd.heart(); buzz(1); });
    if (k >= K.fire) once("fire", fire);
    if (kExit < Infinity && k >= kExit) once("exit", () => { snd.rack(); casingOut(); });
    if (kExit < Infinity && k >= kExit + 0.45) once("sling", () => snd.cloth());
    if (kExit < Infinity && k >= kExit + 0.3) once("plan", planRun);   // 달려 나가기(kRun0) 전에 계획
    if (run && k >= kStop - 0.55) once("skid", () => { snd.skid(); puff(pathX, P0.z - runS(k) * U, 8, 1.2 * U, 1, 0.4); buzz(2); });
    if (run && k >= kStop + 0.15) once("exhale", () => snd.breath(1));
  }
  function fire() {
    const d = K.fire - K.kick, eye = eyeW.clone(), lead = V();
    // 총알이 닿을 때 공이 있을 자리 (거리 / 총알 속도만큼 앞을 겨눔)
    let tF = 0.02; for (let i = 0; i < 3; i++) { ballAt(d + tF, lead); tF = eye.distanceTo(lead) / (BUL * U); }
    const muzzle = eye.clone().addScaledVector(aimW, 0.95 * U).add(V(0, -0.07 * U, 0));
    Object.assign(tr, { on: true, p0: muzzle, p1: lead.clone(), t0: k, dur: tF, wake: 0, done: false });
    impDir.copy(lead).sub(muzzle).normalize();
    snd.sniper(); buzz([3, 40, 3, 60, 2]); sway.rv += 95; fireReal = tReal; shake = 3;
    snd.whiz();
  }
  function impact() {
    kImp = k; impReal = tReal; bState = "gone"; ball.visible = false; glint.visible = false;
    const vb = V(0, (VY0 - G_FLY * (k - K.kick)) * U, -VZ0 * U); impP.copy(tr.p1);
    burst(impP, vb, impDir); if (sparkSys) sparkSys.fire(impP, impDir);
    c.flash(impP); snd.impact(); buzz([3, 40, 3, 40, 3]);
    kExit = kImp + 0.46; kRun0 = kExit + 0.48;
    setTimeout(() => snd.shatter(), 400);
  }
  function casingOut() {
    const p = man.toRoot(man.rifle, V(-0.03, 0.04, 0.05)), w = man.root.localToWorld(p.clone());
    cas.on = true; cas.p.copy(w); cas.tink = 0; casing.visible = true;
    cas.v.copy(man.rifle.localToWorld(V(-1, 0.6, -0.2)).sub(man.rifle.localToWorld(V())).normalize().multiplyScalar(2.6 * U)); cas.w.set(rnd(-30, 30), 0, rnd(-30, 30));
  }

  // ── 카메라: 처음엔 원래 화면 → 그 자리가 곧 그 사람의 눈 (모두 1인칭) ──
  // 달릴 땐 눈이 몸을 따라 출렁이고, 발을 디딜 때마다 툭 흔들리며 좌우로 기울고, 살짝 아래를 봐서 무릎·발·흔드는 손이 화면 아래로 보임
  const up = V(0, 1, 0), FOV_FP = 78, D0 = V(0, 0, -1);
  const fp = { dir: V(0, 0, -1), init: false, jolt: 0, side: 1 };
  let povT = 0, black = 0;
  function camera(dtR) {
    let p = V(), dir = V(), fov = fov0, scope = 0, fired = 0, roll = 0;
    const eye = eyeW.clone().add(V(0, -0.02 * U, -0.1 * U * (1 - aimAmount(k)) * (k < K.draw ? 1 : 0)));   // 공을 내려다볼 땐 고개가 앞으로 나감
    fp.jolt *= Math.exp(-dtR * 9);
    if (k >= K.pov && k < kExit) {    // 조준경
      scope = 1; povT += dtR; fired = Math.max(0, 1 - (tReal - fireReal) / 0.12) * (fireReal > 0 ? 1 : 0);
      // 숨 쉬는 흔들림 (숨 참으면 거의 멈춤) + 손떨림 + 반동(용수철)
      const hold = sstep(seg(k, K.pov + 0.42, K.pov + 0.64)) * (fireReal ? 0 : 1), A = lerp(0.32, 0.05, hold), tt = tReal;
      const sy = Math.sin(tt * 1.7) * A * 0.6 + Math.sin(tt * 5.3) * 0.02, sp = Math.sin(tt * 3.4) * A * 0.45 + Math.sin(tt * 7.1) * 0.015;
      sway.rv += (-90 * sway.rec - 11 * sway.rv) * dtR; sway.rec += sway.rv * dtR;
      sway.yaw = sy; sway.pitch = sp + sway.rec * 0.22;
      const tgt = kImp < Infinity ? impP.clone().lerp(fragCenter(), clamp((k - kImp) / 0.5, 0, 1) * 0.7) : bState === "fly" ? ballAt(k - K.kick, V()) : impP.clone();
      const catchUp = 1 - eOut(seg(k, K.pov, K.pov + 0.45));   // 처음엔 공을 늦게 따라잡음
      if (catchUp > 0) tgt.add(V(0, catchUp * 1.6 * U, catchUp * 1.2 * U));
      dir.copy(tgt).sub(eye).normalize(); const right = V().crossVectors(dir, up).normalize(), upv = V().crossVectors(right, dir);
      dir.addScaledVector(right, Math.tan(THREE.MathUtils.degToRad(sway.yaw))).addScaledVector(upv, Math.tan(THREE.MathUtils.degToRad(sway.pitch))).normalize();
      p.copy(eye); fov = 4.2 * (vh / (2 * Math.min(vw, vh) * 0.46)); povIn = seg(povT, 0, 0.28);
      fp.dir.copy(dir);
    } else {
      // 볼 곳: 다가갈 땐 공 너머 → 공 · 찬 뒤엔 날아가는 공 · 쏜 뒤엔 맞힌 자리 → 파편 · 달릴 땐 파편 쪽 땅 · 멈추면 앞을 똑바로
      let T, down = 0;
      if (k < K.kick - 0.05) { const w = sstep(seg(k, K.go, K.kick - 0.4)); T = P0.clone().add(V(0, 0.4 * U * (1 - w), -(3 - 1.6 * w) * U)); down = 0.06 + 0.08 * w; }   // 공 조금 너머를 봄 (다가가면 공은 화면 아래로 · 차면 솟아오름)
      else if (k < K.pov) T = bState === "fly" ? ball.position.clone() : P0.clone();
      else if (!run || k < kRun0) { T = impP.clone().lerp(pile, sstep(seg(k, kExit + 0.45, kExit + 1.1))); down = 0.32 * sstep(seg(k, kExit + 0.05, kExit + 0.4)); }
      else { T = V(pathX, FLOOR, pile.z); down = 0.56; }   // 달릴 땐 앞쪽 땅을 봐서 흔드는 손·올라오는 무릎·발끝이 아래로 보임
      const endW = run ? eInOut(seg(k, kStop - 0.35, kEnd - 0.2)) : 0;
      if (endW > 0) { T.lerp(V(pathX, 0, pile.z), endW); down *= 1 - endW; }
      const want = T.sub(eye).normalize();
      if (down) want.applyAxisAngle(V().crossVectors(want, up).normalize(), -down);
      if (!fp.init) { fp.dir.copy(want); fp.init = true; }
      fp.dir.lerp(want, 1 - Math.exp(-dtR * (k > K.kick && k < K.pov ? 6 : 9))).normalize();
      // 발 디딜 때 툭 (고개가 살짝 숙여졌다 돌아옴) · 좌우로 기울기 · 뛰는 동안 잔떨림
      const vNow = k < K.kick ? appV(k) : run ? runV(k) : 0;
      dir.copy(fp.dir).applyAxisAngle(V().crossVectors(fp.dir, up).normalize(), -0.03 * fp.jolt);
      if (vNow > 0.5) dir.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.0025 * vNow / 7)).normalize();
      const yMin = k > K.kick - 0.6 && k < K.kick + 0.6 ? -0.5 : -0.68;   // 너무 내려다보지 않게 (찰 땐 더: 가슴·총이 안 보이게)
      if (dir.y < yMin) { const h = Math.sqrt(1 - yMin * yMin) / (Math.hypot(dir.x, dir.z) || 1); dir.x *= h; dir.z *= h; dir.y = yMin; }   // 너무 내려다보지 않게
      roll = 0.03 * fp.side * fp.jolt * clamp(vNow / 4, 0.3, 1);
      p.copy(eye); if (endW > 0) p.lerp(V(pathX, 0, pile.z + D), endW);
      const fpF = lerp(FOV_FP, 88, run ? sstep(seg(k, kRun0 - 0.2, kRun0 + 0.5)) : 0); fov = endW > 0 ? lerp(fpF, fov0, endW) : fpF;
      // 원래 화면 → 눈
      const fw = eInOut(seg(k, K.fp0, K.fp1));
      if (fw < 1) { p.lerp(V(0, 0, D), 1 - fw); dir.lerp(D0, 1 - fw).normalize(); fov = lerp(fov0, fov, fw); roll *= fw; }
      // 조준경에 눈을 대기 직전·떼고 난 직후는 접안렌즈가 시야를 가림
      black = k < K.pov ? sstep(seg(k, K.pov - 0.14, K.pov)) : 1 - sstep(seg(k, kExit, kExit + 0.2));
    }
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const near = k > K.fp0 ? 3 : 20; if (cam.near !== near) { cam.near = near; cam.updateProjectionMatrix(); }
    shake *= Math.exp(-dtR * 9);
    p.add(V(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(shake * (scope ? 0.15 : 0.5)));
    cam.up.copy(up).applyAxisAngle(dir, roll); cam.position.copy(p); cam.lookAt(tmp.copy(p).add(dir)); camP.copy(p);
    if (sx) drawScope(scope ? povIn : 0, fired, scope ? 0 : black);
  }
  const fc0 = V();
  function fragCenter() { let n = 0; fc0.set(0, 0, 0); for (let i = 0; i < NFRAG; i += 7) { const f = FRG[i]; if (!f) continue; fc0.add(f.p); n++; } return n ? fc0.multiplyScalar(1 / n) : fc0.copy(impP); }

  const api = {
    warm, K, devStop: null,
    get k() { return k; }, get phase() { return k < K.pov ? "kick" : k < kExit ? "scope" : k < kEnd ? "run" : "end"; },
    start(o) {
      snd = o.snd; ui = o.ui; done = o.onEnd; on = true; k = 0; tReal = 0; hit.clear(); man.B.head.visible = false; fp.init = false;   // 1인칭: 내 머리는 안 그림 wall0 = wall.material.opacity;
      B0.copy(ball.getWorldPosition(V())); bp.copy(B0); bv.set(0, -40, 0); bState = "drop";
      P0.set(B0.x, FLOOR + rb, B0.z); pathX = P0.x - 0.1 * U;
      planApproach(); run = null; kImp = kExit = kRun0 = kStop = kEnd = Infinity;
      scv = document.createElement("canvas"); scv.className = "cr-scope"; scv.width = Math.round(vw * PR); scv.height = Math.round(vh * PR); ui.prepend(scv); sx = scv.getContext("2d");
    },
    tick,
    // 영역전개 시작: 파편 무더기가 화면 가운데(원래 좌표)로 오게 모두 옮기고 바닥·사람은 치움
    toDomain() {
      on = false; const dx = -pathX, dz = -(pile.z);
      for (let i = 0; i < NFRAG; i++) { const f = FRG[i]; if (f) { f.p.x += dx; f.p.z += dz; } }
      [man.root, ground, sky, dust, casing, tracer, ...wakes].forEach(o => (o.visible = false));
      if (hemi0) { hemi.color.copy(hemi0.c); hemi.groundColor.copy(hemi0.g); }
      if (env0) { scene.environment = env0; scene.environmentIntensity = envI0; env0 = null; }
      key.target.position.set(0, 0, 0); key.position.copy(keyOff0);
      cam.fov = fov0; cam.near = 20; cam.up.set(0, 1, 0); cam.updateProjectionMatrix();
      cam.position.set(0, 0, D); cam.lookAt(0, 0, 0);
      if (scv) { scv.remove(); scv = sx = null; }
    },
  };
  return api;
}
