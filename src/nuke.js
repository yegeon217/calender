// 핵 (3D): 달력이 두께 있는 벽돌판이 되어 바닥에 눕고, 1인칭 시점이 뒤로 물러나 비스듬히 내려다봄 →
// 오른쪽에서 인민복 차림의 지도자 캐리커처가 걸어 나와 빨간 버튼 앞에 섬 → 카메라를 보며 씩 웃고, 누르는 척 두 번(손가락이 버튼 바로 위에서 멈췄다 물러남) → 꾹!
// 경보 → 먼 하늘에서 미사일이 연기 꼬리를 끌며 슈웅 내려와 달력 한가운데 쾅 →
// 번쩍(화면이 하얘짐) · 불덩이가 부풀어 오르고 · 땅을 따라 충격파와 흙먼지 고리 · 벽돌이 사방으로 날아감 · 공기 중 수증기 고리 →
// 불덩이가 식으며 버섯구름(말려 올라가는 갓 + 기둥 + 밑동 먼지)이 솟음 · 충격파에 카메라도 뒤로 밀려 흔들리고, 그 사람은 뒤로 나자빠짐 → 어두워지며 끝 (달력은 새로)
// 좌표: 화면 픽셀 = 월드 단위로 시작 (z=0이 화면, 카메라는 z=D) · 바닥은 y = -vh/2
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { loadHand, preloadHand } from "./hand.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, V, buzz, vnoise, noiseTex, radialTex } from "./fx-util.js";

export function prewarmNuke() { preloadHand(); }

const T = { tilt0: 0.1, tilt1: 1.8, walk0: 1.2, walk1: 3.0, look: 3.1, f1: 3.45, f2: 4.05, press: 4.75, launch: 4.95, imp: 6.55, end: 12.4 };

// 연기 뭉치 · 불 · 빛
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const puffTex = () => canvasTex(128, 128, (x, w, h) => { const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w - 0.5, v = j / h - 0.5, r = Math.hypot(u, v) * 2, n = vnoise(i * 0.05, j * 0.05) * 0.55 + vnoise(i * 0.13 + 7, j * 0.13) * 0.3 + vnoise(i * 0.3, j * 0.3 + 3) * 0.15;
    const a = clamp((1 - r) * 1.7 - (1 - n) * 0.95, 0, 1), k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * a * 255; } x.putImageData(im, 0, 0); }, false);
