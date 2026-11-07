// 관세 (3D): 위에서 내려다보던 달력이 그대로 바닥이 되고 시점이 낮게 내려와 유세 무대가 됨 → 트럼프가 춤추며 걸어 나옴(춤 사진) →
// 음악이 끊기고 진지한 얼굴(진지 사진)로 품에서 종이를 꺼내 듦 "관세: 5%" → 0.7초 뒤 3초 동안 1000%까지 치솟음 → 0.5초 뒤 음악이 터지며 (우 · 춤 사진을 번갈아) 춤 →
// 누르기 전까지 계속 춤 · 트럼프를 누르면 시점이 물러나며 큰 손이 들어와 이마에 딱밤 → 딱! 잠깐 멈춘 뒤 뒤로 넘어가 머리부터 바닥에 쿵 박혀 다리만 흔들림 →
// 조용해지고 금이 간 달력이 안쪽부터 무너져 내림 → 구덩이 속 다리 위로 종이가 내려앉으며 0%로 끝
// 좌표: 달력이 y=0 평면 (화면 오른쪽 +x, 화면 아래 +z), 위에서 내려다보는 카메라가 처음 화면과 1:1 · 1미터 = HU 화면 단위
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { loadHand, preloadHand } from "./hand.js";
import { buildTrump } from "./trump.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V, buzz, vnoise, noiseTex } from "./fx-util.js";

const BPM = 118, BT = 60 / BPM;
// 등장 7박 · 종이 0.7초 대기 · 3초 상승 · 0.5초 대기 · 3초 춤은 요청 그대로
const T0 = { pull: 1.5, in0: 0.39 };
const TB = { ...T0, in1: T0.in0 + BT * 7, draw0: 4.25, pocket: 4.56, show: 5.15 };
TB.up0 = TB.show + 0.7; TB.up1 = TB.up0 + 3; TB.dance = TB.up1 + 0.5;
const BIG = 1e6, SNAP = 0.125, HIT = 0.165;   // 누른 뒤 손가락이 풀리는 때 · 이마에 닿는 때

const FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
let rigP = null;
function rigGiant(H) {
  const root = new THREE.Group(), orient = new THREE.Group();
  orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));   // 모델 → 손가락 위 · 손바닥 앞 · 엄지 오른쪽
  const rp = n => V().setFromMatrixPosition(H.restM[n]); H.scene.position.copy(rp("wrist")).negate(); orient.add(H.scene); root.add(orient);
  const len = rp("wrist").distanceTo(rp("middle-finger-tip"));
  const slv = new THREE.MeshStandardMaterial({ color: 0x27324a, roughness: 0.85, bumpMap: noiseTex(128, 4, 40), bumpScale: 0.8 }), sleeve = new THREE.Group(), sl = 3.4;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.056, sl, 40, 1, true), slv); tube.position.y = -sl / 2 - 0.006;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0048, 12, 40), slv); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.006; sleeve.add(tube, cuff); sleeve.scale.z = 0.8; root.add(sleeve);
  root.traverse(q => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; q.frustumCulled = false; } });
  const SP = { index: 0.12, middle: 0.02, ring: -0.07, pinky: -0.17 };
  // 딱밤: k 0 = 엄지가 가운뎃손가락을 잡음 · 1 = 튕겨 나감 · tr 힘을 모음 · rel 힘이 풀림
  function flick(k, tr = 0, rel = 0) { const a = lerp(-1 - 0.06 * tr, 0.16, k) - 0.5 * rel, b = lerp(-1.2, -0.03, k) - 0.35 * rel, c = lerp(-0.7, -0.03, k) - 0.2 * rel; H.setChain("middle", [null, [a, 0.02, 0], [b, 0, 0], [c, 0, 0]]); for (const n of ["index", "ring", "pinky"]) { const q = n === "index" ? 0.56 : n === "ring" ? 0.66 : 0.74; H.setChain(n, [null, [-0.06 - 1.15 * q, SP[n], 0], [-0.07 - 1.3 * q, 0, 0], [-0.05 - 0.8 * q, 0, 0]]); } const th = 1 - k; H.setChain("thumb", [[lerp(-0.2, -0.4, th), lerp(0.3, 0.6, th), lerp(0, 0.6, th)], [lerp(-0.1, -0.8, th), 0, 0], [lerp(-0.12, -0.8, th), 0, 0]]); }
  const tw = V(), tip = () => { root.updateMatrixWorld(true); return root.worldToLocal(H.bones["middle-finger-tip"].getWorldPosition(tw).clone()); };
  return { H, root, sleeve, len, flick, tip };
}
const getRig = () => rigP || (rigP = (async () => {
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe8a578, roughness: 0.52, sheen: 0.85, sheenRoughness: 0.42, sheenColor: new THREE.Color(0xff8a66), clearcoat: 0.1, clearcoatRoughness: 0.6, bumpMap: noiseTex(256, 6, 30, 0.9), bumpScale: 0.35 });
  const [HR, HL, HG] = await Promise.all([loadHand(new THREE.MeshStandardMaterial()), loadHand(new THREE.MeshStandardMaterial()), loadHand(skin)]);
  return { K: await buildTrump({ hands: [HR, HL] }), G: rigGiant(HG) };
})().catch(e => { rigP = null; throw e; }));
export function prewarmTariff() { preloadHand(); getRig().then(({ K, G }) => { const r = fx3d().renderer; for (const q of [K.root, G.root]) q.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { for (const k of ["map", "alphaMap", "emissiveMap", "bumpMap"]) if (m[k]) r.initTexture(m[k]); }); }); }).catch(() => {}); }

function canvasTex(w, h, draw, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const puffTex = () => canvasTex(128, 128, (x, w, h) => { const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w - 0.5, v = j / h - 0.5, r = Math.hypot(u, v) * 2, n = vnoise(i * 0.05, j * 0.05) * 0.55 + vnoise(i * 0.13 + 7, j * 0.13) * 0.3 + vnoise(i * 0.3, j * 0.3 + 3) * 0.15;
    const a = clamp((1 - r) * 1.7 - (1 - n) * 0.95, 0, 1), k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * a * 255; } x.putImageData(im, 0, 0); }, false);
const glowTex = () => canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.45)"); g.addColorStop(0.65, "rgba(255,255,255,.09)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); });
const PT_VS = `attribute float aS, aR; attribute vec4 aC; uniform float uScale; varying vec4 vC; varying float vR;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(aS * uScale / -mv.z, 700.0); vC = aC; vR = aR; }`;
const PT_FS = `uniform sampler2D map; uniform float uShade; varying vec4 vC; varying float vR;
void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 t = texture2D(map, q); float sh = mix(1.0, mix(1.12, 0.6, gl_PointCoord.y), uShade), a = t.a * vC.a; if (a < 0.004) discard;
  gl_FragColor = vec4(vC.rgb * sh, a);
  #include <colorspace_fragment>
}`;
// 멀리 흐릿한 관중: 작게 그려서 크게 늘리면 사진의 배경처럼 번짐
const crowdTex = () => { const t = canvasTex(512, 128, (x, w, h) => { x.fillStyle = "#070914"; x.fillRect(0, 0, w, h);
  const skin = ["#c99a7a", "#e0b596", "#a87858", "#d8a882"], cloth = ["#1b2342", "#3a3d4c", "#d9d7d2", "#6e2230", "#20242c", "#55607c"];
  for (let r = 0; r < 8; r++) { const y = h * (0.2 + r * 0.105), s = 3.4 + r * 1.15; for (let i = -1; i < w / (s * 1.5) + 1; i++) { const px = i * s * 1.5 + rnd(-1.2, 1.2) + (r % 2) * s * 0.6, py = y + rnd(-1.5, 1.5); x.fillStyle = cloth[(Math.random() * cloth.length) | 0]; x.fillRect(px - s * 0.72, py + s * 0.5, s * 1.44, h); x.fillStyle = skin[(Math.random() * skin.length) | 0]; x.beginPath(); x.arc(px, py, s * 0.52, 0, 7); x.fill(); if (Math.random() < 0.34) { x.fillStyle = "#c8102e"; x.fillRect(px - s * 0.58, py - s * 0.62, s * 1.16, s * 0.6); } } }
  for (const fx of [46, 170, 300, 430]) { const fw = 38, fh = 24, fy = 16; for (let i = 0; i < 7; i++) { x.fillStyle = i % 2 ? "#ece9e4" : "#c0142c"; x.fillRect(fx, fy + (i * fh) / 7, fw, fh / 7 + 0.5); } x.fillStyle = "#1d2f6f"; x.fillRect(fx, fy, fw * 0.42, fh * 0.54); }
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 46; i++) { const px = Math.random() * w, py = Math.random() * h * 0.5, rr = rnd(1, 3.2), g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, ["rgba(255,240,210,.8)", "rgba(255,120,120,.7)", "rgba(130,170,255,.7)"][i % 3]); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); } }); t.anisotropy = 1; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; return t; };
const BEAM_VS = "varying vec3 vN, vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; vY = -position.y; gl_Position = projectionMatrix * mv; }";
const BEAM_FS = "uniform vec3 uC; uniform float uA; varying vec3 vN, vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.7), a = f * pow(1.0 - vY, 1.25) * uA; gl_FragColor = vec4(uC * a, a); }";

