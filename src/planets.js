// 화성 연출의 세상: 노을 하늘 · 별 · 지구(대륙을 직접 그려 잡음으로 다듬음) · 달 · 화성(협곡·극관·운석구덩이)
// 표면은 시작할 때 화면 뒤에서 한 번 그림(셰이더로 펼친 지도). 화성은 처음부터 조각으로 나뉜 공이라 그대로 터질 수 있음.
import * as THREE from "three";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NOISE = `precision highp sampler3D; uniform sampler3D uN;
float fbm(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++){ a += w * texture(uN, p).r; p = p * 2.03 + 0.17; w *= 0.5; } return a; }`;
const QV = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const DIR = "vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * 6.2831853, lat = (uv.y - 0.5) * 3.1415926; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }";
const UVOF = "vec2 uvOf(vec3 d){ return vec2(atan(d.x, d.z) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5); }";

// 화면 전체를 한 번 그려 지도 한 장을 만듦
function bake(renderer, w, h, fs, uniforms) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false, wrapS: THREE.RepeatWrapping }); rt.texture.anisotropy = 4;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: QV, fragmentShader: fs, depthTest: false, depthWrite: false }), q = new THREE.Mesh(g, m); q.frustumCulled = false; const s = new THREE.Scene(); s.add(q);
  const cur = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(s, new THREE.Camera()); renderer.setRenderTarget(cur); g.dispose(); m.dispose(); return rt;
}

