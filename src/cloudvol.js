// 핵 버섯구름 (부피 렌더링): 입자가 아니라, 화면 픽셀마다 시선을 따라 구름 속을 조금씩 들어가며 빛을 계산함.
// 모양 = 갓(도넛 + 위 돔) + 기둥 + 땅을 따라 번지는 먼지 고리를 부드럽게 이어 붙이고, 3D 잡음으로 표면을 뭉게뭉게 부풀림.
// 갓의 잡음은 도넛 둘레로 말려 돌아서 구름이 안에서 밖으로 말려 올라가는 것처럼 보이고, 덩어리는 구름이 커지는 만큼 같이 커짐.
// 빛 = 해(그쪽으로 한 발짝 샘플을 더 뽑아 자기 그림자·입체감) + 하늘 + 땅 반사 + 속에서 나오는 불빛(뜨거울수록 흰 노랑, 식으면 틈에만 검붉게).
// 낮은 해상도로 그린 뒤 부드럽게 늘려 합성 (폰에서도 돌도록, 느리면 스스로 해상도를 낮춤).
import * as THREE from "three";
import volUrl from "./assets/vol64.bin?url";

const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const FS = `precision highp sampler3D;
uniform sampler3D uN; uniform vec3 uRo, uRt, uUp, uFw, uSun, uSunC, uSkyC, uGndC; uniform vec2 uTan;
uniform float uTime, uH, uRm, uRr, uStem, uSR, uSH, uSA, uHeat, uRoll, uGrow, uWr, uWa, uBox, uTop, uExp;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
// 갓 + 기둥 + 먼지 고리
float shape(vec3 p){
  float rho = length(p.xz);
  vec2 c = vec2(rho - uRm, (p.y - uH) * 1.08);
  float tor = length(c) - uRr;
  vec3 e = vec3(p.x, p.y - uH - uRr * 0.42, p.z) / vec3(uRm + uRr * 0.5, uRr * 1.3 + uRm * 0.16, uRm + uRr * 0.5);
  float dome = (length(e) - 1.0) * uRr * 1.1;
  float d = smin(tor, dome, uRr * 0.8);
  if (uStem > 0.001) { float yy = clamp(p.y / max(uH, 0.01), 0.0, 1.0);
    float rs = uStem * (0.8 + 0.5 * yy * yy + 2.3 * exp(-p.y / 0.06) + 0.7 * smoothstep(0.6, 1.0, yy));
    float wob = 0.012 * sin(p.y * 13.0 + 1.3) ;
    float st = max(length(p.xz + wob) - rs, p.y - uH); d = smin(d, st, uRr * 0.55); }
  return d;
}
float skirt(vec3 p){ float rho = length(p.xz), ring = length(vec2((rho - uSR) * 0.5, p.y * 0.72)) - uSH * 1.5, disc = max(rho - uSR, p.y - uSH * (0.65 + 0.9 * exp(-rho * 3.5))); return smin(ring, disc, 0.05); }
// 잡음 덩어리: 도넛 둘레로 말리는 좌표에서 뽑음
vec2 lump(vec3 p, float fine){
  float rho = max(length(p.xz), 1e-4); vec2 c = vec2(rho - uRm, p.y - uH); float k = uRoll * smoothstep(uRr * 2.6, uRr * 0.5, length(c));
  float cs = cos(k), sn = sin(k); c = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y);
  vec3 q = vec3(p.x / rho * (c.x + uRm), c.y + uH, p.z / rho * (c.x + uRm)) / uGrow;
  q.y -= uTime * 0.015;
  vec2 a = texture(uN, q * 0.62 + vec3(0.11, 0.0, 0.37)).rg;
  float n = a.r, m = 0.0;
  if (fine > 0.5) { float b = texture(uN, q * 1.71 + vec3(0.57, 0.31, 0.13)).r; m = texture(uN, q * 4.3 + vec3(0.21, 0.67, 0.43)).g; n = a.r * 0.62 + b * 0.38; }
  return vec2(n, m);
}
// 거리 비슷한 값 (음수면 구름 속)
float map(vec3 p, float fine){
  float d0 = shape(p), s = skirt(p); float amp = (0.36 * uRr + 0.032);
  float d;
  if (d0 > amp * 1.5 + 0.05 && s > 0.14) return min(d0 - amp * 1.4, s - 0.1);
  vec2 n = lump(p, fine);
  d = d0 - (n.x - 0.5) * amp * 2.1 - (n.y - 0.35) * amp * 0.22;
  float ds = s - (n.x - 0.5) * 0.2 - n.y * 0.02; d = min(d, ds + (1.0 - uSA) * 0.1);
  return d;
}
vec3 ramp(float k){ k = clamp(k, 0.0, 1.0); vec3 c = mix(vec3(0.5, 0.04, 0.01), vec3(1.5, 0.42, 0.06), smoothstep(0.0, 0.4, k)); c = mix(c, vec3(3.2, 1.9, 0.62), smoothstep(0.35, 0.72, k)); return mix(c, vec3(7.0, 6.4, 5.4), smoothstep(0.7, 1.0, k)); }
void main(){
  vec2 ndc = vUv * 2.0 - 1.0; vec3 rd = normalize(uFw + uRt * ndc.x * uTan.x + uUp * ndc.y * uTan.y), ro = uRo;
  // 구름이 들어 있는 상자만 지나감
  vec3 bmin = vec3(-uBox, 0.0, -uBox), bmax = vec3(uBox, uTop, uBox), ir = 1.0 / rd, t0 = (bmin - ro) * ir, t1 = (bmax - ro) * ir, tn = min(t0, t1), tf = max(t0, t1);
  float tN = max(max(tn.x, max(tn.y, tn.z)), 0.0), tF = min(tf.x, min(tf.y, tf.z));
  vec3 col = vec3(0.0); float Tr = 1.0;
  if (tF > tN) {
    float t = tN + hash(gl_FragCoord.xy) * 0.004, shell = 0.012 + uRr * 0.03;
    for (int i = 0; i < 72; i++) {
      if (t > tF || Tr < 0.015) break;
      vec3 p = ro + rd * t; float d = map(p, 1.0);
      if (d < shell) {
        float dens = clamp((shell - d) / (2.0 * shell), 0.0, 1.0), dt = max(0.006, shell * 0.55), sk = smoothstep(0.1, -0.02, skirt(p));
        float rim = smoothstep(uSR * 1.06, uSR * 0.66, length(p.xz)), a = 1.0 - exp(-dens * 95.0 * dt * mix(1.0, 0.05 + 0.3 * rim, sk * smoothstep(0.0, 0.12, p.y + (1.0 - rim) * 0.12)));
        vec2 n = lump(p, 1.0);
        // 해 쪽으로 한 발짝 · 조금 더 멀리: 입체감과 자기 그림자
        float e1 = 0.03 + uRr * 0.06, d1 = map(p + uSun * e1, 1.0), d2 = map(p + uSun * (e1 * 3.4), 0.0);
        float lam = clamp((d1 - d) / e1 * 0.75 + 0.42, 0.0, 1.0), shd = exp(-max(0.0, -d2) * 22.0) * smoothstep(-0.06, 0.08, d2 + 0.02);
        float up = clamp((map(p + vec3(0.0, 0.05, 0.0), 0.0) - d) / 0.05 * 0.5 + 0.5, 0.0, 1.0);
        float hN = clamp(p.y / max(uTop, 0.1), 0.0, 1.0);
        vec3 alb = mix(vec3(0.13, 0.085, 0.06), vec3(0.5, 0.42, 0.34), smoothstep(0.3, 0.98, hN) * (0.3 + 0.7 * n.x));
        alb = mix(alb, vec3(0.2, 0.155, 0.115), sk * 0.9);
        float crease = mix(0.4, 1.0, smoothstep(0.34, 0.72, n.x));   // 덩어리 사이 틈은 어둡게
        vec3 c = alb * crease * (uSunC * lam * lam * (0.04 + 0.96 * shd) + uSkyC * (0.12 + 0.42 * up) + uGndC * (1.0 - up) * 0.5);
        // 속의 불: 뜨거울 때는 온통, 식으면 움푹한 틈에서만 · 아래쪽 면을 비추는 불빛
        float rr = length(vec2(length(p.xz) - uRm * 0.6, p.y - uH)) / (uRr + uRm * 0.5 + 1e-3);
        float hot = uHeat * (1.25 - rr * 0.7) * (1.2 - smoothstep(0.3, 0.68, n.x) * 1.05);
        c += ramp(hot) * smoothstep(0.02, 0.22, hot) * (1.0 - sk * 0.8);
        c += vec3(1.7, 0.55, 0.14) * min(uHeat, 1.0) * (1.0 - up) * 0.55 * (1.0 - sk);
        col += Tr * a * c; Tr *= 1.0 - a; t += dt;
      } else t += max(d * 0.72, 0.008);
    }
  }
  float al = 1.0 - Tr;
  // 수증기 돔: 충격파 뒤로 순간 생겼다 사라지는 흰 막
  if (uWa > 0.002) { vec3 oc = ro; float b = dot(oc, rd), c2 = dot(oc, oc) - uWr * uWr, h = b * b - c2; if (h > 0.0) { h = sqrt(h); float tt = -b - h; if (tt > 0.0) { vec3 p = ro + rd * tt; if (p.y > 0.0) { float g = 1.0 - abs(dot(normalize(p), rd)), f = pow(g, 1.8) * smoothstep(1.0, 0.62, g), n = texture(uN, p * 0.5 / max(uWr, 0.1)).r; float w = uWa * (0.08 + 0.7 * f) * smoothstep(0.38, 0.72, n) * smoothstep(0.0, 0.18, p.y); vec3 wc = (uSunC * 0.7 + uSkyC) * 0.8; col = col * (1.0 - w) + wc * w; al = al + (1.0 - al) * w; } } } }
  if (al < 0.003) { gl_FragColor = vec4(0.0); return; }
  vec3 c = col / al; c = 1.0 - exp(-c * uExp); c = pow(c, vec3(1.0 / 2.2));
  gl_FragColor = vec4(c * al, al);
}`;
// 합성: 낮은 해상도를 살짝 흐려 늘림 (미리 곱한 알파)
const CF = `uniform sampler2D uT; uniform vec2 uPx; varying vec2 vUv; void main(){ vec4 c = texture2D(uT, vUv) * 0.4; c += (texture2D(uT, vUv + vec2(uPx.x, 0.0)) + texture2D(uT, vUv - vec2(uPx.x, 0.0)) + texture2D(uT, vUv + vec2(0.0, uPx.y)) + texture2D(uT, vUv - vec2(0.0, uPx.y))) * 0.15; gl_FragColor = c; }`;

