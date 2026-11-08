// 태양 연출의 효과들: HDR 화면 마무리(우주 하늘 · 연기 합성 · 번짐 · 톤) · 낮 하늘(구름 바다 → 우주) · 부서지는 행성(금 · 조각 · 떠다니는 파편) ·
// 평면 충격 고리 · 돌 부스러기 · 끓는 태양 겉면 · 플라스마 손.
import * as THREE from "three";
import { marsShards } from "./planets.js";
import { addBlend } from "./bh-bodies.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TRI = new THREE.BufferGeometry(); TRI.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); TRI.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const QV = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const NOISE = `precision highp sampler3D; uniform sampler3D uN; float nz(vec3 p){ return texture(uN, p).r; } float fbm(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++){ a += w * texture(uN, p).r; p = p * 2.03 + 0.17; w *= 0.5; } return a; }`;
const BB = `vec3 bb(float k){ k = max(k, 0.0); vec3 c = vec3(1.0, 0.16, 0.02) * smoothstep(0.0, 0.22, k); c = mix(c, vec3(1.0, 0.5, 0.14), smoothstep(0.14, 0.42, k)); c = mix(c, vec3(1.0, 0.84, 0.62), smoothstep(0.38, 0.74, k)); c = mix(c, vec3(0.94, 0.96, 1.0), smoothstep(0.7, 1.04, k)); return mix(c, vec3(0.6, 0.72, 1.0), smoothstep(1.04, 1.7, k)); }`;
const DIR = "vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * 6.2831853, lat = (uv.y - 0.5) * 3.1415926; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }";
const UVOF = "vec2 uvOf(vec3 d){ return vec2(atan(d.x, d.z) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5); }";

// ── 화면 마무리 ──
// 장면(HDR) → 비어 있는 곳엔 우주 하늘(별 · 은하수) → 연기 입자(따로 그린 것을 HDR로 되돌려 합성) → 번짐 → 충격파 일렁임 · 색 갈라짐 · 섬광 → 톤 → 화면
const COMP = `precision highp float; ${NOISE.replace("precision highp sampler3D;", "precision highp sampler3D;")}
uniform sampler2D uS, uP; uniform mat4 uPI, uVI; uniform float uPx0, uSky, uPExp, uPOn; uniform mat3 uSR; uniform vec3 uNG, uGC; varying vec2 vUv;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
${BB}
float fbm3(vec3 p){ return nz(p) * 0.55 + nz(p * 2.03 + 0.17) * 0.28 + nz(p * 4.1 + 0.41) * 0.17; }
vec3 starL(vec3 d, float N, float pw, float px, float amp, float sd){
  vec3 a = abs(d); vec2 uv; float fc;
  if (a.x >= a.y && a.x >= a.z) { uv = d.zy / a.x; fc = d.x > 0.0 ? 0.0 : 1.0; } else if (a.y >= a.z) { uv = d.xz / a.y; fc = d.y > 0.0 ? 2.0 : 3.0; } else { uv = d.xy / a.z; fc = d.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = (uv * 0.5 + 0.5) * N, id = floor(g), f = g - id;
  float h = h13(vec3(id, fc * 13.0 + sd)), b = pow(h, pw);
  vec2 c = 0.2 + 0.6 * vec2(h13(vec3(id, fc + sd + 7.1)), h13(vec3(id.yx, fc + sd + 3.3)));
  float s0 = max(uPx0 * N * 0.5, 0.03), s = max(px * N * 0.5, 0.03), e = length(f - c) / s, k = min(1.0, s0 / s);
  return bb(0.42 + 0.95 * h13(vec3(id, fc + sd + 11.0))) * amp * b * exp(-e * e) * k * k;
}
vec3 sky(vec3 d, float px){
  float b = dot(d, uNG), cg = dot(d, uGC);
  float n1 = fbm3(d * 1.3 + 0.3), n2 = fbm3(d * 3.7 + 1.7), n3 = nz(d * 9.0 + 2.2);
  float band = exp(-b * b / 0.014) * (0.5 + 0.5 * smoothstep(-0.7, 0.9, cg)) + exp(-b * b / 0.09) * 0.2;
  float bulge = exp(-b * b / 0.026) * pow(max(cg, 0.0), 5.0);
  float clump = smoothstep(0.5, 0.86, n1 * 0.55 + n2 * 0.45);
  float dust = smoothstep(0.62, 0.8, fbm3(d * 2.6 + 4.0)) * exp(-pow(b - 0.05 * (n1 - 0.68), 2.0) / 0.0035);
  vec3 mw = mix(vec3(0.42, 0.5, 0.82), vec3(1.0, 0.76, 0.5), clamp(bulge * 2.4 + max(cg, 0.0) * 0.25, 0.0, 1.0));
  vec3 c = mw * (band * (0.22 + 1.15 * clump) * (0.7 + 0.6 * n3) + bulge * 1.6) * (1.0 - 0.9 * dust) * 0.085;
  float ne = smoothstep(0.75, 0.9, fbm3(d * 1.9 + 5.0)) * (0.25 + band);
  c += mix(vec3(1.0, 0.16, 0.3), vec3(0.16, 0.6, 0.72), smoothstep(0.55, 0.8, n2)) * ne * 0.08;
  c += starL(d, 54.0, 7.0, px, 7.0, 1.0) + starL(d, 170.0, 12.0, px, 3.4, 2.0) + starL(d, 480.0, 2.6, px, 0.42, 3.0);
  return c;
}
void main(){
  vec4 cp = uPI * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 d = normalize((uVI * vec4(cp.xyz / cp.w, 0.0)).xyz); float px = length(fwidth(d)) + 1e-6;
  vec4 fg = texture(uS, vUv); vec3 bg = uSky > 0.0 ? sky(uSR * d, px) * uSky : vec3(0.0);
  vec3 col = fg.rgb + bg * (1.0 - fg.a);
  if (uPOn > 0.5) { vec4 p = texture(uP, vUv); if (p.a > 0.002) { vec3 g = clamp(p.rgb / p.a, 0.0, 0.999), l = pow(g, vec3(2.2)), h = -log(1.0 - min(l, vec3(0.985))) / uPExp; col = col * (1.0 - p.a) + h * p.a; } }
  gl_FragColor = vec4(col, 1.0);
}`;
const DOWN = `precision highp float; uniform sampler2D uT; uniform vec2 uPx; uniform float uTh; varying vec2 vUv;
vec3 s(vec2 o){ return texture(uT, vUv + o * uPx).rgb; }
void main(){ vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2)), d = s(vec2(-2, 0)), e = s(vec2(0)), f = s(vec2(2, 0)), g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2)), j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uTh > 0.0) { float br = max(o.r, max(o.g, o.b)), sk = clamp(br - uTh * 0.6, 0.0, uTh * 0.8); sk = sk * sk / (uTh * 3.2 + 1e-4); o *= max(sk, br - uTh) / max(br, 1e-4); o = min(o, vec3(60.0)); }
  gl_FragColor = vec4(o, 1.0); }`;
