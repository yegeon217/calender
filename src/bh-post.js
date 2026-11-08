// 블랙홀 연출의 화면 마무리
// 장면(행성·별·조각)을 HDR로 그림 → 화면마다 빛의 길을 따라가며 블랙홀이 빛을 굽힘(슈바르츠실트) + 강착원반(도플러·중력 적색편이) + 하늘(별·은하수·성운)
// → 밝은 곳 번짐(블룸) → 충격파 일렁임 · 색 갈라짐 → 톤 → 화면.
// 블랙홀 계산 단위: 사건의 지평선 반지름 Rs = 1. 광자구 1.5, 원반 안쪽 끝(ISCO) 3.
import * as THREE from "three";

const TRI = new THREE.BufferGeometry(); TRI.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); TRI.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const QV = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

const COMMON = `
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 rotA(vec3 v, vec3 a, float g){ float c = cos(g), s = sin(g); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
// 온도 → 빛깔 (0 검붉음 · 0.5 주황 · 0.8 흰빛 노랑 · 1 흰색 · 1.5 푸름)
vec3 bb(float k){ k = max(k, 0.0); vec3 c = vec3(1.0, 0.16, 0.02) * smoothstep(0.0, 0.22, k);
  c = mix(c, vec3(1.0, 0.5, 0.14), smoothstep(0.14, 0.42, k)); c = mix(c, vec3(1.0, 0.84, 0.62), smoothstep(0.38, 0.74, k));
  c = mix(c, vec3(0.94, 0.96, 1.0), smoothstep(0.7, 1.04, k)); return mix(c, vec3(0.6, 0.72, 1.0), smoothstep(1.04, 1.7, k)); }`;

