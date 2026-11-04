// 바주카포 (3D를 2D 달력 위에 겹쳐 그림): 오른쪽 어깨에 멘 RPG 발사관을 1인칭으로 봄
// 관(칠이 벗겨진 녹색 강철) · 나무 열가림막 · 손잡이 두 개 · 왼쪽 조준경 · 가늠자 · 앞에 끼운 탄두(배가 부른 원뿔 + 신관).
// 톡 누르면: 관 속 발사 화약이 터져 총구 불꽃 · 후폭풍(등 뒤로 불길과 연기, 화면 가장자리로 번짐) · 관이 크게 튀어 오름 →
// 탄이 느리게 튀어 나가 꼬리 날개가 펴지고 0.1초 뒤 로켓 모터 점화(번쩍, 주황 빛이 연기를 비춤) → 빙글 돌며 가속해 누른 곳(달력)까지 실제 원근으로 날아감.
// 꼬리 불꽃 뒤로 흰 연기 줄이 남아 천천히 부풀고 위로 떠오르며 흩어짐 → 달력에서 불덩이가 부풀었다 검은 연기로 바뀌고, 충격파 고리 · 불티 · 깨진 조각이 눈앞으로 튐 (2D에서도 부서짐).
// 쏜 뒤엔 새 탄두를 앞에서 밀어 넣음.
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, V, vnoise } from "./fx-util.js";

let S = null;
export async function bzReady() { const X = fx3d(); if (!S || S.X !== X || X.lost) S = build(X); return S; }
export function bzLoaded() { return !!S && S.X === fx3d() && !S.X.lost; }
export const bz = { show: on => S && S.show(on), aim: (x, y) => S && S.aim(x, y), fire: (x, y, h) => (S ? S.fire(x, y, h) : false), get busy() { return !!S && S.busy; }, hide: () => S && S.hideNow() };

