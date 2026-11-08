// 블랙홀 연출의 효과들: 빛 점 · 빛줄기 · 원자(핵자·전자구름·전자) · 성운 수축 · 별(쌀알무늬 + 양파 껍질 단면) · 초신성 껍질 · 시공간 격자 · 제트 · 은하 · 성운 덩어리 · 마지막 빛 구슬
import * as THREE from "three";
import { addBlend } from "./bh-bodies.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NOISE = `precision highp sampler3D; uniform sampler3D uN; float nz(vec3 p){ return texture(uN, p).r; } float fbm(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 4; i++){ a += w * texture(uN, p).r; p = p * 2.03 + 0.17; w *= 0.5; } return a; }`;
const BB = `vec3 bb(float k){ k = max(k, 0.0); vec3 c = vec3(1.0, 0.16, 0.02) * smoothstep(0.0, 0.22, k); c = mix(c, vec3(1.0, 0.5, 0.14), smoothstep(0.14, 0.42, k)); c = mix(c, vec3(1.0, 0.84, 0.62), smoothstep(0.38, 0.74, k)); c = mix(c, vec3(0.94, 0.96, 1.0), smoothstep(0.7, 1.04, k)); return mix(c, vec3(0.6, 0.72, 1.0), smoothstep(1.04, 1.7, k)); }`;
export const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * Math.random()); };

// ── 빛 점 무리 (더하기 · HDR) ──
const GVS = `attribute vec4 aC; attribute float aS; uniform float uScale, uMin; varying vec4 vC; varying float vK; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float s = aS * uScale / max(-mv.z, 1e-3); gl_PointSize = clamp(s, uMin, 160.0); vK = min(1.0, (s * s) / (uMin * uMin)); vC = aC; if (-mv.z < 0.0) vC.a = 0.0; }`;
const GFS = `varying vec4 vC; varying float vK; void main(){ vec2 q = gl_PointCoord - 0.5; float r2 = dot(q, q) * 4.0; if (r2 > 1.0) discard; float a = (exp(-r2 * 5.0) + exp(-r2 * 1.6) * 0.18) * vC.a * vK; gl_FragColor = vec4(vC.rgb * a, 0.0); }`;
export function glowPoints(N, scale, minPx = 1.6) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), c = new Float32Array(N * 4), s = new Float32Array(N);
  const ap = new THREE.BufferAttribute(p, 3), ac = new THREE.BufferAttribute(c, 4), as = new THREE.BufferAttribute(s, 1); for (const b of [ap, ac, as]) b.setUsage(THREE.DynamicDrawUsage); g.setAttribute("position", ap); g.setAttribute("aC", ac); g.setAttribute("aS", as);
  const U = { uScale: { value: scale }, uMin: { value: minPx } }, m = addBlend(new THREE.ShaderMaterial({ uniforms: U, vertexShader: GVS, fragmentShader: GFS }));
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
  return { pts, U, p, c, s, N, touch() { ap.needsUpdate = ac.needsUpdate = as.needsUpdate = true; }, dispose() { g.dispose(); m.dispose(); } };
}
// ── 빛줄기 (속도 방향으로 꼬리) ──
export function streaks(N) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(N * 6), c = new Float32Array(N * 8); const ap = new THREE.BufferAttribute(p, 3), ac = new THREE.BufferAttribute(c, 4); ap.setUsage(THREE.DynamicDrawUsage); ac.setUsage(THREE.DynamicDrawUsage); g.setAttribute("position", ap); g.setAttribute("aC", ac);
  const m = addBlend(new THREE.ShaderMaterial({ vertexShader: "attribute vec4 aC; varying vec4 vC; void main(){ vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb * vC.a, 0.0); }" }));
  const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false; lines.renderOrder = 6;
  function set(i, hx, hy, hz, tx, ty, tz, r, gg, b, a) { const o = i * 6, k = i * 8; p[o] = hx; p[o + 1] = hy; p[o + 2] = hz; p[o + 3] = tx; p[o + 4] = ty; p[o + 5] = tz; c[k] = r; c[k + 1] = gg; c[k + 2] = b; c[k + 3] = a; c[k + 4] = r; c[k + 5] = gg; c[k + 6] = b; c[k + 7] = 0; }
  return { lines, set, N, touch(n = N) { g.setDrawRange(0, n * 2); ap.needsUpdate = ac.needsUpdate = true; }, dispose() { g.dispose(); m.dispose(); } };
}

// ── 카메라를 보는 판 하나 (빛 번짐 · 섬광 · 고리) ──
const BVS = "varying vec2 vQ; void main(){ vQ = position.xy; vec4 c = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelMatrix[0].xyz); c.xy += position.xy * s; gl_Position = projectionMatrix * c; }";
export function billboard(fs, uniforms, size = 2) { const m = addBlend(new THREE.ShaderMaterial({ uniforms, vertexShader: BVS, fragmentShader: fs })); const b = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); b.frustumCulled = false; b.renderOrder = 7; return b; }
export const glowFS = `uniform vec3 uC; uniform float uA, uCore; varying vec2 vQ; void main(){ float r = length(vQ); float a = exp(-r * r * 9.0) * uCore + exp(-r * 4.0) * 0.35 + exp(-r * 1.4) * 0.06; a *= smoothstep(1.0, 0.8, r); gl_FragColor = vec4(uC * a * uA, 0.0); }`;
export const ringFS = `${NOISE} uniform vec3 uC; uniform float uA, uR, uW; varying vec2 vQ; void main(){ float r = length(vQ), an = atan(vQ.y, vQ.x); float n = nz(vec3(cos(an) * 0.8, sin(an) * 0.8, r * 2.0 + uR)), w = uW * (0.7 + 0.6 * n), d = (r - uR) / w; float a = exp(-d * d * 2.2) * (0.6 + 0.8 * n) + exp(-pow(max(uR - r, 0.0) * 6.0, 1.3)) * 0.18 * step(r, uR); a *= smoothstep(1.0, 0.92, r); gl_FragColor = vec4(uC * a * uA, 0.0); }`;