const UP = `precision highp float; uniform sampler2D uT, uB; uniform vec2 uPx; varying vec2 vUv;
void main(){ vec3 o = texture(uT, vUv).rgb * 4.0; o += (texture(uT, vUv + vec2(uPx.x, 0)).rgb + texture(uT, vUv - vec2(uPx.x, 0)).rgb + texture(uT, vUv + vec2(0, uPx.y)).rgb + texture(uT, vUv - vec2(0, uPx.y)).rgb) * 2.0;
  o += texture(uT, vUv + uPx).rgb + texture(uT, vUv - uPx).rgb + texture(uT, vUv + vec2(uPx.x, -uPx.y)).rgb + texture(uT, vUv + vec2(-uPx.x, uPx.y)).rgb; gl_FragColor = vec4(o / 16.0 + texture(uB, vUv).rgb, 1.0); }`;
const FINAL = `precision highp float; uniform sampler2D uC, uB; uniform float uBloom, uExpo, uFlash, uFade, uCA, uShR, uShA, uAsp, uT, uVig, uGrain, uTM, uWhite; uniform vec2 uShC; uniform vec3 uFlashC; varying vec2 vUv;
vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537, b = v * (0.983729 * v + 0.432951) + 0.238081; return a / b; }
vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719, 0.076, 0.0284), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); return clamp(O * fit(I * (c * uExpo / 0.6)), 0.0, 1.0); }
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){ vec2 uv = vUv, dv = uv - uShC; dv.x *= uAsp; float r = length(dv) + 1e-5;
  float ring = 0.0; if (uShA > 0.0) { float w = (r - uShR) / (0.03 + uShR * 0.035); ring = exp(-w * w) * uShA; uv -= dv / r * vec2(1.0 / uAsp, 1.0) * ring * 0.035 * sign(w + 0.3); }
  vec2 ca = (uv - 0.5) * uCA * 0.012;
  vec3 c = vec3(texture(uC, uv + ca).r, texture(uC, uv).g, texture(uC, uv - ca).b) + texture(uB, uv).rgb * uBloom;
  c += uFlashC * uFlash + vec3(0.85, 0.9, 1.0) * ring * 0.07;
  c = mix(clamp(c, 0.0, 1.0), aces(c), uTM);
  float vg = 1.0 - uVig * smoothstep(0.45, 1.25, length((vUv - 0.5) * vec2(uAsp, 1.0)) / max(uAsp, 1.0) * 1.4); c *= vg;
  c = mix(c, vec3(1.0), uWhite); c = mix(c, vec3(0.0), uFade);
  c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  c += (h12(gl_FragCoord.xy + fract(uT) * 517.0) - 0.5) * (1.6 / 255.0 + uGrain);
  gl_FragColor = vec4(c, 1.0); }`;