// ── 무늬 (캔버스) ──
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
// 칠이 벗겨진 녹색 강철: 얼룩 · 긁힌 자국(금속이 드러남) · 끝쪽 마모 · 아래쪽 때
const paintTex = () => canvasTex(512, 256, (x, w, h) => {
  const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = vnoise(i * 0.02, j * 0.05) * 0.6 + vnoise(i * 0.09, j * 0.2) * 0.4, k = (j * w + i) * 4, e = Math.min(j, h - 1 - j) / h;
    const wear = vnoise(i * 0.05 + 40, j * 0.08) > 0.72 + e * 0.8 ? 1 : 0, dirt = 0.85 + 0.15 * Math.cos((i / w) * Math.PI * 2);
    const r = wear ? 118 : (66 + n * 18) * dirt, g = wear ? 120 : (74 + n * 18) * dirt, b = wear ? 112 : (48 + n * 12) * dirt;
    d[k] = r + (Math.random() - 0.5) * 8; d[k + 1] = g + (Math.random() - 0.5) * 8; d[k + 2] = b + (Math.random() - 0.5) * 6; d[k + 3] = 255; }
  x.putImageData(im, 0, 0);
  for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(120,122,112,${rnd(0.2, 0.45)})`; x.lineWidth = rnd(0.5, 1.6); const sx = rnd(0, w), sy = rnd(0, h), a = rnd(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI / 2); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * rnd(3, 14), sy + Math.sin(a) * rnd(3, 14)); x.stroke(); }
});
const woodTex = () => canvasTex(256, 512, (x, w, h) => {
  const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w, wv = vnoise(u * 5, j * 0.006) * 2.2 + vnoise(u * 14, j * 0.02) * 0.5, g = Math.pow(Math.sin(u * 40 + wv) * 0.5 + 0.5, 6), f = Math.pow(Math.sin(u * 160 + wv * 3) * 0.5 + 0.5, 4), k = (j * w + i) * 4, n = vnoise(i * 0.03, j * 0.01);
    d[k] = 104 - g * 38 - f * 10 + n * 16; d[k + 1] = 54 - g * 22 - f * 6 + n * 8; d[k + 2] = 28 - g * 10 - f * 3 + n * 4; d[k + 3] = 255; }
  x.putImageData(im, 0, 0); x.fillStyle = "rgba(30,14,4,.25)"; for (let i = 0; i < 6; i++) x.fillRect(rnd(0, w), 0, rnd(1, 3), h);
});
const headTex = () => canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = "#5c6440"; x.fillRect(0, 0, w, h); const im = x.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.7; } x.putImageData(im, 0, 0);
  x.fillStyle = "#c8ac52"; x.fillRect(0, h * 0.62, w, h * 0.06);   // 노란 띠
  x.fillStyle = "rgba(15,15,10,.8)"; x.font = "bold 22px monospace"; x.textAlign = "center"; for (let i = 0; i < 2; i++) { x.save(); x.translate(w * (0.25 + i * 0.5), h * 0.44); x.fillText("PG-7V  04-21", 0, 0); x.restore(); }
});
// 연기 한 뭉치 (구불구불한 덩어리 · 투명 바탕)
const puffTex = () => canvasTex(128, 128, (x, w, h) => {
  const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w - 0.5, v = j / h - 0.5, r = Math.hypot(u, v) * 2, n = vnoise(i * 0.06, j * 0.06) * 0.6 + vnoise(i * 0.16 + 9, j * 0.16) * 0.4;
    const a = clamp((1 - r) * 1.6 - (1 - n) * 0.9, 0, 1), k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * a * 255; }
  x.putImageData(im, 0, 0);
}, false);
const glowTex = () => canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.2, "rgba(255,240,200,.8)"); g.addColorStop(0.5, "rgba(255,160,60,.25)"); g.addColorStop(1, "rgba(255,100,20,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); });

// 점 입자: 연기(아래가 그늘진 덩어리, 돌며 퍼짐) · 불(더하기 합성)
const PT_VS = `attribute float aS, aR; attribute vec4 aC; uniform float uScale; varying vec4 vC; varying float vR;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(aS * uScale / -mv.z, 900.0); vC = aC; vR = aR; }`;
const PT_FS = `uniform sampler2D map; uniform float uShade; varying vec4 vC; varying float vR;
void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 t = texture2D(map, q); float sh = mix(1.0, mix(1.12, 0.62, gl_PointCoord.y), uShade); float a = t.a * vC.a; if (a < 0.004) discard;
  gl_FragColor = vec4(vC.rgb * sh, a);
  #include <colorspace_fragment>
}`;

function build(X) {
  const { renderer, PR, vw, vh, D, atS, toS } = X, dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const scene = new THREE.Scene(); scene.environment = X.env; scene.environmentIntensity = 0.85;
  const cam = new THREE.PerspectiveCamera(X.FOV, vw / vh, 5, D * 3); cam.position.set(0, 0, D);
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x2a3040 : 0x8a8f99, 1.1));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.4); key.position.set(-0.5 * D, 0.8 * D, 1.2 * D); scene.add(key, key.target);
  const rimL = new THREE.DirectionalLight(0xbcd4ff, 1.1); rimL.position.set(0.8 * D, 0.2 * D, -0.3 * D); scene.add(rimL);
  const fireL = new THREE.PointLight(0xff9a40, 0, D * 1.2, 1.2), boomL = new THREE.PointLight(0xffb060, 0, D * 1.6, 1); scene.add(fireL, boomL);

  // ── 발사관 (어깨 = 원점, +z가 앞) ──
  const L = new THREE.Group(), body = new THREE.Group(); L.add(body); scene.add(L);
  const RT = 13, LEN = 600, Z0 = -110;
  const paint = paintTex(), wood = woodTex();
  const mPaint = new THREE.MeshStandardMaterial({ map: paint, bumpMap: paint, bumpScale: 0.6, roughness: 0.74, metalness: 0.15, envMapIntensity: 0.7 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x1f221c, roughness: 0.5, metalness: 0.7 }), mBlack = new THREE.MeshStandardMaterial({ color: 0x121211, roughness: 0.75, metalness: 0.2 });
  const mWood = new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: 0.8, roughness: 0.42, metalness: 0 });
  const mGrip = new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.6, bumpMap: paint, bumpScale: 0.3 });
  const mGlass = new THREE.MeshPhysicalMaterial({ color: 0x0b2a30, roughness: 0.05, metalness: 0.1, clearcoat: 1, envMapIntensity: 2.2 });
  const add = (geo, m, x = 0, y = 0, z = 0, g = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const cylZ = (r0, r1, l, seg = 40, open = false) => new THREE.CylinderGeometry(r1, r0, l, seg, 1, open).rotateX(Math.PI / 2);   // r0 뒤 · r1 앞
  const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg).rotateX(Math.PI / 2);
  add(cylZ(RT, RT, LEN, 48), mPaint, 0, 0, Z0 + LEN / 2);
  add(lathe([[RT * 1.02, 0], [RT * 1.25, -20], [RT * 1.9, -80], [RT * 2.05, -96], [RT * 1.8, -98], [RT * 1.1, -30], [RT * 0.9, 0]]), mDark, 0, 0, Z0);   // 뒤 깔때기
  add(cylZ(RT * 1.18, RT * 1.18, 16, 40), mDark, 0, 0, Z0 + LEN - 6); add(cylZ(RT * 1.12, RT * 1.12, 6, 40), mDark, 0, 0, Z0 + LEN - 40);   // 총구 테
  add(cylZ(RT * 1.5, RT * 1.5, 150, 48), mWood, 0, 0, 150);   // 나무 열가림막
  for (const z of [72, 228]) add(cylZ(RT * 1.56, RT * 1.56, 7, 48), mDark, 0, 0, z);
  // 손잡이 (방아쇠 · 방아쇠울) · 앞 손잡이
  const gripShape = new THREE.Shape(); gripShape.moveTo(-9, 0); gripShape.lineTo(9, 0); gripShape.lineTo(13, -44); gripShape.quadraticCurveTo(12, -54, 2, -54); gripShape.lineTo(-6, -50); gripShape.lineTo(-11, -6); gripShape.closePath();
  const gripGeo = new THREE.ExtrudeGeometry(gripShape, { depth: 14, bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 3 }).translate(0, 0, -7).rotateY(Math.PI / 2);
  const g1 = add(gripGeo, mGrip, 0, -RT, 255); g1.rotation.x = -0.25; const g2 = add(gripGeo, mGrip, 0, -RT, 345); g2.rotation.x = -0.15; g2.scale.setScalar(0.85);
  const guard = add(new THREE.TorusGeometry(10, 1.6, 8, 20, Math.PI), mDark, 0, -RT - 4, 278); guard.rotation.set(0, Math.PI / 2, Math.PI);
  add(new THREE.BoxGeometry(2.5, 10, 3), mDark, 0, -RT - 6, 274);
  // 조준경 (왼쪽 위): 몸통 · 앞 렌즈 · 뒤 고무 눈받이 · 받침
  const scope = new THREE.Group(); scope.position.set(-RT * 1.7, RT * 1.25, 210); body.add(scope);
  add(new THREE.BoxGeometry(18, 22, 78), mBlack, 0, 0, 0, scope); add(cylZ(7, 7, 16, 24), mBlack, 0, 3, 46, scope); add(new THREE.CircleGeometry(6, 24), mGlass, 0, 3, 54.2, scope);
  add(cylZ(8, 10, 22, 24, true), mBlack, 0, 3, -48, scope); add(new THREE.BoxGeometry(8, 10, 40), mDark, RT * 0.9, -12, 0, scope);
  for (const [x, z] of [[-6, -20], [6, 22]]) add(new THREE.CylinderGeometry(3, 3, 3, 12).rotateZ(Math.PI / 2), mDark, x - 9, 4, z, scope);
  // 가늠자 (앞 · 뒤) · 멜빵 고리 · 나사
  add(new THREE.BoxGeometry(3, 14, 4), mDark, 0, RT + 6, Z0 + LEN - 30); add(new THREE.BoxGeometry(10, 9, 4), mDark, 0, RT + 4, 300);
  for (const z of [40, 420]) { const r = add(new THREE.TorusGeometry(5, 1.2, 8, 16), mDark, RT * 0.95, -4, z); r.rotation.y = Math.PI / 2; }
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(1.6, 1.6, 1.5, 8).rotateZ(Math.PI / 2), mDark, RT * 1.5, rnd(-6, 6), 80 + i * 26);
  body.traverse(o => { if (o.isMesh) o.frustumCulled = false; });

  // ── 탄두 · 날아가는 탄 (원점 = 탄두 밑동, +z가 앞) ──
  const mHead = new THREE.MeshStandardMaterial({ map: headTex(), roughness: 0.55, metalness: 0.3 });
  const headGeo = lathe([[RT * 0.78, -4], [RT * 1.05, 0], [RT * 1.85, 14], [RT * 2.15, 40], [RT * 2.15, 62], [RT * 1.6, 92], [RT * 0.6, 128], [RT * 0.28, 140], [0, 141]], 56);
  function makeRound(flight) {
    const g = new THREE.Group(); add(headGeo, mHead, 0, 0, 0, g); add(cylZ(RT * 0.3, RT * 0.24, 14, 16), mDark, 0, 0, 146, g);   // 신관
    add(cylZ(RT * 0.72, RT * 0.72, flight ? 150 : 60, 24), mPaint, 0, 0, flight ? -75 : -30, g);   // 꼬리(추진관) · 관 속에 든 부분
    const fins = []; if (flight) for (let i = 0; i < 4; i++) { const f = add(new THREE.BoxGeometry(1.4, 22, 34), mDark, 0, 0, -140, g); f.userData.a = (i / 4) * Math.PI * 2; fins.push(f); }
    add(cylZ(RT * 0.55, RT * 0.7, 10, 20), mBlack, 0, 0, flight ? -153 : -64, g);
    g.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); return { g, fins };
  }
  const loaded = makeRound(false); loaded.g.position.z = Z0 + LEN; body.add(loaded.g);

  // ── 입자 ──
  function makePts(N, tex, add, shade) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), sz = new Float32Array(N), rt = new Float32Array(N), col = new Float32Array(N * 4);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aS", new THREE.BufferAttribute(sz, 1)); geo.setAttribute("aR", new THREE.BufferAttribute(rt, 1)); geo.setAttribute("aC", new THREE.BufferAttribute(col, 4));
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR }, map: { value: tex }, uShade: { value: shade ? 1 : 0 } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.frustumCulled = false; m.renderOrder = add ? 6 : 5; scene.add(m);
    const P = [], c = new THREE.Color(), c2 = new THREE.Color();
    return { P, add(o) { if (P.length >= N) P.shift(); o.life = 0; o.rot = o.rot ?? rnd(0, 6.28); o.w = o.w ?? rnd(-0.6, 0.6); P.push(o); },
      step(dt) {
        for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.life += dt; if (q.life >= q.max) { P.splice(i, 1); continue; }
          q.v.y += (q.g || 0) * dt; q.v.multiplyScalar(Math.exp(-(q.drag || 0) * dt)); q.p.addScaledVector(q.v, dt); q.rot += q.w * dt; }
        for (let i = 0; i < N; i++) { const q = P[i]; if (!q) { col[i * 4 + 3] = 0; continue; } const u = q.life / q.max, ue = 1 - Math.pow(1 - u, 2.2);
          pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; sz[i] = lerp(q.s0, q.s1, ue); rt[i] = q.rot; c.set(q.c).lerp(c2.set(q.c2 ?? q.c), Math.min(1, u * (q.cs || 1)));
          col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = q.a * (u < (q.fi || 0.08) ? u / (q.fi || 0.08) : 1) * Math.pow(1 - u, q.fo || 1.2); }
        geo.attributes.position.needsUpdate = geo.attributes.aS.needsUpdate = geo.attributes.aR.needsUpdate = geo.attributes.aC.needsUpdate = true; } };
  }
  const puff = puffTex(), glw = glowTex();
  const smoke = makePts(900, puff, false, true), fireP = makePts(500, puff, true, false), spark = makePts(400, glw, true, false);
  // 로켓 꼬리 불꽃 · 빛
  const flameMat = new THREE.MeshBasicMaterial({ map: glw, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(9, 70, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -35), flameMat); flame.renderOrder = 7;
  const flameCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: 0xfff2d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flameCore.renderOrder = 8;
  const muzzleF = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: 0xffd090, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); muzzleF.renderOrder = 8; scene.add(muzzleF);
  const boomF = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: 0xffe0a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); boomF.renderOrder = 9; scene.add(boomF);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 80), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); shock.renderOrder = 4; scene.add(shock);
  // 눈앞으로 튀는 깨진 조각
  const NCH = 70, chips = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), NCH), CH = [];
  chips.frustumCulled = false; chips.visible = false; scene.add(chips); const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), chipC = new THREE.Color();
  for (let i = 0; i < NCH; i++) { CH.push({ p: V(), v: V(), r: V(), w: V(), s: V() }); chips.setColorAt(i, chipC.set(0xffffff)); }

  // ── 상태 ──
  const pivot0 = atS(vw * 1.22, vh * 1.16, D - 300), aimT = atS(vw * 0.45, vh * 0.42, 0), aimNow = aimT.clone();
  let vis = 0, want = 0, load = 1, recoil = 0, rv = 0, raf = 0, last = 0, t = 0, onHit = null, active = false, cols = null;
  const R = [];   // 날아가는 탄
  const q = new THREE.Quaternion(), mtx = new THREE.Matrix4(), up = V(0, 1, 0), tmp = V();
  const muzzleW = () => loaded.g.getWorldPosition(V()).add(dirW().multiplyScalar(-4));
  const dirW = () => V(0, 0, 1).applyQuaternion(L.quaternion).normalize();
  function poseLauncher(dt) {
    aimNow.lerp(aimT, 1 - Math.exp(-dt * 7));
    const p = pivot0.clone().add(V(0, -260 * (1 - eOut(vis)), 40 * (1 - vis)));
    // 숨 쉬는 흔들림 · 반동(뒤로 밀리고 위로 들림, 용수철처럼 돌아옴)
    rv += (-120 * recoil - 14 * rv) * dt; recoil += rv * dt;
    const sway = V(Math.sin(t * 1.3) * 1.5, Math.sin(t * 2.1) * 1.2, 0);
    const d = aimNow.clone().add(sway).sub(p).normalize();
    mtx.lookAt(V(), d.clone().negate(), up); q.setFromRotationMatrix(mtx);
    L.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14 * recoil, 0, 0.05 * Math.sin(t * 0.8))));
    L.position.copy(p).addScaledVector(d, -28 * recoil);
    L.updateMatrixWorld(true);
  }
  function show(on) { want = on ? 1 : 0; if (on) start(); }
  function aim(x, y) { aimT.copy(atS(x, y, 0)); }
  function hideNow() { want = 0; vis = 0; }
  function start() { if (active) return; active = true; last = performance.now(); X.use("bz", 0); raf = requestAnimationFrame(frame); }
  function stop() { active = false; cancelAnimationFrame(raf); X.drop("bz"); }

  function fire(x, y, hooks) {
    if (load < 1 || vis < 0.85) return false;
    onHit = hooks; cols = hooks && hooks.colors;
    const m = muzzleW(), d = dirW(), T0 = atS(x, y, 3), L0 = T0.distanceTo(m);
    const r = makeRound(true); r.g.position.copy(m); r.g.quaternion.copy(L.quaternion); scene.add(r.g);
    r.g.add(flame.clone(), flameCore.clone()); const fl = r.g.children[r.g.children.length - 2], fc = r.g.children[r.g.children.length - 1]; fl.position.z = -158; fc.position.z = -160; fc.scale.setScalar(0); fl.visible = false;
    R.push({ r, fl, fc, p0: m.clone(), T: T0, dir: T0.clone().sub(m).normalize(), L: L0, d: 0, v: 360, t: 0, ign: false, spin: rnd(0, 6), last: m.clone(), acc: 0, x, y });
    loaded.g.visible = false; load = 0; recoil = 1; rv = 4;
    // 총구 불꽃 · 회색 연기 고리 · 불티
    muzzleF.position.copy(m).addScaledVector(d, 20); muzzleF.scale.setScalar(220); muzzleF.material.opacity = 1; fireL.position.copy(m); fireL.intensity = 26;
    for (let i = 0; i < 26; i++) { const a = rnd(0, 6.283), rr = rnd(0.2, 1), v = d.clone().multiplyScalar(rnd(60, 260)).add(V(Math.cos(a), Math.sin(a), 0).multiplyScalar(rnd(40, 180) * rr));
      smoke.add({ p: m.clone().addScaledVector(d, rnd(0, 30)), v, drag: 2.2, g: 18, max: rnd(1.4, 2.6), s0: rnd(14, 26), s1: rnd(60, 120), a: rnd(0.35, 0.55), c: dark ? 0xb8b6b2 : 0xd6d3cc, c2: dark ? 0x8a8884 : 0xb4b0a8 }); }
    for (let i = 0; i < 24; i++) spark.add({ p: m.clone(), v: d.clone().multiplyScalar(rnd(300, 900)).add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(260)), g: -900, drag: 1.5, max: rnd(0.15, 0.4), s0: rnd(2.5, 5), s1: 0, a: 1, c: 0xffe2a0, c2: 0xff7a20 });
    // 후폭풍: 어깨 뒤로 뿜어진 불길 · 연기가 화면 오른쪽 아래 가장자리로 번져 들어옴
    const back = L.position.clone().addScaledVector(d, Z0 - 60);
    for (let i = 0; i < 30; i++) { const v = d.clone().multiplyScalar(-rnd(150, 600)).add(V(rnd(-260, 120), rnd(-60, 200), rnd(-40, 80)));
      smoke.add({ p: back.clone().add(V(rnd(-20, 20), rnd(-20, 20), 0)), v, drag: 1.8, g: 30, max: rnd(1.6, 3), s0: rnd(30, 60), s1: rnd(160, 300), a: rnd(0.3, 0.5), c: dark ? 0x9c9a96 : 0xcac6be, c2: dark ? 0x6a6864 : 0xa29e96 }); }
    for (let i = 0; i < 14; i++) fireP.add({ p: back.clone(), v: d.clone().multiplyScalar(-rnd(300, 800)).add(V(rnd(-100, 100), rnd(-60, 120), 0)), drag: 3, max: rnd(0.15, 0.35), s0: rnd(40, 80), s1: rnd(120, 200), a: 0.9, c: 0xfff0c0, c2: 0xff5010, fo: 1.5 });
    hooks && hooks.launch && hooks.launch();
    return true;
  }
  // 날아가기: 처음엔 발사 화약으로 느리게 → 0.1초 뒤 점화해 가속 · 날개 때문에 빙글 돎 · 지나간 자리에 연기
  function rocketStep(dt) {
    for (let i = R.length - 1; i >= 0; i--) { const k = R[i]; k.t += dt;
      if (!k.ign && k.t > 0.1) { k.ign = true; k.fl.visible = true; onHit && onHit.ignite && onHit.ignite();
        for (let j = 0; j < 10; j++) fireP.add({ p: k.r.g.position.clone(), v: k.dir.clone().multiplyScalar(-rnd(100, 400)).add(V(rnd(-80, 80), rnd(-80, 80), rnd(-80, 80))), drag: 3, max: rnd(0.15, 0.3), s0: 20, s1: 60, a: 0.9, c: 0xfff0c0, c2: 0xff6020 }); }
      k.v = k.ign ? Math.min(2400, k.v + 3400 * dt) : k.v * Math.pow(0.5, dt); k.d += k.v * dt;
      const u = Math.min(1, k.d / k.L), wob = Math.sin(k.t * 22) * 2.5 * (1 - u) * Math.min(1, k.t * 5), side = V().crossVectors(k.dir, up).normalize();
      const p = k.p0.clone().addScaledVector(k.dir, Math.min(k.d, k.L)).addScaledVector(side, wob).add(V(0, k.ign ? 0 : -60 * k.t * k.t, 0));
      k.r.g.position.copy(p); mtx.lookAt(V(), k.dir.clone().negate(), up); k.r.g.quaternion.setFromRotationMatrix(mtx).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), (k.spin += dt * (k.ign ? 38 : 10))));
      for (const f of k.r.fins) { const a = f.userData.a, op = Math.min(1, k.t / 0.06); f.position.set(Math.cos(a) * RT * (0.7 + 0.9 * op), Math.sin(a) * RT * (0.7 + 0.9 * op), -140); f.rotation.z = a; f.scale.set(1, op, 1); }
      if (k.ign) { const fl = rnd(0.8, 1.25); k.fl.scale.set(fl, fl, fl * rnd(0.9, 1.5)); k.fc.scale.setScalar(70 * fl); fireL.position.copy(p).addScaledVector(k.dir, -160); fireL.intensity = Math.max(fireL.intensity, 9 * fl); }
      // 꼬리 연기 (지나간 거리만큼 빈틈없이)
      const tail = p.clone().addScaledVector(k.dir, -165), seg = tail.distanceTo(k.last), stp = 7; k.acc += seg;
      while (k.acc >= stp) { k.acc -= stp; const f = seg > 0 ? 1 - k.acc / seg : 1, sp = k.last.clone().lerp(tail, f);
        if (k.ign) { smoke.add({ p: sp, v: k.dir.clone().multiplyScalar(-rnd(20, 60)).add(V(rnd(-18, 18), rnd(-10, 22), rnd(-18, 18))), drag: 1.2, g: 14, max: rnd(2.2, 3.6), s0: rnd(10, 16), s1: rnd(70, 120), a: rnd(0.6, 0.78), c: 0xffe8c8, c2: dark ? 0xa8a6a2 : 0xbcb8b0, cs: 6, fi: 0.04 });
          if (Math.random() < 0.6) fireP.add({ p: sp.clone(), v: k.dir.clone().multiplyScalar(-rnd(50, 200)), drag: 4, max: rnd(0.08, 0.18), s0: rnd(10, 18), s1: rnd(20, 30), a: 0.8, c: 0xffe8b0, c2: 0xff5a10 }); }
        else if (Math.random() < 0.5) smoke.add({ p: sp, v: V(rnd(-10, 10), rnd(-5, 10), rnd(-10, 10)), drag: 2, max: 1, s0: 6, s1: 24, a: 0.25, c: 0xdedad2 }); }
      k.last.copy(tail);
      if (k.ign && Math.random() < 0.6) spark.add({ p: tail.clone(), v: k.dir.clone().multiplyScalar(-rnd(100, 300)).add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(120)), g: -600, drag: 2, max: rnd(0.1, 0.25), s0: 2.5, s1: 0, a: 1, c: 0xffe0a0, c2: 0xff6010 });
      onHit && onHit.loop && onHit.loop(k.ign ? 0.13 * (1 - u * 0.6) : 0.03);
      if (k.d >= k.L) { R.splice(i, 1); scene.remove(k.r.g); explode(k); } }
    if (!R.length && onHit && onHit.loop) onHit.loop(0);
  }
  // 맞음: 불덩이가 부풀며 검은 연기로 → 피어오르는 연기 기둥 · 충격파 고리 · 불티 · 눈앞으로 튀는 조각
  function explode(k) {
    const P = k.T, toCam = V(0, 0, 1);
    boomF.position.copy(P).setZ(8); boomF.scale.setScalar(520); boomF.material.opacity = 1; boomL.position.copy(P).setZ(160); boomL.intensity = 40;
    shock.position.copy(P).setZ(2); shock.userData.r = 30; shock.scale.setScalar(30); shock.material.opacity = 0.9; shock.material.color.set(dark ? 0xfff0e0 : 0xffffff);
    for (let i = 0; i < 46; i++) { const a = rnd(0, 6.283), r = rnd(0, 1), v = V(Math.cos(a) * r, Math.sin(a) * r, rnd(0.2, 1)).multiplyScalar(rnd(160, 520));
      fireP.add({ p: P.clone().add(V(rnd(-8, 8), rnd(-8, 8), rnd(5, 20))), v, drag: 5.5, max: rnd(0.35, 0.8), s0: rnd(30, 60), s1: rnd(110, 190), a: 0.95, c: 0xfff4d0, c2: 0xc8360a, cs: 1.4, fo: 1.4 }); }
    for (let i = 0; i < 40; i++) { const a = rnd(0, 6.283), r = rnd(0.2, 1), v = V(Math.cos(a) * r * 220, Math.sin(a) * r * 160 + rnd(20, 120), rnd(40, 220));
      smoke.add({ p: P.clone().add(V(rnd(-20, 20), rnd(-20, 20), rnd(10, 40))), v, drag: 2.4, g: 46, max: rnd(2.4, 4.2), s0: rnd(30, 60), s1: rnd(150, 280), a: rnd(0.5, 0.78), c: 0x8a5a3a, c2: dark ? 0x1e1c1a : 0x3a3633, cs: 3, fi: 0.12 }); }
    for (let i = 0; i < 70; i++) spark.add({ p: P.clone().add(V(0, 0, 10)), v: V(rnd(-1, 1), rnd(-0.6, 1), rnd(0.2, 1)).normalize().multiplyScalar(rnd(400, 1400)), g: -1500, drag: 1.2, max: rnd(0.3, 0.9), s0: rnd(2.5, 5), s1: 0, a: 1, c: 0xfff0c0, c2: 0xff5a10 });
    const pal = cols && cols.length ? cols : ["#ffffff", "#f1eee8", "#dedad2"]; chips.visible = true;
    CH.forEach((c, i) => { c.p.copy(P).add(V(rnd(-30, 30), rnd(-30, 30), rnd(5, 20))); c.v.set(rnd(-1, 1) * 500, rnd(-0.4, 1) * 500 + 150, rnd(300, 1300)); c.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); c.w.set(rnd(-16, 16), rnd(-16, 16), rnd(-16, 16));
      const s = rnd(4, 13) * (Math.random() < 0.15 ? 2 : 1); c.s.set(s, s * rnd(0.5, 1.2), 1); chips.setColorAt(i, chipC.set(pal[(Math.random() * pal.length) | 0])); });
    chips.instanceColor.needsUpdate = true;
    onHit && onHit.hit && onHit.hit(k.x, k.y);
  }
  function chipStep(dt) { if (!chips.visible) return; let any = false;
    for (let i = 0; i < NCH; i++) { const c = CH[i]; if (c.s.x <= 0) { chips.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; } any = true;
      c.v.y -= 1500 * dt; c.v.multiplyScalar(Math.exp(-0.5 * dt)); c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt); if (c.p.z > D - 20 || c.p.y < -vh) c.s.set(0, 0, 0);
      chips.setMatrixAt(i, m4.compose(c.p, q4.setFromEuler(e4.set(c.r.x, c.r.y, c.r.z)), c.s)); }
    chips.instanceMatrix.needsUpdate = true; if (!any) chips.visible = false; }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    vis += (want - vis) * Math.min(1, dt * (want ? 6 : 9)); if (Math.abs(vis - want) < 0.002) vis = want;
    // 다시 끼우기: 0.45초 쉬고 → 앞에서 밀려 들어옴 → 철컥
    if (load < 1) { const was = load; load = Math.min(1, load + dt / 1.2); if (load > 0.45) { loaded.g.visible = true; const u = sstep((load - 0.45) / 0.55); loaded.g.position.z = Z0 + LEN + (1 - u) * 90; } if (was < 1 && load >= 1) { loaded.g.position.z = Z0 + LEN; onHit && onHit.load && onHit.load(); } }
    poseLauncher(dt); L.visible = vis > 0.01;
    rocketStep(dt); smoke.step(dt); fireP.step(dt); spark.step(dt); chipStep(dt);
    muzzleF.material.opacity = Math.max(0, muzzleF.material.opacity - dt * 9); boomF.material.opacity = Math.max(0, boomF.material.opacity - dt * 2.4);
    fireL.intensity *= Math.exp(-dt * 10); boomL.intensity *= Math.exp(-dt * 3);
    if (shock.material.opacity > 0) { shock.userData.r += dt * 1500; shock.scale.setScalar(shock.userData.r); shock.material.opacity = Math.max(0, shock.material.opacity - dt * 1.8); }
    if (X.mine("bz")) renderer.render(scene, cam);
    const busy = want > 0 || vis > 0.01 || R.length || smoke.P.length || fireP.P.length || spark.P.length || chips.visible;
    if (!busy) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }
  // 셰이더 미리 만들기
  L.position.copy(pivot0); renderer.compile(scene, cam);
  return { X, show, aim, fire, hideNow, get busy() { return R.length > 0; } };
}