// ── 하늘: 고도 uAlt 0(구름 위 노을) → 1(우주) ──
export function buildSky(noise) {
  const U = { uN: { value: noise }, uSun: { value: V(0.72, 0.13, -0.68).normalize() }, uAlt: { value: 0 }, uT: { value: 0 }, uFly: { value: V() } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: "varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }",
    fragmentShader: `${NOISE} uniform vec3 uSun, uFly; uniform float uAlt, uT; varying vec3 vD;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float clouds(vec2 q){ float a = texture(uN, vec3(q, 0.31)).r, b = texture(uN, vec3(q * 2.3 + 0.1, 0.57)).r, c = texture(uN, vec3(q * 5.1, 0.13)).g; return a * 0.6 + b * 0.28 + c * 0.12; }
void main(){ vec3 d = normalize(vD); float dip = uAlt * 0.2, e = d.y + dip, s = max(dot(d, uSun), 0.0), al = uAlt;
  float g = clamp(e, 0.0, 1.0);
  vec3 c = mix(vec3(1.05, 0.56, 0.24), vec3(0.96, 0.34, 0.36), smoothstep(0.0, 0.1, g)); c = mix(c, vec3(0.3, 0.17, 0.5), smoothstep(0.05, 0.17, g)); c = mix(c, vec3(0.05, 0.08, 0.28), smoothstep(0.14, 0.42, g));
  c += vec3(1.0, 0.5, 0.2) * pow(s, 7.0) * 0.32 + vec3(1.0, 0.72, 0.42) * pow(s, 90.0) * 0.8;
  // 높이 올라갈수록 어두워지고 얇은 푸른 띠만 남음
  vec3 sp = vec3(0.004, 0.006, 0.016) + vec3(0.08, 0.26, 0.7) * exp(-g * 26.0) * 0.9 + vec3(1.0, 0.5, 0.26) * exp(-g * 42.0) * pow(s, 3.0) * 1.2; c = mix(c, sp, smoothstep(0.1, 0.92, al));
  // 구름 바다
  float below = -e;
  if (below > 0.0005) { float h = mix(1.0, 6.0, al), t = h / max(below, 0.012); vec2 q = d.xz * t * 0.034 + uFly.xz; float n = clouds(q), n2 = clouds(q + uSun.xz * 0.018 / h), den = smoothstep(0.54, 0.72, n);
    float lit = clamp((n - n2) * 9.0 + 0.5, 0.0, 1.0), far = clamp(t * 0.05, 0.0, 1.0);
    vec3 lc = mix(vec3(0.3, 0.2, 0.42), vec3(1.2, 0.72, 0.5), lit); lc = mix(lc, vec3(1.3, 1.08, 0.92), smoothstep(0.62, 0.92, n) * lit); lc += vec3(1.0, 0.45, 0.2) * pow(s, 5.0) * 0.5;
    vec3 under = mix(vec3(0.05, 0.08, 0.2), vec3(0.3, 0.17, 0.26), far); vec3 gc = mix(under, lc, den); float haze = smoothstep(0.05, 0.0, below); gc = mix(gc, c, haze * 0.86 + 0.14 * far);
    gc = mix(gc, vec3(0.02, 0.05, 0.14) + gc * 0.5, smoothstep(0.1, 0.9, al)); c = mix(c, gc, smoothstep(0.0, 0.004, below)); }
  c += vec3(1.5, 1.35, 1.05) * smoothstep(0.99925, 0.99975, s) * 5.0;
  c = 1.0 - exp(-c * 1.15); gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat); mesh.frustumCulled = false; mesh.renderOrder = -20; return { mesh, U, mat };
}

// ── 별: 멀리 박힌 점 + 빨리 날 때 스쳐 가는 줄 ──
export function buildStars() {
  const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 4), c = new THREE.Color();
  for (let i = 0; i < N; i++) { const v = V(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(); pos.set([v.x, v.y, v.z], i * 3); const k = Math.pow(Math.random(), 3.2); c.setHSL(0.58 + (Math.random() - 0.5) * 0.5, 0.45, 0.82); col.set([c.r, c.g, c.b, 0.34 + k * 0.66], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aC", new THREE.BufferAttribute(col, 4));
  const U = { uS: { value: 2 }, uA: { value: 0 } }, m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: "attribute vec4 aC; uniform float uS; varying vec4 vC; void main(){ vC = aC; vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; gl_PointSize = uS * (0.65 + aC.a * 1.9); }",
    fragmentShader: "uniform float uA; varying vec4 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = smoothstep(1.0, 0.1, r) * vC.a * uA; gl_FragColor = vec4(vC.rgb * a, a); }" });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -19;
  // 스쳐 가는 별: 카메라 주변 상자 안에서 뒤로 흘러감
  const NS = 240, lp = new Float32Array(NS * 6), lc = new Float32Array(NS * 2), st = []; for (let i = 0; i < NS; i++) { st.push(V(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)); lc[i * 2] = 1; lc[i * 2 + 1] = 0; }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lp, 3)); lg.setAttribute("aA", new THREE.BufferAttribute(lc, 1)); const lm = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, vertexShader: "attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "uniform float uA; varying float vA; void main(){ float a = vA * uA; gl_FragColor = vec4(vec3(0.72, 0.84, 1.0) * a, a); }" });
  const lines = new THREE.LineSegments(lg, lm); lines.frustumCulled = false; lines.renderOrder = 4;
  function streak(dt, c0, fwd, speed, box, len) { const q = fwd; for (let i = 0; i < NS; i++) { const s = st[i]; s.addScaledVector(q, -(speed / box) * dt); if (s.lengthSq() > 3 || s.dot(q) < -1.1) { s.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).addScaledVector(q, 1.2); } const x = c0.x + s.x * box, y = c0.y + s.y * box, z = c0.z + s.z * box; lp[i * 6] = x; lp[i * 6 + 1] = y; lp[i * 6 + 2] = z; lp[i * 6 + 3] = x + q.x * len; lp[i * 6 + 4] = y + q.y * len; lp[i * 6 + 5] = z + q.z * len; } lg.attributes.position.needsUpdate = true; }
  return { pts, U, lines, streak, dispose() { g.dispose(); m.dispose(); lg.dispose(); lm.dispose(); } };
}

// ── 지구 ──
const LAND = [
  [[-168,66],[-156,71],[-125,70],[-95,72],[-82,68],[-78,62],[-64,60],[-56,52],[-66,45],[-75,38],[-81,31],[-81,25],[-90,29],[-97,26],[-97,19],[-88,16],[-83,10],[-79,8],[-90,14],[-105,20],[-112,27],[-118,33],[-124,41],[-125,49],[-135,58],[-150,60],[-163,55],[-166,61]],
  [[-52,82],[-20,82],[-20,72],[-40,62],[-50,62],[-56,72]],
  [[-78,8],[-60,10],[-50,0],[-35,-6],[-39,-16],[-48,-26],[-58,-36],[-66,-46],[-68,-55],[-74,-50],[-72,-30],[-70,-17],[-80,-5]],
  [[-16,15],[-17,22],[-8,34],[10,37],[25,32],[34,30],[38,18],[44,11],[51,11],[40,-4],[40,-15],[33,-26],[20,-35],[14,-22],[12,-6],[8,4],[-6,5],[-13,9]],
  [[-9,37],[-9,43],[0,44],[-4,48],[5,53],[8,57],[5,62],[16,69],[28,71],[42,67],[60,69],[75,73],[100,77],[130,72],[160,70],[180,68],[178,62],[160,60],[156,52],[142,54],[138,46],[130,42],[127,39],[129,35],[126,34],[125,39],[121,40],[118,38],[122,31],[120,25],[113,22],[108,19],[109,12],[105,9],[100,13],[103,2],[98,8],[97,16],[90,22],[80,15],[78,8],[73,18],[67,25],[57,25],[50,30],[56,25],[59,22],[52,16],[44,13],[39,21],[35,28],[35,36],[27,37],[23,38],[20,40],[14,45],[16,40],[9,44],[3,43],[-1,38],[-5,36]],
  [[130,31],[135,34],[140,36],[142,40],[141,45],[145,43],[141,36],[136,33],[131,31]],
  [[114,-22],[122,-18],[131,-12],[136,-12],[142,-11],[146,-19],[153,-26],[150,-37],[143,-39],[134,-33],[125,-33],[115,-34]],
  [[-180,-70],[-120,-72],[-60,-66],[0,-69],[60,-67],[120,-66],[180,-70],[180,-90],[-180,-90]],
  [[-5,50],[1,51],[-2,58],[-6,57]], [[44,-16],[50,-15],[47,-25],[44,-24]], [[95,5],[105,-5],[115,-8],[120,-5],[118,4],[108,6]], [[120,18],[125,10],[122,6],[118,12]], [[172,-41],[178,-38],[170,-46],[167,-45]], [[140,-3],[150,-6],[146,-10],[136,-7]],
];
function landTex() { const c = document.createElement("canvas"); c.width = 2048; c.height = 1024; const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 2048, 1024); x.filter = "blur(3px)"; x.fillStyle = "#fff"; for (const P of LAND) { x.beginPath(); P.forEach(([a, b], i) => { const u = (a + 180) / 360 * 2048, v = (90 - b) / 180 * 1024; i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; }

export function buildEarth(renderer, noise) {
  const land = landTex();
  const rt = bake(renderer, 2048, 1024, `${NOISE} ${DIR} uniform sampler2D uL; varying vec2 vUv;
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 0.7 + 0.3), n2 = fbm(d * 1.9 + 2.1); vec2 w = vUv + (vec2(fbm(d * 0.9 + 1.0), fbm(d * 0.9 + 4.0)) - 0.5) * vec2(0.03, 0.05);
  float m = texture2D(uL, w).r + (n2 - 0.68) * 0.7, land = smoothstep(0.46, 0.53, m), la = abs(d.y);
  float arid = smoothstep(0.16, 0.34, la) * smoothstep(0.62, 0.42, la); vec3 forest = mix(vec3(0.06, 0.15, 0.05), vec3(0.15, 0.25, 0.08), smoothstep(0.56, 0.8, n2)), desert = mix(vec3(0.56, 0.42, 0.24), vec3(0.74, 0.6, 0.4), smoothstep(0.56, 0.8, n));
  vec3 lc = mix(forest, desert, clamp(arid * 1.5 * smoothstep(0.56, 0.76, n) + (n2 - 0.72) * 0.8, 0.0, 1.0)); lc = mix(lc, vec3(0.34, 0.33, 0.28), smoothstep(0.7, 0.82, la)); lc = mix(lc, vec3(0.92, 0.95, 1.0), smoothstep(0.83, 0.9, la + (n - 0.68) * 0.2));
  float sh = smoothstep(0.2, 0.5, m); vec3 oc = mix(vec3(0.006, 0.03, 0.1), vec3(0.016, 0.1, 0.21), sh); gl_FragColor = vec4(mix(oc, lc, land), land); }`, { uN: { value: noise }, uL: { value: land } });
  land.dispose(); rt.texture.colorSpace = THREE.NoColorSpace;
  const U = { uN: { value: noise }, uM: { value: rt.texture }, uSun: { value: V(0.8, 0.3, -0.5).normalize() }, uT: { value: 0 }, uR: { value: new THREE.Matrix3() } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, toneMapped: false, vertexShader: "varying vec3 vL, vW, vP; void main(){ vL = position; vW = (modelMatrix * vec4(position, 0.0)).xyz; vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `${NOISE} ${UVOF} uniform sampler2D uM; uniform vec3 uSun; uniform float uT; varying vec3 vL, vW, vP;