export function makePost(X, noise) {
  const { renderer } = X, mobile = Math.min(X.vw, X.vh) < 700;
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), qs = new THREE.Scene(), quad = new THREE.Mesh(TRI, null); quad.frustumCulled = false; qs.add(quad);
  const ht = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const sRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
  const pRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const cRT = new THREE.WebGLRenderTarget(4, 4, ht), NB = 6, dn = [], up = [];
  for (let i = 0; i < NB; i++) { dn.push(new THREE.WebGLRenderTarget(4, 4, ht)); up.push(new THREE.WebGLRenderTarget(4, 4, ht)); }
  const CU = { uS: { value: sRT.texture }, uP: { value: pRT.texture }, uN: { value: noise }, uPI: { value: new THREE.Matrix4() }, uVI: { value: new THREE.Matrix4() }, uPx0: { value: 0.0006 }, uSky: { value: 0 }, uPExp: { value: 1.1 }, uPOn: { value: 0 }, uSR: { value: new THREE.Matrix3() }, uNG: { value: V(0.28, 0.86, 0.42).normalize() }, uGC: { value: V() } };
  CU.uGC.value.set(0.9, 0, 0.43).cross(CU.uNG.value).normalize();
  const comp = new THREE.ShaderMaterial({ uniforms: CU, vertexShader: QV, fragmentShader: COMP, depthTest: false, depthWrite: false });
  const DU = { uT: { value: null }, uPx: { value: new THREE.Vector2() }, uTh: { value: 0 } }, down = new THREE.ShaderMaterial({ uniforms: DU, vertexShader: QV, fragmentShader: DOWN, depthTest: false, depthWrite: false });
  const UU = { uT: { value: null }, uB: { value: null }, uPx: { value: new THREE.Vector2() } }, upM = new THREE.ShaderMaterial({ uniforms: UU, vertexShader: QV, fragmentShader: UP, depthTest: false, depthWrite: false });
  const FU = { uC: { value: cRT.texture }, uB: { value: null }, uBloom: { value: 0.4 }, uExpo: { value: 1.05 }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 0 }, uWhite: { value: 0 }, uCA: { value: 0 }, uShR: { value: 0 }, uShA: { value: 0 }, uShC: { value: new THREE.Vector2(0.5, 0.5) }, uAsp: { value: 1 }, uT: { value: 0 }, uVig: { value: 0.3 }, uGrain: { value: 0 }, uTM: { value: 1 } };
  const fin = new THREE.ShaderMaterial({ uniforms: FU, vertexShader: QV, fragmentShader: FINAL, depthTest: false, depthWrite: false, toneMapped: false });
  const pass = (m, rt) => { quad.material = m; renderer.setRenderTarget(rt); renderer.render(qs, oc); };
  let q = mobile ? 0.85 : 1, W = 0, H = 0;
  function size() { const b = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(4, Math.round(b.x * q)), h = Math.max(4, Math.round(b.y * q)); if (w === W && h === H) return; W = w; H = h;
    sRT.setSize(w, h); pRT.setSize(w, h); cRT.setSize(w, h); for (let i = 0; i < NB; i++) { const s = 2 ** (i + 1); dn[i].setSize(Math.max(2, Math.round(w / s)), Math.max(2, Math.round(h / s))); up[i].setSize(Math.max(2, Math.round(w / s)), Math.max(2, Math.round(h / s))); }
    FU.uAsp.value = w / h; }
  size();
  // P: { sky, bloom, bth, expo, flash, flashC, fade, white, ca, shR, shA, shC, vig, grain, tm }
  function render(scene, cam, P, t, plume) {
    size(); cam.updateMatrixWorld(); const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(sRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(scene, cam);
    CU.uPOn.value = 0; if (plume && plume.count()) { renderer.setRenderTarget(pRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); plume.render(scene, cam); CU.uPOn.value = 1; CU.uPExp.value = P.pexp || 1.1; }
    CU.uPI.value.copy(cam.projectionMatrixInverse); CU.uVI.value.copy(cam.matrixWorld); CU.uPx0.value = (2 * Math.tan(cam.fov * Math.PI / 360)) / H; CU.uSky.value = P.sky || 0;
    pass(comp, cRT);
    let src = cRT; for (let i = 0; i < NB; i++) { DU.uT.value = src.texture; DU.uPx.value.set(1 / src.width, 1 / src.height); DU.uTh.value = i === 0 ? (P.bth || 1.5) : 0; pass(down, dn[i]); src = dn[i]; }
    let lo = dn[NB - 1]; for (let i = NB - 2; i >= 0; i--) { UU.uT.value = lo.texture; UU.uB.value = dn[i].texture; UU.uPx.value.set(1 / lo.width, 1 / lo.height); pass(upM, up[i]); lo = up[i]; }
    FU.uB.value = up[0].texture; FU.uBloom.value = P.bloom == null ? 0.4 : P.bloom; FU.uExpo.value = P.expo == null ? 1.05 : P.expo; FU.uFlash.value = P.flash || 0; if (P.flashC) FU.uFlashC.value.copy(P.flashC); else FU.uFlashC.value.setRGB(1, 1, 1);
    FU.uFade.value = P.fade || 0; FU.uWhite.value = P.white || 0; FU.uCA.value = P.ca || 0; FU.uShR.value = P.shR || 0; FU.uShA.value = P.shA || 0; if (P.shC) FU.uShC.value.copy(P.shC); FU.uT.value = t; FU.uVig.value = P.vig == null ? 0.3 : P.vig; FU.uGrain.value = P.grain || 0; FU.uTM.value = P.tm == null ? 1 : P.tm;
    pass(fin, null); renderer.autoClear = ac;
  }
  const ft = []; let cool = 0;
  function adapt(dt) { if (cool > 0) { cool -= dt; return; } ft.push(dt); if (ft.length < 24) return; ft.sort((a, b) => a - b); const med = ft[12]; ft.length = 0;
    if (med > 0.024 && q > 0.45) { q = Math.max(0.45, q - (med > 0.04 ? 0.2 : 0.12)); cool = 0.7; } else if (med < 0.0135 && q < 1) { q = Math.min(1, q + 0.06); cool = 2.5; } }
  function warm() { for (const m of [comp, down, upM, fin]) { quad.material = m; renderer.compile(qs, oc); } }
  function dispose() { sRT.dispose(); pRT.dispose(); cRT.dispose(); dn.forEach(r => r.dispose()); up.forEach(r => r.dispose()); comp.dispose(); down.dispose(); upM.dispose(); fin.dispose(); }
  return { render, adapt, warm, dispose, sRT, get q() { return q; } };
}

