// 화성 연출의 연기: 납작한 그림이 아니라 입자 하나하나를 "공 모양 연기 덩어리"로 그림.
// 조각마다 3D 잡음으로 표면을 파내고(뭉게뭉게), 그 굴곡으로 면의 방향을 구해 해·하늘·땅빛을 계산함 → 입체감과 자기 그림자.
// 늙을수록 잡음에 더 깎여 가늘게 흩어지고, 갓 나온 가스는 뜨겁게 희고 빠르며, 소용돌이 바람을 타고 말려 올라감.
// 낮은 해상도로 따로 그린 뒤 합성 (폰에서도 돌도록) · 차와 사람 뒤로 지나가면 가려지고 맞닿는 곳은 부드럽게 사라짐.
import * as THREE from "three";
import volUrl from "./assets/vol64.bin?url";

const VS = `attribute vec4 iA, iB, iC; attribute vec2 iD; varying vec2 vP, vL, vQ, vR; varying vec4 vB, vC; varying vec3 vV; varying float vS;
void main(){ vec4 mv = viewMatrix * vec4(iA.xyz, 1.0); float a = iB.y * 6.2831 + (iB.y - 0.5) * iB.z * 1.6, c = cos(a), s = sin(a), ct = cos(iD.x), st = sin(iD.x);
  vL = position.xy * 2.0; vP = vec2(ct * vL.x - st * vL.y, st * vL.x + ct * vL.y); vQ = vec2(c * vL.x - s * vL.y, s * vL.x + c * vL.y); vR = vec2(c, s);
  vec2 sx = position.xy * vec2(1.0 + iD.y, 1.0 - 0.14 * min(iD.y, 3.0)); mv.xy += vec2(ct * sx.x - st * sx.y, st * sx.x + ct * sx.y) * iA.w; vV = mv.xyz; vB = iB; vC = iC; vS = iA.w; gl_Position = projectionMatrix * mv; }`;
const FS = `precision highp sampler3D;
uniform sampler3D uN; uniform sampler2D uD; uniform vec2 uInv; uniform float uNear, uFar, uExp;
uniform vec3 uSun, uSunC, uAmb, uGnd, uLP, uLC; uniform float uLK;
varying vec2 vP, vL, vQ, vR; varying vec4 vB, vC; varying vec3 vV; varying float vS;
float linZ(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec3 fire(float k){ k = clamp(k, 0.0, 1.0); vec3 c = mix(vec3(0.16, 0.03, 0.01), vec3(1.5, 0.3, 0.05), smoothstep(0.0, 0.34, k)); c = mix(c, vec3(3.2, 1.5, 0.36), smoothstep(0.3, 0.68, k)); return mix(c, vec3(6.5, 5.6, 4.4), smoothstep(0.66, 1.0, k)); }
void main(){
  float r2 = dot(vL, vL); if (r2 >= 1.0) discard;
  float zz = sqrt(1.0 - r2), age = vB.z, ero = vC.x, shd = vC.z;
  // 공 표면을 따라 3D 잡음을 뽑음: 입자 안에서 말려 올라가는 뭉게뭉게
  vec3 q = vec3(vQ, zz) * 0.15 + vB.y * vec3(9.7, 5.3, 7.1); q.z += age * 0.035;
  float a = texture(uN, q).r, b = texture(uN, q * 2.3 + 0.37 + (a - 0.5) * 0.09).r, c = texture(uN, q * 5.1 + 0.71).r, n = a * 0.56 + b * 0.3 + c * 0.14;
  float prof = 1.0 - r2 * (1.42 + (0.72 - a) * 3.2 + (0.72 - b) * 1.8), f = prof * 1.2 + (n - 0.7) * (3.6 + ero * 1.5) + 0.3 - ero * 0.5, den = smoothstep(0.0, mix(0.3, 0.9, ero), f) * smoothstep(0.0, 0.34, 1.0 - r2) * smoothstep(-0.05, 0.3, prof);
  float al = den * vB.x;
  float sz = linZ(texture2D(uD, gl_FragCoord.xy * uInv).r), soft = clamp((sz + vS * zz * 0.35 + vV.z) / max(vS * 0.5, 0.02), 0.0, 1.0); al *= soft;
  if (al < 0.003) discard;
  // 면의 방향: 공 모양 + 뭉게 표면의 기울기
  vec3 qb = q * 2.3 + 0.37 + (a - 0.5) * 0.09, ex = vec3(vR.x, vR.y, 0.0) * 0.03, ey = vec3(-vR.y, vR.x, 0.0) * 0.03; vec2 gr = vec2(0.0); if (vC.y < 0.5) gr = clamp(vec2(texture(uN, qb + ex).r - b, texture(uN, qb + ey).r - b) * 9.0, -1.3, 1.3);
  vec3 nn = normalize(vec3(vP * 0.95 - gr, zz + 0.2));
  float lam = clamp(dot(nn, uSun) * 0.72 + 0.34, 0.0, 1.0); lam = lam * lam * (3.0 - 2.0 * lam);
  float occ = 0.4 + 0.6 * smoothstep(0.56, 0.82, n);
  vec3 col = uSunC * (lam * occ + 0.05) * shd + uAmb * (0.4 + 0.6 * clamp(nn.y * 0.5 + 0.5, 0.0, 1.0)) * (0.5 + 0.5 * shd) * (0.55 + 0.45 * occ) + uGnd * max(0.16 - nn.y * 0.7, 0.0);
  vec3 lp = uLP - vV; float ld = dot(lp, lp); col += uLC * clamp(dot(nn, normalize(lp)) * 0.6 + 0.5, 0.0, 1.0) / (1.0 + ld * uLK);
  float heat = vB.w;
  if (vC.y > 0.5) { float k = heat * (0.46 + 0.86 * n) - (1.0 - den) * 0.14; col = mix(col, fire(k), smoothstep(0.02, 0.26, heat)); }
  else col = mix(col, vec3(1.9, 2.05, 2.3), heat);
  col = 1.0 - exp(-col * uExp); col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col * al, al);
}`;
const QV = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const QF = `uniform sampler2D uT; uniform vec2 uPx; varying vec2 vUv; void main(){ vec4 c = texture2D(uT, vUv) * 0.4; c += (texture2D(uT, vUv + vec2(uPx.x, 0.0)) + texture2D(uT, vUv - vec2(uPx.x, 0.0)) + texture2D(uT, vUv + vec2(0.0, uPx.y)) + texture2D(uT, vUv - vec2(0.0, uPx.y))) * 0.15; gl_FragColor = c; }`;
let volP = null;
const getVol = () => (volP = volP || fetch(volUrl).then(r => r.arrayBuffer()));
export const preloadVol = getVol;