const COMP = `precision highp float; precision highp sampler3D;
uniform sampler2D uS, uZ; uniform sampler3D uN;
uniform mat4 uPI, uVI, uVP, uV; uniform vec3 uCam; uniform float uNear, uFar, uPx0;
uniform vec3 uBH, uDN, uDX, uDY; uniform float uRs, uZBH, uDisk, uDForm, uDOut, uT, uHeat, uFlare, uSpin, uDB;
uniform float uSky, uNeb, uSuck, uSw; uniform vec3 uSC, uNG, uGC; uniform mat3 uSR;
varying vec2 vUv;
${COMMON}
float nz(vec3 p){ return texture(uN, p).r; }
float fbm3(vec3 p){ return nz(p) * 0.55 + nz(p * 2.03 + 0.17) * 0.28 + nz(p * 4.1 + 0.41) * 0.17; }
float viewZ(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
// 별 한 겹: 육면체 면을 칸으로 나눠 칸마다 별 하나 (화소 크기에 맞춰 번지게 해서 계단 없이)
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
  c += mix(vec3(1.0, 0.16, 0.3), vec3(0.16, 0.6, 0.72), smoothstep(0.55, 0.8, n2)) * ne * 0.1 * uNeb;
  c += starL(d, 54.0, 7.0, px, 7.0, 1.0) + starL(d, 170.0, 12.0, px, 3.4, 2.0) + starL(d, 480.0, 2.6, px, 0.42, 3.0);
  return c;
}
// 빨려 들어감(uSuck 0→1): 하늘이 한 점(uSC)으로 오그라들며 소용돌이 · 빅뱅 때는 거꾸로
vec3 suckMap(vec3 d){ if (uSuck <= 0.0) return d; float th = acos(clamp(dot(d, uSC), -1.0, 1.0)), th0 = th / max(1.0 - uSuck, 1e-3); if (th0 > 3.1415) return vec3(0.0);
  vec3 ax = cross(uSC, d); float l = length(ax); if (l < 1e-6) return uSC; ax /= l; return rotA(rotA(uSC, ax, th0), uSC, uSw * uSuck / (th + 0.06)); }
// 강착원반 한 점의 빛 (q: 원반 위의 점, v: 빛이 오는 방향의 반대)
vec4 disk(vec3 q, vec3 v){
  float rr = length(q), rin = 3.0 * mix(1.7, 1.0, uDForm); if (rr < rin * 0.8 || rr > uDOut) return vec4(0.0);
  float x = dot(q, uDX), y = dot(q, uDY), ph = atan(y, x);
  float om = uSpin * 6.5 / pow(rr, 1.5), P = 3.2, t1 = fract(uT / P), t2 = fract(uT / P + 0.5), w1 = 1.0 - abs(t1 * 2.0 - 1.0);
  float a1 = ph - om * t1 * P, a2 = ph - om * t2 * P, s = rr * 0.075;
  float n1 = fbm3(vec3(cos(a1) * s, sin(a1) * s, rr * 0.045)), n2 = fbm3(vec3(cos(a2) * s, sin(a2) * s, rr * 0.045 + 0.37));
  float n = mix(n2, n1, w1), fine = nz(vec3(cos(a1) * s * 4.0, sin(a1) * s * 4.0, rr * 0.3)) * w1 + nz(vec3(cos(a2) * s * 4.0, sin(a2) * s * 4.0, rr * 0.3 + 0.5)) * (1.0 - w1);
  float prof = smoothstep(rin * 0.85, rin * 1.25, rr) * (1.0 - smoothstep(uDOut * 0.45, uDOut, rr));
  float dens = prof * (0.28 + 1.25 * smoothstep(0.5, 0.9, n) + 0.3 * (fine - 0.6)) * (0.85 + 0.15 * sin(rr * 7.0 + n * 6.0));
  // 생기는 중: 나선 팔로 흘러들어옴
  float arm = 0.5 + 0.5 * sin(2.0 * ph + 5.5 * uSpin * log(rr) - uT * 3.0 * uSpin + n * 3.0); dens *= mix(smoothstep(0.35, 0.95, arm) * 1.4, 1.0, uDForm);
  // 도플러 · 중력 적색편이
  vec3 vd = normalize(cross(uDN, q)) * uSpin; float be = clamp(sqrt(0.5 / max(rr - 1.0, 0.4)), 0.0, 0.62), ga = 1.0 / sqrt(1.0 - be * be);
  float D = 1.0 / (ga * (1.0 - be * dot(vd, -normalize(v)))), g = D * sqrt(max(1.0 - 1.0 / rr, 0.02));
  float Tp = pow(rin / rr, 0.75) * pow(max(1.0 - sqrt(rin / rr), 0.0), 0.25) * 2.05;   // 가장 뜨거운 곳 ≈ 1
  vec3 col = bb((0.2 + 0.6 * Tp) * g * uHeat) * (0.18 + 1.5 * Tp) * pow(g, 2.1) * (1.0 + uFlare) * uDB;
  float a = clamp(dens * 1.15, 0.0, 0.96) * uDisk;
  return vec4(col * (0.75 + 0.5 * n), a);
}
void main(){
  vec4 cp = uPI * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 d0 = normalize((uVI * vec4(cp.xyz / cp.w, 0.0)).xyz);
  vec4 fg = texture(uS, vUv); float z0 = viewZ(texture(uZ, vUv).r);
  vec3 d1 = d0, emit = vec3(0.0), pE = vec3(0.0), emA = vec3(0.0); float tr = 1.0, cap = 0.0, trA = 1.0, zDA = 1e9;
  if (uRs > 0.0) {
    vec3 ro = (uCam - uBH) / uRs; float RB = 60.0, sC = dot(ro, d0); vec3 perp = ro - d0 * sC; float pb = max(length(perp), 1e-3), dd = dot(ro, ro); vec3 nIn = -perp / pb;
    bool inside = dd < RB * RB; float tE = -1.0; if (!inside) { float h = sC * sC - (dd - RB * RB); if (h > 0.0 && sC < 0.0) tE = -sC - sqrt(h); }
    pE = ro + d0 * max(-sC, 0.0);
    if (!inside && tE < 0.0) { float a = (1.0 - sC / sqrt(pb * pb + sC * sC)) / pb; d1 = normalize(d0 * cos(a) + nIn * sin(a)); }
    else {
      vec3 p = ro, v = d0;
      if (!inside) { p = ro + d0 * tE; float sE = dot(p, d0), a = (sE / sqrt(pb * pb + sE * sE) - sC / sqrt(pb * pb + sC * sC)) / pb; v = normalize(d0 * cos(a) + nIn * sin(a)); }
      vec3 L = cross(p, v); float h2 = dot(L, L), y0 = dot(p, uDN), rmin = 1e9;
      for (int i = 0; i < 170; i++) {
        float r = length(p); if (r < 1.0) { cap = 1.0; break; } if (r < rmin) { rmin = r; pE = p; emA = emit; trA = tr; }
        float dt = clamp(0.075 * r * mix(0.55, 1.0, smoothstep(2.0, 6.0, r)), 0.012, 3.5);
        v += -1.5 * h2 * p / pow(r, 5.0) * dt; p += v * dt;
        float y1 = dot(p, uDN);
        if (uDisk > 0.0) {
          if (y0 * y1 < 0.0) { vec3 q = p - v * dt * (y1 / (y1 - y0)); vec4 e = disk(q - uDN * dot(q, uDN), v); emit += tr * e.rgb * e.a; tr *= 1.0 - e.a; if (zDA > 1e8 && e.a > 0.02) zDA = -(uV * vec4(uBH + q * uRs, 1.0)).z; }
          // 원반의 두께: 면 가까이를 스칠 때 흐린 빛
          float rr = length(p - uDN * y1), th = 0.06 * rr; float gl = exp(-y1 * y1 / (th * th)) * smoothstep(3.0, 4.6, rr) * (1.0 - smoothstep(uDOut * 0.4, uDOut, rr));
          emit += tr * bb(0.62 * uHeat * pow(3.0 / rr, 0.6)) * gl * dt * 0.009 * uDisk * (1.0 + uFlare) * uDB;
        }
        y0 = y1; if (tr < 0.01) break;
        if (r > RB && dot(p, v) > 0.0) break;
      }
      d1 = normalize(v);
      if (cap < 0.5) { vec3 L2 = cross(p, d1); float pb2 = max(length(L2), 1e-3), sX = dot(p, d1), a = (1.0 - sX / sqrt(pb2 * pb2 + sX * sX)) / pb2; vec3 n2 = -(p - d1 * sX) / pb2; d1 = normalize(d1 * cos(a) + n2 * sin(a)); }
    }
  }
  vec3 ds = suckMap(d1); float px = length(fwidth(ds)) + 1e-6;
  vec3 bg = (uSky > 0.0 && dot(ds, ds) > 0.5) ? sky(uSR * ds, px) * uSky : vec3(0.0);
  vec3 col;
  if (uRs > 0.0) {
    vec4 c1 = uVP * vec4(d1, 0.0); vec2 u1 = c1.xy / c1.w * 0.5 + 0.5;
    // 블랙홀 가까이 있는 물체: 무한히 먼 곳이 아니라, 휜 빛이 그 물체 깊이에 닿는 자리를 봄 (가까운 별이 거대한 고리로 번지지 않게)
    // 빛은 블랙홀에 가장 가까이 간 곳(pE)에서 꺾인다고 보고: 그 뒤 물체는 꺾인 방향으로 그 깊이까지 간 자리
    vec3 PE = uBH + pE * uRs; float zP = -(uV * vec4(PE, 1.0)).z, zd = -(uV * vec4(d1, 0.0)).z;
    float zg = (z0 > zP && z0 < uFar * 0.5) ? z0 : -1.0;   // 첫 짐작: 이 화소에 원래 보이던 물체의 깊이
    if (c1.w > 0.0 && zd > 1e-3) for (int k = 0; k < 2; k++) { float zk = (k == 0 && zg > 0.0) ? zg : viewZ(texture(uZ, clamp(u1, 0.001, 0.999)).r); if (zk > uFar * 0.5) zk = zP + 2.0;   // 깊이를 안 남기는 빛(입자·빛무리)은 블랙홀 바로 뒤에 있다고 봄
      if (zk > zP) { vec4 c2 = uVP * vec4(PE + d1 * ((zk - zP) / zd), 1.0); if (c2.w > 1e-3) u1 = c2.xy / c2.w * 0.5 + 0.5; } }
    if (c1.w > 0.0) { float ew = smoothstep(0.0, 0.14, min(min(u1.x, 1.0 - u1.x), min(u1.y, 1.0 - u1.y))); vec2 uc = clamp(u1, 0.001, 0.999); vec4 s1 = texture(uS, uc); float z1 = viewZ(texture(uZ, uc).r), bh = smoothstep(zP * 0.955, zP * 0.985, z1) * ew; bg = s1.rgb * bh + bg * (1.0 - s1.a * bh); }
    vec3 behind = cap > 0.5 ? emit : emit + tr * bg;
    // 빛이 꺾이기 전(블랙홀에 가장 가까이 가기 전)에 닿는 물체는 휘지 않고 그대로 보임 · 가까운 쪽 원반보다 앞이면 원반을 가리고, 뒤면 원반 빛이 그 위에 덮임
    float isF = 1.0 - smoothstep(zP * 0.985, zP * 1.015, z0), nearD = 1.0 - smoothstep(zDA * 0.995, zDA * 1.005, z0);
    vec3 rest = (behind - emA) / max(trA, 1e-3), over = fg.rgb + (1.0 - fg.a) * behind, under = emA + trA * (fg.rgb + (1.0 - fg.a) * rest);
    col = mix(behind, mix(under, over, nearD), isF);
  } else col = fg.rgb + bg * (1.0 - fg.a);
  gl_FragColor = vec4(col, 1.0);
}`;