// ── 원자 ──
// 핵: 양성자(붉음) · 중성자(회청) 공 · 전자구름(푸른 빛 안개) · 전자(빛 점 + 꼬리)
const NUC = { 1: [[0, 0, 0]], 2: [[-0.6, 0, 0], [0.6, 0, 0]], 3: [[0, 0.62, 0], [-0.54, -0.31, 0], [0.54, -0.31, 0]], 4: [[0.5, 0.5, 0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, -0.5], [0.5, -0.5, -0.5]] };
export function buildAtoms(noise, scale) {
  const group = new THREE.Group(), RN = 0.105, MAXN = 48;
  const nm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 0.8, 0.7), emissive: 0x000000 });
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 40, 28), nm, MAXN); inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false; inst.count = 0; group.add(inst);
  const cP = new THREE.Color(0.86, 0.15, 0.09), cN = new THREE.Color(0.58, 0.66, 0.78);
  // 전자구름: 1s 오비탈의 밀도를 판 위에 적분해서 그림
  const cloudFS = `${NOISE} uniform vec3 uC; uniform float uA, uT; uniform vec3 uSeed; varying vec2 vQ; void main(){ float r = length(vQ); if (r > 1.0) discard; float n = nz(vec3(vQ * 0.9, uT * 0.12) + uSeed); float a = exp(-r * 4.2) * (0.55 + 0.9 * n) + exp(-r * r * 40.0) * 0.25; a *= smoothstep(1.0, 0.6, r); gl_FragColor = vec4(uC * a * uA, 0.0); }`;
  const atoms = [], trail = streaks(16 * 14), glows = glowPoints(64, scale, 2);
  group.add(trail.lines, glows.pts);
  const flashes = []; for (let i = 0; i < 4; i++) { const U = { uC: { value: new THREE.Color(0.8, 0.85, 1.3) }, uA: { value: 0 }, uCore: { value: 2.2 } }, b = billboard(glowFS, U, 2); b.visible = false; group.add(b); const RU = { uN: { value: noise }, uC: { value: new THREE.Color(0.7, 0.8, 1.4) }, uA: { value: 0 }, uR: { value: 0 }, uW: { value: 0.05 } }, rb = billboard(ringFS, RU, 2); rb.visible = false; group.add(rb); const L = new THREE.PointLight(0xc8d4ff, 0, 6, 1.6); group.add(L); flashes.push({ b, U, rb, RU, L, t: -9, p: V() }); }
  function atom(pos, nP, nN, cloud = 1) {
    const U = { uN: { value: noise }, uC: { value: new THREE.Color(0.16, 0.36, 1.3) }, uA: { value: 0.55 * cloud }, uT: { value: 0 }, uSeed: { value: V(Math.random() * 4, Math.random() * 4, Math.random() * 4) } };
    const b = billboard(cloudFS, U, 2); b.scale.setScalar(0.62 + 0.14 * (nP + nN)); b.renderOrder = 4; group.add(b);
    const a = { p: pos.clone(), v: V(), nP, nN, cloud: b, U, rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0)), w: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.4), alive: true, conv: 0, e: [] };
    for (let k = 0; k < Math.max(1, nP); k++) a.e.push({ ax: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), ph: Math.random() * 6.28, r: 0.32 + Math.random() * 0.22, sp: 9 + Math.random() * 6 });
    atoms.push(a); return a;
  }
  const m4 = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv = V(), ts = V(1, 1, 1), col = new THREE.Color();
  function flash(p, k = 1, ring = 1) { const f = flashes.find(f => f.t < -1) || flashes[0]; f.t = 0; f.k = k; f.ring = ring; f.p.copy(p); f.b.position.copy(p); f.rb.position.copy(p); f.L.position.copy(p); f.b.visible = f.rb.visible = true; }
  const shots = []; // 감마선 · 양전자 · 중성미자 (빛줄기)
  function shoot(p, dir, speed, c, len, life) { shots.push({ p: p.clone(), v: dir.clone().normalize().multiplyScalar(speed), c, len, life, t: 0 }); }
  let bare = false;   // 별 속: 전자가 떨어져 나간 원자핵만 (플라스마)
  function update(t, dt) {
    let n = 0, ei = 0;
    for (const a of atoms) { if (!a.alive) { a.cloud.visible = false; continue; } a.p.addScaledVector(a.v, dt); const w = a.w.length(); if (w > 0) a.rot.premultiply(tq.setFromAxisAngle(tv.copy(a.w).divideScalar(w), w * dt)); a.U.uT.value = t; a.cloud.position.copy(a.p); a.cloud.visible = !bare;
      const tot = a.nP + a.nN, L = NUC[Math.min(4, tot)], sc = tot > 1 ? 1.0 : 0;
      for (let k = 0; k < tot && n < MAXN; k++) { const o = L[k % L.length]; tv.set(o[0], o[1], o[2]).multiplyScalar(RN * 1.2 * sc).applyQuaternion(a.rot).add(a.p); m4.compose(tv, tq.identity(), ts.setScalar(RN)); inst.setMatrixAt(n, m4); const isP = k < a.nP; col.copy(isP ? cP : cN); if (k === a.nP - 1 && a.conv > 0) col.lerpColors(cP, cN, a.conv); inst.setColorAt(n, col); n++; }
      if (!bare) for (const e of a.e) { if (ei >= 16) break; const base = e.ax.clone().cross(V(0.2, 1, 0.1)).normalize(), b2 = e.ax.clone().cross(base); for (let s = 0; s < 14; s++) { const ph = e.ph + t * e.sp - s * 0.07, ph2 = ph + 0.07, r = e.r * a.cloud.scale.x; const hx = a.p.x + (base.x * Math.cos(ph) + b2.x * Math.sin(ph)) * r, hy = a.p.y + (base.y * Math.cos(ph) + b2.y * Math.sin(ph)) * r, hz = a.p.z + (base.z * Math.cos(ph) + b2.z * Math.sin(ph)) * r, tx = a.p.x + (base.x * Math.cos(ph2) + b2.x * Math.sin(ph2)) * r, ty = a.p.y + (base.y * Math.cos(ph2) + b2.y * Math.sin(ph2)) * r, tz = a.p.z + (base.z * Math.cos(ph2) + b2.z * Math.sin(ph2)) * r; const al = Math.pow(1 - s / 14, 2) * 0.9 * a.U.uA.value / 0.55; trail.set(ei * 14 + s, tx, ty, tz, hx, hy, hz, 0.4, 0.65, 1.8, al); }
        const ph = e.ph + t * e.sp, r = e.r * a.cloud.scale.x; glows.p[ei * 3] = a.p.x + (base.x * Math.cos(ph) + b2.x * Math.sin(ph)) * r; glows.p[ei * 3 + 1] = a.p.y + (base.y * Math.cos(ph) + b2.y * Math.sin(ph)) * r; glows.p[ei * 3 + 2] = a.p.z + (base.z * Math.cos(ph) + b2.z * Math.sin(ph)) * r; glows.c.set([0.7, 1.0, 2.4, a.U.uA.value / 0.55], ei * 4); glows.s[ei] = 0.05; ei++; } }
    for (let i = ei; i < 16; i++) { glows.c[i * 4 + 3] = 0; for (let s = 0; s < 14; s++) trail.set(i * 14 + s, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); }
    // 빛줄기 (glows 16번부터)
    let si = 16; for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.t += dt; if (s.t > s.life) { shots.splice(i, 1); continue; } s.p.addScaledVector(s.v, dt); }
    for (const s of shots) { if (si >= 64) break; const f = 1 - s.t / s.life; glows.p.set([s.p.x, s.p.y, s.p.z], si * 3); glows.c.set([s.c[0], s.c[1], s.c[2], f], si * 4); glows.s[si] = s.len; si++; }
    for (let i = si; i < 64; i++) glows.c[i * 4 + 3] = 0;
    inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; trail.touch(); glows.touch();
    for (const f of flashes) { if (f.t < -1) continue; f.t += dt; const u = f.t; f.U.uA.value = f.k * (Math.exp(-u * 12) * 1.3 + Math.exp(-u * 2.5) * 0.12); f.b.scale.setScalar(0.28 + u * 0.8); f.RU.uR.value = Math.min(0.95, u * 1.6); f.RU.uA.value = f.ring * Math.exp(-u * 3.2) * 1.2; f.rb.scale.setScalar(0.75 * f.k); f.RU.uA.value *= 0.35; f.L.intensity = f.k * 5 * Math.exp(-u * 6); if (u > 1.6) { f.t = -9; f.b.visible = f.rb.visible = false; f.L.intensity = 0; } }
  }
  return { group, atoms, atom, flash, shoot, update, inst, RN, lights: flashes.map(f => f.L), setBare(v) { bare = v; }, setCloud(a, k) { a.U.uA.value = 0.55 * k; }, dispose() { inst.geometry.dispose(); nm.dispose(); trail.dispose(); glows.dispose(); for (const a of atoms) a.cloud.material.dispose(); for (const f of flashes) { f.b.material.dispose(); f.rb.material.dispose(); } } };
}

