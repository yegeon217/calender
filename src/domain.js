// 영역전개: 짓누르기에서 쇠공을 박살 낸 뒤 "다음"
// 두 손이 올라와 인(印)을 맺음 → 어둠이 번지며 "료이키 텐카이" → 1초 뒤 땅이 울리고 바닥의 쇠 파편이 떠오름
// → 인을 풀고 손가락으로 허공을 휘저어 회오리를 일으킴 → 위로 쳐올려 회오리째 날려 버림 → 어둠이 걷히며 달력으로
// 모든 움직임은 시작 후 지난 시간 t 하나로 정해짐 (중간으로 건너뛰어도 같은 장면).
// 손 좌표는 crush.js와 같음(+y 손가락, +z 손바닥, +x 엄지). 왼손은 오른손 모델을 좌우로 뒤집은 거울 속에 있어서
// 왼손에 주는 위치·회전은 "거울 속 오른손" 기준 → 양손에 같은 값을 주면 좌우 대칭.
import * as THREE from "three";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V, buzz, radialTex } from "./fx-util.js";

// ── 순서 (다음을 누른 뒤 초) ──
const T = { seal: 1.0 };
T.text = T.seal + 0.14;       // 인을 맺자마자 글자
T.rumble = T.text + 1.0;      // 1초 뒤 땅울림
T.lift = T.rumble + 0.3;      // 파편이 떠오르기 시작
T.release = T.lift + 1.45;    // 인을 풂
T.vortex = T.release + 0.25;  // 손가락으로 휘저어 회오리
T.launch = T.vortex + 2.0;    // 쳐올려 날려 버림
T.retract = T.launch + 0.9;   // 어둠이 걷힘
T.end = T.retract + 0.95;

// ── 손가락 자세: 관절마다 [x 굽힘(음수 = 손바닥 쪽), y 벌림, z 비틀림] ──
const fg = (p, i, d, s = 0) => [[0, 0, 0], [p, s, 0], [i, 0, 0], [d, 0, 0]];
const FIST = { middle: fg(-1.5, -1.75, -1.1), ring: fg(-1.55, -1.75, -1.1), pinky: fg(-1.6, -1.7, -1.05) };
const POSE = {
  relax: { index: fg(-0.25, -0.3, -0.15, 0.05), middle: fg(-0.3, -0.32, -0.15), ring: fg(-0.35, -0.36, -0.18, -0.05), pinky: fg(-0.42, -0.4, -0.2, -0.1), thumb: [[-0.1, 0.1, 0], [-0.15, 0, 0], [-0.2, 0, 0]] },
  // 인 맺기 직전: 가운뎃손가락은 세우고 나머지는 반쯤
  pre: { index: fg(-0.35, -0.7, -0.35), middle: fg(-0.15, -0.05, 0), ring: fg(-0.9, -1.0, -0.6), pinky: fg(-0.95, -1.0, -0.6), thumb: [[0.1, -0.2, 0], [0, 0, 0], [0, 0, 0]] },
  // 염마천인(閻魔天印): 약지·새끼는 안으로 깍지, 가운뎃손가락은 세워 끝을 맞대고, 검지는 굽혀 가운뎃손가락에 붙이고, 엄지는 나란히 세움
  seal: { index: fg(-0.75, -1.45, -0.7), middle: fg(-0.28, -0.04, 0), ring: FIST.ring, pinky: FIST.pinky, thumb: [[0.6, -0.1, 0], [0.1, 0, 0], [0.05, 0, 0]] },
  spread: { index: fg(0.12, 0.04, 0, 0.22), middle: fg(0.1, 0.04, 0, 0.06), ring: fg(0.1, 0.04, 0, -0.1), pinky: fg(0.1, 0.04, 0, -0.26), thumb: [[0.2, -0.35, 0], [0.1, 0, 0], [0.1, 0, 0]] },
  point: { index: fg(0.05, 0, 0, 0.04), middle: FIST.middle, ring: FIST.ring, pinky: FIST.pinky, thumb: [[-0.6, 0.3, 0], [-0.5, 0, 0], [-0.6, 0, 0]] },
  claw: { index: fg(-0.2, -0.45, -0.3, 0.2), middle: fg(-0.18, -0.45, -0.3, 0.05), ring: fg(-0.2, -0.45, -0.3, -0.1), pinky: fg(-0.24, -0.45, -0.3, -0.24), thumb: [[0.15, -0.3, 0], [-0.15, 0, 0], [-0.25, 0, 0]] },
};
const copyPose = (a, out) => { for (const k in a) out[k] = a[k].map(r => r.slice()); return out; };
const mixPose = (o, b, u) => { if (u <= 0) return; for (const k in o) { const A = o[k], B = b[k]; for (let i = 0; i < A.length; i++) for (let j = 0; j < 3; j++) A[i][j] += (B[i][j] - A[i][j]) * u; } };
const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