// 번짐: 13점 내려받기(첫 단계는 밝은 곳만) · 9점 올리기
const DOWN = `precision highp float; uniform sampler2D uT; uniform vec2 uPx; uniform float uTh; varying vec2 vUv;
vec3 s(vec2 o){ return texture(uT, vUv + o * uPx).rgb; }
void main(){ vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2)), d = s(vec2(-2, 0)), e = s(vec2(0)), f = s(vec2(2, 0)), g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2)), j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uTh > 0.0) { float br = max(o.r, max(o.g, o.b)), sk = clamp(br - uTh * 0.6, 0.0, uTh * 0.8); sk = sk * sk / (uTh * 3.2 + 1e-4); o *= max(sk, br - uTh) / max(br, 1e-4); o = min(o, vec3(60.0)); }
  gl_FragColor = vec4(o, 1.0); }`;
const UP = `precision highp float; uniform sampler2D uT, uB; uniform vec2 uPx; varying vec2 vUv;
void main(){ vec3 o = texture(uT, vUv).rgb * 4.0; o += (texture(uT, vUv + vec2(uPx.x, 0)).rgb + texture(uT, vUv - vec2(uPx.x, 0)).rgb + texture(uT, vUv + vec2(0, uPx.y)).rgb + texture(uT, vUv - vec2(0, uPx.y)).rgb) * 2.0;
  o += texture(uT, vUv + uPx).rgb + texture(uT, vUv - uPx).rgb + texture(uT, vUv + vec2(uPx.x, -uPx.y)).rgb + texture(uT, vUv + vec2(-uPx.x, uPx.y)).rgb; gl_FragColor = vec4(o / 16.0 + texture(uB, vUv).rgb, 1.0); }`;
