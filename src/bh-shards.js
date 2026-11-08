// 블랙홀 연출의 달력 조각: 칸·바탕을 두께 있는 종이 판으로 만들고, 천체가 지나가면 맞은 자리에서 보로노이로 퍽 쪼개짐 → 더 맞으면 더 잘게 → 가루.
// 조각 수천 개를 한 번에 그림: 모양은 한 버퍼에 쌓고(쪼개질 때마다 덧붙임), 위치·회전은 텍스처에 담아 정점 셰이더가 꺼내 씀.
// 좌표: 달력 평면(미터). 화면 그대로 겹치도록 z=0 평면, 가운데가 원점, 위가 +y.
import * as THREE from "three";

const MAXS = 4096, COLS = 64, MAXV = 230000;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const VS = `precision highp sampler2D; attribute vec4 aU; attribute float aId; uniform sampler2D uX; varying vec2 vUv; varying float vSide, vBg, vBurn, vA; varying vec3 vNw, vPw;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(){ int i = int(aId + 0.5); ivec2 b = ivec2((i % ${COLS}) * 3, i / ${COLS}); vec4 t0 = texelFetch(uX, b, 0), t1 = texelFetch(uX, b + ivec2(1, 0), 0), t2 = texelFetch(uX, b + ivec2(2, 0), 0);
  vec3 p = qrot(t1, position * t0.w) + t0.xyz; vNw = normalize(qrot(t1, normal)); vPw = p; vUv = aU.xy; vSide = aU.z; vBg = aU.w; vBurn = t2.x; vA = t2.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
const FS = `precision highp sampler3D; uniform sampler2D uPage; uniform sampler3D uN; uniform vec4 uRc[64]; uniform float uOp[64]; uniform int uNR; uniform vec2 uPS;
uniform vec3 uKey, uKeyC, uBack, uBackC, uAmb, uPaper, uEdge; uniform float uEmis, uT; varying vec2 vUv; varying float vSide, vBg, vBurn, vA; varying vec3 vNw, vPw;
void main(){ if (vA < 0.01) discard;
  if (vBg > 0.5) { vec2 pp = (vUv - 0.5) * uPS; float jg = (texture(uN, vec3(pp * 2.7, 0.31)).r - 0.7) * 0.03 + (texture(uN, vec3(pp * 9.0, 0.7)).r - 0.7) * 0.012;
    for (int k = 0; k < 64; k++) { if (k >= uNR) break; if (uOp[k] <= 0.0) continue; vec4 r = uRc[k]; vec2 q = abs(pp - r.xy); if (q.x < r.z * uOp[k] + jg && q.y < r.w * uOp[k] + jg) discard; } }
  vec3 n = normalize(vNw); if (!gl_FrontFacing) n = -n; vec3 alb = vSide < 0.5 ? texture2D(uPage, vUv).rgb : vSide < 1.5 ? uPaper : uEdge;
  float nl = max(dot(n, uKey), 0.0), bl = max(dot(n, uBack), 0.0), tl = max(dot(-n, uBack), 0.0);
  vec3 c = alb * (uKeyC * (nl * 0.85 + 0.15) + uAmb + uBackC * bl * 0.9) + alb * uBackC * tl * 0.22 * (vSide < 1.5 ? 1.0 : 0.0);
  // 맞은편 빛이 얇은 가장자리를 비춤
  vec3 v = normalize(cameraPosition - vPw); c += uBackC * pow(1.0 - abs(dot(n, v)), 3.0) * bl * 0.5 * alb;
  if (vSide < 0.5) c = mix(c, alb, uEmis);
  // 그을림 (별에 스치면)
  if (vBurn > 0.0) { float nb = texture(uN, vec3(vUv * 2.2, 0.4)).r * 0.7 + texture(uN, vec3(vUv * 7.0, 0.8)).r * 0.3; float b = smoothstep(nb - 0.25, nb + 0.02, vBurn * 1.05); c = mix(c, c * vec3(0.55, 0.42, 0.3), smoothstep(nb - 0.45, nb - 0.2, vBurn)); c = mix(c, vec3(0.015, 0.012, 0.01), b); c += vec3(2.0, 0.55, 0.1) * smoothstep(0.035, 0.0, abs(vBurn * 1.05 - nb + 0.01)) * vBurn * 1.1; }
  float dc = length(cameraPosition - vPw), fa = smoothstep(0.16, 0.6, dc); if (fa < 0.02) discard; gl_FragColor = vec4(c, vA * fa); }`;

// 볼록 다각형을 반평면으로 자름 (n·x <= d 쪽만 남김)
function clip(P, nx, ny, d) { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d; if (da <= 0) out.push(a); if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; }
const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const cent = P => { let x = 0, y = 0, A = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = a[0] * b[1] - b[0] * a[1]; A += c; x += (a[0] + b[0]) * c; y += (a[1] + b[1]) * c; } A *= 0.5; return Math.abs(A) < 1e-12 ? P[0].slice() : [x / (6 * A), y / (6 * A)]; };
function inPoly(P, x, y) { for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false; } return true; }
export function voronoi(P, seeds) { const cells = []; for (let i = 0; i < seeds.length; i++) { let C = P; const s = seeds[i]; for (let j = 0; j < seeds.length && C.length > 2; j++) { if (i === j) continue; const t = seeds[j], nx = t[0] - s[0], ny = t[1] - s[1]; C = clip(C, nx, ny, (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2); } if (C.length > 2 && area(C) > 1e-7) cells.push(C); } return cells; }

export function buildShards(noise, pageT, SW, SH) {
  const pos = new Float32Array(MAXV * 3), nor = new Float32Array(MAXV * 3), au = new Float32Array(MAXV * 4), aid = new Float32Array(MAXV);
  const geo = new THREE.BufferGeometry(); const att = (n, a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, b); return b; };
  const aP = att("position", pos, 3), aN = att("normal", nor, 3), aUa = att("aU", au, 4), aI = att("aId", aid, 1); geo.setDrawRange(0, 0);
  const xd = new Float32Array(COLS * 3 * (MAXS / COLS) * 4), xt = new THREE.DataTexture(xd, COLS * 3, MAXS / COLS, THREE.RGBAFormat, THREE.FloatType); xt.minFilter = xt.magFilter = THREE.NearestFilter; xt.needsUpdate = true;
  const rc = [], op = []; for (let i = 0; i < 64; i++) { rc.push(new THREE.Vector4()); op.push(0); }
  const U = { uX: { value: xt }, uPage: { value: pageT }, uN: { value: noise }, uRc: { value: rc }, uOp: { value: op }, uNR: { value: 0 }, uPS: { value: new THREE.Vector2(SW, SH) },
    uKey: { value: V(-0.3, 0.5, 0.8).normalize() }, uKeyC: { value: new THREE.Color(1, 1, 1) }, uBack: { value: V(0, 0, -1) }, uBackC: { value: new THREE.Color(0, 0, 0) }, uAmb: { value: new THREE.Color(0.1, 0.1, 0.12) },
    uPaper: { value: new THREE.Color(0.8, 0.79, 0.76) }, uEdge: { value: new THREE.Color(0.86, 0.84, 0.8) }, uEmis: { value: 1 }, uT: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.layers.enable(1);
  let nv = 0, ns = 0, dMin = MAXV, dMax = 0;
  // 조각 하나의 정보
  const S = []; // { id, P(달력 좌표 다각형), c(무게중심), th, bg, p(V3), q(Quat), v(V3), w(V3 각속도), s(크기), r(반지름), lvl, alive, burn, a, born }
  const put = (x, y, z, nx, ny, nz, u, v, side, bg, id) => { const k = nv++; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz; au[k * 4] = u; au[k * 4 + 1] = v; au[k * 4 + 2] = side; au[k * 4 + 3] = bg; aid[k] = id; };
  const uvx = x => x / SW + 0.5, uvy = y => y / SH + 0.5;
  function add(P, th, bg, p, q, lvl) {
    if (ns >= MAXS) return null; const n = P.length; if (nv + 12 * n > MAXV) return null;
    if (area(P) < 0) P = P.slice().reverse(); const c = cent(P), id = ns++, h = th / 2, start = nv;
    for (let i = 1; i < n - 1; i++) { for (const k of [0, i, i + 1]) put(P[k][0] - c[0], P[k][1] - c[1], h, 0, 0, 1, uvx(P[k][0]), uvy(P[k][1]), 0, bg, id); }
    for (let i = 1; i < n - 1; i++) { for (const k of [0, i + 1, i]) put(P[k][0] - c[0], P[k][1] - c[1], -h, 0, 0, -1, uvx(P[k][0]), uvy(P[k][1]), 1, bg, id); }
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ox = dy / l, oy = -dx / l, ax = a[0] - c[0], ay = a[1] - c[1], bx = b[0] - c[0], by = b[1] - c[1];
      for (const [x, y, z] of [[ax, ay, h], [ax, ay, -h], [bx, by, -h], [ax, ay, h], [bx, by, -h], [bx, by, h]]) put(x, y, z, ox, oy, 0, uvx(x + c[0]), uvy(y + c[1]), 2, bg, id); }
    dMin = Math.min(dMin, start); dMax = Math.max(dMax, nv);
    let r = 0; for (const v of P) r = Math.max(r, Math.hypot(v[0] - c[0], v[1] - c[1]));
    const s = { id, P, c, th, bg, p: p ? p.clone() : V(c[0], c[1], 0), q: q ? q.clone() : new THREE.Quaternion(), v: V(), w: V(), s: 1, r, lvl, alive: true, burn: 0, a: 1, area: Math.abs(area(P)), held: true };
    S.push(s); return s;
  }
  // 조각을 쪼갬: hit = 월드 좌표의 맞은 점, imp = 충격 속도(월드), n = 조각 수
  const tq = new THREE.Quaternion(), tv = V(), tv2 = V();
  function split(s, hit, imp, n, kick = 1, radial = false) {
    if (!s.alive) return []; const qi = s.q.clone().invert(), lh = tv.copy(hit).sub(s.p).applyQuaternion(qi); const hx = lh.x + s.c[0], hy = lh.y + s.c[1];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const v of s.P) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    const seeds = [], sz = Math.max(x1 - x0, y1 - y0); let guard = 0;
    // 방사형 금: 맞은 점 가까이 몇 개 + 둘레에 고르게 → 맞은 자리에서 쐐기 모양으로 갈라짐
    if (radial) { for (let k = 0; k < 3; k++) { const x = hx + gauss() * sz * 0.04, y = hy + gauss() * sz * 0.04; if (inPoly(s.P, x, y)) seeds.push([x, y]); } const m = Math.max(4, n - 5), a0 = Math.random() * 6.283; for (let j = 0; j < m; j++) { const an = a0 + (j / m) * 6.283 + (Math.random() - 0.5) * 0.5, rr = sz * (0.16 + 0.14 * Math.random()), x = hx + Math.cos(an) * rr, y = hy + Math.sin(an) * rr; if (inPoly(s.P, x, y)) seeds.push([x, y]); } }
    while (seeds.length < n && guard++ < 400) { const near = seeds.length < n * 0.55, a = Math.random() * Math.PI * 2, rr = Math.abs(gauss()) * sz * 0.22; const x = near ? hx + Math.cos(a) * rr : x0 + Math.random() * (x1 - x0), y = near ? hy + Math.sin(a) * rr : y0 + Math.random() * (y1 - y0); if (inPoly(s.P, x, y)) seeds.push([x, y]); }
    if (seeds.length < 2) { kill(s); return []; }
    const cells = voronoi(s.P, seeds), kids = []; kill(s);
    for (const C of cells) { const c = cent(C), wp = V(c[0] - s.c[0], c[1] - s.c[1], 0).applyQuaternion(s.q).add(s.p), k = add(C, s.th, s.bg, wp, s.q, s.lvl + 1); if (!k) continue;
      const away = tv2.copy(wp).sub(hit); const d = away.length() + 0.02; away.normalize();
      k.v.copy(s.v).addScaledVector(away, (0.6 + Math.random() * 1.4) * kick / (1 + d * 3)).addScaledVector(imp, (0.18 + Math.random() * 0.3) / (1 + d * 4)); k.v.x += gauss() * 0.25 * kick; k.v.y += gauss() * 0.25 * kick; k.v.z += gauss() * 0.25 * kick;
      k.w.set(gauss(), gauss(), gauss()).multiplyScalar(4 + 10 * kick / (1 + d * 2)).add(s.w); k.burn = s.burn; k.held = false; kids.push(k); }
    return kids;
  }
  function kill(s) { s.alive = false; s.a = 0; }
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
  const wq = new THREE.Quaternion();
  function step(dt, force) {
    for (const s of S) { if (!s.alive) continue; if (!s.held) { if (force) force(s, dt); s.p.addScaledVector(s.v, dt); const w = s.w.length(); if (w > 1e-5) { wq.setFromAxisAngle(tv.copy(s.w).divideScalar(w), w * dt); s.q.premultiply(wq).normalize(); } } }
  }
  function upload() {
    for (const s of S) { const o = ((s.id / COLS) | 0) * COLS * 3 * 4 + (s.id % COLS) * 12; xd[o] = s.p.x; xd[o + 1] = s.p.y; xd[o + 2] = s.p.z; xd[o + 3] = s.alive ? s.s : 0; xd[o + 4] = s.q.x; xd[o + 5] = s.q.y; xd[o + 6] = s.q.z; xd[o + 7] = s.q.w; xd[o + 8] = s.burn; xd[o + 9] = s.alive ? s.a : 0; }
    xt.needsUpdate = true;
    if (dMax > dMin) { for (const b of [aP, aN]) { b.clearUpdateRanges(); b.addUpdateRange(dMin * 3, (dMax - dMin) * 3); b.needsUpdate = true; } aUa.clearUpdateRanges(); aUa.addUpdateRange(dMin * 4, (dMax - dMin) * 4); aUa.needsUpdate = true; aI.clearUpdateRanges(); aI.addUpdateRange(dMin, dMax - dMin); aI.needsUpdate = true; dMin = MAXV; dMax = 0; }
    geo.setDrawRange(0, nv);
  }
  // 칸 자리 구멍 (바탕에 뚫림)
  function holes(list) { U.uNR.value = Math.min(64, list.length); list.slice(0, 64).forEach((h, i) => { rc[i].set(h.x, h.y, h.hw, h.hh); op[i] = h.open || 0; }); }
  return { mesh, U, S, add, split, kill, step, upload, holes, get count() { return ns; }, get verts() { return nv; }, dispose() { geo.dispose(); mat.dispose(); xt.dispose(); } };
}

// ── 가루: 종이 부스러기 점들 (빛을 받음 · 뜨거워지면 빛남) ──
const PVS = `attribute vec4 aC; attribute vec2 aS; uniform float uScale; varying vec4 vC; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aS.x * uScale / -mv.z, 1.0, 48.0); vC = aC; vH = aS.y; }`;
const PFS = `uniform vec3 uLit; varying vec4 vC; varying float vH; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard; float a = smoothstep(1.0, 0.45, r) * vC.a; vec3 c = vC.rgb * uLit * (1.0 - vH * 0.6) + vec3(2.2, 0.75, 0.22) * vH * vH * 1.1 + vec3(1.0, 0.92, 0.82) * smoothstep(0.8, 1.0, vH) * 1.4; gl_FragColor = vec4(c, a); }`;
export function buildPowder(N, scale) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), c = new Float32Array(N * 4), s = new Float32Array(N * 2), v = new Float32Array(N * 3), life = new Float32Array(N);
  const ap = new THREE.BufferAttribute(p, 3), ac = new THREE.BufferAttribute(c, 4), as = new THREE.BufferAttribute(s, 2); ap.setUsage(THREE.DynamicDrawUsage); ac.setUsage(THREE.DynamicDrawUsage); as.setUsage(THREE.DynamicDrawUsage); g.setAttribute("position", ap); g.setAttribute("aC", ac); g.setAttribute("aS", as); g.setDrawRange(0, 0);
  const U = { uScale: { value: scale }, uLit: { value: new THREE.Color(0.6, 0.6, 0.62) } }, m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4;
  let n = 0;
  function spawn(x, y, z, vx, vy, vz, r, gg, b, size) { if (n >= N) return -1; const i = n++; p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz; c[i * 4] = r; c[i * 4 + 1] = gg; c[i * 4 + 2] = b; c[i * 4 + 3] = 1; s[i * 2] = size; s[i * 2 + 1] = 0; life[i] = 0; return i; }
  function step(dt, force) { for (let i = 0; i < n; i++) { if (c[i * 4 + 3] <= 0) continue; life[i] += dt; if (force) force(i, dt); p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt; } ap.needsUpdate = ac.needsUpdate = as.needsUpdate = true; g.setDrawRange(0, n); }
  return { pts, U, p, v, c, s, life, spawn, step, get n() { return n; }, set n(k) { n = k; }, N, dispose() { g.dispose(); m.dispose(); } };
}
