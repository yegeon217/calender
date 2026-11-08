// 블랙홀 연출의 천체: 목성(띠·대적점) · 토성(고리 · 고리 그림자 · 극 육각형) · 천왕성 · 해왕성(대암점) · 금성 · 수성 · 위성 · 소행성 · 별(태양: 쌀알무늬·흑점·주연감광·코로나)
// 표면 지도는 처음 한 번 화면 뒤에서 셰이더로 그려 둠. 모든 천체는 HDR 그대로 내보냄 (톤은 마지막에 한 번).
import * as THREE from "three";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NOISE = `precision highp sampler3D; uniform sampler3D uN;
float nz(vec3 p){ return texture(uN, p).r; }
float fbm(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++){ a += w * texture(uN, p).r; p = p * 2.03 + 0.17; w *= 0.5; } return a; }`;
const DIR = "vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * 6.2831853, lat = (uv.y - 0.5) * 3.1415926; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }";
const UVOF = "vec2 uvOf(vec3 d){ return vec2(atan(d.x, d.z) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5); }";
const QV = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const BB = `vec3 bb(float k){ k = max(k, 0.0); vec3 c = vec3(1.0, 0.16, 0.02) * smoothstep(0.0, 0.22, k); c = mix(c, vec3(1.0, 0.5, 0.14), smoothstep(0.14, 0.42, k)); c = mix(c, vec3(1.0, 0.84, 0.62), smoothstep(0.38, 0.74, k)); c = mix(c, vec3(0.94, 0.96, 1.0), smoothstep(0.7, 1.04, k)); return mix(c, vec3(0.6, 0.72, 1.0), smoothstep(1.04, 1.7, k)); }`;
const H31 = "float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } vec3 h33(vec3 p){ return vec3(h31(p), h31(p + 17.3), h31(p + 41.9)); }";
const CRATERS = `float craters(vec3 d, float sc, float k){ vec3 p = d * sc, b = floor(p); float h = 0.0; for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int l = -1; l <= 1; l++) { vec3 c = b + vec3(float(i), float(j), float(l)), q = c + h33(c); float r = 0.1 + 0.36 * pow(h31(c + 3.1), 2.2), e = length(p - q) / r; if (h31(c + 9.7) < k && e < 1.6) h += (e < 1.0 ? (e * e - 1.0) * 0.8 + 0.28 * smoothstep(0.7, 1.0, e) : 0.28 * (1.0 - smoothstep(1.0, 1.6, e))) * r; } return h; }`;

function bake(renderer, w, h, fs, uniforms) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false, wrapS: THREE.RepeatWrapping }); rt.texture.anisotropy = 8;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: QV, fragmentShader: fs, depthTest: false, depthWrite: false }), q = new THREE.Mesh(g, m); q.frustumCulled = false; const s = new THREE.Scene(); s.add(q);
  const cur = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(s, new THREE.Camera()); renderer.setRenderTarget(cur); g.dispose(); m.dispose(); return rt;
}

