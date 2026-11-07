// 화성 연출의 로드스터: 받은 옆모습 사진의 윤곽을 그대로 따라 3D 차체를 만들고, 사진을 옆면에 입힘.
// 윗면·앞·뒤는 사진의 색과 디자인에 맞춰 직접 그려 위치에 따라 섞음. 바퀴는 사진에서 잘라 돌아감.
// 아래 네 귀퉁이와 뒤 번호판 속에 분사구가 있어 연기를 뿜으며 뜸 (번호판이 젖혀지며 뒤 분사구가 나옴).
// 좌표: 앞 +z, 위 +y, 운전석 왼쪽 +x, 단위 미터, 바퀴 바닥이 y=0.
import * as THREE from "three";
import urlSide from "./assets/rd-side.webp?url";
import urlWheel from "./assets/rd-wheel.webp?url";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 사진 좌표 (8.jpg)
const TOP = [[78,396],[84,380],[96,364],[112,350],[140,338],[170,328],[200,318],[240,306],[290,297],[320,285],[360,268],[400,254],[440,245],[480,240],[520,237],[560,236],[600,238],[640,241],[680,245],[720,250],[760,255],[800,260],[840,266],[880,270],[920,275],[985,277],[1000,270],[1020,260],[1060,250],[1090,244],[1130,243],[1175,250],[1195,262],[1207,295],[1215,340],[1217,396]];
const BOT = [[78,398],[80,440],[86,462],[100,478],[190,484],[400,488],[900,488],[1150,486],[1195,470],[1212,440],[1217,398]];
const WD = [[78,0.56],[84,0.66],[96,0.74],[130,0.82],[200,0.9],[282,0.95],[400,0.93],[650,0.94],[900,0.98],[1052,1.03],[1150,1.0],[1195,0.93],[1210,0.84],[1217,0.74]];
const BELT = [[78,400],[130,352],[200,332],[290,306],[400,306],[600,314],[800,308],[900,292],[985,284],[1060,270],[1130,264],[1200,290],[1217,400]];
const RW = [[78,0.42],[200,0.66],[290,0.76],[400,0.68],[560,0.61],[800,0.56],[985,0.54],[1100,0.66],[1217,0.6]];
const SC = 4.4 / 1140, ZC = 648, YB = 508, toZ = px => (ZC - px) * SC, toY = py => (YB - py) * SC;
const cv = (T, x) => { if (x <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (x <= T[i][0]) { const [a, b] = T[i - 1], [c, d] = T[i]; return b + (d - b) * (x - a) / (c - a); } return T[T.length - 1][1]; };
export const CAR = { len: 4.4, roofY: toY(236), wheelR: 100 * SC, zF: toZ(282), zR: toZ(1052), noseZ: toZ(78), tailZ: toZ(1217) };

function sec(px) {
  const yb = toY(cv(BOT, px)), yt = toY(cv(TOP, px)), w = cv(WD, px), be = Math.min(toY(cv(BELT, px)), yt - 0.012), rw = Math.min(cv(RW, px), w * 0.9), o = [], H = Math.max(be - yb, 0.02), e = 2 / 5;
  for (let i = 0; i <= 13; i++) { const a = (i / 13) * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); o.push([w * Math.pow(s, e), yb + H * 0.5 * (1 - Math.pow(c, e))]); }
  for (let i = 1; i <= 10; i++) { const u = i / 10; o.push([w * (1 - 0.07 * u * u), yb + H * (0.5 + 0.5 * u)]); }
  const x0 = w * 0.93, y0 = be, yr = be + (yt - be) * 0.78;
  for (let i = 1; i <= 4; i++) { const u = i / 4; o.push([lerp(x0, rw, u), lerp(y0, yr, u)]); }
  for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; o.push([rw * Math.cos(a), yr + (yt - yr) * Math.sin(a)]); }
  return o;
}
function bodyGeo() {
  const NS = 190, NH = 33, M = NH * 2, rows = [];
  for (let i = 0; i <= NS; i++) { const u = i / NS, c = 0.5 - 0.5 * Math.cos(Math.PI * u), px = 78 + 1139 * (0.55 * c + 0.45 * u); rows.push({ px, s: sec(px) }); }
  for (let it = 0; it < 3; it++) for (let i = 1; i < NS; i++) for (let j = 0; j <= NH; j++) { const a = rows[i - 1].s[j], b = rows[i].s[j], c = rows[i + 1].s[j]; b[0] = b[0] * 0.5 + (a[0] + c[0]) * 0.25; b[1] = b[1] * 0.7 + (a[1] + c[1]) * 0.15; }
  const pos = [], idx = [], well = [];
  const WC = [[toZ(282), toY(409)], [toZ(1052), toY(409)]], r0 = 100 * SC * 1.07, ss = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  for (const { px, s } of rows) { const z = toZ(px); for (let j = 0; j < M; j++) { const k = j <= NH ? j : M - j, sg = j <= NH ? 1 : -1; let [x, y] = s[k], wl = 0; if (x > 0.32) for (const [zc, yc] of WC) { const d = Math.hypot(z - zc, y - yc), q = 1 - ss((d - r0 * 0.9) / (r0 * 0.3)); if (q > 0) { x -= q * Math.min(0.33, x - 0.3); wl = Math.max(wl, q); } } pos.push(x * sg, y, z); well.push(wl); } }
  for (let i = 0; i < NS; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + ((j + 1) % M), c = a + M, d = b + M; idx.push(a, b, c, b, d, c); }
  // 코와 꼬리 막기
  const cap = (r, flip) => { const c = pos.length / 3; let cx = 0, cy = 0, cz = 0; for (let j = 0; j < M; j++) { cx += pos[(r * M + j) * 3]; cy += pos[(r * M + j) * 3 + 1]; cz += pos[(r * M + j) * 3 + 2]; } pos.push(cx / M, cy / M, cz / M); well.push(0); for (let j = 0; j < M; j++) { const a = r * M + j, b = r * M + ((j + 1) % M); flip ? idx.push(c, b, a) : idx.push(c, a, b); } };
  cap(0, false); cap(NS, true);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aWell", new THREE.Float32BufferAttribute(well, 1)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// 왼쪽은 사진 그대로, 오른쪽은 좌우를 뒤집되 글자는 바로 보이게 다시 붙임
function sideTex(img) {
  const W = img.width, H = img.height, c = document.createElement("canvas"); c.width = W; c.height = H * 2; const x = c.getContext("2d"), K = W / 1156, ph = (a, b, w, h) => [(a - 70) * K, (b - 226) * K, w * K, h * K];
  x.drawImage(img, 0, 0); x.save(); x.translate(W, H); x.scale(-1, 1); x.drawImage(img, 0, 0); x.restore();
  for (const [a, b, w, h] of [[838, 452, 130, 40], [1125, 238, 70, 36], [920, 286, 48, 24]]) { const [sx, sy, sw, sh] = ph(a, b, w, h); x.drawImage(img, sx, sy, sw, sh, W - sx - sw, H + sy, sw, sh); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function topTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 1024; const x = c.getContext("2d"), X = m => 256 + (m / 1.15) * 256, Y = z => 512 - (z / 2.3) * 512;
  const g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, "#d8e4ff"); g.addColorStop(0.07, "#3a48c8"); g.addColorStop(0.3, "#2c34a0"); g.addColorStop(0.42, "#3478d8"); g.addColorStop(0.72, "#46b8f4"); g.addColorStop(1, "#6ad4fb"); x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
  // 유리 지붕
  const P = []; for (let px = 290; px <= 985; px += 25) P.push([cv(RW, px) * 1.04, toZ(px)]); x.beginPath(); P.forEach(([a, z], i) => (i ? x.lineTo(X(a), Y(z)) : x.moveTo(X(a), Y(z)))); P.slice().reverse().forEach(([a, z]) => x.lineTo(X(-a), Y(z))); x.closePath();
  const gl = x.createLinearGradient(0, Y(toZ(290)), 0, Y(toZ(985))); gl.addColorStop(0, "#060a24"); gl.addColorStop(0.35, "#0c1236"); gl.addColorStop(0.55, "#04060f"); gl.addColorStop(1, "#0a1030"); x.fillStyle = gl; x.fill(); x.strokeStyle = "#ff7fb4"; x.lineWidth = 5; x.stroke();
  x.strokeStyle = "rgba(255,120,170,.55)"; x.lineWidth = 2; for (const z of [toZ(420), toZ(780)]) { x.beginPath(); x.moveTo(X(-0.6), Y(z)); x.lineTo(X(0.6), Y(z)); x.stroke(); }
  // 보닛 주름 · 뒤쪽 틈
  x.strokeStyle = "rgba(120,220,255,.75)"; x.lineWidth = 3; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(X(s * 0.3), Y(2.1)); x.quadraticCurveTo(X(s * 0.56), Y(1.5), X(s * 0.62), Y(1.26)); x.stroke(); }
  x.fillStyle = "rgba(4,8,30,.85)"; for (let i = 0; i < 6; i++) x.fillRect(X(-0.45), Y(-1.5 - i * 0.09), X(0.45) - X(-0.45), 8);
  x.strokeStyle = "rgba(255,120,170,.9)"; x.lineWidth = 5; for (const s of [-1, 1]) { x.beginPath(); for (let px = 150; px <= 1190; px += 20) { const a = cv(WD, px) * 0.93 * s, z = toZ(px); px === 150 ? x.moveTo(X(a), Y(z)) : x.lineTo(X(a), Y(z)); } x.stroke(); }
  x.strokeStyle = "rgba(255,70,90,.9)"; x.lineWidth = 8; x.beginPath(); x.moveTo(X(-0.82), Y(-2.18)); x.lineTo(X(0.82), Y(-2.18)); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function endTex() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const x = c.getContext("2d"), H = 512, Y = y => H - (y / 1.12) * H, F = 256, R = 768, S = 512 / 2.2;
  // 앞
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2c3aa8"); g.addColorStop(0.5, "#b8c8ff"); g.addColorStop(0.62, "#7f90e8"); g.addColorStop(1, "#141848"); x.fillStyle = g; x.fillRect(0, 0, 512, H);
  x.fillStyle = "#04060f"; x.beginPath(); x.roundRect(F - 0.62 * S, Y(0.3), 1.24 * S, 0.17 * H / 1.12 * 1.0, 12); x.fill();
  x.fillStyle = "#fff"; x.shadowColor = "#a8d8ff"; x.shadowBlur = 26; x.fillRect(F - 0.7 * S, Y(0.45), 1.4 * S, 7); x.shadowBlur = 0;
  // 뒤
  g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2d7fd0"); g.addColorStop(0.4, "#0e1a44"); g.addColorStop(1, "#05070f"); x.fillStyle = g; x.fillRect(512, 0, 512, H);
  x.shadowColor = "#ff2a3c"; x.shadowBlur = 30; x.fillStyle = "#ff3347"; x.fillRect(R - 0.84 * S, Y(0.82), 1.68 * S, 11); x.shadowBlur = 0; x.fillStyle = "#e8eefc"; x.font = '900 34px "Noto Sans KR",sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("T E S L A", R, Y(0.72));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function plateTex() { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#eef2fa"; x.fillRect(0, 0, 256, 128); x.strokeStyle = "#101828"; x.lineWidth = 6; x.strokeRect(5, 5, 246, 118); x.fillStyle = "#101828"; x.font = '900 62px "Noto Sans KR",sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("MARS", 128, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function glowTex() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.22, "rgba(255,255,255,.5)"); g.addColorStop(0.6, "rgba(255,255,255,.08)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// 분사구 바로 앞의 빠른 가스: 끝으로 갈수록 옅어지고 충격파 무늬가 떨림
const JET_VS = "varying vec2 vU; varying vec3 vN, vV; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }";
const JET_FS = `uniform float uA, uT; uniform vec3 uC; varying vec2 vU; varying vec3 vN, vV;
void main(){ float l = 1.0 - vU.y, f = pow(abs(dot(normalize(vN), normalize(vV))), 1.5), d = 0.55 + 0.45 * sin(l * 30.0 - uT * 46.0) * exp(-l * 3.0), a = uA * f * d * pow(1.0 - l, 1.5) * smoothstep(0.0, 0.04, l); gl_FragColor = vec4(uC * a, a); }`;

export async function buildRoadster() {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = urlSide; });
  const whT = await new THREE.TextureLoader().loadAsync(urlWheel); whT.colorSpace = THREE.SRGBColorSpace; whT.anisotropy = 8;
  const tSide = sideTex(img), tTop = topTex(), tEnd = endTex(), tPlate = plateTex(), glw = glowTex();
  const U = { uSide: { value: tSide }, uTop: { value: tTop }, uEnd: { value: tEnd }, uEm: { value: 0.72 } };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 0.8 });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aWell; varying float vWl; varying vec3 vOP, vON;").replace("#include <begin_vertex>", "#include <begin_vertex>\n vOP = position; vON = normal; vWl = aWell;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying float vWl; varying vec3 vOP, vON; uniform sampler2D uSide, uTop, uEnd; uniform float uEm; vec3 carCol;
