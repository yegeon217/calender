// 태양 (3D): 화면의 달력이 그대로 3D 종이 한 장이 되어 하늘(구름 바다 위 한낮)에 뜸 →
// ① 오른쪽에서 윌 스미스가 싸대기 → 오른쪽 짜부 ② 왼쪽에서 (좌우 뒤집은) 윌 스미스가 싸대기 → 왼쪽 짜부 ③ 스티브 잡스가 아이폰을 던져 아래쪽 짜부
// ④ 이재용 · 젠슨 황이 닭다리로 망치질 (탁 · 탁) → 위쪽 짜부 ⑤ 그다음부터 셋 중 아무나, 온 방향에서 점점 빨리 때림 → 뭉치가 작아지며 벌겋게 달았다 식어 쇠구슬
// ⑥ 윌 스미스가 마지막 싸대기로 구슬을 하늘로 날림 → 구름을 뚫고 대기권을 지나 우주로
// ⑦ 지구 · 화성(일론 머스크가 서 있음) · 목성 · 토성 · 천왕성 · 해왕성을 차례로 뚫음 — 뚫린 행성은 금이 번지고 무너지며 충격파와 함께 터짐
// ⑧ 해의 중력에 끌려 되돌아옴 (터진 행성 조각들 사이를 지남) → 금성 · 수성을 뚫고 해 속으로 쏙 → 조용... 부글부글 끓다가 → 해에서 불꽃 손이 솟아 따봉.
// 윌 스미스 사진은 왼쪽 뒤에서 찍은 뒷모습뿐이라 늘 그쪽에서만 찍음 (얼굴이 보이는 쪽으로는 돌리지 않음). 나머지는 앞에서.
// 처음 한 장면은 달력이 화면과 1:1로 겹침 · 하늘 장면 단위는 미터(M = 1미터의 화면 픽셀) · 우주 장면은 따로 (해 = 원점).
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { loadHand, preloadHand } from "./hand.js";
import { buildElon } from "./elon.js";
import { makeNoise3D, preloadVol, buildPlume } from "./plume.js";
import { buildEarth, buildMars, marsShards } from "./planets.js";
import { makeBody, bakeBodies, disposeBodies, addBlend } from "./bh-bodies.js";
import { glowPoints, streaks, billboard, glowFS, ringFS, cloudSprite, gauss } from "./bh-fx.js";
import { buildPerson, buildDrumstick, buildPhone } from "./sun-cast.js";
import { makePost, buildDaySky, shardPlanet, crackShell, shockRing, shockShell, rockField, boilShell, plasmaMat, disposeCracks } from "./sun-fx.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V, buzz, vnoise } from "./fx-util.js";

const sm01 = x => sstep(clamp(x, 0, 1));
const T0 = {
  pull: 0.12, w1a: 0.45, w1: 1.2, w2a: 1.65, w2: 2.4, ja: 2.75, jr: 3.3, jb: 3.58, c1a: 3.85, c1: 4.5, c2: 4.86, f0: 5.25, ff: 7.35, f1: 11.75, ting: 12.15,
  fsa: 12.5, fs: 13.45, up0: 13.5, brk: 15.6,
  e0: 15.7, eX: 16.12, e1: 16.6, m0: 16.6, mH: 17.3, mX: 17.55, m1: 18.15, j0: 18.15, jH: 18.42, jX: 18.6, j1: 19.05, s0: 19.05, sH: 19.32, sX: 19.5, s1: 19.95,
  u0: 19.95, uH: 20.2, uX: 20.37, u1: 20.8, n0: 20.8, nH: 21.05, nX: 21.22, n1: 21.7, tn0: 21.7, tn1: 23.55, rt0: 23.55, rt1: 26.35,
  v0: 26.35, vH: 26.62, vX: 26.79, v1: 27.25, me0: 27.25, meH: 27.5, meX: 27.66, me1: 28.1, sn0: 28.1, plop: 29.3, boil0: 30.35, hand0: 32.5, thumb: 33.5, end: 36.15,
};
const BR = 0.15, SUNR = 40, FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const SKY_SUN = V(-0.45, 0.62, 0.64).normalize();
// 행성 자리 (해 = 원점 · 바깥 = +x) · 반지름
const PL = { earth: [300, 4], mars: [420, 2.6], jupiter: [620, 13], saturn: [860, 11], uranus: [1060, 6], neptune: [1220, 5.8], venus: [200, 3.4], mercury: [130, 1.8] };

// ── 인물 · 소품 (한 번만 만들어 둠) ──
let rigP = null;
const getRig = () => rigP || (rigP = (async () => {
  const hand = () => loadHand(new THREE.MeshStandardMaterial()), two = () => Promise.all([hand(), hand()]);
  const mk = async who => buildPerson(who, await two());
  const people = await Promise.all(["will", "will", "will", "jobs", "jobs", "jobs", "lee", "lee", "jensen", "jensen"].map(mk));
  const K = await buildElon({ hands: await two() });
  const sticks = await Promise.all([0, 1, 2, 3].map(() => buildDrumstick(0.44)));
  const phones = [0, 1, 2, 3].map(() => buildPhone());
  const HP = await hand();   // 해에서 솟는 손
  marsShards();
  return { will: people.slice(0, 3), jobs: people.slice(3, 6), lee: people.slice(6, 8), jensen: people.slice(8, 10), K, sticks, phones, HP };
})().catch(e => { rigP = null; throw e; }));
let warmed = false;
export function prewarmSun() { preloadHand(); preloadVol(); getRig().then(R => { const r = fx3d().renderer; const all = [...R.will, ...R.jobs, ...R.lee, ...R.jensen].map(p => p.root).concat([R.K.root]); for (const q of all) q.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { for (const k of ["map", "alphaMap", "emissiveMap", "bumpMap"]) if (m[k]) r.initTexture(m[k]); }); }); warmed = true; }).catch(() => {}); }

function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const tri = p => { const x = Math.abs((((p % 2) + 2) % 2) - 1) * 2 - 1; return x * (1.5 - 0.5 * x * x); };