// ── 성운이 오그라들며 원시별이 됨: 점 하나하나의 처음 자리를 넣어 두고 셰이더가 수축·납작·회전을 계산 ──
const CVS = `attribute vec4 aP; attribute vec4 aC; uniform float uCol, uFlat, uSpin, uR, uScale, uA, uT, uWind; varying vec4 vC; varying float vK;
void main(){ float r0 = length(aP.xyz), k = mix(1.0, 0.05 + 0.12 * aP.w, uCol); vec3 p = aP.xyz * k; p.y *= mix(1.0, 0.18 + 0.2 * aP.w, uFlat);
  float om = uSpin / pow(max(length(p.xz), 0.05), 1.2), a = om * (0.6 + aP.w); float c = cos(a), s = sin(a); p.xz = mat2(c, -s, s, c) * p.xz;
  p += normalize(aP.xyz + 1e-4) * uWind * (0.4 + aP.w * 1.2);
  vec4 mv = modelViewMatrix * vec4(p * uR, 1.0); gl_Position = projectionMatrix * mv; float sz = (0.0014 + 0.0026 * aP.w * aP.w) * uR * uScale / max(-mv.z, 1e-3); gl_PointSize = clamp(sz, 1.4, 90.0); vK = min(1.0, sz * sz / 1.96);
  vC = vec4(aC.rgb, aC.a * uA); }`;