vec3 carPaint(){ vec3 n = normalize(vON), a = abs(n);
  float px = ${ZC.toFixed(1)} - vOP.z / ${SC.toFixed(6)}, py = ${YB.toFixed(1)} - vOP.y / ${SC.toFixed(6)}, u = (px - 70.0) / 1156.0, v = clamp((py - 226.0) / 290.0, 0.002, 0.998);
  vec3 cs = texture2D(uSide, vOP.x < 0.0 ? vec2(1.0 - u, 0.5 - v * 0.5) : vec2(u, 1.0 - v * 0.5)).rgb;
  vec3 ct = texture2D(uTop, vec2(vOP.x / 2.3 + 0.5, vOP.z / 4.6 + 0.5)).rgb;
  vec3 ce = texture2D(uEnd, vec2((vOP.x / 2.2 + 0.5) * 0.5 + (n.z > 0.0 ? 0.0 : 0.5), vOP.y / 1.12)).rgb;
  vec3 cb = vec3(0.012, 0.016, 0.03);
  float ws = pow(a.x, 2.0) + 0.0001, wt = pow(max(n.y, 0.0), 3.0) * 1.6, we = pow(a.z, 5.0) * 1.4, wb = pow(max(-n.y, 0.0), 3.0) * 1.6;
  float dw = min(length(vec2(vOP.z - (1.4126), vOP.y - 0.3821)), length(vec2(vOP.z - (-1.5593), vOP.y - 0.3821)));
  float well = smoothstep(0.012, 0.0, dw - 0.416) * step(0.02, vWl + a.x); vec3 cc = (cs * ws + ct * wt + ce * we + cb * wb) / (ws + wt + we + wb); cc = mix(cc, vec3(1.0, 0.42, 0.68), smoothstep(0.016, 0.0, abs(dw - 0.424)) * 0.7 * step(0.5, a.x)); return mix(cc, vec3(0.006, 0.008, 0.016), well); }`)
      .replace("#include <color_fragment>", "#include <color_fragment>\n carCol = carPaint(); diffuseColor.rgb = carCol * 0.3;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += carCol * uEm;")
      .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\n material.clearcoat *= clamp(0.5 + normalize(vON).y * 2.0, 0.0, 1.0) * (1.0 - smoothstep(0.02, 0.2, vWl)); { float und = smoothstep(0.15, 0.7, -normalize(vON).y); material.specularF90 *= 1.0 - und; material.specularColor *= 1.0 - und; }"); };
  mat.customProgramCacheKey = () => "roadsterBody";
  const root = new THREE.Group(), body = new THREE.Mesh(bodyGeo(), mat); body.castShadow = body.receiveShadow = true; root.add(body);
  // ── 바퀴 ──
  const R = CAR.wheelR, TW = 0.25, tire = new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 0.74 }), disc = new THREE.MeshStandardMaterial({ map: whT, emissive: 0xffffff, emissiveMap: whT, emissiveIntensity: 0.55, roughness: 0.42, metalness: 0.2 });
  const tG = new THREE.CylinderGeometry(R, R, TW, 44, 1, true).rotateZ(Math.PI / 2), dG = new THREE.CircleGeometry(R * 0.985, 44), wheels = [];
  for (const z of [CAR.zF, CAR.zR]) for (const s of [-1, 1]) { const g = new THREE.Group(), w = cv(WD, z === CAR.zF ? 282 : 1052) - TW / 2 - 0.045; g.position.set(s * w, R, z); const tt = new THREE.Mesh(tG, tire), d = new THREE.Mesh(dG, disc); d.rotation.y = s * Math.PI / 2; d.position.x = s * (TW / 2 + 0.002); g.add(tt, d); root.add(g); wheels.push(g); }
  // ── 분사구 ──
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.4, metalness: 0.8 }), NOZ = [], jets = [], glows = [], up = V(0, 1, 0);
  const coneG = new THREE.ConeGeometry(1, 1, 20, 1, true).translate(0, -0.5, 0), bell = new THREE.CylinderGeometry(0.09, 0.115, 0.06, 20, 1, true);
  const nozzle = (p, d, kind, r, len, col) => { const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().negate()); if (kind === "lift" || kind === "main") { const n = new THREE.Mesh(bell, dark); n.position.copy(p); n.quaternion.copy(q); n.scale.setScalar(r / 0.115); root.add(n); }
    const U2 = { uA: { value: 0 }, uT: { value: 0 }, uC: { value: new THREE.Color(col) } }, j = new THREE.Mesh(coneG, new THREE.ShaderMaterial({ uniforms: U2, vertexShader: JET_VS, fragmentShader: JET_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); j.position.copy(p).addScaledVector(d, 0.05); j.quaternion.copy(q); j.scale.set(r * 1.4, len, r * 1.4); j.frustumCulled = false; root.add(j); jets.push({ j, U2, kind, len, r });
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: col, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending })); g.position.copy(p).addScaledVector(d, 0.1); g.scale.setScalar(r * 7); root.add(g); glows.push({ g, kind }); NOZ.push({ p: p.clone().addScaledVector(d, 0.08), d: d.clone(), kind, r }); };
  for (const s of [-1, 1]) { nozzle(V(s * 0.6, 0.14, 1.32), V(0, -1, 0), "lift", 0.1, 1.1, 0xbfe4ff); nozzle(V(s * 0.62, 0.14, -1.28), V(0, -1, 0), "lift", 0.1, 1.1, 0xbfe4ff); nozzle(V(s * 0.2, 0.12, 0.05), V(0, -1, 0), "lift", 0.075, 0.8, 0xbfe4ff); }
  nozzle(V(0, 0.52, CAR.tailZ - 0.02), V(0, 0, -1), "main", 0.15, 2.4, 0xd4eeff);
  for (const s of [-1, 1]) { nozzle(V(s * 0.28, 0.55, CAR.tailZ - 0.01), V(0, 0, -1), "main", 0.09, 1.5, 0xd4eeff); nozzle(V(s * 0.92, 0.48, 1.62), V(s, 0, 0), "rcs", 0.04, 0.5, 0xe8f4ff); nozzle(V(s * 0.98, 0.5, -1.72), V(s, 0, 0), "rcs", 0.04, 0.5, 0xe8f4ff); nozzle(V(s * 0.42, 0.42, CAR.noseZ + 0.02), V(0, 0, 1), "brake", 0.06, 0.9, 0xe8f4ff); }
  // 번호판: 젖혀지며 뒤 분사구가 드러남
  const plate = new THREE.Group(), pm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.012), [dark, dark, dark, dark, dark, new THREE.MeshStandardMaterial({ map: tPlate, roughness: 0.5, emissive: 0xffffff, emissiveMap: tPlate, emissiveIntensity: 0.35 })]); pm.position.y = -0.11; plate.add(pm); plate.position.set(0, 0.64, CAR.tailZ - 0.09); root.add(plate);
  // ── 불빛 ──
  const lamp = (p, col, s) => { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glw, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); g.position.copy(p); g.scale.setScalar(s); root.add(g); return g; };
  const lamps = [lamp(V(0.5, 0.44, CAR.noseZ + 0.06), 0xbfe4ff, 0.8), lamp(V(-0.5, 0.44, CAR.noseZ + 0.06), 0xbfe4ff, 0.8), lamp(V(0.96, 0.42, 0.54), 0xcfe6ff, 0.5), lamp(V(-0.96, 0.42, 0.54), 0xcfe6ff, 0.5), lamp(V(0.7, 0.84, CAR.tailZ - 0.06), 0xff2a3c, 0.5), lamp(V(-0.7, 0.84, CAR.tailZ - 0.06), 0xff2a3c, 0.5)];
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  // lift·main: 0~1 분사 세기 · rcs·brake: 짧게 뿜는 세기
  function jetsOn(st, t) { for (const q of jets) { const k = st[q.kind] || 0; q.j.visible = k > 0.01; q.U2.uA.value = k * (0.75 + 0.25 * Math.sin(t * 71 + q.r * 40)); q.U2.uT.value = t; q.j.scale.y = q.len * (0.75 + 0.25 * k + 0.06 * Math.sin(t * 53 + q.r * 90)); } for (const q of glows) { const k = st[q.kind] || 0; q.g.visible = k > 0.01; q.g.material.opacity = k * (0.62 + 0.14 * Math.sin(t * 61)); } }
  const flap = k => { plate.rotation.x = k * 1.75; };
  const spin = a => { for (const w of wheels) w.rotation.x += a; };
  const paint = v => { U.uEm.value = v; };
  function dispose() { root.traverse(o => { if (o.isMesh || o.isSprite) { if (o.geometry && !o.isSprite) o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } }); for (const t of [tSide, tTop, tEnd, tPlate, glw, whT]) t.dispose(); }
  return { root, body, NOZ, wheels, lamps, jetsOn, flap, spin, paint, dispose };
}