// ── 화면 전체 배경: 손에서 번져 나가는 어둠 (먹물처럼 들쭉날쭉한 가장자리, 아래쪽 지평선엔 붉은 기운) ──
const BG_FS = `
uniform vec2 uRes; uniform float uPR; uniform vec2 uO; uniform float uR; uniform float uDim; uniform float uA; uniform float uT; uniform float uHz; uniform float uRim;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec2 p = gl_FragCoord.xy / uPR, d = p - uO;
  float r = length(d), an = atan(d.y, d.x);
  float n = fbm(vec2(an * 2.2 + 7.0, r * 0.006 - uT * 0.4)) - 0.5;
  float e = uR * (1.0 + n * 0.45);
  float ink = 1.0 - smoothstep(e - 26.0, e + 6.0, r);
  float rim = exp(-pow((r - e) / 11.0, 2.0)) * uRim * step(1.0, uR);
  vec3 col = vec3(0.018, 0.016, 0.022);
  col += vec3(0.30, 0.03, 0.025) * exp(-pow((p.y - uHz) / (uRes.y * 0.16), 2.0));
  col += vec3(0.05, 0.012, 0.015) * (fbm(p * 0.004 + vec2(uT * 0.05, -uT * 0.02)) - 0.3);
  vec2 q = (p / uRes - 0.5) * vec2(1.2, 0.9); col *= 1.0 - 0.5 * dot(q, q) * 2.0;
  col += vec3(1.0, 0.32, 0.18) * rim;
  gl_FragColor = vec4(col, clamp(max(ink, uDim) + rim * 0.7, 0.0, 1.0) * uA);
}`;

// ── 회오리 몸통: 깔때기 겉면에 흐르는 바람 결 (둘레 방향으로 이음매 없는 잡음) ──
const FUN_VS = `
uniform float uT, uSway, uLift, uFlare, uFloor, uFH;
varying vec2 vUv; varying float vRim;
void main(){
  vUv = uv; vec3 p = position;
  float h = (p.y - uFloor) / uFH;
  p.xz *= 1.0 + uFlare * (0.4 + h);
  p.x += (sin(uT * 1.1 + p.y * 0.0035) * 22.0 + sin(uT * 2.3 + p.y * 0.008) * 8.0) * uSway;
  p.y += uLift;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vRim = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const FUN_FS = `
uniform float uSpin, uT, uA, uGrow; uniform vec3 uCol;
varying vec2 vUv; varying float vRim;
float hP(vec2 i, float P){ i.x = mod(i.x, P); return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453); }
float vnP(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hP(i, P), hP(i + vec2(1, 0), P), f.x), mix(hP(i + vec2(0, 1), P), hP(i + vec2(1, 1), P), f.x), f.y); }
void main(){
  float P = 12.0;
  vec2 q = vec2(vUv.x * P + uSpin + vUv.y * 3.0, vUv.y * 7.0 - uT * 1.4);
  float n = vnP(q, P) * 0.55 + vnP(q * 2.0, P * 2.0) * 0.3 + vnP(q * 4.0, P * 4.0) * 0.15;
  float s = smoothstep(0.4, 0.86, n);
  // 밑동은 짙게, 위로 갈수록 엷게 · 가장자리만 유리처럼 빛나지 않게 테두리 효과는 약하게
  float fy = smoothstep(0.0, 0.05, vUv.y) * mix(1.0, 0.45, vUv.y) * smoothstep(1.0, 0.8, vUv.y) * smoothstep(vUv.y - 0.12, vUv.y, uGrow);
  gl_FragColor = vec4(uCol, s * (0.45 + 0.55 * vRim) * fy * uA);
}`;

// ── 먼지·부스러기 (점마다 크기·투명도·색) ──
const PT_VS = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vA = aAlpha; vC = aColor; }`;
const PT_FS = `
varying float vA; varying vec3 vC;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = (1.0 - smoothstep(0.0, 1.0, r)) * vA; if (a < 0.002) discard; gl_FragColor = vec4(vC, a); }`;

