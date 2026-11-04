// 손바닥 필살기 (3D를 2D 달력 위에 겹쳐 그림) — 영역전개처럼 비장하게
// 어둠이 천천히 깔리고(가장자리부터 · 원소 빛깔) 낮은 울림 → 양손이 천천히 올라와 손바닥을 달력 쪽으로 세움 →
// 두 손바닥 앞에 마법진이 불티를 튀기며 한 획씩 새겨지고(합창 같은 소리가 차오름) 다 그려지면 종이 울리며 기술 이름 →
// 오른손을 천천히 뒤로 당기며 힘을 모음(기운이 마법진으로 빨려 들고 손이 떨림 · 심장 소리 · 화면이 서서히 다가감) →
// 한순간 정적 → 쭉 뻗어 그 자리에 떠 있는 오른쪽 마법진 속으로 → 건너편에서 손이 엄청나게 커져 달력을 퍽!
// (맞는 순간 시간이 잠깐 느려지고 2D에서 부서짐 · 3D 파편이 눈앞으로 튐) → 거대한 손이 마법진 속으로 되돌아가고 마법진이 흩어지며 손이 내려감.
// 왼손과 왼쪽 마법진은 내내 그 자리. 오른손 패시브(번개·불·지옥·물)는 매번 무작위: 마법진 색·무늬, 손에 도는 빛과 핏줄 같은 기운, 맞은 자리 효과가 바뀜.
// 좌표: 화면 픽셀 = 월드 단위, z=0 평면이 화면(달력)과 1:1로 겹침 (카메라는 z=D). 손 좌표: +y 손가락 · +z 손바닥 쪽 · +x 엄지 쪽.
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { loadHand, preloadHand } from "./hand.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, V, buzz, noiseTex, radialTex } from "./fx-util.js";

// 원소: 선 색(밝은 화면에서도 보이는 짙은 색) · 빛 색 · 어둠 빛깔 · 기술 이름 · 손 기운 무늬(0 번개 줄기 · 1 타오름 · 2 물결)
export const ELEM = {
  thunder: { name: "번개", ink: 0x0f4fae, glow: 0x9ad6ff, hot: 0xf2fbff, light: 0x8fd0ff, tint: 0x030a1c, han: "雷 神 掌", ko: "뇌신장", vein: 0, css: "#8fd0ff" },
  fire: { name: "불", ink: 0xb3380a, glow: 0xffa040, hot: 0xfff0b0, light: 0xff8a3a, tint: 0x160700, han: "炎 神 掌", ko: "염신장", vein: 1, css: "#ffae5a" },
  hell: { name: "지옥", ink: 0x6a0010, glow: 0xff2438, hot: 0xff9a70, light: 0xff2a2a, tint: 0x1c0004, han: "地 獄 業 火 掌", ko: "업화장", vein: 1, css: "#ff4a5a" },
  water: { name: "물", ink: 0x075f8f, glow: 0x5fd6ff, hot: 0xe2f8ff, light: 0x5ccaff, tint: 0x00121c, han: "海 神 掌", ko: "해신장", vein: 2, css: "#6fdcff" },
};
// 시각(초): 어둠 · 손 올라옴 · 마법진 · 이름 · 힘 모음 · 정적 · 찌르기 · 맞음 · 느린 시간 · 거둠 · 끝
const T = { dark1: 0.9, rise0: 0.12, rise1: 1.1, circ0: 0.85, circ1: 2.15, name: 2.1, back0: 2.3, back1: 2.98, hush: 2.98, th1: 3.2, hit: 3.28, slow: 0.42, ret0: 3.98, ret1: 4.35, out0: 4.3, out1: 4.9, end: 5.05 };
const FINGERS = ["index", "middle", "ring", "pinky"], SPREAD = { index: 0.1, middle: 0.02, ring: -0.06, pinky: -0.14 };

let stage = null;
const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
export function prewarmPalm() { preloadHand(); if (!stage) stage = prepare().catch(e => { console.error(e); stage = null; return null; }); }
export async function startPalm(o) {
  let s = stage && (await stage); stage = null;
  if (!s || s.vw !== innerWidth || s.vh !== innerHeight || s.dark !== isDark() || s.X !== fx3d() || s.X.lost) { if (s) s.dispose(); s = await prepare(); }
  return s.run(o);
}

// 손 피부: 가장자리에 원소 빛(프레넬) + 흐르는 기운 무늬(번개 줄기 · 불꽃 결 · 물빛 일렁임)
const SKIN_NOISE = `uniform vec3 uRimC; uniform float uRim, uVein, uT, uVS; uniform int uKind; varying vec3 vFpW;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y), mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
function patchSkin(m, U) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = "varying vec3 vFpW;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vFpW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = SKIN_NOISE + sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
    vec3 q = vFpW * uVS; float v = 0.0;
    if (uKind == 0) { float n = vn3(q * 1.3 + vec3(0.0, 0.0, uT * 3.0)); v = 1.0 - smoothstep(0.0, 0.035, abs(n - 0.5)); v *= step(0.35, vn3(q * 0.5 + uT * 6.0)); }
    else if (uKind == 1) { float n = vn3(q + vec3(0.0, -uT * 2.2, 0.0)) * 0.65 + vn3(q * 2.3 + vec3(0.0, -uT * 3.5, 0.0)) * 0.35; v = smoothstep(0.52, 0.8, n); }
    else { float n = vn3(q * 0.9 + vec3(uT * 0.6, uT * 0.4, 0.0)); v = pow(1.0 - abs(sin(n * 18.0)), 6.0) * 0.8; }
    totalEmissiveRadiance += uRimC * (fr * uRim + v * uVein * (0.4 + fr)); }`);
  };
  m.customProgramCacheKey = () => "palmSkin";
}