export function buildCloud(noise3, N, scale) {
  const g = new THREE.BufferGeometry(), P = new Float32Array(N * 4), C = new Float32Array(N * 4), pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { let x, y, z, l; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1); const n = noise3(x * 2.2 + 3, y * 2.2, z * 2.2 + 1); if (n < 0.42 && Math.random() < 0.75) { i--; continue; } const w = Math.random(); P.set([x, y, z, w], i * 4);
    const t = Math.random(), c = t < 0.55 ? [0.7, 0.82, 1.2] : t < 0.85 ? [1.1, 1.0, 0.9] : [1.2, 0.75, 0.5]; const b = 0.5 + 2.4 * Math.pow(Math.random(), 3); C.set([c[0] * b, c[1] * b, c[2] * b, 1], i * 4); }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aP", new THREE.BufferAttribute(P, 4)); g.setAttribute("aC", new THREE.BufferAttribute(C, 4));
  const U = { uCol: { value: 0 }, uFlat: { value: 0 }, uSpin: { value: 0 }, uR: { value: 1 }, uScale: { value: scale }, uA: { value: 1 }, uT: { value: 0 }, uWind: { value: 0 } };
  const m = addBlend(new THREE.ShaderMaterial({ uniforms: U, vertexShader: CVS, fragmentShader: GFS })); const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4;
  return { pts, U, dispose() { g.dispose(); m.dispose(); } };
}

// ── 큰 별: 쌀알무늬 · 주연감광 + 앞쪽을 쐐기로 잘라 양파 껍질(수소·헬륨·탄소·산소·규소·철) 단면을 보여 줌 ──
const SV = "varying vec3 vL, vN, vP; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }";
const BIGSF = `${NOISE} ${BB} uniform float uTemp, uI, uT, uCut, uAz, uCell, uPulse; varying vec3 vL, vN, vP;
void main(){ vec3 d = normalize(vL); float az = atan(d.x, d.z); if (uCut > 0.001 && abs(az - uAz) < uCut * 0.5) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vP); float mu = max(dot(n, v), 0.0);
  vec3 q = d * uCell; float g1 = nz(q + vec3(0.0, uT * 0.05, 0.0)), g2 = nz(q * 2.4 + vec3(uT * 0.08, 0.0, 0.0)), g3 = nz(q * 6.0 - vec3(0.0, 0.0, uT * 0.12));
  float gran = smoothstep(0.48, 0.92, g1 * 0.5 + g2 * 0.32 + g3 * 0.18), big = fbm(d * 1.4 + vec3(uT * 0.03));
  vec3 c = bb(uTemp) * uI * (0.62 + 0.7 * gran) * (0.82 + 0.36 * big) * (1.0 + uPulse);
  c *= 0.28 + 0.72 * pow(mu, 0.55); c *= mix(vec3(1.0, 0.55, 0.32), vec3(1.0), smoothstep(0.0, 0.45, mu)); c *= mix(vec3(1.0), vec3(0.62, 0.78, 1.3), smoothstep(1.0, 1.35, uTemp));
  gl_FragColor = vec4(c, 1.0); }`;
const CUTF = `${NOISE} ${BB} uniform float uLay, uI, uT, uCol, uHot, uFe, uSh; varying vec2 vQ;
vec3 layC(int k){ if (k == 0) return vec3(0.95, 0.2, 0.06); if (k == 1) return vec3(1.0, 0.46, 0.08); if (k == 2) return vec3(1.0, 0.74, 0.16); if (k == 3) return vec3(0.82, 0.9, 0.42); if (k == 4) return vec3(0.42, 0.66, 1.0); return vec3(0.34, 0.15, 0.1); }
void main(){ float r = length(vQ); if (r > 1.0) discard; float rc = r / max(1.0 - 0.75 * uCol, 0.05);
  float B[5]; B[0] = 0.62; B[1] = 0.43; B[2] = 0.31; B[3] = 0.21; B[4] = 0.125 * (1.0 - 0.93 * uFe);
  int k = 0; float edge = 9.0; for (int i = 0; i < 5; i++) { float b = B[i] * clamp(uLay - float(i), 0.0, 1.0); if (rc < b) k = i + 1; edge = min(edge, abs(rc - b) + (b <= 0.0 ? 9.0 : 0.0)); }
  float n = fbm(vec3(vQ * 3.0, uT * 0.1 + float(k) * 1.7)), n2 = nz(vec3(vQ * 9.0, uT * 0.2));
  vec3 c = layC(k) * (k == 5 ? 0.45 + uHot * 5.0 : 0.85 + 0.7 * (1.0 - r)) * (0.65 + 0.7 * n) * (0.85 + 0.3 * n2);
  if (k == 0) c *= 0.7 + 0.6 * smoothstep(0.5, 0.85, fbm(vec3(vQ * 5.0, uT * 0.3)));
  c += vec3(1.0, 0.86, 0.6) * exp(-edge * edge * 9000.0) * 1.4;
  c *= mix(1.0, 0.3, smoothstep(0.85, 1.0, r)) * uI;
  // 철 핵이 무너지는 순간 가운데 중성미자 섬광 · 되튐 충격파가 안에서 바깥으로 (지나간 자리는 뜨겁게 달아오름)
  c += vec3(0.75, 0.88, 1.5) * exp(-r * r * 500.0) * uFe * 2.4;
  if (uSh > 0.0) { float w = (r - uSh) / (0.03 + 0.03 * uSh), sn = 0.8 + 0.4 * nz(vec3(vQ * 6.0, uT)); c = mix(c, vec3(1.6, 1.1, 0.75) * 1.25 * sn, step(r, uSh) * 0.75); c += vec3(1.7, 1.5, 1.3) * exp(-w * w) * 2.0 * sn; }
  gl_FragColor = vec4(c, 1.0); }`;