const FINAL = `precision highp float; uniform sampler2D uC, uB; uniform float uBloom, uExpo, uFlash, uFade, uCA, uShR, uShA, uAsp, uT, uVig, uGrain, uTM; uniform vec2 uShC; uniform vec3 uFlashC; varying vec2 vUv;
vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537, b = v * (0.983729 * v + 0.432951) + 0.238081; return a / b; }
vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719, 0.076, 0.0284), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); return clamp(O * fit(I * (c * uExpo / 0.6)), 0.0, 1.0); }
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){ vec2 uv = vUv, dv = uv - uShC; dv.x *= uAsp; float r = length(dv) + 1e-5;
  // 충격파: 고리 안쪽은 바깥으로 밀리고 고리 위는 빛남
  float ring = 0.0; if (uShA > 0.0) { float w = (r - uShR) / (0.03 + uShR * 0.035); ring = exp(-w * w) * uShA; uv -= dv / r * vec2(1.0 / uAsp, 1.0) * ring * 0.035 * sign(w + 0.3); }
  vec2 ca = (uv - 0.5) * uCA * 0.012;
  vec3 c = vec3(texture(uC, uv + ca).r, texture(uC, uv).g, texture(uC, uv - ca).b) + texture(uB, uv).rgb * uBloom;
  c += uFlashC * uFlash + vec3(0.85, 0.9, 1.0) * ring * 0.55;
  c = mix(clamp(c, 0.0, 1.0), aces(c), uTM);
  float vg = 1.0 - uVig * smoothstep(0.45, 1.25, length((vUv - 0.5) * vec2(uAsp, 1.0)) / max(uAsp, 1.0) * 1.4); c *= vg;
  c = mix(c, vec3(0.0), uFade);
  c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  c += (h12(gl_FragCoord.xy + fract(uT) * 517.0) - 0.5) * (1.6 / 255.0 + uGrain);
  gl_FragColor = vec4(c, 1.0); }`;