// ── 마법진 그림 (흰 선, 투명 바탕) · layer 0 바깥 고리·룬 띠·눈금 / 1 안쪽 별·무늬 (원소마다) ──
function rune(x, s, seed) {
  let r = seed * 9301 + 49297; const R = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  x.beginPath(); x.moveTo(0, -s * 0.5); x.lineTo(0, s * 0.5);   // 줄기
  const n = 1 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const y = (R() - 0.5) * s * 0.8, side = R() < 0.5 ? -1 : 1, k = R();
    if (k < 0.4) { x.moveTo(0, y); x.lineTo(side * s * 0.35, y - s * 0.22); }
    else if (k < 0.7) { x.moveTo(0, y); x.quadraticCurveTo(side * s * 0.45, y, side * s * 0.3, y + s * 0.3); }
    else { x.moveTo(side * s * 0.12, y); x.arc(side * s * 0.25, y, s * 0.12, Math.PI, Math.PI * 3); }
  }
  x.stroke();
  if (R() < 0.45) { x.beginPath(); x.arc((R() - 0.5) * s * 0.5, s * 0.62, s * 0.05, 0, 7); x.fill(); }
}
function circleTex(kind, layer, glow) {
  const N = 1024, cv = document.createElement("canvas"); cv.width = cv.height = N; const x = cv.getContext("2d"), R = N / 2 * 0.97;
  x.translate(N / 2, N / 2); x.strokeStyle = x.fillStyle = "#fff"; x.lineCap = x.lineJoin = "round";
  if (glow) { x.shadowColor = "#fff"; x.shadowBlur = 22; }
  const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r * R, 0, Math.PI * 2); x.stroke(); };
  const poly = (n, r, rot, w, step = 1) => { x.lineWidth = w; x.beginPath(); for (let i = 0; i <= n; i++) { const a = rot + ((i * step) % n) / n * Math.PI * 2, px = Math.cos(a) * r * R, py = Math.sin(a) * r * R; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); };
  if (layer === 0) {
    ring(0.99, 8); ring(0.945, 3.5); ring(0.8, 4); ring(0.77, 1.6);
    x.lineWidth = 3.2; const n = 30; for (let i = 0; i < n; i++) { x.save(); x.rotate(i / n * Math.PI * 2); x.translate(0, -0.872 * R); rune(x, R * 0.075, i + kind.length * 31); x.restore(); }
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, l = i % 5 ? 0.018 : 0.042; x.lineWidth = i % 5 ? 1.6 : 3.4; x.beginPath(); x.moveTo(Math.cos(a) * 0.77 * R, Math.sin(a) * 0.77 * R); x.lineTo(Math.cos(a) * (0.77 - l) * R, Math.sin(a) * (0.77 - l) * R); x.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; x.beginPath(); x.arc(Math.cos(a) * 0.967 * R, Math.sin(a) * 0.967 * R, 9, 0, 7); x.fill(); }
  } else if (kind === "thunder") {
    poly(6, 0.72, -Math.PI / 2, 5, 2); poly(6, 0.72, -Math.PI / 2 + Math.PI / 6, 2.5, 2); poly(6, 0.42, 0, 3); ring(0.36, 3); ring(0.2, 2);
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI * 2; x.lineWidth = 3; x.beginPath(); x.arc(Math.cos(a) * 0.72 * R, Math.sin(a) * 0.72 * R, 0.07 * R, 0, 7); x.stroke(); }
    x.lineWidth = 9; x.beginPath(); x.moveTo(0.05 * R, -0.3 * R); x.lineTo(-0.1 * R, 0.02 * R); x.lineTo(0.04 * R, 0.02 * R); x.lineTo(-0.07 * R, 0.3 * R); x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = 2.5; x.beginPath(); let r0 = 0.45; x.moveTo(Math.cos(a) * r0 * R, Math.sin(a) * r0 * R); for (let k = 1; k <= 4; k++) { const rr = r0 + k * 0.05, aa = a + (k % 2 ? 0.05 : -0.05); x.lineTo(Math.cos(aa) * rr * R, Math.sin(aa) * rr * R); } x.stroke(); }
  } else if (kind === "fire") {
    poly(6, 0.73, -Math.PI / 2, 5, 2); poly(6, 0.73, Math.PI / 2, 5, 2); ring(0.5, 3); ring(0.24, 4);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.save(); x.rotate(a); x.lineWidth = 3; x.beginPath(); x.moveTo(-0.05 * R, -0.5 * R); x.quadraticCurveTo(-0.07 * R, -0.6 * R, 0, -0.68 * R); x.quadraticCurveTo(0.02 * R, -0.58 * R, 0.05 * R, -0.5 * R); x.stroke(); x.restore(); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.lineWidth = i % 2 ? 2 : 4; x.beginPath(); x.moveTo(Math.cos(a) * 0.26 * R, Math.sin(a) * 0.26 * R); x.lineTo(Math.cos(a) * (i % 2 ? 0.34 : 0.42) * R, Math.sin(a) * (i % 2 ? 0.34 : 0.42) * R); x.stroke(); }
    x.beginPath(); x.arc(0, 0, 0.1 * R, 0, 7); x.fill();
  } else if (kind === "hell") {
    poly(5, 0.74, Math.PI / 2, 6, 2); poly(5, 0.7, Math.PI / 2, 2, 2); ring(0.74, 2); ring(0.32, 4);
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; x.save(); x.rotate(a); x.beginPath(); x.moveTo(-0.025 * R, -0.32 * R); x.lineTo(0, -0.43 * R); x.lineTo(0.025 * R, -0.32 * R); x.closePath(); x.fill(); x.restore(); }
    x.lineWidth = 5; x.beginPath(); x.moveTo(-0.17 * R, 0); x.quadraticCurveTo(0, -0.13 * R, 0.17 * R, 0); x.quadraticCurveTo(0, 0.13 * R, -0.17 * R, 0); x.stroke();
    x.beginPath(); x.arc(0, 0, 0.045 * R, 0, 7); x.fill();
    for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i / 5 * Math.PI * 2; x.lineWidth = 3; x.beginPath(); x.arc(Math.cos(a) * 0.74 * R, Math.sin(a) * 0.74 * R, 0.06 * R, 0, 7); x.stroke(); }
  } else {
    ring(0.3, 3); ring(0.44, 2); ring(0.58, 3);
    x.lineWidth = 4; x.beginPath(); for (let i = 0; i <= 240; i++) { const a = i / 240 * Math.PI * 2, r = (0.69 + 0.03 * Math.sin(a * 14)) * R; i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i / 3 * Math.PI * 2; x.save(); x.translate(Math.cos(a) * 0.51 * R, Math.sin(a) * 0.51 * R); x.rotate(a + Math.PI / 2); x.lineWidth = 3; x.beginPath(); x.moveTo(0, -0.07 * R); x.bezierCurveTo(0.06 * R, 0, 0.05 * R, 0.06 * R, 0, 0.06 * R); x.bezierCurveTo(-0.05 * R, 0.06 * R, -0.06 * R, 0, 0, -0.07 * R); x.stroke(); x.restore(); }
    x.beginPath(); x.moveTo(0, -0.16 * R); x.bezierCurveTo(0.12 * R, 0, 0.1 * R, 0.13 * R, 0, 0.13 * R); x.bezierCurveTo(-0.1 * R, 0.13 * R, -0.12 * R, 0, 0, -0.16 * R); x.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
const CIRC_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const CIRC_FS = `uniform sampler2D map; uniform vec3 uCol; uniform float uA, uP, uFl; varying vec2 vUv;
void main(){ vec2 d = vUv - 0.5; float ang = atan(d.y, d.x) / 6.28318 + 0.5; float rev = 1.0 - smoothstep(uP - 0.035, uP, ang);
  float a = texture2D(map, vUv).a * rev * uA; if (a < 0.003) discard; gl_FragColor = vec4(uCol * (1.0 + uFl), a);
  #include <colorspace_fragment>
}`;
// 점 입자: 크기는 멀수록 작게 · 색·투명도는 입자마다
const PT_VS = `attribute float aSize; attribute vec4 aCol; uniform float uScale; varying vec4 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vC = aCol; }`;
const PT_FS = `varying vec4 vC; uniform float uHard;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(uHard, 1.0, r)) * vC.a; if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb, a);
  #include <colorspace_fragment>
}`;

async function prepare() {
  const vw = innerWidth, vh = innerHeight, dark = isDark();
  const X = fx3d(), { renderer, PR } = X;   // 3D 화면은 바주카·핵과 같이 씀
  const scene = new THREE.Scene(); scene.environment = X.env; scene.environmentIntensity = 0.6;
  const FOV = 35, D = vh / 2 / Math.tan((FOV / 2) * Math.PI / 180), M = Math.max(vw, vh);
  const cam = new THREE.PerspectiveCamera(FOV, vw / vh, 10, D * 3); cam.position.set(0, 0, D);
  const hemi = new THREE.HemisphereLight(0xffffff, dark ? 0x30384a : 0x8f97a6, 1.05); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e2, 2.5); key.position.set(-0.45 * D, 0.7 * D, 1.1 * D); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -M * 0.75, right: M * 0.75, top: M * 0.75, bottom: -M * 0.75, near: D * 0.3, far: D * 3 });
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.6; key.shadow.radius = 5; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc6d8ff, 1.3); rim.position.set(0.7 * D, 0.3 * D, -0.4 * D); scene.add(rim);
  // 마법진에서 나오는 빛 (손을 아래·앞에서 비춤)
  const eLight = new THREE.PointLight(0xffffff, 0, M * 1.4, 0), lLight = new THREE.PointLight(0xffffff, 0, M, 0); scene.add(eLight, lLight);
  // 달력(z=0) 위: 그림자만 받는 판 · 어둠(전체 + 가장자리가 더 짙은 비네트, 원소 빛깔)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(vw * 3, vh * 3), new THREE.ShadowMaterial({ opacity: 0, transparent: true })); wall.receiveShadow = true; scene.add(wall);
  const dimM = new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0, depthWrite: false }), dim = new THREE.Mesh(new THREE.PlaneGeometry(vw * 3, vh * 3), dimM); dim.position.z = 0.5; dim.renderOrder = -3; scene.add(dim);
  const vigM = new THREE.MeshBasicMaterial({ map: radialTex([[0, "rgba(255,255,255,0)"], [0.45, "rgba(255,255,255,.12)"], [0.75, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,1)"]]), color: 0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(vw * 1.25, vh * 1.25), vigM); vig.position.z = 0.8; vig.renderOrder = -2; scene.add(vig);
  const atS = (sx, sy, z) => V((sx - vw / 2) * (D - z) / D, (vh / 2 - sy) * (D - z) / D, z);
  const toS = p => ({ x: vw / 2 + p.x * D / (D - p.z), y: vh / 2 - p.y * D / (D - p.z) });

  // ── 손 3개: 왼손(뒤집은 오른손 모델) · 오른손(마법진 앞쪽만 보임) · 거대한 오른손(마법진 건너편만 보임) ──
  const zH = D * 0.36, S = Math.min(vw * 0.3, vh * 0.16) * (D - zH) / D, K = S / 0.08, PALM_Z = 0.015 * K;
  const zC = zH - 0.6 * S;
  const clipR = new THREE.Plane(V(0, 0, 1), -zC), clipG = new THREE.Plane(V(0, 0, -1), zC);
  const bump = noiseTex(256, 6, 30, 0.9), skinBase = { color: 0xe8a578, roughness: 0.52, sheen: 0.85, sheenRoughness: 0.42, sheenColor: new THREE.Color(0xff8a66), clearcoat: 0.1, clearcoatRoughness: 0.6, bumpMap: bump, bumpScale: 0.35 };
  const mkU = () => ({ uRimC: { value: new THREE.Color() }, uRim: { value: 0 }, uVein: { value: 0 }, uT: { value: 0 }, uVS: { value: 0.02 }, uKind: { value: 0 } });
  const UL = mkU(), UR = mkU(), UG = mkU();
  const skinL = new THREE.MeshPhysicalMaterial(skinBase), skinR = new THREE.MeshPhysicalMaterial({ ...skinBase, clippingPlanes: [clipR] }), skinG = new THREE.MeshPhysicalMaterial({ ...skinBase, clippingPlanes: [clipG] });
  patchSkin(skinL, UL); patchSkin(skinR, UR); patchSkin(skinG, UG);
  const slv = { color: dark ? 0x3b4a6b : 0x27324a, roughness: 0.85, bumpMap: noiseTex(128, 4, 40), bumpScale: 0.8 };
  const slvL = new THREE.MeshStandardMaterial(slv), slvR = new THREE.MeshStandardMaterial({ ...slv, clippingPlanes: [clipR] }), slvG = new THREE.MeshStandardMaterial({ ...slv, clippingPlanes: [clipG] });
  const [HL, HR, HG] = await Promise.all([loadHand(skinL), loadHand(skinR), loadHand(skinG)]);
  function rig(H, sleeveMat) {
    const root = new THREE.Group(), orient = new THREE.Group(), arm = H.bones.wrist.parent;
    orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    orient.scale.setScalar(K); orient.add(H.scene); root.add(orient);
    const restPos = n => V().setFromMatrixPosition(H.restM[n]);
    H.scene.position.copy(restPos("wrist").add(restPos("index-finger-phalanx-proximal")).add(restPos("pinky-finger-phalanx-proximal")).add(restPos("middle-finger-phalanx-proximal")).multiplyScalar(0.25)).negate();
    root.updateMatrixWorld(true);
    const toRoot = m => root.worldToLocal(arm.localToWorld(m.clone()));
    const wristR = toRoot(restPos("wrist")), elbowDir = wristR.clone().sub(toRoot(restPos("middle-finger-phalanx-proximal"))).normalize();
    const sleeve = new THREE.Group(), sl = 10 * S;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.034 * K, 0.05 * K, sl, 36, 1, true), sleeveMat); tube.position.y = -sl / 2;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.034 * K, 0.0045 * K, 12, 36), sleeveMat); cuff.rotation.x = Math.PI / 2;
    sleeve.add(tube, cuff); sleeve.scale.set(1, 1, 0.8); sleeve.position.copy(wristR).addScaledVector(elbowDir, 0.006 * K); root.add(sleeve);
    const bones = ["wrist", "thumb-phalanx-distal", "thumb-tip", ...FINGERS.flatMap(n => [`${n}-finger-phalanx-proximal`, `${n}-finger-phalanx-intermediate`, `${n}-finger-tip`])].map(n => H.bones[n]);
    return { root, H, sleeve, bones };
  }
  const L = rig(HL, slvL), R = rig(HR, slvR), RG = rig(HG, slvG), mir = new THREE.Group(); mir.scale.x = -1; mir.add(L.root); scene.add(mir, R.root, RG.root);
  const eul = new THREE.Euler();
  function place(h, p, roll, pitch, s = 1) { h.root.position.copy(p); h.root.quaternion.setFromEuler(eul.set(pitch, Math.PI, roll, "ZYX")); h.root.scale.setScalar(s); h.root.updateMatrixWorld(true); }
  function aimSleeve(h, target) { const loc = h.root.worldToLocal(target.clone()).sub(h.sleeve.position).normalize(); h.sleeve.quaternion.setFromUnitVectors(V(0, -1, 0), loc); }
  function pose(H, curl, spread, thumb) {
    for (const n of FINGERS) H.setChain(n, [null, [-0.06 - 0.55 * curl, SPREAD[n] * spread, 0], [-0.07 - 0.7 * curl, 0, 0], [-0.05 - 0.45 * curl, 0, 0]]);
    H.setChain("thumb", [[-0.2 - 0.3 * curl, 0.3 * thumb, 0], [-0.12, 0, 0], [-0.15, 0, 0]]);
  }
  [L, R, RG].forEach(h => h.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }));

  // ── 마법진: 겹겹의 고리(깊이가 달라 살짝 입체) · 안쪽 무늬 · 뒤쪽 은은한 빛 · 가운데 통로 빛 ──
  const haloTex = radialTex([[0, "rgba(255,255,255,.9)"], [0.3, "rgba(255,255,255,.35)"], [0.65, "rgba(255,255,255,.08)"], [1, "rgba(255,255,255,0)"]]);
  function makeCircle(kind, el, rad) {
    const g = new THREE.Group(), geo = new THREE.PlaneGeometry(rad * 2, rad * 2), mk = (tex, col, add) => new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uCol: { value: new THREE.Color(col) }, uA: { value: 0 }, uP: { value: 0 }, uFl: { value: 0 } },
      vertexShader: CIRC_VS, fragmentShader: CIRC_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
    const tex = [0, 1].map(l => [circleTex(kind, l, false), circleTex(kind, l, true)]);
    // 0 바깥 고리·룬 · 1 안쪽 별 (앞으로 살짝 떠 있음) · 2 더 바깥의 옅은 고리 (뒤로 살짝)
    const layers = [[0, 0, 1, 1], [1, rad * 0.09, 1, 1], [0, -rad * 0.08, 1.3, 0.42]].map(([l, z, sc, k]) => { const sub = new THREE.Group(), ink = new THREE.Mesh(geo, mk(tex[l][0], el.ink, false)), glo = new THREE.Mesh(geo, mk(tex[l][1], el.glow, true));
      glo.position.z = 0.4; glo.renderOrder = 3; ink.renderOrder = 2; sub.add(ink, glo); sub.position.z = z; sub.scale.setScalar(sc); g.add(sub); return { sub, ink, glo, k }; });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(rad * 3.6, rad * 3.6), new THREE.MeshBasicMaterial({ map: haloTex, color: el.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.z = -rad * 0.15; halo.renderOrder = 1; g.add(halo);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.98, 64), new THREE.MeshBasicMaterial({ map: haloTex, color: el.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    disk.position.z = -0.4; disk.renderOrder = 1; g.add(disk);
    return { g, layers, halo, disk, rad, set(a, p, fl) { for (const Ly of layers) for (const m of [Ly.ink, Ly.glo]) { m.material.uniforms.uA.value = a * Ly.k * (m === Ly.glo ? (dark ? 1 : 0.85) : (dark ? 0.55 : 0.95)); m.material.uniforms.uP.value = p; m.material.uniforms.uFl.value = fl; } } };
  }
  // ── 입자 (더하기 합성 빛 · 보통 합성 연기·물) ──
  function makePts(N, add, hard = 0) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), sz = new Float32Array(N), col = new Float32Array(N * 4);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1)); geo.setAttribute("aCol", new THREE.BufferAttribute(col, 4));
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR }, uHard: { value: hard } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.frustumCulled = false; m.renderOrder = add ? 6 : 5; scene.add(m);
    const P = [], c = new THREE.Color(), c2 = new THREE.Color();
    return { m, P, add(o) { if (P.length >= N) P.shift(); P.push(o); },
      step(dt) {
        for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.life += dt; if (q.life >= q.max) { P.splice(i, 1); continue; }
          if (q.to) { const d = q.to.clone().sub(q.p), l = d.length(); if (l < q.v.length() * dt * 1.2) { P.splice(i, 1); continue; } q.v.lerp(d.multiplyScalar(q.sp / l), Math.min(1, dt * 6)); }   // 끌려가는 기운
          q.v.y += (q.g || 0) * dt; q.v.multiplyScalar(Math.exp(-(q.drag || 0) * dt)); if (q.orb) { const a = q.orb.a += q.orb.w * dt; q.p.set(q.orb.c.x + Math.cos(a) * q.orb.r, q.orb.c.y + Math.sin(a) * q.orb.r * 0.55 + q.orb.dy * q.life, q.orb.c.z + Math.sin(a) * q.orb.r * 0.6); } else q.p.addScaledVector(q.v, dt); }
        for (let i = 0; i < N; i++) { const q = P[i]; if (!q) { col[i * 4 + 3] = 0; continue; } const u = q.life / q.max;
          pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; sz[i] = lerp(q.s0, q.s1, u); c.set(q.c).lerp(c2.set(q.c2 ?? q.c), u);
          col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = q.a * Math.sin(Math.PI * Math.min(1, u * (q.fin || 1))) ** 0.6 * (u < 0.1 ? u / 0.1 : 1); }
        geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aCol.needsUpdate = true; } };
  }
  const ptA = makePts(1400, true), ptN = makePts(600, false, 0.15);
  // ── 번개 줄기 (카메라를 보는 띠, 매 프레임 다시 만듦) ──
  const MAXQ = 900, bPos = new Float32Array(MAXQ * 12), bA = new Float32Array(MAXQ * 4), bIdx = new Uint16Array(MAXQ * 6);
  for (let i = 0; i < MAXQ; i++) bIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3)); bGeo.setAttribute("aA", new THREE.BufferAttribute(bA, 1)); bGeo.setIndex(new THREE.BufferAttribute(bIdx, 1));
  const boltMat = (col, add) => new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) } }, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: "attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uCol; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uCol, vA);\n #include <colorspace_fragment>\n}" });
  const boltInk = new THREE.Mesh(bGeo, boltMat(0x0d3a8a, false)), boltGlo = new THREE.Mesh(bGeo, boltMat(0xe8f6ff, true)); boltInk.renderOrder = 7; boltGlo.renderOrder = 8; boltInk.frustumCulled = boltGlo.frustumCulled = false; scene.add(boltInk, boltGlo);
  // ── 맞는 순간: 빛 · 충격파 고리 · 눈앞으로 튀는 달력 조각 ──
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); flash.renderOrder = 9; scene.add(flash);
  const ringMat = add => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const shocks = [[0.86, false, 1], [0.9, true, 1.2], [0.96, true, 1.6]].map(([r0, add, z]) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, 1, 96), ringMat(add)); m.position.z = z; m.renderOrder = 4; m.userData = { r: 0, sp: 1 }; scene.add(m); return m; });
  const NCH = 90, chips = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), NCH);
  chips.castShadow = true; chips.frustumCulled = false; chips.visible = false; scene.add(chips); const CH = [], m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = V(), chipC = new THREE.Color();
  for (let i = 0; i < NCH; i++) { CH.push({ p: V(), v: V(), r: V(), w: V(), s: V() }); chips.setColorAt(i, chipC.set(0xffffff)); }

  // 미리 한 번 그려서 셰이더를 다 만들어 둠
  const rest = { R: atS(vw * 0.73, vh * 0.7, zH), L: atS(vw * 0.27, vh * 0.72, zH) };
  place(R, rest.R, 0.12, 0); place(RG, rest.R, 0.12, 0); place(L, rest.L.clone().setX(-rest.L.x), 0.12, 0);
  const warmC = makeCircle("fire", ELEM.fire, S); scene.add(warmC.g); warmC.g.position.set(0, 0, 50); warmC.set(1, 1, 0);
  for (const pt of [ptA, ptN]) pt.add({ p: V(0, 0, 40), v: V(), life: 0, max: 1, s0: 5, s1: 5, a: 1, c: 0xffffff });
  ptA.step(0.01); ptN.step(0.01); chips.visible = true; renderer.compile(scene, cam); if (!X.cv.isConnected) renderer.render(scene, cam);   // 다른 쪽이 화면을 쓰는 중이면 그리지 않음
  scene.remove(warmC.g); ptA.P.length = ptN.P.length = 0; ptA.step(0); ptN.step(0); RG.root.visible = false; chips.visible = false;

  function dispose() { scene.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }

  function run(o) {
    return new Promise(resolve => {
      const elK = o.el, el = ELEM[elK], sfx = makeSound(o.sfx), glowC = new THREE.Color(el.glow);
      X.use("palm", 2); document.documentElement.classList.add("palm-on");
      // 기술 이름 (영역전개처럼)
      const title = document.createElement("div"); title.id = "gPalmT"; title.style.setProperty("--pc", el.css);
      title.innerHTML = `<small>${el.han}</small><b>${el.ko}</b><i></i><em>오른손 패시브 · ${el.name}</em>`; document.body.append(title);
      const zoomEls = ["gWall", "gFree", "gFx", "gDecal"].map(id => document.getElementById(id)).filter(Boolean);
      const RC = makeCircle(elK, el, S * 1.3), LC = makeCircle(elK, el, S * 1.18); scene.add(RC.g, LC.g);
      const handUp = S * 0.5, up2 = handUp * (D - zC) / (D - zH), cR = atS(vw * 0.73, vh * 0.7, zC), cL = atS(vw * 0.27, vh * 0.72, zC); cR.y += up2; cL.y += up2;
      RC.g.position.copy(cR); LC.g.position.copy(cL); RC.g.rotation.z = 0.12; LC.g.rotation.z = -0.12;
      const Gs = 3.5, I = atS(vw * 0.5, vh * 0.5, PALM_Z * Gs + 1);
      const wind = atS(vw * 0.8, vh * 0.82, zH + S * 1.05), plunge = cR.clone().add(V(0, -handUp * 0.8, -S * 0.75));
      const shR = atS(vw * 1.02, vh * 1.5, D * 0.6), shL = atS(-vw * 0.02, vh * 1.5, D * 0.6);
      const tX = T.back1 + (T.th1 - T.back1) * Math.cbrt(clamp((wind.z - zC) / (wind.z - plunge.z), 0, 1));
      for (const [U, k] of [[UL, 0.4], [UR, 1], [UG, 1]]) { U.uRimC.value.set(el.glow); U.uKind.value = el.vein; U.uVS.value = (U === UG ? 0.018 / Gs : 0.03) * (el.vein === 2 ? 1.4 : 1); U.k = k; }
      vigM.color.set(el.tint); wall.material.opacity = 0; dimM.opacity = 0; vigM.opacity = 0; ptA.P.length = ptN.P.length = 0; RG.root.visible = false; chips.visible = false;
      let t = 0, last = performance.now(), hitDone = false, raf = 0, shakeA = 0, emitAcc = 0, bolts = [], boltT = 0, slowT = 0, hitReal = 0, sucA = 0, back = 0;
      const once = new Set(), at = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } };
      const bonePos = (h, i, out = V()) => h.bones[i % h.bones.length].getWorldPosition(out);
      sfx.ritual(elK, T.hush); buzz(1);

      function frame(now) {
        const dR = Math.min(0.05, (now - last) / 1000); last = now;
        // 맞는 순간 잠깐 시간이 느려짐
        let dt = dR; if (hitDone && hitReal < T.slow) { hitReal += dR; dt = dR * lerp(0.18, 1, sstep(hitReal / T.slow)); }
        if (import.meta.env.DEV && window.__palmStop != null) dt = Math.max(0, Math.min(dt, window.__palmStop - t));
        t += dt;
        // ── 손 움직임 (천천히 올라와 버팀 · 오른손은 천천히 당겼다가 한순간 찌름) ──
        const up = eOut(seg(t, T.rise0, T.rise1)), down = eIn(seg(t, T.out0, T.out1)), lift = (1 - up) + down;
        back = eInOut(seg(t, T.back0, T.back1)); const thr = eIn(seg(t, T.back1, T.th1)), pull = eInOut(seg(t, T.ret0, T.ret1));
        const breath = Math.sin(t * 1.6) * S * 0.03 * up * (1 - back);
        place(L, rest.L.clone().setX(-rest.L.x).add(V(0, -vh * 0.75 * lift + breath, 0)), 0.12 + 0.03 * Math.sin(t * 1.3) * up, 0.05 * (1 - up));
        let pR = rest.R.clone().lerp(wind, back);
        if (t > T.back1) pR = wind.clone().lerp(plunge, thr);
        if (t > T.ret0) pR = plunge.clone().lerp(rest.R, pull);
        pR.add(V(0, -vh * 0.75 * lift + breath, 0));
        const trem = (t > T.circ1 && t < T.hush ? 0.4 + 1.6 * back : 0);   // 힘을 모을수록 손이 떨림
        pR.add(V(rnd(-1, 1) * trem, rnd(-1, 1) * trem, 0));
        place(R, pR, 0.12 - 0.1 * back * (1 - thr), -0.28 * back * (1 - thr));
        aimSleeve(R, shR); aimSleeve(L, shL);
        pose(R.H, 0.04 + 0.3 * back * (1 - thr), 1 + 0.3 * back - 0.9 * thr, 1); pose(L.H, 0.06 - 0.04 * up, 1.15, 1); pose(RG.H, 0.04, 0.4, 0.8);
        // 거대한 손
        const em = seg(t, tX, T.hit), gw = eIn(em), gBack = eInOut(seg(t, T.ret0 - 0.04, T.ret1 - 0.08));
        RG.root.visible = em > 0 && gBack < 1;
        if (RG.root.visible) {
          const press = t > T.hit ? Math.sin(Math.PI * clamp((t - T.hit) / 0.5, 0, 1)) * 0.05 : 0;
          const pG = cR.clone().lerp(I, gw).lerp(cR, gBack); pG.z -= press * S;
          place(RG, pG, 0.06, -0.06 * (1 - gw), lerp(1, Gs, Math.max(0, gw * (1 - gBack))));
          aimSleeve(RG, cR.clone().add(V(0, -S, S * 3)));
        }
        // ── 마법진: 불티 끝으로 한 획씩 새겨짐 → 돌며 빛남 → 손이 통과할 때 번쩍 → 흩어짐 ──
        const cA = sstep(seg(t, T.circ0, T.circ0 + 0.25)) * (1 - sstep(seg(t, T.out0, T.out0 + 0.45))), cP = eInOut(seg(t, T.circ0, T.circ1)), cPL = eInOut(seg(t, T.circ0 + 0.12, T.circ1 + 0.08));
        const pass = Math.max(0, 1 - Math.abs(t - tX) / 0.16), boom = Math.max(0, 1 - Math.abs(t - T.hit) / 0.3), done = sstep(seg(t, T.circ1 - 0.05, T.circ1 + 0.25)) * (1 - pass);
        const spinR = 0.25 + 2.6 * pass + 1.4 * back, spread = 1 + 0.35 * sstep(seg(t, T.out0, T.out0 + 0.45));
        RC.layers[0].sub.rotation.z += dt * spinR; RC.layers[1].sub.rotation.z -= dt * spinR * 1.4; RC.layers[2].sub.rotation.z -= dt * spinR * 0.5;
        LC.layers[0].sub.rotation.z -= dt * 0.3; LC.layers[1].sub.rotation.z += dt * 0.45; LC.layers[2].sub.rotation.z += dt * 0.15;
        RC.layers[1].sub.scale.setScalar(lerp(0.55, 1, eOut(seg(t, T.circ0 + 0.35, T.circ1)))); LC.layers[1].sub.scale.setScalar(lerp(0.55, 1, eOut(seg(t, T.circ0 + 0.45, T.circ1 + 0.08))));
        RC.layers[2].sub.scale.setScalar(1.3 * lerp(0.8, 1, eOut(seg(t, T.circ1 - 0.3, T.circ1 + 0.3)))); LC.layers[2].sub.scale.setScalar(1.3 * lerp(0.8, 1, eOut(seg(t, T.circ1 - 0.25, T.circ1 + 0.35))));
        const pulse = 1 + 0.06 * done * Math.sin(t * 7) ** 2 + 0.08 * pass + 0.12 * back * Math.sin(t * 22) ** 8;
        RC.g.scale.setScalar(spread * pulse); LC.g.scale.setScalar(spread * (1 + 0.04 * done * Math.sin(t * 5) ** 2));
        RC.set(cA, cP, 0.35 * done + 0.7 * pass + 0.5 * back); LC.set(cA, cPL, 0.3 * done);
        RC.disk.material.opacity = (0.3 * back + 0.9 * pass + 0.35 * (t > T.back1 && t < T.ret1 ? 1 : 0)) * cA * (dark ? 1 : 0.7); LC.disk.material.opacity = 0.15 * cA * (dark ? 1 : 0.7);
        RC.halo.material.opacity = cA * (0.22 + 0.3 * done + 0.35 * back + 0.6 * pass) * (dark ? 1 : 0.65); LC.halo.material.opacity = cA * (0.2 + 0.25 * done) * (dark ? 1 : 0.65);
        // 새기는 끝의 불티 (원을 따라 돌며 튐)
        for (const [C, p] of [[RC, cP], [LC, cPL]]) if (p > 0.01 && p < 0.995 && cA > 0.2) { const th = p * Math.PI * 2 - Math.PI + C.layers[0].sub.rotation.z + C.g.rotation.z, r = C.rad * 0.985 * C.g.scale.x, sp = C.g.position.clone().add(V(Math.cos(th) * r, Math.sin(th) * r, 2));
          for (let i = 0; i < 3; i++) ptA.add({ p: sp.clone(), v: V(rnd(-1, 1), rnd(-1, 1), rnd(0, 1)).multiplyScalar(rnd(40, 220)), life: 0, max: rnd(0.2, 0.55), s0: S * rnd(0.05, 0.1), s1: 0, a: 1, c: el.hot, c2: el.glow, drag: 2, g: -120 });
          ptA.add({ p: sp.clone(), v: V(), life: 0, max: 0.06, s0: S * 0.32, s1: S * 0.2, a: 1, c: el.hot }); }
        // ── 어둠 · 화면이 서서히 다가감 ──
        const darkA = sstep(seg(t, 0, T.dark1)) * (1 - sstep(seg(t, T.out0, T.end)));
        dimM.opacity = (dark ? 0.5 : 0.46) * darkA + 0.14 * back * darkA; vigM.opacity = 0.95 * darkA;
        const push = eInOut(seg(t, T.rise0, T.hush)) * (1 - eOut(seg(t, T.hit, T.hit + 0.18))) , punch = Math.max(0, 1 - (t - T.hit) / 0.5) * (t > T.hit ? 1 : 0);
        const fov = FOV - 3.2 * push + 2.4 * punch * punch; if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
        const zs = Math.tan(FOV / 2 * Math.PI / 180) / Math.tan(fov / 2 * Math.PI / 180); for (const e of zoomEls) e.style.scale = zs.toFixed(4);
        // ── 빛 ──
        eLight.color.set(el.light); eLight.position.copy(RG.root.visible ? RG.root.position.clone().add(V(0, 0, S * 2)) : cR.clone().add(V(0, -S * 0.4, S * 0.9)));
        eLight.intensity = cA * (1.6 + 1.5 * done + 3 * back + 4 * pass + 4 * boom) * (elK === "thunder" ? (Math.random() < 0.3 ? 1.8 : 0.6) : 0.9 + 0.2 * Math.sin(t * 23));
        lLight.color.set(el.light); lLight.position.copy(cL).add(V(0, -S * 0.4, S * 0.9)); lLight.intensity = cA * (1.4 + 1.2 * done);
        hemi.intensity = lerp(1.05, 0.55, darkA); key.intensity = lerp(2.5, 1.5, darkA);
        wall.material.opacity = (dark ? 0.5 : 0.32) * (RG.root.visible ? 1 : 0.6) * up * (1 - down);
        const fl = elK === "thunder" ? rnd(0.6, 1.25) : 1;
        UL.uRim.value = cA * (0.25 + 0.35 * done) * fl; UL.uVein.value = 0; UL.uT.value = t;
        UR.uRim.value = cA * (0.3 + 0.4 * done + 1.1 * back) * fl; UR.uVein.value = cA * (0.15 * done + 1.0 * back) * fl; UR.uT.value = t;
        UG.uRim.value = (0.55 + 0.7 * boom) * fl; UG.uVein.value = (0.45 + 0.55 * boom) * fl; UG.uT.value = t;
        aura(dt);
        // ── 사건 ──
        if (t >= T.hit && !hitDone) { hitDone = true; impact(); }
        if (t >= T.circ0) at("draw", () => sfx.scribe(elK, T.circ1 - T.circ0));
        if (t >= T.circ1) at("bell", () => { sfx.bell(elK); buzz(2); });
        if (t >= T.name) at("name", () => title.classList.add("on"));
        for (let i = 0; i < 3; i++) if (t >= T.back0 + 0.1 + i * 0.22) at("hb" + i, () => { sfx.heart(); buzz(1); });
        if (t >= T.back0) at("back", () => sfx.whoosh(0.6, 0.35));
        if (t >= T.back1) at("thrust", () => { sfx.whoosh(0.22, 1.1); title.classList.add("off"); });
        if (t >= tX) at("portal", () => { sfx.portal(elK); buzz(2); for (let i = 0; i < 60; i++) { const a = rnd(0, 6.283), r = S * 1.3; ptA.add({ p: cR.clone().add(V(Math.cos(a) * r, Math.sin(a) * r, 0)), v: V(Math.cos(a), Math.sin(a), 0).multiplyScalar(rnd(200, 700)), life: 0, max: rnd(0.3, 0.7), s0: S * 0.13, s1: 0, a: 1, c: el.hot, c2: el.glow, drag: 3 }); } });
        if (t >= T.ret0) at("ret", () => sfx.whoosh(0.4, 0.4));
        if (t >= T.out0) at("out", () => { sfx.fade(); for (const C of [RC, LC]) for (let i = 0; i < 90; i++) { const a = rnd(0, 6.283), r = rnd(0.3, 1.3) * C.rad; ptA.add({ p: C.g.position.clone().add(V(Math.cos(a) * r, Math.sin(a) * r, 0)), v: V(Math.cos(a) * rnd(20, 120), Math.sin(a) * rnd(20, 120) + 50, rnd(-20, 40)), life: 0, max: rnd(0.5, 1.1), s0: S * 0.07, s1: 0, a: 0.9, c: el.hot, c2: el.glow }); } });
        shakeA *= Math.exp(-dR * 7); cam.position.set(rnd(-1, 1) * shakeA + (trem ? rnd(-1, 1) * trem * 0.5 : 0), rnd(-1, 1) * shakeA, D);
        flash.material.opacity = Math.max(0, flash.material.opacity - dt * 2.6);
        for (const sh of shocks) if (sh.material.opacity > 0) { sh.userData.r += dt * M * 1.6 * sh.userData.sp; sh.scale.setScalar(sh.userData.r); sh.material.opacity = Math.max(0, sh.material.opacity - dt * 1.4); }
        chipStep(dt); boltsDraw(dt); ptA.step(dt); ptN.step(dt);
        if (X.mine("palm")) renderer.render(scene, cam);
        if (t >= T.end) { finish(); return; }
        raf = requestAnimationFrame(frame);
      }
      // 손에 감도는 기운 · 힘 모을 땐 둘레의 기운이 오른쪽 마법진으로 빨려 듦
      function aura(dt) {
        const on = t > T.circ0 + 0.2 && t < T.out0 + 0.2, big = RG.root.visible ? RG : null, rate = (big ? 130 : 30 + 50 * back) * (on ? 1 : 0);
        if (back > 0 && t < T.hush) { sucA += dt * 90 * back; while (sucA >= 1) { sucA -= 1; const a = rnd(0, 6.283), r = S * rnd(2.2, 3.6), p = cR.clone().add(V(Math.cos(a) * r, Math.sin(a) * r * 0.9, rnd(-0.3, 0.8) * S));
          ptA.add({ p, v: V(), to: cR, sp: rnd(320, 620), life: 0, max: 2, s0: S * rnd(0.05, 0.1), s1: S * 0.02, a: 0.9, c: el.glow, c2: el.hot, fin: 0.5 }); } }
        emitAcc += dt * rate;
        while (emitAcc >= 1) { emitAcc -= 1;
          const h = big && Math.random() < 0.75 ? big : R, sc = h === big ? h.root.scale.x : 1, p = bonePos(h, (Math.random() * 99) | 0);
          if (h === R && p.z < zC + 2) continue;
          if (h === big && p.z > zC - 2) continue;
          p.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-0.3, 0.6)).multiplyScalar(S * 0.12 * sc));
          if (elK === "fire" || elK === "hell") {
            const hell = elK === "hell";
            ptA.add({ p, v: V(rnd(-20, 20), rnd(60, 160) * Math.sqrt(sc), rnd(-10, 10)), life: 0, max: rnd(0.35, 0.7), s0: S * rnd(0.14, 0.22) * sc, s1: S * 0.03 * sc, a: hell ? 0.75 : 0.85, c: hell ? 0xff5a40 : 0xffd27a, c2: hell ? 0x8a0010 : 0xff4a10, drag: 1 });
            if (hell && Math.random() < 0.35) ptN.add({ p: p.clone().add(V(0, 0, S * 0.2 * sc)), v: V(rnd(-15, 15), rnd(50, 120) * Math.sqrt(sc), 0), life: 0, max: rnd(0.6, 1.2), s0: S * 0.2 * sc, s1: S * 0.5 * sc, a: 0.28, c: 0x1a0306, c2: 0x050102, drag: 1.2 });
            if (Math.random() < 0.25) ptA.add({ p: p.clone(), v: V(rnd(-60, 60), rnd(80, 220), rnd(-30, 30)), life: 0, max: rnd(0.4, 0.9), s0: S * 0.035, s1: 0, a: 1, c: hell ? 0xff6040 : 0xffe0a0, g: -40 });
          } else if (elK === "water") {
            if (Math.random() < 0.5) { const c = h.root.position.clone(); ptN.add({ p, v: V(), orb: { c, a: rnd(0, 6.283), w: rnd(3, 6) * (Math.random() < 0.5 ? 1 : -1), r: S * rnd(0.55, 0.9) * sc, dy: rnd(-10, 30) }, life: 0, max: rnd(0.5, 1), s0: S * 0.09 * sc, s1: S * 0.05 * sc, a: 0.85, c: 0x2aa0e0, c2: 0x7fd8ff }); }
            ptA.add({ p, v: V(rnd(-30, 30), rnd(-80, 20), rnd(-20, 20)), life: 0, max: rnd(0.4, 0.8), s0: S * 0.07 * sc, s1: S * 0.02, a: 0.8, c: 0xd6f6ff, c2: 0x3fc0ff, g: -260 });
          } else {
            ptA.add({ p, v: V(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(rnd(60, 220)), life: 0, max: rnd(0.08, 0.22), s0: S * 0.06 * sc, s1: 0, a: 1, c: 0xffffff, c2: 0x7cc8ff, drag: 4 });
          }
        }
        if (elK === "thunder" && on) { boltT -= dt; if (boltT <= 0) { boltT = rnd(0.03, 0.08) / (0.5 + back + (big ? 1 : 0));
          for (let k = 0; k < (big ? 3 : 2); k++) { const h = big && Math.random() < 0.7 ? big : R, a = bonePos(h, (Math.random() * 99) | 0), b = bonePos(h, (Math.random() * 99) | 0);
            if ((h === R && (a.z < zC || b.z < zC)) || (h === big && (a.z > zC || b.z > zC))) continue;
            const sc = h === big ? big.root.scale.x : 1; addBolt(a, b, S * 0.035 * sc, rnd(0.06, 0.12), 0.25); }
          if (Math.random() < 0.45) { const C = Math.random() < 0.7 ? RC : LC, a = rnd(0, 6.283), b = a + rnd(0.6, 1.6), r = C.rad * C.g.scale.x; addBolt(C.g.position.clone().add(V(Math.cos(a) * r, Math.sin(a) * r, 1)), C.g.position.clone().add(V(Math.cos(b) * r, Math.sin(b) * r, 1)), S * 0.03, 0.1, 0.3); } } }
      }
      function addBolt(a, b, w, life, jag) {
        const n = 7 + ((Math.random() * 6) | 0), pts = [], d = b.clone().sub(a), Lb = d.length(), px = V(-d.y, d.x, 0).normalize();
        for (let i = 0; i <= n; i++) { const u = i / n, off = i && i < n ? rnd(-1, 1) * Lb * jag * Math.sin(Math.PI * u) : 0; pts.push(a.clone().lerp(b, u).addScaledVector(px, off)); }
        bolts.push({ pts, w, life, max: life });
        if (Math.random() < 0.4 && Lb > S * 0.3) { const k = 2 + ((Math.random() * (n - 3)) | 0), q = pts[k], e = q.clone().add(V(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(Lb * 0.4)); const m = 4, bp = []; for (let i = 0; i <= m; i++) bp.push(q.clone().lerp(e, i / m).add(V(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(i && i < m ? Lb * 0.06 : 0))); bolts.push({ pts: bp, w: w * 0.6, life, max: life }); }
      }
      function boltsDraw(dt) {
        let q = 0;
        for (let i = bolts.length - 1; i >= 0; i--) { const B = bolts[i]; B.life -= dt; if (B.life <= 0) bolts.splice(i, 1); }
        for (const B of bolts) { const a = Math.min(1, (B.life / B.max) * 1.6);
          for (let i = 1; i < B.pts.length && q < MAXQ; i++, q++) { const p0 = B.pts[i - 1], p1 = B.pts[i], dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * B.w, ny = dx / l * B.w;
            bPos.set([p0.x + nx, p0.y + ny, p0.z, p0.x - nx, p0.y - ny, p0.z, p1.x + nx, p1.y + ny, p1.z, p1.x - nx, p1.y - ny, p1.z], q * 12); bA.set([a, a, a, a], q * 4); } }
        for (let i = q; i < MAXQ; i++) bA.set([0, 0, 0, 0], i * 4);
        bGeo.setDrawRange(0, Math.max(1, q) * 6); bGeo.attributes.position.needsUpdate = bGeo.attributes.aA.needsUpdate = true;
        boltInk.visible = boltGlo.visible = q > 0; boltInk.material.uniforms.uCol.value.set(elK === "thunder" ? 0x0d3a8a : el.ink);
      }
      // 눈앞으로 튀는 달력 조각 (종이 · 칸 색)
      function chipStep(dt) { if (!chips.visible) return; let any = false;
        for (let i = 0; i < NCH; i++) { const c = CH[i]; if (c.s.x <= 0) { chips.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; } any = true;
          c.v.y -= 1500 * dt; c.v.multiplyScalar(Math.exp(-0.6 * dt)); c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt); if (c.p.z > D - 30 || c.p.y < -vh) c.s.set(0, 0, 0);
          chips.setMatrixAt(i, m4.compose(c.p, q4.setFromEuler(e4.set(c.r.x, c.r.y, c.r.z)), c.s)); }
        chips.instanceMatrix.needsUpdate = true; if (!any) chips.visible = false; }
      function impact() {
        const sp = toS(I), w = S * Gs * D / (D - I.z);
        o.onImpact && o.onImpact({ x: sp.x, y: sp.y, w, roll: 0.06, el: elK });
        sfx.impact(elK); buzz([3, 60, 3, 90, 3, 140, 2, 200, 1]);
        shakeA = 22; flash.position.copy(I).setZ(2); flash.scale.setScalar(w * 3.6); flash.material.opacity = 1; flash.material.color.copy(glowC);
        shocks.forEach((sh, i) => { sh.position.set(I.x, I.y + w * 0.3, sh.position.z); sh.userData.r = w * (0.45 + i * 0.05); sh.userData.sp = 1 + i * 0.35; sh.scale.setScalar(sh.userData.r); sh.material.opacity = i ? 0.85 : (dark ? 0.6 : 0.85); sh.material.color.set(i ? el.glow : el.ink); });
        for (let i = 0; i < 160; i++) { const a = rnd(0, 6.283), r = w * rnd(0.3, 0.9), p = I.clone().add(V(Math.cos(a) * r, Math.sin(a) * r * 1.2 + w * 0.3, 4)), v = V(Math.cos(a), Math.sin(a), 0).multiplyScalar(rnd(300, 1200));
          if (elK === "water") ptN.add({ p, v, life: 0, max: rnd(0.5, 1), s0: w * 0.05, s1: w * 0.02, a: 0.85, c: 0x2aa0e0, c2: 0x9fe4ff, g: -1400, drag: 0.6 });
          else if (elK === "hell" && i % 2) ptN.add({ p, v: v.multiplyScalar(0.4), life: 0, max: rnd(0.8, 1.5), s0: w * 0.06, s1: w * 0.22, a: 0.6, c: 0x1a0306, c2: 0x050102, drag: 2 });
          else ptA.add({ p, v, life: 0, max: rnd(0.3, 0.8), s0: w * 0.06, s1: 0, a: 1, c: el.hot, c2: el.glow, drag: 2.5 });
        }
        // 손바닥 둘레에서 깨진 조각이 눈앞으로 튀어 옴
        const pal = o.colors && o.colors.length ? o.colors : ["#ffffff", "#f4f1ea", "#e8e4dc"];
        chips.visible = true; CH.forEach((c, i) => { const a = rnd(0, 6.283), r = w * rnd(0.45, 0.85); c.p.set(I.x + Math.cos(a) * r, I.y + w * 0.3 + Math.sin(a) * r * 1.25, rnd(5, 30));
          c.v.set(Math.cos(a) * rnd(150, 600), Math.sin(a) * rnd(100, 500) + rnd(100, 500), rnd(500, 1500)); c.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); c.w.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14));
          const s = rnd(5, 16) * (Math.random() < 0.15 ? 2 : 1); c.s.set(s, s * rnd(0.5, 1.2), 1); chips.setColorAt(i, chipC.set(pal[(Math.random() * pal.length) | 0])); });
        chips.instanceColor.needsUpdate = true;
        if (elK === "thunder") for (let i = 0; i < 12; i++) { const a = rnd(0, 6.283), r = w * rnd(0.9, 1.8); addBolt(I.clone().setZ(3), I.clone().add(V(Math.cos(a) * r, Math.sin(a) * r, 3)), w * 0.012, rnd(0.15, 0.35), 0.22); }
      }
      function finish() {
        cancelAnimationFrame(raf); scene.remove(RC.g, LC.g);
        for (const C of [RC, LC]) C.g.traverse(m => { if (m.material) { if (m.material.uniforms && m.material.uniforms.map) m.material.uniforms.map.value.dispose(); m.material.dispose(); } if (m.geometry) m.geometry.dispose(); });
        for (const e of zoomEls) e.style.scale = ""; title.remove(); document.documentElement.classList.remove("palm-on");
        cam.fov = FOV; cam.updateProjectionMatrix(); hemi.intensity = 1.05; key.intensity = 2.5;
        X.drop("palm"); if (!X.lost) stage = Promise.resolve(api);
        o.onEnd && o.onEnd(); resolve();
      }
      raf = requestAnimationFrame(frame);
    });
  }
  const api = { vw, vh, dark, X, run, dispose };
  return api;
}

