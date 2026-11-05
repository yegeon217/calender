// 핵 (3D): 달력 칸마다 두께가 생겨 벽돌 벽이 되고, 1인칭 시점이 뒤로 살짝 물러남 → 오른쪽에서 그 사람이 걸어 나오고 땅에서 빨간 버튼이 올라옴 →
// 안경을 고쳐 쓰고(안경 사진) → 일반 사진으로 돌아와 천천히 버튼 쪽으로 손을 내리다 누르기 직전에 홱 뺌 (두 번) → 다시 안경 → 일반 → 진짜로 꾹 →
// 경보 · 먼 하늘에서 미사일이 불기둥과 연기 줄을 끌고 내리꽂혀 달력 벽에 쾅 →
// 번쩍 · 불덩이 · 수증기 막 · 벽돌이 사방으로 날아감 · 땅을 쓸며 번지는 먼지 · 버섯구름(cloudvol.js)이 솟음 ·
// 충격파가 도착하면 그 사람은 공중으로 튕겨 굴러가고, 카메라도 크게 밀려나 흔들리며 구름을 올려다봄 → 어두워지며 끝 (달력은 새로)
// 좌표: 화면 픽셀 = 월드 단위로 시작 (z=0이 화면, 카메라는 z=D) · 바닥은 y = -vh/2 · 층: 0 하늘·땅 → (구름) → 1 앞의 물체들
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { loadHand, preloadHand } from "./hand.js";
import { buildLeader } from "./leader.js";
import { buildCloud, cloudAt } from "./cloudvol.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, V, buzz, vnoise } from "./fx-util.js";

let cloudP = null, cloudX = null, leaderP = null;
const getLeader = () => leaderP || (leaderP = Promise.all([loadHand(new THREE.MeshStandardMaterial()), loadHand(new THREE.MeshStandardMaterial())]).then(([HR, HL]) => buildLeader({ hands: [HR, HL] })).catch(e => { leaderP = null; throw e; }));
const getCloud = X => { if (!cloudP || cloudX !== X) { cloudX = X; cloudP = buildCloud(X); } return cloudP; };
export function prewarmNuke() { preloadHand(); getLeader().catch(() => {}); getCloud(fx3d()).then(c => c.warm()).catch(() => {}); }

const T = { pull: 1.6, walk0: 0.8, walk1: 2.45, rise0: 1.15, rise1: 2.0, g1a: 2.5, g1on: 2.82, g1off: 3.28, g1b: 3.58, f1a: 3.6, f1h: 4.45, f1b: 4.72, f2a: 4.8, f2h: 5.75, f2b: 6.02, g2a: 6.08, g2on: 6.38, g2off: 6.8, g2b: 7.08, pr0: 7.1, pr1: 7.42, launch: 7.6, imp: 10.1, end: 17.8 };

function canvasTex(w, h, draw, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const puffTex = () => canvasTex(128, 128, (x, w, h) => { const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w - 0.5, v = j / h - 0.5, r = Math.hypot(u, v) * 2, n = vnoise(i * 0.05, j * 0.05) * 0.55 + vnoise(i * 0.13 + 7, j * 0.13) * 0.3 + vnoise(i * 0.3, j * 0.3 + 3) * 0.15;
    const a = clamp((1 - r) * 1.7 - (1 - n) * 0.95, 0, 1), k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * a * 255; } x.putImageData(im, 0, 0); }, false);
const glowTex = () => canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,240,200,.75)"); g.addColorStop(0.6, "rgba(255,150,60,.2)"); g.addColorStop(1, "rgba(255,90,20,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); });
const PT_VS = `attribute float aS, aR; attribute vec4 aC; uniform float uScale; varying vec4 vC; varying float vR;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(aS * uScale / -mv.z, 900.0); vC = aC; vR = aR; }`;
const PT_FS = `uniform sampler2D map; uniform float uShade; varying vec4 vC; varying float vR;
void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 t = texture2D(map, q); float sh = mix(1.0, mix(1.12, 0.58, gl_PointCoord.y), uShade), a = t.a * vC.a; if (a < 0.004) discard;
  gl_FragColor = vec4(vC.rgb * sh, a);
  #include <colorspace_fragment>
}`;
// 미사일 몸통 무늬: 칠 · 판 이음매 · 리벳 · 띠 · 글자
const misTex = () => canvasTex(512, 1024, (x, w, h) => {
  x.fillStyle = "#c9cbc6"; x.fillRect(0, 0, w, h); const im = x.getImageData(0, 0, w, h), d = im.data; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4, n = (vnoise(i * 0.02, j * 0.008) - 0.5) * 26 + (Math.random() - 0.5) * 6; d[k] += n; d[k + 1] += n; d[k + 2] += n; } x.putImageData(im, 0, 0);
  x.fillStyle = "#2c3128"; x.fillRect(0, 0, w, 92); x.fillStyle = "#16171a"; for (let i = 0; i < 4; i++) x.fillRect(i * 128, 96, 64, 150);   // 돌아가는 걸 알아보는 격자
  for (let i = 0; i < 4; i++) x.fillRect(i * 128 + 64, 246, 64, 90);
  x.fillStyle = "#3f4a35"; x.fillRect(0, 700, w, 324); x.fillStyle = "#c8ac3a"; x.fillRect(0, 684, w, 14); x.fillStyle = "#a3271f"; x.fillRect(0, 372, w, 16);
  x.strokeStyle = "rgba(20,20,24,.5)"; x.lineWidth = 2; for (const y of [90, 340, 560, 690, 860]) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 340); x.lineTo(i * 64, 860); x.stroke(); }
  x.fillStyle = "rgba(20,20,24,.65)"; for (const y of [94, 336, 556, 694, 856]) for (let i = 0; i < 64; i++) x.fillRect(i * 8 + 3, y, 2, 2);
  x.fillStyle = "#17181b"; x.font = "bold 44px monospace"; x.save(); x.translate(90, 640); x.rotate(-Math.PI / 2); x.fillText("DANGER", 0, 0); x.restore(); x.save(); x.translate(346, 640); x.rotate(-Math.PI / 2); x.fillText("DANGER", 0, 0); x.restore();
});