void main(){ vec3 d = normalize(vL), n = normalize(vW), v = normalize(cameraPosition - vW * 0.0); vec2 uv = uvOf(d); vec4 m = texture2D(uM, uv); float day = clamp(dot(n, uSun) * 2.6 + 0.3, 0.0, 1.0), land = m.a;
  vec3 q = d * 0.42 + vec3(uT * 0.002, 0.0, 0.0); float cn = fbm(q) * 0.72 + texture(uN, q * 3.3 + 0.2).r * 0.28, cl = smoothstep(0.72, 0.84, cn), cs = smoothstep(0.7, 0.82, fbm(q + uSun * 0.012));
  vec3 c = m.rgb * (1.0 - 0.55 * cs); c = mix(c, vec3(0.96, 0.97, 1.0), cl * 0.92); c *= day; vec3 hv = normalize(uSun + normalize(cameraPosition - vP)); c += (1.0 - land) * (1.0 - cl) * vec3(1.0, 0.86, 0.66) * pow(max(dot(n, hv), 0.0), 90.0) * 1.3 * day;
  float night = 1.0 - smoothstep(0.0, 0.5, day); float city = smoothstep(0.76, 0.9, texture(uN, d * 1.3).r) * smoothstep(0.6, 0.86, texture(uN, d * 4.0).g) * land; c += vec3(1.0, 0.72, 0.36) * city * night * 1.3 * (1.0 - cl);
  float fr = pow(1.0 - max(dot(n, normalize(cameraPosition - vP)), 0.0), 3.0); c += vec3(0.18, 0.42, 1.0) * fr * (0.08 + day * 0.9);
  c = 1.0 - exp(-c * 1.5); gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat); mesh.frustumCulled = false;
  const AU = { uSun: U.uSun, uA: { value: 1 }, uC: { value: new THREE.Color(0.26, 0.56, 1.2) } }, air = new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 64), new THREE.ShaderMaterial({ uniforms: AU, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: "varying vec3 vN, vP; void main(){ vN = normalize((modelMatrix * vec4(position, 0.0)).xyz); vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uSun, uC; uniform float uA; varying vec3 vN, vP; void main(){ vec3 v = normalize(vP - cameraPosition); float f = clamp(dot(vN, -v) * -1.0, 0.0, 1.0), rim = pow(1.0 - f, 5.0) * 0.0 + pow(f, 2.6), lit = clamp(dot(vN, uSun) * 1.6 + 0.5, 0.0, 1.0); float a = rim * lit * uA; vec3 c = mix(uC, vec3(1.3, 0.6, 0.3), pow(1.0 - lit, 2.0) * 0.8); gl_FragColor = vec4(c * a, a); }" }));
  air.frustumCulled = false; const group = new THREE.Group(); group.add(mesh, air);
  return { group, mesh, air, U, AU, dispose() { rt.dispose(); mesh.geometry.dispose(); air.geometry.dispose(); mat.dispose(); air.material.dispose(); } };
}