const glowTex = () => canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,240,200,.75)"); g.addColorStop(0.6, "rgba(255,150,60,.2)"); g.addColorStop(1, "rgba(255,90,20,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); });
const PT_VS = `attribute float aS, aR; attribute vec4 aC; attribute float aG; uniform float uScale; varying vec4 vC; varying float vR, vG;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(aS * uScale / -mv.z, 1000.0); vC = aC; vR = aR; vG = aG; }`;
// 연기: 위는 밝고 아래는 그늘 · aG만큼 아래쪽이 불빛으로 달아오름
const PT_FS = `uniform sampler2D map; uniform float uShade; uniform vec3 uGlow; varying vec4 vC; varying float vR, vG;
void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 t = texture2D(map, q); float y = gl_PointCoord.y; float sh = mix(1.0, mix(1.15, 0.55, y), uShade); float a = t.a * vC.a; if (a < 0.004) discard;
  vec3 col = vC.rgb * sh + uGlow * vG * smoothstep(0.25, 1.0, y) * 1.4;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;
// 불덩이: 잡음으로 울퉁불퉁 끓는 공 · 뜨거울수록 흰 노랑 → 주황 → 검붉게 식음
const FB_VS = `uniform float uT; varying vec3 vN; varying float vH;
float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){ vec3 p = position; float n = n3(p * 2.2 + uT * 1.7) * 0.6 + n3(p * 5.0 - uT * 2.3) * 0.4; vH = n; vN = normal; p *= 1.0 + (n - 0.5) * 0.32;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const FB_FS = `uniform float uHeat, uA; varying vec3 vN; varying float vH;
void main(){ float k = clamp(uHeat * (0.55 + vH * 0.8), 0.0, 1.0);
  vec3 c = mix(vec3(0.25, 0.06, 0.02), vec3(1.0, 0.42, 0.08), smoothstep(0.0, 0.45, k)); c = mix(c, vec3(1.0, 0.86, 0.55), smoothstep(0.45, 0.8, k)); c = mix(c, vec3(1.0, 1.0, 0.95), smoothstep(0.8, 1.0, k));
  gl_FragColor = vec4(c * (1.0 + uHeat * 2.0), uA);
  #include <colorspace_fragment>
}`;

// ── 지도자 캐리커처 (단위: 미터, 발바닥 가운데가 원점, +z가 앞) ──
function makeLeader(hands, dark) {
  const root = new THREE.Group(), fabric = noiseTex(128, 6, 26, 0.6);
  const mSuit = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.86, bumpMap: fabric, bumpScale: 0.35 });
  const mSkin = new THREE.MeshPhysicalMaterial({ color: 0xe2ac86, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff9a7a), bumpMap: noiseTex(128, 4, 20, 0.9), bumpScale: 0.15 });
  const hairT = canvasTex(256, 256, (x, w, h) => { x.fillStyle = "#0e0e10"; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const px = Math.random() * w; x.strokeStyle = `rgba(${40 + Math.random() * 40},${40 + Math.random() * 40},${46 + Math.random() * 40},.5)`; x.lineWidth = rnd(0.6, 1.4); x.beginPath(); x.moveTo(px, rnd(0, h)); x.lineTo(px + rnd(-3, 3), rnd(0, h)); x.stroke(); } });
  const mHair = new THREE.MeshStandardMaterial({ map: hairT, bumpMap: hairT, bumpScale: 1.2, roughness: 0.45, metalness: 0.05 });
  const mStub = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.95, transparent: true, opacity: 0.72, bumpMap: noiseTex(64, 8, 60, 2), bumpScale: 0.5 });
  const mShoe = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.25, metalness: 0.1 }), mBtn = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.35, metalness: 0.4 });
  const mWhite = new THREE.MeshStandardMaterial({ color: 0xf2eee8, roughness: 0.3 }), mIris = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.15 }), mBrow = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.8 }), mLip = new THREE.MeshStandardMaterial({ color: 0xb2675c, roughness: 0.5 });
  const mesh = (g, m, p, s, parent) => { const o = new THREE.Mesh(g, m); if (p) o.position.set(...p); if (s) o.scale.set(...s); o.castShadow = true; (parent || root).add(o); return o; };
  const sph = (r, ws = 28, hs = 20) => new THREE.SphereGeometry(r, ws, hs), cyl = (r0, r1, h, s = 24) => new THREE.CylinderGeometry(r1, r0, h, s);
  // 다리 · 구두
  const legs = {};
  for (const sd of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(sd * 0.11, 0.95, 0); root.add(hip);
    const th = mesh(cyl(0.095, 0.082, 0.45), mSuit, [0, -0.225, 0], null, hip), knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    mesh(cyl(0.075, 0.064, 0.42), mSuit, [0, -0.21, 0], null, knee); const ank = new THREE.Group(); ank.position.y = -0.42; knee.add(ank);
    mesh(new THREE.BoxGeometry(0.11, 0.075, 0.27).translate(0, 0, 0.05), mShoe, [0, -0.045, 0], null, ank); mesh(sph(0.056, 16, 10), mShoe, [0, -0.04, 0.17], [1, 0.62, 1], ank);
    legs[sd] = { hip, knee, ank }; }
  // 몸통 (배가 나온 인민복) · 단추 · 주머니 · 깃
  const body = new THREE.Group(); body.position.y = 0.95; root.add(body);
  const prof = [[0.17, -0.05], [0.205, 0.05], [0.225, 0.15], [0.225, 0.27], [0.212, 0.38], [0.2, 0.47], [0.165, 0.53], [0.09, 0.565], [0.07, 0.58]].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(new THREE.LatheGeometry(prof, 40), mSuit, [0, 0, 0], [1, 1, 0.82], body);
  mesh(sph(0.19, 28, 18), mSuit, [0, 0.17, 0.05], [1.08, 1.05, 0.9], body);   // 배
  mesh(cyl(0.078, 0.074, 0.055), mSuit, [0, 0.6, 0], [1, 1, 0.92], body);   // 선 깃
  for (let i = 0; i < 5; i++) { const y = 0.5 - i * 0.1, z = (i < 2 ? 0.168 : 0.2) * 0.86 + 0.012 + (i >= 1 && i <= 3 ? 0.03 : 0); mesh(sph(0.011, 10, 8), mBtn, [0, y, z], null, body); }
  for (const [x, y, w, h] of [[0.1, 0.4, 0.09, 0.07], [-0.1, 0.4, 0.09, 0.07], [0.12, 0.13, 0.1, 0.09], [-0.12, 0.13, 0.1, 0.09]]) { const pk = mesh(new THREE.BoxGeometry(w, h, 0.01), mSuit, [x, y, (y > 0.3 ? 0.17 : 0.215) * 0.86 + 0.03], null, body); pk.rotation.x = y > 0.3 ? -0.25 : 0.12; }
  // 팔 (어깨 → 팔꿈치 → 손목), 손은 진짜 손 모델
  const arms = {};
  for (const sd of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(sd * 0.215, 0.5, 0); body.add(sh);
    mesh(sph(0.07, 18, 12), mSuit, [0, 0, 0], null, sh); mesh(cyl(0.066, 0.056, 0.29), mSuit, [0, -0.145, 0], null, sh); const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    mesh(cyl(0.054, 0.046, 0.27), mSuit, [0, -0.135, 0], null, el); const wr = new THREE.Group(); wr.position.y = -0.27; el.add(wr); mesh(cyl(0.05, 0.05, 0.03), mSuit, [0, 0.005, 0], null, wr);
    arms[sd] = { sh, el, wr }; }
  // 손: 손가락이 아래(-y) · 손바닥이 몸 쪽 · 오른손 검지는 펴서 누를 수 있게
  hands.forEach((H, i) => { const sd = i ? 1 : -1, g = new THREE.Group(), o = new THREE.Group(); const k = 0.19 / 0.19;
    o.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); o.add(H.scene); o.scale.setScalar(k); g.add(o);
    const rp = n => V().setFromMatrixPosition(H.restM[n]); H.scene.position.copy(rp("wrist")).negate();
    g.rotation.set(Math.PI, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0); if (sd < 0) g.scale.x = -1;
    arms[sd].wr.add(g); arms[sd].H = H; H.mesh.material = mSkin; H.mesh.castShadow = true; });
  // 목 · 머리
  const neck = new THREE.Group(); neck.position.y = 0.6; body.add(neck); mesh(cyl(0.068, 0.064, 0.08), mSkin, [0, 0.03, 0], null, neck);
  const head = new THREE.Group(); head.position.y = 0.14; neck.add(head);
  mesh(sph(0.116, 36, 28), mSkin, [0, 0.02, 0], [1.04, 1.08, 1.0], head);
  mesh(sph(0.106, 32, 22), mSkin, [0, -0.04, 0.018], [1.1, 0.86, 1.0], head);   // 통통한 턱
  mesh(sph(0.072, 24, 14), mSkin, [0, -0.095, 0.04], [1.25, 0.6, 1.0], head);   // 이중턱
  for (const sd of [-1, 1]) { mesh(sph(0.052, 20, 14), mSkin, [sd * 0.072, -0.03, 0.068], [1, 0.95, 0.8], head); mesh(sph(0.04, 16, 12), mSkin, [sd * 0.12, 0.0, -0.01], [0.38, 0.62, 0.5], head); }
  mesh(sph(0.024, 16, 12), mSkin, [0, -0.012, 0.118], [1.05, 0.85, 0.9], head); mesh(cyl(0.012, 0.016, 0.05, 12), mSkin, [0, 0.012, 0.112], null, head).rotation.x = 0.35;
  // 눈 (가늘게 · 눈꺼풀로 찡그림) · 눈썹
  const eyes = [];
  for (const sd of [-1, 1]) { const e = new THREE.Group(); e.position.set(sd * 0.043, 0.012, 0.098); head.add(e);
    mesh(sph(0.0145, 16, 12), mWhite, [0, 0, 0], [1.35, 0.62, 0.55], e); mesh(sph(0.0085, 14, 10), mIris, [0, 0, 0.006], [1, 0.9, 0.6], e);
    const lid = new THREE.Group(); e.add(lid); mesh(new THREE.SphereGeometry(0.017, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mSkin, [0, 0, 0], [1.3, 0.9, 0.75], lid);
    const low = mesh(new THREE.SphereGeometry(0.0165, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mSkin, [0, -0.002, 0], [1.3, 0.5, 0.72], e);
    const br = mesh(new THREE.BoxGeometry(0.048, 0.009, 0.012), mBrow, [sd * 0.002, 0.028, 0.008], null, e);
    eyes.push({ e, lid, low, br, sd }); }
  // 입: 웃는 정도에 따라 입꼬리가 올라감 (다시 만듦)
  const mouth = mesh(new THREE.BufferGeometry(), mLip, [0, -0.052, 0.112], null, head); let smileNow = -1;
  function setSmile(s) { if (Math.abs(s - smileNow) < 0.02) return; smileNow = s; const w = 0.036 + 0.01 * s, pts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12 * 2 - 1; pts.push(V(u * w, (u * u) * (0.004 + 0.016 * s) - 0.002 * s, -Math.abs(u) * 0.012)); }
    mouth.geometry.dispose(); mouth.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0042 + 0.0015 * s, 8, false); }
  setSmile(0.2);
  // 머리: 옆·뒤는 짧게 밀어 거뭇하고, 윗머리는 숱 많게 높이 넘김 (앞이 살짝 솟음)
  const capG = new THREE.SphereGeometry(0.124, 44, 22, 0, Math.PI * 2, 0, 1.02), P = capG.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); y = Math.min(y * 0.95 + 0.012, 0.13); if (z > 0) { y += 0.022 * (z / 0.124) ** 2; z *= 1.04; } if (y < 0.05) y -= (0.05 - y) * 0.1; P.setXYZ(i, x * 1.03, y, z); }
  capG.computeVertexNormals(); mesh(capG, mHair, [0, 0.03, -0.006], [1.04, 1, 1.0], head);
  mesh(new THREE.SphereGeometry(0.1215, 36, 16, Math.PI * 0.18, Math.PI * 1.64, 0.95, 0.75), mStub, [0, 0.02, 0], [1.04, 1.08, 1.0], head);   // 밀어낸 옆·뒷머리
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { root, body, legs, arms, neck, head, eyes, setSmile,
    face(s, squint, brow) { setSmile(s); for (const E of eyes) { E.lid.rotation.x = lerp(-0.2, 0.55, squint); E.low.position.y = -0.002 + 0.004 * squint; E.br.position.y = 0.028 + 0.006 * brow; E.br.rotation.z = E.sd * (-0.12 + 0.25 * brow); } } };
}