export async function startSun(o) {
  const T = { ...T0 };
  const X = fx3d(), { renderer, PR, vw, vh, D } = X, vmin = Math.min(vw, vh), M = 0.75 * vmin, SW = vw / M, SH = vh / M, Dm = D / M, aspect = vw / vh, port = aspect < 1;
  const [R, noise] = await Promise.all([getRig(), makeNoise3D()]), snd = makeSound(o.sfx);
  const post = makePost(X, noise);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(X.FOV, aspect, 0.03, 30000); cam.position.set(0, 0, Dm); cam.layers.enable(1); scene.add(cam);
  const fit = (w, h, fov = cam.fov) => { const t = Math.tan(fov * Math.PI / 360); return Math.max(h / 2 / t, w / 2 / (t * aspect)); };
  const PS = vh * PR / (2 * Math.tan(X.FOV * Math.PI / 360));
  bakeBodies(renderer, noise);
  const P = {};   // 화면 마무리 값
  const tmp = V(), tmp2 = V(), tmp3 = V(), tq = new THREE.Quaternion(), tm4 = new THREE.Matrix4();
  const once = new Set(), at = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } };

  // ═════ 하늘 세상: 빛 · 하늘 · 달력 ═════
  const sky = buildDaySky(noise); sky.U.uSun.value.copy(SKY_SUN); scene.add(sky.mesh);
  const skyG = new THREE.Group(); scene.add(skyG);
  const hemi = new THREE.HemisphereLight(0xa9c8ff, 0xdfe6f2, 0.75), key = new THREE.DirectionalLight(0xfff3e2, 2.5), fill = new THREE.DirectionalLight(0x9fb8ff, 0.55);
  key.position.copy(SKY_SUN).multiplyScalar(30); key.castShadow = true; Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 80 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  fill.position.set(4, -1, 6); skyG.add(hemi, key, key.target, fill);
  const envSky = (() => { const s = new THREE.Scene(), m = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky.mesh.material.clone()); m.material.vertexShader = "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"; m.material.depthTest = true; m.material.uniforms = sky.U; m.frustumCulled = false; s.add(m); const t = X.pmrem.fromScene(s, 0.02, 0.1, 300); m.geometry.dispose(); m.material.dispose(); return t; })();
  scene.environment = envSky.texture; scene.environmentIntensity = 0.9;
  // 달력 한 장: 화면 그대로 그려 격자에 입힘
  const pk = Math.min(2, PR), pc = document.createElement("canvas"); pc.width = Math.round(vw * pk); pc.height = Math.round(vh * pk); { const x = pc.getContext("2d"); x.fillStyle = getComputedStyle(document.body).backgroundColor || "#f6f7f9"; x.fillRect(0, 0, pc.width, pc.height); for (const p of o.pieces) { x.save(); x.translate(p.cx * pk, p.cy * pk); x.rotate(p.th); x.globalAlpha = p.alpha == null ? 1 : p.alpha; x.drawImage(p.tex, -p.W / 2 * pk, -p.H / 2 * pk, p.W * pk, p.H * pk); x.restore(); } }
  const pageT = new THREE.CanvasTexture(pc); pageT.colorSpace = THREE.SRGBColorSpace; pageT.anisotropy = 8;
  const NX = port ? 90 : 140, NY = port ? 140 : 90, nV = (NX + 1) * (NY + 1), sPos = new Float32Array(nV * 3), sNor = new Float32Array(nV * 3), sUv = new Float32Array(nV * 2), sN = new Float32Array(nV), nA = new Float32Array(nV), nB = new Float32Array(nV), nC = new Float32Array(nV), phX = new Float32Array(nV), phY = new Float32Array(nV), dirS = new Float32Array(nV * 3), sIdx = []; const NFX = Math.round(SW / 0.14), NFY = Math.round(SH / 0.17);
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i, u = (i / NX) * 2 - 1, v = (j / NY) * 2 - 1; sUv[k * 2] = i / NX; sUv[k * 2 + 1] = j / NY; nA[k] = vnoise(u * 2.1 + 3, v * 2.7); nB[k] = vnoise(u * 7 + 9, v * 6.5 + 1); nC[k] = vnoise(u * 19, v * 17 + 5); sN[k] = nB[k]; phX[k] = (u * 0.5 + 0.5) * NFX + (vnoise(u * 3 + 7, v * 4) - 0.5) * 2.2 + (vnoise(v * 6, 2) - 0.5) * 1.3; phY[k] = (v * 0.5 + 0.5) * NFY + (vnoise(u * 4, v * 3 + 8) - 0.5) * 2.2 + (vnoise(u * 6, 5) - 0.5) * 1.3; const th = u * Math.PI * 0.985, ph = v * Math.PI * 0.49; dirS[k * 3] = Math.sin(th) * Math.cos(ph); dirS[k * 3 + 1] = Math.sin(ph); dirS[k * 3 + 2] = Math.cos(th) * Math.cos(ph); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; sIdx.push(a, b, c, b, d, c); }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute("normal", new THREE.BufferAttribute(sNor, 3)); sGeo.setAttribute("uv", new THREE.BufferAttribute(sUv, 2)); sGeo.setAttribute("aN", new THREE.BufferAttribute(sN, 1)); sGeo.setIndex(sIdx);
  const SU = { uSteel: { value: 0 }, uHeat: { value: 0 }, uPage: { value: 1 } }, sMat = new THREE.MeshStandardMaterial({ map: pageT, color: 0x000000, side: THREE.DoubleSide, roughness: 0.86, metalness: 0, envMapIntensity: 0.6 });
  sMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, SU); sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aN; varying float vAN;").replace("#include <begin_vertex>", "#include <begin_vertex>\n vAN = aN;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vAN; uniform float uSteel, uHeat, uPage;").replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb = mix(gl_FrontFacing ? diffuseColor.rgb : vec3(0.74, 0.72, 0.68), vec3(0.72, 0.74, 0.78), uSteel);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n { float h = uHeat * (0.45 + 1.1 * smoothstep(0.32, 0.7, vAN)); totalEmissiveRadiance += mix(vec3(1.6, 0.16, 0.02), vec3(3.6, 1.7, 0.4), clamp(h - 0.5, 0.0, 1.0)) * h; totalEmissiveRadiance += sampledDiffuseColor.rgb * uPage * (gl_FrontFacing ? 1.0 : 0.0); }"); };
  sMat.customProgramCacheKey = () => "sunSheet";
  const sheetG = new THREE.Group(), sheet = new THREE.Mesh(sGeo, sMat); sheet.frustumCulled = false; sheet.castShadow = sheet.receiveShadow = true; sheet.layers.enable(1); sheetG.add(sheet); const sqG = new THREE.Group(); sqG.add(sheetG); skyG.add(sqG); const qSq = new THREE.Quaternion(), qSqI = new THREE.Quaternion(); let sqx = 0, sqv = 0;
  const uX = new Float32Array(NX + 1), aX = new Float32Array(NX + 1), uY = new Float32Array(NY + 1), aY = new Float32Array(NY + 1), sc = new Float32Array(Math.max(NX, NY) + 1), cum = new Float32Array(Math.max(NX, NY) + 1);
  // 반쪽씩 접힘: 맞은 쪽 가장자리부터 주름지며 가운데로 (aN 음수 쪽 · aP 양수 쪽 · eN/eP 다 접혔을 때 반쪽 길이)
  function lut(n, full, aN, aP, eN, eP, out, amp, nf) { const c = n >> 1, st = (full * 2) / n, minS = 0.1;
    for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1, a = u >= 0 ? aP : aN, g = clamp(a * 1.8 - (1 - Math.abs(u)) * 0.8, 0, 1); sc[i] = lerp(1, minS, g); }
    cum[c] = 0; for (let i = c + 1; i <= n; i++) cum[i] = cum[i - 1] + (sc[i - 1] + sc[i]) * 0.5 * st; for (let i = c - 1; i >= 0; i--) cum[i] = cum[i + 1] - (sc[i] + sc[i + 1]) * 0.5 * st;
    const kP = lerp(full, eP, aP) / (cum[n] || 1), kN = lerp(full, eN, aN) / (-cum[0] || 1);
    for (let i = 0; i <= n; i++) { const a = i >= c ? aP : aN; out[i] = cum[i] * (i >= c ? kP : kN); amp[i] = (full / nf) * 1.05 * Math.sqrt(Math.max(0, 1 - sc[i] * sc[i])) * clamp(a * 3, 0, 1); } }
  const S = { cL: 0, cR: 0, cB: 0, cT: 0, cc: 0, Rb: 0.32, dents: [] };
  const wadX = Math.min(0.24, SW / 2), wadY = Math.min(0.3, SH / 2);
  function deform() { lut(NX, SW / 2, S.cL, S.cR, wadX, wadX, uX, aX, NFX); lut(NY, SH / 2, S.cB, S.cT, wadY, wadY, uY, aY, NFY); const c = S.cc, e = c * c, W = NX + 1, wr = (S.cL + S.cR + S.cB + S.cT) * 0.25;
    for (let j = 0; j <= NY; j++) { const y0 = uY[j], Ay = aY[j]; for (let i = 0; i <= NX; i++) { const k = j * W + i, Ax = aX[i], fa = 0.72 + 0.56 * nA[k], fb = 0.72 + 0.56 * nB[k], cr = (nC[k] - 0.5) * 0.08 * wr; let x = uX[i] + Ay * (nB[k] - 0.5) * 0.5, y = y0 + Ax * (nA[k] - 0.5) * 0.5, z = Ax * tri(phX[k]) * fa + Ay * tri(phY[k]) * fb + cr;
      if (c > 0) { const rr = S.Rb * (1 + (1 - c) * 0.35 * (nB[k] - 0.5) + c * 0.07 * (nC[k] - 0.5)); x += (dirS[k * 3] * rr - x) * e; y += (dirS[k * 3 + 1] * rr - y) * e; z += (dirS[k * 3 + 2] * rr - z) * e; }
      for (const d of S.dents) { if (d.k < 0.002) continue; const pd = -(x * d.d.x + y * d.d.y + z * d.d.z), rr = d.r; if (pd <= 0) continue; const f = sm01(pd / rr) * d.k * rr; x += d.d.x * f; y += d.d.y * f; z += d.d.z * f; }
      sPos[k * 3] = x; sPos[k * 3 + 1] = y; sPos[k * 3 + 2] = z; } }
    for (let j = 0; j <= NY; j++) { const j0 = (j ? j - 1 : j) * W, j1 = (j < NY ? j + 1 : j) * W; for (let i = 0; i <= NX; i++) { const a = (j0 + i) * 3, b = (j1 + i) * 3, l = (j * W + (i ? i - 1 : i)) * 3, r = (j * W + (i < NX ? i + 1 : i)) * 3, ux = sPos[r] - sPos[l], uy = sPos[r + 1] - sPos[l + 1], uz = sPos[r + 2] - sPos[l + 2], vx = sPos[b] - sPos[a], vy = sPos[b + 1] - sPos[a + 1], vz = sPos[b + 2] - sPos[a + 2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const q = 1 / (Math.hypot(nx, ny, nz) || 1), k = (j * W + i) * 3; sNor[k] = nx * q; sNor[k + 1] = ny * q; sNor[k + 2] = nz * q; } }
    sGeo.attributes.position.needsUpdate = sGeo.attributes.normal.needsUpdate = true; }
  deform();
  // 현재 뭉치의 가장자리 (반쪽 길이) · 가운데
  const extX = () => [uX[0], uX[NX]], extY = () => [uY[0], uY[NY]];
  // 쇠구슬
  const ballM = new THREE.MeshPhysicalMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.12, bumpMap: pageT, bumpScale: 0.5, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xff4a10, emissiveIntensity: 0, envMapIntensity: 1.3 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 96, 64), ballM); ball.visible = false; ball.castShadow = true; ball.layers.enable(1); ball.frustumCulled = false; scene.add(ball);
  const gleam = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false })); gleam.renderOrder = 9; scene.add(gleam);
  const ballGlowU = { uC: { value: new THREE.Color(1.6, 0.9, 0.45) }, uA: { value: 0 }, uCore: { value: 3.2 } }, ballGlow = billboard(glowFS, ballGlowU, 2); ballGlow.visible = false; scene.add(ballGlow);
  const trail = streaks(90), trailP = []; scene.add(trail.lines); trail.lines.visible = false;
  // 맞을 때: 섬광 · 고리 · 가루 · 불티
  const hitFx = []; for (let i = 0; i < 6; i++) { const gU = { uC: { value: new THREE.Color(1, 0.96, 0.9) }, uA: { value: 0 }, uCore: { value: 2.4 } }, g = billboard(glowFS, gU, 2), rU = { uN: { value: noise }, uC: { value: new THREE.Color(1, 0.97, 0.92) }, uA: { value: 0 }, uR: { value: 0 }, uW: { value: 0.04 } }, r = billboard(ringFS, rU, 2); g.visible = r.visible = false; scene.add(g, r); hitFx.push({ g, gU, r, rU, t: 9, k: 1 }); }
  const impStars = []; for (let i = 0; i < 5; i++) { const m = new THREE.SpriteMaterial({ map: gleam.material.map, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), sp = new THREE.Sprite(m); sp.renderOrder = 9; sp.visible = false; scene.add(sp); impStars.push({ sp, t: 9, k: 1 }); }
  const camKick = V(); let fovKick = 0, hitWave = null; const stickSq = new Map();
  const dust = glowPoints(1600, PS, 1.2); dust.pts.renderOrder = 6; scene.add(dust.pts); const dP = []; dust.pts.visible = false;
  const plume = buildPlume(X, noise, 1400);

  // ═════ 인물 ═════
  const people = [...R.will, ...R.jobs, ...R.lee, ...R.jensen]; for (const K of people) { K.root.visible = false; K.root.traverse(q => { if (q.isMesh) { q.layers.enable(1); q.frustumCulled = false; } }); scene.add(K.root); K.begin(); }
  R.sticks.forEach(s => s.root.traverse(q => q.isMesh && q.layers.enable(1)));
  // 닭다리: 이재용 왼손 · 젠슨 황 오른손 (둘 다 안쪽 손) · 아이폰: 잡스 오른손
  R.lee.forEach((K, i) => K.attach("L", R.sticks[i].root, 0.095, 0.036)); R.jensen.forEach((K, i) => K.attach("R", R.sticks[2 + i].root, 0.095, 0.036));
  const phoneHold = R.jobs.map(K => { if (!K._ph) { const g = new THREE.Group(), g2 = new THREE.Group(); g2.rotation.y = Math.PI; g.add(g2); K.attach("R", g, 0.135, 0.028, "finger"); K._ph = g2; } return K._ph; });
  const phoneFly = R.phones.map(p => { p.root.scale.setScalar(1); p.root.traverse(q => q.isMesh && q.layers.enable(1)); return { p, on: false }; });
  const acts = [];
  const qY = new THREE.Quaternion(), qZ = new THREE.Quaternion(), mir = new THREE.Matrix4();
  // 인물 놓기: 맞는 점 I(월드) · 방향 phi(화면 평면, 0 = 오른쪽에서) · 크기 gs · 기본 자리 off(사람 기준 맞는 점의 위치) · yaw
  function place(K, I, phi, gs, Iloc, yaw, mirror, slide) { const r = K.root; r.scale.set(mirror ? -gs : gs, gs, gs); qY.setFromAxisAngle(V(0, 1, 0), mirror ? -yaw : yaw); qZ.setFromAxisAngle(V(0, 0, 1), phi);
    // 사람 기준 맞는 점을 월드로: R(phi) · [mirror] · R(yaw) · (Iloc * gs)
    tmp.copy(Iloc).multiplyScalar(gs); if (mirror) tmp.x = -tmp.x; tmp.applyQuaternion(qY).applyQuaternion(qZ);
    r.quaternion.copy(qZ).multiply(qY); r.position.copy(I).sub(tmp); if (slide) r.position.add(slide); r.updateMatrixWorld(true); }

  // ═════ 우주 세상 ═════
  const spaceG = new THREE.Group(); scene.add(spaceG); spaceG.visible = false;
  const sunL = new THREE.PointLight(0xfff2e0, 3.2, 0, 0), spHemi = new THREE.HemisphereLight(0x6f86c0, 0x1a1418, 0.25); spaceG.add(sunL, spHemi);
  const envSp = (() => { const s = new THREE.Scene(), m = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "varying vec3 vD; void main(){ vec3 d = normalize(vD), s = vec3(-1.0, 0.0, 0.0); vec3 c = vec3(0.01, 0.012, 0.022) + vec3(0.2, 0.16, 0.12) * pow(max(dot(d, s), 0.0), 4.0) + vec3(9.0, 8.0, 6.5) * pow(max(dot(d, s), 0.0), 400.0); gl_FragColor = vec4(c, 1.0); }" })); s.add(m); const t = X.pmrem.fromScene(s, 0.02); m.geometry.dispose(); m.material.dispose(); return t; })();
  const sunB = makeBody(renderer, noise, "star", { temp: 0.44, lum: 1.0, spot: 1 }); sunB.group.scale.setScalar(SUNR); spaceG.add(sunB.group);
  const boil = boilShell(noise); boil.mesh.scale.setScalar(SUNR); spaceG.add(boil.mesh);
  const pl = {};
  const hdr = (mat, from, to) => { if (!mat.fragmentShader.includes(from)) return false; mat.fragmentShader = mat.fragmentShader.replace(from, to); mat.needsUpdate = true; return true; };
  const ringPlane = new THREE.Quaternion();
  function addPlanet(name, kind) { const [x, r] = PL[name], p = { name, R: r, P: V(x, 0, 0), state: 0, tH: 1e9, tX: 1e9, imA: V(), imB: V(), vis: true, spin: rnd(0.02, 0.06) };
    if (name === "earth") { const e = buildEarth(renderer, noise); hdr(e.mesh.material, "c = 1.0 - exp(-c * 1.5);", "c *= 1.25;"); addBlend(e.air.material); e.group.scale.setScalar(r); p.body = { group: e.group, U: e.U, AU: e.AU, e, update(t, sun) { e.U.uSun.value.copy(sun); e.U.uT.value = t; }, dispose() { e.dispose(); } }; p.map = e.U.uM.value; p.gamma = false; p.cloud = true; p.hot = new THREE.Color(1.5, 0.42, 0.08); }
    else if (name === "mars") { const m = buildMars(renderer, noise); hdr(m.mesh.material, "c *= uFade; c = 1.0 - exp(-c * 1.35);", "c *= uFade * 1.15;"); addBlend(m.air.material); m.group.scale.setScalar(r); p.mars = m; p.hot = new THREE.Color(1.5, 0.45, 0.1); p.body = { group: m.group, U: m.U, update(t, sun) { m.U.uSun.value.copy(sun); m.U.uT.value = t; }, dispose() { m.dispose(); } }; }
    else { const b = makeBody(renderer, noise, kind); b.group.scale.setScalar(r); if (b.ring) { b.group.quaternion.setFromEuler(new THREE.Euler(0.42, 0, 0.16)); } p.body = b; const mp = bakeBodies(renderer, noise)[kind]; p.map = mp.texture; p.gamma = true; p.gas = ["jupiter", "saturn", "uranus", "neptune", "venus"].includes(kind);
      p.hot = { jupiter: new THREE.Color(1.6, 0.6, 0.2), saturn: new THREE.Color(1.6, 0.9, 0.35), uranus: new THREE.Color(0.5, 1.2, 1.5), neptune: new THREE.Color(0.4, 0.7, 1.8), venus: new THREE.Color(1.6, 1.0, 0.3), mercury: new THREE.Color(1.5, 0.4, 0.08) }[kind]; }
    p.body.group.position.copy(p.P); spaceG.add(p.body.group);
    if (!p.mars) { p.crack = crackShell(renderer, noise); p.crack.U.uHot.value.copy(p.hot); p.body.group.add(p.crack.mesh); p.crack.mesh.visible = false;
      p.sh = shardPlanet(renderer, noise, { map: p.map, gamma: p.gamma, gas: p.gas, cloud: p.cloud, hot: p.hot, blast: p.gas ? 1.15 : 1, drift: 0.05 }); p.sh.mesh.scale.setScalar(r); p.sh.mesh.position.copy(p.P); p.sh.mesh.visible = false; spaceG.add(p.sh.mesh); }
    p.ring = shockRing(noise); p.ring.mesh.scale.setScalar(r * 7); spaceG.add(p.ring.mesh); p.shell = shockShell(); spaceG.add(p.shell.mesh);
    const fU = { uC: { value: p.hot ? p.hot.clone().multiplyScalar(0.5).addScalar(0.3) : new THREE.Color(1.2, 0.75, 0.45) }, uA: { value: 0 }, uCore: { value: 1.5 } }; p.flash = billboard(glowFS, fU, 2); p.flashU = fU; p.flash.visible = false; spaceG.add(p.flash);
    p.rocks = rockField(name === "jupiter" || name === "saturn" ? 260 : 160); spaceG.add(p.rocks.mesh);
    p.body.group.traverse(q => { if (q.isMesh) q.layers.enable(1); });
    pl[name] = p; return p; }
  addPlanet("earth"); addPlanet("mars"); addPlanet("jupiter", "jupiter"); addPlanet("saturn", "saturn"); addPlanet("uranus", "uranus"); addPlanet("neptune", "neptune"); addPlanet("venus", "venus"); addPlanet("mercury", "mercury");
  // 되돌아오는 길 (터진 조각 사이를 지나 금성 · 수성 · 해로)
  const retPts = [V(1360, 2, 6), V(1225, 5, 12), V(1062, -4, 11), V(862, 6, 24), V(622, -5, 23), V(424, 2, 6), V(306, -3, 9), V(205, 0, 4), V(132, 0, 2), V(70, 0, 0.6), V(40.5, 0, 0)];
  const retPath = new THREE.CatmullRomCurve3(retPts, false, "centripetal");
  for (const n of ["venus", "mercury"]) { const p = pl[n], u = n === "venus" ? 0.775 : 0.86; let best = 0, bd = 1e9; for (let i = 0; i <= 400; i++) { retPath.getPoint(i / 400, tmp); const d = Math.abs(tmp.x - p.P.x); if (d < bd) { bd = d; best = i / 400; } } retPath.getPoint(best, tmp); p.P.set(tmp.x, tmp.y - 0.15 * p.R, tmp.z - 0.55 * p.R); p.body.group.position.copy(p.P); if (p.sh) p.sh.mesh.position.copy(p.P); p.u = best; }
  // 토성 고리 부스러기
  const ringDeb = glowPoints(2600, PS, 1.0); spaceG.add(ringDeb.pts); ringDeb.pts.visible = false; const rdV = new Float32Array(2600 * 3);
  // 불티 (터질 때)
  const sparks = glowPoints(3000, PS, 1.3); spaceG.add(sparks.pts); const spV = new Float32Array(3000 * 3), spL = new Float32Array(3000), spM = new Float32Array(3000); let spN = 0;
  // 일론 (화성 위에 서 있음)
  const K = R.K; spaceG.add(K.root); K.root.visible = false; K.root.traverse(q => { if (q.isMesh) { q.castShadow = false; q.frustumCulled = false; q.layers.enable(1); } }); K.begin(); K.show("a"); K.tint(new THREE.Color(1, 1, 1), 0);
  // 별 줄 (빠르게 날 때)
  const warp = streaks(260), wst = []; for (let i = 0; i < 260; i++) wst.push(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))); scene.add(warp.lines); warp.lines.visible = false;
  // 해에서 솟는 손 (불꽃 재질)
  const plas = plasmaMat(noise); R.HP.mesh.material = plas.mat; const handG = new THREE.Group(), hOrient = new THREE.Group(); hOrient.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); R.HP.scene.position.copy(V().setFromMatrixPosition(R.HP.restM.wrist)).negate(); hOrient.add(R.HP.scene); handG.add(hOrient); spaceG.add(handG); handG.visible = false;
  const armU = plas.U, arm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.35, 1, 40, 12, true), plas.mat); arm.frustumCulled = false; spaceG.add(arm); arm.visible = false;
  const clouds = []; for (let i = 0; i < 14; i++) { const c = cloudSprite(noise); c.mesh.visible = false; skyG.add(c.mesh); clouds.push({ c, s: 3 + i * 4.2 + rnd(-1, 1), lat: V(rnd(-1, 1), 0, rnd(-1, 1)).normalize().multiplyScalar(rnd(1.2, 4.5)), sz: rnd(3, 7) }); }
  // 화면 덮개
  const ov = css => { const e = document.createElement("div"); e.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;opacity:0;" + css; document.body.append(e); return e; };
  const fade = ov("background:#000");

  // ═════ 시간표: 맞는 순서 (느리게 넷 → 빠르게 아무나) ═════
  // 맞는 점과 방향은 그때의 뭉치 모양으로 정함
  const plan = [];
  plan.push({ type: "will", th: T.w1, ta: T.w1a, phi: 0, mirror: false, eff: () => ({ k: "cR" }) });
  plan.push({ type: "will", th: T.w2, ta: T.w2a, phi: Math.PI, mirror: true, eff: () => ({ k: "cL" }) });
  plan.push({ type: "jobs", th: T.jb, ta: T.ja, phi: -Math.PI / 2 - 0.06, eff: () => ({ k: "cB" }) });
  plan.push({ type: "chicken", th: T.c1, th2: T.c2, ta: T.c1a, phi: Math.PI / 2, eff: () => ({ k: "cT" }) });
  // 빠르게: 셋 중 아무나 (같은 것이 세 번 연속은 없게) · 사람은 늘 똑바로 서서 여러 방향에서 (윌: 오른쪽/왼쪽에서 조금 기울여 · 잡스: 뒤쪽 아무 방향 · 닭다리: 위쪽 비스듬히)
  { let tt = T.f0 + 0.18, I = 0.42, last = "", rep = 0, wSide = 1; const types = ["will", "jobs", "chicken"];
    let lastCk = -9; while (tt < T.f1 - 0.05) { const r0 = Math.random(); let ty = r0 < 0.4 ? "will" : r0 < 0.73 ? "jobs" : "chicken"; if (ty === last && rep >= 1) ty = types[(types.indexOf(ty) + 1 + ((Math.random() * 2) | 0)) % 3]; if (ty === "chicken" && tt - lastCk < 0.55) ty = Math.random() < 0.5 ? "will" : "jobs"; if (ty === "chicken") lastCk = tt; rep = ty === last ? rep + 1 : 0; last = ty;
      let phi, mirror = false; if (ty === "will") { wSide = Math.random() < 0.6 ? -wSide : wSide; mirror = wSide < 0; phi = (mirror ? Math.PI : 0) + rnd(-0.22, 0.22); } else if (ty === "jobs") phi = rnd(0, Math.PI * 2); else phi = Math.PI / 2 + rnd(-0.3, 0.3);
      plan.push({ type: ty, th: tt, ta: tt - (ty === "chicken" ? clamp(I * 1.4, 0.2, 0.45) : clamp(I * 1.15, 0.13, 0.45)), fast: true, I, phi, mirror, eff: () => ({ k: "fast" }) }); tt += I; I = tt < T.ff ? Math.max(0.13, I * 0.84) : rnd(0.1, 0.13); } }
  const fastN = plan.filter(q => q.fast).length; if (import.meta.env.DEV) { window.__sunPlan = plan; window.__sunPeople = () => people.map((k, i) => k.who + i + ":" + k.root.visible + "@" + k.root.position.toArray().map(v => v.toFixed(2)).join(",")); }

  // ═════ 장면 함수들 ═════
  let shake = 0, hitStop = 0, fastI = 0, spinV = V(), spinQ = new THREE.Quaternion(), jolt = V(), joltV = V();
  const W0 = V();   // 뭉치 가운데 (월드)
  function wadR() { if (S.cc > 0.02) return S.Rb * (1 + (1 - S.cc) * 0.6); const [x0, x1] = extX(), [y0, y1] = extY(); return Math.max(x1 - x0, y1 - y0) * 0.5; }
  // 맞는 점: 뭉치 가운데에서 phi 쪽 가장자리
  function hitPoint(phi, out) { const [x0, x1] = extX(), [y0, y1] = extY(), c = Math.cos(phi), s = Math.sin(phi); if (S.cc > 0.3) return out.set(c, s, 0).multiplyScalar(wadR() * 0.92).add(sqG.position);
    const ex = c >= 0 ? x1 : -x0, ey = s >= 0 ? y1 : -y0, k = Math.min(Math.abs(c) > 1e-3 ? ex / Math.abs(c) : 1e9, Math.abs(s) > 1e-3 ? ey / Math.abs(s) : 1e9) * 0.94; return out.set(c * k, s * k, 0.02).add(sqG.position); }
  function impact(q) { const k = q.fast ? 0.5 + 0.5 * (1 - fastI / fastN) : 1, I = q.I0;
    const f = hitFx.reduce((a, b) => (a.t > b.t ? a : b)); f.t = 0; f.k = (q.fast ? 0.4 : 0.8) * (q.type === "jobs" ? 1.2 : 1); f.g.position.copy(I); f.r.position.copy(I); f.g.visible = f.r.visible = true; f.gU.uC.value.setRGB(q.type === "jobs" ? 0.9 : 1.1, q.type === "chicken" ? 0.85 : 1, q.type === "chicken" ? 0.65 : 0.95);
    const din = tmp2.set(-Math.cos(q.phi), -Math.sin(q.phi), 0); for (let i = 0; i < (q.fast ? 30 : 70); i++) { const v = V(gauss(), gauss(), gauss()).multiplyScalar(0.8).addScaledVector(din, -rnd(0.5, 2.5)); dP.push({ p: I.clone(), v, life: 0, max: rnd(0.4, 1.1), s: rnd(0.012, 0.03), c: Math.random() < 0.5 ? [0.95, 0.94, 0.9] : [0.75, 0.78, 0.84] }); }
    for (let i = 0; i < (q.fast ? 4 : 10); i++) { const v = V(gauss(), gauss(), gauss() * 0.5).normalize().addScaledVector(din, -0.8); plume.add(I.x, I.y, I.z, v.x * rnd(0.3, 1.2), v.y * rnd(0.3, 1.2), v.z * rnd(0.3, 1.2), { life: rnd(0.5, 1.1), s0: 0.05, s1: rnd(0.25, 0.5) * (q.fast ? 0.6 : 1), a: 0.22, drag: 2.6, turb: 1.1, ero: 0.36, fo: 1.6 }); }
    if (q.fast) { fastI++; const pr = fastI / fastN; S.cc = Math.max(S.cc, 0.12 + 0.88 * Math.pow(pr, 1.5)); S.Rb = lerp(0.36, BR, Math.pow(pr, 1.15)); S.dents.push({ d: din.clone(), k: 0.5, r: 0.18 }); spinV.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(2.5)).addScaledVector(V(-din.y, din.x, 0), 4); joltV.addScaledVector(din, 0.9); shake = Math.max(shake, 0.012); hitStop = Math.max(hitStop, 0.02); }
    else { joltV.addScaledVector(din, 1.2); shake = Math.max(shake, 0.05); hitStop = 0.07; spinV.addScaledVector(V(-din.y, din.x, 0), 0.6); }
    // ── 타격감: 멈칫 · 찌그러짐 · 카메라 밀림 · 화면 물결 · 번쩍 별 · 종류별 파편 ──
    { const d = V(-Math.cos(q.phi), -Math.sin(q.phi), 0), F = q.fast ? 0.55 + 0.45 * (1 - fastI / fastN) : 1;
      hitStop = Math.max(hitStop, q.fast ? 0.035 : 0.11); qSq.setFromUnitVectors(V(1, 0, 0), d); qSqI.copy(qSq).invert(); sqx = q.fast ? -0.16 : -0.24; sqv = 0;
      camKick.addScaledVector(d, (q.fast ? 0.03 : 0.08) * (wadR() + 0.35)); fovKick = q.fast ? -1.3 : -3.2;
      const sc = tmp3.copy(I).project(cam); hitWave = { t0: t, c: new THREE.Vector2(sc.x * 0.5 + 0.5, sc.y * 0.5 + 0.5), k: q.fast ? 0.55 : 1 };
      const st = impStars.reduce((a, b) => (a.t > b.t ? a : b)); st.t = 0; st.k = (q.fast ? 0.55 : 1) * F; st.sp.position.copy(I); st.sp.visible = true; st.sp.material.rotation = rnd(0, 6.28); st.sp.material.color.setRGB(q.type === "chicken" ? 2.6 : 2.4, q.type === "chicken" ? 1.9 : 2.3, q.type === "chicken" ? 1.3 : 2.4);
      const n = q.fast ? 14 : 34;
      if (q.type === "will") for (let i = 0; i < n; i++) { const v = d.clone().multiplyScalar(rnd(1.5, 4.5)).add(V(gauss(), gauss(), gauss()).multiplyScalar(1.1)); dP.push({ p: I.clone(), v, life: 0, max: rnd(0.2, 0.45), s: rnd(0.01, 0.022), c: [2.2, 2.1, 2.0] }); }
      else if (q.type === "jobs") { for (let i = 0; i < n; i++) { const v = V(gauss(), gauss() + 0.6, gauss()).multiplyScalar(rnd(1.2, 3.2)).addScaledVector(d, -1.2); dP.push({ p: I.clone(), v, life: 0, max: rnd(0.35, 0.8), s: rnd(0.005, 0.013), c: Math.random() < 0.7 ? [2.3, 2.6, 3.0] : [1.0, 1.7, 3.4], g: -6 }); } }
      else { for (let i = 0; i < n; i++) { const v = V(gauss(), gauss() * 0.6 + 0.7, gauss()).multiplyScalar(rnd(1, 2.8)).addScaledVector(d, -0.8); dP.push({ p: I.clone(), v, life: 0, max: rnd(0.35, 0.7), s: rnd(0.009, 0.02), c: [1.1, 0.5, 0.14], g: -7 }); }
        for (const K of q.who) { const st2 = K.who === "lee" ? R.sticks[R.lee.indexOf(K)] : R.sticks[2 + R.jensen.indexOf(K)]; if (st2) stickSq.set(st2, { x: -0.32, v: 0 }); } } }
    snd.hit(q.type, k); buzz(q.fast ? 1 : q.type === "chicken" ? [2, 40, 2] : 3); }
  // 짜부 진행 (느린 넷: 맞는 순간부터 0.16초 만에 접힘)
  function squish(t, dt) { const cr = (th) => eIn(seg(t, th - 0.02, th + 0.15)) * 0.86 + 0.14 * sm01((t - th) / 0.6);
    S.cR = cr(T.w1); S.cL = cr(T.w2); S.cB = cr(T.jb); S.cT = cr(T.c1) * 0.55 + cr(T.c2) * 0.45; if (t < T.f0) S.cc = 0.12 * sm01((t - T.c2) / 0.4);
    for (let i = S.dents.length - 1; i >= 0; i--) { const d = S.dents[i]; d.k *= Math.exp(-dt * 5); if (d.k < 0.003) S.dents.splice(i, 1); }
    // 흔들림: 맞으면 밀렸다 돌아옴 · 돌기
    joltV.addScaledVector(jolt, -dt * 60); joltV.multiplyScalar(Math.exp(-dt * 7)); jolt.addScaledVector(joltV, dt); spinV.multiplyScalar(Math.exp(-dt * 2.2));
    if (spinV.lengthSq() > 1e-6) { tq.setFromAxisAngle(tmp.copy(spinV).normalize(), spinV.length() * dt); spinQ.premultiply(tq); }
    const [x0, x1] = extX(), [y0, y1] = extY(), cen = tmp3.set(-(x0 + x1) / 2, -(y0 + y1) / 2, 0).multiplyScalar(sm01((t - T.c2) / 0.8));   // 다 접힌 뒤에는 뭉치 가운데가 원점으로
    sqv += (-1100 * sqx - 22 * sqv) * dt; sqx += sqv * dt; const sq = 1 + sqx, sp = 1 / Math.sqrt(Math.max(0.3, sq));
    sqG.position.copy(jolt).addScaledVector(cen, 1); sqG.quaternion.copy(qSq); sqG.scale.set(sq, sp, sp); sheetG.position.set(0, 0, 0); sheetG.quaternion.copy(qSqI).multiply(spinQ); W0.copy(sqG.position);
    // 종이 → 강철 · 열
    const fu = seg(t, T.f0, T.f1); SU.uSteel.value = sm01((fu - 0.45) / 0.55); sMat.metalness = SU.uSteel.value; sMat.roughness = lerp(0.86, 0.18, SU.uSteel.value); const heat = sm01(fu / 0.85) * (1 - sm01((t - T.f1) / 0.32)); SU.uHeat.value = heat * 1.3;
    { const lit = sm01((t - T.pull) / 0.6); SU.uPage.value = lerp(1, 0.42, lit) * (1 - SU.uSteel.value); sMat.color.setScalar(lerp(0, 0.5, lit) + SU.uSteel.value * 0.5); }
    if (t < T.f1) { deform(); sheet.visible = true; } else { sheet.visible = false; }
    // 쇠구슬로 바뀜
    ball.visible = t >= T.f1 && t < T.up0 + 2.2; if (ball.visible && t < T.fs) { ball.position.copy(sqG.position); ball.quaternion.copy(spinQ); ballM.emissiveIntensity = heat * 2.6; }
    // 반짝
    const g = t > T.ting - 0.05 && t < T.ting + 0.5 ? seg(t, T.ting - 0.05, T.ting + 0.08) * (1 - seg(t, T.ting + 0.08, T.ting + 0.5)) : 0; gleam.material.opacity = g; if (g > 0) { gleam.position.copy(ball.position).add(V(BR * 0.35, BR * 0.4, BR * 0.3)); gleam.scale.setScalar(BR * 9 * (0.7 + 0.5 * g)); gleam.material.rotation = t * 0.8; }
    if (t > T.f1 - 0.6 && t < T.f1 + 0.1 && dt > 0) for (let i = 0; i < 3; i++) { const a = rnd(0, 6.28), s = rnd(1.5, 4); dP.push({ p: sqG.position.clone().add(V(Math.cos(a) * BR, Math.sin(a) * BR, BR * 0.5)), v: V(Math.cos(a) * s, Math.sin(a) * s + 1, rnd(-0.5, 2)), life: 0, max: rnd(0.25, 0.5), s: 0.012, c: [3.2, 1.6, 0.5], g: -6 }); }
  }
  // ── 인물 동작 ──
  const free = { will: [...R.will], jobs: [...R.jobs], lee: [...R.lee], jensen: [...R.jensen] };
  const mixV3 = (a, b, k) => a.clone().lerp(b, k);
  // 사람 기준 좌표 (미터): 맞는 점(손바닥이 닿는 곳)
  const WILL_I = V(-0.42, 1.36, 0.42), WY = -0.5, JOBS_I = V(-0.95, 1.2, 1.1), CK_I = { lee: V(0.6, 1.0, 0.42), jensen: V(-0.6, 1.0, 0.42) };
  // 윌: 오른손 싸대기 (뒤로 젖힘 → 휘둘러 왼쪽 앞을 때림 → 지나감)
  function poseWill(K, u, A) { K.begin(); const wind = sm01((u + A.wind) / Math.max(0.05, A.wind * 0.8)), sw = clamp((u + A.sw) / A.sw, 0, 1), fo = sm01(u / A.fo), back = sm01((u - A.fo) / 0.35);
    const yawC = lerp(lerp(0, 0.5, wind), -0.32, eIn(sw)) - 0.22 * fo + 0.4 * back, lean = -0.08 * wind + 0.14 * eIn(sw);
    K.setE("hips", 0.04, yawC * 0.45, 0); K.setE("spine", lean * 0.5, yawC * 0.3, 0); K.setE("chest", lean * 0.5, yawC * 0.35, 0.06 * sw); K.sync();
    K.leg("R", V(-0.22, 0.1, 0.22), 0, -0.3, V(-0.4, 0, 1)); K.leg("L", V(0.2, 0.1, -0.14), 0, 0.2, V(0.3, 0, 1));
    const p0 = V(0.26, 0.92, 0.06), p1 = V(0.52, 1.56, -0.28), p2 = WILL_I.clone().add(V(0.06, -0.02, -0.08)), p3 = V(-0.62, 1.16, 0.22), p4 = V(0.26, 0.92, 0.06);
    let w, F, N; if (u < -A.sw) { w = mixV3(p0, p1, wind); F = mixV3(V(0, -1, 0.2), V(0.1, 0.75, -0.6), wind); N = mixV3(V(-1, 0, 0), V(-0.55, 0.1, 0.83), wind); }
    else if (u < 0) { const e = eIn(sw), arc = Math.sin(Math.PI * e) * 0.18; w = mixV3(p1, p2, e).add(V(arc * 0.3, 0, arc)); F = mixV3(V(0.1, 0.75, -0.6), V(0.32, 0.22, 0.92), e); N = mixV3(V(-0.55, 0.1, 0.83), V(-0.93, 0.05, 0.32), e); }
    else if (back <= 0) { const e = eOut(fo); w = mixV3(p2, p3, e); F = mixV3(V(0.32, 0.22, 0.92), V(-0.45, -0.25, 0.85), e); N = mixV3(V(-0.93, 0.05, 0.32), V(-0.6, -0.4, -0.7), e); }
    else { w = mixV3(p3, p4, back); F = mixV3(V(-0.45, -0.25, 0.85), V(0, -1, 0.2), back); N = mixV3(V(-0.6, -0.4, -0.7), V(-1, 0, 0), back); }
    K.arm("L", w, V(0.9, -0.5, -0.4), K.handQ("L", F, N)); K.arm("R", V(-0.16, 1.22, 0.3), V(-0.9, -0.6, -0.3), K.handQ("R", V(0.4, 0.5, 0.75), V(0.85, 0.1, -0.4))); K.flat("L", 0.65 + 0.35 * clamp(wind + sw, 0, 1)); K.hold("R", 0.9);
    // 얼굴은 늘 카메라 쪽 (몸이 돌아도 고개는 반대로 돌려 정면 ±30도 안)
    K.setE("neck", 0.03, -yawC * 0.5, 0); K.setE("head", 0.04, -yawC * 0.45, 0); K.sync(); }
  // 잡스: 오른손 오버핸드 던지기 (폰이 손을 떠나는 때 = u = -A.fl)
  function poseJobs(K, u, A, Iloc) { K.begin(); const wind = sm01((u + A.fl + A.wind) / Math.max(0.05, A.wind * 0.8)), th = clamp((u + A.fl + 0.14) / 0.14, 0, 1), fo = sm01((u + A.fl) / 0.3);
    const dir = tmp3.copy(Iloc).sub(V(-0.2, 1.45, 0)).normalize();
    K.setE("hips", 0, lerp(0.15, -0.25, th), 0); K.setE("spine", -0.1 * wind + 0.15 * th, lerp(0.2, -0.3, th) * 0.5, 0); K.setE("chest", -0.05 * wind + 0.12 * th, lerp(0.25, -0.35, th) * 0.6, 0); K.sync();
    K.leg("L", V(0.18, 0.1, 0.16), 0, 0.2, V(0.3, 0, 1)); K.leg("R", V(-0.17, 0.1, -0.1), 0, -0.2, V(-0.3, 0, 1));
    const p0 = V(-0.3, 1.0, 0.1), p1 = V(-0.58, 1.66, -0.16), p2 = V(-0.2, 1.45, 0).addScaledVector(dir, 0.56).add(V(0, 0.1, 0)), p3 = V(0.12, 1.0, 0.32);
    let w, F, N; if (th <= 0) { w = mixV3(p0, p1, wind); F = mixV3(V(0, -1, 0.2), V(0, 0.4, -0.9), wind); N = mixV3(V(1, 0, 0), V(0.2, 0.2, 0.95), wind); }
    else if (fo <= 0) { const e = eIn(th); w = mixV3(p1, p2, e); F = mixV3(V(0, 0.4, -0.9), dir.clone(), e); N = mixV3(V(0.2, 0.2, 0.95), V(0, -1, 0).addScaledVector(dir, 0.2), e); }
    else { w = mixV3(p2, p3, fo); F = mixV3(dir.clone(), V(0.3, -0.6, 0.7), fo); N = V(0.4, -0.6, -0.6); }
    K.arm("R", w, V(-0.8, -0.6, -0.3), K.handQ("R", F, N)); K.arm("L", V(0.27, 0.86, 0.1), V(0.6, 0.2, -0.8), K.handQ("L", V(0.05, -1, 0.15), V(-1, 0, 0.1))); K.pinch("R", fo > 0 ? 0.4 : 0.85); K.relax("L");
    K.setE("neck", 0, 0, 0); K.setE("head", 0.03, 0, 0); K.sync(); }
  // 닭다리 망치질: 안쪽 손을 머리 위로 → 내려침 (u = 0이 닿는 때)
  function poseHammer(K, side, u, A, Iloc) { K.begin(); const S = side > 0 ? "L" : "R", up = sm01((u + A.up) / Math.max(0.05, A.up * 0.7)), dn = clamp((u + A.dn) / A.dn, 0, 1), rb = sm01(u / 0.12) * (1 - sm01((u - 0.12) / 0.3)), back = sm01((u - A.hold) / 0.3);
    K.setE("hips", 0, 0.12 * side, 0); K.setE("spine", 0.06 * eIn(dn) - 0.06 * up, 0.1 * side, 0); K.setE("chest", 0.1 * eIn(dn) - 0.08 * up * (1 - dn), 0.12 * side, side * 0.05); K.sync();
    K.leg("L", V(0.19, 0.1, 0.06), 0, 0.15, V(0.3, 0, 1)); K.leg("R", V(-0.19, 0.1, 0.04), 0, -0.15, V(-0.3, 0, 1));
    const sx = 0.2 * side, top = V(sx * 1.1, 1.98, -0.06), hit = Iloc.clone().add(V(side * 0.06, 0.36, -0.02)), rest = V(sx * 1.2, 0.95, 0.12);
    let w, sd; if (dn <= 0) { w = mixV3(rest, top, up); sd = mixV3(V(side * 0.6, -0.2, 0.75), V(side * 0.3, 0.45, -0.85), up).normalize(); } else if (u <= 0) { const e = eIn(dn); w = mixV3(top, hit, e).add(V(0, Math.sin(Math.PI * e) * 0.12, Math.sin(Math.PI * e) * 0.1)); sd = mixV3(V(side * 0.3, 0.45, -0.85), V(-side * 0.12, -1, -0.04), e).normalize(); }
    else { w = hit.clone().add(V(0, rb * 0.1, 0)).lerp(rest, back); sd = mixV3(V(-side * 0.12, -1, -0.04), V(side * 0.6, -0.2, 0.75), back).normalize(); }
    const Fh = tmp3.copy(w).sub(V(sx, 1.44, 0)).normalize(), Fp = Fh.clone().addScaledVector(sd, -Fh.dot(sd)).normalize(), Np = sd.clone().multiplyScalar(-side).cross(Fp);
    K.arm(S, w, V(side * 0.9, -0.5, -0.4), K.handQ(S, Fp, Np)); K.hold(S, 1);
    const O = side > 0 ? "R" : "L", os = -side; K.arm(O, V(os * 0.27, 0.86, 0.1), V(os * 0.6, 0.2, -0.8), K.handQ(O, V(os * 0.05, -1, 0.15), V(-os, 0, 0.1))); K.relax(O);
    K.setE("neck", 0.05 * dn, -0.1 * side, 0); K.setE("head", 0.08 * dn, -0.08 * side, 0); K.sync(); }
  const phoneOf = new Map();
  function runActs(t, dt) {
    for (const q of plan) { if (q.done || t < q.ta - 0.02) continue;
      if (!q.on) { q.on = true; q.I0 = hitPoint(q.phi, V()); const slow = !q.fast; q.gs = slow ? gsS : 0.92; if (q.type === "jobs" && slow) q.gs *= 1.15;
        q.A = slow ? { wind: 0.42, sw: 0.14, fo: 0.32, fl: 0.28, up: 0.38, dn: 0.13, hold: 0.25 } : { wind: clamp(q.I * 0.7, 0.08, 0.3), sw: clamp(q.I * 0.35, 0.05, 0.12), fo: 0.16, fl: clamp(q.I * 0.6, 0.08, 0.2), up: clamp(q.I * 0.8, 0.08, 0.3), dn: clamp(q.I * 0.35, 0.05, 0.1), hold: 0.1 };
        q.out = (slow ? 0.55 : clamp(q.I * 1.2, 0.18, 0.4)); q.who = [];
        const take = n => { const a = free[n].pop(); if (a) { q.who.push(a); a.root.visible = true; } return a; };
        if (q.type === "will") take("will"); else if (q.type === "jobs") { const J = take("jobs"); if (J) { const ph = phoneFly.find(f => !f.on); if (ph) { ph.on = true; phoneOf.set(q, ph); scene.add(ph.p.root); ph.held = true; } } } else { take("lee"); take("jensen"); }
        if (!q.who.length) { q.done = true; continue; } }
      const u = t - q.th, enter = q.fast ? Math.max(0.1, q.th - q.ta - 0.02) : 0.45, a = sm01((t - q.ta) / enter), b = sm01((u - (q.type === "chicken" && q.th2 ? q.th2 - q.th : 0) - q.out * 0.4) / (q.out * 0.9));
      const gone = b >= 1; if (gone) { q.done = true; for (const K of q.who) { K.root.visible = false; free[K.who].push(K); } const ph = phoneOf.get(q); if (ph) { ph.on = false; scene.remove(ph.p.root); } continue; }
      // 화면 밖에서 미끄러져 들어오고 나감
      const dirOut = V(Math.cos(q.phi), Math.sin(q.phi), 0), slideK = (1 - eOut(a)) + eIn(b), slide = dirOut.clone().multiplyScalar(slideK * q.gs * (q.fast ? 1.3 : 2.6)).add(V(0, 0, slideK * q.gs * 0.4));
      const I = q.I0;
      if (q.type === "will") { const Kp = q.who[0], phi = q.mirror ? q.phi - Math.PI : q.phi; place(Kp, I, phi, q.gs, WILL_I, WY, q.mirror, slide); poseWill(Kp, u, q.A); }
      else if (q.type === "jobs") { const Kp = q.who[0], c = Math.cos(q.phi), s = Math.sin(q.phi), base = I.clone().add(V((c * 1.05 + (s < -0.8 ? -0.7 : s > 0.8 ? 0.7 : 0)) * q.gs, s * 0.6 * q.gs - 1.2 * q.gs, -1.25 * q.gs)).add(slide), yaw = clamp(-c * 0.55, -0.6, 0.6);
        Kp.root.scale.setScalar(q.gs); Kp.root.quaternion.setFromAxisAngle(V(0, 1, 0), yaw); Kp.root.position.copy(base); Kp.root.updateMatrixWorld(true); Kp.sync(); const Iloc = Kp.root.worldToLocal(I.clone()); poseJobs(Kp, u, q.A, Iloc);
        const ph = phoneOf.get(q); if (ph) { const rel = q.th - q.A.fl; if (t < rel) { phoneHold[R.jobs.indexOf(Kp)].updateMatrixWorld(true); phoneHold[R.jobs.indexOf(Kp)].matrixWorld.decompose(ph.p.root.position, ph.p.root.quaternion, tmp); ph.p.root.scale.setScalar(q.gs * (q.fast ? 1.8 : 2.6)); ph.p0 = ph.p.root.position.clone(); ph.q0 = ph.p.root.quaternion.clone(); }
          else if (u < 0) { const e = (t - rel) / q.A.fl; ph.p.root.position.lerpVectors(ph.p0, I, e).add(V(0, Math.sin(Math.PI * e) * 0.15 * q.gs, 0)); ph.p.root.quaternion.copy(ph.q0).multiply(tq.setFromAxisAngle(V(1, 0.3, 0).normalize(), e * 9)); }
          else { if (!ph.bounce) { ph.bounce = V(Math.cos(q.phi), Math.sin(q.phi) + 0.6, 0.8).multiplyScalar(2.2 * q.gs); } ph.p.root.position.addScaledVector(ph.bounce, dt); ph.bounce.y -= 9 * dt; ph.p.root.rotateX(dt * 14); } } }
      else { const roll = q.phi - Math.PI / 2; q.who.forEach((Kp, i) => { const side = Kp.who === "lee" ? 1 : -1, th = q.th2 && Kp.who === "jensen" ? q.th2 : q.th; place(Kp, I, roll, q.gs, CK_I[Kp.who], 0, false, slide); poseHammer(Kp, side, t - th, q.A, CK_I[Kp.who]); }); }
      if (!q.hit && t >= q.th) { q.hit = true; impact(q); } if (q.th2 && !q.hit2 && t >= q.th2) { q.hit2 = true; impact(q); }
    } }
  // ── 마지막 싸대기 · 날아감 ──
  const fin = { on: false }, B0 = V(), BD = V(-0.5, 0.82, -0.28).normalize();
  function finale(t, dt) { if (t < T.fsa) return; const Kp = R.will[0];
    if (!fin.on) { fin.on = true; Kp.root.visible = true; B0.copy(ball.position); }
    if (t < T.fs + 0.9) { const u = t - T.fs, a = sm01((t - T.fsa) / 0.5), slide = V(1, -0.2, 0.3).multiplyScalar((1 - eOut(a)) * 2.4); place(Kp, B0.clone().add(V(0.02, -0.04, 0)), 0.15, 1.05, WILL_I, WY, false, slide); poseWill(Kp, u, { wind: 0.6, sw: 0.13, fo: 0.4 }); }
    else Kp.root.visible = false;
    if (t >= T.fs) { at("slap", () => { snd.finalSlap(); buzz([3, 60, 3, 80, 3]); shake = 0.12; hitStop = 0.12; const f = hitFx[0]; f.t = 0; f.k = 2.2; f.g.position.copy(B0); f.r.position.copy(B0); f.g.visible = f.r.visible = true; f.gU.uC.value.setRGB(1.3, 1.05, 0.8); for (let i = 0; i < 26; i++) { const v = V(gauss(), gauss(), gauss()).normalize(); plume.add(B0.x, B0.y, B0.z, v.x * 2 - BD.x * 1.5, v.y * 2 - BD.y * 1.5, v.z * 2 - BD.z * 1.5, { life: rnd(0.6, 1.3), s0: 0.08, s1: rnd(0.4, 0.8), a: 0.35, drag: 2.4, turb: 1.4, ero: 0.3, fo: 1.5 }); } });
      const u = t - T.fs, s = 4 * u + 26 * u * u + 70 * u * u * u; ball.position.copy(B0).addScaledVector(BD, s); ball.rotation.x += dt * 30; ballM.emissiveIntensity = sm01((u - 0.5) / 1.3) * 3.5;
      ballGlow.visible = u > 0.3; ballGlow.position.copy(ball.position); ballGlowU.uA.value = sm01((u - 0.3) / 1.2) * 1.4; ballGlow.scale.setScalar(BR * (5 + 8 * sm01((u - 0.3) / 1.4)));
      if (dt > 0 && u > 0.12) { trailP.unshift(ball.position.clone()); if (trailP.length > 60) trailP.pop(); }
      // 소닉붐 · 공기 고깔
      if (u > 0.2 && u < 0.45 && dt > 0) for (let i = 0; i < 2; i++) { const v = V(gauss(), gauss(), gauss()).normalize().addScaledVector(BD, -1.2); plume.add(ball.position.x, ball.position.y, ball.position.z, v.x * 3, v.y * 3, v.z * 3, { life: rnd(0.4, 0.8), s0: 0.06, s1: rnd(0.3, 0.7) * (1 + u), a: 0.3, drag: 3, turb: 1, ero: 0.4, heat: sm01((u - 0.8) / 0.8) * 0.8, fire: false, cool: 4, fo: 1.5 }); } }
    trail.lines.visible = trailP.length > 2 && t < T.brk + 0.1; if (trail.lines.visible) { const hk = sm01((t - T.fs - 0.6) / 1); for (let i = 0; i < trailP.length - 1 && i < 89; i++) { const a = trailP[i], b = trailP[i + 1], f = 1 - i / trailP.length; trail.set(i, a.x, a.y, a.z, b.x, b.y, b.z, lerp(0.8, 3.2, hk) * f, lerp(0.85, 1.4, hk) * f, lerp(0.9, 0.5, hk) * f, f); } trail.touch(Math.min(89, trailP.length - 1)); }
    // 구름을 뚫고 올라감
    for (const c of clouds) { c.c.mesh.visible = t > T.fs && t < T.brk; if (!c.c.mesh.visible) continue; c.c.mesh.position.copy(B0).addScaledVector(BD, c.s * 3).add(c.lat); c.c.mesh.scale.setScalar(c.sz); c.c.U.uLit.value = 1.1; c.c.U.uA.value = 0.9; }
  }
  // ── 우주: 행성 하나씩 ──
  // 행성 장면 [시작, 뚫는 때, 터지는 때, 끝, 구슬 빠르기]
  const BEAT = { earth: [T.e0, T.e0 + 0.06, T.eX, T.e1, 70], mars: [T.m0, T.mH, T.mX, T.m1, 34], jupiter: [T.j0, T.jH, T.jX, T.j1, 150], saturn: [T.s0, T.sH, T.sX, T.s1, 135], uranus: [T.u0, T.uH, T.uX, T.u1, 95], neptune: [T.n0, T.nH, T.nX, T.n1, 95], venus: [T.v0, T.vH, T.vX, T.v1, 110], mercury: [T.me0, T.meH, T.meX, T.me1, 95] };
  const sunDirAt = (p, out) => out.copy(p).negate().normalize(), LCP = new THREE.Color(1.3, 1.25, 1.2);
  function explodeFx(p) { const r = p.R, c = p.P;
    p.flash.visible = true; p.flash.position.copy(c); p.ring.mesh.visible = true; p.ring.mesh.position.copy(c); p.ring.mesh.quaternion.setFromEuler(new THREE.Euler(rnd(1.0, 1.4), rnd(-0.4, 0.4), rnd(0, 6))); p.ring.U.uC.value.copy(p.hot || new THREE.Color(1.6, 0.6, 0.2)); p.shell.mesh.visible = true; p.shell.mesh.position.copy(c); p.shell.U.uC.value.copy(p.hot || new THREE.Color(1.4, 0.7, 0.3)).multiplyScalar(0.6);
    const cols = p.name === "earth" ? [[0.2, 0.32, 0.6], [0.35, 0.42, 0.25], [0.5, 0.44, 0.36]] : p.name === "mars" ? [[0.6, 0.28, 0.14], [0.45, 0.22, 0.12]] : p.name === "jupiter" ? [[0.7, 0.5, 0.35], [0.85, 0.75, 0.6]] : p.name === "saturn" ? [[0.85, 0.75, 0.55], [0.7, 0.6, 0.42]] : p.name === "uranus" ? [[0.55, 0.8, 0.85]] : p.name === "neptune" ? [[0.2, 0.32, 0.8], [0.3, 0.45, 0.85]] : p.name === "venus" ? [[0.85, 0.75, 0.55]] : [[0.45, 0.42, 0.4]];
    const N = p.rocks.P.length ? 0 : (p.name === "jupiter" || p.name === "saturn" ? 260 : 160); for (let i = 0; i < N; i++) { const d = V(gauss(), gauss(), gauss()).normalize(), sp = r * rnd(0.6, 3.2), cc = cols[(Math.random() * cols.length) | 0]; p.rocks.add(c.clone().addScaledVector(d, r * rnd(0.5, 1.0)), d.multiplyScalar(sp), r * rnd(0.012, 0.06), new THREE.Color(cc[0], cc[1], cc[2]).multiplyScalar(rnd(0.7, 1.2))); }
    for (let i = 0; i < 380 && spN < 3000; i++) { const d = V(gauss(), gauss(), gauss()).normalize(), j = spN++, sp = r * rnd(1.5, 7); sparks.p.set([c.x + d.x * r * 0.9, c.y + d.y * r * 0.9, c.z + d.z * r * 0.9], j * 3); spV.set([d.x * sp, d.y * sp, d.z * sp], j * 3); spL[j] = 0; spM[j] = rnd(0.8, 2.4); const h = p.hot || new THREE.Color(1.5, 0.6, 0.2); sparks.c.set([h.r * 1.4, h.g * 1.4, h.b * 1.4, 1], j * 4); sparks.s[j] = r * rnd(0.02, 0.06); }
    for (let i = 0; i < 6; i++) { const d = V(gauss(), gauss(), gauss()).normalize(), s = r * rnd(1.4, 4), q = r * rnd(0.8, 1.05); plume.add(c.x + d.x * q, c.y + d.y * q, c.z + d.z * q, d.x * s, d.y * s, d.z * s, { life: rnd(0.45, 0.8), s0: r * rnd(0.15, 0.25), s1: r * rnd(0.35, 0.6), a: 0.5, drag: 0.8, turb: 0.2 * r, heat: 0.55, cool: 1.1, fire: true, ero: 0.2, fo: 2.2 }); }
    if (p.name === "saturn") { ringDeb.pts.visible = true; const b = p.body, qn = b.group.quaternion; for (let i = 0; i < 2600; i++) { const rr = r * rnd(1.25, 2.3), a = rnd(0, 6.283); tmp.set(Math.cos(a) * rr, 0, Math.sin(a) * rr).applyQuaternion(qn); ringDeb.p.set([c.x + tmp.x, c.y + tmp.y, c.z + tmp.z], i * 3); const out = tmp.clone().normalize().multiplyScalar(r * rnd(0.6, 2.4)); out.y += gauss() * r * 0.25; rdV.set([out.x, out.y, out.z], i * 3); const k = rnd(0.5, 1); ringDeb.c.set([1.1 * k, 0.95 * k, 0.75 * k, 1], i * 4); ringDeb.s[i] = r * rnd(0.01, 0.025); } ringDeb.touch(); }
    snd.planetBoom(clamp(r / 10, 0.4, 1.2)); buzz([3, 80, 3, 120, 2]); shake = Math.max(shake, 0.6); }
  function planets(t, dt) {
    for (const n in pl) { const p = pl[n], [b0, tH, tX, b1] = BEAT[n], sd = sunDirAt(p.P, tmp);
      p.body.update(t, sd, LCP); if (p.sh) { p.sh.U.uSun.value.copy(sd); p.sh.U.uT.value = t; }
      p.body.group.rotation.y += dt * p.spin * (p.state < 2 ? 1 : 0);
      if (t < tH) continue;
      const k = t - tH, kX = t - tX; if (p.state === 0) { p.state = 1; p.tH = tH; const inv = p.body.group.quaternion.clone().invert(); p.imA.copy(p.entry).normalize().applyQuaternion(inv); p.imB.copy(p.exit).normalize().applyQuaternion(inv); }
      const fr = Math.min(Math.PI, k * 15 + k * k * 45), heat = 0.78 * sm01(k / Math.max(0.12, tX - tH));
      if (p.mars) { const m = p.mars; m.U.uImp.value.copy(p.imA); m.U.uFront.value = fr; m.U.uHeat.value = kX > 0 ? 0.42 * Math.exp(-kX * 1.6) : 0.1 + 0.5 * heat; m.U.uShk.value = heat * heat * 1.1; m.U.uBul.value = Math.pow(sm01((k - (tX - tH) * 0.6) / ((tX - tH) * 0.4)), 3) * 1.6; m.U.uX.value = kX > 0 ? kX : 0; if (kX < 0) m.group.scale.setScalar(p.R * (1 - 0.09 * sm01((kX + 0.1) / 0.1))); m.air.material.uniforms.uA.value = kX > 0 ? 0 : 1; }
      else { const U = p.crack.U; p.crack.mesh.visible = kX < 0; U.uImpA.value.copy(p.imA); U.uImpB.value.copy(p.imB); U.uFrA.value = fr; U.uFrB.value = Math.max(0, fr - 0.2); U.uHeat.value = heat;
        const H = p.sh.U; H.uImpA.value.copy(p.imA); H.uImpB.value.copy(p.imB); H.uFrA.value = Math.max(fr, Math.PI); H.uFrB.value = Math.PI; H.uHeat.value = 1; H.uSep.value = 0; H.uX.value = Math.max(0, kX);
        if (kX >= 0 && !p.sh.mesh.visible) { p.body.group.visible = false; p.sh.mesh.visible = true; p.sh.mesh.quaternion.copy(p.body.group.quaternion); }
        if (kX < 0) { const sh = heat * heat, cl = sm01((kX + 0.1) / 0.1); p.body.group.position.copy(p.P).add(V(Math.sin(t * 71) * sh * p.R * 0.012, Math.sin(t * 83 + 1) * sh * p.R * 0.012, 0)); p.body.group.scale.setScalar(p.R * (1 - 0.09 * cl)); } }
      if (kX >= 0 && p.state === 1) { p.state = 2; explodeFx(p); }
      if (p.state >= 2 && t >= b1 && !p.fxOff) { p.fxOff = true; p.ring.mesh.visible = p.shell.mesh.visible = p.flash.visible = false; }
      if (p.state >= 2 && !p.fxOff) { const u = kX; p.flashU.uA.value = 0.55 * Math.exp(-u * 5); p.flash.scale.setScalar(p.R * (1.6 + 3 * eOut(seg(u, 0, 0.5)))); if (u > 1.6) p.flash.visible = false;
        const e = 1 - Math.exp(-u * 1.1); p.ring.mesh.scale.setScalar(p.R * 7); p.ring.U.uR.value = 0.08 + 0.9 * e; p.ring.U.uA.value = (1 - seg(u, 0.4, 2.4)) * 0.9; if (u > 2.5) p.ring.mesh.visible = false;
        p.shell.mesh.scale.setScalar(p.R * (1.05 + 1.6 * eOut(seg(u, 0, 1.2)))); p.shell.U.uA.value = 0.12 * Math.exp(-u * 3); if (u > 2.5) p.shell.mesh.visible = false;
        }
      if (p.state >= 2) { p.rocks.step(dt, 0.04); p.rocks.U.uHeat.value = Math.exp(-kX * 0.7) * 0.8; }
    }
    // 불티 · 토성 고리 조각
    if (spN) { for (let j = 0; j < spN; j++) { spL[j] += dt; const o = j * 3, dr = Math.exp(-dt * 0.6); spV[o] *= dr; spV[o + 1] *= dr; spV[o + 2] *= dr; sparks.p[o] += spV[o] * dt; sparks.p[o + 1] += spV[o + 1] * dt; sparks.p[o + 2] += spV[o + 2] * dt; const f = 1 - clamp(spL[j] / spM[j], 0, 1); sparks.c[j * 4 + 3] = f * f; } sparks.touch(); }
    if (ringDeb.pts.visible) { for (let i = 0; i < 2600; i++) { const o = i * 3, dr = Math.exp(-dt * 0.9); rdV[o] *= dr; rdV[o + 1] *= dr; rdV[o + 2] *= dr; ringDeb.p[o] += rdV[o] * dt; ringDeb.p[o + 1] += rdV[o + 1] * dt; ringDeb.p[o + 2] += rdV[o + 2] * dt; } ringDeb.touch(); }
  }
  // 구슬이 행성을 지나는 선: 행성 가운데보다 카메라 쪽(+z)으로 0.55R, 위로 0.15R → 들어간 구멍과 나온 구멍이 다 보임
  for (const n in pl) { const p = pl[n], r = p.R, ret = n === "venus" || n === "mercury", dx = ret ? -1 : 1; p.line = { o: p.P.clone().add(V(0, 0.15 * r, 0.55 * r)), d: V(dx, 0, 0) }; const h = Math.sqrt(r * r - (0.15 * r) ** 2 - (0.55 * r) ** 2); p.entry = V(-dx * h, 0.15 * r, 0.55 * r); p.exit = V(dx * h, 0.15 * r, 0.55 * r); }
  { const e = pl.earth; e.entry = V(-0.25, 0.92, 0.3).normalize().multiplyScalar(e.R); e.exit = e.entry.clone(); e.line = { o: e.P.clone().add(e.entry), d: V(0.82, 0.45, 0.2).normalize() }; }
  // 해왕성을 지나 계속 가다 느려져 멈추고 다시 떨어짐 (포물선) · 그 끝이 되돌아오는 길의 시작
  const nep = pl.neptune, VN = BEAT.neptune[4], AN2 = VN / (0.5 * (T.tn1 - T.tn0)), tStart = nep.line.o.clone().addScaledVector(nep.line.d, (T.n1 - T.nH) * VN - nep.entry.distanceTo(nep.exit) / 2);
  const turnPos = (u, out) => out.set(tStart.x + VN * u - 0.5 * AN2 * u * u, tStart.y + 2 * sm01(u / 2.05), tStart.z + 6 * sm01(u / 2.05)); turnPos(T.tn1 - T.tn0, retPts[0]);
  // 구슬 (우주)
  const sball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc890, emissiveIntensity: 3, roughness: 0.3, metalness: 0.6 })); sball.frustumCulled = false; spaceG.add(sball);
  const sglowU = { uC: { value: new THREE.Color(1.8, 1.1, 0.6) }, uA: { value: 1.2 }, uCore: { value: 3 } }, sglow = billboard(glowFS, sglowU, 2); spaceG.add(sglow); const strl = streaks(170), strP = [], tdots = glowPoints(170, PS, 1.6); spaceG.add(tdots.pts); spaceG.add(strl.lines);
  const bpos = V(), bvel = V();
  function spaceBall(t, dt) {
    let on = true;
    const beat = Object.keys(BEAT).find(n => t >= BEAT[n][0] && t < BEAT[n][3]);
    if (beat) { const p = pl[beat], [b0, tH, , , v] = BEAT[beat], L = p.line; const hh = p.entry.distanceTo(p.exit) / 2; bpos.copy(L.o).addScaledVector(L.d, (t - tH) * v - hh); bvel.copy(L.d).multiplyScalar(v);
      // 행성 속에 있는 동안은 안 보임
      if (beat !== "earth") { const s = (t - tH) * v; on = !(s > 0 && s < p.entry.distanceTo(p.exit)); } else on = t >= tH; if (beat === "earth") bpos.copy(L.o).addScaledVector(L.d, Math.max(0, t - tH) * v); }
    else if (t >= T.tn0 && t < T.rt1) { // 되돌아옴: 해왕성 밖에서 느려져 멈췄다가 다시 해 쪽으로 (점점 빨라짐)
      if (t < T.tn1) { const u = t - T.tn0; turnPos(u, bpos); bvel.set(VN - AN2 * u, 0, 0); }
      else { const u = Math.pow(seg(t, T.rt0, T.rt1), 1.35) * pl.venus.u * 0.985; retPath.getPoint(u, bpos); retPath.getTangent(u, bvel); bvel.multiplyScalar(lerp(150, 520, u)); } }
    else if (t >= T.v0 && t < T.me1) { }
    else if (t >= T.sn0 && t < T.plop) { const u = seg(t, T.sn0, T.plop), a = pl.mercury.u; retPath.getPoint(lerp(a + 0.02, 1, Math.pow(u, 1.4)), bpos); retPath.getTangent(0.99, bvel); bvel.multiplyScalar(-300); }
    else on = false;
    if (t >= T.plop) on = false;
    sball.visible = sglow.visible = on && spaceG.visible; tdots.pts.visible = sball.visible; if (!sball.visible) { strP.length = 0; strl.lines.visible = false; return; }
    const dc = cam.position.distanceTo(bpos), px = dc * Math.tan(cam.fov * Math.PI / 360) * 2 / vh;   // 화소 하나의 크기
    sball.position.copy(bpos); sball.scale.setScalar(Math.max(0.08, px * 2.2)); sglow.position.copy(bpos); sglow.scale.setScalar(Math.max(0.6, px * 56)); sglowU.uA.value = 1.6;
    if (dt > 0) { strP.unshift(bpos.clone()); const turnK = t >= T.n1 - 0.6 && t < T.tn1; if (strP.length > (turnK ? 168 : 36)) strP.length = turnK ? 168 : 36; if (strP.length > 1 && strP[0].distanceTo(strP[1]) > 60) strP.length = 1; }
    strl.lines.visible = strP.length > 2; for (let i = 0; i < strP.length - 1 && i < 169; i++) { const a = strP[i], b = strP[i + 1], f = 1 - i / strP.length; strl.set(i, a.x, a.y, a.z, b.x, b.y, b.z, 1.3 * f, 0.8 * f, 0.4 * f, f * f); } strl.touch(Math.min(169, Math.max(0, strP.length - 1)));
    { const n = Math.min(170, strP.length); for (let i = 0; i < 170; i++) { if (i >= n) { tdots.c[i * 4 + 3] = 0; continue; } const q = strP[i], f = 1 - i / Math.max(n, 2); tdots.p[i * 3] = q.x; tdots.p[i * 3 + 1] = q.y; tdots.p[i * 3 + 2] = q.z; tdots.c.set([1.6 * f, 1.0 * f, 0.5 * f, f], i * 4); tdots.s[i] = (0.4 + 0.6 * f) * px * 9; } tdots.touch(); }
  }
  // 일론: 화성 꼭대기에 서서 날아오는 구슬을 손가락질 → 화성이 갈라지면 엄지척 → 터지면 날아감 (늘 카메라를 봄 · 굴러도 화면 안에서만 돌아감)
  function elon(t, dt) { const p = pl.mars; K.root.visible = t >= T.m0 - 0.2 && t < T.m1; if (!K.root.visible) return; const r = p.R, s = r * 0.85 / 1.9;
    K.root.scale.setScalar(s); const top = p.P.clone().add(V(-0.12 * r, r * 0.995, 0.1 * r)); let pos = top.clone(), roll = 0; const fly = t - T.mX; if (fly > 0) { pos.add(V(fly * r * 1.4, fly * r * 1.9 + fly * fly * r * 0.4, fly * r * 0.6)); roll = -fly * 2.4; }
    K.root.position.copy(pos); camQ(tq); K.root.quaternion.setFromAxisAngle(V(0, 0, 1), roll); { const toC = tmp.copy(cam.position).sub(pos).setY(0).normalize(); K.root.quaternion.multiply(tq.setFromAxisAngle(V(0, 1, 0), Math.atan2(toC.x, toC.z))); }
    K.begin(); K.B.hips.position.y = 0.98; K.sync();
    const pt = t < T.mH + 0.1, thumbs = t >= T.mH + 0.1; K.show(thumbs ? "b" : "a");
    K.leg("L", V(0.13, 0.1, 0.05), 0, 0.1, V(0.3, 0, 1)); K.leg("R", V(-0.13, 0.1, 0.02), 0, -0.1, V(-0.3, 0, 1));
    if (pt) { K.arm("L", V(0.42, 1.48, 0.42), V(0.8, -0.4, -0.3), K.handQ("L", V(0.6, 0.35, 0.7), V(0, -1, 0))); K.fingers("L", 1, 0.85, 0); K.arm("R", V(-0.25, 0.95, 0.12), V(-0.9, -0.5, -0.2), K.handQ("R", V(0, -1, 0.2), V(1, 0, 0))); K.fingers("R", 0.4, 0.3, 0.4); }
    else { K.arm("L", V(0.36, 1.36, 0.46), V(0.8, -0.6, -0.3), K.handQ("L", V(-0.2, 0.02, 1), V(-1, 0, -0.2))); K.arm("R", V(-0.36, 1.36, 0.46), V(-0.8, -0.6, -0.3), K.handQ("R", V(0.2, 0.02, 1), V(1, 0, -0.2))); K.thumbUp("L"); K.thumbUp("R"); }
    K.sync(); }
  const camQ = q => q.copy(cam.quaternion);
  // 해: 구슬이 쏙 → 조용 → 부글부글 → 불꽃 손이 솟아 따봉
  const FISTC = { index: [-1.45, -1.75, -1.1], middle: [-1.5, -1.75, -1.1], ring: [-1.55, -1.75, -1.1], pinky: [-1.6, -1.7, -1.05] }, POPD = V(1, 0.02, 0.06).normalize();
  const qFist = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)));   // 손가락 → 카메라 쪽 · 엄지 → 위 · 손바닥 → 오른쪽(몸 안쪽)
  function sunFx(t, dt) { sunB.update(t, V(0, 0, 1), null); const bo = sm01((t - T.boil0) / 1.4); sunB.U.uI.value = 1.0 * (1 + 0.12 * bo * Math.sin(t * 11)); boil.U.uT.value = t;
    boil.mesh.visible = t > T.plop - 0.05; boil.U.uA.value = sm01((t - T.plop + 0.05) / 0.2); boil.U.uBoil.value = bo; boil.U.uI.value = 0.95 * (1 + 0.15 * bo * Math.sin(t * 9 + 1));
    const pu = t - T.plop; boil.U.uPop.value.copy(POPD); boil.U.uPopK.value = pu > 0 ? Math.exp(-pu * 1.8) * 1.2 : 0; boil.U.uPopR.value = Math.max(0, pu) * 0.55;
    const wob = 1 + bo * (0.006 * Math.sin(t * 13) + 0.004 * Math.sin(t * 21 + 1)); sunB.group.scale.setScalar(SUNR * wob); boil.mesh.scale.setScalar(SUNR * wob);
    if (t > T.plop) at("plop", () => { snd.plop(); buzz(2); for (let i = 0; i < 14; i++) { const d = POPD.clone().add(V(gauss() * 0.06, gauss() * 0.06, gauss() * 0.06)).normalize(), s = rnd(3, 9); plume.add(d.x * SUNR, d.y * SUNR, d.z * SUNR, d.x * s, d.y * s, d.z * s, { life: rnd(0.8, 1.6), s0: 1.2, s1: rnd(3, 6), a: 0.6, drag: 1.4, turb: 1.5, heat: 0.9, cool: 1.8, fire: true, ero: 0.14, fo: 1.3 }); } });
    // 끓는 동안 가장자리(카메라에서 보이는 둘레)에서 불꽃이 솟음
    if (bo > 0.05 && t < T.end && dt > 0 && Math.random() < dt * 10 * bo) { const vD = tmp.copy(cam.position).normalize(), side = tmp2.set(rnd(-1, 1), rnd(0.2, 1), rnd(-1, 1)).addScaledVector(vD, -0).normalize(); side.addScaledVector(vD, -side.dot(vD)).normalize(); const d = side.addScaledVector(vD, rnd(-0.1, 0.25)).normalize(), s = rnd(2, 6);
      plume.add(d.x * SUNR, d.y * SUNR, d.z * SUNR, d.x * s, d.y * s, d.z * s, { life: rnd(1.0, 2.0), s0: 1.5, s1: rnd(4, 8), a: 0.6, drag: 1.3, turb: 2, heat: 0.95, cool: 1.4, fire: true, ero: 0.14, fo: 1.2 }); }
    // 손: 해 위쪽 가장자리에서 솟아 엄지를 세움
    handG.visible = arm.visible = t >= T.hand0; if (handG.visible) { const u = sm01((t - T.hand0) / 1.1), th = eBack(seg(t, T.thumb - 0.12, T.thumb + 0.4), 2.2), hs = SUNR * 7.2; handG.scale.setScalar(hs);
      handG.position.set(-SUNR * 0.1, SUNR * lerp(0.55, 1.2, u) + Math.sin(t * 2.2) * SUNR * 0.012, SUNR * 0.45); handG.quaternion.setFromAxisAngle(V(0, 1, 0), -0.42 + 0.05 * Math.sin(t * 1.6)).multiply(tq.setFromAxisAngle(V(1, 0, 0), -0.12)).multiply(qFist);
      armU.uScale.value = SUNR * 0.12; armU.uT.value = t;
      const H = R.HP, k = sm01((t - T.hand0 - 0.3) / 0.6); for (const n of ["index", "middle", "ring", "pinky"]) { const f = FISTC[n]; H.setChain(n, [null, [f[0] * lerp(0.25, 1, k), 0, 0], [f[1] * lerp(0.25, 1, k), 0, 0], [f[2] * lerp(0.25, 1, k), 0, 0]]); }
      H.setChain("thumb", [[lerp(-0.45, 0.2, th), lerp(0.25, -0.38, th), 0], [lerp(-0.4, 0.12, th), 0, 0], [lerp(-0.4, 0.12, th), 0, 0]]);
      // 팔: 손목에서 뒤로 빠져 해 속으로 (굵은 불꽃 기둥)
      handG.updateMatrixWorld(true); const wr = tmp.copy(handG.position), back = tmp2.set(0, 0, -1).applyQuaternion(handG.quaternion).multiplyScalar(-1), dir = tmp3.copy(V(0, 0, -1).applyQuaternion(handG.quaternion));
      const wristW = wr.clone(), foot = wr.clone().addScaledVector(V(0, 0, 0).add(V(0.1, -1, -0.5)).normalize(), SUNR * 0.6); foot.setLength(SUNR * 0.9); const mid = wristW.clone().lerp(foot, 0.5), len = wristW.distanceTo(foot); arm.position.copy(mid); arm.quaternion.setFromUnitVectors(V(0, 1, 0), tmp.copy(wristW).sub(foot).normalize()); arm.scale.set(SUNR * 0.2, len, SUNR * 0.2);
      if (t >= T.thumb) at("thumbs", () => { snd.fanfare(); buzz([2, 60, 2, 60, 3]); }); }
  }
  // ── 카메라 ──
  const gsS = clamp(SH * 0.5, 1.15, 1.7), SKF = []; {
    const k = (t, p, l, d = 0.5) => SKF.push([t, p, l, d]);
    k(0, V(0, 0, Dm), V(0, 0, 0)); k(T.pull, V(0, 0, Dm), V(0, 0, 0));
    const lR = V(SW * 0.16 + 0.32 * gsS, 0.08 * SH, 0), dR = fit(SW * 1.05 + 0.9 * gsS, SH * 1.1); k(T.w1a + 0.5, lR.clone().add(V(0.18 * gsS, 0.12, dR)), lR, 0.6); k(T.w1 + 0.4, lR.clone().add(V(0.14 * gsS, 0.1, dR * 1.02)), lR);
    const lL = V(-(SW * 0.04 + 0.42 * gsS), 0.08 * SH, 0), dL = fit(SW * 0.8 + 0.9 * gsS, SH * 1.1); k(T.w2a + 0.45, lL.clone().add(V(-0.18 * gsS, 0.12, dL)), lL, 0.55); k(T.w2 + 0.35, lL.clone().add(V(-0.14 * gsS, 0.1, dL * 1.02)), lL);
    const gsJ = gsS * 1.15, lJ = V(-0.45 * gsJ, -0.32 * SH, 0), dJ = fit(0.7 + 1.4 * gsJ, SH * 0.95); k(T.ja + 0.5, lJ.clone().add(V(-0.1, 0.25, dJ)), lJ, 0.5); k(T.jb + 0.3, lJ.clone().add(V(-0.05, 0.22, dJ * 1.03)), lJ);
    const lC = V(0, SH * 0.36 + 0.3 * gsS, 0), dC = fit(1.6 * gsS, 1.9 * gsS + 0.6); k(T.c1a + 0.5, lC.clone().add(V(0.05, 0.1, dC)), lC, 0.5); k(T.c2 + 0.3, lC.clone().add(V(0.05, 0.06, dC * 1.03)), lC);
    const dF = fit(1.9, 2.35); k(T.f0 + 0.35, V(0.05, 0.28, dF), V(0, 0.2, 0), 0.5); k(T.ff, V(0.04, 0.26, dF), V(0, 0.2, 0)); k(T.f1 - 0.4, V(0.04, 0.2, dF * 0.86), V(0, 0.14, 0)); const dE = fit(1.3, 1.6); k(T.ting + 0.15, V(0.03, 0.05, dE), V(0, 0, 0), 0.55); k(T.fsa, V(0.03, 0.05, dE), V(0, 0, 0)); }
  const cP = V(), cL = V(), cUp = V(0, 1, 0); let fovNow = X.FOV;
  function look(p, l, up = V(0, 1, 0)) { cP.copy(p); cL.copy(l); cUp.copy(up); }
  function camera(t, dt) { let fov = X.FOV;
    if (t < T.fs + 0.15) { // 하늘: 장면마다 잡는 곳을 정해 두고 부드럽게 넘어감 (윌은 왼쪽 뒤에서, 나머지는 앞에서 보이는 방향)
      let a = SKF[0]; for (let i = 1; i < SKF.length; i++) { const b = SKF[i]; if (t <= b[0]) { const e = eInOut(seg(t, b[0] - b[3], b[0])); cP.lerpVectors(a[1], b[1], e); cL.lerpVectors(a[2], b[2], e); break; } a = b; if (i === SKF.length - 1) { cP.copy(b[1]); cL.copy(b[2]); } }
      cP.x += Math.sin(t * 0.5) * 0.03 * sm01(t - T.pull); cP.y += Math.sin(t * 0.37 + 1) * 0.02 * sm01(t - T.pull); cUp.set(0, 1, 0);
      if (t > T.fsa - 0.1) { const a2 = eInOut(seg(t, T.fsa - 0.1, T.fs - 0.25)), b = ball.position; cP.lerp(tmp.copy(b).add(V(0.85, 0.42, fit(2.2, 2.4))), a2); cL.lerp(tmp.copy(b).add(V(0.4, 0.3, 0)), a2); } }
    else if (t < T.brk) { // 쫓아 올라감
      const u = t - T.fs, b = ball.position; if (u < 0.55) { const a = eInOut(seg(u, 0.15, 0.55)); cP.lerp(tmp.copy(B0).addScaledVector(BD, -1.2).add(V(0.6, -0.5, 1.2)), a * 0.15); cL.lerp(b, 0.35); }
      else { const tgt = tmp.copy(b).addScaledVector(BD, -lerp(2.2, 5, sm01((u - 0.55) / 1.2))).add(V(0.9, -0.6, 0.8)); cP.lerp(tgt, 1 - Math.exp(-dt * 8)); cL.lerp(tmp2.copy(b).addScaledVector(BD, 6), 1 - Math.exp(-dt * 9)); } fov = lerp(X.FOV, 52, sm01((u - 0.5) / 1.2)); }
    else { // 우주
      const n = Object.keys(BEAT).find(k => t >= BEAT[k][0] && t < BEAT[k][3]);
      if (n) { const p = pl[n], r = p.R, [b0, tH, tX, b1] = BEAT[n], u = seg(t, b0, b1), side = n === "venus" || n === "mercury" ? -1 : 1, w = r * (n === "earth" ? 3.2 : n === "mars" ? 2.5 : 3.0), h = r * (n === "mars" ? 2.6 : 3.0), dist = fit(w, h) * (1 + 0.18 * u + (t > tX ? 0.12 * eOut(seg(t, tX, b1)) : 0));
        const dir = V(-0.38 * side, 0.2, 1).normalize(); cP.copy(p.P).addScaledVector(dir, dist).add(V(-0.04 * r * side * u, 0, 0)); cL.copy(p.P).add(V(-0.35 * r * side, n === "mars" ? 0.72 * r : 0.05 * r, 0)); cUp.set(0, 1, 0); fov = X.FOV;
        if (n === "earth") { cL.add(V(0.5 * r, 0.3 * r, 0)); } }
      else if (t >= T.tn0 && t < T.tn1) { const u = seg(t, T.tn0, T.tn1); const dT = fit(66, 30, 40), cx = tStart.x + VN * (T.tn1 - T.tn0) / 8; cP.set(cx, tStart.y + 0.18 * dT, tStart.z + dT); cL.set(cx - 3 * u, tStart.y, tStart.z + 2); fov = 40; }
      else if (t >= T.rt0 && t < T.rt1) { const tg = tmp.copy(bvel).normalize(); cP.copy(bpos).addScaledVector(tg, -9).add(V(0, 2.6, 3.2)); cL.copy(bpos).addScaledVector(tg, 30); fov = lerp(50, 62, seg(t, T.rt0, T.rt1)); }
      else if (t >= T.sn0) { const u = seg(t, T.sn0, T.plop); if (t < T.plop) { cP.set(lerp(150, 70, eIn(u)), lerp(14, 5, u), lerp(30, 12, u)); cL.set(SUNR, 0, 0).lerp(bpos, 0.5); fov = 45; }
        else { const e = eInOut(seg(t, T.plop + 0.5, T.boil0 + 0.4)), h = eInOut(seg(t, T.hand0 - 0.3, T.thumb + 0.3)), dEnd = fit(SUNR * 2.2, SUNR * 2.4, 40); cP.set(lerp(70, -SUNR * 0.12, e), lerp(5, SUNR * lerp(0.5, 0.95, h), e), lerp(12, dEnd + SUNR * 0.35 - h * SUNR * 0.55, e)); cL.set(lerp(SUNR, -SUNR * 0.08, e), lerp(0, SUNR * lerp(0.62, 1.35, h), e), lerp(0, SUNR * 0.25, e)); fov = 40; } } }
    camKick.multiplyScalar(Math.exp(-dt * 11)); fovKick *= Math.exp(-dt * 9); if (t < T.fs + 0.15) { cP.add(camKick); cL.addScaledVector(camKick, 0.4); fov += fovKick; }
    if (Math.abs(fov - fovNow) > 0.01) { fovNow = fov; cam.fov = fov; cam.updateProjectionMatrix(); }
    shake *= Math.exp(-dt * 5); const s = shake * (t < T.brk ? 1 : 3); cam.position.copy(cP); if (s > 0.0005) { cam.position.x += rnd(-1, 1) * s; cam.position.y += rnd(-1, 1) * s; cam.position.z += rnd(-1, 1) * s * 0.5; } cam.up.copy(cUp); cam.lookAt(cL); cam.updateMatrixWorld(true); }
  // ── 세상 전환 · 화면 값 ──
  function world(t, dt) { const space = t >= T.brk; skyG.visible = !space; sky.mesh.visible = !space; spaceG.visible = space;
    const u = seg(t, T.fs + 0.4, T.brk); sky.U.uAlt.value = Math.pow(u, 1.6); sky.U.uVis.value = 1; if (dt > 0) { sky.U.uFly.value.z += dt * (0.004 + 0.4 * u); }
    if (space && scene.environment !== envSp.texture) { scene.environment = envSp.texture; scene.environmentIntensity = 0.6; plume.clear(); }
    key.target.position.copy(sqG.position); key.position.copy(sqG.position).addScaledVector(SKY_SUN, 30);
    const tm = sm01((t - T.pull) / 0.6); P.tm = tm; P.sky = space ? 1 : 0; P.bloom = space ? 0.42 : 0.3 * tm; P.bth = space ? 2.0 : 1.8; P.expo = space ? lerp(1.1, 0.78, sm01((t - T.sn0) / 1.2)) : 1.0; P.vig = 0.28 * tm; P.ca = 0; P.flash = 0; P.shA = 0; P.white = 0; P.fade = 0;
    if (t > T.brk - 0.15 && t < T.brk + 0.35) { const a = t < T.brk ? seg(t, T.brk - 0.15, T.brk) : 1 - seg(t, T.brk, T.brk + 0.35); P.white = a * 0.6; }
    if (hitWave && t < T.fs) { const a = t - hitWave.t0; if (a >= 0 && a < 0.45) { P.shC = hitWave.c; P.shR = eOut(a / 0.45) * 0.42 * (0.6 + 0.4 * hitWave.k); P.shA = (1 - a / 0.45) * 0.5 * hitWave.k; P.ca = Math.max(P.ca, 1.6 * hitWave.k * Math.exp(-a * 14)); } }
    if (t > T.fs && t < T.fs + 0.6) { const a = Math.exp(-(t - T.fs) * 10); P.flash = a * 0.22; P.ca = a * 2; P.shC = new THREE.Vector2(0.5, 0.5); const b = t - T.fs; P.shR = eOut(b / 0.6) * 0.7; P.shA = (1 - b / 0.6) * 0.8; }
    for (const n in pl) { const p = pl[n]; if (p.state >= 2) { const a = t - p.tX0; if (a >= 0 && a < 1.2) { P.flash = Math.max(P.flash, 0.05 * Math.exp(-a * 14)); P.flashC = p.hot ? p.hot.clone().multiplyScalar(0.6).addScalar(0.4) : null; const sc = tmp.copy(p.P).project(cam); P.shC = new THREE.Vector2(sc.x * 0.5 + 0.5, sc.y * 0.5 + 0.5); P.shR = eOut(seg(a, 0, 1.1)) * 1.2; P.shA = (1 - seg(a, 0.2, 1.1)) * 0.6; } } }
    if (t > T.plop && t < T.plop + 0.8) P.flash = Math.max(P.flash, 0.4 * Math.exp(-(t - T.plop) * 6));
    if (t > T.end - 0.8) P.fade = seg(t, T.end - 0.8, T.end);
    // 별 줄: 돌아오는 길에서 속도감
    warp.lines.visible = t >= T.rt0 && t < T.rt1; if (warp.lines.visible && dt > 0) { const fw = tmp.copy(bvel).normalize(), sp = bvel.length(), bx = 40, L = sp * 0.025; for (let i = 0; i < 260; i++) { const s = wst[i]; s.addScaledVector(fw, -sp * dt / bx); if (s.lengthSq() > 2.6) s.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).addScaledVector(fw, 1.1).normalize().multiplyScalar(rnd(0.3, 1.2)); const x = cam.position.x + s.x * bx, y = cam.position.y + s.y * bx, z = cam.position.z + s.z * bx; warp.set(i, x, y, z, x - fw.x * L, y - fw.y * L, z - fw.z * L, 0.6, 0.7, 0.9, Math.hypot(s.y, s.z) > 0.15 ? 0.5 : 0); } warp.touch(); }
  }
  function fx(t, dt) { for (const s2 of impStars) { if (s2.t > 0.4) { s2.sp.visible = false; continue; } s2.t += dt; const e = s2.t / 0.4; s2.sp.material.opacity = s2.k * Math.pow(1 - e, 2); s2.sp.scale.setScalar((0.35 + 0.9 * eOut(Math.min(1, e * 2.2))) * s2.k * (0.6 + wadR())); }
    for (const [st, q] of stickSq) { q.v += (-900 * q.x - 18 * q.v) * dt; q.x += q.v * dt; const sy = 1 + q.x, sx = 1 / Math.sqrt(Math.max(0.3, sy)); st.root.scale.set(sx, sy, sx); if (Math.abs(q.x) < 0.002 && Math.abs(q.v) < 0.02) { st.root.scale.set(1, 1, 1); stickSq.delete(st); } } for (const f of hitFx) { if (f.t > 1) { f.g.visible = f.r.visible = false; continue; } f.t += dt; f.gU.uA.value = f.k * 1.8 * Math.exp(-f.t * 12); f.g.scale.setScalar(0.12 + f.t * 2.2 * f.k); f.rU.uR.value = Math.min(0.95, f.t * 3.4); f.rU.uA.value = 0.55 * f.k * Math.exp(-f.t * 6); f.r.scale.setScalar(0.5 * f.k); }
    dust.pts.visible = dP.length > 0; let n = 0; for (let i = dP.length - 1; i >= 0; i--) { const q = dP[i]; q.life += dt; if (q.life > q.max) { dP.splice(i, 1); continue; } q.v.multiplyScalar(Math.exp(-dt * 2.4)); if (q.g) q.v.y += q.g * dt; q.p.addScaledVector(q.v, dt); }
    for (const q of dP) { if (n >= 1600) break; const f = 1 - q.life / q.max; dust.p.set([q.p.x, q.p.y, q.p.z], n * 3); dust.c.set([q.c[0], q.c[1], q.c[2], f], n * 4); dust.s[n] = q.s; n++; } for (let i = n; i < 1600; i++) dust.c[i * 4 + 3] = 0; dust.touch(); }
  // ── 소리 시간표 ──
  function sounds(t) { if (t >= T.w1a) at("in1", () => snd.whoosh(0.45, 0.5)); if (t >= T.w2a) at("in2", () => snd.whoosh(0.45, 0.5)); if (t >= T.jr) at("thr", () => snd.whoosh(0.3, 0.6)); if (t >= T.c1a) at("in4", () => snd.whoosh(0.45, 0.5));
    if (t >= T.f0) at("grind", () => snd.grind(T.f1 - T.f0)); if (t >= T.ting) at("ting", () => { snd.ting(); buzz(1); }); if (t >= T.fsa) at("in5", () => snd.whoosh(0.5, 0.6));
    if (t >= T.fs + 0.05) at("rocket", () => { snd.rocket(T.brk - T.fs); }); if (t >= T.brk) at("sonic", () => { snd.sonic(); buzz([3, 80, 3]); }); if (t >= T.tn0 + 0.3) at("grav", () => snd.gravity(T.tn1 - T.tn0)); if (t >= T.rt0) at("ret", () => snd.whoosh(T.rt1 - T.rt0, 0.7));
    if (t >= T.mH - 0.6) at("elon", () => snd.whoosh(0.5, 0.4)); if (t >= T.boil0) at("boil", () => snd.boil(T.hand0 + 1 - T.boil0)); if (t >= T.hand0) at("rise", () => snd.rise()); }
  // 행성이 뚫릴 때 소리
  function pierceSounds(t) { for (const n in pl) { const [, tH, tX] = BEAT[n]; if (t >= tH) at("p" + n, () => { snd.pierce(); buzz(2); }); if (t >= tH + 0.05) at("r" + n, () => snd.rumble(tX - tH)); if (t >= tX) at("x" + n, () => { pl[n].tX0 = tX; }); } }

  // 처음 그릴 때 멈칫하지 않게: 하늘 장면 · 우주 장면 따로 (빛 구성이 달라 셰이더가 다름) · 다 보이게 해서 컴파일하고 1화소로 한 번 그림 (그림자 · 텍스처 올리기까지)
  async function warmPass(isSky) { const list = isSky ? [...people.map(k => k.root), ball, gleam, ballGlow, trail.lines, dust.pts, ...R.phones.map(p => p.root), ...hitFx.flatMap(f => [f.g, f.r]), ...clouds.map(c => c.c.mesh)] : [K.root, handG, arm, boil.mesh, sball, sglow, strl.lines, tdots.pts, ringDeb.pts, sparks.pts, warp.lines, ...Object.values(pl).flatMap(p => [p.sh ? p.sh.mesh : null, p.crack ? p.crack.mesh : null, p.ring.mesh, p.shell.mesh, p.flash, p.rocks.mesh].filter(Boolean))];
    const was = list.map(v => v.visible); skyG.visible = sky.mesh.visible = isSky; spaceG.visible = !isSky; list.forEach(v => (v.visible = true)); if (isSky) R.phones.forEach(p => scene.add(p.root)); else { K.show("all"); for (const p of Object.values(pl)) { p.rocks.add(p.P, V(), 0.1, new THREE.Color(1, 1, 1), 0); p.rocks.step(0); } }
    renderer.setRenderTarget(post.sRT); await renderer.compileAsync(scene, cam).catch(() => {});
    const vp = renderer.getViewport(new THREE.Vector4()), scT = renderer.getScissorTest(); renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true); renderer.render(scene, cam); renderer.setScissorTest(scT); renderer.setViewport(vp); plume.warm(scene, cam);
    list.forEach((v, i) => (v.visible = was[i])); if (isSky) R.phones.forEach(p => scene.remove(p.root)); else { K.show("a"); for (const p of Object.values(pl)) p.rocks.clear(); } renderer.setRenderTarget(null); }
  await warmPass(false); await warmPass(true); skyG.visible = sky.mesh.visible = true; spaceG.visible = false; post.warm();
  let t = 0, last = performance.now(), raf = 0, ended = false;
  function update(dt) { t += dt; if (import.meta.env.DEV) window.__sunT = t;
    world(t, dt); squish(t, dt); runActs(t, dt); finale(t, dt); planets(t, dt); spaceBall(t, dt); elon(t, dt); sunFx(t, dt); fx(t, dt); camera(t, dt);
    plume.step(dt); sounds(t); pierceSounds(t);
    const pf = t < T.brk ? sqG.position : t < T.sn0 ? (Object.keys(BEAT).map(n => pl[n]).find(p => t >= BEAT[p.name][0] && t < BEAT[p.name][3]) || { P: bpos }).P : V(SUNR, 0, 0);
    plume.focus(pf, t < T.brk ? 3 : 40); plume.light(cam, t < T.brk ? SKY_SUN : tmp.copy(pf).negate().normalize(), t < T.brk ? { sun: V(2.4, 2.3, 2.1), amb: V(0.5, 0.6, 0.8), gnd: V(0.45, 0.48, 0.55), exp: 1.1 } : { sun: V(2.6, 2.4, 2.2), amb: V(0.06, 0.07, 0.1), gnd: V(0.02, 0.02, 0.03), exp: 1.1 }); }
  function frame(now) { const raw = clamp((now - last) / 1000, 0, 0.05); last = now; let dt = raw; if (hitStop > 0) { hitStop -= raw; dt *= 0.06; } if (t > T.fs - 0.3 && t < T.fs + 0.05) dt *= 0.35;
    if (import.meta.env.DEV && window.__sunTo != null) { const to = window.__sunTo; if (t < to) { let n = 0; while (t < to - 1e-4 && n++ < 6000) { hitStop = 0; update(Math.min(1 / 60, to - t)); } } dt = 0; update(0); } else update(dt);
    if (!(import.meta.env.DEV && window.__sunTo != null)) { post.adapt(raw); plume.adapt(raw); }
    if (X.mine("sun")) post.render(scene, cam, P, t, plume);
    if (t >= T.end) { finish(); return; } raf = requestAnimationFrame(frame); }
  function finish() { cancelAnimationFrame(raf); if (ended) return; ended = true; X.drop("sun"); document.documentElement.classList.remove("sun-on"); snd.end();
    for (const Kp of people) { scene.remove(Kp.root); Kp.root.visible = true; } scene.remove(K.root); spaceG.remove(K.root); K.root.visible = true; K.show("a"); K.tint(new THREE.Color(1, 1, 1), 0); spaceG.remove(handG);
    plume.dispose(); post.dispose(); noise.dispose(); envSky.dispose(); envSp.dispose(); pageT.dispose(); sGeo.dispose(); sMat.dispose(); ball.geometry.dispose(); ballM.dispose(); sky.dispose(); gleam.material.map.dispose(); gleam.material.dispose(); trail.dispose(); dust.dispose(); sparks.dispose(); ringDeb.dispose(); warp.dispose(); strl.dispose(); tdots.dispose(); boil.dispose(); sunB.dispose();
    for (const c of clouds) c.c.dispose(); for (const s2 of impStars) { s2.sp.material.dispose(); scene.remove(s2.sp); } for (const st of R.sticks) st.root.scale.set(1, 1, 1); for (const f of hitFx) { f.g.geometry.dispose(); f.g.material.dispose(); f.r.geometry.dispose(); f.r.material.dispose(); } ballGlow.geometry.dispose(); ballGlow.material.dispose(); sglow.geometry.dispose(); sglow.material.dispose(); sball.geometry.dispose(); sball.material.dispose(); arm.geometry.dispose(); plas.mat.dispose();
    for (const n in pl) { const p = pl[n]; p.body.dispose(); if (p.crack) p.crack.dispose(); if (p.sh) p.sh.dispose(); p.ring.dispose(); p.shell.dispose(); p.flash.geometry.dispose(); p.flash.material.dispose(); p.rocks.dispose(); }
    disposeBodies(); disposeCracks();
    setTimeout(() => { fade.style.transition = "opacity .6s"; fade.style.opacity = "0"; setTimeout(() => fade.remove(), 700); }, 60); o.onDone && o.onDone(); }
  fade.style.opacity = "0";
  update(0); post.render(scene, cam, P, 0, plume); await new Promise(r => requestAnimationFrame(r));
  X.use("sun", 3); document.documentElement.classList.add("sun-on"); last = performance.now();
  raf = requestAnimationFrame(frame);
  if (import.meta.env.DEV) { window.__sunT = 0; }
}