export async function makeNoise3D() { const buf = await getVol(), n = new THREE.Data3DTexture(new Uint8Array(buf.slice(0)), 64, 64, 64); n.format = THREE.RGFormat; n.type = THREE.UnsignedByteType; n.minFilter = n.magFilter = THREE.LinearFilter; n.wrapS = n.wrapT = n.wrapR = THREE.RepeatWrapping; n.unpackAlignment = 1; n.needsUpdate = true; return n; }

export function buildPlume(X, noise, N = 2400) {
  const { renderer, PR, vw, vh } = X;
  // 입자 자료
  const F = 22, A = new Float32Array(N * F), alive = new Uint16Array(N), order = new Uint16Array(N), key = new Float32Array(N); let nA = 0;
  const free = []; for (let i = N - 1; i >= 0; i--) free.push(i);
  const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute("position", base.attributes.position); geo.instanceCount = 0;
  const inst = new Float32Array(N * 14), ib = new THREE.InstancedInterleavedBuffer(inst, 14); ib.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("iA", new THREE.InterleavedBufferAttribute(ib, 4, 0)); geo.setAttribute("iB", new THREE.InterleavedBufferAttribute(ib, 4, 4)); geo.setAttribute("iC", new THREE.InterleavedBufferAttribute(ib, 4, 8)); geo.setAttribute("iD", new THREE.InterleavedBufferAttribute(ib, 2, 12));
  const U = { uN: { value: noise }, uD: { value: null }, uInv: { value: new THREE.Vector2() }, uNear: { value: 1 }, uFar: { value: 100 }, uExp: { value: 1.1 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color(1.5, 1.3, 1.1) }, uAmb: { value: new THREE.Color(0.5, 0.55, 0.7) }, uGnd: { value: new THREE.Color(0.2, 0.16, 0.14) }, uLP: { value: new THREE.Vector3() }, uLC: { value: new THREE.Color(0, 0, 0) }, uLK: { value: 0.2 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; const pScene = new THREE.Scene(); pScene.add(mesh);
  const tri = new THREE.BufferGeometry(); tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const CU = { uT: { value: null }, uPx: { value: new THREE.Vector2() } }, cMat = new THREE.ShaderMaterial({ uniforms: CU, vertexShader: QV, fragmentShader: QF, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }), cMesh = new THREE.Mesh(tri, cMat); cMesh.frustumCulled = false; const cScene = new THREE.Scene(), ocam = new THREE.Camera(); cScene.add(cMesh);
  const depthM = new THREE.MeshBasicMaterial({ colorWrite: false });
  let scale = 0.6, rtS = null, rtD = null, avg = 0;
  function mkRT() { if (rtS) { rtS.dispose(); rtD.depthTexture.dispose(); rtD.dispose(); } const w = Math.max(96, Math.round(vw * PR * scale)), h = Math.max(96, Math.round(vh * PR * scale)); rtS = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType }); rtD = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); rtD.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType); U.uD.value = rtD.depthTexture; U.uInv.value.set(1 / w, 1 / h); CU.uT.value = rtS.texture; CU.uPx.value.set(0.6 / w, 0.6 / h); }
  mkRT();
  // 칸: 0-2 위치 · 3-5 속도 · 6 나이 · 7 수명 · 8 시작 크기 · 9 끝 크기 · 10 진하기 · 11 씨앗 · 12 저항 · 13 소용돌이 · 14 뜨는 힘 · 15 처음 열 · 16 깎임 · 17 불꽃 여부 · 18 열 식는 빠르기 · 19 사라지는 곡선
  function add(x, y, z, vx, vy, vz, o) { if (!free.length) { let w = 0, wa = -1; for (let i = 0; i < nA; i++) { const k = alive[i] * F, r = A[k + 6] / A[k + 7]; if (r > wa) { wa = r; w = i; } } free.push(alive[w]); alive[w] = alive[--nA]; }
    const i = free.pop(), k = i * F; A[k] = x; A[k + 1] = y; A[k + 2] = z; A[k + 3] = vx; A[k + 4] = vy; A[k + 5] = vz; A[k + 6] = 0; A[k + 7] = o.life; A[k + 8] = o.s0; A[k + 9] = o.s1; A[k + 10] = o.a; A[k + 11] = Math.random(); A[k + 12] = o.drag || 0; A[k + 13] = o.turb || 0; A[k + 14] = o.buoy || 0; A[k + 15] = o.heat || 0; A[k + 16] = o.ero == null ? 0.2 : o.ero; A[k + 17] = o.fire ? 1 : 0; A[k + 18] = o.cool || 5; A[k + 19] = o.fo || 1.4; alive[nA++] = i; }
  // wind: 모든 입자를 미는 바람 (차가 빠르게 날아갈 때 연기가 뒤로 밀림)
  let clock = 0; const wnd = new THREE.Vector3();
  function step(dt, wx = 0, wy = 0, wz = 0) { clock += dt; wnd.set(wx, wy, wz); for (let i = nA - 1; i >= 0; i--) { const k = alive[i] * F; A[k + 6] += dt; if (A[k + 6] >= A[k + 7]) { free.push(alive[i]); alive[i] = alive[--nA]; continue; }
      const dr = Math.exp(-A[k + 12] * dt), tb = A[k + 13] * dt, x = A[k], y = A[k + 1], z = A[k + 2], s = A[k + 11] * 6.28, f = 0.9 / Math.max(0.3, A[k + 9] * 0.6), c = clock * 1.4;
      // 부드러운 소용돌이 바람 (회전 성분만)
      A[k + 3] = A[k + 3] * dr + (Math.sin(y * f + s + c) - Math.cos(z * f * 1.3 - c)) * tb; A[k + 4] = A[k + 4] * dr + (Math.sin(z * f + s - c * 0.8) - Math.cos(x * f * 1.2 + c)) * tb + A[k + 14] * dt; A[k + 5] = A[k + 5] * dr + (Math.sin(x * f + s + c * 0.7) - Math.cos(y * f * 1.1 - c)) * tb;
      A[k] += (A[k + 3] + wx) * dt; A[k + 1] += (A[k + 4] + wy) * dt; A[k + 2] += (A[k + 5] + wz) * dt; } }
  // 입체 격자: 입자의 진하기를 칸에 쌓고, 입자마다 해 쪽으로 몇 칸 걸어가며 가로막는 연기를 더함 → 진짜 그림자
  const GS = 26, G2 = GS * GS, grid = new Float32Array(GS * G2), sunW = new THREE.Vector3(0, 1, 0), fc = new THREE.Vector3(); let half = 15, ca = new Float32Array(N), cs = new Float32Array(N);
  const gi = (x, y, z, o, c) => { const i = ((x - o.x) / c) | 0, j = ((y - o.y) / c) | 0, k = ((z - o.z) / c) | 0; return x < o.x || y < o.y || z < o.z || i >= GS || j >= GS || k >= GS ? -1 : i + j * GS + k * G2; }, org = new THREE.Vector3();
  function fill(cam) { const e = cam.matrixWorldInverse.elements; for (let i = 0; i < nA; i++) { const k = alive[i] * F; key[alive[i]] = e[2] * A[k] + e[6] * A[k + 1] + e[10] * A[k + 2] + e[14]; order[i] = alive[i]; } const sub = order.subarray(0, nA); sub.sort((p, q) => key[p] - key[q]);
    const cell = (half * 2) / GS, st = cell * 1.25, sx = sunW.x * st, sy = sunW.y * st, sz = sunW.z * st; org.set(fc.x - half, fc.y - half, fc.z - half); grid.fill(0);
    for (let i = 0; i < nA; i++) { const k = sub[i] * F, u = A[k + 6] / A[k + 7], w = 1 - (1 - u) * (1 - u), s = A[k + 8] + (A[k + 9] - A[k + 8]) * w, a = A[k + 10] * Math.min(1, u * 16) * Math.pow(1 - u, A[k + 19]); cs[i] = s; ca[i] = a; if (A[k + 17] > 0.5) continue; const g = gi(A[k], A[k + 1], A[k + 2], org, cell); if (g >= 0) grid[g] += a * Math.min(s / cell, 3.2); }
    for (let i = 0; i < nA; i++) { const k = sub[i] * F, o = i * 14, u = A[k + 6] / A[k + 7]; let sh = 0.92; if (A[k + 17] < 0.5) { let x = A[k], y = A[k + 1], z = A[k + 2], acc = 0; for (let m = 0; m < 7; m++) { x += sx; y += sy; z += sz; const g = gi(x, y, z, org, cell); if (g < 0) break; acc += grid[g]; } sh = Math.exp(-acc * 0.2); }
      inst[o] = A[k]; inst[o + 1] = A[k + 1]; inst[o + 2] = A[k + 2]; inst[o + 3] = cs[i]; inst[o + 4] = ca[i]; inst[o + 5] = A[k + 11]; inst[o + 6] = u * A[k + 7]; inst[o + 7] = A[k + 15] * Math.exp(-u * A[k + 18]); inst[o + 8] = Math.min(1, A[k + 16] + u * 0.8); inst[o + 9] = A[k + 17]; inst[o + 10] = sh; inst[o + 11] = 0; { const vx = A[k + 3] + wnd.x, vy = A[k + 4] + wnd.y, vz = A[k + 5] + wnd.z, px = e[0] * vx + e[4] * vy + e[8] * vz, py = e[1] * vx + e[5] * vy + e[9] * vz; inst[o + 12] = Math.atan2(py, px); inst[o + 13] = Math.min(3.4, (Math.hypot(px, py) * 0.05) / Math.max(cs[i], 0.05)); } }
    ib.needsUpdate = true; ib.addUpdateRange(0, nA * 14); geo.instanceCount = nA; }
  function render(scene, cam) { if (!nA) return; fill(cam); U.uNear.value = cam.near; U.uFar.value = cam.far; const cur = renderer.getRenderTarget(), ac = renderer.autoClear, ca = renderer.getClearAlpha(), lm = cam.layers.mask, ov = scene.overrideMaterial, bg = scene.background;
    renderer.setClearAlpha(0); renderer.autoClear = true; cam.layers.set(1); scene.overrideMaterial = depthM; scene.background = null; renderer.setRenderTarget(rtD); renderer.render(scene, cam); scene.overrideMaterial = ov; scene.background = bg; cam.layers.mask = lm;
    renderer.setRenderTarget(rtS); renderer.render(pScene, cam); renderer.setRenderTarget(cur); renderer.autoClear = false; renderer.render(cScene, ocam); renderer.autoClear = ac; renderer.setClearAlpha(ca); }
  // 해 방향은 월드 좌표로 받아 시점 좌표로 넘김
  function light(cam, sun, o = {}) { sunW.copy(sun); U.uSun.value.copy(sun).transformDirection(cam.matrixWorldInverse); if (o.sun) U.uSunC.value.setRGB(o.sun.x, o.sun.y, o.sun.z); if (o.amb) U.uAmb.value.setRGB(o.amb.x, o.amb.y, o.amb.z); if (o.gnd) U.uGnd.value.setRGB(o.gnd.x, o.gnd.y, o.gnd.z); if (o.exp) U.uExp.value = o.exp; }
  function point(cam, p, col, k = 0.2) { U.uLP.value.copy(p).applyMatrix4(cam.matrixWorldInverse); U.uLC.value.setRGB(col.x, col.y, col.z); U.uLK.value = k; }
  function warm(scene, cam) { add(0, 0, -5, 0, 0, 0, { life: 1, s0: 0.1, s1: 0.1, a: 0, fire: true }); render(scene, cam); step(2); }
  function adapt(dt) { avg = avg ? avg * 0.92 + dt * 0.08 : dt; if (avg > 0.04 && scale > 0.3) { scale = Math.max(0.3, scale * 0.82); avg = 0; mkRT(); } }
  function clear() { while (nA) { free.push(alive[--nA]); } }
  function dispose() { rtS.dispose(); rtD.depthTexture.dispose(); rtD.dispose(); mat.dispose(); cMat.dispose(); geo.dispose(); base.dispose(); tri.dispose(); depthM.dispose(); }
  // 그림자 격자가 따라다닐 자리
  function focus(p, h = 15) { fc.copy(p); half = h; }
  return { add, step, render, light, point, focus, warm, adapt, clear, dispose, count: () => nA };
}