// ── 낮 하늘: uAlt 0(구름 바다 위 한낮) → 1(우주: 검은 하늘 + 얇은 푸른 띠) ──
export function buildDaySky(noise) {
  const U = { uN: { value: noise }, uSun: { value: V(0.3, 0.55, -0.78).normalize() }, uAlt: { value: 0 }, uFly: { value: V() }, uVis: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: "varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }",
    fragmentShader: `${NOISE} uniform vec3 uSun, uFly; uniform float uAlt, uVis; varying vec3 vD;
float clouds(vec2 q){ float a = texture(uN, vec3(q, 0.31)).r, b = texture(uN, vec3(q * 2.3 + 0.1, 0.57)).r, c = texture(uN, vec3(q * 5.1, 0.13)).g; return a * 0.6 + b * 0.28 + c * 0.12; }
void main(){ vec3 d = normalize(vD); float al = uAlt, e = d.y + al * 0.22, s = max(dot(d, uSun), 0.0), g = clamp(e, 0.0, 1.0);
  vec3 c = mix(vec3(0.62, 0.78, 1.0), vec3(0.05, 0.19, 0.6), pow(g, 0.5));
  c += vec3(1.0, 0.94, 0.82) * (pow(s, 7.0) * 0.32 + pow(s, 70.0) * 0.9);
  vec3 sp = vec3(0.0015, 0.0025, 0.008) + vec3(0.1, 0.32, 0.95) * exp(-g * 28.0) * 0.85 + vec3(0.6, 0.8, 1.0) * exp(-g * 90.0) * 0.6 + vec3(1.0, 0.9, 0.8) * pow(s, 60.0) * 0.5;
  c = mix(c, sp, smoothstep(0.04, 0.92, al));
  float below = -e;
  if (below > 0.0005) { float h = mix(1.0, 10.0, al), t = h / max(below, 0.012); vec2 q = d.xz * t * 0.034 + uFly.xz; float n = clouds(q), n2 = clouds(q + uSun.xz * 0.02 / h), den = smoothstep(0.5, 0.7, n);
    float lit = clamp((n - n2) * 9.0 + 0.6, 0.0, 1.0), far = clamp(t * 0.05, 0.0, 1.0);
    vec3 lc = mix(vec3(0.5, 0.58, 0.74), vec3(1.3, 1.28, 1.22), lit) + vec3(1.0, 0.9, 0.7) * pow(s, 4.0) * 0.3;
    vec3 under = mix(vec3(0.12, 0.26, 0.5), vec3(0.42, 0.58, 0.85), far), gc = mix(under, lc, den); float haze = smoothstep(0.06, 0.0, below); gc = mix(gc, c, haze * 0.8 + 0.22 * far);
    gc = mix(gc, vec3(0.03, 0.09, 0.24) + gc * 0.4, smoothstep(0.25, 0.95, al)); c = mix(c, gc, smoothstep(0.0, 0.004, below)); }
  c += vec3(1.7, 1.6, 1.4) * smoothstep(0.9993, 0.99975, s) * 26.0;
  gl_FragColor = vec4(c * uVis, uVis); }` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat); mesh.frustumCulled = false; mesh.renderOrder = -20;
  return { mesh, U, dispose() { mesh.geometry.dispose(); mat.dispose(); } };
}