// ── 표면 지도 (rgb = 색을 감마로 저장, a = 높이) ──
const MAPS = {
  // 목성: 위도마다 띠 · 띠 경계의 소용돌이 · 남반구 대적점과 흰 타원 · 극지방은 푸르스름하고 어지러움
  jupiter: [2048, 1024, `
float band(float y){ float b = 0.0; b += 0.5 * sin(y * 21.0 + 0.6); b += 0.3 * sin(y * 37.0 + 1.9); b += 0.2 * sin(y * 61.0 + 0.3); return b; }
void main(){ vec3 d = dirOf(vUv); float lat = (vUv.y - 0.5) * 3.1415926, lon = (vUv.x - 0.5) * 6.2831853;
  vec3 ps = vec3(d.x * 1.2, d.y * 9.0, d.z * 1.2);
  float w1 = fbm(ps * 0.9 + 1.0) - 0.68, w2 = fbm(vec3(d.x * 3.0, d.y * 22.0, d.z * 3.0) + 4.0) - 0.68, ed = fbm(d * 6.0 + 2.0) - 0.68;
  float y = sin(lat) + w1 * 0.035 + w2 * 0.012 + ed * 0.008 * abs(band(sin(lat)));
  float b = band(y), belt = smoothstep(-0.15, 0.35, -b);
  // 적도대는 밝음 · 북적도띠/남적도띠는 진함
  float ez = 1.0 - smoothstep(0.06, 0.13, abs(y)), neb = smoothstep(0.1, 0.14, y) * (1.0 - smoothstep(0.27, 0.32, y)), seb = smoothstep(0.1, 0.14, -y) * (1.0 - smoothstep(0.3, 0.36, -y));
  belt = clamp(belt * 0.55 + neb * 0.9 + seb * 0.85 - ez * 0.6, 0.0, 1.0);
  vec3 zone = mix(vec3(0.93, 0.89, 0.8), vec3(0.98, 0.95, 0.88), fbm(ps * 2.0 + 7.0)), beltc = mix(vec3(0.55, 0.33, 0.2), vec3(0.72, 0.5, 0.33), fbm(ps * 1.6 + 3.0));
  vec3 c = mix(zone, beltc, belt);
  // 띠 경계의 흰 소용돌이 · 갈색 막대
  float edge = exp(-pow(b * 3.0, 2.0)), sw = smoothstep(0.74, 0.86, fbm(vec3(d.x * 5.0, d.y * 30.0, d.z * 5.0) + 9.0)) * edge; c = mix(c, vec3(0.99, 0.97, 0.92), sw * 0.6);
  float bar = smoothstep(0.78, 0.88, fbm(vec3(d.x * 7.0, d.y * 50.0, d.z * 7.0) + 1.5)) * neb; c = mix(c, vec3(0.38, 0.2, 0.12), bar * 0.6);
  // 대적점
  vec2 g = vec2(lon - 0.9, lat + 0.38); g.x *= cos(lat); float r = length(g / vec2(0.21, 0.115)), an = atan(g.y, g.x) + 3.0 / (r + 0.3);
  float sp = fbm(vec3(cos(an) * r, sin(an) * r, 0.5) * 1.5 + 2.0); vec3 grs = mix(vec3(0.72, 0.3, 0.17), vec3(0.88, 0.52, 0.34), sp); c = mix(c, grs, smoothstep(1.0, 0.75, r)); c = mix(c, vec3(0.96, 0.92, 0.85), exp(-pow((r - 1.12) * 6.0, 2.0)) * 0.7);
  // 흰 타원들
  for (int i = 0; i < 4; i++) { float fi = float(i); vec2 o = vec2(lon - (2.2 + fi * 0.7), lat + 0.62 + 0.03 * sin(fi * 3.0)); o.x *= cos(lat); float e = length(o / vec2(0.06, 0.04)); c = mix(c, vec3(1.0, 0.98, 0.95), smoothstep(1.0, 0.5, e) * 0.9); }
  // 극지방
  float pol = smoothstep(0.95, 1.2, abs(lat) + w1 * 0.3); c = mix(c, mix(vec3(0.5, 0.48, 0.46), vec3(0.62, 0.6, 0.58), fbm(d * 8.0)), pol * 0.85);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 0.5); }`],
  // 토성: 옅은 금빛 띠 · 북극 육각형
  saturn: [2048, 1024, `
void main(){ vec3 d = dirOf(vUv); float lat = (vUv.y - 0.5) * 3.1415926, lon = (vUv.x - 0.5) * 6.2831853;
  vec3 ps = vec3(d.x * 1.4, d.y * 14.0, d.z * 1.4); float w = fbm(ps + 1.0) - 0.68, y = sin(lat) + w * 0.02;
  float b = 0.5 * sin(y * 26.0) + 0.3 * sin(y * 47.0 + 1.0) + 0.2 * sin(y * 83.0 + 2.0);
  vec3 c = mix(vec3(0.86, 0.76, 0.56), vec3(0.75, 0.62, 0.42), smoothstep(-0.3, 0.6, b) * 0.8); c *= 0.92 + 0.16 * fbm(vec3(d.x * 4.0, d.y * 40.0, d.z * 4.0) + 3.0);
  c = mix(c, vec3(0.93, 0.86, 0.68), (1.0 - smoothstep(0.0, 0.18, abs(y))) * 0.5);
  float hx = 0.0; { float a = lon * 1.0, rr = (1.5708 - lat) / 0.3; float k = cos(3.14159 / 6.0) / cos(mod(a, 1.0472) - 0.5236); hx = smoothstep(1.02, 0.96, rr / k); }
  c = mix(c, vec3(0.45, 0.52, 0.56), hx * 0.75); c = mix(c, vec3(0.6, 0.62, 0.6), smoothstep(1.2, 1.45, abs(lat)) * 0.4 * (1.0 - hx));
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 0.5); }`],
  uranus: [1024, 512, `
void main(){ vec3 d = dirOf(vUv); float lat = (vUv.y - 0.5) * 3.1415926; float y = sin(lat) + (fbm(vec3(d.x, d.y * 10.0, d.z) + 2.0) - 0.68) * 0.02;
  vec3 c = mix(vec3(0.6, 0.83, 0.86), vec3(0.68, 0.88, 0.9), 0.5 + 0.5 * sin(y * 18.0)); c = mix(c, vec3(0.78, 0.92, 0.93), smoothstep(0.6, 1.0, y) * 0.6); c *= 0.96 + 0.06 * fbm(vec3(d.x * 3.0, d.y * 30.0, d.z * 3.0));
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 0.5); }`],
  neptune: [1024, 512, `
void main(){ vec3 d = dirOf(vUv); float lat = (vUv.y - 0.5) * 3.1415926, lon = (vUv.x - 0.5) * 6.2831853; float w = fbm(vec3(d.x * 1.5, d.y * 12.0, d.z * 1.5) + 1.0) - 0.68, y = sin(lat) + w * 0.03;
  vec3 c = mix(vec3(0.16, 0.3, 0.8), vec3(0.24, 0.42, 0.9), 0.5 + 0.5 * sin(y * 15.0 + 1.0)); c = mix(c, vec3(0.1, 0.2, 0.62), smoothstep(0.3, 0.9, abs(y)) * 0.5);
  vec2 g = vec2(lon - 1.2, lat + 0.36); g.x *= cos(lat); float r = length(g / vec2(0.2, 0.1)); c = mix(c, vec3(0.05, 0.1, 0.34), smoothstep(1.0, 0.6, r) * 0.85);
  float ci = smoothstep(0.76, 0.88, fbm(vec3(d.x * 4.0, d.y * 40.0, d.z * 4.0) + 6.0)) * (smoothstep(1.6, 1.1, r) + 0.4 * smoothstep(0.5, 0.8, abs(y))); c = mix(c, vec3(0.92, 0.95, 1.0), ci * 0.85);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 0.5); }`],
  // 금성: 두꺼운 구름 · 옅은 V자 무늬
  venus: [1024, 512, `
void main(){ vec3 d = dirOf(vUv); float lat = (vUv.y - 0.5) * 3.1415926, lon = (vUv.x - 0.5) * 6.2831853; float v = lon * 0.5 + abs(lat) * 1.6;
  float n = fbm(vec3(cos(v) * 1.2, lat * 2.4, sin(v) * 1.2) + 1.0), n2 = fbm(d * 3.0 + 4.0); vec3 c = mix(vec3(0.86, 0.78, 0.6), vec3(0.96, 0.9, 0.74), smoothstep(0.55, 0.85, n)); c = mix(c, vec3(0.78, 0.68, 0.5), smoothstep(0.7, 0.85, n2) * 0.4);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 0.5); }`],
  mercury: [1024, 512, `${H31} ${CRATERS}
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 1.4 + 1.0), n2 = fbm(d * 4.0 + 3.0), cr = craters(d, 8.0, 0.6) + craters(d, 19.0, 0.55) * 0.6 + craters(d, 40.0, 0.5) * 0.35;
  float h = n * 0.4 + n2 * 0.2 + cr * 0.5 + 0.2; vec3 c = mix(vec3(0.36, 0.33, 0.3), vec3(0.6, 0.57, 0.53), smoothstep(0.5, 0.85, n2)); c *= 0.8 + cr * 0.6;
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), clamp(h, 0.0, 1.0)); }`],
  moon: [1024, 512, `${H31} ${CRATERS}
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 1.1 + 2.0), cr = craters(d, 7.0, 0.55) + craters(d, 17.0, 0.55) * 0.6 + craters(d, 36.0, 0.5) * 0.3; float mare = smoothstep(0.66, 0.74, n);
  vec3 c = mix(vec3(0.64, 0.62, 0.58), vec3(0.3, 0.29, 0.28), mare); c *= 0.85 + cr * 0.6; gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), clamp(n * 0.4 + cr * 0.5 + 0.2, 0.0, 1.0)); }`],
  io: [1024, 512, `${H31} ${CRATERS}
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 2.0 + 5.0), n2 = fbm(d * 6.0 + 1.0); vec3 c = mix(vec3(0.85, 0.74, 0.3), vec3(0.95, 0.88, 0.55), n2); c = mix(c, vec3(0.7, 0.36, 0.12), smoothstep(0.72, 0.8, n) * 0.8);
  float v = craters(d, 12.0, 0.25); c = mix(c, vec3(0.12, 0.08, 0.05), smoothstep(-0.05, -0.15, v)); c = mix(c, vec3(0.86, 0.3, 0.1), smoothstep(-0.0, -0.05, v) * smoothstep(-0.15, -0.08, v));
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), clamp(0.4 + n2 * 0.3 + v, 0.0, 1.0)); }`],
  europa: [1024, 512, `
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 1.6 + 1.0); vec3 c = mix(vec3(0.86, 0.84, 0.8), vec3(0.72, 0.62, 0.5), smoothstep(0.66, 0.8, n) * 0.6);
  float l1 = abs(fbm(d * 3.0 + 2.0) - 0.68), l2 = abs(fbm(d * 5.0 + 7.0) - 0.68); c = mix(c, vec3(0.52, 0.32, 0.2), smoothstep(0.012, 0.0, l1) * 0.8 + smoothstep(0.008, 0.0, l2) * 0.6);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 0.5 + n * 0.2); }`],
  rust: [1024, 512, `${H31} ${CRATERS}
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 1.2 + 3.0), n2 = fbm(d * 4.0), cr = craters(d, 9.0, 0.5) + craters(d, 21.0, 0.5) * 0.5; vec3 c = mix(vec3(0.55, 0.26, 0.13), vec3(0.78, 0.46, 0.24), smoothstep(0.58, 0.8, n)); c = mix(c, vec3(0.28, 0.15, 0.1), smoothstep(0.7, 0.8, n2) * 0.6); c *= 0.85 + cr * 0.8;
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), clamp(n * 0.5 + cr * 0.4 + 0.1, 0.0, 1.0)); }`],
  rock: [512, 256, `${H31} ${CRATERS}
void main(){ vec3 d = dirOf(vUv); float n = fbm(d * 2.0 + 1.0), cr = craters(d, 6.0, 0.6) + craters(d, 14.0, 0.6) * 0.5; vec3 c = mix(vec3(0.3, 0.28, 0.26), vec3(0.46, 0.43, 0.4), n); c *= 0.8 + cr * 0.7; gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), clamp(n * 0.5 + cr * 0.5, 0.0, 1.0)); }`],
};

