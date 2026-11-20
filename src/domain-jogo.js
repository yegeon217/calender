// 영역전개 · 죠고: 개관철위산(蓋棺鐵圍山)
// 깍지 낀 두 손에서 검지만 맞대어 세운 산 모양의 인 → 화산 속 같은 붉은 공간(재구름이 밑에서 달아오름)이 번짐
// → 땅이 갈라지며 용암 금이 퍼지고 쇠 파편이 시뻘겋게 달아오름 → 땅이 울리며 뒤에서 거대한 화산이 솟아오름(두 손으로 들어 올리듯)
// → 두 손으로 파편을 끌어올려 분화구 위에 산더미로 쌓아 막음 → 쌓인 더미가 부풀며 들썩 → 분화: 더미째 날아가며 녹아 없어짐(일부는 용암 덩이로 떨어져 튐) → 두 손을 내밀면 불길이 화면을 덮침 → 걷힘
import * as THREE from "three";
import { domainBase, placeHand, tremble, fg, FIST, POSE, Q, key2, makePts, synth, under1st, NOISE_GLSL, clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V } from "./domain-kit.js";
import { buzz } from "./fx-util.js";

const T = { seal: 1.0 };
T.text = T.seal + 0.14;
T.heat = T.seal + 0.45;     // 용암 금 · 달아오름
T.rumble = T.heat + 0.85;   // 땅울림
T.rise = T.rumble + 0.3;    // 화산이 솟음
T.gather = T.rise + 0.55;   // 파편을 끌어올려 분화구 위에 쌓음 (뚜껑처럼 막음)
T.erupt = T.rise + 2.35;    // 분화: 쌓인 파편을 날려 녹여 버림
T.surge = T.erupt + 1.6;    // 불길이 화면을 덮침
T.boom = T.surge + 0.38;
T.retract = T.boom + 0.6;
T.end = T.retract + 0.95;

// 깍지 끼고 검지만 세워 맞댐 · 엄지도 나란히 세움
const PEAK = { index: fg(-0.2, -0.08, 0, -0.06), middle: fg(-1.35, -1.6, -1.0), ring: fg(-1.4, -1.65, -1.0), pinky: fg(-1.45, -1.6, -0.95), thumb: [[0.55, -0.12, 0], [0.08, 0, 0], [0.04, 0, 0]] };
const PRE = { index: fg(-0.2, -0.3, -0.2), middle: fg(-0.7, -0.8, -0.5), ring: fg(-0.8, -0.9, -0.5), pinky: fg(-0.85, -0.9, -0.5), thumb: [[0.2, -0.15, 0], [0, 0, 0], [0, 0, 0]] };
const LIFT = { index: fg(-0.1, -0.12, -0.05, 0.18), middle: fg(-0.12, -0.12, -0.05, 0.05), ring: fg(-0.14, -0.14, -0.06, -0.08), pinky: fg(-0.18, -0.16, -0.08, -0.2), thumb: [[0.25, -0.35, 0], [0.05, 0, 0], [0.05, 0, 0]] };

const BODY = `
vec3 body(vec2 p){
  vec2 q = p / uRes.y; float hz = uHz / uRes.y, up = max(0.0, q.y - hz);
  vec3 col = vec3(0.03, 0.009, 0.005);
  col += vec3(0.6, 0.13, 0.02) * exp(-up * 3.0) * 0.75 * uHeat;
  float cl = fbm(vec2(q.x * 2.0 + uT * 0.035, q.y * 2.8 - uT * 0.06)), cl2 = fbm(vec2(q.x * 4.5 - uT * 0.05, q.y * 5.0 - uT * 0.09) + 3.0);
  vec3 ash = vec3(0.06, 0.025, 0.02) + vec3(0.6, 0.16, 0.03) * exp(-up * 2.2) * uHeat * (0.5 + 0.6 * cl2);
  col = mix(col, ash, smoothstep(0.42, 0.78, cl) * 0.85);
  vec2 dv = (p - uV) / uRes.y; col += vec3(1.0, 0.42, 0.07) * exp(-dot(dv, dv) / 0.035) * uErupt * (0.8 + 0.2 * sin(uT * 13.0));
  col += vec3(0.9, 0.25, 0.04) * exp(-dot(dv * vec2(1.0, 0.35), dv * vec2(1.0, 0.35)) / 0.05) * uErupt * 0.5;
  col = mix(col, vec3(1.0, 0.6, 0.16) + 0.25 * fbm(q * 6.0 + uT), uFlood);
  vec2 vq = (p / uRes - 0.5) * vec2(1.2, 0.9); col *= 1.0 - 0.5 * dot(vq, vq) * 2.0 * (1.0 - uFlood);
  return col;
}`;