// ── 부서지는 행성 ──
// 조각 공(화성과 같은 120조각)에 행성 지도를 입힘 · 구슬이 들어간 곳/나온 곳에서 금이 번지고 → 틈이 벌어지며 빛나고 → 터져 조각이 날아가다 천천히 떠다님
let crackRT = null, seedsU = null;
function shardSeeds() { if (seedsU) return seedsU; const g = marsShards(), a = g.attributes.aC, map = new Map(); for (let i = 0; i < a.count; i++) { const k = `${a.getX(i).toFixed(4)},${a.getY(i).toFixed(4)},${a.getZ(i).toFixed(4)}`; if (!map.has(k)) map.set(k, V(a.getX(i), a.getY(i), a.getZ(i))); } seedsU = [...map.values()]; return seedsU; }
function bakeCracks(renderer, noise) { if (crackRT) return crackRT; const S = shardSeeds(), N = S.length;
  const rt = new THREE.WebGLRenderTarget(1024, 512, { type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false, wrapS: THREE.RepeatWrapping });
  const m = new THREE.ShaderMaterial({ uniforms: { uN: { value: noise }, uS: { value: S } }, vertexShader: QV, depthTest: false, depthWrite: false,
    fragmentShader: `${NOISE} ${DIR} uniform vec3 uS[${N}]; varying vec2 vUv; void main(){ vec3 d0 = dirOf(vUv), d = normalize(d0 + (vec3(fbm(d0 * 1.7 + 1.0), fbm(d0 * 1.7 + 5.0), fbm(d0 * 1.7 + 9.0)) - 0.5) * 0.12); float a = -9.0, b = -9.0; for (int i = 0; i < ${N}; i++){ float s = dot(d, uS[i]); if (s > a){ b = a; a = s; } else if (s > b) b = s; } float r = abs(fbm(d0 * 3.1 + 2.0) - 0.5) * 2.0 + abs(fbm(d0 * 7.3 + 4.0) - 0.5) * 0.7; gl_FragColor = vec4(sqrt(clamp((a - b) * 6.0, 0.0, 1.0)), sqrt(clamp(r * 2.2, 0.0, 1.0)), 0.0, 1.0); }` });
  const q = new THREE.Mesh(TRI, m); q.frustumCulled = false; const s = new THREE.Scene(); s.add(q); const cur = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(s, new THREE.Camera()); renderer.setRenderTarget(cur); m.dispose(); crackRT = rt; return rt; }
export function disposeCracks() { if (crackRT) { crackRT.dispose(); crackRT = null; } }

const SHV = `attribute vec4 aC, aR; attribute float aI; uniform float uX, uSep, uShk, uT, uDrift, uBlast; uniform vec3 uImpA, uImpB; varying vec3 vD, vW, vWN; varying float vI, vX;
vec3 rot(vec3 v, vec3 a, float g){ float c = cos(g), s = sin(g); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
void main(){ vec3 p = position, ct = aC.xyz * 0.86, nr = normal; vD = p; vI = aI; float x = uX, sp = aC.w;
  float near = max(max(dot(aC.xyz, uImpA), dot(aC.xyz, uImpB)), 0.0);
  float w = sin(uT * (30.0 + sp * 24.0) + aR.x * 9.0) * uShk; p += aC.xyz * (w * 0.015 + uSep * (0.01 + 0.03 * sp));
  if (x > 0.0) { float g = aR.w * (x * 0.6 + (1.0 - exp(-x * 2.5)) * 2.4); p = ct + rot(p - ct, aR.xyz, g); nr = rot(nr, aR.xyz, g);
    float v = sp * (1.0 + 1.6 * near * near) * uBlast; p += aC.xyz * ((1.0 - exp(-x * 2.0)) * 1.7 * v + x * uDrift * v); }
  vX = x; vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vWN = normalize(mat3(modelMatrix) * nr); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const SHF = `${NOISE} ${UVOF} uniform sampler2D uM, uK; uniform vec3 uSun, uLC, uImpA, uImpB, uHot, uTint, uRim, uAmb; uniform float uGam, uFrA, uFrB, uHeat, uT, uFade, uGas, uCloud;