export function buildPost(X, noise) {
  const { renderer } = X, mobile = Math.min(X.vw, X.vh) < 700;
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), qs = new THREE.Scene(), quad = new THREE.Mesh(TRI, null); quad.frustumCulled = false; qs.add(quad);
  const ht = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const sRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4, depthTexture: new THREE.DepthTexture(4, 4) });
  const cRT = new THREE.WebGLRenderTarget(4, 4, ht), NB = 6, dn = [], up = [];
  for (let i = 0; i < NB; i++) { dn.push(new THREE.WebGLRenderTarget(4, 4, ht)); up.push(new THREE.WebGLRenderTarget(4, 4, ht)); }
  const CU = { uS: { value: sRT.texture }, uZ: { value: sRT.depthTexture }, uN: { value: noise }, uPI: { value: new THREE.Matrix4() }, uVI: { value: new THREE.Matrix4() }, uVP: { value: new THREE.Matrix4() }, uV: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uPx0: { value: 0.0006 },
    uBH: { value: new THREE.Vector3() }, uDN: { value: new THREE.Vector3(0, 1, 0) }, uDX: { value: new THREE.Vector3(1, 0, 0) }, uDY: { value: new THREE.Vector3(0, 0, 1) }, uRs: { value: 0 }, uZBH: { value: 1 }, uDisk: { value: 0 }, uDForm: { value: 1 }, uDOut: { value: 15 }, uT: { value: 0 }, uHeat: { value: 1 }, uFlare: { value: 0 }, uSpin: { value: 1 }, uDB: { value: 1 },
    uSky: { value: 1 }, uNeb: { value: 1 }, uSuck: { value: 0 }, uSw: { value: 0 }, uSC: { value: new THREE.Vector3(0, 0, -1) }, uNG: { value: new THREE.Vector3(0.28, 0.86, 0.42).normalize() }, uGC: { value: new THREE.Vector3() }, uSR: { value: new THREE.Matrix3() } };
  CU.uGC.value.set(0.9, 0, 0.43).cross(CU.uNG.value).normalize();
  const comp = new THREE.ShaderMaterial({ uniforms: CU, vertexShader: QV, fragmentShader: COMP, depthTest: false, depthWrite: false });
  const DU = { uT: { value: null }, uPx: { value: new THREE.Vector2() }, uTh: { value: 0 } }, down = new THREE.ShaderMaterial({ uniforms: DU, vertexShader: QV, fragmentShader: DOWN, depthTest: false, depthWrite: false });
  const UU = { uT: { value: null }, uB: { value: null }, uPx: { value: new THREE.Vector2() } }, upM = new THREE.ShaderMaterial({ uniforms: UU, vertexShader: QV, fragmentShader: UP, depthTest: false, depthWrite: false });
  const FU = { uC: { value: cRT.texture }, uB: { value: null }, uBloom: { value: 0.62 }, uExpo: { value: 1.05 }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 0 }, uCA: { value: 0 }, uShR: { value: 0 }, uShA: { value: 0 }, uShC: { value: new THREE.Vector2(0.5, 0.5) }, uAsp: { value: 1 }, uT: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0 }, uTM: { value: 1 } };
  const fin = new THREE.ShaderMaterial({ uniforms: FU, vertexShader: QV, fragmentShader: FINAL, depthTest: false, depthWrite: false, toneMapped: false });
  const pass = (m, rt) => { quad.material = m; renderer.setRenderTarget(rt); renderer.render(qs, oc); };
  let q = mobile ? 0.85 : 1, W = 0, H = 0;
  function size() { const b = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(4, Math.round(b.x * q)), h = Math.max(4, Math.round(b.y * q)); if (w === W && h === H) return; W = w; H = h;
    sRT.setSize(w, h); cRT.setSize(w, h); for (let i = 0; i < NB; i++) { const s = 2 ** (i + 1); dn[i].setSize(Math.max(2, Math.round(w / s)), Math.max(2, Math.round(h / s))); up[i].setSize(Math.max(2, Math.round(w / s)), Math.max(2, Math.round(h / s))); }
    FU.uAsp.value = w / h; }
  size();
  const bh = new THREE.Vector3(), tmp = new THREE.Vector3(), m4 = new THREE.Matrix4();
  // P: { rs, bh(월드), dn(원반 축), disk, dform, dout, heat, flare, spin, sky, neb, suck, sw, sc(방향), sr(Matrix3) }
  function render(scene, cam, P, t) {
    size(); cam.updateMatrixWorld(); const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(sRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(scene, cam);
    CU.uPI.value.copy(cam.projectionMatrixInverse); CU.uVI.value.copy(cam.matrixWorld); CU.uVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); CU.uV.value.copy(cam.matrixWorldInverse); CU.uCam.value.setFromMatrixPosition(cam.matrixWorld); CU.uNear.value = cam.near; CU.uFar.value = cam.far;
    CU.uPx0.value = (2 * Math.tan(cam.fov * Math.PI / 360)) / H; CU.uT.value = t;
    CU.uRs.value = P.rs || 0;
    if (P.rs > 0) { bh.copy(P.bh); CU.uBH.value.copy(bh); CU.uZBH.value = -tmp.copy(bh).applyMatrix4(cam.matrixWorldInverse).z; const n = CU.uDN.value.copy(P.dn).normalize(); CU.uDX.value.set(0.31, 0.93, 0.17).cross(n).normalize(); CU.uDY.value.crossVectors(n, CU.uDX.value);
      CU.uDisk.value = P.disk || 0; CU.uDForm.value = P.dform == null ? 1 : P.dform; CU.uDOut.value = P.dout || 15; CU.uHeat.value = P.heat == null ? 1 : P.heat; CU.uFlare.value = P.flare || 0; CU.uSpin.value = P.spin || 1; CU.uDB.value = P.db == null ? 1 : P.db; }
    CU.uSky.value = P.sky == null ? 1 : P.sky; CU.uNeb.value = P.neb == null ? 1 : P.neb; CU.uSuck.value = P.suck || 0; CU.uSw.value = P.sw || 0; if (P.sc) CU.uSC.value.copy(P.sc).normalize(); if (P.sr) CU.uSR.value.copy(P.sr); else CU.uSR.value.identity();
    pass(comp, cRT);
    // 번짐
    let src = cRT; for (let i = 0; i < NB; i++) { DU.uT.value = src.texture; DU.uPx.value.set(1 / src.width, 1 / src.height); DU.uTh.value = i === 0 ? (P.bth || 1.5) : 0; pass(down, dn[i]); src = dn[i]; }
    let lo = dn[NB - 1]; for (let i = NB - 2; i >= 0; i--) { UU.uT.value = lo.texture; UU.uB.value = dn[i].texture; UU.uPx.value.set(1 / lo.width, 1 / lo.height); pass(upM, up[i]); lo = up[i]; }
    FU.uB.value = up[0].texture; FU.uBloom.value = P.bloom == null ? 0.34 : P.bloom; FU.uExpo.value = P.expo == null ? 1.05 : P.expo; FU.uFlash.value = P.flash || 0; if (P.flashC) FU.uFlashC.value.copy(P.flashC); else FU.uFlashC.value.setRGB(1, 1, 1);
    FU.uFade.value = P.fade || 0; FU.uCA.value = P.ca || 0; FU.uShR.value = P.shR || 0; FU.uShA.value = P.shA || 0; if (P.shC) FU.uShC.value.copy(P.shC); FU.uT.value = t; FU.uVig.value = P.vig == null ? 0.32 : P.vig; FU.uGrain.value = P.grain || 0; FU.uTM.value = P.tm == null ? 1 : P.tm;
    pass(fin, null); renderer.autoClear = ac;
  }
  // 프레임이 무거우면 내부 해상도를 낮춤
  const ft = []; let cool = 0;
  function adapt(dt) { if (cool > 0) { cool -= dt; return; } ft.push(dt); if (ft.length < 24) return; ft.sort((a, b) => a - b); const med = ft[12]; ft.length = 0;
    if (med > 0.024 && q > 0.45) { q = Math.max(0.45, q - (med > 0.04 ? 0.2 : 0.12)); cool = 0.7; } else if (med < 0.0135 && q < 1) { q = Math.min(1, q + 0.06); cool = 2.5; } }
  const setQ = v => { q = v; };
  // 화면 한 칸 → 월드 방향 (탭 판정 등)
  function dispose() { sRT.depthTexture.dispose(); sRT.dispose(); cRT.dispose(); dn.forEach(r => r.dispose()); up.forEach(r => r.dispose()); comp.dispose(); down.dispose(); upM.dispose(); fin.dispose(); }
  // 셰이더를 미리 만들어 둠 (처음 그릴 때 멈칫하지 않게)
  function warm() { const c = new THREE.PerspectiveCamera(); for (const m of [comp, down, upM, fin]) { quad.material = m; renderer.compile(qs, oc); } }
  return { render, adapt, setQ, get q() { return q; }, sRT, dispose, warm, m4 };
}