// ── 달 ──
export function buildMoon(noise) {
  const U = { uN: { value: noise }, uSun: { value: V(0.8, 0.3, -0.5).normalize() } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, toneMapped: false, vertexShader: "varying vec3 vL, vW; void main(){ vL = position; vW = (modelMatrix * vec4(position, 0.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `${NOISE} uniform vec3 uSun; varying vec3 vL, vW;
float hgt(vec3 d){ return texture(uN, d * 0.21).r * 0.58 + texture(uN, d * 0.52 + 0.3).r * 0.28 + texture(uN, d * 1.3 + 0.7).r * 0.14; }
void main(){ vec3 d = normalize(vL), n = normalize(vW); float h = hgt(d), e = 0.02; vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.1))), t2 = cross(n, t1); vec3 dl = vec3(hgt(normalize(d + t1 * e)) - h, hgt(normalize(d + t2 * e)) - h, 0.0); vec3 nn = normalize(n - (t1 * dl.x + t2 * dl.y) * 3.4); float l = clamp(dot(nn, uSun), 0.0, 1.0); vec3 c = mix(vec3(0.2), vec3(0.7, 0.68, 0.64), smoothstep(0.6, 0.8, h)) * (l * 1.5 + 0.03); c = 1.0 - exp(-c * 1.4); gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat); mesh.frustumCulled = false; return { mesh, U, dispose() { mesh.geometry.dispose(); mat.dispose(); } };
}