function starTex() { return canvasTex(256, 256, (x, w) => { x.translate(w / 2, w / 2); const g = x.createRadialGradient(0, 0, 0, 0, 0, 40); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(-40, -40, 80, 80); x.fillStyle = "#fff"; for (let i = 0; i < 4; i++) { x.rotate(Math.PI / 2 * (i ? 1 : 0)); x.beginPath(); x.moveTo(-5, 0); x.lineTo(0, -126); x.lineTo(5, 0); x.lineTo(0, 126); x.closePath(); x.fill(); } x.rotate(Math.PI / 4); x.globalAlpha = 0.5; for (let i = 0; i < 2; i++) { x.rotate(Math.PI / 2 * i); x.beginPath(); x.moveTo(-3, 0); x.lineTo(0, -66); x.lineTo(3, 0); x.lineTo(0, 66); x.closePath(); x.fill(); } }); }

// ── 소리 (전부 직접 합성) ──
function makeSound(get) {
  const A = () => get && get(); let hs = null;
  const noise = (a, t, type, f0, f1, q, gain, att, dur, to) => { const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain(); s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(to || a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); };
  const tone = (a, t, type, f0, f1, gain, att, dur, to, lp) => { const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); if (lp) { const f = a.c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g); g.connect(to || a.out); o.start(t); o.stop(t + dur + 0.05); };
  return {
    whoosh(d, g = 0.6) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 260, 2400, 1, g, d * 0.65, d); noise(a, t, "lowpass", 200, 900, 0.7, g * 0.5, d * 0.65, d + 0.02); },
    // 탁: 싸대기(살 · 날카로움) · 폰(유리 깨짐) · 닭다리(묵직하고 질척) + 종이 구겨짐
    hit(type, k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime;
      if (type === "will") { noise(a, t, "highpass", 2400, 1400, 0.7, 0.85 * k, 0.001, 0.09); noise(a, t, "bandpass", 1100, 600, 1.2, 0.6 * k, 0.001, 0.07); tone(a, t, "sine", 240, 90, 0.5 * k, 0.002, 0.12); }
      else if (type === "jobs") { noise(a, t, "highpass", 5200, 3000, 0.8, 0.5 * k, 0.001, 0.2); for (let i = 0; i < 9; i++) tone(a, t + Math.random() * 0.08, "sine", rnd(2600, 6400), rnd(2000, 5000), 0.06 * k, 0.001, rnd(0.05, 0.16)); tone(a, t, "square", 900, 420, 0.12 * k, 0.001, 0.05, null, 2600); tone(a, t, "sine", 180, 70, 0.45 * k, 0.002, 0.14); }
      else { tone(a, t, "sine", 130, 50, 0.85 * k, 0.002, 0.2); noise(a, t, "lowpass", 900, 150, 0.8, 0.6 * k, 0.002, 0.18); noise(a, t + 0.01, "bandpass", 700, 300, 1.4, 0.3 * k, 0.003, 0.12); }
      for (let i = 0; i < 10; i++) noise(a, t + Math.random() * 0.12, "bandpass", rnd(1500, 5000), 900, 2, rnd(0.08, 0.2) * k, 0.001, rnd(0.03, 0.07)); },
    grind(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 500, 3200, 4, 0.22, d * 0.6, d); tone(a, t, "sawtooth", 70, 260, 0.06, d * 0.6, d, null, 1400); },
    ting() { const a = A(); if (!a) return; const t = a.c.currentTime; for (const [f, g] of [[2093, 0.3], [3136, 0.2], [5274, 0.11], [7040, 0.05]]) tone(a, t, "sine", f, f * 0.998, g, 0.002, 1.3); },
    finalSlap() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "highpass", 2600, 1200, 0.7, 1, 0.001, 0.14); noise(a, t, "bandpass", 1200, 500, 1, 0.8, 0.001, 0.12); tone(a, t, "sine", 160, 30, 1, 0.002, 0.6); noise(a, t + 0.02, "lowpass", 3000, 80, 0.7, 0.9, 0.003, 0.9); tone(a, t, "triangle", 1760, 1700, 0.18, 0.002, 0.5); },
    rocket(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 300, 2200, 0.8, 0.7, d * 0.4, d); tone(a, t, "sawtooth", 50, 140, 0.18, d * 0.5, d, null, 400); noise(a, t, "bandpass", 1200, 4000, 1.2, 0.25, d * 0.7, d); },
    sonic() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 120, 24, 1, 0.002, 1); noise(a, t, "lowpass", 3400, 80, 0.7, 1, 0.002, 1.3); noise(a, t + 0.07, "lowpass", 2600, 90, 0.7, 0.7, 0.002, 1); },
    pierce() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 300, 60, 0.6, 0.002, 0.3); noise(a, t, "bandpass", 1800, 400, 1, 0.55, 0.002, 0.3); noise(a, t + 0.04, "lowpass", 1400, 120, 0.8, 0.5, 0.003, 0.5); },
    rumble(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 60, 420, 0.9, 0.8, d * 0.85, d); tone(a, t, "sawtooth", 28, 60, 0.35, d * 0.6, d, null, 220); for (let i = 0; i < 18; i++) { const q = Math.pow(Math.random(), 0.6) * d; noise(a, t + q, "bandpass", rnd(320, 1600), 200, 1.4, 0.12 * (q / d) + 0.03, 0.002, 0.08); } },
    planetBoom(k = 1) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 80, 20, 0.95 * Math.min(1, k), 0.002, 2.2 * k); noise(a, t, "lowpass", 4800, 50, 0.7, 0.95, 0.002, 2.8 * k); noise(a, t + 0.03, "bandpass", 1400, 120, 0.8, 0.8, 0.003, 1.8 * k); tone(a, t, "sawtooth", 60, 18, 0.4, 0.002, 1.8, null, 400); for (let i = 0; i < 40; i++) { const q = Math.pow(Math.random(), 1.7) * 2 * k; noise(a, t + q, "bandpass", rnd(200, 1700), 120, 1.2, rnd(0.08, 0.26) * (1 - q / 3), 0.002, rnd(0.04, 0.14)); } },
    gravity(d) { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 220, 60, 0.25, d * 0.4, d); tone(a, t + d * 0.5, "sine", 60, 320, 0.2, d * 0.4, d * 0.5); noise(a, t, "bandpass", 600, 200, 2, 0.15, d * 0.5, d); },
    plop() { const a = A(); if (!a) return; const t = a.c.currentTime; tone(a, t, "sine", 520, 130, 0.6, 0.002, 0.25); tone(a, t + 0.05, "sine", 900, 300, 0.25, 0.002, 0.18); noise(a, t, "lowpass", 2000, 200, 0.8, 0.5, 0.003, 0.6); },
    boil(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 120, 500, 0.9, 0.6, d * 0.6, d); for (let i = 0; i < 70; i++) { const q = Math.pow(Math.random(), 0.7) * d, f = rnd(160, 520); tone(a, t + q, "sine", f, f * rnd(1.4, 2.2), rnd(0.08, 0.22) * (0.4 + q / d), 0.004, rnd(0.05, 0.12)); } },
    rise() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 200, 1800, 0.8, 0.8, 0.8, 1.4); tone(a, t, "sawtooth", 55, 110, 0.25, 0.8, 1.4, null, 600); },
    fanfare() { const a = A(); if (!a) return; const t = a.c.currentTime; [[523.3, 0], [659.3, 0.12], [784, 0.24], [1046.5, 0.38]].forEach(([f, d]) => { tone(a, t + d, "square", f, f, 0.11, 0.006, d === 0.38 ? 1.1 : 0.22, null, 3200); tone(a, t + d, "sawtooth", f * 1.003, f * 1.003, 0.06, 0.006, d === 0.38 ? 1.1 : 0.22, null, 2400); tone(a, t + d, "sine", f * 2, f * 2, 0.06, 0.006, 0.3); }); tone(a, t + 0.38, "sine", 130.8, 130.8, 0.4, 0.01, 1.2); },
    end() { try { if (hs) hs.stop(); } catch (e) {} },
  };
}