varying vec3 vD, vW, vWN; varying float vI, vX;
vec3 ramp(float k){ k = clamp(k, 0.0, 1.0); vec3 c = mix(uHot * 0.12, uHot * 1.6, smoothstep(0.0, 0.42, k)); c = mix(c, uHot * 3.2 + vec3(0.6, 0.3, 0.1), smoothstep(0.38, 0.72, k)); return mix(c, vec3(8.0, 7.2, 6.0), smoothstep(0.7, 1.0, k)); }
void main(){ vec3 d = normalize(vD), n = normalize(vWN); float ex = vX, cool = exp(-ex * (uGas > 0.5 ? 1.3 : 0.9)), crk = exp(-ex * 3.5); vec3 c;
  float lg = dot(n, uSun);
  if (vI > 0.5) { float dep = clamp((1.0 - length(vD)) / 0.7, 0.0, 1.0), k = min(0.4, (0.1 + 0.32 * uHeat) * cool * dep * dep); vec3 rk = uGas > 0.5 ? uHot * 0.06 + vec3(0.025) : vec3(0.06, 0.045, 0.035);
    c = rk * (0.25 + max(lg, 0.0) * 1.6) + ramp(k) * smoothstep(0.02, 0.3, k); }
  else { vec2 uv = uvOf(d); vec4 m = texture2D(uM, uv); vec3 alb = (uGam > 0.5 ? pow(m.rgb, vec3(2.2)) : m.rgb) * uTint;
    if (uCloud > 0.5) { vec3 q = d * 0.8; vec3 qw = q + (vec3(fbm(q * 1.3 + 3.0), fbm(q * 1.3 + 7.0), fbm(q * 1.3 + 11.0)) - 0.68) * 0.7; float cn = fbm(qw) * 0.66 + texture(uN, qw * 4.1 + 0.2).r * 0.22 + texture(uN, qw * 9.0).g * 0.12; alb = mix(alb, vec3(0.92, 0.94, 0.98), smoothstep(0.68, 0.9, cn) * 0.9); }
    float mu = max(dot(n, normalize(cameraPosition - vW)), 0.0);
    float lit = uGas > 0.5 ? smoothstep(-0.12, 0.5, lg) * (0.25 + 0.75 * clamp(lg, 0.0, 1.0)) * (0.55 + 0.45 * pow(mu, 0.35)) : max(lg, 0.0) * smoothstep(-0.05, 0.12, lg);
    c = alb * uLC * lit + alb * uAmb * (0.4 + 0.6 * mu);
    float aA = acos(clamp(dot(d, uImpA), -1.0, 1.0)), aB = acos(clamp(dot(d, uImpB), -1.0, 1.0)), on = max(smoothstep(uFrA, uFrA - 0.3, aA), smoothstep(uFrB, uFrB - 0.3, aB));
    vec2 kk = texture2D(uK, uv).rg; float e = kk.x * kk.x, e2 = kk.y * kk.y, wd = 0.01 + uHeat * uHeat * 0.04, cr = smoothstep(wd, wd * 0.2, e) * on, c2 = smoothstep(0.012 + uHeat * 0.02, 0.003, e2) * on * smoothstep(0.1, 0.5, uHeat) * smoothstep(0.1, 0.0, e);
    c = mix(c, ramp(0.24 + uHeat * 0.17), max(cr, c2 * 0.8) * crk);
    c += ramp(uHeat * 0.4) * smoothstep(wd * 5.0, 0.0, e) * on * uHeat * 0.3 * crk;
    float hole = max(exp(-aA * aA / 0.006), exp(-aB * aB / 0.012)) * min(uFrA * 4.0, 1.0); c = mix(c, ramp(0.55), hole * crk);
    c += uRim * pow(1.0 - mu, 3.0) * clamp(lg * 1.4 + 0.45, 0.0, 1.0) * (ex > 0.0 ? 0.0 : 0.55); }
  gl_FragColor = vec4(c * uFade, uFade); }`;
// o: { map(Texture), gamma, gas, cloud, hot(Color), tint, rim, blast(조각 날아가는 세기), drift(떠다니는 빠르기) }
export function shardPlanet(renderer, noise, o) {
  const K = bakeCracks(renderer, noise);
  const U = { uN: { value: noise }, uM: { value: o.map }, uK: { value: K.texture }, uSun: { value: V(0, 0, 1) }, uLC: { value: new THREE.Color(2.2, 2.1, 2.0) }, uAmb: { value: new THREE.Color(0.012, 0.014, 0.02) }, uImpA: { value: V(0, 0, 1) }, uImpB: { value: V(0, 0, -1) },
    uHot: { value: o.hot || new THREE.Color(1.4, 0.36, 0.06) }, uTint: { value: o.tint || new THREE.Color(1, 1, 1) }, uRim: { value: o.rim || new THREE.Color(0.4, 0.5, 0.8) }, uGam: { value: o.gamma ? 1 : 0 }, uFrA: { value: 0 }, uFrB: { value: 0 }, uHeat: { value: 0 }, uT: { value: 0 }, uFade: { value: 1 },
    uGas: { value: o.gas ? 1 : 0 }, uCloud: { value: o.cloud ? 1 : 0 }, uX: { value: 0 }, uSep: { value: 0 }, uShk: { value: 0 }, uDrift: { value: o.drift == null ? 0.05 : o.drift }, uBlast: { value: o.blast || 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SHV, fragmentShader: SHF });
  mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  const mesh = new THREE.Mesh(marsShards(), mat); mesh.frustumCulled = false;
  return { mesh, U, dispose() { mat.dispose(); } };
}
// 금 덮개: 멀쩡한 행성(원래 셰이더) 위에 살짝 크게 씌워 빛나는 금만 더함 (터지기 전까지)
export function crackShell(renderer, noise) {
  const K = bakeCracks(renderer, noise);
  const U = { uN: { value: noise }, uK: { value: K.texture }, uImpA: { value: V(0, 0, 1) }, uImpB: { value: V(0, 0, -1) }, uFrA: { value: 0 }, uFrB: { value: 0 }, uHeat: { value: 0 }, uHot: { value: new THREE.Color(1.4, 0.36, 0.06) }, uA: { value: 1 } };
  const mat = addBlend(new THREE.ShaderMaterial({ uniforms: U, vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `${NOISE} ${UVOF} uniform sampler2D uK; uniform vec3 uImpA, uImpB, uHot; uniform float uFrA, uFrB, uHeat, uA; varying vec3 vD;