// ── 화성: 조각으로 나뉜 공 (한 번만 계산) ──
const NC = 120; let shardG = null, seeds = null;
function makeSeeds() { if (seeds) return seeds; seeds = []; for (let i = 0; i < NC; i++) { const y = 1 - (2 * (i + 0.5)) / NC, r = Math.sqrt(1 - y * y), a = i * 2.399963 + (Math.random() - 0.5) * 0.5; const v = V(Math.cos(a) * r + (Math.random() - 0.5) * 0.34, y + (Math.random() - 0.5) * 0.3, Math.sin(a) * r + (Math.random() - 0.5) * 0.34).normalize(); seeds.push(v); } return seeds; }
export function marsShards() { if (shardG) return shardG; const S = makeSeeds(), src = new THREE.IcosahedronGeometry(1, 31), P = src.attributes.position, nT = P.count / 3, cell = new Uint8Array(nT), pos = [], aC = [], aR = [], aI = [], edge = new Map(), key = (i) => `${Math.round(P.getX(i) * 4096)},${Math.round(P.getY(i) * 4096)},${Math.round(P.getZ(i) * 4096)}`;
  const rnd = S.map(() => { const a = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); return [a.x, a.y, a.z, (Math.random() - 0.5) * 1.5]; }), sp = S.map(() => 0.65 + Math.random() * 0.9);
  for (let t = 0; t < nT; t++) { const i = t * 3, cx = P.getX(i) + P.getX(i + 1) + P.getX(i + 2), cy = P.getY(i) + P.getY(i + 1) + P.getY(i + 2), cz = P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2); let b = 0, bd = -9; for (let k = 0; k < NC; k++) { const s = S[k], d = (s.x * cx + s.y * cy + s.z * cz) * (1 + 0.012 * Math.sin(cx * 9 + k) + 0.012 * Math.cos(cy * 11 + k * 2)); if (d > bd) { bd = d; b = k; } } cell[t] = b; }
  const put = (x, y, z, c, inner) => { const s = S[c], r = rnd[c]; pos.push(x, y, z); aC.push(s.x, s.y, s.z, sp[c]); aR.push(r[0], r[1], r[2], r[3]); aI.push(inner); };
  for (let t = 0; t < nT; t++) { const i = t * 3, c = cell[t]; for (let k = 0; k < 3; k++) put(P.getX(i + k), P.getY(i + k), P.getZ(i + k), c, 0); for (let k = 0; k < 3; k++) { const a = i + k, b = i + ((k + 1) % 3), ka = key(a), kb = key(b), ek = ka < kb ? ka + "|" + kb : kb + "|" + ka, o = edge.get(ek); if (o === undefined) edge.set(ek, [a, b, c]); else { edge.delete(ek); if (o[2] !== c) { // 조각의 경계: 안쪽 벽을 양쪽에 세움
          for (const [p, q, cc] of [[a, b, c], [o[0], o[1], o[2]]]) { const s = S[cc]; put(P.getX(q), P.getY(q), P.getZ(q), cc, 1); put(P.getX(p), P.getY(p), P.getZ(p), cc, 1); put(s.x * 0.3, s.y * 0.3, s.z * 0.3, cc, 1); } } } } }
  src.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aC", new THREE.Float32BufferAttribute(aC, 4)); g.setAttribute("aR", new THREE.Float32BufferAttribute(aR, 4)); g.setAttribute("aI", new THREE.Float32BufferAttribute(aI, 1)); g.computeVertexNormals(); { const N = g.attributes.normal; for (let i = 0; i < aI.length; i++) if (!aI[i]) N.setXYZ(i, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); } return (shardG = g); }