export function buildBigStar(noise) {
  const group = new THREE.Group(), U = { uN: { value: noise }, uTemp: { value: 1.3 }, uI: { value: 6 }, uT: { value: 0 }, uCut: { value: 0 }, uAz: { value: Math.PI / 4 }, uCell: { value: 5 }, uPulse: { value: 0 } };
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 80), new THREE.ShaderMaterial({ uniforms: U, vertexShader: SV, fragmentShader: BIGSF })); body.frustumCulled = false; group.add(body);
  const CU = { uN: U.uN, uLay: { value: 0 }, uI: { value: 1 }, uT: U.uT, uCol: { value: 0 }, uHot: { value: 0 }, uFe: { value: 0 }, uSh: { value: 0 } };
  const faces = []; for (let i = 0; i < 2; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(1, 96, -Math.PI / 2, Math.PI), new THREE.ShaderMaterial({ uniforms: CU, vertexShader: "varying vec2 vQ; void main(){ vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: CUTF, side: THREE.DoubleSide })); f.visible = false; f.frustumCulled = false; group.add(f); faces.push(f); }
  const GU = { uC: { value: new THREE.Color(1, 0.8, 0.6) }, uA: { value: 1 }, uCore: { value: 0 } }, halo = billboard(glowFS, GU, 2); halo.scale.setScalar(5); group.add(halo);
  function setCut(k) { U.uCut.value = k * Math.PI / 2; faces.forEach((f, i) => { const az = U.uAz.value + (i ? 1 : -1) * U.uCut.value * 0.5; f.rotation.set(0, az - Math.PI / 2, 0); f.visible = k > 0.001; }); }
  return { group, body, U, CU, GU, halo, faces, setCut, dispose() { body.geometry.dispose(); body.material.dispose(); faces.forEach(f => { f.geometry.dispose(); f.material.dispose(); }); halo.geometry.dispose(); halo.material.dispose(); } };
}

// ── 초신성 껍질: 얇게 빛나는 겉면 + 실 같은 필라멘트 (수소 붉은빛 · 산소 청록빛) ──
const SNF = `${NOISE} uniform float uA, uT, uR, uF; varying vec3 vL, vN, vP;
void main(){ vec3 d = normalize(vL), n = normalize(vN), v = normalize(cameraPosition - vP); float f = 1.0 - abs(dot(n, v));
  float fl = fbm(d * 2.2 + uR * 0.05), fl2 = fbm(d * 5.5 + 3.0 + uR * 0.08), fil = exp(-pow((fl - 0.66) * 28.0, 2.0)) + exp(-pow((fl2 - 0.66) * 34.0, 2.0)) * 0.7;
  float fil2 = exp(-pow((fl - 0.67) * 44.0, 2.0)) + exp(-pow((fl2 - 0.67) * 52.0, 2.0)) * 0.6; vec3 c = mix(vec3(0.12, 0.8, 0.95), vec3(1.0, 0.16, 0.26), smoothstep(0.3, 0.9, f + (fl - 0.68) * 2.0)) * (fil2 * 1.6 * (0.04 + 0.96 * pow(f, 1.8)) + pow(f, 4.0) * 0.4) + vec3(1.0, 0.6, 0.3) * pow(f, 8.0) * 0.4;
  // 고르지 않게: 덩어리진 곳만 밝고(레일리-테일러 손가락) 사이사이는 비어 보임 · 막 터졌을 땐 뜨거운 불덩이
  float pt = smoothstep(0.5, 0.82, fbm(d * 1.25 + 7.0 + uR * 0.015)); c *= 0.22 + 1.35 * pt;
  c += mix(vec3(1.5, 0.95, 0.55), vec3(1.6, 1.4, 1.2), pt) * (0.35 + 0.65 * pow(f, 1.5)) * (0.55 + 0.6 * fl) * uF;
  gl_FragColor = vec4(c * uA, 0.0); }`;
export function buildShell(noise) { const U = { uN: { value: noise }, uA: { value: 0 }, uT: { value: 0 }, uR: { value: 0 }, uF: { value: 0 } }; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), addBlend(new THREE.ShaderMaterial({ uniforms: U, vertexShader: SV, fragmentShader: SNF, side: THREE.DoubleSide }))); m.frustumCulled = false; m.renderOrder = 3; return { mesh: m, U, dispose() { m.geometry.dispose(); m.material.dispose(); } }; }