let baked = null;
export function bakeBodies(renderer, noise) { if (baked) return baked; baked = {}; for (const k in MAPS) { const [w, h, fs] = MAPS[k]; const rt = bake(renderer, w, h, `${NOISE} ${DIR} varying vec2 vUv; ${fs}`, { uN: { value: noise } }); rt.texture.colorSpace = THREE.NoColorSpace; baked[k] = rt; } return baked; }
export function disposeBodies() { if (!baked) return; for (const k in baked) baked[k].dispose(); baked = null; }

// ── 행성 표면 ──
const PV = "varying vec3 vL, vN, vP; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }";
const RING = `float rh(float x){ return fract(sin(x * 127.1) * 43758.5453); } float rn(float x){ float i = floor(x), f = fract(x); return mix(rh(i), rh(i + 1.0), f * f * (3.0 - 2.0 * f)); }
vec2 ringP(float r){ float a = 0.0, b = 0.0;
  if (r > 1.24 && r < 1.527) { a = 0.08 + 0.14 * smoothstep(1.24, 1.5, r); b = 0.5; } else if (r >= 1.527 && r < 1.951) { a = 0.68 + 0.3 * smoothstep(1.527, 1.72, r) - 0.1 * smoothstep(1.85, 1.95, r); b = 1.0; }
  else if (r >= 1.951 && r < 2.027) { a = 0.04 + 0.05 * exp(-pow((r - 1.99) * 200.0, 2.0)); b = 0.45; } else if (r >= 2.027 && r < 2.27) { a = 0.52 - 0.14 * smoothstep(2.12, 2.27, r); b = 0.84; a *= 1.0 - 0.92 * exp(-pow((r - 2.214) * 400.0, 2.0)); }
  else if (abs(r - 2.326) < 0.006) { a = 0.35 * (1.0 - abs(r - 2.326) / 0.006); b = 1.0; }
  float fine = rn(r * 1400.0) * 0.45 + rn(r * 380.0) * 0.35 + rn(r * 60.0) * 0.2; a *= 0.55 + 0.8 * fine; return vec2(clamp(a, 0.0, 1.0), b * (0.82 + 0.3 * fine)); }`;