export function buildMars(renderer, noise) {
  const S = makeSeeds(), uS = S.map(v => v.clone());
  const rt = bake(renderer, 2048, 1024, `${NOISE} ${DIR} varying vec2 vUv;
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 h33(vec3 p){ return vec3(h31(p), h31(p + 17.3), h31(p + 41.9)); }
// 운석구덩이: 격자 칸마다 하나씩
float craters(vec3 d, float sc){ vec3 p = d * sc, b = floor(p); float h = 0.0; for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) { vec3 c = b + vec3(float(i), float(j), float(k)), o = h33(c), q = c + o; float r = 0.1 + 0.34 * pow(h31(c + 3.1), 2.2), l = length(p - q) / r; if (h31(c + 9.7) < 0.55 && l < 1.5) h += (l < 1.0 ? (l * l - 1.0) * 0.8 + 0.25 * smoothstep(0.7, 1.0, l) : 0.25 * (1.0 - smoothstep(1.0, 1.5, l))) * r; } return h; }
void main(){ vec3 d = dirOf(vUv); float lon = (vUv.x - 0.5) * 6.2831853, lat = (vUv.y - 0.5) * 3.1415926;
  float n = fbm(d * 0.8 + 0.4), n2 = fbm(d * 2.4 + 1.1), n3 = fbm(d * 7.0 + 3.0), cr = craters(d, 9.0) + craters(d, 21.0) * 0.5;
  float hgt = n * 0.5 + n2 * 0.28 + n3 * 0.12 + cr * 0.34;
  // 큰 협곡 (적도 아래로 길게) · 어두운 지대 · 극관
  float v = abs(lat + 0.17 + 0.045 * sin(lon * 5.0) + (n2 - 0.68) * 0.14), can = smoothstep(0.052, 0.012, v) * smoothstep(-2.5, -2.0, lon) * smoothstep(-0.2, -0.7, lon);
  hgt -= can * 0.34; float dk = smoothstep(0.66, 0.78, fbm(d * 1.2 + 7.0) * 0.86 + n2 * 0.14);
  vec3 c = mix(vec3(0.62, 0.29, 0.13), vec3(0.82, 0.47, 0.23), smoothstep(0.58, 0.78, n)); c = mix(c, vec3(0.94, 0.68, 0.43), smoothstep(0.7, 0.82, n2) * 0.5); c = mix(c, vec3(0.3, 0.16, 0.12), dk * 0.74); c *= 0.82 + cr * 0.9; c = mix(c, vec3(0.2, 0.09, 0.07), can * 0.86);
  float cap = smoothstep(1.2, 1.3, abs(lat) + (n2 - 0.68) * 0.4); c = mix(c, vec3(0.96, 0.93, 0.9), cap); gl_FragColor = vec4(c, clamp(hgt * 0.8, 0.0, 1.0)); }`, { uN: { value: noise } });
  // 금 지도: 가장 가까운 조각과 그 다음 조각의 차이 = 경계까지의 거리
  const rc = bake(renderer, 1024, 512, `${NOISE} ${DIR} uniform vec3 uS[${NC}]; varying vec2 vUv; void main(){ vec3 d0 = dirOf(vUv), d = normalize(d0 + (vec3(fbm(d0 * 1.7 + 1.0), fbm(d0 * 1.7 + 5.0), fbm(d0 * 1.7 + 9.0)) - 0.5) * 0.14); float a = -9.0, b = -9.0; for (int i = 0; i < ${NC}; i++){ float s = dot(d, uS[i]); if (s > a){ b = a; a = s; } else if (s > b) b = s; } float r = abs(fbm(d0 * 3.1 + 2.0) - 0.5) * 2.0 + abs(fbm(d0 * 7.3 + 4.0) - 0.5) * 0.7; gl_FragColor = vec4(sqrt(clamp((a - b) * 6.0, 0.0, 1.0)), sqrt(clamp(r * 2.2, 0.0, 1.0)), 0.0, 1.0); }`, { uN: { value: noise }, uS: { value: uS } });
  const U = { uM: { value: rt.texture }, uK: { value: rc.texture }, uSun: { value: V(0.8, 0.3, -0.5).normalize() }, uX: { value: 0 }, uT: { value: 0 }, uImp: { value: V(0, 0, 1) }, uFront: { value: 0 }, uHeat: { value: 0 }, uShk: { value: 0 }, uBul: { value: 0 }, uPx: { value: new THREE.Vector2(1 / 2048, 1 / 1024) }, uFade: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, toneMapped: false, transparent: false,
    vertexShader: `attribute vec4 aC, aR; attribute float aI; uniform float uX, uT, uShk, uBul; varying vec3 vD, vW, vWN; varying float vI, vX;
vec3 rot(vec3 v, vec3 a, float g){ float c = cos(g), s = sin(g); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
void main(){ vec3 p = position, ct = aC.xyz * 0.86, nr = normal; vD = p; vI = aI; float x = uX, sp = aC.w, g = aR.w * x * 0.8;
  // 떨림: 조각마다 다르게 부풀었다 가라앉음
  float w = sin(uT * (30.0 + sp * 24.0) + aR.x * 9.0) * uShk; p += aC.xyz * (w * 0.02 + uBul * (0.015 + 0.03 * sp));
  if (x > 0.0) { p = ct + rot(p - ct, aR.xyz, g); nr = rot(nr, aR.xyz, g); float dist = (1.0 - exp(-x * 1.5)) * 2.3 * sp + x * 0.1 * sp; p += aC.xyz * dist; }
  vX = x; vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vWN = normalize(mat3(modelMatrix) * nr); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `${UVOF} uniform sampler2D uM, uK; uniform vec3 uSun, uImp; uniform vec2 uPx; uniform float uFront, uHeat, uT, uFade; varying vec3 vD, vW, vWN; varying float vI, vX;
vec3 ramp(float k){ k = clamp(k, 0.0, 1.0); vec3 c = mix(vec3(0.4, 0.03, 0.0), vec3(2.2, 0.5, 0.06), smoothstep(0.0, 0.42, k)); c = mix(c, vec3(4.5, 2.5, 0.7), smoothstep(0.38, 0.72, k)); return mix(c, vec3(9.0, 8.2, 6.6), smoothstep(0.7, 1.0, k)); }
void main(){ vec3 d = normalize(vD), n = normalize(vWN); vec3 c;
  if (vI > 0.5) { float dep = clamp((1.0 - length(vD)) / 0.7, 0.0, 1.0), k = uHeat * 0.8 * exp(-vX * 1.2) * (0.3 + 0.7 * dep), rk = texture2D(uM, uvOf(normalize(d + vec3(0.13)))).a; c = vec3(0.075, 0.046, 0.036) * (0.25 + rk * 1.4) + ramp(k) * smoothstep(0.03, 0.34, k); }
  else { vec2 uv = uvOf(d); vec4 m = texture2D(uM, uv); float h0 = m.a, hx = texture2D(uM, uv + vec2(uPx.x * 2.0, 0.0)).a, hy = texture2D(uM, uv + vec2(0.0, uPx.y * 2.0)).a; vec3 t1 = normalize(cross(n, vec3(0.03, 1.0, 0.02))), t2 = cross(n, t1); vec3 nn = normalize(n - (t1 * (hx - h0) + t2 * (hy - h0)) * 22.0);
    float l = clamp(dot(nn, uSun), 0.0, 1.0), tw = smoothstep(-0.12, 0.25, dot(n, uSun)); c = pow(m.rgb, vec3(2.0)) * (l * 2.1 * tw + 0.026);
    // 금: 맞은 곳에서 번져 나감
    float ang = acos(clamp(dot(d, uImp), -1.0, 1.0)), on = smoothstep(uFront, uFront - 0.3, ang); vec2 kk = texture2D(uK, uv).rg; float e = kk.x * kk.x, e2 = kk.y * kk.y, wd = 0.01 + uHeat * uHeat * 0.042, cr = smoothstep(wd, wd * 0.2, e) * on, c2 = smoothstep(0.012 + uHeat * 0.02, 0.003, e2) * on * smoothstep(0.1, 0.5, uHeat) * smoothstep(0.1, 0.0, e); c = mix(c, ramp(0.3 + uHeat * 0.75), max(cr, c2 * 0.8));
    c += ramp(uHeat * 0.4) * smoothstep(wd * 5.0, 0.0, e) * on * uHeat * 0.3 + vec3(1.2, 0.3, 0.06) * uHeat * uHeat * 0.3;
    float fr = pow(1.0 - clamp(dot(n, normalize(cameraPosition - vW)), 0.0, 1.0), 3.5); c += vec3(0.9, 0.42, 0.22) * fr * 0.34 * clamp(dot(n, uSun) * 1.4 + 0.5, 0.0, 1.0) * (vX > 0.0 ? 0.0 : 1.0); }
  c *= uFade; c = 1.0 - exp(-c * 1.35); gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}` });
  const mesh = new THREE.Mesh(marsShards(), mat); mesh.frustumCulled = false; const group = new THREE.Group(); group.add(mesh);
  // 얇은 대기
  const air = new THREE.Mesh(new THREE.SphereGeometry(1.03, 72, 48), new THREE.ShaderMaterial({ uniforms: { uSun: U.uSun, uA: { value: 1 } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, vertexShader: "varying vec3 vN, vP; void main(){ vN = normalize((modelMatrix * vec4(position, 0.0)).xyz); vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "uniform vec3 uSun; uniform float uA; varying vec3 vN, vP; void main(){ vec3 v = normalize(vP - cameraPosition); float f = clamp(dot(vN, v), 0.0, 1.0), a = pow(f, 2.8) * clamp(dot(vN, uSun) * 1.5 + 0.5, 0.0, 1.0) * uA; vec3 c = vec3(1.0, 0.55, 0.32); gl_FragColor = vec4(c * a * 0.5, a * 0.5); }" })); air.frustumCulled = false; group.add(air);
  return { group, mesh, air, U, seeds: S, dispose() { rt.dispose(); rc.dispose(); air.geometry.dispose(); air.material.dispose(); mat.dispose(); } };
}