export async function buildCloud(X) {
  const { renderer, PR, vw, vh } = X;
  const buf = await fetch(volUrl).then(r => r.arrayBuffer());
  const noise = new THREE.Data3DTexture(new Uint8Array(buf), 64, 64, 64); noise.format = THREE.RGFormat; noise.type = THREE.UnsignedByteType; noise.minFilter = noise.magFilter = THREE.LinearFilter; noise.wrapS = noise.wrapT = noise.wrapR = THREE.RepeatWrapping; noise.unpackAlignment = 1; noise.needsUpdate = true;
  const U = { uN: { value: noise }, uRo: { value: new THREE.Vector3() }, uRt: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() }, uFw: { value: new THREE.Vector3() }, uTan: { value: new THREE.Vector2() },
    uSun: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() }, uSunC: { value: new THREE.Color(2.6, 2.25, 1.8) }, uSkyC: { value: new THREE.Color(0.5, 0.58, 0.74) }, uGndC: { value: new THREE.Color(0.36, 0.27, 0.2) },
    uTime: { value: 0 }, uH: { value: 0.2 }, uRm: { value: 0 }, uRr: { value: 0.1 }, uStem: { value: 0 }, uSR: { value: 0 }, uSH: { value: 0.02 }, uSA: { value: 0 }, uHeat: { value: 1 }, uRoll: { value: 0 }, uGrow: { value: 1 }, uWr: { value: 1 }, uWa: { value: 0 }, uBox: { value: 1 }, uTop: { value: 1 }, uExp: { value: 1.05 } };
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const ocam = new THREE.Camera();
  const mMarch = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false }), qMarch = new THREE.Mesh(geo, mMarch); qMarch.frustumCulled = false; const sMarch = new THREE.Scene(); sMarch.add(qMarch);
  const CU = { uT: { value: null }, uPx: { value: new THREE.Vector2() } };
  const mComp = new THREE.ShaderMaterial({ uniforms: CU, vertexShader: VS, fragmentShader: CF, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }), qComp = new THREE.Mesh(geo, mComp); qComp.frustumCulled = false; const sComp = new THREE.Scene(); sComp.add(qComp);
  let scale = 0.5, rt = null, avg = 0;
  const mkRT = () => { if (rt) rt.dispose(); const w = Math.max(64, Math.round(vw * PR * scale)), h = Math.max(64, Math.round(vh * PR * scale)); rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType }); CU.uT.value = rt.texture; CU.uPx.value.set(0.6 / w, 0.6 / h); };
  mkRT();
  const fw = new THREE.Vector3(), rtV = new THREE.Vector3(), upV = new THREE.Vector3();
  return { U,
    // 카메라는 구름 좌표(폭발 지점 원점, 화면 높이 = 1)로 바꿔서 넘김
    render(cam, E, S, P) {
      cam.getWorldDirection(fw); rtV.setFromMatrixColumn(cam.matrixWorld, 0).normalize(); upV.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
      U.uRo.value.copy(cam.position).sub(E).multiplyScalar(1 / S); U.uFw.value.copy(fw); U.uRt.value.copy(rtV); U.uUp.value.copy(upV);
      const th = Math.tan(cam.fov * Math.PI / 360); U.uTan.value.set(th * cam.aspect, th);
      for (const k in P) U["u" + k].value = P[k];
      const cur = renderer.getRenderTarget(), ac = renderer.autoClear, cc = renderer.getClearAlpha(); renderer.setRenderTarget(rt); renderer.setClearAlpha(0); renderer.autoClear = true; renderer.render(sMarch, ocam); renderer.setRenderTarget(cur); renderer.autoClear = false; renderer.render(sComp, ocam); renderer.autoClear = ac; renderer.setClearAlpha(cc);
    },
    // 셰이더를 미리 컴파일 (폭발 순간 멈칫하지 않게)
    warm() { const cur = renderer.getRenderTarget(); U.uTop.value = 1; U.uBox.value = 1; renderer.setRenderTarget(rt); renderer.render(sMarch, ocam); renderer.setRenderTarget(cur); renderer.compile(sComp, ocam); },
    // 프레임이 밀리면 해상도를 낮춤
    adapt(dt) { avg = avg ? avg * 0.9 + dt * 0.1 : dt; if (avg > 0.042 && scale > 0.26) { scale = Math.max(0.26, scale * 0.8); avg = 0; mkRT(); } },
    dispose() { if (rt) rt.dispose(); noise.dispose(); mMarch.dispose(); mComp.dispose(); geo.dispose(); } };
}
// 시간 s(초)에 따른 구름 모양 값 · 단위는 화면 높이
export function cloudAt(s) {
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a))), ss = x => x * x * (3 - 2 * x), ex = (t, k) => 1 - Math.exp(-Math.max(0, t) / k);
  const fr = 0.27 * ex(s, 0.13), k = ss(seg(s, 0.35, 1.5));
  const H = 0.16 * ex(s, 0.2) + 1.06 * ex(s - 0.3, 3.2), Rm = 0.48 * ex(s - 0.5, 2.5), Rr = fr + (0.13 + 0.09 * ex(s - 0.6, 2.8) - fr) * k;
  const Stem = 0.105 * ss(seg(s, 0.45, 1.8)) * (1 + 0.3 * seg(s, 2, 8));
  const SR = 1.9 * ex(s, 1.05), SH = (0.02 + 0.065 * ss(seg(s, 0.05, 1.1))) * (1 - 0.3 * seg(s, 3, 9)), SA = ss(seg(s, 0, 0.3)) * (1 - 0.7 * seg(s, 3.5, 9));
  const Heat = 1.05 * Math.exp(-s / 0.5) + 0.6 * Math.exp(-s / 2.7);
  const Roll = 0.55 * ex(s - 0.4, 3.5) * 2.2, Grow = 0.35 + 0.65 * ex(s, 1.6) + 0.04 * s;
  const Wr = 0.2 + 2.4 * ex(s, 0.75), Wa = 0.42 * ss(seg(s, 0.08, 0.3)) * (1 - ss(seg(s, 0.55, 1.5)));
  const Top = H + Rr * 1.9 + 0.1, Box = Math.max(Rm + Rr * 1.6 + 0.08, SR + SH * 3 + 0.06);
  return { H, Rm, Rr, Stem, SR, SH, SA, Heat, Roll, Grow, Wr, Wa, Top, Box, Time: s };
}