vec3 ramp(float k){ k = clamp(k, 0.0, 1.0); vec3 c = mix(uHot * 0.12, uHot * 1.6, smoothstep(0.0, 0.42, k)); c = mix(c, uHot * 3.2 + vec3(0.6, 0.3, 0.1), smoothstep(0.38, 0.72, k)); return mix(c, vec3(8.0, 7.2, 6.0), smoothstep(0.7, 1.0, k)); }
void main(){ vec3 d = normalize(vD); vec2 uv = uvOf(d); float aA = acos(clamp(dot(d, uImpA), -1.0, 1.0)), aB = acos(clamp(dot(d, uImpB), -1.0, 1.0)), on = max(smoothstep(uFrA, uFrA - 0.3, aA), smoothstep(uFrB, uFrB - 0.3, aB));
  vec2 kk = texture2D(uK, uv).rg; float e = kk.x * kk.x, e2 = kk.y * kk.y, wd = 0.01 + uHeat * uHeat * 0.045, cr = smoothstep(wd, wd * 0.2, e) * on, c2 = smoothstep(0.012 + uHeat * 0.02, 0.003, e2) * on * smoothstep(0.1, 0.5, uHeat) * smoothstep(0.1, 0.0, e);
  vec3 c = ramp(0.24 + uHeat * 0.2) * max(cr, c2 * 0.8) + ramp(uHeat * 0.35) * smoothstep(wd * 4.0, 0.0, e) * on * uHeat * 0.14;
  float hole = max(exp(-aA * aA / 0.006), exp(-aB * aB / 0.012)) * min(uFrA * 4.0, 1.0); c += ramp(0.6) * hole * 1.2;
  gl_FragColor = vec4(c * uA, 0.0); }` }));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 64), mat); mesh.frustumCulled = false; mesh.renderOrder = 2;
  return { mesh, U, dispose() { mesh.geometry.dispose(); mat.dispose(); } };
}

// ── 평면 충격 고리 (잡음 섞인 불꽃 띠가 퍼짐) ──
export function shockRing(noise) {
  const U = { uN: { value: noise }, uR: { value: 0 }, uA: { value: 0 }, uC: { value: new THREE.Color(1.6, 0.6, 0.2) }, uC2: { value: new THREE.Color(2.6, 2.2, 1.6) } };
  const m = addBlend(new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `precision highp sampler3D; uniform sampler3D uN; uniform float uR, uA; uniform vec3 uC, uC2; varying vec2 vP; void main(){ float r = length(vP), a = atan(vP.y, vP.x), n = texture(uN, vec3(cos(a) * 0.6, sin(a) * 0.6, r * 1.6)).r, w = 0.04 + 0.09 * n, d = (r - uR) / w, band = exp(-d * d * 2.4) + exp(-pow(max(uR - r, 0.0) * 3.2, 1.2)) * 0.25 * step(r, uR); float al = band * uA * smoothstep(1.0, 0.86, r) * (0.55 + 0.8 * n); vec3 c = mix(uC, uC2, exp(-d * d * 7.0)); gl_FragColor = vec4(c * al, 0.0); }` }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;
  return { mesh, U, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}
// ── 둥근 충격파 껍질 (가장자리가 빛나는 공) ──
export function shockShell() {
  const U = { uA: { value: 0 }, uC: { value: new THREE.Color(1.2, 0.8, 0.5) } };
  const m = addBlend(new THREE.ShaderMaterial({ uniforms: U, vertexShader: "varying vec3 vN, vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: "uniform float uA; uniform vec3 uC; varying vec3 vN, vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 3.0) * uA; gl_FragColor = vec4(uC * a, 0.0); }" }));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), m); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
  return { mesh, U, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}

// ── 돌 부스러기 (인스턴스): 터질 때 뿌려지고 천천히 돌며 떠다님 ──
const hh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }, sm3 = t => t * t * (3 - 2 * t);
function n3(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm3(x - xi), v = sm3(y - yi), w = sm3(z - zi); let r = 0; for (let k = 0; k < 8; k++) { const a = k & 1, b = (k >> 1) & 1, c = k >> 2; r += hh(xi + a, yi + b, zi + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w); } return r; }
let ROCK = null;
function rockGeo() { if (ROCK) return ROCK; const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)).normalize(); let h = 0; for (let o = 0, f = 1.4, a = 0.34; o < 4; o++, f *= 2.1, a *= 0.48) h += (n3(v.x * f + 3, v.y * f + 7, v.z * f + 1) - 0.5) * a; v.multiplyScalar(1 + h).multiply(V(1, 0.72, 0.86)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return (ROCK = g); }
export function rockField(N) {
  const U = { uHeat: { value: 0 } };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.02 });
  m.onBeforeCompile = sh => { sh.uniforms.uHeat = U.uHeat; sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uHeat;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(2.4, 0.7, 0.12) * uHeat * (0.4 + 0.6 * vColor.r);"); };
  m.customProgramCacheKey = () => "sunRock";
  const mesh = new THREE.InstancedMesh(rockGeo(), m, N); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const P = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(), c = new THREE.Color();
  return { mesh, U, P,
    add(p, v, r, col, w) { if (P.length >= N) return; P.push({ p: p.clone(), v: v.clone(), r, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)), ax: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), w: w == null ? (Math.random() - 0.5) * 3 : w, col: col.clone(), drag: 1.6 + Math.random() }); },
    step(dt, drift = 0.02) { const tq = new THREE.Quaternion(); for (let i = 0; i < P.length; i++) { const a = P[i], sp = a.v.length(), dr = Math.exp(-a.drag * dt); if (sp > drift * 40) a.v.multiplyScalar(dr); a.p.addScaledVector(a.v, dt); a.q.multiply(tq.setFromAxisAngle(a.ax, a.w * dt)); m4.compose(a.p, a.q, s.setScalar(a.r)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, a.col); } mesh.count = P.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
    clear() { P.length = 0; mesh.count = 0; },
    dispose() { m.dispose(); mesh.dispose(); } };
}

// ── 끓는 태양 겉면 (별 위에 덧씌움 · 다 덮으면 별 대신 보임): 쌀알무늬가 빠르게 끓고 거품처럼 부풀었다 꺼짐 · 구슬이 들어간 곳에서 물결 · uBoil 0 → 1 ──
export function boilShell(noise) {
  const U = { uN: { value: noise }, uT: { value: 0 }, uBoil: { value: 0 }, uA: { value: 0 }, uI: { value: 1 }, uPop: { value: V(0, 1, 0) }, uPopK: { value: 0 }, uPopR: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `${NOISE} uniform float uT, uBoil, uPopK, uPopR; uniform vec3 uPop; varying vec3 vD, vN, vW; varying float vH, vC;