export async function startNuke(o) {
  const X = fx3d(), { renderer, PR, vw, vh, D } = X, dark = matchMedia("(prefers-color-scheme: dark)").matches, FG = 1;
  const scene = new THREE.Scene(); scene.environment = X.env; scene.environmentIntensity = 0.55;
  const cam = new THREE.PerspectiveCamera(X.FOV, vw / vh, 5, D * 14); cam.position.set(0, 0, D); cam.layers.enableAll();
  const Y0 = -vh / 2, fg = o2 => { o2.traverse(m => m.layers.set(FG)); return o2; };
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x7a7060, 1.1); hemi.layers.enableAll(); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.5); sun.layers.enableAll(); sun.position.set(-vh * 1.3, vh * 2.4, vh * 2.2); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -vh * 1.8, right: vh * 1.8, top: vh * 1.8, bottom: -vh * 1.8, near: 10, far: vh * 8 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.8;
  sun.target.position.set(vw * 0.1, Y0, D * 0.3); scene.add(sun, sun.target);
  const boomL = new THREE.PointLight(0xffa050, 0, vh * 9, 0.7); boomL.layers.enableAll(); scene.add(boomL);
  // ── 하늘 · 땅 ──
  const skyU = { uA: { value: 0 }, uTop: { value: new THREE.Color(dark ? 0x0c1224 : 0x3f6fb4) }, uHor: { value: new THREE.Color(dark ? 0x3a3448 : 0xd8d6cc) }, uBoom: { value: 0 }, uDim: { value: 0 }, uSun: { value: V(-0.45, 0.62, 0.64).normalize() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(D * 11, 40, 20), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uA, uBoom, uDim; uniform vec3 uTop, uHor, uSun; varying vec3 vD;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){ vec3 d = normalize(vD); float y = d.y; vec3 c = mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.5)); c = mix(c, uHor * 0.85, smoothstep(0.0, -0.04, y));
  if (y > 0.0) { vec2 q = d.xz / (y + 0.12) * 1.3; float n = fbm(q + 3.1), cl = smoothstep(0.5, 0.82, n) * smoothstep(0.0, 0.18, y); c = mix(c, mix(uHor, vec3(1.0), 0.5), cl * 0.55); }
  float az = atan(d.x, -d.z), r1 = 0.012 + 0.05 * fbm(vec2(az * 3.1, 1.7)), r2 = 0.004 + 0.03 * fbm(vec2(az * 7.3 + 4.0, 7.3));
  c = mix(c, mix(uHor, vec3(0.4, 0.45, 0.54), 0.5), smoothstep(r1 + 0.0012, r1 - 0.0012, y)); c = mix(c, mix(uHor, vec3(0.26, 0.3, 0.33), 0.72), smoothstep(r2 + 0.001, r2 - 0.001, y));
  c = mix(c, c * vec3(0.5, 0.42, 0.36), uDim); c = mix(c, vec3(1.0, 0.6, 0.3), uBoom * (1.0 - smoothstep(0.0, 0.55, abs(y))) * 0.7);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor *= uA; }` }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const gTex = canvasTex(512, 512, (x, w, h) => { const im = x.createImageData(w, h), d = im.data, b = dark ? 0.55 : 1; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = vnoise(i * 0.025, j * 0.025) * 0.5 + vnoise(i * 0.09, j * 0.09) * 0.3 + vnoise(i * 0.3, j * 0.3) * 0.13 + Math.random() * 0.07, k = (j * w + i) * 4; d[k] = (88 + n * 74) * b; d[k + 1] = (80 + n * 66) * b; d[k + 2] = (68 + n * 54) * b; d[k + 3] = 255; } x.putImageData(im, 0, 0); });
  gTex.wrapS = gTex.wrapT = THREE.MirroredRepeatWrapping; gTex.repeat.set(34, 34); const fadeU = { uCam: { value: V() }, uNear: { value: vh * 3.6 }, uFar: { value: vh * 12 } };
  const gMat = new THREE.MeshStandardMaterial({ map: gTex, bumpMap: gTex, bumpScale: 2.2, roughness: 0.96, transparent: true, opacity: 0, depthWrite: false });
  gMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, fadeU); sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = "uniform vec3 uCam; uniform float uNear, uFar; varying vec3 vWp;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n float gA = texture2D(map, vMapUv * 0.083 + 0.31).g, gB = texture2D(map, vMapUv * 0.31 + 0.7).g, gC = texture2D(map, vMapUv * 4.7).g; diffuseColor.rgb *= (0.45 + 0.55 * gA / 0.16) * (0.6 + 0.4 * gB / 0.16) * (0.72 + 0.28 * gC / 0.16);").replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.a *= 1.0 - smoothstep(uNear, uFar, length(vWp.xz - uCam.xz));"); };
  gMat.customProgramCacheKey = () => "nukeGround";
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(vh * 44, vh * 44), gMat); ground.rotation.x = -Math.PI / 2; ground.position.y = Y0 - 1; ground.receiveShadow = true; ground.renderOrder = -5; scene.add(ground);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(8,6,5,.97)"); g.addColorStop(0.55, "rgba(24,18,12,.8)"); g.addColorStop(1, "rgba(40,30,20,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); }), transparent: true, opacity: 0, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.y = Y0 + 0.5; scorch.renderOrder = -4; scene.add(scorch);

  // ── 달력 → 벽돌 벽 (칸마다 두께, 앞면은 칸 그림 · 처음엔 납작했다가 두꺼워짐) ──
  const wallG = new THREE.Group(); scene.add(wallG); const bricks = [], texs = [];
  for (const p of o.pieces) {
    const dz = clamp(Math.min(p.W, p.H) * 0.16, 7, 14), tex = new THREE.CanvasTexture(p.tex); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texs.push(tex);
    const side = new THREE.Color(p.colors && p.colors[0] ? p.colors[0] : "#e8e4dc"); side.multiplyScalar(0.62);
    const ms = new THREE.MeshStandardMaterial({ color: side, roughness: 0.9 }), mf = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, color: 0x777777, roughness: 0.82, alphaTest: 0.02, transparent: p.alpha < 1, opacity: p.alpha, toneMapped: false });
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.W, p.H, dz), [ms, ms, ms, ms, mf, ms]); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    m.position.set(p.cx - vw / 2, vh / 2 - p.cy, 0); m.rotation.z = -p.th; m.scale.z = 0.02; wallG.add(m); bricks.push({ m, dz, z0: 0, ms, mf, a0: p.alpha, v: V(), w: V(), vap: false, delay: 0, free: false });
  }
  // 뒷벽: 칸 사이가 뚫려 보이지 않게 조각으로 된 얇은 벽을 땅까지 세움 (폭발 때 같이 날아감)
  const backM = new THREE.MeshStandardMaterial({ color: dark ? 0x45464c : 0xbdb8ad, roughness: 0.95, transparent: true, opacity: 0 });
  { let x0 = 1e9, x1 = -1e9, y0 = 1e9; for (const p of o.pieces) { x0 = Math.min(x0, p.cx - p.W / 2); x1 = Math.max(x1, p.cx + p.W / 2); y0 = Math.min(y0, p.cy - p.H / 2); }
    x0 -= 6; x1 += 6; y0 -= 8; const y1 = vh, NX = 8, NY = 11, tw = (x1 - x0) / NX, thh = (y1 - y0) / NY, g = new THREE.BoxGeometry(tw, thh, 9);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const m = new THREE.Mesh(g, backM); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.position.set(x0 + (i + 0.5) * tw - vw / 2, vh / 2 - (y0 + (j + 0.5) * thh), -19); m.scale.z = 0.02; wallG.add(m); bricks.push({ m, dz: 9, z0: -15, v: V(), w: V(), vap: false, delay: 0, free: false }); } }
  fg(wallG);
  // ── 그 사람 · 빨간 버튼 ──
  const K = await getLeader(), HU = vh * 0.285; if (import.meta.env.DEV) window.__nukeK = K; K.root.rotation.order = "XYZ"; K.root.rotation.set(0, 0, 0); K.show("a"); K.tint(new THREE.Color(1, 1, 1), 0); K.root.scale.setScalar(HU); scene.add(K.root); fg(K.root); K.root.visible = false;
  const camEnd = V(vw * 0.08, vh * 0.1, D * 1.5), lookEnd = V(vw * 0.11, -vh * 0.15, 0);
  const spot = V(vw * 0.36, Y0, D * 0.5), from = V(vw * 1.75, Y0, D * 0.42), yawEnd = Math.atan2(camEnd.x - spot.x, camEnd.z - spot.z) - 0.42;
  const BTN = V(-0.27, 1.05, 0.48);   // 버튼 윗면 (그 사람 기준)
  const con = new THREE.Group(); con.position.copy(spot); con.rotation.y = yawEnd; con.scale.setScalar(HU); scene.add(con);
  const cinner = new THREE.Group(); cinner.position.set(BTN.x, 0, BTN.z); con.add(cinner);
  const parts = {};
  { const clip = [new THREE.Plane(V(0, 1, 0), -Y0)], mB = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.38, metalness: 0.8, clippingPlanes: clip }), mD = new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.5, metalness: 0.4, clippingPlanes: clip }), mS = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.3, metalness: 0.95, clippingPlanes: clip });
    const mY = new THREE.MeshStandardMaterial({ map: canvasTex(512, 32, (x, w, h) => { for (let i = 0; i < 32; i++) { x.fillStyle = i % 2 ? "#141414" : "#f0c400"; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, h); x.lineTo(i * 16 - 8, h); x.fill(); } }), roughness: 0.5 });
    const mR = new THREE.MeshPhysicalMaterial({ color: 0xd20c0e, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x5a0000, emissiveIntensity: 0.5 }), mL = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 0 });
    const add = (g, m, y) => { const x = new THREE.Mesh(g, m); x.position.y = y; x.castShadow = x.receiveShadow = true; cinner.add(x); return x; };
    add(new THREE.CylinderGeometry(0.17, 0.215, 0.045, 40), mD, 0.022); add(new THREE.CylinderGeometry(0.1, 0.16, 0.08, 36), mB, 0.08); add(new THREE.CylinderGeometry(0.052, 0.082, 0.84, 28), mB, 0.52); add(new THREE.CylinderGeometry(0.086, 0.086, 0.016, 28), mS, 0.15); add(new THREE.CylinderGeometry(0.066, 0.066, 0.014, 28), mS, 0.6); add(new THREE.CylinderGeometry(0.17, 0.066, 0.075, 44), mB, 0.975); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, b = add(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6), mS, 0.05); b.position.x = Math.cos(a) * 0.185; b.position.z = Math.sin(a) * 0.185; } add(new THREE.TorusGeometry(0.15, 0.012, 12, 44).rotateX(Math.PI / 2), mD, 1.012); add(new THREE.CylinderGeometry(0.142, 0.142, 0.012, 44), mY, 1.014);
    parts.cap = add(new THREE.SphereGeometry(0.082, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), mR, 1.018); parts.cap.scale.y = 0.62; parts.lamp = add(new THREE.SphereGeometry(0.016, 14, 10), mL, 1.02); parts.lamp.position.x = 0.115; parts.mL = mL; parts.mR = mR; }
  fg(con); con.traverse(q => { if (q.isMesh) q.frustumCulled = false; }); con.visible = false;
  // ── 미사일: 뾰족한 머리 · 마디 · 날개 · 불기둥 ──
  const MS = vh * 0.3, mis = new THREE.Group(); mis.scale.setScalar(MS); scene.add(mis);
  { const mt = misTex(); mt.flipY = false; const mW = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.42, metalness: 0.28, bumpMap: mt, bumpScale: 0.4 }), mK = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.42, metalness: 0.5 });
    const P0 = [[0, 0.62], [0.016, 0.6], [0.036, 0.54], [0.05, 0.46], [0.058, 0.38], [0.06, 0.3], [0.06, 0.13], [0.064, 0.124], [0.064, 0.11], [0.06, 0.104], [0.06, -0.1], [0.066, -0.106], [0.066, -0.122], [0.06, -0.128], [0.06, -0.4]], L = [0];
    for (let i = 1; i < P0.length; i++) L.push(L[i - 1] + Math.hypot(P0[i][0] - P0[i - 1][0], P0[i][1] - P0[i - 1][1]));
    const prof = []; for (let k = 0; k <= 96; k++) { const s = L[L.length - 1] * k / 96; let i = 1; while (i < P0.length - 1 && L[i] < s) i++; const a = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); prof.push(new THREE.Vector2(lerp(P0[i - 1][0], P0[i][0], a), lerp(P0[i - 1][1], P0[i][1], a))); }
    for (const a of [0.7, 3.84]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.009, 0.46), mK); r.position.set(Math.cos(a) * 0.062, Math.sin(a) * 0.062, 0.03); r.rotation.z = a; mis.add(r); }
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 44).rotateX(Math.PI / 2), mW); mis.add(body);
    const noz = new THREE.Mesh(new THREE.LatheGeometry([[0.03, -0.4], [0.04, -0.44], [0.052, -0.47], [0.046, -0.47], [0.028, -0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 28).rotateX(Math.PI / 2), mK); mis.add(noz);
    for (let i = 0; i < 4; i++) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.11, -0.05); sh.lineTo(0.11, -0.13); sh.lineTo(0, -0.17); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }).translate(0.056, 0, -0.003); const f = new THREE.Mesh(g, mK); f.position.z = -0.24; f.rotation.set(Math.PI / 2, 0, 0); const w = new THREE.Group(); w.add(f); w.rotation.z = (i * Math.PI) / 2 + Math.PI / 4; mis.add(w); }
    mis.traverse(q => { if (q.isMesh) q.frustumCulled = false; }); }
  fg(mis); mis.visible = false;
  const glw = glowTex(), puff = puffTex(), plume = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.56, 24, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.74), new THREE.MeshBasicMaterial({ map: canvasTex(4, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,120,40,0)"); g.addColorStop(0.5, "rgba(255,180,90,.85)"); g.addColorStop(1, "rgba(255,250,220,1)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); mis.add(plume); plume.layers.set(FG);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: 0xffc080, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glare.layers.set(FG); scene.add(glare); glare.visible = false;
  // ── 입자: 미사일 연기 · 튀는 조각 ──
  function makePts(N, tex, add, shade) { const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), sz = new Float32Array(N), rt = new Float32Array(N), col = new Float32Array(N * 4);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aS", new THREE.BufferAttribute(sz, 1)); geo.setAttribute("aR", new THREE.BufferAttribute(rt, 1)); geo.setAttribute("aC", new THREE.BufferAttribute(col, 4));
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR }, map: { value: tex }, uShade: { value: shade ? 1 : 0 } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; m.renderOrder = add ? 6 : 5; m.layers.set(FG); scene.add(m);
    const P = [], c = new THREE.Color(); return { P, add(q) { if (P.length >= N) P.shift(); q.life = 0; P.push(q); }, step(dt) { for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.life += dt; if (q.life >= q.max) { P.splice(i, 1); continue; } q.v.y += (q.g || 0) * dt; q.v.multiplyScalar(Math.exp(-(q.drag || 0) * dt)); q.p.addScaledVector(q.v, dt); q.rot += (q.w || 0) * dt; }
      for (let i = 0; i < N; i++) { const q = P[i]; if (!q) { col[i * 4 + 3] = 0; continue; } const u = q.life / q.max; pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; sz[i] = lerp(q.s0, q.s1, 1 - Math.pow(1 - u, 2)); rt[i] = q.rot || 0; c.set(q.c); col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = q.a * Math.min(1, u * 12) * Math.pow(1 - u, q.fo || 1.3); }
      geo.attributes.position.needsUpdate = geo.attributes.aS.needsUpdate = geo.attributes.aR.needsUpdate = geo.attributes.aC.needsUpdate = true; } }; }
  const smoke = makePts(700, puff, false, true), spark = makePts(500, glw, true, false);
  const NCH = 260, chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), NCH), CH = []; chips.castShadow = true; chips.frustumCulled = false; chips.visible = false; chips.layers.set(FG); scene.add(chips);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), chipC = new THREE.Color(); for (let i = 0; i < NCH; i++) { CH.push({ p: V(), v: V(), r: V(), w: V(), s: V() }); chips.setColorAt(i, chipC.set(0xffffff)); }
  const ov = (css) => { const e = document.createElement("div"); e.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;opacity:0;" + css; document.body.append(e); return e; };
  const flash = ov("background:#fffaf0"), dustV = ov("background:radial-gradient(ellipse at 50% 60%,rgba(120,96,70,.55),rgba(70,54,40,.95))"), fade = ov("background:#000");

  const cl = await getCloud(X), E = V(0, Y0, -2), HIT = V(0, Y0 + vh * 0.46, 8), CS = vh * 1.35, snd = makeSound(o.sfx);
  // 충격파가 어떤 거리에 닿는 시각 (cloudAt의 Wr과 같은 식)
  const arrive = d => { const x = (d / CS - 0.2) / 2.4; return x >= 0.99 ? 3.4 : -0.75 * Math.log(1 - Math.max(0, x)); };
  renderer.compile(scene, cam); cl.warm();
  X.use("nuke", 3); document.documentElement.classList.add("nuke-on");
  let t = 0, last = performance.now(), raf = 0, ended = false, impT = Infinity, face = "a", shake = 0, roll = 0, rollV = 0, blowFired = false, kimHit = Infinity, kSpin = 0, kYaw = 0, kLand = 0, kLandT = 0, conV = null, conW = 0, aP = null, aB = 0, kN0 = null, kH0 = null;
  const HQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0.12)), Q0 = new THREE.Quaternion(), FG_BTN = [0.95, 0.75, 0.02], FG_GLS = [0.3, 0.42, 0.22], FG_REST = [0.34, 0.25, 0.34], aF = FG_REST.slice();
  const tintC = new THREE.Color(1, 0.62, 0.38), charC = new THREE.Color(0x2b2520), once = new Set(), at = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } };
  const blow = V(), blowV = V(), lookP = V(), camP = V(), kp = V(), kv = V(), kr = V(), M0 = V(-vw * 1.7, Y0 + vh * 6.6, -vh * 6.4), M1 = V(-vw * 0.85, Y0 + vh * 3.1, vh * 0.55), misLast = M0.clone();
  const misAt = (u, out = V()) => { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return out.copy(M0).multiplyScalar(a).addScaledVector(M1, b).addScaledVector(HIT, c); };
  const ease = (a, b, x) => sstep(seg(x, a, b));

  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (import.meta.env.DEV && window.__nukeStop != null) dt = Math.max(0, Math.min(dt, window.__nukeStop - t));
    t += dt; if (import.meta.env.DEV) window.__nukeT = t;
    // ── 3D로: 칸에 두께 · 하늘·땅 · 시점이 뒤로 ──
    const u = eInOut(seg(t, 0.08, T.pull)), th = eOut(seg(t, 0.05, 0.9));
    if (impT === Infinity) { for (const b of bricks) { b.m.scale.z = 0.02 + 0.98 * th; b.m.position.z = b.z0 - b.dz / 2 * b.m.scale.z; if (b.mf && b.a0 < 1) { b.mf.opacity = lerp(b.a0, 1, th); if (th >= 1 && b.mf.transparent) { b.mf.transparent = false; b.mf.needsUpdate = true; } } } backM.opacity = th; if (th >= 1 && backM.transparent) { backM.transparent = false; backM.needsUpdate = true; } }
    skyU.uA.value = sstep(seg(t, 0.08, 0.62)); gMat.opacity = sstep(seg(t, 0.12, 0.66));
    camP.lerpVectors(V(0, 0, D), camEnd, u); lookP.lerpVectors(V(0, 0, 0), lookEnd, u);
    // 미사일이 올 땐 고개를 살짝 듦
    const upM = ease(T.launch - 0.1, T.launch + 0.6, t); if (mis.visible) lookP.lerp(mis.position, 0.78 * upM);
    leader(t, dt);
    btnStep(t, dt);
    if (t >= T.launch) at("launch", () => { mis.visible = glare.visible = true; snd.whistle(T.imp - T.launch); });
    if (mis.visible) missile(t, dt);
    smoke.step(dt); spark.step(dt);
    if (impT < Infinity) after(t - impT, dt);
    // 카메라: 밀려난 만큼 + 흔들림 · 폭발 뒤엔 구름을 올려다봄
    blowV.multiplyScalar(Math.exp(-1.7 * dt)); blow.addScaledVector(blowV, dt); shake *= Math.exp(-dt * 2.6); rollV += (-roll * 14 - rollV * 3.2) * dt; roll += rollV * dt;
    const sh = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake); cam.position.copy(camP).add(blow).add(sh);
    const s = impT < Infinity ? t - impT : -1, P = s >= 0 ? cloudAt(s) : null, ups = s >= 0 ? eInOut(seg(s, 0.15, 3)) : 0, tgt = lookP.clone();
    if (P) { tgt.lerp(V(E.x, Y0 + CS * (P.H * 0.5 + 0.06) - vh * 0.62 * sstep(seg(s, 1.2, 4)), E.z), ups); }
    cam.up.set(0, 1, 0); cam.up.applyAxisAngle(V(0, 0, 1), roll); cam.lookAt(tgt.add(sh.multiplyScalar(0.6)));
    const fov = lerp(X.FOV, 37, u) + 10 * ups; if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true); sky.position.copy(cam.position); fadeU.uCam.value.copy(cam.position);
    // ── 그리기: 구름이 있으면 땅·하늘 → 구름 → 앞의 물체 ──
    if (X.mine("nuke")) {
      if (P) { renderer.autoClear = true; cam.layers.set(0); renderer.shadowMap.autoUpdate = false; renderer.render(scene, cam); cl.render(cam, E, CS, P); renderer.autoClear = false; renderer.clearDepth(); cam.layers.set(FG); renderer.shadowMap.autoUpdate = true; renderer.render(scene, cam); renderer.autoClear = true; cam.layers.enableAll(); cl.adapt(dt); }
      else renderer.render(scene, cam);
    }
    if (t >= T.end) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  function setFace(f) { if (face !== f) { face = f; K.show(f); } }
  // 걸음: 디딘 발은 몸 뒤로 밀리고, 뜬 발은 앞으로 휘둘러 내려놓음
  function step(ph, A, S) { const uu = ((ph + (S === "L" ? 0 : 0.5)) % 1 + 1) % 1; if (uu < 0.56) return { z: A * (1 - (2 * uu) / 0.56), y: 0.08, p: 0 }; const w = (uu - 0.56) / 0.44; return { z: -A + 2 * A * sstep(w), y: 0.08 + 0.09 * A / 0.3 * Math.sin(Math.PI * w), p: 0.5 * Math.sin(Math.PI * w) * (w < 0.5 ? 1 : -0.6) }; }
  function leader(t, dt) {
    if (kimHit < Infinity) { flung(t, dt); return; }
    const wu = seg(t, T.walk0, T.walk1); K.root.visible = wu > 0; if (!K.root.visible) return;
    const we = sstep(wu), pos = from.clone().lerp(spot, we), dist = from.distanceTo(spot) / HU, ph = (dist * we) / 1.15, amp = wu < 1 ? Math.pow(Math.sin(Math.PI * Math.min(1, wu * 1.04)), 0.45) : 0, A = 0.3 * amp;
    const dirY = Math.atan2(spot.x - from.x, spot.z - from.z), turn = sstep(seg(wu, 0.62, 1)); K.root.position.copy(pos); K.root.rotation.set(0, lerp(dirY, yawEnd, turn), 0); K.begin();
    const fL = step(ph, A, "L"), fR = step(ph, A, "R"), bob = amp * 0.02 * Math.cos(ph * Math.PI * 4), sway = amp * 0.022 * Math.sin(ph * Math.PI * 2), idle = Math.sin(t * 1.7) * 0.004 * (1 - amp);
    K.B.hips.position.set(sway, 0.925 + bob + idle, 0); K.setE("hips", 0.02, amp * 0.1 * Math.sin(ph * Math.PI * 2), amp * 0.03 * Math.sin(ph * Math.PI * 2)); K.setE("spine", 0.02 + 0.03 * amp, -amp * 0.08 * Math.sin(ph * Math.PI * 2), 0); K.setE("chest", -0.015, -amp * 0.09 * Math.sin(ph * Math.PI * 2), 0); K.sync();
    K.leg("L", V(0.115, fL.y, fL.z), fL.p, 0.1); K.leg("R", V(-0.115, fR.y, fR.z), fR.p, -0.1);
    // 왼팔: 걸을 땐 흔들고 서면 옆에
    K.arm("L", V(0.285, 0.815 + 0.03 * amp * Math.cos(ph * Math.PI * 2), 0.06 + 0.2 * amp * Math.sin(ph * Math.PI * 2 + Math.PI)), V(0.25, -0.1, -1)); K.fingers("L", 0.34, 0.25);
    // 고개: 늘 이쪽을 봄 (사진 얼굴이 정면에 가깝게)
    K.sync(); const hp = K.B.neck.getWorldPosition(V()), to = K.root.worldToLocal(cam.position.clone()).sub(K.root.worldToLocal(hp)), yaw = clamp(Math.atan2(to.x, to.z), -1.25, 1.25), pit = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.3, 0.3), tilt = 0.03 * Math.sin(t * 1.1);
    const nod = face === "b" ? 0.05 : 0; K.setE("neck", pit * 0.45, yaw * 0.5, 0); K.setE("head", pit * 0.55 + nod, yaw * 0.5, tilt); K.sync();
    // 오른팔: 흔듦 → 안경 → 버튼 위 → 누르는 척 → 안경 → 꾹
    const down = V(-0.285, 0.815 + 0.03 * amp * Math.cos(ph * Math.PI * 2), 0.06 + 0.2 * amp * Math.sin(ph * Math.PI * 2)), high = BTN.clone().add(V(-0.015, 0.36, -0.06)), near = BTN.clone().add(V(-0.012, 0.215, -0.03)), press = BTN.clone().add(V(-0.012, 0.165, -0.03)), gl = K.toRoot(K.B.head, K.wristB);
    let W = down.clone(), mode = "rest", pole = V(-0.6, -0.3, -1);
    const glass = (a, on, off, b) => { if (t < a || t >= b) return false; const up2 = ease(a, on, t), dn = ease(off, b, t), w = up2 * (1 - dn); const base = t < (a + b) / 2 ? (a === T.g1a ? down : high) : high; W = base.clone().lerp(gl, w); pole = V(-1, -0.7, 0.1); mode = "glass"; setFace(t >= on && t < off ? "b" : "a"); if (t >= on && t < off) W.add(V(0.006 * Math.sin(t * 19), 0.004 * Math.sin(t * 13), 0)); return true; };
    const fake = (a, h, b, tgt) => { if (t < a || t >= b) return false; mode = "btn"; if (t < h) { const q = seg(t, a, h); W = high.clone().lerp(tgt, 1 - Math.pow(1 - q, 1.7)); } else W = tgt.clone().lerp(high.clone().add(V(-0.1, 0.17, -0.1)), eOut(seg(t, h, h + 0.13))).lerp(high, ease(h + 0.13, b, t)); return true; };
    if (glass(T.g1a, T.g1on, T.g1off, T.g1b) || glass(T.g2a, T.g2on, T.g2off, T.g2b)) { /* 안경 */ }
    else if (fake(T.f1a, T.f1h, T.f1b, near) || fake(T.f2a, T.f2h, T.f2b, near.clone().add(V(0, -0.024, 0)))) { setFace("a"); }
    else if (t >= T.pr0) { setFace("a"); mode = "btn"; const hit = T.pr0 + (T.pr1 - T.pr0) * 0.72; const off = ease(T.pr1 + 0.75, T.pr1 + 1.35, t); W = t < hit ? high.clone().lerp(press, eIn(seg(t, T.pr0, hit))) : press.clone().lerp(high, ease(T.pr1 + 0.25, T.pr1 + 0.75, t)).lerp(down, off); if (off > 0.6) mode = "rest"; }
    else if (t >= T.g1b) { W = high.clone(); mode = "btn"; setFace("a"); }
    const isB = mode === "btn", sk = 1 - Math.exp(-dt * 11), ft = isB ? FG_BTN : mode === "glass" ? FG_GLS : FG_REST; if (isB) pole = V(-0.75, -0.8, -0.3);
    if (!aP) aP = pole.clone(); aP.lerp(pole, sk); aB = lerp(aB, isB ? 1 : 0, sk); for (let i = 0; i < 3; i++) aF[i] = lerp(aF[i], ft[i], sk);
    K.fingers("R", aF[0], aF[1], aF[2]); K.arm("R", W, aP, HQ); K.B.handR.quaternion.slerp(Q0, 1 - aB); K.sync();
  }
  // 충격파에 튕겨 나감: 뒤로 날아가며 빙글빙글 · 팔다리 허우적 · 땅에 닿으면 구르다 멈춤
  function flung(t, dt) { const fy = Y0 + HU * 0.17, onG = kLand > 0 && kp.y <= fy + 2; kv.y -= vh * 2.1 * dt; kv.multiplyScalar(Math.exp(-(onG ? 2.6 : 0.42) * dt)); kp.addScaledVector(kv, dt);
    if (kp.y < fy) { kp.y = fy; if (kv.y < -vh * 0.3) { if (!kLand) kLandT = t; kLand++; snd.thud(1 / kLand); kv.y = -kv.y * 0.3; kv.x *= 0.7; kv.z *= 0.7; kSpin *= 0.5; } else kv.y = 0; }
    kr.x += kSpin * dt; kr.y += kYaw * dt; if (kLand) { const to = Math.round((kr.x + Math.PI / 2) / (Math.PI * 2)) * Math.PI * 2 - Math.PI / 2; kr.x += (to - kr.x) * (1 - Math.exp(-dt * 7)); kSpin *= Math.exp(-dt * 8); kYaw *= Math.exp(-dt * 4); const ty = Math.round((kr.y - 0.42) / (Math.PI * 2)) * Math.PI * 2 + 0.42; kr.y += (ty - kr.y) * (1 - Math.exp(-dt * 3.2)); }
    K.root.rotation.order = "YXZ"; K.root.rotation.set(kr.x, kr.y, 0); K.root.position.copy(kp).sub(V(0, 0.93 * HU, 0).applyEuler(K.root.rotation));
    const q = kLand ? Math.exp(-(t - kLandT) * 2.6) : 1, f = Math.sin(t * 15) * q, r = 1 - q, a0 = sstep(seg(t, impT + kimHit, impT + kimHit + 0.16)), E3 = (n, x, y, z) => K.setE(n, x * a0, y * a0, z * a0); K.begin();
    E3("armL", lerp(-1.7, -0.15, r) + 0.5 * f, 0, lerp(1.1, 0.75, r)); E3("armR", lerp(-2.1, -0.1, r) - 0.5 * f, 0, lerp(-1.2, -0.95, r)); E3("foreL", lerp(-0.6, -0.5, r) + 0.3 * f, 0, 0); E3("foreR", lerp(-0.7, -0.15, r) - 0.3 * f, 0, 0); E3("thighL", lerp(-0.9, -0.1, r) - 0.5 * f, 0, lerp(0.3, 0.16, r)); E3("thighR", lerp(-0.4, -0.5, r) + 0.5 * f, 0, lerp(-0.3, -0.2, r)); E3("shinL", lerp(0.8, 0.12, r), 0, 0); E3("shinR", lerp(1.1, 0.9, r), 0, 0); E3("spine", lerp(-0.3, 0, r), 0, 0); E3("neck", lerp(0, 0.42, r), 0, 0); E3("head", lerp(0, 0.5, r), lerp(0, -0.16, r), lerp(0, 0.1, r)); const cu = lerp(0.34, lerp(0.08, 0.34, r), a0); K.fingers("L", cu, 0.2); K.fingers("R", cu, 0.2); if (a0 < 1 && kN0) { K.B.neck.quaternion.slerp(kN0, 1 - a0); K.B.head.quaternion.slerp(kH0, 1 - a0); } K.sync(); }
  function btnStep(t, dt) { if (conV) { conV.y -= vh * 2.1 * dt; conV.multiplyScalar(Math.exp(-0.42 * dt)); con.position.addScaledVector(conV, dt); con.rotation.x += conW * dt; con.rotation.z += conW * 0.3 * dt; if (con.position.y < Y0 + 6) { con.position.y = Y0 + 6; conV.y = Math.abs(conV.y) * 0.25; conV.x *= 0.55; conV.z *= 0.55; conW *= 0.5; const to = Math.round((con.rotation.x - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2; con.rotation.x += (to - con.rotation.x) * Math.min(1, dt * 7); } return; }
    const up = eOut(seg(t, T.rise0, T.rise1)); con.visible = up > 0; con.position.y = Y0 - HU * 1.1 * (1 - up); if (t >= T.rise0 && t < T.rise1) { at("rise", () => snd.rise()); if (Math.random() < 0.7) smoke.add({ p: V(con.position.x + BTN.x * HU + rnd(-60, 60), Y0 + 6, con.position.z + BTN.z * HU + rnd(-60, 60)), v: V(rnd(-50, 50), rnd(30, 90), rnd(-50, 50)), drag: 1.5, max: rnd(0.7, 1.5), s0: 40, s1: 170, a: 0.42, c: 0x9a8a72, rot: rnd(0, 6), w: rnd(-1, 1) }); } 
    const hit = T.pr0 + (T.pr1 - T.pr0) * 0.72; if (t >= hit) at("press", () => { snd.click(); snd.alarm(); buzz([3, 60, 2]); }); parts.cap.position.y = 1.018 - (t >= hit && t < hit + 0.3 ? 0.03 : 0); parts.mL.emissiveIntensity = t > hit ? (Math.sin(t * 20) > 0 ? 4 : 0.2) : 0; parts.mR.emissiveIntensity = t > hit ? (Math.sin(t * 20) > 0 ? 1.8 : 0.5) : 0.5;
    if (t >= T.f1h) at("f1", () => snd.tick()); if (t >= T.f2h) at("f2", () => snd.tick()); for (const k of [T.g1on, T.g2on]) if (t >= k) at("g" + k, () => snd.tick(0.5)); for (let i = 0; i < 7; i++) if (t >= T.walk0 + 0.18 + i * 0.22 && t < T.walk1) at("st" + i, () => snd.step()); }
  function missile(t, dt) { const raw = seg(t, T.launch, T.imp), mu = eIn(raw) * 0.6 + raw * 0.4, p = misAt(mu), q = misAt(Math.min(1, mu + 0.012)); mis.position.copy(p); mis.lookAt(q); mis.rotateZ(t * 7); const dir = q.clone().sub(p).normalize(); glare.position.copy(p).addScaledVector(dir, -MS * 0.52); glare.scale.setScalar(MS * rnd(0.42, 0.62)); plume.scale.set(rnd(0.9, 1.2), rnd(0.9, 1.2), rnd(0.85, 1.25));
    const seg2 = p.distanceTo(misLast), n = Math.min(14, Math.ceil(seg2 / (MS * 0.09))); for (let i = 0; i < n; i++) { const sp = misLast.clone().lerp(p, i / n).addScaledVector(dir, -MS * 0.55); smoke.add({ p: sp.add(V(rnd(-5, 5), rnd(-5, 5), rnd(-5, 5))), v: V(rnd(-12, 12), rnd(4, 26), rnd(-12, 12)), drag: 0.6, max: rnd(3.6, 5.4), s0: MS * 0.15, s1: MS * rnd(0.6, 1.05), a: 0.8, c: dark ? 0xb4b0aa : 0xe6e2da, rot: rnd(0, 6), w: rnd(-0.4, 0.4) }); }
    misLast.copy(p); shake = Math.max(shake, vh * 0.004 * raw * raw * raw); if (t >= T.imp) { mis.visible = glare.visible = false; impT = t; boom(); } }
  function boom() { snd.boom(); buzz([3, 80, 3, 120, 3, 160, 2, 220, 2, 300, 1]);
    flash.style.transition = "none"; flash.style.opacity = "1"; requestAnimationFrame(() => requestAnimationFrame(() => { flash.style.transition = "opacity 1.7s cubic-bezier(.2,.7,.3,1)"; flash.style.opacity = "0"; }));
    boomL.position.copy(HIT); boomL.intensity = 70; shake = vh * 0.012; skyU.uBoom.value = 1; scorch.position.x = E.x; scorch.position.z = E.z; for (const q of smoke.P) q.max = Math.min(q.max, q.life + rnd(0.25, 0.6));
    Object.assign(sun.shadow.camera, { left: -vh * 3.6, right: vh * 3.6, top: vh * 3.6, bottom: -vh * 3.6 }); sun.shadow.camera.updateProjectionMatrix(); sun.target.position.z = D * 1.1;
    // 벽돌: 가운데는 녹아 없어지고 둘레는 충격파가 닿는 대로 날아감
    for (const b of bricks) { const wp = b.m.getWorldPosition(V()), d = wp.clone().sub(HIT), dist = d.length(), k = clamp(1 - dist / (vh * 0.95), 0.2, 1); d.z = Math.abs(d.z) + rnd(0.1, 0.7) * dist + 30; d.normalize(); b.free = true;
      if (dist < vh * 0.14) { b.vap = true; continue; } b.v.copy(d).multiplyScalar(rnd(500, 3400) * k * (Math.random() < 0.25 ? 0.4 : 1)).add(V(0, rnd(300, 1700) * k, 0)); b.w.set(rnd(-11, 11), rnd(-11, 11), rnd(-11, 11)).multiplyScalar(k + 0.2); b.delay = dist / (vh * 5); }
    // 잔 조각
    const pal = (o.pieces.flatMap(p => p.colors || []).slice(0, 40)); if (!pal.length) pal.push("#ffffff"); pal.push("#f4f1ea", "#e4e0d8", "#6a645c"); chips.visible = true;
    CH.forEach((c, i) => { const a = rnd(0, 6.283), r = rnd(0, vh * 0.4); c.p.set(HIT.x + Math.cos(a) * r, HIT.y + Math.sin(a) * r * 0.9, rnd(4, 30)); c.v.set(Math.cos(a) * rnd(300, 1700), rnd(200, 1900), rnd(500, 2600)); c.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); c.w.set(rnd(-18, 18), rnd(-18, 18), rnd(-18, 18)); const s = rnd(4, 15) * (Math.random() < 0.14 ? 2.3 : 1); c.s.set(s, s * rnd(0.5, 1.2), s); chips.setColorAt(i, chipC.set(pal[(Math.random() * pal.length) | 0])); }); chips.instanceColor.needsUpdate = true;
    for (let i = 0; i < 160; i++) spark.add({ p: HIT.clone().add(V(0, 0, 12)), v: V(rnd(-1, 1), rnd(-0.3, 1), rnd(0.2, 1)).normalize().multiplyScalar(rnd(700, 2600)), g: -1500, drag: 0.8, max: rnd(0.4, 1.3), s0: rnd(3, 7), s1: 0, a: 1, c: 0xffe2a0 });
  }
  function after(s, dt) {
    boomL.intensity = 70 * Math.exp(-s * 0.8); const P = cloudAt(s); boomL.position.copy(E).add(V(0, CS * (P.H + 0.05), vh * 0.25)); K.tint(tintC, 0.72 * Math.exp(-s * 0.45) + 0.3 * sstep(seg(s, 1, 4))); skyU.uBoom.value = Math.exp(-s * 0.6); skyU.uDim.value = 0.7 * sstep(seg(s, 0.4, 4)); hemi.intensity = lerp(1.1, 0.55, sstep(seg(s, 0.3, 3))); sun.intensity = lerp(2.5, 1.5, sstep(seg(s, 0.3, 3)));
    scorch.material.opacity = Math.min(0.9, s * 2); scorch.scale.setScalar(Math.max(vh * 0.2, CS * P.SR * 0.92));
    // 충격파가 그 사람에게 닿음 → 튕겨 나감
    const dK = K.root.position.distanceTo(E); if (kimHit === Infinity && s >= arrive(dK)) { kimHit = s; kN0 = K.B.neck.quaternion.clone(); kH0 = K.B.head.quaternion.clone(); kp.copy(K.root.position).add(V(0, HU * 0.93, 0)); const aw = K.root.position.clone().sub(E).setY(0).normalize(); kv.set((camEnd.x + vw * 0.05 - K.root.position.x) * 0.76, vh * 1.95, vh * 1.75); kr.set(0, K.root.rotation.y, 0); kSpin = 6.4; kYaw = 1.2; setFace("a"); snd.hit(); conV = V((-vw * 0.14 - con.position.x) * 0.9, vh * 1.05, vh * 1.05); conW = 4; }
    // 충격파가 카메라에 닿음 → 크게 밀려나고 흔들리고 기움 · 흙먼지가 화면을 덮었다 걷힘
    const dC = cam.position.distanceTo(E); if (!blowFired && s >= arrive(dC)) { blowFired = true; const aw = cam.position.clone().sub(E).setY(0).normalize(); blowV.copy(aw).multiplyScalar(vh * 5.2).add(V(0, vh * 0.5, 0)); shake = vh * 0.05; rollV = 3.6; snd.wind(); buzz([3, 140, 3, 200, 2]); dustV.style.transition = "none"; dustV.style.opacity = "0.92"; requestAnimationFrame(() => requestAnimationFrame(() => { dustV.style.transition = "opacity 1.6s ease-out"; dustV.style.opacity = "0"; })); for (let i = 0; i < 40; i++) smoke.add({ p: cam.position.clone().add(V(rnd(-300, 300), rnd(-200, 200), -rnd(250, 700))), v: aw.clone().multiplyScalar(vh * rnd(1.4, 2.6)), drag: 1.4, max: rnd(0.9, 1.8), s0: 80, s1: 320, a: 0.55, c: 0x8a7458, rot: rnd(0, 6), w: rnd(-1, 1) }); }
    for (const b of bricks) { if (b.vap) { b.m.scale.multiplyScalar(Math.exp(-dt * 9)); continue; } if (s < b.delay) continue;
      b.v.y -= 2100 * dt; b.v.multiplyScalar(Math.exp(-0.35 * dt)); b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
      const lay = Y0 + b.dz * 0.5 + 1; if (b.m.position.y < lay) { b.m.position.y = lay; b.v.y *= -0.26; b.v.x *= 0.6; b.v.z *= 0.6; b.w.multiplyScalar(0.45); if (!b.flat) { b.flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rnd(0, 6.28))); } } if (b.flat) { b.m.quaternion.slerp(b.flat, 1 - Math.exp(-dt * 9)); b.w.multiplyScalar(Math.exp(-dt * 8)); }
      if (b.mf) { const k = sstep(seg(s, b.delay, b.delay + 0.9)); b.mf.emissiveIntensity = 0.55 * (1 - 0.72 * k); b.mf.color.setScalar(lerp(0.184, 0.07, k)); b.ms.color.lerp(charC, 1 - Math.exp(-dt * 2.4)); } }
    backM.color.lerp(charC, 1 - Math.exp(-dt * 2.4));
    if (chips.visible) { for (let i = 0; i < NCH; i++) { const c = CH[i]; if (c.s.x <= 0) { chips.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; } c.v.y -= 1900 * dt; c.v.multiplyScalar(Math.exp(-0.4 * dt)); c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt); if (c.p.y < Y0 + 3) { c.p.y = Y0 + 3; c.v.y *= -0.25; c.v.x *= 0.6; c.v.z *= 0.6; c.w.multiplyScalar(0.5); } chips.setMatrixAt(i, m4.compose(c.p, q4.setFromEuler(e4.set(c.r.x, c.r.y, c.r.z)), c.s)); } chips.instanceMatrix.needsUpdate = true; }
    if (s > T.end - T.imp - 1.4) fade.style.opacity = String(seg(s, T.end - T.imp - 1.4, T.end - T.imp));
  }
  function finish() { cancelAnimationFrame(raf); if (ended) return; ended = true; X.drop("nuke"); document.documentElement.classList.remove("nuke-on"); renderer.autoClear = true; renderer.shadowMap.autoUpdate = true; scene.remove(K.root);
    scene.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach(x => { if (x.map && x.map !== K.M) x.map.dispose(); x.dispose(); }); }); texs.forEach(x => x.dispose());
    flash.remove(); dustV.remove(); setTimeout(() => { fade.style.transition = "opacity .6s"; fade.style.opacity = "0"; setTimeout(() => fade.remove(), 700); }, 60); o.onDone && o.onDone(); }
  raf = requestAnimationFrame(frame);
}

// ── 소리 ──
function makeSound(get) {
  const A = () => get && get();
  const noise = (a, t, type, f0, f1, q, gain, att, dur) => { const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain(); s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); };
  const tone = (a, t, type, f0, f1, gain, att, dur) => { const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.out); o.start(t); o.stop(t + dur + 0.05); };
  return {
    step() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", rnd(700, 1100), 400, 1.2, 0.16, 0.003, 0.07); tone(a, t, "sine", 80, 50, 0.22, 0.003, 0.1); },
    rise() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sawtooth", 60, 120, 0.06, 0.1, 0.8); noise(a, t, "lowpass", 300, 700, 0.8, 0.14, 0.1, 0.8); noise(a, t + 0.8, "bandpass", 1800, 1200, 3, 0.3, 0.002, 0.05); },
    tick(k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 3000, 2000, 3, 0.16 * k, 0.001, 0.03); },
    click() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 2400, 1800, 3, 0.55, 0.001, 0.04); tone(a, t, "sine", 320, 150, 0.35, 0.002, 0.09); },
    alarm() { const a = A(); if (!a) return; const t = a.c.currentTime; for (let i = 0; i < 4; i++) { tone(a, t + i * 0.46, "square", 880, 880, 0.07, 0.01, 0.22); tone(a, t + i * 0.46 + 0.23, "square", 620, 620, 0.07, 0.01, 0.22); } },
    whistle(d) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 2600, 420, 0.13, d * 0.85, d); noise(a, t, "bandpass", 700, 3200, 2, 0.3, d * 0.92, d); noise(a, t + d * 0.4, "lowpass", 200, 900, 0.8, 0.4, d * 0.55, d * 0.6); },
    boom() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 72, 16, 1, 0.005, 4.5); tone(a, t, "triangle", 42, 18, 0.8, 0.02, 5); noise(a, t, "lowpass", 3200, 36, 0.7, 1, 0.004, 5.5); noise(a, t, "highpass", 3000, 800, 0.7, 0.7, 0.001, 0.5); for (const d of [0.5, 1.2, 2.1, 3.2, 4.4]) noise(a, t + d, "lowpass", 480, 46, 0.7, 0.55 / (1 + d * 0.45), 0.12, 2.8); },
    hit() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 1200, 300, 0.8, 0.7, 0.01, 0.5); tone(a, t, "sine", 130, 40, 0.5, 0.005, 0.4); },
    thud(k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 110, 38, 0.6 * k, 0.004, 0.3); noise(a, t, "lowpass", 900, 180, 0.8, 0.5 * k, 0.004, 0.28); },
    wind() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 500, 140, 0.8, 0.9, 0.04, 3.2); noise(a, t, "lowpass", 220, 55, 0.7, 0.8, 0.08, 3.8); },
  };
}