const PF = `${NOISE} ${UVOF} ${BB} ${RING} uniform sampler2D uM; uniform vec3 uSun, uLC, uAmb, uRim, uTint, uRC, uRN; uniform float uType, uRimK, uBump, uRR, uRingOn, uFade, uT; uniform vec2 uPx; varying vec3 vL, vN, vP;
void main(){ vec3 d = normalize(vL), n = normalize(vN), v = normalize(cameraPosition - vP); vec2 uv = uvOf(d); vec4 m = texture2D(uM, uv); vec3 alb = pow(m.rgb, vec3(2.2)) * uTint; float mu = max(dot(n, v), 0.0);
  vec3 nn = n; if (uBump > 0.0) { float hx = texture2D(uM, uv + vec2(uPx.x * 1.5, 0.0)).a, hy = texture2D(uM, uv + vec2(0.0, uPx.y * 1.5)).a; vec3 t1 = normalize(cross(n, vec3(0.03, 1.0, 0.02))), t2 = cross(n, t1); nn = normalize(n - (t1 * (hx - m.a) + t2 * (hy - m.a)) * uBump); }
  float l = dot(nn, uSun), lg = dot(n, uSun);
  float lit = uType > 0.5 ? smoothstep(-0.12, 0.5, lg) * (0.25 + 0.75 * clamp(lg, 0.0, 1.0)) * (0.55 + 0.45 * pow(mu, 0.35)) : max(l, 0.0) * smoothstep(-0.05, 0.12, lg);
  // 토성 고리가 몸에 드리운 그림자
  if (uRingOn > 0.5) { float dn = dot(uSun, uRN); if (abs(dn) > 1e-3) { float t = dot(uRC - vP, uRN) / dn; if (t > 0.0) { float r = length(vP + uSun * t - uRC) / uRR; lit *= 1.0 - ringP(r).x * 0.92; } } }
  vec3 c = alb * uLC * lit + alb * uAmb * (0.4 + 0.6 * mu);
  if (uType > 0.5) c *= mix(vec3(1.0, 0.86, 0.72), vec3(1.0), smoothstep(-0.05, 0.4, lg));
  c += uRim * pow(1.0 - mu, 3.0) * clamp(lg * 1.4 + 0.45, 0.0, 1.0) * uRimK;
  gl_FragColor = vec4(c * uFade, uFade); }`;
