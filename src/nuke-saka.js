// 핵 후반 (사카밤바스피스): nuke.js가 마지막으로 누르려는 순간부터 여기로 넘김.
// 닿기 직전 확대·슬로모션 → 큰 파도가 덮침 → 물속, 화면 축소 → 거대한 사카밤바스피스(입 모양은 사진 그대로)가 다 빨아들여 삼킴 →
// 그대로 헤엄쳐 감 → 카메라가 배 쪽으로 가서 배 안으로 → 안경 사진 3초 → 원래 표정 → 주머니에서 터무니없이 큰 핵 버튼 → 꾹 →
// 저 멀리서 거대한 탄도미사일 → 추격 → 명중 → 전부 폭발 (물고기 살점 조각 · 벽돌 · 눈알 · 버튼 부품 · 불덩이 · 거품)
// 좌표는 nuke.js와 같음 (화면 픽셀 = 월드 단위, 바닥 y = Y0)
import * as THREE from "three";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, V, buzz, vnoise } from "./fx-util.js";
import sakaUrl from "./assets/saka.webp?url";

let imgP = null;
const loadImg = () => imgP || (imgP = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = sakaUrl; }));
export const preloadSaka = () => loadImg().catch(() => {});

// 시각표 (마지막 누르기 시작부터, 실제 초)
export const S = { slow0: 0.55, slow1: 2.35, wave0: 1.7, crash: 3.55, under: 3.95, out0: 4.2, fish0: 5.6, gulp0: 7.3, gulp1: 9.0, away0: 9.0, belly0: 11.2, inside: 12.7, glass1: 15.9, pocket0: 16.3, pocket1: 18.0, press: 19.2, launch: 20.4, hit: 26.4, end: 33.2 };

// ── 몸통 단면표: s(0 꼬리끝 → 1 코), 가로 반폭 w, 세로 반높이 h, 중심 높이 c (몸길이 1 기준) ──
const RT = [[0, 0.008, 0.012, 0.03], [0.05, 0.016, 0.024, 0.026], [0.12, 0.026, 0.04, 0.02], [0.2, 0.046, 0.064, 0.016], [0.3, 0.08, 0.1, 0.014], [0.42, 0.118, 0.132, 0.012], [0.55, 0.146, 0.152, 0.01], [0.68, 0.158, 0.158, 0.006], [0.79, 0.154, 0.148, 0.0], [0.87, 0.14, 0.13, -0.006], [0.93, 0.118, 0.106, -0.012], [0.966, 0.092, 0.082, -0.016], [0.986, 0.062, 0.056, -0.02], [0.996, 0.032, 0.03, -0.022], [1, 0, 0, -0.022]];
function rt(s) { for (let i = 1; i < RT.length; i++) if (s <= RT[i][0]) { const a = RT[i - 1], b = RT[i], k = (s - a[0]) / (b[0] - a[0]), e = k * k * (3 - 2 * k) * 0.35 + k * 0.65; return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e)]; } return [0, 0, -0.022]; }
// 단면 위의 점 (a: 0 = 옆(+z), π/2 = 위) · 배는 조금 납작
function ringPt(s, a, out) { const [w, h, c] = rt(s), ca = Math.cos(a), sa = Math.sin(a), e = 0.82, hz = sa < 0 ? h * 0.86 : h; return out.set(s - 0.5, c + Math.sign(sa) * Math.pow(Math.abs(sa), e) * hz, Math.sign(ca) * Math.pow(Math.abs(ca), e) * w); }
// 앞면 위 (y, z)에 해당하는 표면의 x (머리 쪽에서 안으로 들어가며 찾음)
function frontX(y, z) { for (let s = 1; s > 0.6; s -= 0.0008) { const [w, h, c] = rt(s), hz = y - c < 0 ? h * 0.86 : h, a = Math.pow(Math.abs(z) / Math.max(w, 1e-4), 1 / 0.82), b = Math.pow(Math.abs(y - c) / Math.max(hz, 1e-4), 1 / 0.82); if (a * a + b * b <= 1) return s - 0.5; } return 0.1; }