// 칸 하나의 조각: 위는 달력 그림, 옆과 밑은 칸 색 (아틀라스의 흰 자리를 씀)
function prism(poly, thick, uvOf, wuv, col) {
  let area = 0, cx = 0, cz = 0; for (let i = 0; i < poly.length; i++) { const [a, b] = poly[i], [c, d] = poly[(i + 1) % poly.length], k = a * d - c * b; area += k; cx += (a + c) * k; cz += (b + d) * k; } cx /= 3 * area; cz /= 3 * area;
  const P = area > 0 ? poly.slice().reverse() : poly, pos = [], nor = [], uv = [], clr = [], idx = [], n = P.length;
  const push = (x, y, z, nx, ny, nz, u, v, c) => { pos.push(x - cx, y, z - cz); nor.push(nx, ny, nz); uv.push(u, v); clr.push(c[0], c[1], c[2]); };
  for (const [x, z] of P) { const [u, v] = uvOf(x, z); push(x, 0, z, 0, 1, 0, u, v, [1, 1, 1]); } for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
  const b0 = pos.length / 3; for (const [x, z] of P) push(x, -thick, z, 0, -1, 0, wuv[0], wuv[1], col); for (let i = 1; i < n - 1; i++) idx.push(b0, b0 + i + 1, b0 + i);
  for (let i = 0; i < n; i++) { const [a, b] = P[i], [c, d] = P[(i + 1) % n], dx = c - a, dz = d - b, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, s = pos.length / 3; push(a, 0, b, nx, 0, nz, wuv[0], wuv[1], col); push(c, 0, d, nx, 0, nz, wuv[0], wuv[1], col); push(c, -thick, d, nx, 0, nz, wuv[0], wuv[1], col); push(a, -thick, b, nx, 0, nz, wuv[0], wuv[1], col); idx.push(s, s + 1, s + 2, s, s + 2, s + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(clr, 3)); g.setIndex(idx); return { g, cx, cz };
}
// 금이 갈 자리: 격자의 안쪽 점을 흔들어 불규칙한 사각형 · 일부는 삼각형으로 쪼갬
function cracked(W, H, nx, ny) { const pt = [], out = []; for (let j = 0; j <= ny; j++) { pt.push([]); for (let i = 0; i <= nx; i++) { const ed = i === 0 || j === 0 || i === nx || j === ny, jx = i === 0 || i === nx ? 0 : rnd(-0.3, 0.3) * W / nx, jz = j === 0 || j === ny ? 0 : rnd(-0.3, 0.3) * H / ny; pt[j].push([-W / 2 + (W * i) / nx + (ed ? jx * 0.5 : jx), -H / 2 + (H * j) / ny + (ed ? jz * 0.5 : jz)]); } }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = pt[j][i], b = pt[j][i + 1], c = pt[j + 1][i + 1], d = pt[j + 1][i]; if (Math.random() < 0.3) { out.push([a, b, c], [a, c, d]); } else out.push([a, b, c, d]); } return out; }
// 칸 그림들을 큰 그림 한 장에 모음 (바닥 전체를 한 번에 그리기 위해)
function atlas(pieces) {
  const r0 = Math.max(1, ...pieces.map(p => p.tex.width / Math.max(1, p.W))); let k = Math.min(3, r0), lay;
  for (let tr = 0; tr < 8; tr++) { const list = pieces.map((p, i) => ({ i, w: Math.ceil(p.W * k) + 6, h: Math.ceil(p.H * k) + 6 })).sort((a, b) => b.h - a.h), area = list.reduce((s, q) => s + q.w * q.h, 0); let AW = 1024; while (AW * AW < area * 1.35 && AW < 4096) AW *= 2; let x = 12, y = 0, row = 0; const pl = []; for (const q of list) { if (x + q.w > AW) { x = 0; y += row; row = 0; } pl[q.i] = [x, y]; x += q.w; row = Math.max(row, q.h); } const used = y + row; let AH = 256; while (AH < used) AH *= 2; if (AH <= 4096) { lay = { AW, AH, pl }; break; } k *= 0.8; }
  const c = document.createElement("canvas"); c.width = lay.AW; c.height = lay.AH; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 10, 10);
  const rect = pieces.map((p, i) => { const [px, py] = lay.pl[i], w = Math.ceil(p.W * k), h = Math.ceil(p.H * k); x.drawImage(p.tex, px + 1, py + 1, w + 4, h + 4); x.clearRect(px + 3, py + 3, w, h); x.drawImage(p.tex, px + 3, py + 3, w, h); return [(px + 3) / lay.AW, 1 - (py + 3) / lay.AH, (px + 3 + w) / lay.AW, 1 - (py + 3 + h) / lay.AH]; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { t, rect, white: [4 / lay.AW, 1 - 4 / lay.AH] };
}

export async function startTariff(o) {
  const T = { ...TB, tap: BIG, hand: BIG, snap: BIG, hit: BIG, crash: BIG, final: BIG, drop: BIG, land: BIG, end: BIG };
  const X = fx3d(), { renderer, PR, vw, vh, D } = X, HU = Math.min(vw * 0.36, vh * 0.17), w2 = vw / 2, h2 = vh / 2, PIT = HU * 1.75, H = (x, y, z) => V(x * HU, y * HU, z * HU);
  const { K, G } = await getRig(), snd = makeSound(o.sfx);
  const scene = new THREE.Scene(); scene.environment = X.env; scene.environmentIntensity = 0.32;
  const cam = new THREE.PerspectiveCamera(X.FOV, vw / vh, 5, D * 16); cam.position.set(0, D, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  // ── 빛: 밤 무대 ──
  const hemi = new THREE.HemisphereLight(0x9fb2e6, 0x241c2c, 1.25); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1de, 2.6); key.position.copy(H(-5, 13, 11)); key.target.position.set(0, 0, 0); key.castShadow = true; scene.add(key, key.target);
  { const r = Math.max(w2, h2, HU * 9) * 1.15; Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: HU * 60 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.9; }
  const rimR = new THREE.DirectionalLight(0xff3040, 1.5), rimB = new THREE.DirectionalLight(0x3a6cff, 1.7); rimR.position.copy(H(9, 3, -8)); rimB.position.copy(H(-9, 3, -8)); scene.add(rimR, rimB);
  // ── 배경: 관중이 있는 밤하늘 (처음엔 투명했다가 나타남) ──
  const bgU = { uA: { value: 0 }, uT: { value: 0 }, uBeat: { value: 0 }, uDim: { value: 0 }, uTex: { value: crowdTex() } };
  const bg = new THREE.Mesh(new THREE.SphereGeometry(HU * 40, 48, 24), new THREE.ShaderMaterial({ uniforms: bgU, side: THREE.BackSide, depthWrite: false, depthTest: false, vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uA, uT, uBeat, uDim; uniform sampler2D uTex; varying vec3 vD;
void main(){ vec3 d = normalize(vD); float az = atan(d.x, -d.z) / 6.2831853, el = d.y; vec3 c = mix(vec3(0.05, 0.06, 0.14), vec3(0.008, 0.012, 0.04), smoothstep(0.0, 0.7, el));
  float v = (el + 0.05) / 0.2; if (v > 0.0 && v < 1.0) { vec2 uv = vec2(az * 9.0 + 0.5, 1.0 - v); uv.y += 0.012 * sin(az * 420.0 + uT * 7.0) * (0.35 + uBeat) * v; vec3 cr = texture2D(uTex, uv).rgb; c = mix(c, cr * (0.42 + 0.5 * uBeat), smoothstep(1.0, 0.82, v)); }
  c += vec3(0.1, 0.05, 0.14) * exp(-pow((el - 0.18) / 0.14, 2.0)) * (0.5 + uBeat); c *= 1.0 - 0.85 * uDim; gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor *= uA; }` }));
  bg.renderOrder = -10; bg.frustumCulled = false; scene.add(bg);
  // ── 무대 틀 · 뒤쪽 통로 · 땅 ──
  const env = new THREE.Group(); env.visible = false; scene.add(env);
  const steel = new THREE.MeshStandardMaterial({ color: 0x151827, roughness: 0.48, metalness: 0.5 }), carpet = new THREE.MeshStandardMaterial({ color: 0x141b3a, roughness: 0.9 }), RW = HU * 0.5;
  const box = (w, h, d, m, x, y, z, par = env) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = false; b.receiveShadow = true; b.frustumCulled = false; par.add(b); return b; };
  box(RW, PIT + 16, vh + RW * 2, steel, -w2 - RW / 2, -(PIT + 16) / 2, 0); box(RW, PIT + 16, vh + RW * 2, steel, w2 + RW / 2, -(PIT + 16) / 2, 0); box(vw + RW * 2, PIT + 16, RW, steel, 0, -(PIT + 16) / 2, h2 + RW / 2);
  box(vw + RW * 2, PIT + 16, HU * 8, carpet, 0, -(PIT + 16) / 2 - 1, -h2 - HU * 4);
  const ledM = new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false }), ledB = new THREE.MeshBasicMaterial({ color: 0x3b6dff, toneMapped: false }), lw = HU * 0.05;
  box(lw, lw, vh + RW * 2, ledM, -w2 - RW * 0.5, 0.5, 0); box(lw, lw, vh + RW * 2, ledB, w2 + RW * 0.5, 0.5, 0); box(vw + RW * 2, lw, lw, ledM, 0, 0.5, h2 + RW * 0.5); box(vw + RW * 2, lw, lw, ledB, 0, 0.5, -h2 - HU * 8);
  const groundM = new THREE.MeshStandardMaterial({ color: 0x0b0d18, roughness: 0.82 }), ground = new THREE.Mesh(new THREE.PlaneGeometry(HU * 90, HU * 90), groundM); ground.rotation.x = -Math.PI / 2; ground.position.y = -PIT; ground.receiveShadow = true; env.add(ground);
  // 숫자가 뜨는 대형 화면
  const port = vw < vh, WH = port ? 760 : 300, wc = document.createElement("canvas"); wc.width = 1024; wc.height = WH; const wx = wc.getContext("2d"), wallT = new THREE.CanvasTexture(wc); wallT.colorSpace = THREE.SRGBColorSpace; wallT.anisotropy = 4;
  const wallM = new THREE.MeshBasicMaterial({ map: wallT, toneMapped: false, color: 0xaaaaaa }), wallZ = -h2 - HU * 8.4, wallW = port ? HU * 4.5 : Math.max(vw + HU * 4, HU * 15), wallH = wallW * WH / 1024, wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), wallM); wall.position.set(0, wallH / 2 + HU * 0.5, wallZ); env.add(wall); box(wallW + HU * 0.5, wallH + HU * 0.4, HU * 0.5, steel, 0, wallH / 2 + HU * 0.5, wallZ - HU * 0.3);
  const gridC = document.createElement("canvas"); gridC.width = 1024; gridC.height = WH; { const g = gridC.getContext("2d"); g.fillStyle = "rgba(0,0,0,.34)"; for (let y = 0; y < WH; y += 5) g.fillRect(0, y, 1024, 2); for (let x = 0; x < 1024; x += 5) g.fillRect(x, 0, 2, WH); }
  function drawWall(v) { wx.fillStyle = "#04060f"; wx.fillRect(0, 0, 1024, WH); if (v < 0) { for (let i = 0; i < 13; i++) { wx.fillStyle = i % 2 ? "#e8e6e0" : "#b5122a"; wx.fillRect(0, (i * WH) / 13, 1024, WH / 13 + 1); } wx.fillStyle = "#16286a"; wx.fillRect(0, 0, 410, WH * 0.54); wx.fillStyle = "#fff"; const rs = port ? 9 : 7, rh = (WH * 0.54) / rs; for (let j = 0; j < rs; j++) for (let i = 0; i < 12; i++) { wx.beginPath(); wx.arc(20 + i * 32 + (j % 2) * 16, rh * (j + 0.5), 5, 0, 7); wx.fill(); } }
    else { wx.textAlign = "center"; wx.textBaseline = "middle"; const s = v + "%", col = v >= 100 ? "#ff2a2a" : "#ffd24a"; if (port) { wx.font = `900 170px ${FONT}`; wx.fillStyle = "#ffffff"; wx.fillText("관세", 512, 180); wx.font = `900 ${Math.min(330, 1500 / s.length)}px ${FONT}`; wx.fillStyle = col; wx.fillText(s, 512, 500); } else { wx.font = `900 72px ${FONT}`; wx.fillStyle = "#ffffff"; wx.fillText("관세", 170, 150); wx.font = `900 ${v >= 1000 ? 214 : 226}px ${FONT}`; wx.fillStyle = col; wx.fillText(s, 620, 158); } }
    wx.drawImage(gridC, 0, 0); wallT.needsUpdate = true; }
  drawWall(-1);
  // 조명 기둥 · 등 · 빛줄기
  const glw = glowTex(), beams = [], lamps = [], beamG = new THREE.ConeGeometry(1, 1, 28, 1, true).translate(0, -0.5, 0);
  const beam = (src, col, op = 0) => { const m = new THREE.Mesh(beamG, new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(col) }, uA: { value: op } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.position.copy(src); m.frustumCulled = false; env.add(m); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); sp.position.copy(src); sp.scale.setScalar(HU * 1.5); env.add(sp); return { m, sp, src, col }; };
  const trussY = wallH + HU * 1.6; { const n = 6; for (let i = 0; i < n; i++) { const x = lerp(-wallW * 0.46, wallW * 0.46, i / (n - 1)), b = beam(V(x, trussY, wallZ + HU * 0.8), [0xff2a3c, 0xffffff, 0x2f62ff][i % 3]); b.ph = i * 1.13; beams.push(b); } box(wallW + HU, HU * 0.16, HU * 0.16, steel, 0, trussY + HU * 0.1, wallZ + HU * 0.8); }
  const follow = beam(H(-2.4, 9.5, 8), 0xfff4e0); const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: glw, color: 0xffeeda, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.y = 1.6; pool.scale.setScalar(HU * 1.3); scene.add(pool);
  // ── 달력 바닥: 조각 모두를 한 번에 그림 ──
  const AT = atlas(o.pieces), geos = []; let nV = 0, nI = 0;
  o.pieces.forEach((p, i) => { const dz = clamp(Math.min(p.W, p.H) * 0.16, 8, 15), [u0, v0, u1, v1] = AT.rect[i], side = new THREE.Color(p.colors && p.colors[0] ? p.colors[0] : "#e8e4dc").multiplyScalar(0.62), col = [side.r, side.g, side.b], uvOf = (x, z) => [u0 + (x / p.W + 0.5) * (u1 - u0), v0 + (z / p.H + 0.5) * (v1 - v0)], q0 = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -p.th), c0 = V(p.cx - w2, 0, p.cy - h2);
    for (const poly of cracked(p.W, p.H, clamp(Math.round(p.W / 42), 1, 7), clamp(Math.round(p.H / 42), 1, 9))) { const { g, cx, cz } = prism(poly, dz, uvOf, AT.white, col); nV += g.attributes.position.count; nI += g.index.count; geos.push({ g, c: V(cx, 0, cz).applyQuaternion(q0).add(c0), q0, thick: dz }); } });
  const fMat = new THREE.MeshStandardMaterial({ map: AT.t, emissiveMap: AT.t, vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1, color: 0x777777, roughness: 0.82, alphaTest: 0.02, toneMapped: false });
  fMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;"); }; fMat.customProgramCacheKey = () => "tariffFloor";
  const top = new THREE.BatchedMesh(Math.max(1, geos.length), Math.max(3, nV), Math.max(3, nI), fMat); top.sortObjects = false; top.perObjectFrustumCulled = false; top.frustumCulled = false; top.castShadow = top.receiveShadow = true; scene.add(top);
  const pageC = new THREE.Color(getComputedStyle(document.body).backgroundColor || "#f6f7f9"), bMat = new THREE.MeshStandardMaterial({ color: pageC, emissive: pageC, emissiveIntensity: 0.55, roughness: 0.92, transparent: true, opacity: 0, toneMapped: false });
  const bGeos = []; let bV = 0, bI = 0; { const white = [0, 0], nx = Math.ceil(vw / 64), nz = Math.ceil(vh / 64), thick = 20, y0 = 15, cc = [1, 1, 1]; for (const poly of cracked(vw + 4, vh + 4, nx, nz)) { const { g, cx, cz } = prism(poly, thick, () => [0, 0], white, cc); bV += g.attributes.position.count; bI += g.index.count; bGeos.push({ g, c: V(cx, -y0, cz), q0: new THREE.Quaternion(), thick: thick + y0 }); } }
  const base = new THREE.BatchedMesh(bGeos.length, bV, bI, bMat); base.sortObjects = false; base.perObjectFrustumCulled = false; base.frustumCulled = false; base.receiveShadow = true; scene.add(base);
  const shards = [], m4 = new THREE.Matrix4(), one = V(1, 1, 1), q4 = new THREE.Quaternion(), qa = new THREE.Quaternion();
  for (const [bm, list] of [[top, geos], [base, bGeos]]) for (const s of list) { const gid = bm.addGeometry(s.g), id = bm.addInstance(gid); bm.setMatrixAt(id, m4.compose(s.c, s.q0, one)); shards.push({ bm, id, c: s.c, q0: s.q0, thick: s.thick, p: s.c.clone(), q: s.q0.clone(), v: V(), ax: V(1, 0, 0), wr: 0, free: false, done: false, ta: 0, t0: 0, amp: 0, dy: 0, tl: 0, d: 0, bounced: false }); s.g.dispose(); }
  // 춤출 때 바닥 위에 깔리는 불빛
  const discoU = { uA: { value: 0 }, uT: { value: 0 }, uBeat: { value: 0 }, uCell: { value: Math.max(46, vw / 7) } };
  const disco = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), new THREE.ShaderMaterial({ uniforms: discoU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uA, uT, uBeat, uCell; varying vec2 vP;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){ vec2 g = floor(vP / uCell), f = fract(vP / uCell) - 0.5; float k = floor(uT * 2.0), r = h(g + k * 0.37), r2 = h(g * 1.7 + 3.1), d = length(vP) / uCell; float ring = pow(0.5 + 0.5 * sin(d * 1.5 - uT * 6.2831853 * 0.5), 6.0);
  vec3 c = r2 < 0.34 ? vec3(1.0, 0.1, 0.16) : r2 < 0.67 ? vec3(0.15, 0.3, 1.0) : vec3(1.0, 0.95, 0.85); float on = step(0.52, r) * (0.34 + 0.66 * uBeat), m = smoothstep(0.5, 0.36, max(abs(f.x), abs(f.y))); float a = (on * m * 0.34 + ring * 0.2) * uA; gl_FragColor = vec4(c * a, a); }` }));
  disco.rotation.x = -Math.PI / 2; disco.position.y = 1.2; disco.frustumCulled = false; scene.add(disco);
  // ── 종이 ──
  const pc = document.createElement("canvas"); pc.width = 704; pc.height = 492; const px = pc.getContext("2d"), papT = new THREE.CanvasTexture(pc); papT.colorSpace = THREE.SRGBColorSpace; papT.anisotropy = 8;
  function drawPaper(v) { const W = pc.width, Hh = pc.height; px.fillStyle = "#fbf8ee"; px.fillRect(0, 0, W, Hh); px.strokeStyle = "#a08a4a"; px.lineWidth = 5; px.strokeRect(16, 16, W - 32, Hh - 32); px.lineWidth = 1.5; px.strokeRect(26, 26, W - 52, Hh - 52);
    px.textAlign = "left"; px.textBaseline = "alphabetic"; px.fillStyle = "#111"; px.font = `900 104px ${FONT}`; px.fillText("관세:", 52, 136); const s = v + "%", fs = Math.min(236, 545 / (s.length * 0.6)); px.font = `900 ${fs}px ${FONT}`; px.textAlign = "center"; px.fillStyle = v === 0 ? "#6b7488" : v >= 100 ? "#d30f1f" : "#111"; px.fillText(s, W / 2, 150 + (Hh - 150 - 74) / 2 + fs * 0.36);
    px.strokeStyle = "#16181f"; px.lineWidth = 4; px.lineJoin = "miter"; px.beginPath(); let sx = W / 2 - 110; px.moveTo(sx, Hh - 62); for (let i = 0; i < 15; i++) { sx += 15; px.lineTo(sx, Hh - 62 + (i % 2 ? -38 - (i % 3) * 7 : 9)); } px.stroke(); px.fillStyle = "#c9a227"; px.beginPath(); px.arc(W - 84, 90, 34, 0, 7); px.fill(); px.fillStyle = "#fbf8ee"; px.beginPath(); px.arc(W - 84, 90, 21, 0, 7); px.fill(); papT.needsUpdate = true; }
  drawPaper(5);
  const PW = 0.6, PH = 0.42, papG = new THREE.PlaneGeometry(PW, PH, 14, 8); { const q = papG.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, -0.05 * Math.pow(q.getX(i) / (PW / 2), 2)); papG.computeVertexNormals(); }
  const pap = new THREE.Mesh(papG, new THREE.MeshStandardMaterial({ map: papT, emissiveMap: papT, emissive: 0xffffff, emissiveIntensity: 0.62, color: 0x999999, roughness: 0.78, side: THREE.DoubleSide, toneMapped: false })); pap.castShadow = true; pap.visible = false; pap.frustumCulled = false; pap.scale.setScalar(HU); scene.add(pap);
  // ── 입자 ──
  function makePts(N, tex, add, shade) { const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), sz = new Float32Array(N), rt = new Float32Array(N), col = new Float32Array(N * 4);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aS", new THREE.BufferAttribute(sz, 1)); geo.setAttribute("aR", new THREE.BufferAttribute(rt, 1)); geo.setAttribute("aC", new THREE.BufferAttribute(col, 4));
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR }, map: { value: tex }, uShade: { value: shade ? 1 : 0 } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; m.renderOrder = add ? 6 : 5; scene.add(m);
    const P = [], c = new THREE.Color(); return { P, add(q) { if (P.length >= N) P.shift(); q.life = 0; P.push(q); }, step(dt) { for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.life += dt; if (q.life >= q.max) { P.splice(i, 1); continue; } q.v.y += (q.g || 0) * dt; q.v.multiplyScalar(Math.exp(-(q.drag || 0) * dt)); q.p.addScaledVector(q.v, dt); q.rot += (q.w || 0) * dt; }
      for (let i = 0; i < N; i++) { const q = P[i]; if (!q) { col[i * 4 + 3] = 0; continue; } const u = q.life / q.max; pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; sz[i] = lerp(q.s0, q.s1, 1 - Math.pow(1 - u, 2)); rt[i] = q.rot || 0; c.set(q.c); col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = q.a * Math.min(1, u * 12) * Math.pow(1 - u, q.fo || 1.3); }
      geo.attributes.position.needsUpdate = geo.attributes.aS.needsUpdate = geo.attributes.aR.needsUpdate = geo.attributes.aC.needsUpdate = true; } }; }
  const puffT = puffTex(), smoke = makePts(520, puffT, false, true), spark = makePts(420, glw, true, false);
  // 꽃가루
  const NC = 340, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.62), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), NC), CF = [], cc = new THREE.Color(); conf.frustumCulled = false; conf.visible = false; scene.add(conf);
  const e4 = new THREE.Euler(), sv = V(); for (let i = 0; i < NC; i++) { CF.push({ p: V(rnd(-1, 1) * HU * 6, rnd(HU * 2, HU * 13), rnd(-HU * 5, HU * 6)), v: rnd(HU * 0.8, HU * 1.7), r: V(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: V(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)), ph: rnd(0, 6), s: HU * rnd(0.05, 0.1) }); conf.setColorAt(i, cc.set([0xd8132a, 0xf4f4f4, 0x2a55d8, 0xffd24a][i % 4])); }
  const ov = css => { const e = document.createElement("div"); e.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;opacity:0;" + css; document.body.append(e); return e; };
  const flash = ov("background:#fff"), fade = ov("background:#000");
  // ── 인물 · 거대한 손 준비 ──
  if (import.meta.env.DEV) { window.__trK = K; window.__trG = G; }
  K.root.visible = false; K.root.quaternion.identity(); K.root.scale.setScalar(HU); K.root.position.set(0, 0, 0); K.headG.scale.setScalar(K.HS); K.show("d"); K.tint(new THREE.Color(1, 1, 1), 0); scene.add(K.root);
  const Kg = (3.3 * HU) / G.len; G.root.position.set(0, 0, 0); G.root.quaternion.identity(); G.root.scale.setScalar(Kg); G.root.visible = false; scene.add(G.root); G.flick(1, 0, 0); const tipL = G.tip().multiplyScalar(Kg); G.flick(0);
  const Z_IN = -4.2, ENTRY = H(0, -0.14, -0.62), TH_END = -2.96;
  renderer.compile(scene, cam);
  // 처음 보이는 순간 끊기지 않게: 인물·손·무대를 1픽셀 크기로 한 번 그려 그림과 모양을 미리 올려 둠
  { const vis = [K.root, G.root, env, pap, conf], vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissorTest(); vis.forEach(v => (v.visible = true)); K.show("all"); K.begin(); renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true); renderer.render(scene, cam); renderer.setScissorTest(sc); renderer.setViewport(vp); renderer.clear(); vis.forEach(v => (v.visible = false)); K.show("d"); }
  X.use("tariff", 3); document.documentElement.classList.add("tariff-on");
  let t = 0, last = performance.now(), raf = 0, ended = false, stopT = 0, hitDone = false, shake = 0, roll = 0, rollV = 0, pval = 5, drawnV = 5, tickAcc = 0, wallV = -2, tossed = false, tWall = 0, tPap = 0;
  const once = new Set(), at = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } }, ease = (a, b, x) => sstep(seg(x, a, b));
  // ── 자세: 값 묶음을 계산하고 섞어서 뼈에 넣음 (동작이 바뀌어도 팔다리가 튀지 않게) ──
  const newPose = () => ({ hp: [0, 0.955, 0], hr: [0, 0, 0], sp: [0, 0, 0], ch: [0, 0, 0], fL: [0.16, 0.08, 0, 0, 0.1], fR: [-0.16, 0.08, 0, 0, -0.1], wL: [0.31, 0.86, 0.07], wR: [-0.31, 0.86, 0.07], pL: [0.6, -0.3, -1], pR: [-0.6, -0.3, -1], cL: [0.34, 0.25, 0.34], cR: [0.34, 0.25, 0.34], hd: [0, 0, 0] });
  const PA = newPose(), PB = newPose(), PM = newPose();
  const mixP = (o2, a, b, w) => { for (const k in o2) for (let i = 0; i < o2[k].length; i++) o2[k][i] = lerp(a[k][i], b[k][i], w); return o2; };
  function foot(ph, A, S) { const uu = ((ph + (S === "L" ? 0 : 0.5)) % 1 + 1) % 1; if (uu < 0.56) return { z: A * (1 - (2 * uu) / 0.56), y: 0.08, p: 0 }; const w = (uu - 0.56) / 0.44; return { z: -A + 2 * A * sstep(w), y: 0.08 + 0.1 * Math.sin(Math.PI * w) * (A > 0.02 ? 1 : 0), p: 0.5 * Math.sin(Math.PI * w) * (w < 0.5 ? 1 : -0.6) }; }
  // 춤: 2박에 한 번 좌우로 엉덩이 · 주먹을 번갈아 올림 · 박자마다 무릎을 굽혔다 폄 (A가 있으면 걸어 나옴)
  function danceP(o2, tb, A, ph) { const s = Math.sin(Math.PI * tb), c = Math.cos(Math.PI * tb), d = Math.pow(Math.abs(c), 3), pump = Math.sin(2 * Math.PI * tb);
    o2.hp[0] = 0.085 * s; o2.hp[1] = 0.952 - 0.058 * d; o2.hp[2] = 0.01; o2.hr[0] = 0.04; o2.hr[1] = 0.3 * s; o2.hr[2] = 0.1 * s; o2.sp[0] = -0.02; o2.sp[1] = -0.14 * s; o2.sp[2] = -0.06 * s; o2.ch[0] = -0.09 + 0.03 * d; o2.ch[1] = -0.2 * s; o2.ch[2] = -0.08 * s;
    if (A > 0.001) { const L = foot(ph, A, "L"), R = foot(ph, A, "R"); o2.fL[0] = 0.17; o2.fL[1] = L.y; o2.fL[2] = L.z; o2.fL[3] = L.p; o2.fL[4] = 0.16; o2.fR[0] = -0.17; o2.fR[1] = R.y; o2.fR[2] = R.z; o2.fR[3] = R.p; o2.fR[4] = -0.16; }
    else { const lL = Math.max(0, -s), lR = Math.max(0, s); o2.fL[0] = 0.215; o2.fL[1] = 0.08 + 0.045 * lL; o2.fL[2] = 0.02; o2.fL[3] = 0.32 * lL; o2.fL[4] = 0.14 + 0.36 * s; o2.fR[0] = -0.215; o2.fR[1] = 0.08 + 0.045 * lR; o2.fR[2] = 0.02; o2.fR[3] = 0.32 * lR; o2.fR[4] = -0.14 + 0.36 * s; }
    const uL = sstep(0.5 + 0.5 * s), uR = 1 - uL, sway = 0.085 * s; o2.wL[0] = 0.43 - 0.06 * uL + sway; o2.wL[1] = 1.3 + 0.36 * uL + 0.02 * pump; o2.wL[2] = 0.13 + 0.09 * uL; o2.wR[0] = -0.43 + 0.06 * uR + sway; o2.wR[1] = 1.3 + 0.36 * uR - 0.02 * pump; o2.wR[2] = 0.13 + 0.09 * uR;
    o2.pL[0] = 1; o2.pL[1] = -0.75; o2.pL[2] = -0.5; o2.pR[0] = -1; o2.pR[1] = -0.75; o2.pR[2] = -0.5; o2.cL[0] = o2.cR[0] = 1; o2.cL[1] = o2.cR[1] = 0.9; o2.cL[2] = o2.cR[2] = 1; o2.hd[0] = 0.09 * d - 0.03; o2.hd[1] = 0; o2.hd[2] = 0.14 * s; return o2; }
  const REST_R = [-0.31, 0.86, 0.07], REST_L = [0.31, 0.86, 0.07], POCKET = [0.075, 1.3, 0.235], HOLD_R = [-0.35, 1.06, 0.41], HOLD_L = [0.35, 1.06, 0.41];
  const l3 = (o2, a, b, k) => { for (let i = 0; i < 3; i++) o2[i] = lerp(a[i], b[i], k); return o2; };
  function stillP(o2, tt) { const br = Math.sin(tt * 1.9), x = seg(tt, T.up0, T.up1), trem = lerp(0.0014, 0.008, x * x) * (tt > T.show ? 1 : 0); o2.hp[0] = 0; o2.hp[1] = 0.964 + 0.003 * br; o2.hp[2] = 0; o2.hr[0] = 0; o2.hr[1] = 0; o2.hr[2] = 0; o2.sp[0] = 0; o2.sp[1] = 0; o2.sp[2] = 0; o2.ch[0] = -0.05; o2.ch[1] = 0; o2.ch[2] = 0;
    o2.fL[0] = 0.17; o2.fL[1] = 0.08; o2.fL[2] = 0; o2.fL[3] = 0; o2.fL[4] = 0.14; o2.fR[0] = -0.17; o2.fR[1] = 0.08; o2.fR[2] = 0; o2.fR[3] = 0; o2.fR[4] = -0.14;
    const a = ease(T.draw0, T.pocket, tt), b = ease(T.pocket + 0.06, T.show - 0.06, tt), wl = ease(T.pocket - 0.04, T.show - 0.06, tt); l3(o2.wR, REST_R, POCKET, a); l3(o2.wR, o2.wR, HOLD_R, b); l3(o2.wL, REST_L, HOLD_L, wl); const j = Math.sin(tt * 41) * trem, j2 = Math.sin(tt * 37 + 1) * trem; o2.wR[0] += j; o2.wR[1] += j2; o2.wL[0] += j; o2.wL[1] += j2;
    o2.pR[0] = -0.9; o2.pR[1] = -0.75; o2.pR[2] = lerp(-1, -0.25, a); o2.pL[0] = 0.9; o2.pL[1] = -0.75; o2.pL[2] = lerp(-1, -0.25, wl); const gr = Math.max(b, 0), cR = lerp(0.34, 0.58, a); o2.cR[0] = lerp(cR, 0.72, gr); o2.cR[1] = lerp(0.25, 0.6, gr); o2.cR[2] = lerp(cR, 0.7, gr); o2.cL[0] = lerp(0.34, 0.72, wl); o2.cL[1] = lerp(0.25, 0.6, wl); o2.cL[2] = lerp(0.34, 0.7, wl); o2.hd[0] = 0.015; o2.hd[1] = 0; o2.hd[2] = 0; return o2; }
  const qw = new THREE.Quaternion(), qn = new THREE.Quaternion(), qi = new THREE.Quaternion(), eh = new THREE.Euler();
  function applyP(P) { K.begin(); K.B.hips.position.set(P.hp[0], P.hp[1], P.hp[2]); K.setE("hips", ...P.hr); K.setE("spine", ...P.sp); K.setE("chest", ...P.ch); K.sync();
    K.leg("L", V(P.fL[0], P.fL[1], P.fL[2]), P.fL[3], P.fL[4], V(0.35, 0, 1)); K.leg("R", V(P.fR[0], P.fR[1], P.fR[2]), P.fR[3], P.fR[4], V(-0.35, 0, 1)); K.arm("L", V(P.wL[0], P.wL[1], P.wL[2]), V(P.pL[0], P.pL[1], P.pL[2])); K.arm("R", V(P.wR[0], P.wR[1], P.wR[2]), V(P.pR[0], P.pR[1], P.pR[2])); K.fingers("L", P.cL[0], P.cL[1], P.cL[2]); K.fingers("R", P.cR[0], P.cR[1], P.cR[2]); K.sync();
    // 고개: 늘 카메라 쪽 (사진 얼굴이 정면에 가깝게) + 춤에 맞춘 끄덕임
    const nw = K.B.neck.getWorldPosition(V()), to = K.root.worldToLocal(cam.position.clone()).sub(K.root.worldToLocal(nw)), yaw = clamp(Math.atan2(to.x, to.z), -1.1, 1.1), pit = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.5, 0.4);
    qw.setFromEuler(eh.set(pit + P.hd[0], yaw + P.hd[1], P.hd[2], "YXZ")); K.quatOf(K.B.chest, qn); K.B.neck.quaternion.copy(qn.clone().invert().multiply(qw)).slerp(qi, 0.5); K.sync(); K.quatOf(K.B.neck, qn); K.B.head.quaternion.copy(qn.invert().multiply(qw)); K.sync(); }
  // ── 인물 움직임 ──
  const LIMP = { armL: [-0.1, 0, 0.3], armR: [-0.1, 0, -0.34], foreL: [-0.34, 0, 0], foreR: [-0.26, 0, 0], thighL: [-0.1, 0, 0.13], thighR: [0.06, 0, -0.13], shinL: [0.2, 0, 0], shinR: [0.1, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0], spine: [0.04, 0, 0], chest: [0.05, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], hips: [0, 0, 0] };
  const fq = new THREE.Quaternion(), fe = new THREE.Euler(), qStart = {}, P0 = V(), Mdl = V(0, 1.7, 0), epos = V(); let hips0 = V(), fallV = 0, fallY = 0, landed = false, twitch = 0;
  function trump(t, dt) {
    if (t >= T.hit) { flip(t, dt); return; }
    const wu = seg(t, T.in0, T.in1); K.root.visible = t >= T.in0 - 0.05; if (!K.root.visible) return;
    const we = wu < 0.86 ? wu / 0.93 : lerp(0.86 / 0.93, 1, eOut(seg(wu, 0.86, 1))), zNow = lerp(Z_IN, 0, we); K.root.position.set(0, 0, zNow * HU);
    const tb0 = (t - T.in0) / BT, tbD = (t - T.dance) / BT, amp = wu < 1 ? Math.pow(Math.sin(Math.PI * Math.min(1, wu * 1.02)), 0.4) : 0, A = 0.29 * amp, ph = (-Z_IN * we) / 1.16;
    const wS = sstep(seg(t, T.in1 - 0.02, T.in1 + 0.2)) * (1 - sstep(seg(t, T.dance - 0.03, T.dance + 0.2)));
    danceP(PA, t < T.dance ? tb0 : tbD, t < T.in1 ? A : 0, ph); if (wS > 0) { stillP(PB, t); mixP(PM, PA, PB, wS); } else mixP(PM, PA, PA, 0);
    // 종이를 던지는 팔
    if (t >= T.dance && t < T.dance + 0.34) { const q = seg(t, T.dance, T.dance + 0.34), k = Math.sin(Math.PI * q); PM.wR[1] += 0.3 * k; PM.wR[0] += 0.12 * k; }
    applyP(PM);
    K.show(t < T.in1 + 0.06 ? "d" : t < T.dance ? "s" : t >= T.tap ? "d" : Math.floor((t - T.dance) / BT) % 2 ? "d" : "u");
    if (dt > 0) K.tieStep(dt, HU); }
  function flip(t, dt) { const u = t - T.hit, q = seg(u, 0, 0.17), e = 1 - Math.pow(1 - q, 2.2), a0 = seg(u, 0, 0.09);
    if (u > 0.95) { /* 무너지며 함께 떨어짐 */ }
    const wob = q >= 1 ? Math.exp(-(u - 0.17) * 3.4) : 0, ang = TH_END * e + wob * 0.34 * Math.sin((u - 0.17) * 21), rz = wob * 0.16 * Math.sin((u - 0.17) * 17 + 1) + (q >= 1 ? 0.14 * (1 - wob) : 0);
    const k = Math.exp(-u * 0.9), kk = Math.sin(u * 27) * k * (t < T.crash + 1.4 ? 1 : 0.2) + twitch;
    K.begin(); for (const n in LIMP) { const L = LIMP[n], extra = n === "thighL" ? 0.42 * kk : n === "thighR" ? -0.42 * kk : n === "shinL" ? 0.3 * Math.max(0, kk) : n === "shinR" ? 0.3 * Math.max(0, -kk) : 0; fq.setFromEuler(fe.set(L[0] + extra, L[1], L[2], "YXZ")); K.B[n].quaternion.copy(qStart[n]).slerp(fq, a0); }
    K.B.hips.position.lerpVectors(hips0, REST0, a0);
    // 몸 전체: 목을 축으로 앞으로 뒤집히며 바닥에 꽂힘
    if (t >= T.crash + 0.04 && !landed) { fallV -= HU * 26 * dt; fallY += fallV * dt; const y0 = pile(0) - PIT - HU * 0.14 - ENTRY.y; if (fallY < y0) { fallY = y0; landed = true; snd.thud(); shake = Math.max(shake, HU * 0.12); } }
    epos.lerpVectors(P0, ENTRY, e); epos.y += fallY; K.root.quaternion.setFromEuler(fe.set(ang, 0, rz, "XYZ")); K.root.position.copy(epos).sub(Mdl.clone().multiplyScalar(HU).applyQuaternion(K.root.quaternion)); K.sync();
    const sq = Math.exp(-u * 16); K.headG.scale.set(K.HS * (1 + 0.22 * sq), K.HS * (1 - 0.28 * sq), K.HS * (1 + 0.1 * sq)); if (dt > 0) K.tieStep(dt, HU, 0); }
  const REST0 = V(0, 0.98, 0);
  const pile = d => HU * 0.95 * Math.exp(-Math.pow(d / (HU * 1.7), 2));
  // ── 종이 ──
  const papV = V(), papW = V(), papP = V(), footW = V();
  function paper(t, dt) {
    if (t < T.pocket) { pap.visible = false; return; }
    if (t < T.dance) { pap.visible = true; const hr = K.B.handR.getWorldPosition(V()), u = seg(t, T.pocket + 0.06, T.show), e = eOut(seg(u, 0.5, 1)), s = lerp(0.16, 1, eBack(seg(u, 0.52, 1), 2.2)), ctr = K.root.localToWorld(V(0, 1.215, 0.45)), x = seg(t, T.up0, T.up1), j = t > T.show ? lerp(0.5, 4.5, x * x * x) * (HU / 140) : 0;
      pap.position.lerpVectors(hr, ctr, e); pap.position.x += Math.sin(t * 47) * j; pap.position.y += Math.sin(t * 53 + 1) * j; pap.scale.setScalar(HU * s); pap.rotation.set(lerp(-1.1, -0.1, e), lerp(0.9, 0, e), lerp(0.7, 0, e)); return; }
    if (!tossed) { tossed = true; snd.paper(); papV.set(HU * 2.1, HU * 9.5, -HU * 1.5); papW.set(4.5, 2.5, 7); papP.copy(pap.position); }
    if (t < T.drop) { if (papP.y > HU * 16) { pap.visible = false; return; } papV.y -= HU * 2.2 * dt; papP.addScaledVector(papV, dt); pap.position.copy(papP); pap.rotation.x += papW.x * dt; pap.rotation.y += papW.y * dt; pap.rotation.z += papW.z * dt; return; }
    // 끝: 위에서 살랑살랑 내려와 발바닥 위에 앉음
    pap.visible = true; const u = seg(t, T.drop, T.land), e = 1 - Math.pow(1 - u, 1.35), sw = Math.sin(u * Math.PI * 3.4) * (1 - u); K.B.footL.getWorldPosition(footW); footW.y += HU * 0.14; const y0 = footW.y + HU * 6.2;
    pap.position.set(lerp(HU * 0.9, footW.x, e) + sw * HU * 1.05, lerp(y0, footW.y, e), lerp(HU * 1.2, footW.z, e) + sw * HU * 0.2); pap.scale.setScalar(HU); pap.rotation.set(-1.02 + sw * 0.55, 0.16, sw * 0.62 + 0.1);
    const dn = seg(t, T.land - 0.92, T.land - 0.12), nv = Math.round(1000 * Math.pow(1 - dn, 3)); if (nv !== drawnV) { drawnV = nv; drawPaper(nv); } }
  // ── 딱밤 손: 화면 오른쪽에서 들어와 엄지로 가운뎃손가락을 잡았다 튕겨 이마를 때림 ──
  const hq = new THREE.Quaternion(), hW = V(), hEl = V(), ELB = V(1, 0.5, 0.14).normalize(), FH = V(-0.045, 0.245, 0.115), fW = V(), hN = V(), tipW = V();
  { const fy = V(-1, -0.42, 0.05).normalize(), fz = V(0, 0.16, 1); fz.addScaledVector(fy, -fz.dot(fy)).normalize(); const fx = fy.clone().cross(fz); hq.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fx, fy, fz)); hN.copy(fz); }
  function giant(t, dt) { if (t < T.tap || t >= T.hit + 0.85) { G.root.visible = false; return; } G.root.visible = true;
    if (t < T.hit) K.headG.localToWorld(fW.copy(FH));   // 맞을 때까지 이마를 따라감
    const a = eOut(seg(t, T.tap, T.tap + 0.1)), u = t - T.hit, rc = u > 0 ? Math.sin(Math.min(1, u / 0.14) * Math.PI) * Math.exp(-u * 4) : 0, out = eIn(seg(t, T.hit + 0.3, T.hit + 0.85)), tr = t < T.snap ? seg(t, T.tap + 0.05, T.snap) : 0;
    G.root.quaternion.copy(hq); hW.copy(fW).sub(tipW.copy(tipL).applyQuaternion(hq)).addScaledVector(hN, HU * 0.15); hW.x += (1 - a) * HU * 6 + out * HU * 8; hW.y += (1 - a) * HU * 2.6 + out * HU * 3.6; hW.z += (1 - a) * HU * 1.6; hW.addScaledVector(hN, rc * HU * 0.5); hW.x += Math.sin(t * 90) * HU * 0.012 * tr; hW.y += Math.sin(t * 77) * HU * 0.012 * tr; G.root.position.copy(hW); G.root.updateMatrixWorld(true);
    hEl.copy(hW).addScaledVector(ELB, HU * 30); G.sleeve.quaternion.setFromUnitVectors(V(0, -1, 0), G.root.worldToLocal(hEl.clone()).normalize());
    const k = t < T.snap ? 0 : t < T.hit ? seg(t, T.snap, T.hit) : 1; G.flick(k, tr, ease(T.hit + 0.24, T.hit + 0.62, t)); }
  // ── 달력이 깨지고 무너짐 ──
  function impactFloor() { const c = ENTRY, vr = HU * 13; for (const s of shards) { const dx = s.c.x - c.x, dz = s.c.z - c.z, d = Math.hypot(dx, dz) || 1; s.d = d; s.rx = dx / d; s.rz = dz / d; s.ax.set(-dz / d, 0, dx / d); s.ta = T.hit + 0.16 + d / vr; s.amp = HU * 0.26 * Math.exp(-d / (HU * 3.4)) * rnd(0.7, 1.2); s.dy = -rnd(0, HU * 0.05) * Math.exp(-d / (HU * 4)); s.tl = rnd(-0.03, 0.09) * Math.exp(-d / (HU * 5)); s.t0 = d < HU * 0.56 ? T.hit + 0.17 : T.crash + d / (HU * 15) + rnd(0, 0.16); } }
  function floorStep(t, dt) { if (t < T.hit) return; let touched = 0; for (const s of shards) { if (s.done) continue; if (!s.free) { if (t >= s.t0) { s.free = true; { const k = s.d * rnd(0.5, 1.1); s.v.set(-s.rx * k, -rnd(HU * 0.3, HU * 1.2), -s.rz * k); s.ax.x += rnd(-0.7, 0.7); s.ax.y += rnd(-0.5, 0.5); s.ax.z += rnd(-0.7, 0.7); s.ax.normalize(); } s.wr = rnd(1.6, 4.4); } else { const x = t - s.ta; if (x <= 0) continue; const b = x < 0.34 ? Math.sin((x / 0.34) * Math.PI) * s.amp : 0, st = sstep(seg(x, 0.1, 0.3)); s.p.copy(s.c); s.p.y += b + s.dy * st; qa.setFromAxisAngle(s.ax, s.tl * st + (b / HU) * 0.5); s.q.copy(qa).multiply(s.q0); s.bm.setMatrixAt(s.id, m4.compose(s.p, s.q, one)); continue; } }
      s.v.y -= HU * 24 * dt; s.p.addScaledVector(s.v, dt); qa.setFromAxisAngle(s.ax, s.wr * dt); s.q.premultiply(qa); const rest = -PIT + s.thick + pile(s.d * 0.45) * (s.bm === top ? 1 : 0.7) + (s.id % 7) * HU * 0.025; if (s.p.y < rest) { s.p.y = rest; if (!s.bounced) { s.bounced = true; s.v.y *= -0.2; s.v.x *= 0.4; s.v.z *= 0.4; s.wr *= 0.35; touched++; } else { s.done = true; } } s.bm.setMatrixAt(s.id, m4.compose(s.p, s.q, one)); }
    if (touched && t < T.crash + 2.2) for (let i = 0; i < Math.min(3, touched); i++) { const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * 0.92; smoke.add({ p: V(Math.cos(a) * r * w2, -PIT + rnd(HU * 0.1, HU * 0.5), Math.sin(a) * r * h2), v: V(rnd(-1, 1) * HU * 0.9, rnd(HU * 0.6, HU * 1.9), rnd(-1, 1) * HU * 0.9), drag: 1.5, max: rnd(1.3, 2.6), s0: HU * 0.7, s1: HU * 2.6, a: 0.42, c: 0x9e948a, rot: rnd(0, 6), w: rnd(-0.6, 0.6) }); } }
  // ── 카메라 ──
  const cP = V(), cL = V(), a3 = V(), b3 = V(), upV = V();
  function camera(t, dt, zT) { const tbD = (t - T.dance) / BT, sway = Math.sin(t * 0.7) * 0.22;
    cP.set(sway, 2.75, 6.5 + zT * 0.45); cL.set(0, 1.02, zT * 0.7);
    const a1 = eInOut(seg(t, T.in1 - 0.05, T.show - 0.15)); cP.lerp(a3.set(0, 1.64, 3.1), a1); cL.lerp(b3.set(0, 1.5, 0), a1);
    const a2 = seg(t, T.up0, T.up1), a2e = a2 * a2 * (3 - 2 * a2); cP.lerp(a3.set(0, 1.58, 2.5), a2e); cL.lerp(b3.set(0, 1.52, 0), a2e);
    if (t >= T.dance) { const a = eOut(seg(t, T.dance, T.dance + 0.5)), ox = Math.sin(tbD * 0.42) * 0.85; cP.lerp(a3.set(ox, 2.35 + 0.2 * Math.sin(tbD * 0.8), 5.5 - 0.22 * Math.pow(Math.abs(Math.cos(Math.PI * tbD)), 6)), a); cL.lerp(b3.set(0, 1.08, 0), a); }
    if (t >= T.tap) { const a = eOut(seg(t, T.tap, T.tap + 0.13)); cP.lerp(a3.set(-0.25, 2.4, 11.2), a); cL.lerp(b3.set(0.68, 1.85, 0), a); }
    if (t >= T.hit + 0.5) { const a = eInOut(seg(t, T.hit + 0.5, T.hit + 1.9)); cP.lerp(a3.set(-5.4, 8.8, 12.5), a); cL.lerp(b3.set(0, -0.2, -0.3), a); }
    if (t >= T.final) { const a = eInOut(seg(t, T.final, T.final + 1.5)), fy = (-PIT + pile(0)) / HU; cP.lerp(a3.set(-1.5, fy + 3.1, 4.4), a); cL.lerp(b3.set(0, fy + 1.0, -0.35), a); }
    cP.multiplyScalar(HU); cL.multiplyScalar(HU);
    // 처음: 달력을 정면 위에서 보다가 내려와 비스듬히
    const u = eInOut(seg(t, 0.06, T.pull)); if (u < 1) { const l = cL.clone().multiplyScalar(u), dv = cP.clone().sub(cL), r = lerp(D, dv.length(), u), el = lerp(Math.PI / 2, Math.asin(dv.y / dv.length()), u), az = Math.atan2(dv.x, dv.z); cam.position.set(l.x + r * Math.cos(el) * Math.sin(az), l.y + r * Math.sin(el), l.z + r * Math.cos(el) * Math.cos(az)); cL.copy(l); upV.set(0, u, u - 1).normalize(); cam.up.copy(upV); } else { cam.position.copy(cP); cam.up.set(0, 1, 0); }
    shake *= Math.exp(-dt * 5.5); rollV += (-roll * 40 - rollV * 8) * dt; roll += rollV * dt; const sh = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake); cam.position.add(sh); cam.up.applyAxisAngle(V(0, 0, 1), roll); cam.lookAt(cL.add(sh.multiplyScalar(0.5))); cam.updateMatrixWorld(true); }
  // ── 조명 · 무대 ──
  const tgt = V(); function stage(t, dt, tb) {
    const on = sstep(seg(t, T.dance - 0.02, T.dance + 0.12)), off = t >= T.hit ? 1 - seg(t, T.hit + 0.02, T.hit + 0.12) : 1, entry = sstep(seg(t, 0.5, 1.5)) * (1 - sstep(seg(t, T.in1, T.in1 + 0.3))), bt = Math.pow(Math.abs(Math.cos(Math.PI * tb)), 8), pre = t < T.dance ? entry * 0.55 : 0, x = seg(t, T.up0, T.up1), fl = t >= T.hit ? (Math.random() < 0.3 ? 0.4 : 0) * (1 - seg(t, T.hit + 0.1, T.hit + 0.5)) : 0;
    const lvl = Math.max(pre, on * off, fl);
    beams.forEach((b, i) => { const s = i % 2 ? 1 : -1, a = t * 0.9 + b.ph, tx = Math.sin(a) * HU * 3.2 + s * HU * 0.8, tz = Math.cos(a * 0.8) * HU * 2.6; tgt.set(tx, 0, tz).sub(b.src); const L = tgt.length(); b.m.quaternion.setFromUnitVectors(V(0, -1, 0), tgt.normalize()); b.m.scale.set(HU * 1.05, L, HU * 1.05); b.m.material.uniforms.uA.value = (0.16 + 0.26 * bt) * lvl; b.sp.material.opacity = 0.9 * lvl; });
    // 인물을 따라다니는 빛
    const pz = K.root.visible && t < T.hit ? K.root.position : ENTRY, fA = t >= T.final ? 0.2 * seg(t, T.final, T.final + 0.8) : (t >= T.in0 - 0.3 && t < T.hit ? 0.24 : 0) + (t >= T.hit && t < T.crash ? 0.16 : 0); tgt.set(pz.x, t >= T.final ? -PIT + pile(0) : 0, pz.z).sub(follow.src); const L = tgt.length(); follow.m.quaternion.setFromUnitVectors(V(0, -1, 0), tgt.normalize()); follow.m.scale.set(HU * 0.95, L, HU * 0.95); follow.m.material.uniforms.uA.value = fA; follow.sp.material.opacity = fA * 2.4;
    pool.position.x = pz.x; pool.position.z = pz.z; pool.position.y = t >= T.crash ? -PIT + pile(0) + 1 : 1.6; pool.material.opacity = t >= T.crash ? 0.3 * seg(t, T.final, T.final + 0.8) : fA * 1.05;
    discoU.uA.value = on * off * (t >= T.hit ? 0 : 1); discoU.uT.value = tb * 0.5; discoU.uBeat.value = bt;
    bgU.uT.value = t; bgU.uBeat.value = on * off * bt; bgU.uA.value = sstep(seg(t, 0.32, 0.95)); bgU.uDim.value = lerp(sstep(seg(t, T.in1 + 0.2, T.show)) * 0.55 * (1 - sstep(seg(t, T.dance - 0.1, T.dance + 0.1))), 0.85, t >= T.hit ? sstep(seg(t, T.hit, T.hit + 0.4)) : ease(T.hand, T.hand + 0.9, t) * 0.5);
    // 무대 불빛의 색이 몸에도 비침 · 큰 화면 깜빡임
    const pu = bt * on * off, ss = sstep(seg(t, 0.15, 1.3)), blk = t >= T.hit ? lerp(1, 0.2, seg(t, T.hit, T.hit + 0.3)) : 1; rimR.intensity = (1.5 + 3.5 * pu) * blk; rimB.intensity = (1.7 + 3.5 * pu) * blk; fMat.color.setScalar(lerp(0.184, 0.1, ss)); bMat.color.copy(pageC).multiplyScalar(lerp(1, 0.3, ss)); hemi.intensity = lerp(1.25, 0.8, sstep(seg(t, 0.2, 1.2))) * (t >= T.hit ? lerp(1, 0.55, seg(t, T.hit, T.hit + 0.4)) : 1); key.intensity = t >= T.hit ? lerp(2.6, 1.1, seg(t, T.hit, T.hit + 0.5)) : lerp(2.6, 2.2, ease(T.hand, T.hand + 0.8, t));
    fMat.emissiveIntensity = lerp(1, 0.3, sstep(seg(t, 0.15, 1.3))) * (t >= T.hit ? lerp(1, 0.5, seg(t, T.hit, T.hit + 0.5)) : 1) * lerp(1, 0.72, ease(T.hand, T.hand + 0.8, t)); bMat.opacity = sstep(seg(t, 0, 0.34)); if (bMat.opacity >= 1 && bMat.transparent) { bMat.transparent = false; bMat.needsUpdate = true; } bMat.emissiveIntensity = lerp(0.95, 0.16, sstep(seg(t, 0.15, 1.3)));
    const wf = t >= T.hit ? (t < T.hit + 0.6 && Math.random() < 0.45 ? 0.8 : 0.03) : 0.62 + 0.6 * pu + 0.3 * x; wallM.color.setScalar(wf); ledM.color.setRGB(1, 0.14, 0.2).multiplyScalar((0.35 + 1.1 * pu) * (t >= T.hit ? 0.06 : 1)); ledB.color.setRGB(0.22, 0.42, 1).multiplyScalar((0.35 + 1.1 * pu) * (t >= T.hit ? 0.06 : 1)); K.tint(cc.setRGB(1, 0.86 - 0.2 * pu, 0.82), pu * 0.28); }
  // 꽃가루
  function confetti(t, dt) { if (t < T.dance) return; conf.visible = true; const lim = Y => Y < -PIT; for (let i = 0; i < NC; i++) { const c = CF[i]; c.p.y -= c.v * dt; c.p.x += Math.sin(t * 2.2 + c.ph) * HU * 0.5 * dt; c.r.addScaledVector(c.w, dt); if (lim(c.p.y)) { if (t < T.hit) { c.p.y = HU * rnd(9, 13); } else { c.s = 0; } } conf.setMatrixAt(i, m4.compose(c.p, q4.setFromEuler(e4.set(c.r.x, c.r.y, c.r.z)), sv.setScalar(Math.max(c.s, 0.0001)))); } conf.instanceMatrix.needsUpdate = true; }
  function pyro(t) { if (t < T.dance || t >= T.hit) return; const tb = (t - T.dance) / BT, p = Math.pow(Math.abs(Math.cos(Math.PI * tb)), 10); if (p < 0.5) return; for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) spark.add({ p: V(sx * (w2 + RW * 0.5), 2, -h2 * 0.1 + rnd(-HU, HU)), v: V(rnd(-0.4, 0.4) * HU - sx * HU * 0.4, rnd(5, 9) * HU, rnd(-0.5, 0.5) * HU), g: -HU * 9, drag: 0.5, max: rnd(0.4, 0.9), s0: HU * 0.1, s1: 0, a: 1, c: i % 2 ? 0xffc860 : 0xfff2d0 }); }
  function impact() { hitDone = true; stopT = 0.13; snd.flick(); buzz(3); shake = HU * 0.16; hitAt = performance.now(); burst.position.copy(fW); burst.visible = dent.visible = true; dent.position.copy(fW).addScaledVector(hN, HU * 0.02);
    flash.style.transition = "none"; flash.style.opacity = "0.62"; requestAnimationFrame(() => requestAnimationFrame(() => { flash.style.transition = "opacity .22s ease-out"; flash.style.opacity = "0"; }));
    BONES.forEach(n => (qStart[n] = K.B[n].quaternion.clone())); hips0 = K.B.hips.position.clone(); P0.copy(K.root.position).add(V(0, 1.7 * HU, 0)); impactFloor(); pap.visible = false; K.show("d");
    for (let i = 0; i < 46; i++) { const a = rnd(0, 6.28), r = rnd(2, 9) * HU; spark.add({ p: fW.clone(), v: V(Math.cos(a) * r, Math.sin(a) * r, rnd(-1, 1) * HU), drag: 3.2, max: rnd(0.14, 0.34), s0: HU * 0.1, s1: 0, a: 1, c: i % 3 ? 0xfff0c0 : 0xffffff }); } }
  function embed() { snd.slam(); buzz([3, 70, 3, 110, 2]); shake = HU * 0.55; rollV = 2.4; const ctr = ENTRY.clone().setY(2); for (let i = 0; i < 70; i++) { const a = rnd(0, 6.28); smoke.add({ p: ctr.clone().add(V(Math.cos(a) * HU * 0.3, rnd(0, HU * 0.2), Math.sin(a) * HU * 0.3)), v: V(Math.cos(a) * rnd(1.8, 6.2) * HU, rnd(0.2, 1.2) * HU, Math.sin(a) * rnd(1.8, 6.2) * HU), drag: 2.4, max: rnd(0.8, 1.7), s0: HU * 0.3, s1: HU * 1.8, a: 0.5, c: 0xbab1a4, rot: rnd(0, 6), w: rnd(-1, 1) }); }
    for (let i = 0; i < 90; i++) { const a = rnd(0, 6.28); spark.add({ p: ctr.clone(), v: V(Math.cos(a) * rnd(1, 7) * HU, rnd(1, 7) * HU, Math.sin(a) * rnd(1, 7) * HU), g: -HU * 14, drag: 0.6, max: rnd(0.25, 0.7), s0: HU * 0.09, s1: 0, a: 1, c: i % 3 ? 0xffe2a0 : 0xffffff }); } }
  const BONES = Object.keys(LIMP);
  // 맞는 순간의 번쩍임과 이마 자국
  const burstT = canvasTex(256, 256, (x, w) => { x.translate(w / 2, w / 2); x.fillStyle = "#fff"; for (let i = 0; i < 16; i++) { x.rotate((Math.PI * 2) / 16); const l = 78 + (i % 3) * 20 + Math.random() * 22; x.beginPath(); x.moveTo(-5, 44); x.lineTo(0, l); x.lineTo(5, 44); x.fill(); } });
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstT, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })), dent = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: 0xff2030, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); burst.visible = dent.visible = false; burst.renderOrder = 9; dent.scale.setScalar(HU * 0.2); scene.add(burst, dent); let hitAt = 0;
  // 누르기 전까지 계속 춤 · 트럼프 몸 둘레를 눌렀을 때만 딱밤
  const tapL = document.createElement("div"); tapL.style.cssText = "position:fixed;inset:0;z-index:20;touch-action:none;pointer-events:none;"; const hint = document.createElement("div"); hint.textContent = "트럼프를 눌러!"; hint.style.cssText = `position:fixed;left:0;right:0;bottom:calc(9% + env(safe-area-inset-bottom));z-index:20;text-align:center;font:900 26px ${FONT};color:#fff;text-shadow:0 2px 0 #b5122a,0 3px 12px rgba(0,0,0,.75);pointer-events:none;opacity:0;`; document.body.append(tapL, hint);
  const pv = V(), onTrump = (x, y) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const add = v => { v.project(cam); const a = ((v.x + 1) / 2) * vw, b = ((1 - v.y) / 2) * vh; x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }; for (const n of ["hips", "chest", "handL", "handR", "footL", "footR"]) add(K.B[n].getWorldPosition(pv)); add(K.headG.localToWorld(pv.set(0, 0.32, 0))); const m = Math.max(20, (x1 - x0) * 0.08); return x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m; };
  function fire() { if (T.tap < BIG || t < T.dance) return; T.tap = T.hand = t; T.snap = t + SNAP; T.hit = t + HIT; T.crash = T.hit + 0.95; T.final = T.hit + 2.85; T.drop = T.hit + 3.2; T.land = T.hit + 4.6; T.end = T.hit + 6; tapL.style.pointerEvents = "none"; hint.style.opacity = "0"; }
  tapL.addEventListener("pointerdown", e => { if (innerWidth !== vw || innerHeight !== vh || onTrump(e.clientX, e.clientY)) fire(); }); const onKey = e => { if (e.key === " " || e.key === "Enter") fire(); }; addEventListener("keydown", onKey); if (import.meta.env.DEV) window.__trTap = fire;
  function frame(now) {
    const raw = clamp((now - last) / 1000, 0, 0.05); last = now; let dt = raw;
    if (import.meta.env.DEV && window.__trStop != null) dt = Math.max(0, Math.min(dt, window.__trStop - t));
    if (stopT > 0) { stopT -= raw; dt = 0; }
    if (!hitDone && t + dt >= T.hit) { dt = T.hit - t; t = T.hit; impact(); } else t += dt; if (import.meta.env.DEV) window.__trT = t;
    const th = eOut(seg(t, 0.05, 0.9)), tb = t >= T.dance ? (t - T.dance) / BT : (t - T.in0) / BT; top.scale.y = base.scale.y = lerp(0.02, 1, th); env.visible = t > 0.32;
    if (t > T.in0 - 0.4 && pool.visible === false) pool.visible = true;
    const zT = K.root.visible && t < T.hit ? K.root.position.z / HU : Z_IN;
    camera(t, dt, zT);
    trump(t, dt); paper(t, dt); giant(t, dt); floorStep(t, dt); stage(t, dt, tb); confetti(t, dt); pyro(t); smoke.step(dt); spark.step(dt); sounds(t);
    // 숫자
    if (t >= T.up0 && t < T.dance) { const x = seg(t, T.up0, T.up1), v = x >= 1 ? 1000 : Math.round(5 * Math.pow(200, Math.pow(x, 1.2))); if (v !== drawnV && (x >= 1 || t - tPap > 0.03)) { drawnV = v; tPap = t; drawPaper(v); if (wallV !== v && (v >= 1000 || t - tWall > 0.1)) { wallV = v; tWall = t; drawWall(v); } } tickAcc += dt; if (x < 1 && tickAcc > lerp(0.11, 0.035, x)) { tickAcc = 0; snd.tick(x); } }
    if (t >= T.dance && t < T.tap) { if (tapL.style.pointerEvents !== "auto") tapL.style.pointerEvents = "auto"; if (t > T.dance + 1.3) hint.style.opacity = String(0.72 + 0.28 * Math.sin(t * 7)); }
    if (t >= T.hit + 0.16) at("embed", embed);
    if (hitAt) { const u = (now - hitAt) / 240, q = clamp(u, 0, 1); burst.scale.setScalar(HU * lerp(0.75, 1.9, eOut(q))); burst.material.opacity = 1 - q * q; if (u >= 1) burst.visible = false; dent.material.opacity = 0.85 * (1 - clamp((u - 0.5) / 0.5, 0, 1)); if (u >= 1) dent.visible = false; }
    if (X.mine("tariff")) renderer.render(scene, cam);
    if (t > T.end - 0.75) fade.style.opacity = String(seg(t, T.end - 0.75, T.end));
    if (t >= T.end) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  // ── 소리: 시각표 ──
  function sounds(t) { snd.music(t, t < T.in1 ? { s0: T.in0 - BT * 2, s1: T.in1, lv: 1 } : { s0: T.dance, s1: T.hit, lv: 2 }); if (t >= 0.1) at("crowd", () => snd.crowd(0.1)); if (t >= T.in0) at("crowd1", () => snd.crowd(0.5));
    if (t >= T.in1) at("stop", () => { snd.scratch(); snd.crowd(0.03); buzz(2); }); if (t >= T.pocket + 0.04) at("p1", () => snd.paper()); if (t >= T.show - 0.2) at("p2", () => { snd.snap(); buzz(1); }); if (t >= T.up0) at("riser", () => { snd.riser(T.up1 - T.up0); snd.crowd(0.25); });
    if (t >= T.up1) at("ding", () => { snd.jackpot(); buzz([3, 80, 2]); snd.crowd(0.03); wallV = -2; drawWall(1000); for (let i = 0; i < 44; i++) { const a = rnd(0, 6.28), cx = Math.cos(a), sy = Math.sin(a); spark.add({ p: pap.position.clone().add(V(cx * HU * 0.34, sy * HU * 0.25, HU * 0.04)), v: V(cx * HU * rnd(0.8, 2.2), sy * HU * rnd(0.8, 2.2) + HU * 0.3, rnd(0, 1) * HU), g: -HU * 4, drag: 1.4, max: rnd(0.3, 0.65), s0: HU * 0.035, s1: 0, a: 1, c: 0xffd76a }); } }); if (t >= T.dance) at("drop", () => { snd.crowd(0.75); buzz([3, 70, 2]); });
    if (t >= T.tap) at("whoosh", () => snd.whoosh(0.15)); if (t >= T.hit) at("cut", () => { snd.cut(); });
    if (t >= T.hit + 0.24) at("boing", () => snd.boing()); if (t >= T.crash - 0.28) at("crack", () => snd.crack()); if (t >= T.crash) at("fall", () => { snd.collapse(); shake = Math.max(shake, HU * 0.22); buzz([3, 120, 2, 200, 2, 260, 1]); });
    if (t >= T.final + 0.4) at("cricket", () => snd.crickets()); for (const [k, tt] of [["w1", T.final + 0.5], ["w2", T.final + 0.75], ["w3", T.final + 1.4]]) { if (t >= tt && t < tt + 0.12) { twitch = 0.5; at(k, () => {}); } } if (t >= T.final + 1.6) twitch *= 0.7; else if (!(t >= T.final + 0.5)) twitch = 0; else twitch *= 0.8;
    if (t >= T.land - 0.92) at("wah", () => snd.wah()); if (t >= T.land) at("land", () => snd.paper()); }
  function finish() { cancelAnimationFrame(raf); if (ended) return; ended = true; X.drop("tariff"); document.documentElement.classList.remove("tariff-on"); renderer.autoClear = true; renderer.shadowMap.autoUpdate = true; scene.remove(K.root); scene.remove(G.root); tapL.remove(); hint.remove(); removeEventListener("keydown", onKey); burstT.dispose(); K.headG.scale.setScalar(K.HS); K.root.quaternion.identity(); snd.end();
    scene.traverse(m => { if (m.geometry && m.geometry !== beamG) m.geometry.dispose(); if (m.dispose && m.isBatchedMesh) m.dispose(); if (m.material) [].concat(m.material).forEach(x => { x.dispose(); }); }); beamG.dispose(); AT.t.dispose(); papT.dispose(); wallT.dispose(); bgU.uTex.value.dispose(); glw.dispose(); puffT.dispose();
    flash.remove(); setTimeout(() => { fade.style.transition = "opacity .6s"; fade.style.opacity = "0"; setTimeout(() => fade.remove(), 700); }, 60); o.onDone && o.onDone(); }
  K.begin(); K.tieReset(); raf = requestAnimationFrame(frame);
}