// 토성 고리 (판 하나)
const RF = `${RING} uniform vec3 uSun, uLC, uPC; uniform float uPR, uFade; varying vec3 vL, vN, vP;
void main(){ float r = length(vL.xy); vec2 p = ringP(r); if (p.x < 0.004) discard; vec3 col = mix(vec3(0.62, 0.52, 0.4), vec3(0.9, 0.82, 0.66), p.y); col = mix(col, vec3(0.5, 0.46, 0.42), smoothstep(1.53, 1.3, r) * 0.6);
  vec3 n = normalize(vN), v = normalize(cameraPosition - vP); float sl = dot(n, uSun), sv = dot(n, v), same = step(0.0, sl * sv);
  // 행성 그림자 (고리 위 → 해 방향으로 행성을 지나는지)
  vec3 oc = vP - uPC; float b = dot(oc, uSun), cc = dot(oc, oc) - uPR * uPR, h = b * b - cc; float sh = (h > 0.0 && -b - sqrt(h) > 0.0) ? 0.06 : 1.0;
  float lum = same > 0.5 ? abs(sl) * 1.15 + 0.05 : abs(sl) * (1.0 - p.x) * 1.8 + 0.03;
  vec3 c = col * pow(p.y, 1.2) * uLC * lum * sh * 0.62; gl_FragColor = vec4(c * uFade, p.x * uFade); }`;
