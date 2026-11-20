// 영역전개 여러 가지(고죠·마히토·죠고)가 같이 쓰는 도구: 손가락 자세 · 손 배치 · 화면 배경 · 점 입자 · 소리 · 공용 조명
// 손 좌표는 crush.js와 같음(+y 손가락, +z 손바닥, +x 엄지). 왼손은 거울 속 오른손 기준 → 양손에 같은 값을 주면 좌우 대칭.
import * as THREE from "three";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V, buzz } from "./fx-util.js";

// ── 손가락 자세: 관절마다 [x 굽힘(음수 = 손바닥 쪽), y 벌림, z 비틀림] ──
export const fg = (p, i, d, s = 0) => [[0, 0, 0], [p, s, 0], [i, 0, 0], [d, 0, 0]];
export const FIST = { index: fg(-1.45, -1.7, -1.05), middle: fg(-1.5, -1.75, -1.1), ring: fg(-1.55, -1.75, -1.1), pinky: fg(-1.6, -1.7, -1.05) };
export const POSE = {
  relax: { index: fg(-0.25, -0.3, -0.15, 0.05), middle: fg(-0.3, -0.32, -0.15), ring: fg(-0.35, -0.36, -0.18, -0.05), pinky: fg(-0.42, -0.4, -0.2, -0.1), thumb: [[-0.1, 0.1, 0], [-0.15, 0, 0], [-0.2, 0, 0]] },
  spread: { index: fg(0.12, 0.04, 0, 0.22), middle: fg(0.1, 0.04, 0, 0.06), ring: fg(0.1, 0.04, 0, -0.1), pinky: fg(0.1, 0.04, 0, -0.26), thumb: [[0.2, -0.35, 0], [0.1, 0, 0], [0.1, 0, 0]] },
  point: { index: fg(0.05, 0, 0, 0.04), middle: FIST.middle, ring: FIST.ring, pinky: FIST.pinky, thumb: [[-0.6, 0.3, 0], [-0.5, 0, 0], [-0.6, 0, 0]] },
  claw: { index: fg(-0.2, -0.45, -0.3, 0.2), middle: fg(-0.18, -0.45, -0.3, 0.05), ring: fg(-0.2, -0.45, -0.3, -0.1), pinky: fg(-0.24, -0.45, -0.3, -0.24), thumb: [[0.15, -0.3, 0], [-0.15, 0, 0], [-0.25, 0, 0]] },
  palm: { index: fg(0.02, 0, 0, 0.12), middle: fg(0.02, 0, 0, 0.03), ring: fg(0.02, 0, 0, -0.06), pinky: fg(0.02, 0, 0, -0.15), thumb: [[0.25, -0.3, 0], [0.05, 0, 0], [0.05, 0, 0]] },
};
export const copyPose = (a, out) => { for (const k in a) out[k] = a[k].map(r => r.slice()); return out; };
export const mixPose = (o, b, u) => { if (u <= 0) return; for (const k in o) { const A = o[k], B = b[k]; for (let i = 0; i < A.length; i++) for (let j = 0; j < 3; j++) A[i][j] += (B[i][j] - A[i][j]) * u; } };
export const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
export const key2 = (p, q, b = [0, 0]) => ({ p, q, b: new THREE.Vector2(b[0], b[1]) });

// 손 하나 놓기: keys(이름 → {p,q,b}) 를 steps 순서대로 섞고, poses 를 차례로 섞음. extra(xf, pose) 로 떨림 등 덧붙임
const xf = { p: V(), q: new THREE.Quaternion(), b: new THREE.Vector2() }, qb = new THREE.Quaternion(), eu = new THREE.Euler(), poseBuf = {};
export function placeHand(rg, k, steps, poses, scale, extra) {
  xf.p.copy(k.start.p); xf.q.copy(k.start.q); xf.b.copy(k.start.b);
  for (const [name, u] of steps) { if (u <= 0) continue; const kk = k[name]; xf.p.lerp(kk.p, u); xf.q.slerp(kk.q, u); xf.b.lerp(kk.b, u); }
  copyPose(POSE.relax, poseBuf);
  for (const [p, u] of poses) mixPose(poseBuf, p, u);
  if (extra) extra(xf, poseBuf);
  rg.root.position.copy(xf.p); rg.root.quaternion.copy(xf.q); rg.root.scale.setScalar(scale);
  rg.sleeve.quaternion.copy(rg.sleeveQ0).premultiply(qb.setFromEuler(eu.set(xf.b.x, 0, xf.b.y)));
  for (const n in poseBuf) rg.H.setChain(n, poseBuf[n]);
}
// 떨림 (힘줘서 버틸 때)
export const tremble = (xf, t, side, tr) => { if (tr <= 0) return; xf.p.x += Math.sin(t * 73 + side) * 1.3 * tr; xf.p.y += Math.sin(t * 91 + side * 2) * 1.0 * tr; xf.q.multiply(qb.setFromEuler(eu.set(0, 0, Math.sin(t * 67 + side) * 0.01 * tr))); };