// ── 시공간 격자: 질량이 모일수록 우물이 깊어지고 결국 빨려 들어감 ──
export function buildGrid(N = 56, size = 30) {
  const pos = [], uv = []; const line = (ax, ay, bx, by) => { const S = 64; for (let i = 0; i < S; i++) { const t0 = i / S, t1 = (i + 1) / S; pos.push(ax + (bx - ax) * t0, 0, ay + (by - ay) * t0, ax + (bx - ax) * t1, 0, ay + (by - ay) * t1); } };
  for (let i = 0; i <= N; i++) { const x = (i / N - 0.5) * size; line(x, -size / 2, x, size / 2); line(-size / 2, x, size / 2, x); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const U = { uDepth: { value: 0 }, uEps: { value: 1 }, uA: { value: 0 }, uPull: { value: 0 }, uHalf: { value: size / 2 }, uT: { value: 0 } };
  const m = addBlend(new THREE.ShaderMaterial({ uniforms: U, vertexShader: `uniform float uDepth, uEps, uPull, uHalf, uT; varying float vA, vD; void main(){ vec3 p = position; float r = length(p.xz);
    float a = uPull * 9.0 / (r + 0.6); float c = cos(a), s = sin(a); p.xz = mat2(c, -s, s, c) * p.xz * mix(1.0, 0.0, clamp(uPull * (1.4 - r / (uHalf * 1.4)), 0.0, 1.0)); float rr = length(p.xz);
    float w = 1.0 / sqrt(rr * rr + uEps * uEps) - 1.0 / sqrt(uHalf * uHalf + uEps * uEps), w0 = 1.0 / uEps - 1.0 / sqrt(uHalf * uHalf + uEps * uEps); p.y = uDepth * (w0 - w); vA = smoothstep(uHalf, uHalf * 0.55, r); vD = uDepth > 0.001 ? clamp(1.0 - p.y / max(uDepth * w0, 1e-3), 0.0, 1.0) : 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: "uniform float uA; varying float vA, vD; void main(){ vec3 c = mix(vec3(0.25, 0.75, 1.6), vec3(0.9, 0.5, 1.8), vD); gl_FragColor = vec4(c * vA * uA * (1.0 + vD * 2.0), 0.0); }" }));
  const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false; lines.renderOrder = 2; return { lines, U, dispose() { g.dispose(); m.dispose(); } };
}

// ── 상대론적 제트: 양 극에서 뿜는 빛 기둥 ──
export function buildJets(noise) {
  const U = { uN: { value: noise }, uA: { value: 0 }, uT: { value: 0 }, uL: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } }, group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.32, 0.03, 1, 48, 64, true); geo.translate(0, 0.5, 0);
  const m = addBlend(new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, vertexShader: "varying vec3 vL, vP, vN; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }",
    fragmentShader: `${NOISE} uniform float uA, uT, uL; uniform vec3 uTint; varying vec3 vL, vP, vN; void main(){ vec3 v = normalize(cameraPosition - vP); float f = abs(dot(normalize(vN), v)), y = vL.y; if (y > uL) discard;
      float n = fbm(vec3(atan(vL.x, vL.z) * 0.6, y * 5.0 - uT * 5.0, 0.3)), k = pow(f, 4.0) * smoothstep(0.55, 0.95, n + 0.25 * f) * exp(-y * 2.2) * smoothstep(0.0, 0.04, y) * smoothstep(uL, uL * 0.5, y);
      vec3 c = mix(vec3(0.45, 0.6, 1.5), vec3(1.2, 1.25, 1.7), exp(-y * 6.0)) * uTint; gl_FragColor = vec4(c * k * uA * 0.9, 0.0); }` }));
  for (const s of [1, -1]) { const j = new THREE.Mesh(geo, m); j.scale.y = s; j.frustumCulled = false; j.renderOrder = 3; group.add(j); }
  return { group, U, dispose() { geo.dispose(); m.dispose(); } };
}

// ── 나선 은하 그림 (캔버스) ──
export function galaxyTex(seed) {
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 512, 512); x.globalCompositeOperation = "lighter";
  const R = 230, arms = 2 + (seed % 2), tw = 3.2 + (seed % 3) * 0.6; let rs = seed * 9301 + 49297; const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
  const core = x.createRadialGradient(256, 256, 0, 256, 256, 90); core.addColorStop(0, "rgba(255,240,215,1)"); core.addColorStop(0.25, "rgba(255,214,160,.55)"); core.addColorStop(1, "rgba(255,200,150,0)"); x.fillStyle = core; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const t = Math.pow(rnd(), 0.7), r = t * R, arm = (i % arms) * (Math.PI * 2 / arms), a = arm + Math.log(1 + r / 18) * tw + (rnd() - 0.5) * (0.5 + 0.9 * (1 - t)), sp = (rnd() - 0.5) * 18 * (0.3 + t);
    const px = 256 + Math.cos(a) * r + sp * Math.cos(a + 1.57), py = 256 + Math.sin(a) * r + sp * Math.sin(a + 1.57), b = (1 - t) * 0.5 + 0.15, blue = t > 0.35 && rnd() < 0.6, pink = rnd() < 0.04 && t > 0.3;
    x.fillStyle = pink ? `rgba(255,120,170,${b})` : blue ? `rgba(150,180,255,${b * 0.7})` : `rgba(255,225,190,${b * 0.6})`; const s = rnd() < 0.02 ? 2.4 : 1.1; x.fillRect(px, py, s, s); }
  x.globalCompositeOperation = "source-over"; x.filter = "blur(1.2px)"; x.drawImage(c, 0, 0); x.filter = "none";
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function galaxy(tex) { const U = { uT: { value: tex }, uA: { value: 1 } }; const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), addBlend(new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "uniform sampler2D uT; uniform float uA; varying vec2 vU; void main(){ vec3 c = texture2D(uT, vU).rgb; gl_FragColor = vec4(c * c * uA * 3.0, 0.0); }" }))); m.frustumCulled = false; m.renderOrder = 2; return { mesh: m, U, dispose() { m.geometry.dispose(); m.material.dispose(); } }; }

// ── 성운 덩어리 (빅뱅 때 퍼지는 가스) ──
export const nebFS = `${NOISE} uniform vec3 uC, uC2; uniform float uA, uT; uniform vec3 uSeed; varying vec2 vQ; void main(){ float r = length(vQ); if (r > 1.0) discard; vec3 q = vec3(vQ * 0.55, uT * 0.02) + uSeed; vec2 w = texture(uN, q * 0.5).rg - 0.7; q.xy += w * 0.9; float n = fbm(q), n2 = fbm(q * 1.6 + 4.0), fil = exp(-pow((n - 0.7) * 12.0, 2.0)), body = smoothstep(0.64, 0.92, n);
  float a = (fil * 0.7 + body * 0.45) * smoothstep(1.0, 0.25, r); vec3 c = mix(uC, uC2, smoothstep(0.55, 0.85, n2)); gl_FragColor = vec4(c * a * uA, 0.0); }`;

// ── 마지막 빛 구슬: 아주 밝은 알맹이 + 부드러운 번짐 + 숨 쉬듯 일렁임 ──
export const orbFS = `${NOISE} uniform float uA, uT, uP; varying vec2 vQ; void main(){ float r = length(vQ), an = atan(vQ.y, vQ.x); float n = nz(vec3(cos(an) * 1.5, sin(an) * 1.5, uT * 0.4)), cr = 0.085 * (1.0 + 0.06 * sin(uT * 2.6) + 0.04 * (n - 0.6));
  float core = smoothstep(cr, cr * 0.82, r), halo = (exp(-r * 14.0) * (0.5 + 0.3 * uP) + exp(-r * 5.0) * 0.06 + exp(-pow(max(r - cr, 0.0) * 40.0, 1.4)) * 0.7) * smoothstep(1.0, 0.55, r);
  float rays = 0.0; for (int i = 0; i < 3; i++) { float ang = an + uT * 0.07 + float(i) * 1.0472; rays += pow(abs(cos(ang)), 180.0) * exp(-r * 5.5); } rays *= smoothstep(1.0, 0.4, r) * smoothstep(cr * 0.8, cr * 1.6, r) * (0.7 + 0.3 * uP);
  vec3 c = vec3(1.0, 0.98, 0.95) * core * 9.0 + mix(vec3(0.5, 0.65, 1.3), vec3(1.3, 1.1, 0.95), exp(-r * 8.0)) * halo * 2.0 + vec3(0.8, 0.88, 1.2) * rays * 1.3; gl_FragColor = vec4(c * uA, 0.0); }`;

// ── 부피 성운: 구 하나 안을 광선으로 걸으며 빛나는 가스(수소 붉은빛 · 산소 청록빛)와 먼지(가림)를 쌓음 · uCol로 돌며 납작하게 오그라듦 ──
export function buildNebula(noise) {
  const U = { uN: { value: noise }, uCamO: { value: V() }, uA: { value: 1 }, uCol: { value: 0 }, uCore: { value: 0 }, uT: { value: 0 }, uSeed: { value: V(1.3, 4.7, 2.2) }, uK: { value: 7 }, uHot: { value: 0 }, uDust: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: "varying vec3 vO; void main(){ vO = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `precision highp sampler3D; uniform sampler3D uN; uniform vec3 uCamO, uSeed; uniform float uA, uCol, uCore, uT, uK, uHot, uDust; varying vec3 vO;
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float dens(vec3 p, out float cl, out float dk){ float r = length(p), sw = uCol * 6.5 / (r * 3.5 + 0.5), c = cos(sw), s = sin(sw);
  vec3 q = vec3(c * p.x - s * p.z, p.y / mix(1.0, 0.2, uCol), s * p.x + c * p.z); float lump = texture(uN, q * 0.55 + uSeed * 0.3).r - 0.7, rq = length(q) + lump * 0.9 * (1.0 - uCol * 0.7), shape = smoothstep(1.0, 0.36, rq);
  vec3 w = q * 1.6 + uSeed + vec3(0.0, uT * 0.01, 0.0); vec2 wv = texture(uN, w * 0.45).rg - 0.7; w += vec3(wv.x, wv.y, wv.x - wv.y) * 1.5;
  float n = texture(uN, w).r * 0.6 + texture(uN, w * 2.6 + 0.37).r * 0.4; vec2 g = texture(uN, w * 0.7 + 5.0).rg; cl = g.x; dk = smoothstep(0.66 - 0.1 * uDust, 0.82 - 0.08 * uDust, g.y) * (1.0 - uHot);
  return (smoothstep(0.66, 0.9, n) * (0.6 + 0.8 * smoothstep(0.75, 0.95, n)) + smoothstep(0.45, 0.0, rq) * 0.035) * shape; }
void main(){ vec3 ro = uCamO, rd = normalize(vO - uCamO); float b = dot(ro, rd), cc = dot(ro, ro) - 1.0, h = b * b - cc; if (h <= 0.0) discard; h = sqrt(h); float t0 = max(-b - h, 0.0), t1 = -b + h; if (t1 <= 0.0) discard;
  const int N = 26; float dt = (t1 - t0) / float(N), j = h12(gl_FragCoord.xy); vec3 acc = vec3(0.0); float T = 1.0;
  for (int i = 0; i < N; i++) { vec3 p = ro + rd * (t0 + (float(i) + j) * dt); float cl, dk, d = dens(p, cl, dk); if (d > 0.002) {
      float r = length(p); vec3 e = mix(vec3(1.25, 0.16, 0.3), vec3(0.08, 0.6, 0.8), smoothstep(0.62, 0.8, cl)); e = mix(e, vec3(1.2, 0.6, 0.32), smoothstep(0.78, 0.92, cl) * 0.6);
      e = mix(e, mix(vec3(0.95, 0.24, 0.05), vec3(1.25, 0.66, 0.28), smoothstep(0.55, 0.85, cl)), uHot);
      e += vec3(1.3, 0.95, 0.7) * uCore * exp(-r * 7.0) * 2.0; float a = 1.0 - exp(-d * dt * uK);
      acc += T * e * a * (1.0 - dk * 0.92); T *= 1.0 - a * (0.2 + dk * 0.9); if (T < 0.03) break; } }
  float al = (1.0 - T) * uA; gl_FragColor = vec4(acc * uA * 0.9, al * 0.85); }` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), m); mesh.frustumCulled = false; mesh.renderOrder = -5;
  const inv = new THREE.Matrix4();
  return { mesh, U, update(cam) { mesh.updateMatrixWorld(); inv.copy(mesh.matrixWorld).invert(); U.uCamO.value.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(inv); }, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}

// ── 낮 하늘 (파란 하늘 → 고도가 오르면 검은 우주): uUp = 지구 반대쪽 ──
export function buildDaySky() {
  const U = { uUp: { value: V(0, 1, 0) }, uSun: { value: V(0.4, 0.6, 0.7).normalize() }, uAlt: { value: 0 }, uVis: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: "varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }",
    fragmentShader: `uniform vec3 uUp, uSun; uniform float uAlt, uVis; varying vec3 vD;
void main(){ vec3 d = normalize(vD); float e = dot(d, uUp), s = max(dot(d, uSun), 0.0), k = uAlt, h = clamp(e * 0.5 + 0.5, 0.0, 1.0);
  vec3 zen = mix(vec3(0.07, 0.24, 0.74), vec3(0.003, 0.006, 0.024), smoothstep(0.0, 1.0, k)), hor = mix(vec3(0.5, 0.7, 0.98), vec3(0.05, 0.16, 0.5), smoothstep(0.0, 0.85, k));
  vec3 c = mix(hor, zen, pow(h, 0.75)); c += vec3(0.85, 0.92, 1.0) * pow(1.0 - h, 3.0) * 0.4 * (1.0 - k * 0.7);
  c += vec3(1.0, 0.93, 0.8) * (pow(s, 6.0) * 0.3 + pow(s, 350.0) * 5.0) * (1.0 - 0.5 * k);
  gl_FragColor = vec4(c * uVis, uVis); }` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), m); mesh.frustumCulled = false; mesh.renderOrder = -20;
  return { mesh, U, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}
// ── 뭉게구름 한 덩이 (카메라를 보는 판 · 해 쪽이 밝음 · 보통 섞기) ──
export function cloudSprite(noise) {
  const U = { uN: { value: noise }, uSeed: { value: V(Math.random() * 9, Math.random() * 9, Math.random() * 9) }, uLit: { value: 1 }, uA: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, vertexShader: BVS,
    fragmentShader: `precision highp sampler3D; uniform sampler3D uN; uniform vec3 uSeed; uniform float uLit, uA; varying vec2 vQ;
void main(){ float r = length(vQ); if (r > 1.0) discard; vec3 q = vec3(vQ * 1.15, 0.0) + uSeed;
  float n = texture(uN, q * 0.55).r * 0.55 + texture(uN, q * 1.3 + 0.3).r * 0.3 + texture(uN, q * 3.1 + 0.7).r * 0.15;
  float sh = smoothstep(1.0, 0.2, r + (n - 0.7) * 1.1), a = smoothstep(0.22, 0.62, sh) * uA; if (a < 0.003) discard;
  float lit = clamp(0.5 + vQ.y * 0.38 - vQ.x * 0.12 + (n - 0.7) * 1.6, 0.0, 1.0); vec3 c = mix(vec3(0.5, 0.58, 0.72), vec3(1.06, 1.04, 1.0), lit) * uLit;
  gl_FragColor = vec4(c, a); }` });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); b.frustumCulled = false; b.renderOrder = 1; return { mesh: b, U, dispose() { b.geometry.dispose(); m.dispose(); } };
}