// 화산 겉: 검은 바위 + 꼭대기에서 흘러내리는 용암 줄기 (바닥 아래는 안 그림 → 땅에서 솟아오르는 것처럼)
const VOL_VS = `varying vec3 vW, vN; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const VOL_FS = `uniform float uT, uFloor, uLava, uTop; uniform vec3 uLight; varying vec3 vW, vN; varying vec2 vUv;
${NOISE_GLSL}
void main(){
  if (vW.y < uFloor) discard;
  vec3 n = normalize(vN);
  float rock = fbm(vec2(vUv.x * 40.0, vUv.y * 9.0));
  vec3 col = vec3(0.12, 0.085, 0.07) * (0.55 + 0.9 * rock);
  float lit = max(0.0, dot(n, normalize(uLight))) * 0.65 + 0.18;
  col *= lit * 1.6;
  // 뒤 하늘·불기둥에 비친 붉은 테두리, 아래쪽은 용암 바다에 달아오름
  vec3 vd = normalize(cameraPosition - vW); float fr = pow(1.0 - max(0.0, dot(n, vd)), 2.5);
  col += vec3(0.9, 0.25, 0.04) * fr * (0.25 + 0.6 * uLava);
  col += vec3(0.7, 0.15, 0.02) * smoothstep(0.25, 0.0, vUv.y) * 0.35;
  // 용암 줄기: 둘레 방향으로 이음매 없게, 위에서 아래로 흐름
  float lv = fbm(vec2(vUv.x * 18.0, vUv.y * 2.5 + uT * 0.25)) + 0.35 * fbm(vec2(vUv.x * 45.0, vUv.y * 6.0 + uT * 0.6));
  float m = smoothstep(0.74, 0.84, lv) * smoothstep(0.05, 0.6, vUv.y) * uLava;
  m += smoothstep(0.88, 1.0, vUv.y) * uTop;
  col = mix(col, vec3(1.0, 0.42, 0.06) * (1.2 + 0.6 * lv), clamp(m, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;
// 불기둥
const COL_VS = `varying vec2 vUv; varying float vR; uniform float uT;
void main(){ vUv = uv; vec3 p = position; p.x += sin(uT * 3.0 + p.y * 0.01) * 12.0 * uv.y; vec4 mv = modelViewMatrix * vec4(p, 1.0); vR = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const COL_FS = `uniform float uT, uA, uH; varying vec2 vUv; varying float vR;
${NOISE_GLSL}
void main(){
  float P = 6.0;
  vec2 q = vec2(vUv.x * P * 2.0, vUv.y * 5.0 - uT * 3.2);
  float n = fbm(q) * 0.7 + fbm(q * 2.3 + 5.0) * 0.4;
  float h = vUv.y / max(0.01, uH);
  float f = smoothstep(0.25, 0.9, n * (1.2 - h * 0.8)) * smoothstep(1.0, 0.7, h) * smoothstep(0.0, 0.04, vUv.y);
  vec3 c = mix(vec3(1.0, 0.95, 0.6), vec3(1.0, 0.35, 0.05), smoothstep(0.1, 0.7, h + (1.0 - n) * 0.4));
  c = mix(c, vec3(0.45, 0.06, 0.02), smoothstep(0.6, 1.0, h));
  gl_FragColor = vec4(c * 1.4, f * (0.55 + 0.45 * (1.0 - vR)) * uA * step(vUv.y, uH));
}`;
// 바닥: 검은 바위 위로 번지는 용암 금
const FLOOR_FS = `uniform sampler2D uMap; uniform float uProg, uA, uT; varying vec2 vUv;
${NOISE_GLSL}
void main(){
  vec4 cr = texture2D(uMap, vUv); vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float rock = fbm(vUv * 26.0);
  vec3 col = vec3(0.045, 0.03, 0.025) * (0.5 + rock);
  float on = smoothstep(uProg, uProg - 0.08, cr.g);
  float fl = 0.8 + 0.2 * sin(uT * 7.0 + vUv.x * 40.0);
  col += vec3(1.0, 0.36, 0.05) * cr.r * on * 1.6 * fl;
  col += vec3(0.5, 0.1, 0.01) * smoothstep(0.6, 0.0, r) * uProg * 0.3;
  gl_FragColor = vec4(col, uA * smoothstep(1.0, 0.55, r));
}`;

export function buildJogo(c) {
  const { vw, vh, D, S, K, FLOOR, R, L, PALM_Z, frags } = c;
  const HS = 0.72;
  const bgU = { uHz: { value: vh * 0.3, glsl: "float" }, uHeat: { value: 0, glsl: "float" }, uV: { value: new THREE.Vector2(vw / 2, vh * 0.7), glsl: "vec2" }, uErupt: { value: 0, glsl: "float" }, uFlood: { value: 0, glsl: "float" } };
  const objs = [];
  // 바닥
  const crackTex = (() => {
    const n = 1024, cv = document.createElement("canvas"); cv.width = cv.height = n; const x = cv.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, n, n); x.lineCap = "round";
    const crack = (px, py, a, len, w, d0) => { let d = d0; for (let s = 0; s < len; s += 10) { a += rnd(-0.4, 0.4); const nx = px + Math.cos(a) * 10, ny = py + Math.sin(a) * 10, k = 1 - s / len, g = Math.min(255, (d / 500) * 255) | 0;
      x.strokeStyle = `rgb(90,${g},0)`; x.lineWidth = w * k * 5 + 4; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      x.strokeStyle = `rgb(255,${g},0)`; x.lineWidth = w * k * 1.6 + 1; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      if (Math.random() < 0.06 && w > 1.5) crack(nx, ny, a + rnd(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1), len * rnd(0.3, 0.55) * k, w * 0.6, d); px = nx; py = ny; d += 10; } };
    for (let i = 0; i < 20; i++) crack(n / 2 + rnd(-14, 14), n / 2 + rnd(-14, 14), (i / 20) * 6.283 + rnd(-0.2, 0.2), rnd(280, 500), rnd(3.5, 7), 0);
    return new THREE.CanvasTexture(cv);
  })();
  const flU = { uMap: { value: crackTex }, uProg: { value: 0 }, uA: { value: 0 }, uT: { value: 0 } };
  const FZ0 = -D * 0.9, FZ1 = D * 0.8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(vw * 3, FZ1 - FZ0), new THREE.ShaderMaterial({ uniforms: flU, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: FLOOR_FS }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR - 0.5, (FZ0 + FZ1) / 2); floor.renderOrder = under1st(floor.material, -50); objs.push(floor);
  // 화산
  const VZ = -D * 0.62, VB = vw * 0.75, VT = vw * 0.09, VH = vh * 0.62;
  const prof = []; for (let i = 0; i <= 30; i++) { const h = i / 30; prof.push(new THREE.Vector2(VT + (VB - VT) * Math.pow(1 - h, 1.8), h * VH)); }
  prof.push(new THREE.Vector2(VT * 0.7, VH * 0.96)); prof.push(new THREE.Vector2(VT * 0.3, VH * 0.9));
  const vg = new THREE.LatheGeometry(prof, 96), va = vg.attributes.position;
  for (let i = 0; i < va.count; i++) { const x = va.getX(i), y = va.getY(i), z = va.getZ(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.sin(a * 7 + y * 0.01) + 0.05 * Math.sin(a * 17 + 2) * (1 - y / VH) + 0.03 * Math.sin(y * 0.05 + a * 3); va.setX(i, x * k); va.setZ(i, z * k); }
  vg.computeVertexNormals();
  const volU = { uT: { value: 0 }, uFloor: { value: FLOOR }, uLava: { value: 0 }, uTop: { value: 0 }, uLight: { value: V(0.2, 1, 0.6) } };
  const volcano = new THREE.Mesh(vg, new THREE.ShaderMaterial({ uniforms: volU, vertexShader: VOL_VS, fragmentShader: VOL_FS }));
  volcano.position.set(0, FLOOR - VH, VZ); objs.push(volcano);
  const TOP = () => V(0, volcano.position.y + VH * 0.95, VZ);
  // 불기둥
  const CH = vh * 1.6, colU = { uT: { value: 0 }, uA: { value: 0 }, uH: { value: 0 } };
  const column = new THREE.Mesh(new THREE.CylinderGeometry(VT * 1.6, VT * 0.75, CH, 48, 1, true), new THREE.ShaderMaterial({ uniforms: colU, vertexShader: COL_VS, fragmentShader: COL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  column.geometry.translate(0, CH / 2, 0); objs.push(column);
  // 불꽃·재 알갱이 · 하늘로 오르는 불티
  const NF = 900, fire = makePts(c, NF, { soft: 0 }), NE = 500, emb = makePts(c, NE, { soft: 0.2 }), NS = 220, smoke = makePts(c, NS, { add: false, soft: 0 });
  objs.push(fire.mesh, emb.mesh, smoke.mesh);
  // 용암 덩이 꼬리 · 떨어진 자리에 튀는 용암 · 분화 때 땅을 타고 퍼지는 충격파
  const NBT = 200, TL = 14, trail = makePts(c, NBT * TL, { soft: 0.1 }), NSPL = 6, splash = makePts(c, NBT * NSPL, { soft: 0.15 });
  objs.push(trail.mesh, splash.mesh);
  const SPL = Array.from({ length: NBT * NSPL }, (_, j) => ({ a: rnd(0, 6.28), v: rnd(0.35, 1) * vh * (j % NSPL ? 0.9 : 0), u: rnd(0.8, 1.6) * vh }));
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 160), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  shock.rotation.x = -Math.PI / 2; objs.push(shock);
  const airShock = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 160), new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  objs.push(airShock);
  const FP = Array.from({ length: NF }, () => ({ o: Math.random(), P: rnd(0.7, 1.3), vx: rnd(-1, 1), vz: rnd(-1, 1), vy: rnd(0.8, 1.4), s: rnd(40, 110), sur: Math.random() }));
  const EP = Array.from({ length: NE }, () => ({ x: rnd(-0.7, 0.7) * vw, z: rnd(-D * 0.6, D * 0.4), o: Math.random(), P: rnd(2.5, 5), s: rnd(2.5, 6), w: rnd(0.5, 2), ph: rnd(0, 6.28) }));
  const SP = Array.from({ length: NS }, () => ({ o: Math.random(), P: rnd(2, 3.5), vx: rnd(-1, 1), vz: rnd(-0.5, 0.5), s: rnd(160, 320) }));
  const fireMat = frags.material, emis0 = fireMat.emissive.clone(), emisI0 = fireMat.emissiveIntensity, col0 = fireMat.color.clone(), met0 = fireMat.metalness, envI0 = fireMat.envMapIntensity, rough0 = fireMat.roughness, hotC = new THREE.Color(0.012, 0.004, 0.003);
  const fract = x => x - Math.floor(x);
  const heatK = t => sstep(seg(t, T.heat, T.rumble + 0.15)) * (1 - seg(t, T.boom, T.retract));

  const def = {
    key: "jogo", T, bg: { body: BODY, u: bgU, rim: 0xff8a2a },
    init(par, o, E) {
      fireMat.emissive.copy(emis0); fireMat.emissiveIntensity = emisI0; fireMat.color.copy(col0); fireMat.metalness = met0; fireMat.roughness = rough0; fireMat.envMapIntensity = envI0;
      for (const q of par) {
        const mr = Math.sqrt(Math.random()), ma = rnd(0, 6.283);
        Object.assign(q, { hf: rnd(14, 26), ph: rnd(0, 6.28), ha: rnd(2, 10),
          // 더미 속 자리 (분화구 가운데가 가장 높은 원뿔꼴)
          mx: Math.cos(ma) * mr * VT * 2.3, mz: Math.sin(ma) * mr * VT * 2.0, mh: (1 - mr) * VT * 1.9 * Math.pow(Math.random(), 0.4), mr,
          tg: T.gather + Math.pow(Math.random(), 1.15) * 1.0, dg: rnd(0.55, 0.85), arc: rnd(0.35, 0.75) * vh,
          tb: T.erupt + Math.pow(Math.random(), 2) * 0.3 + (1 - mr) * 0.05,
          v: V(rnd(-0.7, 0.7) * vw * (0.4 + mr), rnd(1.4, 3.1) * vh, rnd(-0.3, 0.8) * D), w: V(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14)),
          melt: Math.random() < 0.72 ? rnd(0.45, 1.2) : Infinity });
      }
      bgU.uHz.value = E.toScreen(V(0, FLOOR, FZ0)).y;
    },
    update(t, dt, E) {
      hands(t);
      const G = 2.4 * vh, top = TOP();
      // 더미가 부풀며 들썩임 (분화 직전)
      const bul = sstep(seg(t, T.erupt - 0.75, T.erupt)), shk = bul * 6;
      const slot = (q, o) => { o.x = top.x + q.mx * (1 + 0.25 * bul) + Math.sin(t * 53 + q.ph) * shk; o.z = top.z + q.mz * (1 + 0.25 * bul); o.y = top.y + q.mh * (1 + 0.6 * bul) + VT * 0.35 * bul * (1 - q.mr) + Math.sin(t * 61 + q.ph * 2) * shk; return o; };
      const so = { x: 0, y: 0, z: 0 };
      const bombAt = (q, a, o) => { slot(q, so); o.x = so.x + q.v.x * a; o.z = so.z + q.v.z * a; o.y = so.y + q.v.y * a - 0.5 * G * a * a; return o; };
      const land = q => { slot(q, so); const sy = so.y - (FLOOR + q.s.y); return Math.min(q.melt, (q.v.y + Math.sqrt(q.v.y * q.v.y + 2 * G * Math.max(0, sy))) / G); };
      const bo = { x: 0, y: 0, z: 0 };
      // 꼬리·튀김: 앞쪽 NBT개 파편만
      const nb = Math.min(NBT, E.N);
      for (let b = 0; b < NBT; b++) {
        const q = b < nb ? E.par[b] : null, a = q ? t - q.tb : -1, la = q ? land(q) : 0;
        for (let j = 0; j < TL; j++) {
          const i = b * TL + j, aj = a - j * 0.017;
          if (!q || aj <= 0 || aj > la || t > T.retract) { trail.hide(i); continue; }
          bombAt(q, aj, bo); const k = 1 - j / TL; trail.set(i, bo.x, Math.max(FLOOR + 2, bo.y), bo.z, (q.s.x * 3.5 + 16) * (0.35 + 0.65 * k), 0.7 * k * (1 - seg(t, T.boom, T.retract)), 1, lerp(0.25, 0.6, k), 0.05);
        }
        for (let j = 0; j < NSPL; j++) {
          const i = b * NSPL + j, sa = a - la;
          if (!q || q.melt < Infinity || sa <= 0 || sa > 0.7 || t > T.retract) { splash.hide(i); continue; }
          bombAt(q, la, bo); const p = SPL[i], u = sa / 0.7;
          if (j === 0) splash.set(i, bo.x, FLOOR + 4, bo.z, (q.s.x * 6 + 40) * (0.6 + u), 0.7 * (1 - u), 1, 0.45, 0.08);
          else splash.set(i, bo.x + Math.cos(p.a) * p.v * 0.25 * sa, Math.max(FLOOR + 3, FLOOR + 3 + p.u * 0.6 * sa - 0.5 * G * sa * sa), bo.z + Math.sin(p.a) * p.v * 0.25 * sa, 9 * (1 - u), 0.9 * (1 - u), 1, 0.6, 0.15);
        }
      }
      trail.upd(); splash.upd();
      // 충격파
      { const u = seg(t, T.erupt, T.erupt + 0.8); shock.visible = u > 0 && u < 1; shock.position.set(0, FLOOR + 2, VZ); shock.scale.setScalar(Math.max(1, vw * 1.15 * eOut(u))); shock.material.opacity = 0.85 * Math.pow(1 - u, 1.5);
        const u2 = seg(t, T.erupt, T.erupt + 0.6); airShock.visible = u2 > 0 && u2 < 1; airShock.position.copy(top).add(V(0, 20, 40)); airShock.scale.setScalar(Math.max(1, vw * 1.1 * eOut(u2))); airShock.material.opacity = 0.45 * Math.pow(1 - u2, 2); }
      for (let i = 0; i < E.N; i++) {
        const q = E.par[i];
        let x = q.x, y = q.y, z = q.z, rx = q.rx, ry = q.ry, rz = q.rz;
        let k = 1;
        if (t > T.rumble && t < q.tg + 0.05) { const kk = seg(t, T.rumble, T.rumble + 0.4), h = Math.max(0, Math.sin(t * q.hf + q.ph)); y += h * h * q.ha * kk; rx += Math.sin(t * q.hf * 0.5 + q.ph) * 0.3 * kk; }
        if (t >= q.tb) {   // 분화: 더미에서 솟구치며 녹아 없어짐 · 안 녹은 건 용암 덩이로 떨어짐
          const a = t - q.tb; bombAt(q, a, bo); x = bo.x; y = bo.y; z = bo.z; rx += q.w.x * a; ry += q.w.y * a; rz += q.w.z * a;
          if (y < FLOOR + q.s.y) y = FLOOR + q.s.y;
          k = q.melt < Infinity ? 1 - eIn(seg(a, q.melt * 0.25, q.melt)) : lerp(1, 0.75, seg(a, 0, 0.6));
        } else if (t > q.tg) {   // 끌려 올라가 분화구 위 더미에 얹힘
          const u = seg(t, q.tg, q.tg + q.dg), e = eInOut(u); slot(q, so);
          x = lerp(x, so.x, e); z = lerp(z, so.z, e); y = lerp(y, so.y, e) + Math.sin(Math.PI * u) * q.arc; rx += 7 * e + q.w.x * 0.05 * e; ry += 5 * e;
        }
        E.setFrag(i, x, y, z, rx, ry, rz, q.s, Math.max(0.0001, k));
      }
      // 파편이 달아오름 (모든 파편 같이) · 분화 뒤엔 노랗게
      const hk = heatK(t), er = sstep(seg(t, T.erupt, T.erupt + 0.4));
      fireMat.emissive.setRGB(1, lerp(0.1, 0.22, er), 0.008); fireMat.emissiveIntensity = hk * (0.7 + 0.3 * er + 0.08 * Math.sin(t * 9));   // 너무 밝으면 톤 매핑에서 하얗게 바램
      fireMat.color.copy(col0).lerp(hotC, hk); fireMat.metalness = lerp(met0, 0, hk); fireMat.roughness = lerp(rough0, 1, hk); fireMat.envMapIntensity = lerp(envI0, 0, hk);   // 빛 색은 선형값 (화면에선 붉은 주황)
      // 화산
      const rs = eOut(seg(t, T.rise, T.rise + 1.0));
      volcano.position.y = FLOOR - VH * (1 - rs) + Math.sin(t * 41) * 4 * seg(t, T.rise, T.erupt) * (1 - seg(t, T.erupt, T.surge));
      volU.uT.value = t; volU.uLava.value = sstep(seg(t, T.erupt - 0.2, T.erupt + 0.8)); volU.uTop.value = sstep(seg(t, T.rise + 0.5, T.erupt));
      volcano.visible = rs > 0.001;
      // 불기둥
      const cA = sstep(seg(t, T.erupt - 0.05, T.erupt + 0.15)) * (1 - seg(t, T.boom, T.retract));
      column.visible = cA > 0.002; column.position.copy(top).add(V(0, -VH * 0.05, 0)); colU.uT.value = t; colU.uA.value = cA; colU.uH.value = eOut(seg(t, T.erupt, T.erupt + 0.45));
      column.scale.set(1 + 0.6 * seg(t, T.surge - 0.3, T.boom), 1, 1 + 0.6 * seg(t, T.surge - 0.3, T.boom));
      // 불꽃: 분화구에서 위로 · 덮칠 때는 화면 쪽으로 쏟아짐
      const su = seg(t, T.surge, T.boom + 0.2);
      for (let i = 0; i < NF; i++) {
        const p = FP[i];
        if (t < T.erupt || t > T.retract + 0.2) { fire.hide(i); continue; }
        if (su > 0 && p.sur < su * 1.1) {   // 화면 쪽으로
          const a = fract((t - T.surge) * 1.3 / p.P + p.o), x = top.x + p.vx * vw * 0.6 * a, y = top.y + (p.vy - 0.5) * vh * 0.4 * a, z = top.z + (D * 1.5) * a;
          fire.set(i, x, y, z, p.s * (1 + 2.5 * a), 0.5 * (1 - a * 0.6), 1, lerp(0.75, 0.3, a), 0.1);
          continue;
        }
        const a = fract((t - T.erupt) / (p.P * 0.9) + p.o), k = sstep(seg(t, T.erupt, T.erupt + 0.3));
        const x = top.x + p.vx * VT * (0.6 + 4 * a), y = top.y + p.vy * vh * 1.25 * a, z = top.z + p.vz * VT * (0.6 + 4 * a);
        fire.set(i, x, y, z, p.s * (0.6 + 1.6 * a), 0.4 * k * (1 - a) * (1 - seg(t, T.boom, T.retract)), 1, lerp(0.85, 0.25, a), lerp(0.35, 0.02, a));
      }
      fire.upd();
      for (let i = 0; i < NE; i++) {   // 바닥에서 오르는 불티
        const p = EP[i], a = fract((t - T.heat) / p.P + p.o), k = sstep(seg(t, T.heat, T.heat + 0.8)) * (1 - seg(t, T.retract, T.end));
        if (k <= 0) { emb.hide(i); continue; }
        emb.set(i, p.x + Math.sin(t * p.w + p.ph) * 26, FLOOR + a * vh * 1.1, p.z, p.s * (1 - a * 0.5), 0.9 * k * Math.sin(Math.PI * a), 1, 0.55, 0.12);
      }
      emb.upd();
      for (let i = 0; i < NS; i++) {   // 검은 연기
        const p = SP[i], a = fract((t - T.erupt) / p.P + p.o), k = sstep(seg(t, T.erupt + 0.2, T.erupt + 0.9)) * (1 - seg(t, T.surge, T.boom));
        if (k <= 0) { smoke.hide(i); continue; }
        smoke.set(i, top.x + p.vx * vw * 0.35 * a, top.y + vh * 0.25 + a * vh * 0.9, top.z + p.vz * 200 - 60, p.s * (0.7 + 1.5 * a), 0.55 * k * Math.sin(Math.PI * Math.min(1, a * 1.3)), 0.06, 0.035, 0.03);
      }
      smoke.upd();
    },
    light(t, E) {
      const { dir, p1, p2 } = E.L, dk = E.dk, er = sstep(seg(t, T.erupt, T.erupt + 0.3)) * (1 - seg(t, T.boom, T.retract));
      dir.color.setRGB(1, 0.35, 0.1); dir.intensity = 3.2 * dk;
      p1.color.setRGB(1, 0.4, 0.08); p1.position.set(0, FLOOR + 120, 80); p1.intensity = dk * (1.5 * heatK(t) + 0.6 * Math.sin(t * 11) * heatK(t));
      p2.color.setRGB(1, 0.55, 0.15); p2.position.copy(TOP()).add(V(0, vh * 0.2, 300)); p2.intensity = 6 * er * (0.85 + 0.15 * Math.sin(t * 17)) + 8 * seg(t, T.surge, T.boom);
      flU.uT.value = t; flU.uA.value = 0.97 * dk; flU.uProg.value = 0.3 * eOut(seg(t, T.seal, T.heat)) + 0.8 * eOut(seg(t, T.heat, T.rumble + 0.6));
      bgU.uHeat.value = 0.4 * dk + 0.6 * heatK(t); bgU.uV.value.copy(E.toScreen(TOP())); bgU.uErupt.value = er + 1.2 * Math.exp(-Math.max(0, t - T.erupt) * 6) * (t >= T.erupt ? 1 : 0);
      bgU.uFlood.value = sstep(seg(t, T.boom - 0.15, T.boom + 0.05)) * (1 - sstep(seg(t, T.boom + 0.15, T.retract + 0.2)));
    },
    beats(t, E) {
      const { snd } = E.ctx;
      if (t >= T.heat) E.once("heat", () => sn.sizzle(T.erupt - T.heat + 1));
      if (t >= T.rumble) E.once("rum", () => { snd.rumble(T.erupt - T.rumble + 0.3); buzz([2, 70, 2, 70, 3, 70, 3, 70, 3, 70, 3, 70, 3]); });
      if (t >= T.gather) E.once("gat", () => { snd.whoosh(1.3); buzz(2); });
      for (let i = 0; i < 10; i++) if (t >= T.gather + 0.55 + i * 0.09) E.once("tk" + i, () => snd.tink(0.6 + Math.random() * 0.4));
      if (t >= T.erupt - 0.75) E.once("swell", () => { snd.rumble(0.8); buzz([2, 60, 2, 60, 3, 60, 3]); });
      if (t >= T.erupt) E.once("erupt", () => { sn.erupt(); buzz([3, 30, 3, 30, 3, 90, 3]); E.shake = 28; E.freeze = 0.08; });
      if (t >= T.erupt + 0.5) E.once("roar", () => sn.roar(T.boom - T.erupt));
      for (let i = 0; i < 6; i++) if (t >= T.erupt + 0.5 + i * 0.22) E.once("thud" + i, () => { sn.thud(); buzz(1); });
      if (t >= T.surge) E.once("surge", () => { snd.launch(); buzz([3, 40, 3, 40, 3]); E.shake = 20; E.titleOff(); });
      if (t >= T.end - 0.02) E.once("cool", () => { fireMat.emissive.copy(emis0); fireMat.emissiveIntensity = emisI0; fireMat.color.copy(col0); fireMat.metalness = met0; fireMat.roughness = rough0; fireMat.envMapIntensity = envI0; });
    },
    cam(t, E) {
      const { cp, cl } = E;
      const k2 = eInOut(seg(t, T.rumble, T.erupt)); cp.lerp(V(0, -vh * 0.06, D * 1.1), k2); cl.lerp(V(0, vh * 0.12, 0), k2);
      const k3 = eInOut(seg(t, T.erupt, T.erupt + 1.2)); cp.lerp(V(0, -vh * 0.08, D * 1.18), k3); cl.lerp(V(0, vh * 0.2, -100), k3);
      const k4 = eIn(seg(t, T.surge, T.boom)); cp.z -= D * 0.15 * k4;
      E.amp = 6 * seg(t, T.rumble, T.rumble + 0.3) * (1 - seg(t, T.erupt + 0.6, T.surge)) + 5 * seg(t, T.erupt, T.erupt + 0.1) * (1 - seg(t, T.boom, T.retract)) + 4 * seg(t, T.surge, T.boom);
    },
  };

  // ── 손: 산 모양 인 → 인을 풀고 손바닥을 위로 들어 올림(화산이 솟음) → 분화 때 움찔 → 두 손을 앞으로 내밀어 불길을 보냄 ──
  const Q_FACE = Q(0, Math.PI / 2, 0);
  const seal = (gap, zoff, y, z, side) => { const qc = Q(0.12, 0.42 * side * 0 + 0.42, 0); return key2(V(-(gap / 2 + PALM_Z * HS), 0, -zoff / 2).applyQuaternion(qc).add(V(0, y, z)), qc.multiply(Q_FACE), [0.55, 0.35]); };
  const KS = {
    start: key2(V(-vw * 0.55, -vh / 2 - S * 2.3, 60), Q(0.7, 0.6, -0.6)),
    ready: seal(0.024 * K + S * 0.32, 0.011 * K, -vh * 0.06, 110, 1),
    sign: seal(0.024 * K, 0.011 * K, -vh * 0.06, 110, 1),
    lift: key2(V(-vw * 0.3, -vh * 0.2, 150), Q(-1.25, 0.3, 0.15), [0.2, 0.05]),
    up: key2(V(-vw * 0.32, -vh * 0.08, 150), Q(-1.1, 0.35, 0.1), [0.25, 0.05]),
    push: key2(V(-S * 0.9, -vh * 0.12, 250), Q(-0.35, 0.25, 0.1), [0.05, 0]),
    exit: key2(V(-vw * 0.45, -vh / 2 - S * 2.5, 120), Q(0.6, 0.5, -0.3)),
  };
  function hands(t) {
    for (const [rg, sd] of [[R, 1], [L, -1]]) {
      placeHand(rg, KS, [["ready", eBack(seg(t, 0.05, 0.72), 1.1)], ["sign", eIn(seg(t, T.seal - 0.13, T.seal))], ["lift", eInOut(seg(t, T.rumble - 0.2, T.rise + 0.1))], ["up", eInOut(seg(t, T.rise + 0.1, T.erupt - 0.1))], ["push", eOut(seg(t, T.surge - 0.15, T.surge + 0.1))], ["exit", eIn(seg(t, T.boom, T.retract + 0.3))]],
        [[PRE, sstep(seg(t, 0.3, 0.85))], [PEAK, eIn(seg(t, T.seal - 0.13, T.seal))], [LIFT, eOut(seg(t, T.rumble - 0.2, T.rumble + 0.1))], [POSE.claw, sstep(seg(t, T.rise + 0.2, T.erupt)) * 0.6], [POSE.spread, eOut(seg(t, T.surge - 0.1, T.surge + 0.06))], [POSE.relax, sstep(seg(t, T.boom + 0.3, T.retract))]],
        HS, xf => {
          const rs = t - T.seal; if (rs > 0 && rs < 1.2) { const a = Math.exp(-rs * 6) * Math.sin(rs * 34); xf.p.y -= S * 0.05 * a; xf.p.z -= 18 * a; }
          const er = t - T.erupt; if (er > 0 && er < 1) { const a = Math.exp(-er * 5) * Math.sin(er * 26); xf.p.y -= S * 0.12 * a; xf.p.z -= 30 * a; }
          xf.p.y += S * 0.25 * eInOut(seg(t, T.rise, T.erupt)) * (1 - seg(t, T.surge - 0.15, T.surge));
          tremble(xf, t, sd, (t > T.seal && t < T.rumble ? 0.3 + seg(t, T.seal, T.rumble) : 0) + 1.6 * seg(t, T.rumble, T.erupt) * (t < T.erupt ? 1 : 0) + 0.8 * seg(t, T.erupt, T.surge) * (t < T.surge ? 1 : 0));
        });
    }
  }

  let sn = null;
  const mkSound = get => {
    const S2 = synth(get);
    return {
      sizzle: d => S2.play((a, t) => { S2.noise(a, t, "highpass", 3000, 5000, 0.7, 0.18, d * 0.4, d); S2.noise(a, t, "bandpass", 900, 500, 1.5, 0.2, d * 0.5, d); for (let i = 0; i < 40; i++) { const at = t + Math.random() * d; S2.noise(a, at, "bandpass", rnd(1500, 5000), rnd(800, 2500), 3, 0.08, 0.002, 0.04); } }),
      erupt: () => S2.play((a, t) => { S2.tone(a, t, "sine", 48, 18, 1, 0.003, 2.4); S2.noise(a, t, "lowpass", 2200, 60, 0.7, 1, 0.004, 2.2); S2.noise(a, t, "bandpass", 400, 120, 1, 0.6, 0.01, 1.4); S2.tone(a, t, "sawtooth", 70, 30, 0.2, 0.01, 1.2); }),
      roar: d => S2.play((a, t) => { S2.noise(a, t, "lowpass", 400, 900, 0.8, 0.6, 0.3, d + 0.4); S2.noise(a, t, "bandpass", 600, 1800, 0.7, 0.3, d * 0.6, d + 0.4); S2.tone(a, t, "sine", 40, 34, 0.5, 0.3, d + 0.4); }),
      thud: () => S2.play((a, t) => { S2.tone(a, t, "sine", rnd(90, 140), 40, 0.5, 0.004, 0.35); S2.noise(a, t, "lowpass", 1500, 100, 0.7, 0.4, 0.004, 0.3); S2.noise(a, t + 0.02, "highpass", 3000, 2000, 1, 0.12, 0.002, 0.3); }),
    };
  };

  const api = domainBase(c, def);
  objs.forEach(api.E.add);
  const start0 = api.start;
  api.start = o => { sn = mkSound(o.sfx); [floor, fire.mesh, emb.mesh, smoke.mesh, trail.mesh, splash.mesh].forEach(m => (m.visible = true)); start0(o); };
  return api;
}