// 배경·바닥을 손·파편보다 먼저 그림 (깊이를 안 남김)
export const under1st = (m, order, blend = "normal") => {
  m.transparent = false; m.depthWrite = false;
  if (blend === "add") m.blending = THREE.AdditiveBlending;
  else Object.assign(m, { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  return order;
};
// 화면 전체 배경 셰이더: 손에서 번지는 먹물 가장자리(INK) + 각자 그리는 안쪽(body)
export const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }`;
export function makeBG(c, body, extraU = {}) {
  const { vw, vh, renderer } = c, PR = renderer.getPixelRatio();
  const u = Object.assign({ uRes: { value: new THREE.Vector2(vw, vh) }, uPR: { value: PR }, uO: { value: new THREE.Vector2(vw / 2, vh / 2) }, uR: { value: 0 }, uDim: { value: 0 }, uA: { value: 1 }, uT: { value: 0 }, uRim: { value: 0 }, uRimC: { value: new THREE.Color(1, 0.32, 0.18) } }, extraU);
  const fs = `uniform vec2 uRes; uniform float uPR; uniform vec2 uO; uniform float uR; uniform float uDim; uniform float uA; uniform float uT; uniform float uRim; uniform vec3 uRimC;
${Object.keys(extraU).map(k => `uniform ${extraU[k].glsl} ${k};`).join("\n")}
${NOISE_GLSL}
vec3 body(vec2 p);
void main(){
  vec2 p = gl_FragCoord.xy / uPR, d = p - uO;
  float r = length(d), an = atan(d.y, d.x);
  float n = fbm(vec2(an * 2.2 + 7.0, r * 0.006 - uT * 0.4)) - 0.5;
  float e = uR * (1.0 + n * 0.45);
  float ink = 1.0 - smoothstep(e - 26.0, e + 6.0, r);
  float rim = exp(-pow((r - e) / 11.0, 2.0)) * uRim * step(1.0, uR);
  vec3 col = body(p) + uRimC * rim;
  gl_FragColor = vec4(col, clamp(max(ink, uDim) + rim * 0.7, 0.0, 1.0) * uA);
}
${body}`;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.99999, 1.0); }", fragmentShader: fs }));
  m.renderOrder = under1st(m.material, -100); m.frustumCulled = false;
  return { mesh: m, u };
}

// ── 점 입자 (점마다 크기·투명도·색) ──
const PT_VS = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vA = aAlpha; vC = aColor; }`;
const PT_FS = `uniform float uSoft; varying float vA; varying vec3 vC;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = (1.0 - smoothstep(uSoft, 1.0, r)) * vA; if (a < 0.002) discard; gl_FragColor = vec4(vC, a); }`;
export function makePts(c, n, { add = true, soft = 0, order = 0 } = {}) {
  const { D, renderer } = c, PR = renderer.getPixelRatio();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), col = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSize", new THREE.BufferAttribute(size, 1)); g.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1)); g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR }, uSoft: { value: soft } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  mesh.frustumCulled = false; mesh.renderOrder = order;
  const set = (i, x, y, z, s, a, r, gg, b) => { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; size[i] = s; alpha[i] = a; col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; };
  const hide = i => { alpha[i] = 0; pos[i * 3 + 1] = -1e5; };
  const upd = () => { g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = g.attributes.aColor.needsUpdate = true; };
  return { mesh, n, set, hide, upd };
}