export async function startNuke(o) {
  const X = fx3d(), { renderer, PR, vw, vh, D } = X, dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const scene = new THREE.Scene(); scene.environment = X.env; scene.environmentIntensity = 0.5;
  const cam = new THREE.PerspectiveCamera(X.FOV, vw / vh, 5, D * 12); cam.position.set(0, 0, D);
  const Y0 = -vh / 2;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6a6458, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2); sun.position.set(-vw * 1.2, vh * 2.2, vh * 1.4); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -vh * 1.6, right: vh * 1.6, top: vh * 1.6, bottom: -vh * 1.6, near: 10, far: vh * 8 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.8;
  sun.target.position.set(0, Y0, -vh * 0.4); scene.add(sun, sun.target);
  const boomL = new THREE.PointLight(0xffa050, 0, vh * 8, 0.6); scene.add(boomL);

  // ── 하늘 · 땅 (처음엔 투명 → 서서히) ──
  const skyU = { uA: { value: 0 }, uTop: { value: new THREE.Color(dark ? 0x0c1224 : 0x5b7fae) }, uHor: { value: new THREE.Color(dark ? 0x3a3448 : 0xd9d2c4) }, uBoom: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(D * 10, 40, 20), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uA, uBoom; uniform vec3 uTop, uHor; varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = mix(uHor, uTop, pow(clamp(d.y, 0.0, 1.0), 0.6)); c = mix(c, uHor * 0.7, smoothstep(0.0, -0.1, d.y));
      c = mix(c, vec3(1.0, 0.55, 0.25), uBoom * (1.0 - smoothstep(0.0, 0.5, abs(d.y))) * 0.6); gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      gl_FragColor *= uA; }` }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const gTex = canvasTex(512, 512, (x, w, h) => { const im = x.createImageData(w, h), d = im.data; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = vnoise(i * 0.03, j * 0.03) * 0.6 + vnoise(i * 0.12, j * 0.12) * 0.3 + Math.random() * 0.1, k = (j * w + i) * 4;
    d[k] = 104 + n * 50; d[k + 1] = 96 + n * 44; d[k + 2] = 82 + n * 36; d[k + 3] = 255; } x.putImageData(im, 0, 0); });
  gTex.repeat.set(30, 30);
  const gMat = new THREE.MeshStandardMaterial({ map: gTex, bumpMap: gTex, bumpScale: 2, roughness: 0.95, transparent: true, opacity: 0, depthWrite: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(vh * 40, vh * 40), gMat); ground.rotation.x = -Math.PI / 2; ground.position.y = Y0 - 1; ground.receiveShadow = true; ground.renderOrder = -5; scene.add(ground);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: radialTex([[0, "rgba(10,8,6,.95)"], [0.55, "rgba(30,22,14,.75)"], [1, "rgba(40,30,20,0)"]]), transparent: true, opacity: 0, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.y = Y0 + 0.5; scorch.renderOrder = -4; scene.add(scorch);

  // ── 달력 → 벽돌판 (칸마다 두께 있는 상자, 앞면은 칸 그림) · 아래 모서리를 축으로 뒤로 눕힘 ──
  const board = new THREE.Group(); board.position.set(0, Y0, 0); scene.add(board);
  const bricks = [], texs = [];
  let dzMax = 0;
  for (const p of o.pieces) {
    const dz = clamp(Math.min(p.W, p.H) * 0.14, 5, 11); dzMax = Math.max(dzMax, dz);
    const tex = new THREE.CanvasTexture(p.tex); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texs.push(tex);
    const side = new THREE.Color(p.colors && p.colors[0] ? p.colors[0] : "#e8e4dc"); side.multiplyScalar(0.72);
    const ms = new THREE.MeshStandardMaterial({ color: side, roughness: 0.9 }), mf = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, alphaTest: 0.4, transparent: p.alpha < 1, opacity: p.alpha });
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.W, p.H, dz), [ms, ms, ms, ms, mf, ms]); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    m.position.set(p.cx - vw / 2, vh - p.cy, -dz / 2); m.rotation.z = -p.th; board.add(m);
    bricks.push({ m, dz, v: V(), w: V(), live: true, vap: false });
  }
  // ── 그 사람 · 빨간 버튼 ──
  const [HR, HL] = await Promise.all([loadHand(new THREE.MeshStandardMaterial()), loadHand(new THREE.MeshStandardMaterial())]);
  const KH = vh * 0.4, HU = KH / 1.7, kim = makeLeader([HR, HL], dark); kim.root.scale.setScalar(HU); scene.add(kim.root);
  const kimSpot = V(vw * 0.3, Y0, vh * 0.16), kimFrom = V(vw * 1.15, Y0, vh * 0.26), kimYaw = -0.75;
  const btn = new THREE.Group(); scene.add(btn);
  { const mB = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.5, metalness: 0.5 }), mY = new THREE.MeshStandardMaterial({ map: canvasTex(256, 32, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? "#111" : "#f2c400"; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, h); x.lineTo(i * 16 - 8, h); x.fill(); } }), roughness: 0.5 });
    const mR = new THREE.MeshPhysicalMaterial({ color: 0xd80f10, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x500000, emissiveIntensity: 0.4 });
    const add = (g, m, y) => { const x = new THREE.Mesh(g, m); x.position.y = y; x.castShadow = x.receiveShadow = true; btn.add(x); return x; };
    add(new THREE.CylinderGeometry(0.09, 0.12, 0.95, 28), mB, 0.475); add(new THREE.CylinderGeometry(0.17, 0.15, 0.06, 36), mB, 0.98);
    add(new THREE.CylinderGeometry(0.135, 0.135, 0.022, 36), mY, 1.02); btn.userData.cap = add(new THREE.SphereGeometry(0.075, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mR, 1.03); btn.userData.mR = mR;
    btn.userData.lamp = add(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 0 }), 1.02); btn.userData.lamp.position.set(0.12, 1.02, 0.04);
    btn.scale.setScalar(HU); btn.position.copy(kimSpot).add(V(-Math.sin(-kimYaw) * 0.42 * HU, 0, Math.cos(-kimYaw) * 0.42 * HU)); btn.rotation.y = kimYaw; }
  btn.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  // ── 미사일 ──
  const mis = new THREE.Group(); scene.add(mis); mis.visible = false;
  { const mW = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.45, metalness: 0.2 }), mK = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.5 }), mG = new THREE.MeshStandardMaterial({ color: 0x5d6448, roughness: 0.7 });
    const L = 1, add = (g, m, z) => { const x = new THREE.Mesh(g.rotateX(Math.PI / 2), m); x.position.z = z; mis.add(x); return x; };
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 24), mW, 0); add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 24), mG, -0.36); add(new THREE.ConeGeometry(0.05, 0.22, 24), mK, 0.42);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.09, 0.12), mK); f.position.set(Math.cos(i * Math.PI / 2) * 0.07, Math.sin(i * Math.PI / 2) * 0.07, -0.4); f.rotation.z = i * Math.PI / 2; mis.add(f); }
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0505, 0.0505, 0.05, 24, 1, true, i * Math.PI / 2, Math.PI / 4).rotateX(Math.PI / 2), mK); b.position.z = 0.18; mis.add(b); } }
  const misFlame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(misFlame); misFlame.visible = false;
  const MS = vh * 0.32; mis.scale.setScalar(MS);

  // ── 입자: 연기(그늘·불빛) · 불 ──
  const puff = puffTex(), glw = glowTex();
  function makePts(N, tex, add, shade) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), sz = new Float32Array(N), rt = new Float32Array(N), col = new Float32Array(N * 4), gl = new Float32Array(N);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aS", new THREE.BufferAttribute(sz, 1)); geo.setAttribute("aR", new THREE.BufferAttribute(rt, 1)); geo.setAttribute("aC", new THREE.BufferAttribute(col, 4)); geo.setAttribute("aG", new THREE.BufferAttribute(gl, 1));
    const U = { uScale: { value: vh / 2 / Math.tan(17.5 * Math.PI / 180) * PR }, map: { value: tex }, uShade: { value: shade ? 1 : 0 }, uGlow: { value: new THREE.Color(1, 0.45, 0.12) } };
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.frustumCulled = false; m.renderOrder = add ? 6 : 5; scene.add(m);
    return { P: [], U, N, sync() { const c = new THREE.Color(); for (let i = 0; i < N; i++) { const q = this.P[i]; if (!q) { col[i * 4 + 3] = 0; continue; }
        pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; sz[i] = q.s; rt[i] = q.rot; c.set(q.c); col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = q.a; gl[i] = q.gl || 0; }
      geo.attributes.position.needsUpdate = geo.attributes.aS.needsUpdate = geo.attributes.aR.needsUpdate = geo.attributes.aC.needsUpdate = geo.attributes.aG.needsUpdate = true; } };
  }
  const cloud = makePts(1700, puff, false, true), fire = makePts(500, puff, true, false), trail = makePts(500, puff, false, true);
  // 불덩이 · 수증기 고리 · 땅 충격파
  const fbU = { uT: { value: 0 }, uHeat: { value: 1 }, uA: { value: 1 } };
  const fball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.ShaderMaterial({ uniforms: fbU, vertexShader: FB_VS, fragmentShader: FB_FS, transparent: true, depthWrite: false })); fball.visible = false; fball.renderOrder = 7; scene.add(fball);
  const wilson = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 1, depthWrite: false, side: THREE.DoubleSide })); wilson.visible = false; wilson.renderOrder = 8; scene.add(wilson);
  const shockR = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 128), new THREE.MeshBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); shockR.rotation.x = -Math.PI / 2; shockR.position.y = Y0 + 2; scene.add(shockR);
  // 번쩍 (화면 전체)
  const flash = document.createElement("div"); flash.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;background:#fffaf0;opacity:0"; document.body.append(flash);
  const fade = document.createElement("div"); fade.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;background:#000;opacity:0"; document.body.append(fade);

  // ── 카메라: 처음엔 원래 화면 그대로 → 뒤로 물러나며 비스듬히 위에서 (그 사람이 오른쪽 앞에 보이게) ──
  const E = V(0, Y0 + dzMax, -vh * 0.5);   // 달력판 가운데 (누운 뒤)
  const camEnd = V(vw * 0.42, Y0 + vh * 0.62, vh * 0.95), lookEnd = V(vw * 0.02, Y0 + vh * 0.12, -vh * 0.32);
  const camP = V(), lookP = V(), blow = V(), blowV = V();
  let shake = 0;
  const snd = makeSound(o.sfx);

  renderer.compile(scene, cam);
  X.use("nuke", 3); document.documentElement.classList.add("nuke-on");
  let t = 0, last = performance.now(), raf = 0, doneF = false;
  const once = new Set(), at = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } };
  // 미사일 길: 먼 하늘(달력판 너머 왼쪽 위)에서 내리꽂힘
  const M0 = V(-vw * 1.6, Y0 + vh * 4.2, -vh * 7), M1 = E.clone();
  const misAt = (u, out = V()) => out.copy(M0).lerp(M1, u).add(V(0, Math.sin(Math.PI * u) * vh * 0.6, 0));
  let misLast = M0.clone(), impT = Infinity;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    // ── 3D로: 달력판이 뒤로 눕고 · 하늘·땅이 나타나고 · 카메라가 물러남 ──
    const u = eInOut(seg(t, T.tilt0, T.tilt1));
    board.rotation.x = -Math.PI / 2 * u; board.position.y = Y0 + dzMax * u;
    skyU.uA.value = sstep(seg(t, 0.3, 1.6)); gMat.opacity = sstep(seg(t, 0.4, 1.6));
    camP.lerpVectors(V(0, 0, D), camEnd, u); lookP.lerpVectors(V(0, 0, 0), lookEnd, u);
    // 충격파에 밀려남 (용수철처럼 돌아오다 멈춤) · 흔들림
    blowV.addScaledVector(blow, -9 * dt).multiplyScalar(Math.exp(-3.2 * dt)); blow.addScaledVector(blowV, dt);
    shake *= Math.exp(-dt * 3);
    const sh = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake);
    cam.position.copy(camP).add(blow).add(sh);
    // 폭발 뒤엔 솟는 구름을 따라 고개를 듦
    const up = impT < Infinity ? eInOut(seg(t, impT + 0.6, impT + 3.5)) : 0;
    cam.lookAt(lookP.clone().add(V(0, vh * 0.75 * up, 0)).add(sh.multiplyScalar(0.5)));
    const fov = lerp(X.FOV, 48, u) + 6 * up; if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    sky.position.copy(cam.position);
    // ── 그 사람: 걸어 나옴 → 카메라 보며 씩 → 누르는 척 두 번 → 꾹 ──
    leader(t, dt);
    if (t >= T.press) at("press", () => { snd.click(); snd.alarm(); buzz(2); btn.userData.lamp.material.emissiveIntensity = 3; });
    if (t >= T.launch) at("launch", () => { mis.visible = misFlame.visible = true; snd.whistle(T.imp - T.launch); });
    btn.userData.cap.position.y = 1.03 - (t > T.press && t < T.press + 0.35 ? 0.025 : 0);
    if (t > T.press) btn.userData.lamp.material.emissiveIntensity = Math.sin(t * 18) > 0 ? 3 : 0.2;
    // ── 미사일 ──
    if (mis.visible) { const mu = eIn(seg(t, T.launch, T.imp)) * 0.7 + seg(t, T.launch, T.imp) * 0.3, p = misAt(mu), q = misAt(Math.min(1, mu + 0.01));
      mis.position.copy(p); mis.lookAt(q); misFlame.position.copy(p).addScaledVector(q.clone().sub(p).normalize(), -MS * 0.5); misFlame.scale.setScalar(MS * rnd(0.35, 0.5));
      for (let i = 0; i < 3; i++) { const s = misLast.clone().lerp(p, i / 3); trail.P.push({ p: s.add(V(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4))), v: V(rnd(-10, 10), rnd(5, 25), rnd(-10, 10)), s: MS * 0.08, s1: MS * rnd(0.35, 0.6), life: 0, max: rnd(2.5, 4), a: 0.7, a0: 0.7, c: dark ? 0xb0aca6 : 0xe2ded6, rot: rnd(0, 6), w: rnd(-0.5, 0.5) }); }
      misLast.copy(p);
      if (t >= T.imp) { mis.visible = misFlame.visible = false; impT = t; boom(); } }
    trail.P = trail.P.filter(q => (q.life += dt) < q.max); for (const q of trail.P) { q.p.addScaledVector(q.v, dt); q.s = lerp(q.s, q.s1, Math.min(1, dt * 0.8)); q.a = q.a0 * (1 - q.life / q.max); q.rot += q.w * dt; }
    if (trail.P.length > trail.N) trail.P.splice(0, trail.P.length - trail.N);
    // ── 폭발 뒤 ──
    if (impT < Infinity) after(t - impT, dt);
    cloud.sync(); fire.sync(); trail.sync();
    if (X.mine("nuke")) renderer.render(scene, cam);
    if (t >= T.end) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  // 그 사람 움직임
  function leader(t, dt) {
    const K = kim, wu = seg(t, T.walk0, T.walk1), wE = eInOut(wu), walking = wu > 0 && wu < 1;
    const pos = kimFrom.clone().lerp(kimSpot, wE); K.root.position.copy(pos);
    K.root.rotation.y = walking ? Math.atan2(kimSpot.x - kimFrom.x, kimSpot.z - kimFrom.z) * (1 - sstep(seg(wu, 0.75, 1))) + kimYaw * sstep(seg(wu, 0.75, 1)) : kimYaw;
    const ph = t * 7.5, amp = walking ? Math.sin(Math.PI * wu) * 0.9 + 0.1 : 0;
    for (const sd of [-1, 1]) { const L = K.legs[sd], s = Math.sin(ph + (sd > 0 ? 0 : Math.PI)); L.hip.rotation.x = -0.42 * s * amp; L.knee.rotation.x = Math.max(0, Math.cos(ph + (sd > 0 ? 0 : Math.PI))) * 0.7 * amp; L.ank.rotation.x = 0.2 * s * amp; }
    K.body.position.y = 0.95 + Math.abs(Math.cos(ph)) * 0.025 * amp; K.body.rotation.z = Math.sin(ph) * 0.03 * amp;
    // 팔: 걸을 땐 흔듦 · 서면 왼손은 뒷짐 · 오른손은 버튼 위로
    const tL = K.arms[1], tR = K.arms[-1];   // 화면 기준이 아니라 그 사람 기준: arms[1] = 왼쪽(+x)
    tL.sh.rotation.set(walking ? 0.35 * Math.sin(ph) * amp : 0.35, 0, walking ? 0.08 : 0.25); tL.el.rotation.x = walking ? -0.25 : -0.9;
    // 오른팔 누르기: 0 내림 · 1 버튼 바로 위 · 1.15 꾹
    let reach = 0;
    const hover = (a, b, top) => Math.sin(Math.PI * clamp((t - a) / (b - a), 0, 1)) * top;
    if (t > T.look) reach = Math.max(reach, sstep(seg(t, T.look + 0.05, T.f1)) * 0.55);
    reach = Math.max(reach, hover(T.f1, T.f1 + 0.5, 1) * (t < T.f2 ? 1 : 0), hover(T.f2, T.f2 + 0.6, 1.02) * (t < T.press - 0.2 ? 1 : 0));
    if (t > T.f1 + 0.5 && t < T.f2) reach = Math.max(reach, 0.55); if (t > T.f2 + 0.6 && t < T.press) reach = Math.max(reach, 0.6 + 0.4 * sstep(seg(t, T.press - 0.35, T.press)));
    if (t >= T.press) reach = t < T.press + 0.35 ? 1.12 : lerp(1.12, 0.5, sstep(seg(t, T.press + 0.35, T.press + 0.8)));
    const rk = clamp(reach, 0, 1.15);
    tR.sh.rotation.set(walking ? -0.35 * Math.sin(ph) * amp : lerp(0.1, -1.05, rk), lerp(0, 0.35, rk), lerp(-0.08, -0.32, rk)); tR.el.rotation.x = walking ? -0.25 : lerp(-0.3, -0.55 + 0.12 * (rk - 1), rk);
    // 손가락: 오른손은 검지만 펴고 주먹 · 왼손은 가볍게 쥠
    if (tR.H) { for (const n of ["middle", "ring", "pinky"]) tR.H.setChain(n, [null, [-1.4, 0, 0], [-1.6, 0, 0], [-1, 0, 0]]); tR.H.setChain("index", [null, [-0.1, 0, 0], [-0.08, 0, 0], [-0.05, 0, 0]]); tR.H.setChain("thumb", [[-0.5, 0.3, 0], [-0.4, 0, 0], [-0.5, 0, 0]]); }
    if (tL.H) { for (const n of ["index", "middle", "ring", "pinky"]) tL.H.setChain(n, [null, [-0.9, 0, 0], [-1, 0, 0], [-0.6, 0, 0]]); tL.H.setChain("thumb", [[-0.3, 0.2, 0], [-0.3, 0, 0], [-0.3, 0, 0]]); }
    // 얼굴: 걸을 땐 무표정 → 카메라 보며 씩 → 누르는 척하며 히죽 → 누를 땐 활짝 · 고개
    const look = sstep(seg(t, T.look, T.look + 0.35)), grin = t > T.press ? 1 : t > T.f1 ? 0.6 + 0.25 * Math.sin(t * 9) ** 2 : 0.15 + 0.45 * look;
    K.face(grin, 0.25 + 0.55 * grin, t > T.f1 && t < T.press ? 0.8 : 0.2);
    K.neck.rotation.y = lerp(0, 0.55, look) * (t > T.f1 - 0.1 && t < T.press - 0.25 ? 0.4 : 1); K.neck.rotation.x = t > T.press ? -0.08 : 0.05 * look;
    // 충격파에 뒤로 나자빠짐
    if (impT < Infinity) { const k = seg(t - impT, 0.3, 1.1), kE = eOut(k), away = K.root.position.clone().sub(E).setY(0).normalize();
      K.root.position.addScaledVector(away, vh * 0.25 * kE); K.root.rotation.x = 0; K.body.rotation.x = -1.35 * kE; K.body.position.y = lerp(0.95, 0.25, kE);
      for (const sd of [-1, 1]) { K.arms[sd].sh.rotation.set(-2.2 * kE, 0, sd * 0.9 * kE); K.legs[sd].hip.rotation.x = -0.9 * kE; }
      K.face(0.1, 0, 1); }
  }
  // 터짐
  function boom() {
    snd.boom(); buzz([3, 80, 3, 120, 3, 160, 2, 220, 2, 300, 1]);
    flash.style.transition = "none"; flash.style.opacity = "1"; requestAnimationFrame(() => { flash.style.transition = "opacity 1.4s ease-out"; flash.style.opacity = "0"; });
    fball.visible = true; fball.position.copy(E); boomL.position.copy(E).add(V(0, vh * 0.15, 0)); boomL.intensity = 60; shake = vh * 0.012; skyU.uBoom.value = 1;
    scorch.position.x = E.x; scorch.position.z = E.z;
    // 벽돌: 가운데는 녹아 사라지고 · 둘레는 밖으로 · 위로 · 빙글빙글
    board.updateMatrixWorld(true);
    for (const b of bricks) { const wp = b.m.getWorldPosition(V()), q = b.m.getWorldQuaternion(new THREE.Quaternion()); scene.attach(b.m); b.m.position.copy(wp); b.m.quaternion.copy(q);
      const d = wp.clone().sub(E).setY(0), dist = d.length(), k = clamp(1 - dist / (vh * 0.9), 0.15, 1); d.normalize();
      if (dist < vh * 0.09 && Math.random() < 0.7) { b.vap = true; continue; }
      b.v.copy(d).multiplyScalar(rnd(700, 1500) * k).add(V(0, rnd(500, 1300) * k, 0)); b.w.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)).multiplyScalar(k); b.delay = dist / (vh * 2.6); }
    // 처음 불꽃: 땅을 따라 번지는 불과 연기
    for (let i = 0; i < 160; i++) { const a = rnd(0, 6.283), r = rnd(0, vh * 0.12); fire.P.push({ p: E.clone().add(V(Math.cos(a) * r, rnd(0, vh * 0.06), Math.sin(a) * r)), v: V(Math.cos(a), rnd(0.1, 0.8), Math.sin(a)).multiplyScalar(rnd(300, 900)), s: vh * rnd(0.05, 0.1), s1: vh * rnd(0.18, 0.3), life: 0, max: rnd(0.5, 1.2), a: 0.9, a0: 0.9, c: 0xffe6b0, rot: rnd(0, 6), w: rnd(-1, 1) }); }
    // 버섯구름 입자 준비 (갓 · 기둥 · 밑동)
    for (let i = 0; i < 1700; i++) { const kind = i < 900 ? 0 : i < 1300 ? 1 : 2;
      cloud.P.push({ kind, th: rnd(0, 6.283), ph: rnd(0, 6.283), rr: Math.sqrt(Math.random()), h: Math.random(), jx: rnd(-1, 1), jy: rnd(-1, 1), jz: rnd(-1, 1), p: E.clone(), s: 0, rot: rnd(0, 6.28), w: rnd(-0.3, 0.3), a: 0, c: 0x8a8278, gl: 1, sk: rnd(0.7, 1.3), dl: Math.random() * 0.25 }); }
  }
  function after(s, dt) {
    // 불덩이: 0.35초에 확 부풀었다가 · 떠오르며 식어 연기 속으로
    const R = vh * 0.2 * eOut(seg(s, 0, 0.35)) * (1 + 0.25 * seg(s, 0.35, 2)), lift = vh * 0.55 * eIn(seg(s, 0.3, 2.2)) + vh * 0.35 * seg(s, 2.2, 6);
    fball.scale.setScalar(Math.max(1, R)); fball.position.copy(E).add(V(0, R * 0.55 + lift, 0)); fbU.uT.value = s; fbU.uHeat.value = 1 - 0.85 * seg(s, 0.2, 3); fbU.uA.value = 1 - sstep(seg(s, 2.2, 3.6)); fball.visible = fbU.uA.value > 0.01;
    boomL.intensity = 60 * Math.exp(-s * 0.9); boomL.position.copy(fball.position); skyU.uBoom.value = Math.exp(-s * 0.7);
    // 땅 충격파 · 수증기 고리
    shockR.material.opacity = s < 1.4 ? 0.8 * (1 - s / 1.4) : 0; shockR.position.x = E.x; shockR.position.z = E.z; shockR.scale.setScalar(vh * 0.1 + vh * 2.4 * eOut(seg(s, 0, 1.4)));
    const ws = seg(s, 0.45, 1.5); wilson.visible = ws > 0 && ws < 1; wilson.position.copy(E).add(V(0, vh * 0.55, 0)); wilson.scale.set(vh * (0.35 + 0.5 * ws), vh * (0.12 + 0.15 * ws), vh * (0.35 + 0.5 * ws)); wilson.material.opacity = 0.32 * Math.sin(Math.PI * ws);
    scorch.material.opacity = Math.min(0.9, s * 2); scorch.scale.setScalar(vh * (0.15 + 0.45 * eOut(seg(s, 0, 1.2))));
    if (s > 0.3) at("blowCam", () => { const back = cam.position.clone().sub(E).setY(0).normalize(); blowV.addScaledVector(back, vh * 1.6).add(V(0, vh * 0.5, 0)); shake = vh * 0.02; snd.wind(); buzz([3, 120, 2]); });
    // 벽돌
    for (const b of bricks) { if (b.vap) { b.m.scale.multiplyScalar(Math.exp(-dt * 8)); continue; } if (s < (b.delay || 0)) continue;
      b.v.y -= 1600 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
      if (b.m.position.y < Y0 + b.dz) { b.m.position.y = Y0 + b.dz; b.v.y *= -0.3; b.v.x *= 0.6; b.v.z *= 0.6; b.w.multiplyScalar(0.55); } }
    // 첫 불꽃
    fire.P = fire.P.filter(q => (q.life += dt) < q.max); for (const q of fire.P) { q.v.multiplyScalar(Math.exp(-3 * dt)); q.p.addScaledVector(q.v, dt); q.s = lerp(q.s, q.s1, Math.min(1, dt * 3)); q.a = q.a0 * (1 - q.life / q.max); q.c = q.life / q.max < 0.4 ? 0xfff0c0 : 0xff6a20; }
    // 버섯구름: 갓 = 도넛 모양으로 말려 올라가며(바깥이 위로, 안쪽이 아래로) 솟고 퍼짐 · 기둥 = 위로 빨려 올라감 · 밑동 = 땅을 따라 퍼지는 흙먼지
    const H = vh * 0.25 + vh * 1.25 * (1 - Math.exp(-s / 2.4)), Rm = vh * 0.07 + vh * 0.32 * (1 - Math.exp(-s / 2.2)), rm = vh * 0.07 + vh * 0.16 * (1 - Math.exp(-s / 1.8));
    const cool = seg(s, 0.6, 4.5), glow = Math.max(0, 1 - s / 3.2), cap = sstep(seg(s, 0.15, 0.9));
    for (const q of cloud.P) { const sk = q.sk; if (s < q.dl) { q.a = 0; continue; }
      if (q.kind === 0) { q.ph += dt * 0.9; const rr = rm * (0.55 + 0.45 * q.rr), ring = Rm + rr * Math.cos(q.ph);
        q.p.set(E.x + Math.cos(q.th) * ring + q.jx * rm * 0.25, E.y + H + rr * Math.sin(q.ph) * 0.8 + q.jy * rm * 0.2, E.z + Math.sin(q.th) * ring + q.jz * rm * 0.25);
        q.s = (rm * 0.9 + vh * 0.04) * sk * cap; q.a = 0.82 * cap; const top = (Math.sin(q.ph) + 1) / 2; q.c = lerpHex(0x6a4a34, top > 0.5 ? 0xd8cfc2 : 0x9c9284, cool * (0.5 + 0.5 * top)); q.gl = glow * (1 - top); }
      else if (q.kind === 1) { const hh = ((q.h + s * 0.12) % 1), y = (H - rm * 0.4) * hh, rs = vh * (0.035 + 0.05 * (1 - hh) ** 2 + 0.025 * hh) * (0.6 + 0.4 * q.rr);
        q.p.set(E.x + Math.cos(q.th + s * 0.4) * rs + q.jx * 6, E.y + y, E.z + Math.sin(q.th + s * 0.4) * rs + q.jz * 6);
        q.s = vh * (0.05 + 0.05 * hh) * sk * sstep(seg(s, 0.25, 1)); q.a = 0.75 * sstep(seg(s, 0.25, 1)); q.c = lerpHex(0x7a5a40, 0xa89c8c, cool); q.gl = glow * 0.8; }
      else { const rr = vh * (0.12 + 1.0 * (1 - Math.exp(-s / 1.3))) * (0.5 + 0.5 * q.rr);
        q.p.set(E.x + Math.cos(q.th) * rr, Y0 + vh * 0.02 + vh * 0.06 * q.h * (0.5 + seg(s, 0, 3)), E.z + Math.sin(q.th) * rr);
        q.s = vh * (0.07 + 0.08 * seg(s, 0, 3)) * sk; q.a = 0.7 * sstep(seg(s, 0.05, 0.5)) * (1 - 0.4 * seg(s, 3, 6)); q.c = lerpHex(0x8a7660, 0xb0a490, cool); q.gl = glow * 0.5; }
      q.rot += q.w * dt; }
    if (s > T.end - impT - 1.3) fade.style.opacity = String(seg(s, T.end - impT - 1.3, T.end - impT));
  }
  function lerpHex(a, b, k) { return tmpC.set(a).lerp(tmpC2.set(b), clamp(k, 0, 1)).getHex(); }
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  function finish() {
    cancelAnimationFrame(raf); if (doneF) return; doneF = true;
    X.drop("nuke"); document.documentElement.classList.remove("nuke-on");
    scene.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach(x => x.dispose()); }); texs.forEach(x => x.dispose());
    setTimeout(() => { flash.remove(); fade.style.transition = "opacity .6s"; fade.style.opacity = "0"; setTimeout(() => fade.remove(), 700); }, 60);
    o.onDone && o.onDone();
  }
  raf = requestAnimationFrame(frame);
  return new Promise(res => res());
}

// ── 소리 ──
function makeSound(get) {
  const A = () => get && get();
  const noise = (a, t, type, f0, f1, q, gain, att, dur) => {
    const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain();
    s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  };
  const tone = (a, t, type, f0, f1, gain, att, dur) => {
    const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.out); o.start(t); o.stop(t + dur + 0.05);
  };
  return {
    click() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 2400, 1800, 3, 0.5, 0.001, 0.04); tone(a, t, "sine", 300, 160, 0.3, 0.002, 0.08); },
    alarm() { const a = A(); if (!a) return; const t = a.c.currentTime; for (let i = 0; i < 3; i++) { tone(a, t + i * 0.42, "square", 880, 880, 0.08, 0.01, 0.2); tone(a, t + i * 0.42 + 0.2, "square", 660, 660, 0.08, 0.01, 0.2); } },
    whistle(d) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 2400, 500, 0.12, d * 0.8, d); noise(a, t, "bandpass", 800, 3000, 2, 0.25, d * 0.9, d); },
    boom() { const a = A(); if (!a) return; const t = a.c.currentTime;
      tone(a, t, "sine", 70, 18, 1, 0.005, 3.5); tone(a, t, "triangle", 40, 20, 0.7, 0.02, 4); noise(a, t, "lowpass", 3000, 40, 0.7, 1, 0.004, 4.5); noise(a, t, "highpass", 3000, 800, 0.7, 0.6, 0.001, 0.4);
      for (const d of [0.4, 1.0, 1.8, 2.8]) noise(a, t + d, "lowpass", 500, 50, 0.7, 0.5 / (1 + d * 0.5), 0.1, 2.5); },
    wind() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 400, 150, 0.8, 0.7, 0.05, 2.5); noise(a, t, "lowpass", 200, 60, 0.7, 0.6, 0.1, 3); },
  };
}