// 별: 쌀알무늬 · 흑점 · 주연감광
const SF = `${NOISE} ${BB} uniform float uTemp, uI, uT, uSpot, uFade; uniform vec3 uSeed; varying vec3 vL, vN, vP;
void main(){ vec3 d = normalize(vL), n = normalize(vN), v = normalize(cameraPosition - vP); float mu = max(dot(n, v), 0.0);
  vec3 q = d * 5.5 + uSeed; float g1 = nz(q + vec3(0.0, uT * 0.04, 0.0)), g2 = nz(q * 2.6 + vec3(uT * 0.07, 0.0, 0.0)), g3 = nz(q * 7.0 - vec3(0.0, 0.0, uT * 0.1));
  float gran = smoothstep(0.5, 0.9, g1 * 0.5 + g2 * 0.32 + g3 * 0.18), sup = fbm(d * 1.6 + uSeed * 0.3);
  float spot = smoothstep(0.83, 0.9, fbm(d * 2.3 + uSeed + 3.0)) * uSpot, pen = smoothstep(0.78, 0.84, fbm(d * 2.3 + uSeed + 3.0)) * uSpot;
  vec3 c = bb(uTemp) * uI * (0.72 + 0.55 * gran) * (0.9 + 0.2 * sup); c *= 1.0 - pen * 0.45 - spot * 0.5;
  float ld = 0.32 + 0.68 * pow(mu, 0.5); c *= ld; c *= mix(vec3(1.0, 0.62, 0.38), vec3(1.0), smoothstep(0.0, 0.5, mu));
  // 가장자리 밝은 반점(백반)
  c += bb(uTemp) * uI * smoothstep(0.78, 0.9, g2) * pow(1.0 - mu, 2.0) * 0.35;
  gl_FragColor = vec4(c * uFade, uFade); }`;
// 코로나: 카메라를 보는 판 · 해 둘레 빛 + 줄기 + 가끔 홍염
const CF = `${NOISE} ${BB} uniform float uTemp, uI, uT, uFade, uR; uniform vec3 uSeed; varying vec2 vQ;
void main(){ float r = length(vQ), a = atan(vQ.y, vQ.x); if (r < uR * 0.98) discard; float x = (r - uR) / uR;
  float st = nz(vec3(cos(a) * 1.6, sin(a) * 1.6, uSeed.x) + vec3(0.0, 0.0, uT * 0.02)), st2 = nz(vec3(cos(a) * 5.0, sin(a) * 5.0, uSeed.y + x * 0.3 - uT * 0.05));
  float co = exp(-x * 4.5) * 0.9 + exp(-x * 1.4) * 0.22 * (0.5 + st * 0.9) + exp(-x * 0.7) * 0.05 * smoothstep(0.6, 0.85, st2);
  float pr = smoothstep(0.82, 0.92, nz(vec3(cos(a) * 3.0, sin(a) * 3.0, uSeed.z))) * exp(-pow((x - 0.06 - 0.05 * st2) * 18.0, 2.0)) * 1.8;
  float ef = smoothstep(1.0, 0.7, r); co *= ef; pr *= ef;   // 판 가장자리에서 0 (네모 테두리가 안 보이게)
  vec3 c = bb(uTemp * 0.95) * uI * co * 0.55 + vec3(1.0, 0.3, 0.2) * uI * pr * 0.25; float al = clamp(co + pr, 0.0, 1.0);
  gl_FragColor = vec4(c * uFade, 0.0); }`;
// 대기 테두리
const AF = `uniform vec3 uSun, uC; uniform float uA; varying vec3 vL, vN, vP; void main(){ vec3 v = normalize(vP - cameraPosition); float f = clamp(dot(normalize(vN), v), 0.0, 1.0), a = pow(f, 2.6) * clamp(dot(normalize(vN), uSun) * 1.6 + 0.5, 0.0, 1.0) * uA; gl_FragColor = vec4(uC * a, 0.0); }`;

// 더하기 섞기 (투명도는 그대로 둠 → 뒤 하늘을 가리지 않음)
export function addBlend(m) { m.transparent = true; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.depthWrite = false; return m; }