// ── 소리 (전부 직접 합성) ──
function makeSound(get) {
  const A = () => get && get();
  let mg = null, cg = null, cs = null, step = 0, sec = null, cut = false, live = false;
  const noise = (a, t, type, f0, f1, q, gain, att, dur, to) => { const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain(); s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(to || a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); };
  const tone = (a, t, type, f0, f1, gain, att, dur, to, lp) => { const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); if (lp) { const f = a.c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g); g.connect(to || a.out); o.start(t); o.stop(t + dur + 0.05); };
  const bus = a => { if (!mg) { mg = a.c.createGain(); mg.gain.value = 0.62; mg.connect(a.out); } return mg; };
  // 직접 만든 네 마디 반복: F · Dm · B♭ · C
  const CH = [[349.2, 440, 523.3], [293.7, 349.2, 440], [233.1, 293.7, 349.2], [261.6, 329.6, 392]], BS = [87.3, 73.4, 58.3, 65.4];
  const LD = [{ 0: 523.3, 3: 523.3, 6: 587.3, 8: 698.5, 11: 587.3, 14: 523.3 }, { 2: 440, 6: 523.3, 8: 587.3, 12: 523.3 }, { 0: 466.2, 3: 466.2, 6: 523.3, 8: 587.3, 11: 698.5, 14: 587.3 }, { 0: 659.3, 4: 587.3, 6: 523.3, 8: 392, 12: 440, 14: 523.3 }];
  function groove(a, n, at, lv) { const s = n % 16, bar = (n / 16 | 0) % 4, o = bus(a);
    if (s % 4 === 0) { tone(a, at, "sine", 165, 44, 1, 0.002, 0.17, o); noise(a, at, "lowpass", 900, 200, 0.7, 0.16, 0.001, 0.03, o); }
    if (s === 4 || s === 12) { for (const d of [0, 0.012, 0.024]) noise(a, at + d, "bandpass", 1650, 1100, 1.1, 0.42, 0.001, 0.12, o); }
    if (s % 2 === 0) noise(a, at, "highpass", 8200, 7000, 0.7, s % 4 === 2 ? 0.18 : 0.08, 0.001, s % 4 === 2 ? 0.1 : 0.035, o);
    const b = BS[bar]; if ([0, 3, 6, 8, 11, 14].includes(s)) { const f = b * (s === 6 || s === 14 ? 2 : 1); tone(a, at, "sawtooth", f, f * 0.99, 0.3, 0.004, 0.16, o, 520); tone(a, at, "sine", f, f, 0.34, 0.004, 0.17, o); }
    if ([2, 6, 10, 15].includes(s)) for (const f of CH[bar]) { tone(a, at, "sawtooth", f, f, 0.075, 0.006, 0.13, o, 2600); tone(a, at, "square", f * 2, f * 2, 0.018, 0.006, 0.1, o, 3400); }
    if (lv > 1) { const l = LD[bar][s]; if (l) { tone(a, at, "sawtooth", l, l, 0.11, 0.01, 0.2, o, 3000); tone(a, at, "square", l * 1.003, l * 1.003, 0.05, 0.01, 0.2, o, 2200); } } }
  return {
    music(t, q) { const a = A(); if (!a || cut) return; if (sec !== q.s0) { sec = q.s0; step = 0; live = false; } if (t >= q.s1 || t < q.s0 - 0.2) return; if (!live) { live = true; bus(a).gain.cancelScheduledValues(a.c.currentTime); bus(a).gain.setValueAtTime(0.62, a.c.currentTime); } const d = BT / 4; while (q.s0 + step * d < t + 0.11) { const when = q.s0 + step * d; if (when >= q.s1) break; if (when >= t - 0.03) groove(a, step, a.c.currentTime + Math.max(0, when - t), q.lv); step++; } },
    crowd(l) { const a = A(); if (!a) return; if (!cg) { cg = a.c.createGain(); cg.gain.value = 0.0001; cs = a.c.createBufferSource(); cs.buffer = a.noise; cs.loop = true; const f = a.c.createBiquadFilter(), f2 = a.c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1050; f.Q.value = 0.55; f2.type = "lowpass"; f2.frequency.value = 3000; cs.connect(f); f.connect(f2); f2.connect(cg); cg.connect(a.out); cs.start(); } cg.gain.cancelScheduledValues(a.c.currentTime); cg.gain.setTargetAtTime(l * 0.3, a.c.currentTime, 0.28); },
    scratch() { const a = A(); if (!a) return; const t = a.c.currentTime; if (mg) { mg.gain.cancelScheduledValues(t); mg.gain.setValueAtTime(0.62, t); mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); } noise(a, t, "bandpass", 3200, 500, 3, 0.42, 0.005, 0.15); noise(a, t + 0.12, "bandpass", 500, 2600, 3, 0.34, 0.004, 0.13); tone(a, t, "sawtooth", 720, 130, 0.14, 0.004, 0.26, null, 1800); },
    paper() { const a = A(); if (!a) return; const t = a.c.currentTime; for (let i = 0; i < 4; i++) noise(a, t + i * 0.035, "highpass", 3400, 2200, 0.8, 0.13, 0.002, 0.05); },
    snap() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 2600, 900, 1, 0.62, 0.001, 0.09); tone(a, t, "sine", 240, 90, 0.22, 0.002, 0.08); },
    tick(x) { const a = A(); if (!a) return; const t = a.c.currentTime, f = 420 * Math.pow(2, x * 2.6); tone(a, t, "square", f, f, 0.05, 0.001, 0.035, null, 5000); tone(a, t, "sine", f * 2, f * 2, 0.05, 0.001, 0.03); },
    riser(d) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sawtooth", 70, 680, 0.1, d * 0.9, d, null, 1800); noise(a, t, "bandpass", 300, 5200, 2, 0.26, d * 0.92, d); tone(a, t, "sine", 50, 42, 0.28, d * 0.8, d); },
    jackpot() { const a = A(); if (!a) return; const t = a.c.currentTime; [1046.5, 1318.5, 1568, 2093].forEach((f, i) => { tone(a, t + i * 0.055, "sine", f, f, 0.24, 0.002, 0.42); tone(a, t + i * 0.055, "triangle", f * 2, f * 2, 0.06, 0.002, 0.26); }); noise(a, t, "lowpass", 400, 60, 0.7, 0.5, 0.004, 0.4); },
    whoosh(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 240, 2400, 1.1, 0.9, d * 0.9, d); noise(a, t, "lowpass", 180, 900, 0.7, 0.6, d * 0.9, d + 0.02); },
    // 음악·함성을 한 번에 끊고 짝!
    cut() { const a = A(); cut = true; if (!a) return; const t = a.c.currentTime; if (mg) { mg.gain.cancelScheduledValues(t); mg.gain.setValueAtTime(0, t); } if (cg) { cg.gain.cancelScheduledValues(t); cg.gain.setValueAtTime(0, t); } },
    // 딱! 손톱이 이마를 때리는 높고 마른 소리 · 쿵! 머리가 바닥에 박히는 소리
    flick() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 3400, 1900, 2.4, 1, 0.0006, 0.045); noise(a, t, "highpass", 5200, 3000, 0.7, 0.7, 0.0005, 0.03); tone(a, t, "triangle", 1250, 420, 0.8, 0.0008, 0.06); tone(a, t, "sine", 240, 90, 0.6, 0.001, 0.1); },
    slam() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 1300, 340, 0.8, 1, 0.0012, 0.2); tone(a, t, "sine", 210, 30, 1, 0.002, 0.8); tone(a, t, "triangle", 90, 24, 0.75, 0.003, 1.1); noise(a, t + 0.012, "lowpass", 2400, 90, 0.7, 0.75, 0.01, 1.7); },
    boing() { const a = A(); if (!a) return; const t = a.c.currentTime, o = a.c.createOscillator(), l = a.c.createOscillator(), lg = a.c.createGain(), g = a.c.createGain(); o.type = "triangle"; o.frequency.value = 190; l.frequency.setValueAtTime(19, t); l.frequency.exponentialRampToValueAtTime(7, t + 0.9); lg.gain.setValueAtTime(95, t); lg.gain.exponentialRampToValueAtTime(5, t + 0.95); l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 1); o.connect(g); g.connect(a.out); o.start(t); l.start(t); o.stop(t + 1.05); l.stop(t + 1.05); },
    crack() { const a = A(); if (!a) return; const t = a.c.currentTime; for (let i = 0; i < 7; i++) noise(a, t + i * 0.04 + Math.random() * 0.02, "bandpass", rnd(1100, 3200), 700, 2, 0.34 + i * 0.03, 0.001, 0.05); },
    collapse() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 900, 50, 0.7, 1, 0.03, 2.6); tone(a, t, "sine", 60, 22, 0.8, 0.02, 2.1); for (let i = 0; i < 46; i++) { const d = Math.pow(Math.random(), 1.5) * 2; noise(a, t + d, "bandpass", rnd(320, 2500), 200, 1.2, rnd(0.08, 0.3) * (1 - d / 2.4), 0.001, rnd(0.03, 0.09)); } },
    thud() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 120, 36, 0.7, 0.004, 0.3); noise(a, t, "lowpass", 900, 180, 0.8, 0.5, 0.004, 0.26); },
    crickets() { const a = A(); if (!a) return; const t = a.c.currentTime; for (let k = 0; k < 4; k++) for (let i = 0; i < 3; i++) tone(a, t + k * 0.5 + i * 0.05, "sine", 4300, 4250, 0.04, 0.004, 0.034); },
    wah() { const a = A(); if (!a) return; const t = a.c.currentTime; [[233.1, 0.22], [220, 0.22], [207.7, 0.22], [196, 0.62]].reduce((s, [f, d], i) => { tone(a, t + s, "sawtooth", f, i === 3 ? f * 0.93 : f * 0.99, 0.16, 0.02, d, null, 900); return s + d + 0.02; }, 0); },
    end() { try { if (cs) cs.stop(); } catch (e) {} if (cg) cg.disconnect(); if (mg) mg.disconnect(); cg = cs = mg = null; },
  };
}