function fishBodyGeo() {
  const NS = 120, NA = 64, pos = [], uv = [], col = [], idx = [], p = V();
  for (let i = 0; i <= NS; i++) { const u = i / NS, s = 1 - Math.pow(1 - u, 1.0) ; for (let j = 0; j <= NA; j++) { const a = (j / NA) * Math.PI * 2 - Math.PI / 2; ringPt(Math.min(s, 0.9995), a, p); pos.push(p.x, p.y, p.z); uv.push(s * 3.2, j / NA);
      const belly = sstep(seg(-Math.sin(a), 0.05, 0.85)), plate = sstep(seg(s, 0.8, 0.9)) * 0.08; col.push(lerp(1, 1.42, belly) + plate, lerp(1, 1.4, belly) + plate, lerp(1, 1.3, belly) + plate); } }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // 코끝 막음
  const tip = pos.length / 3; ringPt(1, 0, p); pos.push(p.x, p.y, 0); uv.push(3.2, 0.5); col.push(1.1, 1.1, 1.08); for (let j = 0; j < NA; j++) { const a = NS * (NA + 1) + j; idx.push(a, tip, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// 꼬리지느러미: 사진처럼 위로 길게 솟은 잎, 아래는 짧게
function tailGeo() {
  const sh = new THREE.Shape(); sh.moveTo(0.02, 0.018); sh.bezierCurveTo(-0.03, 0.05, -0.06, 0.12, -0.075, 0.2); sh.bezierCurveTo(-0.08, 0.215, -0.095, 0.21, -0.098, 0.195); sh.bezierCurveTo(-0.1, 0.13, -0.085, 0.07, -0.07, 0.02);
  sh.bezierCurveTo(-0.08, -0.01, -0.085, -0.03, -0.075, -0.055); sh.bezierCurveTo(-0.05, -0.04, -0.02, -0.01, 0.02, 0.0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 24 }); g.translate(-0.47, 0.012, -0.003);
  const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(0.92); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const uv = g.attributes.uv; for (let i = 0; i < n; i++) uv.setXY(i, g.attributes.position.getX(i) * 3.2 + 1.6, g.attributes.position.getY(i) * 2 + 0.5); return g;
}
// 사진에서 몸통 질감을 떼어 와 밝기 기울기를 없앤 반복 무늬
function skinTex(img) {
  const c = document.createElement("canvas"), W = 512, H = 256; c.width = W; c.height = H; const x = c.getContext("2d");
  const src = [[188, 128, 84, 42]];
  x.drawImage(img, ...src[0], 0, 0, W, H); const im = x.getImageData(0, 0, W, H), d = im.data;
  const b = document.createElement("canvas"); b.width = W; b.height = H; const bx = b.getContext("2d"); bx.drawImage(c, -60, -60, W + 120, H + 120); bx.filter = "blur(18px)"; bx.drawImage(c, -60, -60, W + 120, H + 120); bx.drawImage(c, 0, 0); const bl = bx.getImageData(0, 0, W, H).data;
  let mr = 0, mg = 0, mb = 0; for (let i = 0; i < d.length; i += 4) { mr += d[i]; mg += d[i + 1]; mb += d[i + 2]; } const n = d.length / 4; mr /= n; mg /= n; mb /= n;
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] - bl[i] + d[i + 1] - bl[i + 1] + d[i + 2] - bl[i + 2]) / 3 * 1.3; d[i] = clamp(mr * 1.03 + g, 0, 255); d[i + 1] = clamp(mg + g, 0, 255); d[i + 2] = clamp(mb * 0.95 + g, 0, 255); }
  x.putImageData(im, 0, 0);
  // 가장자리 이음매가 안 보이게 좌우·위아래로 겹쳐 섞음
  const o = document.createElement("canvas"); o.width = W; o.height = H; const ox = o.getContext("2d"); ox.drawImage(c, 0, 0); ox.globalAlpha = 0.5; ox.drawImage(c, W / 2, 0); ox.drawImage(c, -W / 2, 0); ox.globalAlpha = 1;
  const g = ox.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0)"); ox.fillStyle = g; ox.fillRect(0, 0, W, H);
  // 작은 밝은 점 (사진의 반점)
  for (let i = 0; i < 900; i++) { ox.fillStyle = `rgba(236,226,196,${rnd(0.15, 0.5)})`; ox.beginPath(); ox.arc(rnd(0, W), rnd(0, H), rnd(0.5, 1.6), 0, 7); ox.fill(); }
  const t = new THREE.CanvasTexture(o); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(1, 4); t.anisotropy = 8; return t;
}
// 둥근 거품 그림
function bubbleTex() { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 20, 32, 32, 31); g.addColorStop(0, "rgba(255,255,255,0.06)"); g.addColorStop(0.8, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(32, 32, 31, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.ellipse(24, 22, 6, 4, -0.6, 0, 7); x.fill(); const t = new THREE.CanvasTexture(c); return t; }

// ── 물고기 만들기 ──
async function buildFish(dark) {
  const img = await loadImg(), skin = skinTex(img), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bendU = { uPh: { value: 0 }, uAmp: { value: 0 } };
  const bend = sh => { Object.assign(sh.uniforms, bendU); sh.vertexShader = "uniform float uPh, uAmp; varying vec3 vOP, vON;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vOP = position; vON = normal; { float s = position.x + 0.5, k = pow(clamp(1.0 - s / 0.78, 0.0, 1.0), 1.7); transformed.z += uAmp * k * sin(uPh - s * 7.0); }");
    // 삼면 투영 질감 (코끝에 부채꼴 이음매가 안 생김)
    sh.fragmentShader = "varying vec3 vOP, vON;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#ifdef USE_MAP\n vec3 bw = pow(abs(normalize(vON)), vec3(4.0)); bw /= dot(bw, vec3(1.0)); vec4 tx = texture2D(map, vOP.yz * vec2(5.0, 2.5)) * bw.x + texture2D(map, vOP.xz * vec2(2.5, 5.0)) * bw.y + texture2D(map, vOP.xy * vec2(2.5, 5.0)) * bw.z; diffuseColor *= tx;\n#endif"); };
  const mat = new THREE.MeshStandardMaterial({ map: skin, vertexColors: true, roughness: 0.62, metalness: 0.0, color: 0xc9c2b2 });
  mat.onBeforeCompile = bend; mat.customProgramCacheKey = () => "sakaSkin";
  const bodyM = new THREE.Mesh(fishBodyGeo(), mat); const tail = new THREE.Mesh(tailGeo(), mat); body.add(bodyM, tail);
  // 머리 판의 이음매 · 옆줄 (얕은 홈)
  const lineM = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.8 }); lineM.onBeforeCompile = bend; lineM.customProgramCacheKey = () => "sakaSkin";
  { const pts = []; for (let i = 0; i <= 60; i++) { const s = 0.22 + (i / 60) * 0.68; pts.push(ringPt(s, 0.06, V()).multiplyScalar(1.002)); } const c = new THREE.CatmullRomCurve3(pts); body.add(new THREE.Mesh(new THREE.TubeGeometry(c, 80, 0.0007, 6), lineM));
    const p2 = []; for (let i = 0; i <= 60; i++) { const s = 0.22 + (i / 60) * 0.68; const q = ringPt(s, Math.PI - 0.06, V()); q.multiplyScalar(1.002); p2.push(q); } body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p2), 80, 0.0007, 6), lineM));
    for (const side of [1, -1]) { const p3 = []; for (let i = 0; i <= 40; i++) { const a = -1.2 + (i / 40) * 2.6; p3.push(ringPt(0.835, side > 0 ? a : Math.PI - a, V()).multiplyScalar(1.004)); } body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p3), 50, 0.0009, 6), lineM)); } }
  // 눈: 앞면 양쪽, 까만 눈동자 + 밝은 테두리 (사진처럼 앞을 봄)
  const eyes = [], eyeB = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }), eyeW = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.45 });
  for (const sd of [1, -1]) { const z = sd > 0 ? 0.05 : -0.047, y = 0.0085, x = frontX(y, z), g = new THREE.Group(); g.position.set(x - 0.004, y, z);
    const n = V(1, 0, sd * 0.55).normalize(); g.quaternion.setFromUnitVectors(V(0, 0, 1), n);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0086, 32, 16), eyeB); ball.position.z = 0.0035; const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0098, 0.0034, 12, 40), eyeW); ring.position.z = 0.003; g.add(ball, ring); root.add(g); eyes.push(g); }
  // 입: 사진 그대로 — 두 눈 아래 가운데, 가로로 긴 일자 틈 (가운데가 살짝 처지고 양끝은 조금 올라감), 둘레는 밝은 입술
  const MO = []; for (let i = 0; i <= 24; i++) { const k = i / 24; MO.push([lerp(-0.04, 0.043, k), -0.003 + 0.001 * Math.sin(k * 3.1)]); }
  for (let i = 1; i < 40; i++) { const k = 1 - i / 40, z = lerp(-0.04, 0.043, k), w = Math.sin(Math.PI * Math.pow(k, 0.9)); MO.push([z, -0.003 - 0.02 * Math.pow(w, 0.5)]); }
  const msh = new THREE.Shape(); MO.forEach(([z, y], i) => (i ? msh.lineTo(-z, y) : msh.moveTo(-z, y))); msh.closePath();
  const mg = new THREE.ShapeGeometry(msh, 24); { const p = mg.attributes.position; for (let i = 0; i < p.count; i++) { const z = -p.getX(i), y = p.getY(i); p.setXYZ(i, frontX(y, z) + 0.0006, y, z); } mg.computeVertexNormals(); }
  const mouthM = new THREE.MeshStandardMaterial({ color: 0x080504, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), lipM = new THREE.MeshStandardMaterial({ color: 0x9a9284, roughness: 0.6 });
  const rim = MO.map(([z, y]) => V(frontX(y, z) + 0.0012, y, z)); root.add(new THREE.Mesh(mg, mouthM), new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 120, 0.0016, 8, true), lipM));
  const mouth = V(frontX(-0.016, 0), -0.016, 0);
  // 배 속 (위): 접힌 주름이 있는 축축한 분홍 벽 · 바닥엔 위액
  const SC = V(0.08, -0.02, 0), SR = V(0.25, 0.11, 0.12);
  const stomach = new THREE.Group(); stomach.position.copy(SC); root.add(stomach); stomach.visible = false;
  { const g = new THREE.SphereGeometry(1, 160, 90), p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = Math.sin(x * 26 + vnoise(y * 4 + 3, z * 4) * 4) * 0.5 + 0.5, r = 1 - 0.05 * Math.pow(f, 3) - 0.03 * vnoise(x * 9, y * 9 + z * 5); p.setXYZ(i, x * SR.x * r, y * SR.y * r, z * SR.z * r); const v = 0.75 + 0.35 * f + 0.15 * vnoise(x * 30, z * 30); c[i * 3] = v; c[i * 3 + 1] = v * 0.8; c[i * 3 + 2] = v * 0.82; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    const vein = document.createElement("canvas"); vein.width = vein.height = 512; const vx = vein.getContext("2d"); vx.fillStyle = "#c46a6c"; vx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) { let x = rnd(0, 512), y = rnd(0, 512), a = rnd(0, 6.28); vx.strokeStyle = `rgba(${rnd(90, 130)},20,40,${rnd(0.25, 0.6)})`; vx.lineWidth = rnd(0.8, 3.2); vx.beginPath(); vx.moveTo(x, y); for (let k = 0; k < 30; k++) { a += rnd(-0.5, 0.5); x += Math.cos(a) * 9; y += Math.sin(a) * 9; vx.lineTo(x, y); } vx.stroke(); }
    for (let i = 0; i < 1600; i++) { vx.fillStyle = `rgba(255,200,200,${rnd(0.04, 0.16)})`; vx.beginPath(); vx.arc(rnd(0, 512), rnd(0, 512), rnd(1, 5), 0, 7); vx.fill(); }
    const vt = new THREE.CanvasTexture(vein); vt.colorSpace = THREE.SRGBColorSpace; vt.wrapS = vt.wrapT = THREE.RepeatWrapping; vt.repeat.set(4, 2);
    const wall = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: vt, vertexColors: true, color: 0xffb0b0, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, side: THREE.BackSide, emissive: 0x3a0608, emissiveIntensity: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xff8080) }));
    stomach.add(wall);
    const juice = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshPhysicalMaterial({ color: 0x9c8a2a, roughness: 0.06, metalness: 0.0, clearcoat: 1, transparent: true, opacity: 0.86, emissive: 0x2a2004, emissiveIntensity: 0.6 }));
    juice.rotation.x = -Math.PI / 2; juice.position.y = -SR.y * 0.62; juice.scale.set(SR.x * 0.8, SR.z * 0.82, 1); stomach.add(juice); stomach.userData.juiceY = juice.position.y; stomach.userData.juice = juice;
    const lamp = new THREE.PointLight(0xff9a8a, 0, 0, 1.2); lamp.position.set(0.02, 0.06, 0.05); stomach.add(lamp); stomach.userData.lamp = lamp;
    const lamp2 = new THREE.PointLight(0xffe0c0, 0, 0, 1.4); lamp2.position.set(-0.1, 0.0, 0.08); stomach.add(lamp2); stomach.userData.lamp2 = lamp2; }
  root.traverse(q => { if (q.isMesh) { q.frustumCulled = false; } });
  return { root, body, bendU, mat, eyes, mouth, stomach, SC, SR, geo: bodyM.geometry, tailG: tail.geometry };
}