let SPH = null, SPH2 = null; const sph = () => SPH || (SPH = new THREE.SphereGeometry(1, 128, 80)), sphLo = () => SPH2 || (SPH2 = new THREE.SphereGeometry(1, 64, 40));
// 소행성 모양용 3D 값 잡음 (CPU)
const hh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }, sm = t => t * t * (3 - 2 * t);
function n3(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi); let r = 0; for (let k = 0; k < 8; k++) { const a = k & 1, b = (k >> 1) & 1, c = k >> 2; r += hh(xi + a, yi + b, zi + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w); } return r; }
let ROCKS = null;
function rockGeos() { const noise3 = n3; if (ROCKS) return ROCKS; ROCKS = []; for (let k = 0; k < 4; k++) { const g = new THREE.IcosahedronGeometry(1, 5), p = g.attributes.position, s = [Math.random() * 9, Math.random() * 9, Math.random() * 9], el = V(0.75 + Math.random() * 0.5, 0.6 + Math.random() * 0.3, 0.9 + Math.random() * 0.3); for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)).normalize(); let h = 0; for (let o = 0, f = 1.3, a = 0.32; o < 4; o++, f *= 2.1, a *= 0.48) h += (noise3(v.x * f + s[0], v.y * f + s[1], v.z * f + s[2]) - 0.5) * a; v.multiplyScalar(1 + h).multiply(el); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); ROCKS.push(g); } return ROCKS; }