export function buildDomain(c) {
  const { scene, cam, renderer, vw, vh, D, S, K, PALM_Z, FLOOR, R, L, mir, hemi, key, rim, frags, floorM } = c;
  const PR = renderer.getPixelRatio(), diag = Math.hypot(vw, vh);
  const warm = [];
  const add = o => { o.visible = false; o.frustumCulled = false; scene.add(o); warm.push(o); return o; };

  // 배경·바닥·바닥 빛은 손·파편보다 먼저 그림 (깊이를 안 남겨서 손이 바닥 아래로 내려가도 바닥에 덮이지 않게)
  // → 불투명 목록에 넣고 섞는 방식만 직접 지정
  const under1st = (m, order, blend = "normal") => {
    m.transparent = false; m.depthWrite = false;
    if (blend === "add") m.blending = THREE.AdditiveBlending;
    else Object.assign(m, { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    return order;
  };
  const bgU = { uRes: { value: new THREE.Vector2(vw, vh) }, uPR: { value: PR }, uO: { value: new THREE.Vector2(vw / 2, vh / 2) }, uR: { value: 0 }, uDim: { value: 0 }, uA: { value: 1 }, uT: { value: 0 }, uHz: { value: vh * 0.3 }, uRim: { value: 0 } };
  const bg = add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: bgU, vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.99999, 1.0); }", fragmentShader: BG_FS })));
  bg.renderOrder = under1st(bg.material, -100);

  // 바닥: 검고 매끈한 바닥 (가장자리는 어둠 속으로 사라짐), 가운데에 붉은 기운
  const FZ0 = -D * 0.9, FZ1 = D * 0.8;
  const fade = radialTex([[0, "#ffffff"], [0.45, "#d0d0d0"], [1, "#000000"]]);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0c10, roughness: 0.6, metalness: 0.1, opacity: 0, alphaMap: fade });
  const floorD = add(new THREE.Mesh(new THREE.PlaneGeometry(vw * 4, FZ1 - FZ0), floorMat));
  floorD.rotation.x = -Math.PI / 2; floorD.position.set(0, FLOOR - 0.5, (FZ0 + FZ1) / 2); floorD.receiveShadow = true; floorD.renderOrder = under1st(floorMat, -50);
  const glow = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex([[0, "rgba(255,70,40,.9)"], [0.35, "rgba(200,30,20,.45)"], [1, "rgba(120,10,10,0)"]]), toneMapped: false, opacity: 0 })));
  glow.rotation.x = -Math.PI / 2; glow.position.set(0, FLOOR + 0.5, 60); glow.scale.set(vw * 2, D * 1.1, 1); glow.renderOrder = under1st(glow.material, -40, "add");
  // 땅이 갈라지며 붉게 빛나는 금: 가운데서 뻗어 나가는 금을 그려 두고(R 밝기, G 가운데서부터 거리) 땅이 울릴 때 바깥으로 번지게
  const crackTex = (() => {
    const n = 1024, c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, n, n); x.lineCap = "round";
    const crack = (px, py, a, len, w, d0) => {
      let d = d0;
      for (let s = 0; s < len; s += 10) {
        a += rnd(-0.35, 0.35); const nx = px + Math.cos(a) * 10, ny = py + Math.sin(a) * 10, k = 1 - s / len, g = Math.min(255, (d / 500) * 255) | 0;
        x.strokeStyle = `rgb(70,${g},0)`; x.lineWidth = w * k * 4 + 3; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
        x.strokeStyle = `rgb(255,${g},0)`; x.lineWidth = w * k + 0.8; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
        if (Math.random() < 0.05 && w > 1.5) crack(nx, ny, a + rnd(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1), len * rnd(0.25, 0.5) * k, w * 0.55, d);
        px = nx; py = ny; d += 10;
      }
    };
    for (let i = 0; i < 15; i++) crack(n / 2 + rnd(-12, 12), n / 2 + rnd(-12, 12), (i / 15) * 6.283 + rnd(-0.2, 0.2), rnd(260, 480), rnd(3, 6), 0);
    return new THREE.CanvasTexture(c);
  })();
  const crackU = { uMap: { value: crackTex }, uProg: { value: 0 }, uA: { value: 0 } };
  const cracks = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: crackU, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D uMap; uniform float uProg, uA; varying vec2 vUv; void main(){ vec4 c = texture2D(uMap, vUv); float on = smoothstep(uProg, uProg - 0.08, c.g); gl_FragColor = vec4(vec3(1.0, 0.3, 0.12) * (0.8 + 0.7 * c.r), c.r * on * uA); }" })));
  cracks.rotation.x = -Math.PI / 2; cracks.position.set(0, FLOOR + 0.8, 80); cracks.scale.set(vw * 2.1, D * 1.2, 1); cracks.renderOrder = under1st(cracks.material, -30, "add");
  // 땅을 타고 퍼지는 고리 (인을 맺을 때 · 땅울림 · 날려 버릴 때)
  const ringGeo = new THREE.RingGeometry(0.93, 1, 160);
  const rings = [0, 1, 2, 3].map(() => { const m = add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }))); m.rotation.x = -Math.PI / 2; m.position.set(0, FLOOR + 1, 120); return m; });

  // 빛: 뒤에서 붉은 테두리 빛, 바닥에서 붉게 올라오는 빛 (처음부터 넣어 둬야 셰이더를 다시 만들지 않음)
  const redRim = new THREE.DirectionalLight(0xff3a24, 0); redRim.position.set(0.25 * D, 0.3 * D, -1.2 * D); scene.add(redRim);
  const under = new THREE.PointLight(0xff3020, 0, vw * 2.4, 0); under.position.set(0, FLOOR + 170, -120); scene.add(under);

  // 회오리
  const FH = vh * 1.05, FR0 = vw * 0.05, FR1 = vw * 0.5, ZC = -10, OM0 = 6, RREF = vw * 0.25;
  const fr = y => FR0 + (FR1 - FR0) * Math.pow(clamp((y - FLOOR) / FH, 0, 1), 1.35);
  const omAt = r => OM0 * Math.sqrt(RREF / Math.max(18, r));
  const sway = (y, t) => Math.sin(t * 1.1 + y * 0.0035) * 22 + Math.sin(t * 2.3 + y * 0.008) * 8;
  const liftY = la => 280 * la + 1300 * la * la;
  const TR = 1.3;   // 회오리가 다 빨라지기까지
  const spinF = t => { if (t <= T.vortex) return 0; const u = t - T.vortex, l = Math.max(0, t - T.launch); return (u < TR ? TR * Math.pow(u / TR, 3) / 3 : TR / 3 + (u - TR)) + 0.9 * l * l; };
  const prof = []; for (let i = 0; i <= 24; i++) { const h = i / 24; prof.push(new THREE.Vector2(FR0 + (FR1 - FR0) * Math.pow(h, 1.35), FLOOR + h * FH)); }
  const funU = { uT: { value: 0 }, uSway: { value: 0 }, uLift: { value: 0 }, uFlare: { value: 0 }, uFloor: { value: FLOOR }, uFH: { value: FH }, uSpin: { value: 0 }, uA: { value: 0 }, uGrow: { value: 0 }, uCol: { value: new THREE.Color(0.82, 0.8, 0.84) } };
  const funnel = add(new THREE.Mesh(new THREE.LatheGeometry(prof, 72), new THREE.ShaderMaterial({ uniforms: funU, vertexShader: FUN_VS, fragmentShader: FUN_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
  funnel.position.z = ZC;
  // 바람 줄기: 깔때기를 따라 휘감아 도는 가는 띠
  const NS = 48, NSP = 20, stPos = new Float32Array(NS * NSP * 6), stCol = new Float32Array(NS * NSP * 8), stIdx = [];
  for (let k = 0; k < NS; k++) for (let j = 0; j < NSP - 1; j++) { const a = (k * NSP + j) * 2; stIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const stGeo = new THREE.BufferGeometry(); stGeo.setAttribute("position", new THREE.BufferAttribute(stPos, 3)); stGeo.setAttribute("color", new THREE.BufferAttribute(stCol, 4)); stGeo.setIndex(stIdx);
  const streaks = add(new THREE.Mesh(stGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })));
  const STK = Array.from({ length: NS }, () => ({ h: Math.pow(Math.random(), 0.85), len: rnd(0.9, 2.3), w: rnd(0.8, 2.4), sp: rnd(1.1, 1.5), th: rnd(0, 6.28), a: rnd(0.12, 0.34), rm: rnd(0.96, 1.15), rise: rnd(0.18, 0.4) }));
  // 먼지: A 땅울림 때 바닥에서 피어오름 · B 회오리 밑동에 이는 흙먼지 · C 회오리에 섞여 도는 부스러기
  const NA = 110, NB = 150, NC = 420, NP = NA + NB + NC;
  const pPos = new Float32Array(NP * 3), pSize = new Float32Array(NP), pAlpha = new Float32Array(NP), pCol = new Float32Array(NP * 3);
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); ptGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1)); ptGeo.setAttribute("aAlpha", new THREE.BufferAttribute(pAlpha, 1)); ptGeo.setAttribute("aColor", new THREE.BufferAttribute(pCol, 3));
  const dust = add(new THREE.Points(ptGeo, new THREE.ShaderMaterial({ uniforms: { uScale: { value: D * PR } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false })));
  const DP = [];
  for (let i = 0; i < NP; i++) {
    const g = i < NA ? 0 : i < NA + NB ? 1 : 2;
    DP.push(g === 0 ? { g, x: rnd(-vw * 0.55, vw * 0.55), z: rnd(-40, 420), ts: rnd(T.rumble, T.lift + 1.2), life: rnd(1.4, 2.4), vy: rnd(15, 55), vx: rnd(-15, 15), s0: rnd(40, 80), s1: rnd(150, 260), a: rnd(0.14, 0.28) }
      : g === 1 ? { g, th: rnd(0, 6.28), P: rnd(0.9, 1.5), o: rnd(0, 1.5), h: rnd(0.06, 0.3), rm: rnd(1.0, 2.2), s0: rnd(40, 70), s1: rnd(130, 230), a: rnd(0.18, 0.32) }
      : { g, th: rnd(0, 6.28), h: Math.pow(Math.random(), 0.9), rm: rnd(0.8, 1.3), om: rnd(0.9, 1.4), s: rnd(3, 8), a: rnd(0.35, 0.8), ph: rnd(0, 6.28) });
    const cc = g === 2 ? [0.78, 0.76, 0.78] : [0.52, 0.42, 0.4]; pCol.set(cc, i * 3);
  }

  // ── 손 위치·회전 (왼손은 거울 속 기준) ──
  // 인 맺은 두 손: 가운데 MP, 둘을 함께 돌린 각도(psi, tilt), 손바닥 사이 틈(gap), 깍지 끼게 앞뒤로 어긋남(zoff), 손 크기(scale)
  const MP = { x: 0, y: -vh * 0.06, z: 110, psi: 0.42, tilt: 0.1, gap: 0.024 * K, zoff: 0.011 * K, scale: 0.72 };
  const Q_FACE = Q(0, Math.PI / 2, 0);   // 손바닥이 +x(마주 보는 손)를 보게
  const key2 = (p, q, b) => ({ p, q, b: new THREE.Vector2(b[0], b[1]) });
  const seal = (side, apart) => { const qc = Q(MP.tilt, MP.psi * side, 0); return key2(V(-(MP.gap / 2 + PALM_Z * MP.scale + apart), 0, -MP.zoff / 2 * side).applyQuaternion(qc).add(V(MP.x, MP.y, MP.z)), qc.multiply(Q_FACE), [0.55, 0.35]); };
  const keys = side => ({
    start: key2(V(-vw * 0.55, -vh / 2 - S * 2.3, 60), Q(0.7, 0.6, -0.6), [0, 0]),
    ready: seal(side, S * 0.32),
    seal: seal(side, 0),
    open: key2(V(-vw * 0.3, -vh * 0.06, 120), Q(0.05, 0.7, -0.25), [0.3, 0.2]),
    // 회오리: 오른손(화면 왼쪽)은 검지를 세워 휘젓고, 왼손(화면 오른쪽)은 가장자리에서 손바닥을 펴고 받침
    twirl: side > 0 ? key2(V(-vw * 0.33, -vh * 0.29, 170), Q(0.1, 0.3, -0.12), [0.25, 0.05]) : key2(V(-vw * 0.45, -vh * 0.3, 130), Q(0.15, 0.95, -0.1), [0.3, 0.15]),
    // 쳐올리기: 손바닥을 위로 펴며 위로 (회오리 밑동이 보이게 양옆으로)
    thrust: side > 0 ? key2(V(-vw * 0.4, -vh * 0.14, 130), Q(-0.4, 0.15, 0.3), [0.1, 0]) : key2(V(-vw * 0.46, -vh * 0.17, 110), Q(-0.4, 0.3, 0.25), [0.1, 0]),
    exit: key2(V(-vw * 0.4, -vh / 2 - S * 2.5, 100), Q(0.6, 0.5, -0.3), [0, 0]),
  });
  const KS = {}, buildKeys = () => { KS[1] = keys(1); KS[-1] = keys(-1); }; buildKeys();
  const xf = { p: V(), q: new THREE.Quaternion(), b: new THREE.Vector2() }, qb = new THREE.Quaternion(), eu = new THREE.Euler();
  const pose = {};
  function placeHand(rg, side, t) {
    const k = KS[side];
    xf.p.copy(k.start.p); xf.q.copy(k.start.q); xf.b.copy(k.start.b);
    const step = (kk, u) => { if (u <= 0) return; xf.p.lerp(kk.p, u); xf.q.slerp(kk.q, u); xf.b.lerp(kk.b, u); };
    step(k.ready, eBack(seg(t, 0.05, 0.72), 1.1));
    step(k.seal, eIn(seg(t, T.seal - 0.13, T.seal)));
    step(k.open, eOut(seg(t, T.release, T.release + 0.28)));
    step(k.twirl, eInOut(seg(t, T.release + 0.2, T.vortex + 0.3)));
    step(k.thrust, eOut(seg(t, T.launch - 0.1, T.launch + 0.12)));
    step(k.exit, eIn(seg(t, T.launch + 0.5, T.retract + 0.35)));
    // 맞붙는 충격에 살짝 튕김 → 버티는 동안 앞으로 밀며 부들부들 (땅이 울릴수록 세게)
    const rs = t - T.seal;
    if (rs > 0 && rs < 1.2) { const a = Math.exp(-rs * 6) * Math.sin(rs * 34); xf.p.y -= S * 0.05 * a; xf.p.z -= 18 * a; }
    const hold = t > T.seal && t < T.release + 0.1 ? 1 : 0;
    xf.p.z += 30 * sstep(seg(t, T.seal, T.release)) * (1 - seg(t, T.release, T.release + 0.3));
    let tr = hold * (0.25 + 1.3 * seg(t, T.rumble, T.release));
    // 회오리: 오른손은 검지로 허공에 원을 그리고(점점 빠르게), 왼손은 손바닥을 펴고 버팀
    const tw = sstep(seg(t, T.vortex - 0.15, T.vortex + 0.3)) * (1 - sstep(seg(t, T.launch - 0.12, T.launch)));
    if (tw > 0) {
      if (side > 0) { const ph = 8.5 * spinF(t) + 1; xf.q.multiply(qb.setFromEuler(eu.set(Math.sin(ph) * 0.25 * tw, 0, Math.cos(ph) * 0.25 * tw))); xf.p.x += Math.cos(ph) * S * 0.1 * tw; xf.p.z += Math.sin(ph) * S * 0.1 * tw; }
      else { xf.p.z += 25 * seg(t, T.vortex, T.launch) * tw; tr = Math.max(tr, tw * (0.6 + seg(t, T.vortex, T.launch))); }
    }
    if (tr > 0) { xf.p.x += Math.sin(t * 73 + side) * 1.3 * tr; xf.p.y += Math.sin(t * 91 + side * 2) * 1.0 * tr; xf.q.multiply(qb.setFromEuler(eu.set(0, 0, Math.sin(t * 67 + side) * 0.01 * tr))); }
    rg.root.position.copy(xf.p); rg.root.quaternion.copy(xf.q); rg.root.scale.setScalar(MP.scale);
    rg.sleeve.quaternion.copy(rg.sleeveQ0).premultiply(qb.setFromEuler(eu.set(xf.b.x, 0, xf.b.y)));
    // 손가락
    copyPose(POSE.relax, pose);
    mixPose(pose, POSE.pre, sstep(seg(t, 0.3, 0.85)));
    mixPose(pose, POSE.seal, eIn(seg(t, T.seal - 0.13, T.seal)));
    mixPose(pose, POSE.spread, eOut(seg(t, T.release, T.release + 0.2)));
    mixPose(pose, side > 0 ? POSE.point : POSE.claw, sstep(seg(t, T.release + 0.3, T.vortex + 0.2)));
    mixPose(pose, POSE.spread, eOut(seg(t, T.launch - 0.1, T.launch + 0.1)));
    mixPose(pose, POSE.relax, sstep(seg(t, T.launch + 0.6, T.retract + 0.2)));
    if (tr > 0) for (const n in pose) pose[n][1][0] += Math.sin(t * 59 + n.length * 1.7 + side) * 0.02 * tr;
    for (const n in pose) rg.H.setChain(n, pose[n]);
  }

  // ── 진행 ──
  let on = false, d = 0, freeze = 0, shake = 0, ctx = null, N = 0, domEl = null, invEl = null;
  const par = [], hit = new Set(), once = (k, fn) => { if (!hit.has(k)) { hit.add(k); fn(); } };
  const base = { hemi: hemi.intensity, key: key.intensity, rim: rim.intensity, env: scene.environmentIntensity };
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), pv = V(), cp = V(), cl = V();
  const toScreen = v => { const p = v.clone().project(cam); return new THREE.Vector2((p.x + 1) / 2 * vw, (p.y + 1) / 2 * vh); };   // 아래가 0

  function fragsPhase(t) {
    const F = spinF(t), va = sstep(seg(t, T.vortex, T.vortex + 0.9));
    for (let i = 0; i < N; i++) {
      const q = par[i];
      let x = q.x, y = q.y, z = q.z, rx = q.rx, ry = q.ry, rz = q.rz;
      if (t > T.rumble && t < q.L + 0.3) {   // 땅울림: 제자리에서 통통 튐
        const k = seg(t, T.rumble, T.rumble + 0.45) * (1 - seg(t, q.L, q.L + 0.3)), h = Math.max(0, Math.sin(t * q.hf + q.ph));
        y += h * h * q.ha * k; rx += Math.sin(t * q.hf * 0.5 + q.ph) * 0.35 * k; rz += Math.cos(t * q.hf * 0.43 + q.ph) * 0.3 * k;
      }
      const ul = seg(t, q.L, q.L + q.Ld);
      if (ul > 0) {   // 떠오름: 무겁게 들렸다가 둥실
        const e = eInOut(ul), age = t - q.L;
        y = lerp(y, q.hy, e) + Math.sin(age * q.bf + q.ph) * q.ba * e; x += q.dx * e; z += q.dz * e;
        rx += q.wx * age; ry += q.wy * age; rz += q.wz * age;
      }
      if (t > T.vortex) {   // 회오리: 축 쪽으로 빨려 들며 돌고, 날려 버릴 땐 위로 솟구치며 퍼짐
        const v = sstep(seg(t, q.V, q.V + 0.85)), yy = lerp(y, q.yv + Math.sin(t * 2.1 + q.ph) * 9, v);
        const dz = z - ZC, rf = fr(yy) * q.rj, la = Math.max(0, t - T.launch - q.ld);
        const rr = lerp(Math.hypot(x, dz), rf, v) * (1 + 1.5 * la), th = Math.atan2(dz, x) + omAt(rf) * q.om * F;
        x = sway(yy, t) * va + rr * Math.cos(th); z = ZC + rr * Math.sin(th); y = yy + liftY(la);
        rx += q.wx * 4 * F; ry += q.wy * 4 * F;
      }
      frags.setMatrixAt(i, m4.compose(pv.set(x, y, z), qt.setFromEuler(eu.set(rx, ry, rz)), q.s));
    }
    frags.instanceMatrix.needsUpdate = true;
  }

  function airPhase(t) {
    const F = spinF(t), va = sstep(seg(t, T.vortex, T.vortex + 0.9)), la = Math.max(0, t - T.launch);
    // 회오리 몸통
    const fa = va * (1 - seg(t, T.launch + 0.15, T.launch + 0.7));
    funnel.visible = fa > 0.001;
    funU.uT.value = t; funU.uSway.value = va; funU.uLift.value = liftY(la); funU.uFlare.value = 1.5 * la;
    funU.uSpin.value = 12 / 6.283 * omAt(fr(FLOOR + FH * 0.5)) * F; funU.uA.value = 0.75 * fa; funU.uGrow.value = seg(t, T.vortex, T.vortex + 1.0) * 1.15;
    // 바람 줄기
    streaks.visible = fa > 0.001;
    if (streaks.visible) {
      for (let k = 0; k < NS; k++) {
        const s = STK[k], y0 = FLOOR + 20 + s.h * FH * 0.92, rf = fr(y0) * s.rm * (1 + 1.5 * la), head = s.th + omAt(fr(y0)) * s.sp * F, sx = sway(y0, t) * va;
        for (let j = 0; j < NSP; j++) {
          // 꼬리로 갈수록 낮게: 바람이 돌면서 올라가는 나선
          const u = j / (NSP - 1), th = head - s.len * u, y = y0 - u * s.len * rf * s.rise + liftY(la), x = sx + rf * Math.cos(th), z = ZC + rf * Math.sin(th), w = s.w * (1 - u * 0.7);
          const a = (k * NSP + j) * 2, al = s.a * fa * (Math.sin(th) > 0 ? 1 : 0.45) * (1 - u) * Math.min(1, u * 8);
          stPos.set([x, y + w, z, x, y - w, z], a * 3);
          stCol.set([0.86, 0.84, 0.88, al, 0.86, 0.84, 0.88, al], a * 4);
        }
      }
      stGeo.attributes.position.needsUpdate = stGeo.attributes.color.needsUpdate = true;
    }
    // 먼지·부스러기
    for (let i = 0; i < NP; i++) {
      const p = DP[i]; let x = 0, y = -1e5, z = 0, s = 0, a = 0;
      if (p.g === 0) {
        const age = t - p.ts;
        if (age > 0 && age < p.life) {
          const u = age / p.life; x = p.x + p.vx * age; y = FLOOR + 6 + p.vy * age; z = p.z; s = lerp(p.s0, p.s1, eOut(u));
          a = p.a * Math.pow(Math.sin(Math.PI * u), 0.7) * (1 - seg(t, T.vortex, T.vortex + 0.7));
          if (t > T.vortex) { const r = Math.hypot(x, z - ZC), th = Math.atan2(z - ZC, x) + omAt(r) * 0.5 * F; x = r * Math.cos(th); z = ZC + r * Math.sin(th); }
        }
      } else if (p.g === 1) {
        if (t > T.vortex) {
          const age = ((t - T.vortex + p.o) % p.P) / p.P; y = FLOOR + 4 + age * p.h * FH; const r = (fr(y) * p.rm + age * 30) * (1 + 1.5 * la), th = p.th + omAt(r) * F + age * 1.5;
          x = sway(y, t) * va + r * Math.cos(th); z = ZC + r * Math.sin(th); y += liftY(la) * 0.5; s = lerp(p.s0, p.s1, age);
          a = p.a * Math.sin(Math.PI * age) * va * (1 - seg(t, T.launch, T.launch + 0.6));
        }
      } else if (t > T.vortex) {
        y = FLOOR + 10 + p.h * FH * 0.95 + Math.sin(t * 2 + p.ph) * 8; const r = fr(y) * p.rm * (1 + 1.5 * la), th = p.th + omAt(r) * p.om * 1.1 * F;
        x = sway(y, t) * va + r * Math.cos(th); z = ZC + r * Math.sin(th); y += liftY(la); s = p.s; a = p.a * va * (1 - seg(la, 0.5, 0.9));
      }
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pSize[i] = s; pAlpha[i] = a;
    }
    ptGeo.attributes.position.needsUpdate = ptGeo.attributes.aSize.needsUpdate = ptGeo.attributes.aAlpha.needsUpdate = true;
  }

  // 어둠·빛·바닥·고리
  let origin = new THREE.Vector2(vw / 2, vh * 0.55);
  const center = new THREE.Vector2(vw / 2, vh * 0.5);
  function worldPhase(t) {
    const spread = eOut(seg(t, T.seal, T.seal + 0.75)), shrink = eInOut(seg(t, T.retract, T.end - 0.1));
    bgU.uT.value = t; bgU.uO.value.copy(shrink > 0 ? center : origin);
    bgU.uDim.value = 0.4 * sstep(seg(t, 0.05, 0.9)) * (1 - sstep(seg(t, T.retract, T.retract + 0.7)));
    bgU.uR.value = diag * 1.35 * spread * (1 - shrink);
    bgU.uRim.value = (t > T.seal ? 1 - seg(t, T.seal + 0.45, T.seal + 0.9) : 0) + Math.sin(Math.PI * shrink) * 0.6;
    const pre = 0.3 * sstep(seg(t, 0, 0.9)) * (1 - seg(t, T.retract, T.end)), dk = sstep(seg(t, T.seal, T.seal + 0.6)) * (1 - sstep(seg(t, T.retract, T.end - 0.1)));
    const lk = Math.max(pre, dk);
    hemi.intensity = lerp(base.hemi, 0.16, lk); key.intensity = lerp(base.key, 2.0, lk); rim.intensity = lerp(base.rim, 0.5, lk); scene.environmentIntensity = lerp(base.env, 0.3, lk);
    redRim.intensity = 3.4 * dk; under.intensity = 2.4 * dk * (0.85 + 0.15 * Math.sin(t * 6.3));
    floorMat.opacity = 0.95 * dk; glow.material.opacity = 0.55 * dk * (0.8 + 0.2 * Math.sin(t * 2.7));
    crackU.uProg.value = 0.22 * eOut(seg(t, T.seal, T.seal + 0.4)) + 0.85 * eOut(seg(t, T.rumble, T.rumble + 0.9));
    crackU.uA.value = dk * (0.8 + 0.2 * Math.sin(t * 11) * seg(t, T.rumble, T.rumble + 0.3)) * (1 - seg(t, T.retract, T.retract + 0.5));
    const ringAt = (m, t0, dur, maxR) => { const u = seg(t, t0, t0 + dur); m.visible = u > 0 && u < 1; m.scale.setScalar(Math.max(0.01, maxR * eOut(u))); m.material.opacity = (1 - u) * 0.9; };
    ringAt(rings[0], T.seal, 1.0, vw * 2.4); ringAt(rings[1], T.seal + 0.1, 1.2, vw * 1.8); ringAt(rings[2], T.rumble, 1.1, vw * 2.0); ringAt(rings[3], T.launch, 0.9, vw * 1.6);
  }

  function beats(t) {
    const { snd } = ctx;
    once("up", () => { snd.whoosh(0.7); buzz(1); });
    if (t >= T.seal - 0.5) once("swell", () => snd.swell(0.5));
    if (t >= T.seal) once("seal", () => {
      snd.seal(); buzz([3, 50, 3, 110, 2]); shake = 16; freeze = 0.09;
      origin = toScreen(V(MP.x, MP.y + S * 0.9 * MP.scale, MP.z));
      // 한순간 화면이 반전 (번쩍)
      invEl.classList.add("on"); setTimeout(() => invEl.classList.remove("on"), 70); setTimeout(() => invEl.classList.add("on"), 120); setTimeout(() => invEl.classList.remove("on"), 160);
    });
    if (t >= T.text) once("text", () => { snd.title(); buzz(2); domEl.style.opacity = ""; domEl.classList.add("on"); });
    if (t >= T.rumble) once("rumble", () => { snd.rumble(T.release - T.rumble + 0.4); buzz([2, 70, 2, 70, 3, 70, 2, 70, 3, 70, 3, 70, 2, 70, 3, 70, 3, 70, 2, 70, 3]); });
    if (t >= T.lift) once("rise", () => snd.rise(1.6));
    if (t >= T.release - 0.05) once("release", () => { snd.release(); buzz(2); shake = 6; domEl.classList.add("off"); });
    if (t >= T.vortex - 0.1) once("wind", () => snd.wind(T.launch - T.vortex + 0.3));
    if (t > T.vortex && t < T.launch) { const k = Math.floor((t - T.vortex) / 0.2); once("vt" + k, () => buzz(k > 6 ? 2 : 1)); }
    // 날려 버리는 순간(화면이 아직 완전히 어둡고, 어차피 멈칫하는 때) 밑에 달력을 다시 깔아 둠 → 어둠이 걷히면 바로 보이게
    if (t >= T.launch) once("launch", () => { snd.launch(); buzz([3, 40, 3, 40, 3, 90, 2]); shake = 22; freeze = 0.08; if (api.debugD == null) ctx.onRestore(); });
    if (t >= T.retract) once("retract", () => { snd.close(); domEl.hidden = true; });
    if (t >= T.end) once("end", () => { if (api.debugD == null) { on = false; ctx.onEnd(); } });
  }

  function camPhase(t, dt) {
    cp.set(0, 0, D); cl.set(0, 0, 0);
    const k1 = eInOut(seg(t, 0, T.seal + 0.15)); cp.lerp(pv.set(0, -vh * 0.02, D * 0.92), k1); cl.lerp(pv.set(0, -vh * 0.03, 30), k1);
    cp.z -= D * 0.035 * sstep(seg(t, T.seal, T.rumble + 0.3));
    if (t > T.seal) cp.z -= D * 0.03 * Math.exp(-(t - T.seal) * 8);
    const k2 = eInOut(seg(t, T.rumble + 0.15, T.release + 0.1)); cp.lerp(pv.set(0, -vh * 0.05, D * 0.98), k2); cl.lerp(pv.set(0, vh * 0.06, 0), k2);
    const k3 = eInOut(seg(t, T.release, T.vortex + 0.9)); cp.lerp(pv.set(0, -vh * 0.13, D * 1.08), k3); cl.lerp(pv.set(0, vh * 0.03, 0), k3);
    const k4 = eOut(seg(t, T.launch, T.launch + 0.45)) * (1 - eInOut(seg(t, T.launch + 0.6, T.retract + 0.5))); cl.y += vh * 0.2 * k4; cp.y += vh * 0.04 * k4;
    const k5 = eInOut(seg(t, T.retract, T.end - 0.05)); cp.lerp(pv.set(0, 0, D), k5); cl.lerp(pv.set(0, 0, 0), k5);
    shake *= Math.exp(-dt * 7);
    const amp = 7 * seg(t, T.rumble, T.rumble + 0.35) * (1 - seg(t, T.release - 0.25, T.release + 0.35)) + 2.5 * seg(t, T.vortex, T.vortex + 1.2) * (1 - seg(t, T.launch + 0.3, T.retract));
    cp.x += (Math.sin(t * 37) * 0.6 + Math.sin(t * 59 + 1.3) * 0.4) * amp + rnd(-1, 1) * shake;
    cp.y += (Math.sin(t * 43 + 0.7) * 0.6 + Math.sin(t * 67) * 0.4) * amp + rnd(-1, 1) * shake;
    const o = api.camOverride;
    if (o) { cam.position.fromArray(o.p); cam.lookAt(pv.fromArray(o.l)); } else { cam.position.copy(cp); cam.lookAt(cl); }
  }

  function update(t, dt) {
    placeHand(R, 1, t); placeHand(L, -1, t);
    fragsPhase(t); airPhase(t); worldPhase(t); beats(t); camPhase(t, dt);
  }

  const api = {
    T, warm, debugD: null, camOverride: null,
    dev: import.meta.env.DEV ? { POSE, MP, buildKeys } : null,
    start(o) {
      ctx = o; on = true; d = 0; freeze = 0; shake = 0; hit.clear();
      domEl = o.ui.querySelector(".cr-dom"); invEl = o.ui.querySelector(".cr-inv");
      domEl.style.opacity = "0.004"; domEl.hidden = false;   // 보통은 다음 버튼이 뜰 때 이미 그려 둠
      N = o.frg.length; par.length = 0;
      for (let i = 0; i < N; i++) {
        const f = o.frg[i];
        par.push({ x: f.p.x, y: f.p.y, z: f.p.z, rx: f.r.x, ry: f.r.y, rz: f.r.z, s: f.s,
          hf: rnd(14, 26), ph: rnd(0, 6.28), ha: rnd(2, 9),
          L: T.lift + Math.pow(Math.random(), 1.4) * 1.1, Ld: rnd(1.1, 1.7), hy: FLOOR + 40 + Math.pow(Math.random(), 0.75) * vh * 0.78,
          dx: rnd(-25, 25), dz: rnd(-30, 10), ba: rnd(3, 10), bf: rnd(0.9, 1.8), wx: rnd(-1.2, 1.2), wy: rnd(-1.2, 1.2), wz: rnd(-1.2, 1.2),
          V: T.vortex + Math.random() * 0.55, yv: FLOOR + 15 + Math.pow(Math.random(), 1.1) * FH * 0.92, rj: rnd(0.75, 1.15), om: rnd(0.8, 1.25), ld: 0 });
        const q = par[i]; q.ld = (1 - (q.yv - FLOOR) / FH) * 0.3;   // 밑동은 조금 늦게 뜸
      }
      mir.visible = true; floorM.visible = false; frags.visible = true;
      [bg, floorD, glow, cracks, dust].forEach(o => (o.visible = true));
      bgU.uHz.value = toScreen(V(0, FLOOR, FZ0)).y;
    },
    tick(dtR) {
      if (!on) return;
      freeze -= dtR; d += freeze > 0 ? dtR * 0.06 : dtR;
      update(api.debugD ?? d, dtR);
    },
  };
  return api;
}