void main(){ vec3 d = normalize(position); float t = uT;
  float b = texture(uN, d * 1.4 + vec3(0.0, t * 0.16, t * 0.11)).r, b2 = texture(uN, d * 3.2 - vec3(t * 0.22, 0.0, t * 0.17)).r;
  float bub = (smoothstep(0.55, 0.9, b) * 0.65 + smoothstep(0.6, 0.92, b2) * 0.35) * uBoil * (0.6 + 0.4 * sin(t * 7.0 + b * 20.0));
  float ang = acos(clamp(dot(d, uPop), -1.0, 1.0)), rip = exp(-pow((ang - uPopR) / 0.045, 2.0)) * uPopK + exp(-pow(ang / 0.06, 2.0)) * uPopK * 0.8;
  float h = bub + rip; vH = h; vC = b2; vD = d; vec3 p = d * (1.0 + h * 0.045); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * d); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${NOISE} ${BB} uniform float uT, uBoil, uA, uI; varying vec3 vD, vN, vW; varying float vH, vC;
void main(){ vec3 v = normalize(cameraPosition - vW); float mu = max(dot(normalize(vN), v), 0.0), t = uT;
  float g = texture(uN, vD * 7.0 + vec3(t * (0.05 + 0.4 * uBoil), 0.0, t * 0.03)).r, g2 = texture(uN, vD * 17.0 - vec3(0.0, t * (0.08 + 0.7 * uBoil), 0.0)).r;
  float cells = smoothstep(0.42, 0.9, g * 0.6 + g2 * 0.4), lanes = 1.0 - smoothstep(0.25, 0.5, g * 0.6 + g2 * 0.4);
  float k = 0.36 + 0.12 * cells + 0.22 * vH; vec3 c = bb(k) * uI * (0.78 + 0.55 * cells - 0.4 * lanes * (0.4 + 0.6 * uBoil) + 1.3 * vH);
  c *= 0.36 + 0.64 * pow(mu, 0.5); c *= mix(vec3(1.0, 0.6, 0.35), vec3(1.0), smoothstep(0.0, 0.5, mu));
  gl_FragColor = vec4(c * uA, uA); }` });
  m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.003, 192, 120), m); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
  return { mesh, U, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}

// ── 플라스마 재질 (태양에서 솟는 손 · 홍염 고리): 피부 대신 이글거리는 불꽃 · 뼈대 손에도 그대로 씀 ──
export function plasmaMat(noise) {
  const U = { uN: { value: noise }, uT: { value: 0 }, uA: { value: 1 }, uScale: { value: 1 } };
  const m = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0, emissive: 0xffffff });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN;").replace("#include <project_vertex>", "#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\n${NOISE}\n${BB}\nvarying vec3 vWP; varying vec3 vWN; uniform float uT, uA, uScale;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
 { vec3 q = vWP / uScale; vec3 vv = normalize(cameraPosition - vWP); float mu = abs(dot(normalize(vWN), vv));
   float f1 = fbm(q * 0.9 + vec3(0.0, -uT * 0.6, uT * 0.2)), f2 = fbm(q * 2.3 + vec3(uT * 0.3, -uT * 1.1, 0.0) + f1);
   float k = 0.2 + 0.34 * f2 + 0.1 * pow(1.0 - mu, 2.0); vec3 pc = bb(k) * (0.32 + 0.62 * smoothstep(0.5, 0.9, f2) + 0.2 * f1) + bb(0.22) * pow(1.0 - mu, 3.0) * 0.6;
   totalEmissiveRadiance = pc * uA; diffuseColor.rgb = vec3(0.0); }`); };
  m.customProgramCacheKey = () => "sunPlasma";
  return { mat: m, U };
}