// ── 큰 파도: 옆으로 긴 물결 단면을 매 프레임 바꿈 (부풀기 → 말리기 → 무너지기) ──
function buildWave(W, H) {
  const NW = 110, NP = 80, g = new THREE.BufferGeometry(), pos = new Float32Array((NW + 1) * (NP + 1) * 3), prm = new Float32Array((NW + 1) * (NP + 1)), idx = [];
  for (let i = 0; i < NW; i++) for (let j = 0; j < NP; j++) { const a = i * (NP + 1) + j, b = a + NP + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  for (let i = 0; i <= NW; i++) for (let j = 0; j <= NP; j++) prm[i * (NP + 1) + j] = j / NP;
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aP", new THREE.BufferAttribute(prm, 1)); g.setIndex(idx);
  const U = { uT: { value: 0 }, uDeep: { value: new THREE.Color(0x06384e) }, uMid: { value: new THREE.Color(0x13788c) }, uLit: { value: new THREE.Color(0x5fd0d4) }, uSky: { value: new THREE.Color(0xcfe4f0) }, uSun: { value: V(-0.45, 0.62, 0.64).normalize() }, uFoam: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, transparent: false,
    vertexShader: `attribute float aP; varying float vP; varying vec3 vN, vW; void main(){ vP = aP; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT, uFoam; uniform vec3 uDeep, uMid, uLit, uSky, uSun; varying float vP; varying vec3 vN, vW;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.1 + 3.7; a *= 0.5; } return s; }
void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 v = normalize(cameraPosition - vW);
  vec2 q = vec2(vW.x * 0.004, vP * 9.0 - uT * 0.6); float r1 = fbm(q * vec2(3.0, 1.0) + uT * 0.3), r2 = fbm(q * vec2(9.0, 3.0) - uT * 0.5);
  n = normalize(n + 0.25 * vec3(r1 - 0.5, r2 - 0.5, r1 - r2));
  float thin = smoothstep(0.55, 0.85, vP) * (1.0 - smoothstep(0.93, 1.0, vP));
  vec3 c = mix(uDeep, uMid, smoothstep(0.1, 0.7, vP)); c = mix(c, uLit, thin * 0.75 * (0.6 + 0.4 * max(dot(-v, uSun), 0.0)));
  float dif = max(dot(n, uSun), 0.0); c *= 0.55 + 0.6 * dif;
  float fr = pow(1.0 - abs(dot(n, v)), 4.0); c = mix(c, uSky, fr * 0.6);
  vec3 h = normalize(uSun + v); c += vec3(1.0, 0.97, 0.9) * pow(max(dot(n, h), 0.0), 120.0) * 1.6;
  float foam = smoothstep(0.86, 0.97, vP + 0.08 * (fbm(q * 4.0) - 0.5)) + smoothstep(0.25, 0.0, vP) * 0.6;
  foam += uFoam * smoothstep(0.45, 0.9, fbm(q * vec2(5.0, 2.0) + 1.3));
  foam += smoothstep(0.72, 0.8, fbm(q * vec2(6.0, 1.4) + 9.0)) * smoothstep(0.35, 0.8, vP) * 0.7;
  c = mix(c, vec3(0.94, 0.97, 1.0) * (0.75 + 0.3 * dif), clamp(foam, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  // 단면 모양 (z: 나아가는 쪽, y: 높이) — k 0 부풀기, 1 말리기, 2 무너짐
  const K0 = [[-3.4, 0], [-2.2, 0.08], [-1.3, 0.34], [-0.6, 0.72], [-0.1, 0.9], [0.25, 0.86], [0.6, 0.6], [0.95, 0.24], [1.35, 0.04], [1.8, 0]];
  const K1 = [[-3.4, 0], [-2.2, 0.12], [-1.3, 0.48], [-0.6, 0.95], [0.0, 1.22], [0.5, 1.3], [0.92, 1.12], [1.12, 0.8], [1.05, 0.5], [0.85, 0.36]];
  const K2 = [[-3.4, 0], [-2.2, 0.18], [-1.3, 0.55], [-0.4, 0.82], [0.4, 0.82], [1.2, 0.62], [1.8, 0.35], [2.2, 0.12], [2.3, 0.0], [2.2, -0.05]];
  const crv = new THREE.CatmullRomCurve3(K0.map(() => V()), false, "centripetal"), tmp = V();
  function shape(k, zc, y0, t) {
    const A = k < 1 ? K0 : K1, B = k < 1 ? K1 : K2, f = k < 1 ? sstep(k) : sstep(k - 1);
    for (let i = 0; i < A.length; i++) crv.points[i].set(0, lerp(A[i][1], B[i][1], f) * H, lerp(A[i][0], B[i][0], f) * H); crv.updateArcLengths();
    for (let j = 0; j <= NP; j++) { crv.getPointAt(j / NP, tmp); for (let i = 0; i <= NW; i++) { const x = (i / NW - 0.5) * W, w = 1 + 0.12 * Math.sin(x * 0.0021 + 1.3) + 0.06 * Math.sin(x * 0.0057 + t), lag = 0.18 * H * Math.sin(x * 0.0013 + 0.4), k3 = (i * (NP + 1) + j) * 3; pos[k3] = x; pos[k3 + 1] = y0 + tmp.y * w; pos[k3 + 2] = zc + tmp.z * (0.85 + 0.15 * w) + lag; } }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); U.uT.value = t;
  }
  return { mesh, shape, U };
}

// ── 터무니없이 큰 핵 버튼 (기둥 없이 버튼 상자만) ──
function buildBigButton() {
  const g = new THREE.Group(), mB = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.35, metalness: 0.75 }), mS = new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.25, metalness: 0.95 }), mD = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.4 });
  const mY = new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 32; const x = c.getContext("2d"); for (let i = 0; i < 34; i++) { x.fillStyle = i % 2 ? "#141414" : "#f0c400"; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 - 8, 32); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })(), roughness: 0.5 });
  const mR = new THREE.MeshPhysicalMaterial({ color: 0xd20c0e, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x5a0000, emissiveIntensity: 0.5 });
  const lbl = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#d8d4c8"; x.fillRect(0, 0, 512, 128); x.strokeStyle = "#222"; x.lineWidth = 8; x.strokeRect(8, 8, 496, 112); x.fillStyle = "#a01010"; x.font = "bold 78px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("☢ 핵 ☢", 256, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const add = (geo, m, x, y, z) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; g.add(q); return q; };
  const box = new THREE.BoxGeometry(1.5, 0.5, 1.2, 1, 1, 1); add(box, mB, 0, 0.25, 0);
  add(new THREE.BoxGeometry(1.56, 0.06, 1.26), mD, 0, 0.03, 0); add(new THREE.BoxGeometry(1.52, 0.04, 1.22), mS, 0, 0.5, 0);
  const plate = add(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.6 }), 0, 0.27, 0.601);
  for (const [x, z] of [[-0.68, 0.53], [0.68, 0.53], [-0.68, -0.53], [0.68, -0.53]]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), mS, x, 0.53, z);
  add(new THREE.CylinderGeometry(0.5, 0.52, 0.06, 64), mD, 0, 0.54, 0); add(new THREE.CylinderGeometry(0.47, 0.47, 0.02, 64), mY, 0, 0.575, 0);
  const cap = add(new THREE.SphereGeometry(0.42, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), mR, 0, 0.58, 0); cap.scale.y = 0.55;
  const lamps = []; for (const x of [-0.55, 0.55]) { const lm = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 0 }); add(new THREE.SphereGeometry(0.05, 16, 10), lm, x, 0.55, 0.45); lamps.push(lm); }
  g.traverse(q => { if (q.isMesh) q.frustumCulled = false; });
  return { g, cap, mR, lamps, top: 0.58 + 0.42 * 0.55 };
}

// ── 조각: 물고기 표면을 씨앗마다 나눠 껍데기 조각으로 (안쪽 면은 살 색) ──
function chunkMat(mat) { const cm = mat.clone(); cm.side = THREE.DoubleSide; cm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.62, 0.16, 0.14) * (0.7 + 0.3 * vColor.r);"); }; cm.customProgramCacheKey = () => "sakaChunk"; return cm; }
function fishChunks(geo, tailG, cm, N) {
  const seeds = []; for (let i = 0; i < N; i++) { const s = Math.pow(Math.random(), 0.8); seeds.push(V(s - 0.5, rnd(-0.16, 0.16), rnd(-0.17, 0.17))); }
  const out = [], buckets = seeds.map(() => ({ p: [], u: [], c: [] }));
  for (const G of [geo, tailG]) { const P = G.attributes.position, UV = G.attributes.uv, C = G.attributes.color, I = G.index; const n = I ? I.count : P.count, a = V(), b = V(), c = V(), m = V();
    for (let t = 0; t < n; t += 3) { const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2; a.fromBufferAttribute(P, ia); b.fromBufferAttribute(P, ib); c.fromBufferAttribute(P, ic); m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      let best = 0, bd = 1e9; for (let k = 0; k < N; k++) { const d = seeds[k].distanceToSquared(m); if (d < bd) { bd = d; best = k; } } const B = buckets[best];
      for (const i of [ia, ib, ic]) { B.p.push(P.getX(i), P.getY(i), P.getZ(i)); B.u.push(UV.getX(i), UV.getY(i)); B.c.push(C.getX(i), C.getY(i), C.getZ(i)); } } }
  buckets.forEach((B, k) => { if (B.p.length < 9) return; const g = new THREE.BufferGeometry(), arr = new Float32Array(B.p), cen = V(); for (let i = 0; i < arr.length; i += 3) cen.add(V(arr[i], arr[i + 1], arr[i + 2])); cen.multiplyScalar(3 / arr.length);
    for (let i = 0; i < arr.length; i += 3) { arr[i] -= cen.x; arr[i + 1] -= cen.y; arr[i + 2] -= cen.z; }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(B.u, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(B.c, 3)); g.computeVertexNormals();
    const mm = new THREE.Mesh(g, cm); mm.position.copy(cen); mm.frustumCulled = false; out.push({ m: mm, c: cen }); });
  return out;
}

export async function prepSaka(dark) { const F = await buildFish(dark); return F; }

// 넘겨받는 것(ctx): X, scene, cam, K, con, parts, BTN, HU, Y0, vw, vh, D, wallG, bricks, sky, skyU, ground, gMat, fadeU, hemi, sun, smoke, spark, makePts, puff, glw, mis, plume, glare, MS, chips, CH, fade, flash, o, snd, dark, setFace, getArmBase
export function runSaka(ctx, F) {
  const { X, scene, cam, K, con, parts, HU, Y0, vw, vh, D, renderer } = ctx, FG = 1;
  const L = vh * 15;   // 몸길이: 입(몸길이의 약 0.1)이 달력 벽을 통째로 넣을 만큼
  const fish = F.root; fish.scale.setScalar(L); fish.visible = false; scene.add(fish); fish.traverse(q => q.layers.set(FG)); F.stomach.traverse(q => q.layers.enableAll());
  cam.far = vh * 140; cam.near = 4; cam.updateProjectionMatrix();
  const wave = buildWave(vw * 9, vh * 1.55); scene.add(wave.mesh); wave.mesh.layers.set(FG); wave.mesh.visible = false;
  const BB = buildBigButton(); BB.g.visible = false; scene.add(BB.g); BB.g.traverse(q => q.layers.set(FG));
  const LP = [F.stomach.userData.lamp, F.stomach.userData.lamp2].map(l => { const p = l.position.clone(); scene.add(l); l.layers.enableAll(); return [l, p]; });
  const CMAT = chunkMat(F.mat), dummy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), CMAT); dummy.scale.setScalar(0.001); dummy.visible = false; scene.add(dummy);
  for (const m of [ctx.plume.material, ctx.glare.material]) { m.fog = false; m.needsUpdate = true; }   // 물속에서도 불꽃은 주황색
  const PRE = fishChunks(F.geo, F.tailG, CMAT, 70);
  const bub = ctx.makePts(900, bubbleTex(), false, false), boomP = ctx.makePts(500, ctx.puff, true, false), soot = ctx.makePts(500, ctx.puff, false, true);
  const ov = css => { const e = document.createElement("div"); e.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;opacity:0;" + css; document.body.append(e); return e; };
  const foamV = ov("background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.96),rgba(200,235,245,.97))"), redV = ov("background:radial-gradient(ellipse at 50% 50%,rgba(120,10,20,.0),rgba(60,0,8,.96) 70%)"), letter = ov("background:linear-gradient(#000 0 9%,transparent 9% 91%,#000 91%)");
  const snd = sakaSound(ctx.o.sfx);
  const water = new THREE.Color(0x0e5a74), waterDeep = new THREE.Color(0x07283a);
  const shafts = new THREE.Group(); scene.add(shafts); shafts.visible = false;
  { const tex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(200,240,255,.55)"); g.addColorStop(1, "rgba(200,240,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 256); const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)"); x.globalCompositeOperation = "destination-out"; x.fillStyle = h; x.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(vh * rnd(0.6, 1.6), vh * 14), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: rnd(0.08, 0.2), depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.position.set(rnd(-vh * 14, vh * 14), Y0 + vh * 5, rnd(-vh * 30, vh * 4)); m.rotation.set(0, rnd(0, 3), 0.18); m.layers.set(FG); shafts.add(m); } }
  // 물 위쪽 면 (아래서 올려다본 일렁이는 수면)
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(vh * 260, vh * 260, 1, 1), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uFar: { value: vh * 40 } }, side: THREE.DoubleSide, depthWrite: false, fog: false, transparent: true,
    vertexShader: "varying vec2 vU; void main(){ vU = (modelMatrix * vec4(position,1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uFar; varying vec2 vU; float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){ vec2 p = vU * 0.0016; float n = vn(p * 3.0 + uT * 0.3) * 0.6 + vn(p * 7.0 - uT * 0.4) * 0.4; float l = smoothstep(0.55, 0.75, n); float d = length(vU - cameraPosition.xz) / uFar;
  gl_FragColor = vec4(mix(vec3(0.16, 0.5, 0.62), vec3(0.75, 0.95, 1.0), l), 0.8 * (1.0 - smoothstep(0.1, 1.0, d)));
  #include <colorspace_fragment>
}` }));
  surf.rotation.x = Math.PI / 2; surf.position.y = Y0 + vh * 9; const SURF2 = Y0 + vh * 46; surf.layers.set(FG); surf.visible = false; scene.add(surf);
  // 폭발 불덩이 · 거품 막
  const fireMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uHeat: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT; varying vec3 vN, vP, vV; float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){ float d = n3(position * 3.0 + uT * 1.5) * 0.6 + n3(position * 7.0 - uT * 2.0) * 0.4; vec3 p = position * (0.82 + 0.4 * d); vP = position * 4.0 + d; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT, uA, uHeat; varying vec3 vN, vP, vV; float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){ float fr = abs(dot(normalize(vN), normalize(vV))); float n = n3(vP + uT) * 0.5 + n3(vP * 2.3 - uT * 1.3) * 0.3 + n3(vP * 5.0) * 0.2; float k = clamp(fr * 0.9 + n * 0.6 - 0.25 + uHeat * 0.3, 0.0, 1.0);
  vec3 c = mix(vec3(0.35, 0.05, 0.01), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.55, k)); c = mix(c, vec3(1.0, 0.9, 0.6), smoothstep(0.6, 0.95, k) * uHeat); gl_FragColor = vec4(c * (0.6 + 0.8 * k), uA * smoothstep(0.05, 0.4, fr) * (0.55 + 0.45 * n)); }` });
  const fireBall = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 6), fireMat); fireBall.layers.set(FG); fireBall.visible = false; scene.add(fireBall);
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0, roughness: 0.05, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, emissive: 0x4080a0, emissiveIntensity: 0.4 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), shellMat); shell.layers.set(FG); shell.visible = false; scene.add(shell);
  const boomL = new THREE.PointLight(0xffa050, 0, 0, 0.6); boomL.layers.enableAll(); scene.add(boomL);
  // 물고기 길: 왼쪽 먼 곳에서 나타나 벽 쪽으로 와서 삼키고, 오른쪽 앞으로 헤엄쳐 감
  const MOUTH_AT = V(vw * 0.05, Y0 + vh * 2.5, D * 0.15);   // 삼키는 지점 (벽·사람·버튼 사이)
  const dirIn = V(1, 0.02, 0.32).normalize();
  const fq = new THREE.Quaternion(), fm = new THREE.Matrix4(), up = V(0, 1, 0);
  const fishLocal = (p, out = V()) => out.copy(p).applyMatrix4(fish.matrixWorld);
  // 머리(입)가 path(u)에 오도록 몸을 둠
  const headOff = () => F.mouth.x * L;
  function fishPathAt(s) {
    // s: 이야기 시간 → 입의 위치와 진행 방향
    if (s < S.gulp1) { const k = (s - S.gulp0) / (S.gulp1 - S.gulp0); return { p: MOUTH_AT.clone().addScaledVector(dirIn, (k - 0.5) * vh * 3.2 - (s < S.gulp0 ? (S.gulp0 - s) * vh * 6 : 0)), d: dirIn.clone() }; }
    const k = s - S.gulp1, d = V(Math.cos(0.32 - k * 0.14), 0.05 + 0.02 * Math.sin(k), Math.sin(0.32 - k * 0.14)).normalize(), sp = vh * (1.9 + 0.5 * k);
    // 적분 대신 닫힌 꼴 근사
    const p = MOUTH_AT.clone().addScaledVector(dirIn, vh * 1.6); for (let i = 0; i < 20; i++) { const kk = (i + 0.5) / 20 * k, dd = V(Math.cos(0.32 - kk * 0.14), 0.05 + 0.02 * Math.sin(kk), Math.sin(0.32 - kk * 0.14)).normalize(); p.addScaledVector(dd, vh * (1.9 + 0.5 * kk) * k / 20); }
    return { p, d };
  }
  function placeFish(s) { const { p, d } = fishPathAt(s), yaw = Math.atan2(-d.z, d.x), pitch = Math.asin(clamp(d.y, -1, 1)); fish.quaternion.setFromEuler(new THREE.Euler(0, yaw, pitch, "YZX")); fish.position.copy(p).addScaledVector(d, -headOff()); fish.updateMatrixWorld(true); return { p, d }; }
  // 삼킬 것들
  const eaten = []; const addEat = (obj, kind) => eaten.push({ obj, kind, v: V(rnd(-30, 30), rnd(10, 60), rnd(-30, 30)), w: V(rnd(-0.6, 0.6), rnd(-0.6, 0.6), rnd(-0.6, 0.6)), gone: false, s0: obj.scale.clone() });
  for (const b of ctx.bricks) addEat(b.m, "brick"); addEat(con, "con");
  // 사람
  let face = "a"; const setFace = f => { if (face !== f) { face = f; K.show(f); } };
  const kimW = V(), kimSink = { y: 0, r: 0 };
  // 카메라
  const camP = V(), look = V(); let fov = cam.fov, shake = 0;
  const handTip = () => { K.sync(); return K.B.handR.localToWorld(V(0, -0.11, 0.02)); };
  const capTop = () => con.localToWorld(V(-0.27, 1.07, 0.48));
  let t = 0, last = 0, ts = 1, story = 0, ended = false, fired = new Set(); const at = (k, fn) => { if (!fired.has(k)) { fired.add(k); fn(); } };
  let cam0 = null, look0 = null, fov0 = 0;
  const kimLocal = V(0.06, -0.11 * 0.62 + 0.0, -0.03);   // 배 속에서 서 있는 곳 (물고기 기준, 위액 면 위)
  let chunks = null, chunkV = [], misP = V(), misD = V(1, 0, 0), misLast = V(), hitPos = V(), kimFly = null, fishGone = false;
  const KSIN = HU / L;   // 배 속에서 사람 크기 (물고기 단위)
  const ZF = clamp(1 + (1 - vw / vh) * 0.8, 1, 1.6);   // 세로로 긴 화면에선 조금 물러나서 찍음
  const MSZ = L * 0.85, BBS = 2.0, BSPOT = V(-1.85, 0, 0.45), qTmp = new THREE.Quaternion(), HQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0.12));

  // 사람 자세: 서 있기 (오른팔 목표 W, 얼굴 쪽 보기)
  function pose(W, opts = {}) {
    const o = opts.off || V(), tk = opts.tuck || 0; K.begin(); const idle = Math.sin(t * 1.7) * 0.004; K.B.hips.position.set(o.x, 0.925 + idle + o.y, o.z); K.setE("hips", 0.02, 0, 0); K.setE("spine", 0.03 + 0.12 * tk, 0, -0.18 * tk); K.setE("chest", -0.015, 0, 0); K.sync();
    K.leg("L", V(0.115 + o.x, 0.08 + o.y + 0.2 * tk, 0.02 + o.z + 0.12 * tk), 0, 0.1); K.leg("R", V(-0.115 + o.x, 0.08 + o.y + 0.28 * tk, -0.02 + o.z + 0.05 * tk), 0, -0.1);
    K.arm("L", opts.L || V(0.285, 0.815, 0.06), V(0.25, -0.1, -1)); K.fingers("L", 0.34, 0.25);
    K.sync(); const hp = K.B.neck.getWorldPosition(V()), to = K.root.worldToLocal(cam.position.clone()).sub(K.root.worldToLocal(hp)), yaw = clamp(Math.atan2(to.x, to.z), -1.1, 1.1), pit = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.35, 0.35);
    K.setE("neck", pit * 0.45, yaw * 0.5, 0); K.setE("head", pit * 0.55 + (face === "b" ? 0.05 : 0), yaw * 0.5, 0.03 * Math.sin(t * 1.1)); K.sync();
    if (W) { K.fingers("R", opts.f ? opts.f[0] : 0.95, opts.f ? opts.f[1] : 0.75, opts.f ? opts.f[2] : 0.02); K.arm("R", W, opts.pole || V(-0.75, -0.8, -0.3), opts.hq); if (opts.hq === undefined) K.B.handR.quaternion.identity(); } K.sync();
  }
  // 물속에서 떠다니는 자세 (팔다리 천천히 허우적)
  function floatPose(k) { K.begin(); const f = Math.sin(t * 2.3), g = Math.sin(t * 1.7 + 1), E = (n, x, y, z) => K.setE(n, x * k, y * k, z * k);
    E("armL", -2.0 + 0.35 * f, 0, 1.0); E("armR", -2.2 - 0.35 * f, 0, -1.0); E("foreL", -0.5 + 0.2 * g, 0, 0); E("foreR", -0.6 - 0.2 * g, 0, 0); E("thighL", -0.5 - 0.3 * g, 0, 0.25); E("thighR", -0.2 + 0.3 * g, 0, -0.25); E("shinL", 0.7, 0, 0); E("shinR", 0.9, 0, 0); E("neck", 0.2, 0, 0); E("head", 0.2, 0, 0); K.fingers("L", 0.2, 0.2); K.fingers("R", 0.2, 0.2); K.sync(); }

  function step(dtReal, noRender) {
    if (ended) return true;
    if (!cam0) { cam0 = cam.position.clone(); look0 = ctx.lookNow.clone(); fov0 = cam.fov; }
    // 슬로모션: 손이 버튼에 닿기 직전 거의 멈춤
    ts = 1 - 0.93 * sstep(seg(t, S.slow0, S.slow0 + 0.35)) * (1 - sstep(seg(t, S.slow1 - 0.25, S.slow1)));
    const dt = dtReal; t += dt; story = t; if (import.meta.env.DEV) window.__sakaT = t;
    const kdt = dt * ts;   // 사람·버튼 움직임에 쓰는 느린 시간
    // ── 1) 마지막 누르기 · 확대 슬로모션 ──
    if (t < S.under) {
      const base = ctx.getArmBase(); const near = base.press.clone().add(V(0, 0.075, 0));
      if (!ctx._pr) ctx._pr = 0; ctx._pr += kdt; const pr = ctx._pr;
      // 0~0.6초(느린 시간) 동안 내려오다 닿기 1.2cm 전에서 거의 멈춤, 파도가 오면 깜짝 놀라 뺌
      let W = base.high.clone().lerp(near, 1 - Math.pow(1 - clamp(pr / 0.62, 0, 1), 2.2));
      if (t > S.slow1 - 0.1) W.lerp(base.high.clone().add(V(-0.12, 0.25, 0.05)), eOut(seg(t, S.slow1 - 0.1, S.slow1 + 0.3)));
      pose(W, { hq: HQ, f: [0.95, 0.75, 0.02] });
      at("slow", () => snd.slow());
      // 카메라: 손끝·버튼으로 바짝 다가감 → 파도가 보이게 뒤로
      const tip = handTip(), cap = capTop(), mid = tip.clone().lerp(cap, 0.5);
      const zIn = sstep(seg(t, S.slow0 - 0.2, S.slow0 + 0.5)), zOut = sstep(seg(t, S.slow1 - 0.35, S.crash - 0.4));
      const sideV = cam0.clone().sub(mid).setY(0).normalize().applyAxisAngle(V(0, 1, 0), 0.5), close = mid.clone().addScaledVector(sideV, HU * 0.8).add(V(0, -HU * 0.07, 0));
      const wideP = V(vw * 0.1, Y0 + vh * 0.55, D * 1.9), wideL = V(0, Y0 + vh * 1.2, -vh * 2.2);
      camP.copy(cam0).lerp(close, zIn).lerp(wideP, zOut); look.copy(look0).lerp(mid, zIn).lerp(wideL, zOut);
      fov = lerp(lerp(fov0, 24, zIn), 44, zOut);
      // 화면 위아래 검은 띠 (슬로모션)
      letter.style.opacity = String(zIn * (1 - zOut));
      // 파도
      if (t >= S.wave0) { wave.mesh.visible = true; at("wave", () => snd.wave()); const k = clamp((t - S.wave0) / (S.crash - S.wave0), 0, 1) * 1.6 + sstep(seg(t, S.crash - 0.2, S.under)) * 0.4, zc = lerp(-vh * 9, D * 1.2, eIn(seg(t, S.wave0, S.under)) * 0.7 + seg(t, S.wave0, S.under) * 0.3); wave.shape(k, zc, Y0 - 4, t); wave.U.uFoam.value = sstep(seg(t, S.crash - 0.4, S.under));
        shake = Math.max(shake, vh * 0.006 * sstep(seg(t, S.wave0 + 0.6, S.crash)));
        for (let i = 0; i < 6; i++) ctx.smoke.add({ p: V(rnd(-vw * 2, vw * 2), Y0 + vh * 1.55 * 1.25, zc + vh * 1.5 * 0.7 + rnd(-40, 40)), v: V(rnd(-60, 60), rnd(60, 220), rnd(150, 500)), g: -500, drag: 0.8, max: rnd(0.6, 1.3), s0: 50, s1: 260, a: 0.7, c: 0xf2f8fa, rot: rnd(0, 6), w: rnd(-1, 1) }); }
      if (t >= S.crash) at("crash", () => { snd.crash(); buzz([4, 60, 4, 90, 3]); });
      if (t >= S.crash - 0.05) { foamV.style.opacity = String(sstep(seg(t, S.crash - 0.05, S.crash + 0.22))); }
    }
    // ── 2) 물속: 화면 축소 · 다 떠오름 · 사카밤바스피스가 와서 삼킴 ──
    if (t >= S.under) {
      at("under", () => { wave.mesh.visible = false; scene.fog = new THREE.FogExp2(water, 1 / (vh * 16)); scene.background = water; ctx.sky.visible = false; ctx.hemi.color.set(0x9fdcff); ctx.hemi.groundColor.set(0x1c4a58); ctx.hemi.intensity = 1.3; ctx.sun.color.set(0xbfefff); ctx.sun.intensity = 1.6; ctx.fadeU.uNear.value = vh * 30; ctx.fadeU.uFar.value = vh * 60; shafts.visible = surf.visible = true; letter.style.opacity = "0"; snd.under();
        foamV.style.transition = "opacity 1.1s ease-out"; requestAnimationFrame(() => { foamV.style.opacity = "0"; }); ctx.chips.visible = false;
        for (let i = 0; i < 240; i++) bub.add({ p: V(rnd(-vw * 1.6, vw * 1.6), Y0 + rnd(0, vh * 2.4), rnd(-vh * 2, D * 1.6)), v: V(rnd(-60, 60), rnd(80, 260), rnd(-60, 60)), g: 120, drag: 1.2, max: rnd(1.5, 4.5), s0: rnd(6, 24), s1: rnd(10, 34), a: 0.9, c: 0xe8fbff, rot: 0, w: 0 }); });
      surf.material.uniforms.uT.value = t;
      // 떠다니기 (삼켜지기 전)
      const sw = sstep(seg(t, S.under, S.under + 1.2));
      if (t < S.gulp1) {
        if (!kimSink.on) { kimSink.on = true; kimSink.p = K.root.position.clone(); kimSink.r = K.root.rotation.clone(); }
        K.root.position.copy(kimSink.p).add(V(0, (MOUTH_AT.y - HU - kimSink.p.y) * sstep(seg(t, S.under, S.gulp0 - 0.3)), 0)); K.root.rotation.set(kimSink.r.x + 0.25 * sw * Math.sin(t * 0.7), kimSink.r.y + (t - S.under) * 0.25, kimSink.r.z + 0.2 * sw * Math.sin(t * 0.5)); floatPose(sw);
        if (face !== "a") setFace("a");
      }
      for (const e of eaten) { if (e.gone || e.inMouth) continue; if (e.kind !== "kim") { e.obj.position.addScaledVector(e.v, dt * sw); if (!e.ty) e.ty = MOUTH_AT.y + rnd(-vh * 0.9, vh * 0.5); e.obj.position.y += (e.ty - e.obj.position.y) * (1 - Math.exp(-dt * 0.55 * sw)); e.obj.rotation.x += e.w.x * dt * sw; e.obj.rotation.y += e.w.y * dt * sw; } }
      // 화면 축소: 아주 멀리 뒤로 · 위로
      const zo = eInOut(seg(t, S.out0, S.fish0 + 1.0));
      if (t < S.away0) { const far = MOUTH_AT.clone().addScaledVector(dirIn, vh * 3.4).add(V(-0.305, 0, 0.952).multiplyScalar(vh * 4.3)).add(V(0, -vh * 0.15, 0)), near0 = V(vw * 0.1, Y0 + vh * 0.75, D * 2.1); camP.copy(near0).lerp(far, zo); const lk = V(0, Y0 + vh * 0.5, 0).lerp(MOUTH_AT.clone().add(V(-vh * 0.6, vh * 0.35, -vh * 0.3)), zo); look.copy(lk); fov = lerp(44, 56, zo); if (t > S.fish0) { const fh = fishLocal(V(0.42, 0.02, 0)); look.lerp(fh, 0.45 * sstep(seg(t, S.fish0, S.gulp0)) * (1 - 0.6 * sstep(seg(t, S.gulp0, S.gulp1)))); } }
    }
    // 물고기
    if (t >= S.fish0 - 0.3 && !fishGone) {
      fish.visible = true; const sw2 = t; F.bendU.uPh.value = t * 5.2; F.bendU.uAmp.value = 0.035 + (t > S.away0 ? 0.015 : 0);
      if (t < S.inside) { const { p, d } = placeFish(Math.max(t, S.fish0 - 0.3) + (t < S.gulp0 ? 0 : 0)); }
      at("fishIn", () => snd.fish());
      // 빨아들임: 입 앞쪽 거리 안의 것은 입으로 끌려가며 작아짐
      if (t >= S.gulp0 - 0.9 && t < S.gulp1 + 0.6) { const mw = fishLocal(F.mouth); for (const e of eaten) { if (e.gone) continue; const wp = e.obj.getWorldPosition(V()); const d = wp.distanceTo(mw); if (!e.inMouth && d < vh * 3.4) { e.inMouth = true; e.t0 = t; e.from = wp.clone(); e.sc = e.obj.scale.clone(); } if (e.inMouth) { const k = eIn(seg(t, e.t0, e.t0 + 0.55)); const p = e.from.clone().lerp(mw, k); e.obj.parent.worldToLocal(p); e.obj.position.copy(p); e.obj.scale.copy(e.sc).multiplyScalar(1 - k * 0.97); e.obj.rotation.z += dt * 4; if (k >= 1) { e.gone = true; e.obj.visible = false; } } }
        // 사람
        const kp = K.root.getWorldPosition(V()), dk = kp.distanceTo(mw); if (!kimSink.in && dk < vh * 3.6) { kimSink.in = true; kimSink.t0 = t; kimSink.from = kp.clone(); snd.gulp(); }
        if (kimSink.in && !kimSink.gone) { const k = eIn(seg(t, kimSink.t0, kimSink.t0 + 0.6)); K.root.position.copy(kimSink.from).lerp(mw, k); K.root.scale.setScalar(HU * (1 - 0.97 * k)); if (k >= 1) { kimSink.gone = true; K.root.visible = false; } }
        if (Math.random() < 0.8) for (let i = 0; i < 3; i++) bub.add({ p: mw.clone().add(V(rnd(-vh, vh), rnd(-vh * 0.6, vh * 0.6), rnd(-vh, vh)).multiplyScalar(1.4)), v: mw.clone().sub(V()).multiplyScalar(0), g: 140, drag: 2, max: rnd(0.4, 1), s0: 12, s1: 4, a: 0.9, c: 0xe8fbff }); }
      if (t >= S.gulp1 - 0.3) at("gulpEnd", () => { snd.gulp(); for (const e of eaten) { e.gone = true; e.obj.visible = false; } kimSink.gone = true; K.root.visible = false; });
    }
    // ── 3) 헤엄쳐 감 → 카메라가 배 쪽으로 가서 배 안으로 ──
    if (t >= S.away0 && t < S.inside) {
      const a = eInOut(seg(t, S.away0, S.belly0)), b = eInOut(seg(t, S.belly0, S.inside));
      // 카메라는 물고기를 따라 돌며 아래쪽 옆에서 배를 봄
      const side = fishLocal(V(0.02, -0.08, 0.95)), under = fishLocal(V(0.06, -0.22, 0.5)), skin = fishLocal(V(0.08, -0.05, 0.17)), inner = fishLocal(V(0.08, -0.04, 0.07));
      const pA = camP.clone();
      if (t < S.belly0) { camP.lerp(side, a * 0.85); look.lerp(fishLocal(V(0.05, 0, 0)), a); fov = lerp(fov, 46, a); }
      else { if (!ctx._pb) ctx._pb = camP.clone(); camP.copy(ctx._pb).lerp(under, sstep(seg(b, 0, 0.45))).lerp(skin, sstep(seg(b, 0.4, 0.75))).lerp(inner, sstep(seg(b, 0.72, 1))); look.copy(fishLocal(V(0.08, -0.06, 0))); fov = lerp(46, 58, b); redV.style.opacity = String(sstep(seg(b, 0.55, 0.72)) * (1 - sstep(seg(b, 0.82, 1)))); }
      if (b > 0.68) at("enter", () => { F.stomach.visible = true; F.stomach.userData.lamp.intensity = 4; F.stomach.userData.lamp2.intensity = 2.2; snd.enter(); });
    }
    // ── 4) 배 속 ──
    if (t >= S.inside && t < S.launch) {
      at("inside", () => { F.stomach.visible = true; scene.fog = new THREE.FogExp2(0x3a0a10, 1 / (vh * 3.2)); scene.background = new THREE.Color(0x2a0508); fish.traverse(q => { if (q.isMesh && q.material === F.mat) q.visible = false; }); F.eyes.forEach(e => e.visible = false); shafts.visible = surf.visible = false; ctx.ground.visible = false; ctx.hemi.color.set(0xff9a90); ctx.hemi.groundColor.set(0x40080c); ctx.hemi.intensity = 0.8; ctx.sun.intensity = 0.25;
        // 사람·삼킨 것들을 배 속에 둠
        F.stomach.add(K.root); K.root.visible = true; K.root.scale.setScalar(KSIN); K.root.rotation.set(0, -0.35, 0); K.root.position.set(-0.02, F.stomach.userData.juiceY - 0.0005, 0.02); setFace("b");
        for (const e of eaten) { if (e.kind !== "brick" || Math.random() > 0.35) continue; F.stomach.add(e.obj); e.obj.visible = true; e.obj.scale.copy(e.s0).multiplyScalar(1 / L); const a = rnd(0, 6.28), r = rnd(0.03, 0.15); e.obj.position.set(Math.cos(a) * r, F.stomach.userData.juiceY + rnd(0.0, 0.02), Math.sin(a) * r * 0.6); e.obj.rotation.set(rnd(-1.6, -1.4), 0, rnd(0, 6)); e.float = rnd(0, 6); }
        con.visible = true; F.stomach.add(con); con.scale.setScalar(KSIN); con.position.set(-0.07, F.stomach.userData.juiceY - 0.004, -0.03); con.rotation.set(0.3, 0.6, 1.25);
        K.root.add(BB.g); BB.g.scale.setScalar(0); BB.g.visible = false; snd.gurgle(); });
      fish.updateMatrixWorld(true); F.stomach.updateMatrixWorld(true);
      for (const e of eaten) if (e.float !== undefined) { e.obj.position.y = F.stomach.userData.juiceY + 0.002 * Math.sin(t * 1.3 + e.float); }
      // 위액 일렁임 · 조명 꿈틀
      F.stomach.userData.lamp.intensity = 4 + 0.6 * Math.sin(t * 2.1); F.stomach.scale.setScalar(1 + 0.012 * Math.sin(t * 1.4));
      // 사람: 안경(3초) → 원래 표정 → 주머니 → 거대 버튼 → 꾹
      const loc = p => K.root.worldToLocal(F.stomach.localToWorld(p.clone()));
      const gl = K.toRoot(K.B.head, K.wristB);
      let W = V(-0.285, 0.815, 0.06), opts = {}; const g1 = S.inside + 0.2;
      if (t < S.glass1) { setFace(t < S.glass1 - 0.05 && t > g1 - 0.15 ? "b" : "a"); const w = eInOut(seg(t, S.inside, g1)) * (1 - eInOut(seg(t, S.glass1 - 0.2, S.glass1 + 0.15))); W.lerp(gl, w); opts = { pole: V(-1, -0.7, 0.1), f: [0.3, 0.42, 0.22] }; if (face === "b") W.add(V(0.004 * Math.sin(t * 17), 0.003 * Math.sin(t * 11), 0)); }
      else if (t < S.pocket1) { setFace("a");
        // 주머니(오른쪽 허리) → 꺼내며 들어 올림
        const pk = V(-0.2, 0.86, 0.06), upH = V(-0.32, 1.25, 0.45);
        const a1 = eInOut(seg(t, S.glass1 + 0.15, S.pocket0)), a2 = eOut(seg(t, S.pocket0 + 0.25, S.pocket1 - 0.25));
        W = V(-0.285, 0.815, 0.06).lerp(pk, a1).lerp(upH, a2); opts = { pole: V(-0.9, -0.6, -0.2), f: [0.85, 0.7, 0.8] };
        if (t >= S.pocket0) at("pop", () => { snd.pop(); BB.g.visible = true; });
        if (BB.g.visible) { if (BB.g.parent !== K.root) K.root.add(BB.g); const gs = 0.03 + (BBS - 0.03) * eOut(seg(t, S.pocket0, S.pocket1 - 0.1)); K.sync(); const hw = K.root.worldToLocal(K.B.handR.localToWorld(V(0, -0.09, 0.02))); const land = sstep(seg(t, S.pocket1 - 0.3, S.pocket1));
          BB.g.position.copy(hw.clone().add(V(-0.55 * gs, -0.3 * gs, 0.05 * gs))).lerp(BSPOT, land); BB.g.scale.setScalar(gs); BB.g.rotation.set(0.5 * (1 - land), 0.8 * (1 - land), 0.2 * (1 - land)); if (land >= 1) at("land", () => { snd.thud(); shake = vh * 0.006; buzz([3, 50, 2]); for (let i = 0; i < 40; i++) bub.add({ p: K.root.localToWorld(BSPOT.clone().add(V(rnd(-1.5, 1.5), 0.05, rnd(-1.2, 1.2)))), v: V(rnd(-20, 20), rnd(20, 60), rnd(-20, 20)), g: 60, drag: 1.5, max: rnd(0.8, 1.8), s0: 3, s1: 6, a: 0.8, c: 0xfff2b0 }); }); }
      } else { setFace("a");
        BB.g.position.copy(BSPOT); BB.g.rotation.set(0, 0, 0); BB.g.scale.setScalar(BBS);
        const top = V(BSPOT.x + 0.48, BBS * 0.58 + BBS * 0.231 * Math.sqrt(1 - Math.pow(0.48 / (0.42 * BBS), 2)), BSPOT.z), hi = top.clone().add(V(0.1, 0.55, 0)), dn = top.clone().add(V(0, 0.02, 0));
        const jt = seg(t, S.pocket1 + 0.45, S.press), crouch = Math.sin(Math.PI * seg(t, S.pocket1 + 0.1, S.pocket1 + 0.5)) * (t < S.pocket1 + 0.45 ? 1 : 0), land = Math.sin(Math.PI * seg(t, S.press, S.press + 0.3));
        const capTop = BBS * (0.58 + 0.231 * 0.82), tgt = V(BSPOT.x + 0.1, capTop - 0.02, BSPOT.z - 0.05);
        opts.off = V(tgt.x * sstep(jt), lerp(0, tgt.y, jt) + 0.75 * Math.sin(Math.PI * jt) - 0.14 * crouch - 0.1 * land, tgt.z * sstep(jt)); opts.tuck = Math.sin(Math.PI * jt) * 0.9;
        const raise = eOut(seg(t, S.pocket1, S.press - 0.25)), hit = eIn(seg(t, S.press - 0.25, S.press)), back = eInOut(seg(t, S.press + 0.35, S.press + 0.9));
        const fl = Math.sin(t * 9) * 0.06, up2 = sstep(seg(t, S.pocket1 + 0.3, S.pocket1 + 0.6)); W = V(-0.285, 0.815, 0.06).lerp(V(-0.5, 1.75 + fl, 0.15), up2).add(opts.off); Object.assign(opts, { pole: V(-0.75, -0.3, -0.6), f: [0.2, 0.3, 0.1], L: V(0.285, 0.815, 0.06).lerp(V(0.5, 1.75 - fl, 0.15), up2).add(opts.off) });
        if (t >= S.press) at("press2", () => { snd.click(); snd.alarm(); buzz([3, 60, 2]); shake = vh * 0.004; });
        const on = t > S.press; BB.cap.scale.y = 0.55 * (on ? lerp(0.55, 0.8, sstep(seg(t, S.press + 0.15, S.press + 0.6))) : 1); BB.lamps.forEach(m => m.emissiveIntensity = on ? (Math.sin(t * 20) > 0 ? 4 : 0.2) : 0); BB.mR.emissiveIntensity = on ? (Math.sin(t * 20) > 0 ? 1.8 : 0.5) : 0.5;
        F.stomach.userData.lamp2.color.set(on && Math.sin(t * 20) > 0 ? 0xff3020 : 0xffe0c0); }
      pose(W, opts);
      // 카메라: 사람 앞쪽에서 (배 속, 위액 위)
      const kc = F.stomach.localToWorld(V(-0.02, F.stomach.userData.juiceY, 0.02)), toCam = F.stomach.localToWorld(V(0.075, F.stomach.userData.juiceY + 0.028, 0.09));
      const enter = sstep(seg(t, S.inside, S.inside + 1.2)), wideB = sstep(seg(t, S.pocket0 - 0.5, S.pocket0 + 0.5)) * (1 - sstep(seg(t, S.press + 0.6, S.launch)) * 0);
      const jt2 = sstep(seg(t, S.pocket1, S.press)), head = kc.clone().add(V(0, HU * 1.6, 0)), body = kc.clone().add(V(-HU * (0.55 + 0.5 * jt2), HU * (1.0 + 0.9 * jt2), 0));
      const pClose = head.clone().add(toCam.clone().sub(kc).setY(0).normalize().multiplyScalar(HU * 1.25)).add(V(0, -HU * 0.02, 0)), pWide = body.clone().add(toCam.clone().sub(kc).setY(0).normalize().multiplyScalar(HU * (4.2 + 0.9 * jt2))).add(V(0, HU * 0.3, 0));
      camP.lerp(pClose, enter).lerp(pWide, wideB); if (t >= S.inside + 1.2) camP.copy(pClose).lerp(pWide, wideB);
      look.copy(head).lerp(body, wideB); fov = lerp(fov, 40, enter);
    }
    // ── 5) 탄도미사일 추격 → 명중 → 폭발 ──
    if (t >= S.launch) {
      at("launch", () => { redV.style.opacity = "0"; F.stomach.visible = false; fish.traverse(q => { if (q.isMesh) q.visible = true; }); F.eyes.forEach(e => e.visible = true); scene.fog = new THREE.FogExp2(water, 1 / (vh * 48)); scene.background = water; shafts.visible = surf.visible = true; ctx.ground.visible = true; ctx.hemi.color.set(0x9fdcff); ctx.hemi.groundColor.set(0x1c4a58); ctx.hemi.intensity = 1.3; ctx.sun.intensity = 1.6;
        LP.forEach(([l]) => l.intensity = 0); ctx.mis.visible = true; ctx.glare.visible = true; ctx.mis.scale.setScalar(MSZ); snd.whistle(S.hit - S.launch); surf.position.y = SURF2; });
      // 물고기: 넓은 바다에서 이리저리 피하며 헤엄
      const k = t - S.launch, fp = V(Math.sin(k * 0.42) * vh * 8 + k * vh * 7.5, Y0 + vh * 18 + Math.sin(k * 0.9) * vh * 1.6, -vh * 20 - k * vh * 2 + Math.sin(k * 0.6) * vh * 6), fd = V(Math.cos(k * 0.42) * 0.42 * 8 + 7.5, Math.cos(k * 0.9) * 0.9 * 1.6, -2 + Math.cos(k * 0.6) * 0.6 * 6).normalize();
      if (!fishGone) { const yaw = Math.atan2(-fd.z, fd.x), pitch = Math.asin(clamp(fd.y, -1, 1)); fish.quaternion.setFromEuler(new THREE.Euler(0, yaw, pitch, "YZX")); fish.position.copy(fp); fish.updateMatrixWorld(true); F.bendU.uPh.value = t * 7.5; F.bendU.uAmp.value = 0.05; }
      // 미사일: 아주 먼 곳에서 와서 꼬리를 쫓다가 꽂힘
      const hk = clamp((t - S.launch) / (S.hit - S.launch), 0, 1), tail = fishLocal(V(-0.1, 0.0, 0.0)), start = V(-vh * 70, Y0 + vh * 30, -vh * 75);
      const lag = (1 - eIn(hk)) * L * 2.6, chase = tail.clone().addScaledVector(fd, -lag).add(V(Math.sin(t * 1.3) * L * 0.12 * (1 - hk), Math.sin(t * 1.1) * L * 0.06 * (1 - hk), 0));
      const pP = start.clone().lerp(chase, sstep(seg(hk, 0, 0.3)));
      if (!fishGone) { misLast.copy(misP.lengthSq() ? misP : pP); misP.copy(pP); const dd = misP.clone().sub(misLast); if (dd.lengthSq() > 1) misD.lerp(dd.normalize(), 0.3).normalize(); ctx.mis.position.copy(misP); ctx.mis.lookAt(misP.clone().add(misD)); ctx.mis.rotateZ(t * 5); ctx.glare.position.copy(misP).addScaledVector(misD, -MSZ * 0.52); ctx.glare.scale.setScalar(MSZ * rnd(0.4, 0.6)); ctx.plume.scale.set(rnd(0.9, 1.2), rnd(0.9, 1.2), rnd(0.85, 1.25));
        const n = 10; for (let i = 0; i < n; i++) { const sp = misLast.clone().lerp(misP, i / n).addScaledVector(misD, -MSZ * 0.55); bub.add({ p: sp.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(L * 0.012)), v: V(rnd(-40, 40), rnd(40, 160), rnd(-40, 40)), g: 160, drag: 0.8, max: rnd(1.6, 3.2), s0: L * 0.008, s1: L * rnd(0.012, 0.03), a: 0.85, c: 0xeefcff }); ctx.smoke.add({ p: sp.clone(), v: V(rnd(-30, 30), rnd(10, 60), rnd(-30, 30)), drag: 0.6, max: rnd(2, 3.5), s0: L * 0.02, s1: L * rnd(0.06, 0.1), a: 0.35, c: 0xd8eef4, rot: rnd(0, 6), w: rnd(-0.4, 0.4) }); } }
      // 카메라 연출: 먼 미사일 (물고기 뒤로 먼 데서 다가옴) → 나란히 따라감 → 명중 직전 앞에서
      if (!fishGone) {
        const c1 = sstep(seg(t, S.launch, S.launch + 0.6)), c2 = sstep(seg(t, S.launch + 2.6, S.launch + 3.4)), c3 = sstep(seg(t, S.hit - 1.6, S.hit - 1.0));
        const behindFish = fishLocal(V(0.95, 0.12, 0.35)), lookFar = misP.clone().lerp(fishLocal(V(0, 0, 0)), 0.15);
        // 옆에서 나란히: 물고기와 미사일이 늘 화면에 같이 들어오게 둘 사이 거리와 화면 비율로 물러날 거리를 정함
        const mid = fp.clone().lerp(misP, 0.5), sep = fp.distanceTo(misP), tanH = Math.tan(THREE.MathUtils.degToRad(50) / 2) * Math.min(1, vw / vh), dist = (sep * 0.5 + L * 0.62) / tanH;
        // 세로 화면은 옆에서 찍으면 너무 작아져서, 미사일 뒤 조금 위에서 앞의 물고기를 쫓는 시점으로
        const sideBoth = vw / vh > 0.8 ? mid.clone().add(fd.clone().cross(up).normalize().multiplyScalar(-dist)).add(V(0, dist * 0.12, 0)) : misP.clone().addScaledVector(fd, -L * 1.5).add(V(0, L * 0.45, 0)).add(fd.clone().cross(up).normalize().multiplyScalar(-L * 0.3));
        const front = fishLocal(V(0.6, 0.12, 0.42)).add(V(0, 0, 0));
        camP.lerp(behindFish, c1); look.lerp(lookFar, c1); if (c2 > 0) { camP.lerp(sideBoth, c2); look.lerp(vw / vh > 0.8 ? mid : fp.clone().lerp(misP, 0.3), c2); } if (c3 > 0) { camP.lerp(front, c3); look.lerp(fishLocal(V(-0.45, 0, 0)).lerp(misP, 0.3), c3); }
        fov = lerp(fov, 50, 0.05); shake = Math.max(shake, vh * 0.002 * hk * hk);
      }
      if (t >= S.hit && !fishGone) { fishGone = true; hitPos.copy(fishLocal(V(-0.2, 0, 0))); explode(); }
      if (fishGone) after(t - S.hit, dt);
    }
    // 입자
    bub.step(dt); boomP.step(dt); soot.step(dt);
    // 카메라 적용 (물속에서는 수면 위로 안 나감)
    if (t >= S.under) camP.y = Math.min(camP.y, surf.position.y - vh * 1.5);
    shake *= Math.exp(-dt * 2.4); const sh = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake);
    const zf = (t >= S.launch && !fishGone) ? Math.min(ZF, 1.15) : t < S.slow1 ? 1 + (ZF - 1) * 0.4 : (t >= S.inside && t < S.launch) ? Math.min(ZF, 1.12) : ZF; cam.position.copy(look).add(camP.clone().sub(look).multiplyScalar(zf)).add(sh); cam.up.set(0, 1, 0); cam.lookAt(look.clone().add(sh.multiplyScalar(0.6))); if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); } cam.updateMatrixWorld(true);
    ctx.sky.position.copy(cam.position); ctx.fadeU.uCam.value.copy(cam.position); shafts.position.x = cam.position.x * 0.9; shafts.position.z = cam.position.z * 0.9; surf.position.x = cam.position.x; surf.position.z = cam.position.z;
    if (F.stomach.visible) { F.stomach.updateMatrixWorld(true); for (const [l, p] of LP) l.position.copy(F.stomach.localToWorld(p.clone())); }
    if (!noRender && X.mine("nuke")) { renderer.autoClear = true; cam.layers.enableAll(); renderer.render(scene, cam); }
    if (t >= S.end) { cleanup(); return true; }
    return false;
  }
  // 폭발: 물고기 조각 · 사람 · 거대 버튼 · 벽돌 · 눈알이 사방으로
  function explode() {
    snd.boom(); buzz([3, 80, 3, 120, 3, 160, 2, 220, 2, 300, 1]); ctx.mis.visible = ctx.glare.visible = false; shake = vh * 0.05;
    ctx.flash.style.transition = "none"; ctx.flash.style.opacity = "1"; requestAnimationFrame(() => requestAnimationFrame(() => { ctx.flash.style.transition = "opacity 1.6s cubic-bezier(.2,.7,.3,1)"; ctx.flash.style.opacity = "0"; }));
    fish.updateMatrixWorld(true); const M = fish.matrixWorld.clone(), qW = fish.getWorldQuaternion(new THREE.Quaternion());
    const parts = PRE; chunks = [];
    for (const { m, c } of parts) { const g = new THREE.Group(); scene.add(g); g.layers.set(FG); m.layers.set(FG); g.add(m); m.position.set(0, 0, 0); g.position.copy(c.clone().applyMatrix4(M)); g.quaternion.copy(qW); g.scale.setScalar(L);
      const d = g.position.clone().sub(hitPos), dl = d.length(); d.normalize(); const sp = vh * rnd(4, 16) * clamp(1.3 - dl / L, 0.35, 1.3);
      chunks.push({ g, v: d.multiplyScalar(sp).add(V(0, vh * rnd(0, 3), 0)), w: V(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)), fire: Math.random() < 0.5 }); }
    // 눈알 · 입은 따로 날아감
    for (const e of F.eyes) { const wp = e.getWorldPosition(V()); scene.attach(e); chunks.push({ g: e, v: wp.sub(hitPos).normalize().multiplyScalar(vh * 12).add(V(0, vh * 4, 0)), w: V(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)), fire: true }); }
    fish.visible = false;
    // 사람과 거대 버튼, 벽돌들도 밖으로
    for (const o of [K.root, BB.g, con]) { scene.attach(o); o.visible = true; o.layers.set(FG); o.traverse(q => q.layers.set(FG)); }
    K.root.scale.setScalar(HU * 7); BB.g.scale.setScalar(HU * 7 * 1.5); con.scale.setScalar(HU * 7); setFace("a");
    for (const o of [K.root, BB.g, con]) { o.position.copy(hitPos).add(V(rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1)).multiplyScalar(L * 0.1)); const toC = cam.position.clone().sub(hitPos).normalize(); chunks.push({ g: o, v: (o === K.root ? toC.clone().add(V(0.25, 0.35, 0)) : V(rnd(-1, 1), rnd(0.3, 1), rnd(-0.3, 1))).normalize().multiplyScalar(vh * (o === K.root ? 9 : rnd(8, 12))), w: o === K.root ? V(2.4, 1.2, 0.6) : V(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)), kim: o === K.root }); }
    for (const e of eaten) if (e.kind === "brick") { scene.attach(e.obj); e.obj.visible = true; e.obj.layers.set(FG); e.obj.scale.copy(e.s0).multiplyScalar(2.4); e.obj.position.copy(hitPos).add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(L * 0.12)); chunks.push({ g: e.obj, v: V(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize().multiplyScalar(vh * rnd(5, 18)), w: V(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)) }); }
    // 불덩이·거품막·빛
    fireBall.visible = shell.visible = true; fireBall.position.copy(hitPos); shell.position.copy(hitPos); boomL.position.copy(hitPos); boomL.intensity = 400;
    for (let i = 0; i < 220; i++) { const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); boomP.add({ p: hitPos.clone().addScaledVector(d, L * rnd(0, 0.08)), v: d.multiplyScalar(vh * rnd(2, 9)), drag: 1.6, max: rnd(0.7, 2.0), s0: L * 0.05, s1: L * rnd(0.12, 0.3), a: 0.9, c: [0xffd27a, 0xff8a3a, 0xff5a20][i % 3], rot: rnd(0, 6), w: rnd(-1, 1), fo: 1.8 }); }
    for (let i = 0; i < 160; i++) { const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); soot.add({ p: hitPos.clone().addScaledVector(d, L * rnd(0.05, 0.2)), v: d.multiplyScalar(vh * rnd(1, 4)).add(V(0, vh * 0.6, 0)), drag: 1.1, max: rnd(2.4, 5), s0: L * 0.06, s1: L * rnd(0.25, 0.5), a: 0.55, c: 0x3a3532, rot: rnd(0, 6), w: rnd(-0.6, 0.6) }); }
    for (let i = 0; i < 500; i++) { const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); bub.add({ p: hitPos.clone().addScaledVector(d, L * rnd(0.05, 0.3)), v: d.multiplyScalar(vh * rnd(2, 10)), g: 400, drag: 1.4, max: rnd(1.5, 4), s0: L * rnd(0.004, 0.012), s1: L * rnd(0.01, 0.03), a: 0.9, c: 0xf2feff }); }
    for (let i = 0; i < 260; i++) ctx.spark.add({ p: hitPos.clone(), v: V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(vh * rnd(4, 16)), g: -vh * 2, drag: 1.2, max: rnd(0.5, 1.6), s0: rnd(10, 26), s1: 0, a: 1, c: 0xffe2a0 });
    // 살점 잔조각 (instanced chips 재사용: 살색·껍질색)
    ctx.chips.visible = true; const cc = new THREE.Color(); ctx.CH.forEach((c, i) => { const d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); c.p.copy(hitPos).addScaledVector(d, L * rnd(0, 0.15)); c.v.copy(d).multiplyScalar(vh * rnd(3, 14)); c.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); c.w.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14)); const s = L * rnd(0.004, 0.014); c.s.set(s, s * rnd(0.4, 1), s * rnd(0.6, 1.6)); ctx.chips.setColorAt(i, cc.set([0x9a3028, 0xb04038, 0x8f877a, 0xa89f8c, 0xe8d8c0, 0x6a2018][i % 6])); }); ctx.chips.instanceColor.needsUpdate = true;
    // 카메라: 폭발을 멀찍이
    ctx._ex = { p: cam.position.clone().sub(hitPos).normalize().multiplyScalar(L * 1.35).add(hitPos).add(V(0, L * 0.08, 0)), q: cam.position.clone().sub(hitPos).normalize().multiplyScalar(L * 2.1).add(hitPos).add(V(0, L * 0.18, 0)) };
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
  function after(s, dt) {
    const fb = eOut(seg(s, 0, 0.9)); fireBall.scale.setScalar(L * (0.05 + 0.32 * fb)); fireMat.uniforms.uA.value = 0.95 * Math.exp(-s * 0.9); fireMat.uniforms.uT.value = s; fireMat.uniforms.uHeat.value = Math.exp(-s * 1.2);
    const sb = eOut(seg(s, 0, 1.1)); shell.scale.setScalar(L * (0.08 + 0.9 * sb)); shellMat.opacity = 0.2 * Math.pow(1 - sb, 2) * Math.min(1, s * 8); shell.visible = sb < 0.999;
    boomL.intensity = 400 * Math.exp(-s * 1.2);
    for (const c of chunks) { c.v.multiplyScalar(Math.exp(-(c.kim ? 0.9 : 1.3) * dt)); c.v.y -= vh * 0.5 * dt; c.g.position.addScaledVector(c.v, dt); c.g.rotation.x += c.w.x * dt; c.g.rotation.y += c.w.y * dt; c.g.rotation.z += c.w.z * dt;
      if (c.fire && Math.random() < 0.5 && s < 2.5) soot.add({ p: c.g.position.clone(), v: V(rnd(-20, 20), rnd(20, 60), rnd(-20, 20)), drag: 1, max: rnd(1, 2), s0: L * 0.01, s1: L * rnd(0.03, 0.06), a: 0.4, c: 0x45403c, rot: rnd(0, 6), w: rnd(-1, 1) });
      if (Math.random() < 0.25) bub.add({ p: c.g.position.clone(), v: V(rnd(-20, 20), rnd(40, 90), rnd(-20, 20)), g: 200, drag: 1, max: rnd(0.8, 1.6), s0: L * 0.004, s1: L * 0.008, a: 0.8, c: 0xf2feff }); }
    if (K.root.visible) { floatPose(1); }
    if (ctx.chips.visible) { for (let i = 0; i < ctx.CH.length; i++) { const c = ctx.CH[i]; c.v.multiplyScalar(Math.exp(-1.2 * dt)); c.v.y -= vh * 0.4 * dt; c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt); ctx.chips.setMatrixAt(i, m4.compose(c.p, q4.setFromEuler(e4.set(c.r.x, c.r.y, c.r.z)), c.s)); } ctx.chips.instanceMatrix.needsUpdate = true; }
    camP.lerp(s < 1.2 ? ctx._ex.p : ctx._ex.q, 1 - Math.exp(-dt * (s < 1.2 ? 5 : 0.8))); look.lerp(hitPos, 1 - Math.exp(-dt * 4)); fov = lerp(fov, 56, 1 - Math.exp(-dt * 2));
    if (s > S.end - S.hit - 1.6) ctx.fade.style.opacity = String(seg(s, S.end - S.hit - 1.6, S.end - S.hit));
  }
  function cleanup() { ended = true; scene.fog = null; foamV.remove(); redV.remove(); letter.remove(); }
  async function warm() {
    const vis = []; scene.traverse(o => { vis.push([o, o.visible]); o.visible = true; }); const lay = cam.layers.mask; cam.layers.enableAll(); const f0 = scene.fog;
    try { for (const fog of [null, new THREE.FogExp2(water, 1 / (vh * 16))]) { scene.fog = fog; if (renderer.compileAsync) await renderer.compileAsync(scene, cam); else renderer.compile(scene, cam); } } catch (e) {}
    // 그림(텍스처)도 미리 올려 둠 (처음 쓰일 때 잠깐 멈추지 않게)
    const seen = new Set(); scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { for (const k of ["map", "emissiveMap", "bumpMap"]) { const tx = m[k] || (m.uniforms && m.uniforms[k] && m.uniforms[k].value); if (tx && tx.isTexture && !seen.has(tx)) { seen.add(tx); try { renderer.initTexture(tx); } catch (e) {} } } }); });
    scene.fog = f0; cam.layers.mask = lay; for (const [o, v] of vis) o.visible = v; dummy.removeFromParent();
  }
  return { step, warm, get t() { return t; }, jump(x) { t = x; } };
}

// ── 소리 ──
function sakaSound(get) {
  const A = () => get && get();
  const noise = (a, t, type, f0, f1, q, gain, att, dur) => { const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain(); s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); };
  const tone = (a, t, type, f0, f1, gain, att, dur) => { const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.out); o.start(t); o.stop(t + dur + 0.05); };
  const W = fn => (...a) => { const x = A(); if (x) fn(x, x.c.currentTime, ...a); };
  return {
    slow: W((a, t) => { tone(a, t, "sine", 180, 60, 0.25, 0.3, 1.8); noise(a, t, "lowpass", 400, 120, 0.7, 0.2, 0.3, 1.8); tone(a, t + 0.2, "sine", 55, 50, 0.25, 0.2, 1.6); }),
    wave: W((a, t) => { noise(a, t, "lowpass", 300, 1800, 0.6, 0.55, 1.6, 2.2); noise(a, t, "bandpass", 600, 2400, 0.8, 0.35, 1.6, 2.2); }),
    crash: W((a, t) => { noise(a, t, "lowpass", 2200, 120, 0.6, 1, 0.01, 2.2); tone(a, t, "sine", 70, 30, 0.8, 0.01, 1.2); noise(a, t, "highpass", 3000, 1200, 0.6, 0.5, 0.01, 1.2); }),
    under: W((a, t) => { noise(a, t, "lowpass", 260, 140, 0.8, 0.3, 0.3, 5); for (let i = 0; i < 14; i++) tone(a, t + rnd(0, 3), "sine", rnd(500, 900), rnd(1100, 1800), 0.04, 0.005, 0.07); }),
    fish: W((a, t) => { tone(a, t, "sine", 60, 40, 0.4, 0.8, 3.5); noise(a, t, "lowpass", 160, 90, 0.8, 0.35, 1.5, 3.5); }),
    gulp: W((a, t) => { tone(a, t, "sine", 220, 60, 0.6, 0.01, 0.35); noise(a, t, "lowpass", 600, 150, 1, 0.5, 0.01, 0.4); for (let i = 0; i < 6; i++) tone(a, t + 0.1 + i * 0.05, "sine", rnd(300, 600), rnd(800, 1300), 0.06, 0.005, 0.06); }),
    enter: W((a, t) => { noise(a, t, "lowpass", 500, 90, 1, 0.5, 0.05, 1.2); tone(a, t, "sine", 90, 50, 0.4, 0.05, 1.0); }),
    gurgle: W((a, t) => { for (let i = 0; i < 10; i++) { const s = t + i * 0.55 + rnd(0, 0.3); tone(a, s, "sine", rnd(70, 110), rnd(40, 60), 0.18, 0.05, 0.5); noise(a, s, "bandpass", rnd(200, 400), rnd(100, 200), 2, 0.12, 0.05, 0.4); } }),
    pop: W((a, t) => { tone(a, t, "sine", 400, 1400, 0.3, 0.005, 0.18); noise(a, t, "bandpass", 1800, 600, 2, 0.3, 0.003, 0.15); tone(a, t + 0.15, "triangle", 200, 90, 0.3, 0.02, 0.8); }),
    thud: W((a, t) => { tone(a, t, "sine", 110, 38, 0.7, 0.004, 0.35); noise(a, t, "lowpass", 900, 180, 0.8, 0.55, 0.004, 0.3); }),
    click: W((a, t) => { noise(a, t, "bandpass", 1800, 1200, 3, 0.65, 0.001, 0.05); tone(a, t, "sine", 260, 110, 0.45, 0.002, 0.12); }),
    alarm: W((a, t) => { for (let i = 0; i < 6; i++) { tone(a, t + i * 0.46, "square", 880, 880, 0.07, 0.01, 0.22); tone(a, t + i * 0.46 + 0.23, "square", 620, 620, 0.07, 0.01, 0.22); } }),
    whistle: W((a, t, d) => { tone(a, t, "sine", 1400, 300, 0.1, d * 0.85, d); noise(a, t, "lowpass", 200, 900, 0.8, 0.45, d * 0.8, d); noise(a, t, "bandpass", 300, 1200, 1.5, 0.25, d * 0.9, d); }),
    boom: W((a, t) => { tone(a, t, "sine", 72, 16, 1, 0.005, 4.5); tone(a, t, "triangle", 42, 18, 0.8, 0.02, 5); noise(a, t, "lowpass", 2400, 36, 0.7, 1, 0.004, 5.5); for (const d of [0.4, 1.0, 1.8, 2.8]) noise(a, t + d, "lowpass", 380, 46, 0.7, 0.5 / (1 + d * 0.45), 0.12, 2.4); for (let i = 0; i < 30; i++) tone(a, t + rnd(0.2, 3), "sine", rnd(300, 800), rnd(900, 1600), 0.03, 0.005, 0.08); }),
  };
}