// ── 빛나는 구슬 (속은 하얗게 타고 겉은 소용돌이치는 막) ──
const ORB_VS = `varying vec3 vN, vP, vV; void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ORB_FS = `uniform vec3 uCol; uniform float uT, uA, uSpin; varying vec3 vN, vP, vV;
${NOISE_GLSL}
void main(){
  float f = 1.0 - abs(dot(vN, vV));
  vec3 q = normalize(vP); float a = atan(q.z, q.x), b = q.y;
  float n = fbm(vec2(a * 2.0 + uT * uSpin + b * 2.5, b * 3.0 - uT * 0.7)) ;
  float sw = smoothstep(0.35, 0.85, n);
  vec3 c = mix(uCol, vec3(1.0), pow(1.0 - f, 3.0) * 0.85);
  float al = (0.25 + 0.75 * pow(f, 1.6)) * (0.55 + 0.9 * sw) + pow(1.0 - f, 4.0) * 0.9;
  gl_FragColor = vec4(c * (0.8 + sw * 0.8), clamp(al, 0.0, 1.0) * uA);
}`;
export function makeOrb(color, glowTex) {
  const g = new THREE.Group();
  const u = { uCol: { value: new THREE.Color(color) }, uT: { value: 0 }, uA: { value: 1 }, uSpin: { value: 1.6 } };
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ uniforms: u, vertexShader: ORB_VS, fragmentShader: ORB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.scale.setScalar(5.5); core.scale.setScalar(1.5); g.add(glow, shell, core);
  [shell, glow, core].forEach(o => (o.frustumCulled = false));
  return { g, u, shell, glow, core, set(t, r, a) { g.visible = a > 0.002 && r > 0.01; g.scale.setScalar(Math.max(0.01, r)); u.uT.value = t; u.uA.value = a; glow.material.opacity = 0.75 * a; core.material.opacity = a; } };
}

// ── 공용 조명 (장면마다 한 벌만 · 영역마다 빛깔만 바꿈 → 셰이더를 다시 만들지 않음) ──
export function sharedLights(c) {
  const { scene, vw, D, FLOOR } = c;
  if (scene.userData.domL) return scene.userData.domL;
  const dir = new THREE.DirectionalLight(0xffffff, 0); dir.position.set(0.25 * D, 0.3 * D, -1.2 * D); scene.add(dir);
  const p1 = new THREE.PointLight(0xffffff, 0, vw * 2.4, 0), p2 = new THREE.PointLight(0xffffff, 0, vw * 2.4, 0); p1.position.set(0, FLOOR + 170, -120); p2.position.set(0, 0, 200); scene.add(p1, p2);
  return (scene.userData.domL = { dir, p1, p2, off() { dir.intensity = p1.intensity = p2.intensity = 0; } });
}

// ── 소리 합성 도구 (짓누르기와 같은 오디오 출력) ──
export function synth(get) {
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
  return { A, noise, tone, ring, play(fn) { const a = A(); if (a) fn(a, a.c.currentTime); } };
}

// ── 영역전개 공통 진행 ──
// 인을 맺으면(T.seal) 번쩍 반전 + 손에서 어둠이 번지고 → 글자 → (각 영역의 능력) → T.boom 에 달력을 밑에 다시 깔고 → T.retract 어둠이 걷힘 → T.end
// def: { key, T, bg:{body, u, rim}, init(par, o), update(t, dt, E), beats(t, E), cam(t, E) }
export function domainBase(c, def) {
  const { scene, cam, vw, vh, D, S, hemi, key, rim, frags } = c;
  const diag = Math.hypot(vw, vh), T = def.T, warm = [];
  const add = o => { o.visible = false; o.frustumCulled = false; scene.add(o); warm.push(o); return o; };
  const bg = makeBG(c, def.bg.body, def.bg.u || {}); add(bg.mesh); if (def.bg.rim) bg.u.uRimC.value.set(def.bg.rim);
  const L = sharedLights(c);
  let on = false, d = 0, ctx = null, domEl = null, invEl = null, N = 0;
  const par = [], hit = new Set(), once = (k, fn) => { if (!hit.has(k)) { hit.add(k); fn(); } };
  const base = { hemi: hemi.intensity, key: key.intensity, rim: rim.intensity, env: scene.environmentIntensity };
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), pv = V(), sv = V();
  const toScreen = v => { const p = v.clone().project(cam); return new THREE.Vector2((p.x + 1) / 2 * vw, (p.y + 1) / 2 * vh); };
  const center = new THREE.Vector2(vw / 2, vh * 0.5);
  const E = {
    add, warm, bg, L, par, once, toScreen, freeze: 0, shake: 0, cp: V(), cl: V(), origin: new THREE.Vector2(vw / 2, vh * 0.55), dk: 0,
    get ctx() { return ctx; }, get N() { return N; },
    setFrag(i, x, y, z, rx, ry, rz, s, k = 1) { frags.setMatrixAt(i, m4.compose(pv.set(x, y, z), qt.setFromEuler(eu.set(rx, ry, rz)), k === 1 ? s : sv.copy(s).multiplyScalar(k))); },
    invert() { invEl.classList.add("on"); setTimeout(() => invEl.classList.remove("on"), 70); setTimeout(() => invEl.classList.add("on"), 120); setTimeout(() => invEl.classList.remove("on"), 160); },
    title() { domEl.style.opacity = ""; domEl.classList.add("on"); },
    titleOff() { domEl.classList.add("off"); },
    restore() { if (api.debugD == null) ctx.onRestore(); },
  };
  function world(t) {
    const spread = eOut(seg(t, T.seal, T.seal + 0.75)), shrink = eInOut(seg(t, T.retract, T.end - 0.1));
    bg.u.uT.value = t; bg.u.uO.value.copy(shrink > 0 ? center : E.origin);
    bg.u.uDim.value = 0.4 * sstep(seg(t, 0.05, 0.9)) * (1 - sstep(seg(t, T.retract, T.retract + 0.7)));
    bg.u.uR.value = diag * 1.35 * spread * (1 - shrink);
    bg.u.uRim.value = (t > T.seal ? 1 - seg(t, T.seal + 0.45, T.seal + 0.9) : 0) + Math.sin(Math.PI * shrink) * 0.6;
    const pre = 0.3 * sstep(seg(t, 0, 0.9)) * (1 - seg(t, T.retract, T.end)), dk = sstep(seg(t, T.seal, T.seal + 0.6)) * (1 - sstep(seg(t, T.retract, T.end - 0.1)));
    const lk = Math.max(pre, dk); E.dk = dk;
    hemi.intensity = lerp(base.hemi, 0.16, lk); key.intensity = lerp(base.key, 2.0, lk); rim.intensity = lerp(base.rim, 0.5, lk); scene.environmentIntensity = lerp(base.env, 0.3, lk);
  }
  function camBase(t, dt) {
    const { cp, cl } = E; cp.set(0, 0, D); cl.set(0, 0, 0);
    const k1 = eInOut(seg(t, 0, T.seal + 0.15)); cp.lerp(pv.set(0, -vh * 0.02, D * 0.92), k1); cl.lerp(pv.set(0, -vh * 0.03, 30), k1);
    if (t > T.seal) cp.z -= D * 0.03 * Math.exp(-(t - T.seal) * 8);
    def.cam(t, E);
    const k5 = eInOut(seg(t, T.retract, T.end - 0.05)); cp.lerp(pv.set(0, 0, D), k5); cl.lerp(pv.set(0, 0, 0), k5);
    E.shake *= Math.exp(-dt * 7);
    const amp = E.amp || 0;
    cp.x += (Math.sin(t * 37) * 0.6 + Math.sin(t * 59 + 1.3) * 0.4) * amp + rnd(-1, 1) * E.shake;
    cp.y += (Math.sin(t * 43 + 0.7) * 0.6 + Math.sin(t * 67) * 0.4) * amp + rnd(-1, 1) * E.shake;
    const o = api.camOverride;
    if (o) { cam.position.fromArray(o.p); cam.lookAt(pv.fromArray(o.l)); } else { cam.position.copy(cp); cam.lookAt(cl); }
  }
  function beats(t) {
    const { snd } = ctx;
    once("up", () => { snd.whoosh(0.7); buzz(1); });
    if (t >= T.seal - 0.5) once("swell", () => snd.swell(0.5));
    if (t >= T.seal) once("seal", () => { snd.seal(); buzz([3, 50, 3, 110, 2]); E.shake = 16; E.freeze = 0.09; E.invert(); });
    if (t >= T.text) once("text", () => { snd.title(); buzz(2); E.title(); });
    if (t >= (T.toff || T.text + 2.6)) once("toff", () => E.titleOff());   // 글자는 잠깐 보이고 사라짐 (능력이 잘 보이게)
    def.beats(t, E);
    if (t >= T.boom) once("boom", () => E.restore());
    if (t >= T.retract) once("retract", () => { snd.close(); domEl.hidden = true; });
    if (t >= T.end) once("end", () => { if (api.debugD == null) { on = false; L.off(); ctx.onEnd(); } });
  }
  const api = {
    key: def.key, T, warm, debugD: null, camOverride: null, E,
    start(o) {
      ctx = o; on = true; d = 0; E.freeze = 0; E.shake = 0; hit.clear();
      domEl = o.ui.querySelector(".cr-dom"); invEl = o.ui.querySelector(".cr-inv");
      domEl.style.opacity = "0.004"; domEl.hidden = false;
      N = o.frg.length; par.length = 0;
      for (let i = 0; i < N; i++) { const f = o.frg[i]; par.push({ x: f.p.x, y: f.p.y, z: f.p.z, rx: f.r.x, ry: f.r.y, rz: f.r.z, s: f.s }); }
      def.init(par, o, E);
      c.mir.visible = true; c.floorM.visible = false; frags.visible = true; bg.mesh.visible = true;
      L.off();
    },
    tick(dtR) {
      if (!on) return;
      E.freeze -= dtR; d += E.freeze > 0 ? dtR * 0.06 : dtR;
      const t = api.debugD ?? d;
      def.update(t, dtR, E); world(t); if (def.light) def.light(t, E); beats(t); camBase(t, dtR);
      frags.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}

// 피보나치 구 위 고른 방향
export const fibDir = (i, n) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963; return V(Math.cos(a) * r, y, Math.sin(a) * r); };
export { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V };