// ── 소리 (짓누르기와 같은 오디오 출력) ──
function makeSound(get) {
  const A = () => get && get();
  const noise = (a, t, type, f0, f1, q, gain, att, dur, out) => {
    const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain();
    s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  };
  const tone = (a, t, type, f0, f1, gain, att, dur, out) => {
    const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || a.out); o.start(t); o.stop(t + dur + 0.05);
  };
  const ring = (a, t, f0, gain, decay) => [1, 2.32, 4.25, 6.63].forEach((m, i) => tone(a, t, "sine", f0 * m, f0 * m * 0.995, gain / (1 + i * 1.3), 0.002, decay / (1 + i * 0.5)));
  return {
    // 낮은 울림 + 사람 목소리 같은 합창(모음 'ㅏ' 공명)이 정적 직전까지 차오르다 딱 끊김
    ritual(el, cut) { const a = A(); if (!a) return; const c = a.c, t = c.currentTime, out = c.createGain(), hell = el === "hell";
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.5, t + 0.8); out.gain.exponentialRampToValueAtTime(1, t + cut - 0.1); out.gain.exponentialRampToValueAtTime(0.0001, t + cut + 0.05); out.connect(a.out);
      const base = hell ? 46.2 : el === "water" ? 58.3 : 55, lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime(1100, t + cut); lp.connect(out);
      const oscs = [];
      for (const [f, ty, g] of [[base, "sawtooth", 0.07], [base * 1.5, "sawtooth", 0.04], [base * 2, "triangle", 0.08], [base / 2, "sine", 0.22]]) { const o = c.createOscillator(), gg = c.createGain(); o.type = ty; o.frequency.value = f; gg.gain.value = g; o.connect(gg); gg.connect(lp); oscs.push(o); }
      const chG = c.createGain(); chG.gain.setValueAtTime(0.0001, t); chG.gain.setValueAtTime(0.0001, t + 0.7); chG.gain.exponentialRampToValueAtTime(0.16, t + cut - 0.2); chG.connect(out);
      const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(); f1.type = f2.type = "bandpass"; f1.frequency.value = 730; f1.Q.value = 7; f2.frequency.value = 1100; f2.Q.value = 9; f1.connect(chG); f2.connect(chG);
      const notes = hell ? [base * 4, base * 4 * 1.414, base * 6, base * 8.4] : [base * 4, base * 4.76, base * 6, base * 8];
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.1; lg.gain.value = 2.6; lfo.connect(lg); oscs.push(lfo);
      for (const f of notes) for (const d of [-3, 3]) { const o = c.createOscillator(), gg = c.createGain(); o.type = "sawtooth"; o.frequency.value = f + d * 0.6; lg.connect(o.frequency); gg.gain.value = 0.05; o.connect(gg); gg.connect(f1); gg.connect(f2); oscs.push(o); }
      oscs.forEach(o => { o.start(t); o.stop(t + cut + 0.2); });
      noise(a, t, "bandpass", 200, 1400, 1.4, 0.12, cut * 0.9, cut, out); },
    // 마법진을 새기는 소리: 쓸리는 소리 + 불티 (원소마다)
    scribe(el, d) { const a = A(); if (!a) return; const t = a.c.currentTime;
      noise(a, t, "bandpass", 1800, 4200, 3, 0.1, d * 0.4, d);
      for (let i = 0; i < 40; i++) { const at = t + Math.random() * d; if (el === "water") tone(a, at, "sine", rnd(700, 1400), rnd(1400, 2600), 0.03, 0.004, 0.06); else noise(a, at, "highpass", rnd(3000, 6000), 2500, 1, rnd(0.03, 0.1), 0.001, rnd(0.01, 0.04)); } },
    bell(el) { const a = A(); if (!a) return; const t = a.c.currentTime; const f = el === "hell" ? 82 : el === "water" ? 131 : el === "thunder" ? 147 : 110;
      ring(a, t, f, 0.5, 6); ring(a, t, f * 1.5, 0.18, 4.5); tone(a, t, "sine", f / 2, f / 2 * 0.99, 0.35, 0.01, 5); noise(a, t, "lowpass", 900, 120, 0.7, 0.25, 0.01, 2.5); },
    heart() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 62, 38, 0.7, 0.004, 0.18); tone(a, t + 0.17, "sine", 55, 36, 0.45, 0.004, 0.16); },
    whoosh(d, k) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 300, 2600, 0.8, 0.5 * k, d * 0.7, d + 0.05); },
    portal(el) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 180, 60, 0.6, 0.01, 0.5); noise(a, t, "bandpass", 3000, 600, 1, 0.4, 0.01, 0.4); ring(a, t, 330, 0.12, 1.2); },
    impact(el) { const a = A(); if (!a) return; const t = a.c.currentTime;
      tone(a, t, "sine", 95, 22, 1, 0.004, 1.6); tone(a, t, "triangle", 48, 26, 0.6, 0.01, 2); noise(a, t, "lowpass", 2200, 50, 0.7, 1, 0.005, 2.2); noise(a, t, "highpass", 2500, 1500, 0.7, 0.45, 0.001, 0.18);
      for (const d of [0.35, 0.8, 1.4]) noise(a, t + d, "lowpass", 600, 70, 0.7, 0.35 / (1 + d), 0.08, 1.4);   // 멀리서 되돌아오는 울림
      if (el === "thunder") { noise(a, t, "highpass", 6000, 2000, 0.8, 0.8, 0.001, 0.5); for (const d of [0.2, 0.55, 1]) noise(a, t + d, "lowpass", 800, 90, 0.7, 0.5 / (1 + d), 0.05, 1.2); }
      if (el === "fire" || el === "hell") { noise(a, t, "lowpass", 900, 120, 0.7, el === "hell" ? 0.95 : 0.6, 0.04, el === "hell" ? 2.6 : 1.6); if (el === "hell") { tone(a, t, "sawtooth", 46, 28, 0.3, 0.02, 2.2); tone(a, t + 0.05, "sawtooth", 65, 33, 0.18, 0.02, 2); } }
      if (el === "water") { noise(a, t, "bandpass", 900, 300, 0.8, 0.85, 0.01, 1.2); for (let i = 0; i < 30; i++) { const at = t + 0.1 + Math.random() * 1, f = rnd(600, 1600); tone(a, at, "sine", f, f * 2.2, 0.06, 0.004, 0.07); } } },
    fade() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "highpass", 3000, 7000, 0.8, 0.14, 0.05, 0.8); ring(a, t, 523, 0.05, 2); },
  };
}