// kind: jupiter saturn uranus neptune venus mercury moon io europa rust rock star
// o: { temp(별 온도 0~1.6), tint, ring(토성) }
export function makeBody(renderer, noise, kind, o = {}) {
  const maps = bakeBodies(renderer, noise), group = new THREE.Group(), spin = new THREE.Group(); group.add(spin);
  const isStar = kind === "star", gas = ["jupiter", "saturn", "uranus", "neptune", "venus"].includes(kind);
  const U = { uN: { value: noise }, uSun: { value: V(0.5, 0.4, 0.75).normalize() }, uLC: { value: new THREE.Color(2.1, 2.0, 1.9) }, uAmb: { value: new THREE.Color(0.02, 0.022, 0.03) }, uRim: { value: new THREE.Color(0.5, 0.6, 0.9) }, uRimK: { value: gas ? 0.5 : 0.08 }, uTint: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 1 }, uT: { value: 0 },
    uType: { value: gas ? 1 : 0 }, uBump: { value: gas ? 0 : 9 }, uRC: { value: V() }, uRN: { value: V(0, 1, 0) }, uRR: { value: 1 }, uRingOn: { value: 0 }, uM: { value: null }, uPx: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
    uTemp: { value: o.temp == null ? 0.82 : o.temp }, uI: { value: o.lum || 2.8 }, uSpot: { value: o.spot == null ? 1 : o.spot }, uSeed: { value: V(Math.random() * 5, Math.random() * 5, Math.random() * 5) }, uR: { value: 1 } };
  if (o.tint) U.uTint.value.copy(o.tint);
  let mesh, corona = null, ring = null, air = null; const extra = [];
  if (isStar) {
    mesh = new THREE.Mesh(sph(), new THREE.ShaderMaterial({ uniforms: U, vertexShader: PV, fragmentShader: SF }));
    const cU = { uN: U.uN, uTemp: U.uTemp, uI: U.uI, uT: U.uT, uFade: U.uFade, uSeed: U.uSeed, uR: { value: 1 / 3.2 } };
    corona = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), addBlend(new THREE.ShaderMaterial({ uniforms: cU, vertexShader: "varying vec2 vQ; varying float vNear; void main(){ vQ = position.xy / 3.2; vec4 c = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelMatrix[0].xyz); vNear = smoothstep(s * 2.0, s * 7.0, -c.z); c.xy += position.xy * s; gl_Position = projectionMatrix * c; }", fragmentShader: CF.replace("varying vec2 vQ;", "varying vec2 vQ; varying float vNear;").replace("gl_FragColor = vec4(c * uFade, 0.0);", "gl_FragColor = vec4(c * uFade * vNear, 0.0);"), depthWrite: false })));
    corona.frustumCulled = false; corona.renderOrder = 3; group.add(corona);
    // (블랙홀 둘레 별만) 빛무리 안쪽 깊이만 남기는 보이지 않는 원판 → 블랙홀 렌즈가 별과 빛무리를 같이 휘게
    if (o.depthHalo) { const dh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: "varying vec2 vQ; void main(){ vQ = position.xy; vec4 c = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelMatrix[0].xyz); c.xy += position.xy * s * 1.9; c.z -= s * 0.05; gl_Position = projectionMatrix * c; }", fragmentShader: "varying vec2 vQ; void main(){ if (dot(vQ, vQ) > 1.0) discard; gl_FragColor = vec4(0.0); }", colorWrite: false })); dh.frustumCulled = false; dh.renderOrder = 1; group.add(dh); extra.push(dh); }
  } else {
    const rk = kind === "rock"; U.uM.value = maps[rk ? "rock" : kind].texture; const w = maps[rk ? "rock" : kind].width; U.uPx.value.set(1 / w, 2 / w);
    mesh = new THREE.Mesh(rk ? rockGeos()[(Math.random() * 4) | 0] : sph(), new THREE.ShaderMaterial({ uniforms: U, vertexShader: PV, fragmentShader: PF }));
    const ac = { jupiter: [0.9, 0.75, 0.55, 0.35], saturn: [0.95, 0.82, 0.6, 0.3], uranus: [0.55, 0.9, 1.0, 0.55], neptune: [0.35, 0.55, 1.2, 0.6], venus: [1.0, 0.9, 0.7, 0.55] }[kind];
    if (ac) { const AU = { uSun: U.uSun, uC: { value: new THREE.Color(ac[0], ac[1], ac[2]) }, uA: { value: ac[3] } }; air = new THREE.Mesh(sphLo(), addBlend(new THREE.ShaderMaterial({ uniforms: AU, vertexShader: PV, fragmentShader: AF, side: THREE.BackSide }))); air.scale.setScalar(1.035); air.frustumCulled = false; spin.add(air); U.uRim.value.setRGB(ac[0], ac[1], ac[2]); }
    if (kind === "saturn" || kind === "uranus") {
      const RU = { uSun: U.uSun, uLC: U.uLC, uPC: { value: V() }, uPR: { value: 1 }, uFade: U.uFade };
      ring = new THREE.Mesh(new THREE.RingGeometry(kind === "saturn" ? 1.22 : 1.6, kind === "saturn" ? 2.36 : 2.05, 256, 4), new THREE.ShaderMaterial({ uniforms: RU, vertexShader: PV, fragmentShader: kind === "saturn" ? RF : RF.replace("vec2 p = ringP(r);", "vec2 p = vec2(smoothstep(0.006, 0.0, abs(r - 1.64)) * 0.5 + smoothstep(0.004, 0.0, abs(r - 1.75)) * 0.4 + smoothstep(0.012, 0.0, abs(r - 2.0)) * 0.6, 0.35);"), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.frustumCulled = false; ring.renderOrder = 2; group.add(ring); U.uRingOn.value = kind === "saturn" ? 1 : 0; ring.U = RU;
    }
  }
  mesh.frustumCulled = false; spin.add(mesh);
  // 서서히 나타나고 사라질 때 뒤를 검게 가리지 않게: 미리 곱한 투명도로 섞음 (다 보일 땐 지금과 똑같음)
  { const m = mesh.material; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }
  const nw = new THREE.Vector3(), tq = new THREE.Quaternion();
  return { kind, group, spin, mesh, U, corona, ring, air, isStar,
    // 해 방향·빛 세기 · 시간 (매 프레임)
    update(t, sun, lc) { U.uT.value = t; mesh.material.depthWrite = U.uFade.value > 0.97; for (const e of extra) e.visible = U.uFade.value > 0.97; if (sun) U.uSun.value.copy(sun).normalize(); if (lc) U.uLC.value.copy(lc);
      if (ring) { group.updateMatrixWorld(true); const s = group.getWorldScale(nw).x; ring.U.uPC.value.setFromMatrixPosition(group.matrixWorld); ring.U.uPR.value = s; U.uRC.value.setFromMatrixPosition(group.matrixWorld); U.uRR.value = s; group.getWorldQuaternion(tq); U.uRN.value.set(0, 0, 1).applyQuaternion(ring.quaternion).applyQuaternion(tq).normalize(); } },
    dispose() { mesh.material.dispose(); for (const e of extra) { e.geometry.dispose(); e.material.dispose(); } if (corona) { corona.geometry.dispose(); corona.material.dispose(); } if (ring) { ring.geometry.dispose(); ring.material.dispose(); } if (air) air.material.dispose(); } };
}
