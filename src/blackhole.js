// 블랙홀 (3D)
// ① 달력에서 카메라가 물러나며 하늘로 솟구침 → 노을 구름 위 → 하늘이 검어지고 별 → 돌아보면 지구 → 우주 깊숙이 날아가 성운 속으로 파고듦 (순간이동 없이 쭉 이동)
// ② 탄생 (별의 일생): 분자 구름 → 중력 수축 → 원시별(원반 + 양극 제트) → 중심 속 수소 핵융합 → 점화: 푸른 주계열성 → 붉은 초거성 →
//    단면: 겹겹이 타는 껍질(수소·헬륨·탄소·산소·규소·철) → 철 핵 붕괴 → 되튐 충격파 → 초신성 → 남은 핵이 잔해를 삼키며 더 무너짐(시공간 우물) →
//    사건의 지평선 → 잔해가 강착원반 · 제트 (화면 아래에 단계 이름이 잠깐씩 뜸)
// ③ 같은 성운에서 태어난 둘레의 별들이 블랙홀을 케플러 궤도로 돌다가 차례로 떨어져 조석력에 찢김 → 가스 줄기가 블랙홀을 휘감고 원반에 섞임
// ④ 순간이동으로 지구의 달력 → 부들부들 → 칸이 하나 둘 뜯겨 날아가고 바탕도 깨져 우주가 드러남 → 블랙홀 쪽에서 별·행성이 날아와 조각을 퍽퍽 쪼갬 → 점점 더 많고 빠르게 → 가루
// ⑤ 가루와 천체가 전부 원반으로 빨려 들어가고, 약 3초에 걸쳐 둘레의 빛·별·행성·다른 항성까지 차례로 휘감겨 들며 하늘마저 오그라들어 사라짐 → 블랙홀이 증발하며 아주 밝은 빛 구슬 하나만 남은 암흑 (누를 때까지 기다림)
// ⑥ 누르면 펑: 충격파와 함께 별·성운·은하가 우수수 쏟아져 나오고 → 토성 · 태양 · 목성 · 해왕성 · 천왕성 · 지구와 달 · 금성 · 수성이 차례로 점점 느리게 →
//    마지막에 화성이 천천히, 그 위에 일론 머스크가 엄지척 (앞모습만 보이게 카메라를 마주 봄)
import * as THREE from "three";
import { fx3d } from "./fx3d.js";
import { loadHand, preloadHand } from "./hand.js";
import { buildElon } from "./elon.js";
import { makeNoise3D, preloadVol } from "./plume.js";
import { buildSky, buildEarth, buildMoon, buildMars, marsShards } from "./planets.js";
import { buildPost } from "./bh-post.js";
import { makeBody, bakeBodies, disposeBodies, addBlend } from "./bh-bodies.js";
import { buildShards, buildPowder } from "./bh-shards.js";
import { glowPoints, streaks, billboard, glowFS, ringFS, buildAtoms, buildCloud, buildBigStar, buildShell, buildGrid, buildJets, buildNebula, buildDaySky, cloudSprite, galaxyTex, galaxy, orbFS, gauss } from "./bh-fx.js";
import { clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V, buzz, vnoise } from "./fx-util.js";

const T0 = {
  sky0: 0.5, sky1: 1.8, ea0: 1.95, wp0: 2.85, sw: 3.3,
  co0: 4.15, co1: 4.9, pj: 4.8, dv0: 5.35, at0: 5.5, f1: 5.75, f2: 5.98, f3: 6.22, ig: 6.5, ev0: 6.98, ev1: 7.5, cut0: 7.55, cut1: 7.8, lay1: 8.2, fe0: 8.15, col0: 8.32, bnc: 8.38, sn: 8.57,
  gr0: 8.9, hz0: 9.65, hz1: 10.15, gp0: 10.05, dk0: 10.15, jet: 10.9, done: 11.65,
  tp: 15.2, L0: 16.3, brk: 18.1, spc: 18.7, barE: 25.4, pulv: 25.2, rev: 25.7, sk0: 26.7, skyS: 27.9, skyE: 30.85, dkOff: 30.5, ev: 30.75, dark: 31.45,
};
const B0 = { pl: [0.5, 1.02, 1.52, 2.0, 2.44, 2.86, 3.26, 3.64], mars: 4.05, fade: 6.9, end: 7.6 };
const RsF = 0.55, RsC = 2.4;
const CAPS = [[3.5, 4.1, "분자 구름"], [4.45, 5.3, "중력 수축 · 원시별"], [5.55, 6.42, "수소 핵융합"], [6.62, 7.08, "주계열성"], [7.28, 7.66, "적색 초거성"], [7.75, 8.22, "수소 · 헬륨 · 탄소 · 산소 · 규소 · 철"], [8.3, 8.6, "철 핵 붕괴"], [8.72, 9.45, "초신성"], [10.05, 11.2, "블랙홀"]];
const FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

// 일론: 화성 연출과 같은 사람 (손 모델 두 개)
let rigP = null;
const getRig = () => rigP || (rigP = (async () => { const [HR, HL] = await Promise.all([loadHand(new THREE.MeshStandardMaterial()), loadHand(new THREE.MeshStandardMaterial())]); const K = await buildElon({ hands: [HR, HL] }); marsShards(); return { K }; })().catch(e => { rigP = null; throw e; }));
let warmed = false, building = 0;
export function prewarmBhole() { preloadHand(); preloadVol(); getRig().then(({ K }) => { const X = fx3d(), r = X.renderer; K.root.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { for (const k of ["map", "alphaMap", "emissiveMap", "bumpMap"]) if (m[k]) r.initTexture(m[k]); }); }); if (!warmed && !building) { warmed = true; return startBhole({ warm: true, pieces: [], sfx: () => null }); } }).catch(() => {}); }
// 은하 그림은 한 번만 그려 둠
let GALT = null; const galTex = () => GALT || (GALT = [1, 2, 3, 4, 5].map(i => galaxyTex(i)));

// planets.js 셰이더는 자체 톤을 입혀 내보내므로 HDR로 바꿔 씀 (이 연출은 마지막에 한 번만 톤을 입힘)
function hdr(mat, from, to) { if (!mat.fragmentShader.includes(from)) return; mat.fragmentShader = mat.fragmentShader.replace(from, to); mat.needsUpdate = true; }
function earthHDR(e) { hdr(e.mesh.material, "c = 1.0 - exp(-c * 1.5);", "c *= 1.2;"); hdr(e.mesh.material, "float cn = fbm(q) * 0.72 + texture(uN, q * 3.3 + 0.2).r * 0.28, cl = smoothstep(0.72, 0.84, cn), cs = smoothstep(0.7, 0.82, fbm(q + uSun * 0.012));", "q *= 1.9; vec3 qw = q + (vec3(fbm(q * 1.3 + 3.0), fbm(q * 1.3 + 7.0), fbm(q * 1.3 + 11.0)) - 0.68) * 0.7; float cn = fbm(qw) * 0.66 + texture(uN, qw * 4.1 + 0.2).r * 0.22 + texture(uN, qw * 9.0).g * 0.12, cl = smoothstep(0.68, 0.9, cn) * 0.92, cs = smoothstep(0.68, 0.9, fbm(qw + uSun * 0.02));"); addBlend(e.air.material);
  e.U.uVisE = { value: 1 }; hdr(e.mesh.material, "uniform float uT;", "uniform float uT, uVisE;"); hdr(e.mesh.material, "c *= 1.2; gl_FragColor = vec4(c, 1.0);", "c *= 1.2 * uVisE; gl_FragColor = vec4(c, uVisE);");
  const m = e.mesh.material; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }

export async function startBhole(o) {
  building++; try { return await runBhole(o); } finally { building--; }
}
async function runBhole(o) {
  const T = { ...T0 }, BT = { ...B0 };
  const X = fx3d(), { renderer, PR, vw, vh, D } = X, vmin = Math.min(vw, vh), M = 0.75 * vmin, SW = vw / M, SH = vh / M, Dm = D / M, aspect = vw / vh, port = aspect < 1;
  const [{ K }, noise] = await Promise.all([getRig(), makeNoise3D()]), snd = makeSound(o.sfx);
  const post = buildPost(X, noise);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(X.FOV, aspect, 0.05, 30000); cam.position.set(0, 0, Dm); scene.add(cam);
  const fit = (w, h) => { const t = Math.tan(cam.fov * Math.PI / 360); return Math.max(h / 2 / t, w / 2 / (t * aspect)); };
  const PS = vh * PR / (2 * Math.tan(X.FOV * Math.PI / 360));   // 거리 1에서 1단위 = 화소
  bakeBodies(renderer, noise);   // ── 빛 ──
  const hemi = new THREE.HemisphereLight(0x8fa0d8, 0x2a1d18, 0.5), key = new THREE.DirectionalLight(0xfff1e2, 2.4), rim = new THREE.DirectionalLight(0x9ab8ff, 0); key.position.set(-4, 5, 7.5); scene.add(hemi, key, key.target, rim, rim.target);
  const envT = (() => { const s = new THREE.Scene(), m = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: "varying vec3 vD; void main(){ vec3 d = normalize(vD), s = normalize(vec3(-0.4, 0.5, 0.75)); vec3 c = vec3(0.012, 0.014, 0.024) + vec3(0.12, 0.1, 0.09) * pow(max(dot(d, s), 0.0), 3.0) + vec3(9.0, 8.0, 7.0) * pow(max(dot(d, s), 0.0), 600.0) + vec3(0.05, 0.06, 0.1) * max(d.y, 0.0); gl_FragColor = vec4(c, 1.0); }" })); s.add(m); const t = X.pmrem.fromScene(s, 0.02); m.geometry.dispose(); m.material.dispose(); return t; })();
  scene.environment = envT.texture; scene.environmentIntensity = 0.7;
  // ── 달력 한 장 (화면 그대로) ──
  const pk = Math.min(2, PR), pc = document.createElement("canvas"); pc.width = Math.round(vw * pk); pc.height = Math.round(vh * pk); const bgCol = getComputedStyle(document.body).backgroundColor || "#f6f7f9";
  { const x = pc.getContext("2d"); x.fillStyle = bgCol; x.fillRect(0, 0, pc.width, pc.height); for (const p of o.pieces) { x.save(); x.translate(p.cx * pk, p.cy * pk); x.rotate(p.th); x.globalAlpha = p.alpha == null ? 1 : p.alpha; x.drawImage(p.tex, -p.W / 2 * pk, -p.H / 2 * pk, p.W * pk, p.H * pk); x.restore(); } }
  const pageT = new THREE.CanvasTexture(pc); pageT.colorSpace = THREE.SRGBColorSpace; pageT.anisotropy = 8;
  const smW = 220, smH = Math.max(8, Math.round(220 * vh / vw)), sm = document.createElement("canvas"); sm.width = smW; sm.height = smH; sm.getContext("2d").drawImage(pc, 0, 0, smW, smH); const smD = sm.getContext("2d").getImageData(0, 0, smW, smH).data;
  const lin = v => Math.pow(v / 255, 2.2), colAt = (x, y) => { const i = (clamp(Math.round((x / SW + 0.5) * (smW - 1)), 0, smW - 1) + clamp(Math.round((0.5 - y / SH) * (smH - 1)), 0, smH - 1) * smW) * 4; return [lin(smD[i]), lin(smD[i + 1]), lin(smD[i + 2])]; };
  // ── 세상 A: 달력 · 하늘 · 지구 ──
  const sky = buildSky(noise); sky.U.uVis = { value: 1 }; hdr(sky.mat, "uniform float uAlt, uT;", "uniform float uAlt, uT, uVis;"); hdr(sky.mat, "c = 1.0 - exp(-c * 1.15); gl_FragColor = vec4(c, 1.0);", "gl_FragColor = vec4(c * 1.1 * uVis, uVis);"); scene.add(sky.mesh);
  const ER = 300, earth = buildEarth(renderer, noise); earthHDR(earth); earth.group.scale.setScalar(ER); earth.group.visible = false; scene.add(earth.group); earth.U.uSun.value.set(0.62, 0.72, 0.1).normalize(); earth.AU.uA.value = 1.25;
  { const lo = 127.5 * Math.PI / 180, la = 36.5 * Math.PI / 180, dK = V(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)), tg = V(0, Math.cos(0.42), -Math.sin(0.42)), q1 = new THREE.Quaternion().setFromUnitVectors(dK, tg), pj = v => v.clone().addScaledVector(tg, -v.dot(tg)).normalize(), a = pj(V(0, 1, 0).applyQuaternion(q1)), b = pj(V(0, 0, -1)); let an = Math.acos(clamp(a.dot(b), -1, 1)); if (a.clone().cross(b).dot(tg) < 0) an = -an; earth.group.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(tg, an).multiply(q1)); }
  const shards = buildShards(noise, pageT, SW, SH); scene.add(shards.mesh); shards.mesh.visible = false;
  const page = shards.add([[-SW / 2, -SH / 2], [SW / 2, -SH / 2], [SW / 2, SH / 2], [-SW / 2, SH / 2]], 0.005, 0, V(0, 0, 0), null, 0); shards.holes([]); shards.upload();
  const powder = buildPowder(26000, PS); scene.add(powder.pts); powder.pts.visible = false;
  // ── 세상 B: 성운 · 원자 · 별 · 초신성 · 격자 · 블랙홀 ──
  const worldB = new THREE.Group(); scene.add(worldB); worldB.visible = false;
  const neb = buildNebula(noise); worldB.add(neb.mesh);
  const atoms = buildAtoms(noise, PS); worldB.add(atoms.group); for (const L of atoms.lights) scene.add(L);
  const cloud = buildCloud((x, y, z) => vnoise(x + z * 0.7, y - z * 0.4), 2200, PS); worldB.add(cloud.pts);
  const star = buildBigStar(noise); worldB.add(star.group); star.group.visible = false;
  const shell = buildShell(noise); worldB.add(shell.mesh); shell.mesh.visible = false;
  const debris = glowPoints(12000, PS, 1.4); worldB.add(debris.pts); debris.pts.visible = false;
  const grid = buildGrid(56, 30); worldB.add(grid.lines); grid.lines.visible = false;
  const jets = buildJets(noise); jets.group.scale.set(1.2, 34, 1.2); worldB.add(jets.group); jets.group.visible = false;
  const remU = { uC: { value: new THREE.Color(0.75, 0.85, 1.4) }, uA: { value: 0 }, uCore: { value: 5 } }, rem = billboard(glowFS, remU, 2); worldB.add(rem); rem.visible = false;
  const snU = { uC: { value: new THREE.Color(1.0, 0.92, 0.85) }, uA: { value: 0 }, uCore: { value: 6 } }, snG = billboard(glowFS, snU, 2); worldB.add(snG); snG.visible = false;
  const GMb = 1400, RDis = 6.5, HS = 1 / 240;   // 블랙홀 중력 세기 · 조석 파괴가 시작되는 거리 · 궤도 표 간격
  const sibs = []; [[1.25, 10.2, 0.45], [0.62, 12.4, 0.55], [0.95, 9.6, 0.42], [0.45, 13.0, 0.6], [1.1, 11.2, 0.45], [0.78, 12.8, 0.55], [0.9, 10.6, 0.48]].forEach(([tc, r0, R], i) => { const b = makeBody(renderer, noise, "star", { temp: tc, lum: 1.5, spot: 0.3, depthHalo: true }); b.group.visible = false; worldB.add(b.group); sibs.push({ b, temp: tc, r0, R, lum: 1.5, i, gone: false, sp: 0, np: 1300 }); });
  const NT = 9100, tde = glowPoints(NT, PS, 1.2), tdeL = streaks(NT); worldB.add(tde.pts, tdeL.lines); tde.pts.visible = tdeL.lines.visible = false;
  const tdV = new Float32Array(NT * 3), tdA = new Float32Array(NT).fill(-1), tdK = new Float32Array(NT), tdC = new Float32Array(NT); let tdN = 0;
  const protoU = { uC: { value: new THREE.Color(1.5, 0.45, 0.18) }, uA: { value: 0 }, uCore: { value: 2.4 } }, protoG = billboard(glowFS, protoU, 2); worldB.add(protoG); protoG.visible = false;
  const protoJ = buildJets(noise); protoJ.U.uTint.value.setRGB(2.0, 0.55, 0.62); protoJ.group.scale.set(0.62, 4.4, 0.62); worldB.add(protoJ.group); protoJ.group.visible = false;
  const NFE = 90, fel = streaks(NFE), feP = [], feV = []; for (let i = 0; i < NFE; i++) { feP.push(V()); feV.push(V()); } worldB.add(fel.lines); fel.lines.visible = false;
  // ── 세상 A 우주: 날아오는 천체 · 마지막 빨려듦 · 빅뱅 ──
  const CK = ["star", "star", "star", "star", "star", "star", "star", "star", "moon", "rust", "star", "jupiter", "europa", "rock", "io", "star", "neptune", "rock", "mercury", "rock", "uranus", "moon", "star", "rock", "io", "rust", "rock", "europa", "star", "rock", "rock", "moon", "rock", "star", "rock", "mercury", "rock", "io"];
  const pool = CK.map(k => { const b = makeBody(renderer, noise, k, k === "star" ? { temp: rnd(0.45, 1.3), lum: 1.6, spot: 0.5 } : { tint: new THREE.Color().setHSL(rnd(0, 1), 0.12, rnd(0.88, 1.05)) }); b.group.visible = false; scene.add(b.group); if (b.ring) b.group.quaternion.setFromEuler(new THREE.Euler(0.3, 0, 1.3)); return { b, kind: k, on: false, used: false, p: V(), v: V(), R: 1, ax: V(0, 1, 0), w: 0 }; });
  const flyers = [];
  const bangP = ["saturn", "star", "jupiter", "neptune", "uranus", "earth", "venus", "mercury"].map(k => { if (k === "earth") { const e = earth; const m = buildMoon(noise); hdr(m.mesh.material, "c = 1.0 - exp(-c * 1.4);", "c *= 1.2;"); const g = new THREE.Group(); m.mesh.scale.setScalar(0.27); m.mesh.position.set(2.4, 0.6, -1.4); g.add(m.mesh); g.visible = false; scene.add(g); return { kind: k, group: g, e, m }; }
    const b = makeBody(renderer, noise, k, k === "star" ? { temp: 0.6, lum: 1.8, spot: 1 } : {}); b.group.visible = false; scene.add(b.group); return { kind: k, group: b.group, b }; });
  const mars = buildMars(renderer, noise); hdr(mars.mesh.material, "c *= uFade; c = 1.0 - exp(-c * 1.35);", "c *= uFade * 1.15;"); addBlend(mars.air.material); mars.group.visible = false; scene.add(mars.group); const RM = 9;
  scene.add(K.root); K.root.visible = false; K.root.traverse(q => { if (q.isMesh) { q.castShadow = false; q.frustumCulled = false; } }); K.begin(); K.show("b"); K.tint(new THREE.Color(1, 1, 1), 0);
  const NBS = 14000, burst = streaks(5000), bstars = glowPoints(NBS, PS, 1.3); scene.add(burst.lines, bstars.pts); burst.lines.visible = bstars.pts.visible = false;
  const bdir = new Float32Array(NBS * 3), bsp = new Float32Array(NBS), bcol = new Float32Array(NBS * 3); for (let i = 0; i < NBS; i++) { const v = V(gauss(), gauss(), gauss()).normalize(); bdir.set([v.x, v.y, v.z], i * 3); bsp[i] = Math.exp(gauss() * 0.7) * 70; const k = Math.random(), c = new THREE.Color().setHSL(k < 0.6 ? 0.6 : k < 0.85 ? 0.12 : 0.03, 0.55, 0.72); bcol.set([c.r, c.g, c.b], i * 3); }
  const gals = []; for (let i = 0; i < 5; i++) { const g = galaxy(galTex()[i]); g.mesh.visible = false; scene.add(g.mesh); gals.push({ g, d: V(gauss(), gauss() * 0.6, gauss() * 0.4 + 0.6).normalize(), s: rnd(10, 20), sp: rnd(60, 110), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-1.2, 1.2), rnd(-1.2, 1.2), rnd(0, 6))), t0: rnd(0.25, 1.6) }); }
  const orbU = { uN: { value: noise }, uA: { value: 0 }, uT: { value: 0 }, uP: { value: 0 } }, orb = billboard(orbFS, orbU, 2); orb.visible = false; scene.add(orb);
  const puffs = []; for (let i = 0; i < 10; i++) { const U = { uC: { value: new THREE.Color(1, 0.96, 0.9) }, uA: { value: 0 }, uCore: { value: 2 } }, b = billboard(glowFS, U, 2); b.visible = false; scene.add(b); puffs.push({ b, U, t: 9 }); }
  const rings = []; for (let i = 0; i < 6; i++) { const U = { uN: { value: noise }, uC: { value: new THREE.Color(1.0, 0.95, 0.88) }, uA: { value: 0 }, uR: { value: 0 }, uW: { value: 0.035 } }, b = billboard(ringFS, U, 2); b.visible = false; scene.add(b); rings.push({ b, U, t: 9, k: 1 }); }
  const warp = streaks(320), wst = []; for (let i = 0; i < 320; i++) wst.push(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))); scene.add(warp.lines); warp.lines.visible = false;
  // 화면 덮개 · 안내

  // 둘레 별의 길: 처음엔 거의 동그란 궤도 → 정해진 때 각운동량을 잃고 블랙홀 쪽으로 떨어짐 → 조석 파괴 거리 안에 들면 찢김 (찢기는 시각이 차례로 오게 맞춤)
  { const vc = r => Math.sqrt(GMb * r) / (r - RsF), q = V();
    const sim = (p0, v0, tPl, jf) => { const N = Math.ceil((T.tp + 0.2 - T.sn) / HS) + 2, tab = new Float32Array(N * 6), p = p0.clone(), v = v0.clone(), kd = -Math.log(jf) / 0.3; let tDis = Infinity;
      for (let i = 0; i < N; i++) { const tt = T.sn + i * HS, r = p.length(); tab[i * 6] = p.x; tab[i * 6 + 1] = p.y; tab[i * 6 + 2] = p.z; tab[i * 6 + 3] = v.x; tab[i * 6 + 4] = v.y; tab[i * 6 + 5] = v.z; if (tDis === Infinity && tt > tPl && r < RDis) tDis = tt;
        if (tt >= tPl && tt < tPl + 0.3) { q.copy(v).addScaledVector(p, -v.dot(p) / (r * r)); v.addScaledVector(q, -Math.min(1, kd * HS)); }
        const a = -GMb / Math.pow(Math.max(r - RsF, 0.25), 2) / r; v.addScaledVector(p, a * HS); p.addScaledVector(v, HS); }
      return { tab, N, tDis }; };
    let sd = 20231; const sr = (a, b) => { sd = (sd * 16807) % 2147483647; return a + (b - a) * (sd / 2147483647); };   // 매번 같은 구도
    for (const s of sibs) { const th = 0.35 + 0.85 * sr(0, 1), ax = sr(0, 6.283), n = V(0, -1, 0).applyAxisAngle(V(Math.cos(ax), 0, Math.sin(ax)), th), e1 = V(1, 0, 0).cross(n).normalize(), e2 = n.clone().cross(e1), ph = sr(0, 6.283);
      const p0 = e1.clone().multiplyScalar(Math.cos(ph) * s.r0).addScaledVector(e2, Math.sin(ph) * s.r0), v0 = e1.clone().multiplyScalar(-Math.sin(ph)).addScaledVector(e2, Math.cos(ph)).multiplyScalar(vc(s.r0));
      const rp = sr(3.6, 4.6), jf = Math.sqrt(2 * rp / (s.r0 + rp)); let D = sim(V(s.r0, 0, 0), V(0, 0, -vc(s.r0)), T.sn, jf).tDis - T.sn; if (!isFinite(D)) D = 1.5;
      Object.assign(s, sim(p0, v0, T.done + 0.5 + s.i * 0.42 + sr(-0.05, 0.05) - D, jf)); } }

  // ────────── 상태 ──────────
  let t = 0, B = Infinity, shake = 0, flare = 0, hitStop = 0, hitShake = 0, hitCool = 0; const P = {}, cP = V(0, 0, Dm), cL = V(0, 0, 0), cUp = V(0, 1, 0);
  const look = (p, l, roll = 0) => { cP.copy(p); cL.copy(l); cUp.set(Math.sin(roll), Math.cos(roll), 0); };
  const camNow = () => { cam.position.copy(cP); cam.up.copy(cUp); cam.lookAt(cL); cam.updateMatrixWorld(true); };
  const sph = (c, d, az, el) => V(c.x + d * Math.cos(el) * Math.sin(az), c.y + d * Math.sin(el), c.z + d * Math.cos(el) * Math.cos(az));
  const once = new Set(), at = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } };
  const tv = V(), tv2 = V(), tmpQ = new THREE.Quaternion();

  // ① 출발: 물러나며 위로 → 지평선의 노을과 구름바다를 보며 솟구침 → 하늘이 검어지면 위를 봄 → 돌아서 지구를 내려다봄 → 우주로
  let ascY = 0, ascZ = Dm; const eC = V();
  function ascent(dt) {
    sky.mesh.visible = t < T.ea0 + 0.05; if (earth.group.parent === scene) earth.group.visible = (t >= T.ea0 - 0.02 && t < T.sw) || (t >= T.brk - 0.15 && t < T.sk0 + 1); if (t < T.sw) { earth.U.uVisE.value = 1; earth.AU.uA.value = 1.25; } warp.lines.visible = t > T.wp0 && t < T.co0;
    shards.mesh.visible = t < 1.4 || (t >= T.tp && t < T.sk0 + 2); if (t >= T.sw) return;
    const pitch = t < T.ea0 ? 0.13 * eInOut(seg(t, 0.2, 0.85)) + 0.79 * eInOut(seg(t, 1.38, T.ea0)) : t < T.wp0 ? lerp(0.92, -1.08, eInOut(seg(t, T.ea0, T.ea0 + 0.82))) : lerp(-1.08, 0.02, eInOut(seg(t, T.wp0, T.sw)));
    if (t < T.ea0) { ascZ = Dm + 4.2 * eIn(seg(t, 0, 0.62)); ascY = 0.6 * eIn(seg(t, 0.08, 0.6)) + 230 * Math.pow(seg(t, 0.28, 1.95), 2.6); sky.U.uAlt.value = sstep(seg(t, T.sky0, T.sky1)); sky.U.uVis.value = 1 - sstep(seg(t, 1.6, 1.93)); sky.U.uFly.value.z -= dt * (0.02 + 0.6 * seg(t, 0.3, 1.9)); sky.U.uSun.value.set(0.72, 0.13, -0.68).normalize();
      const yaw = 0.62 * eInOut(seg(t, 0.25, 1.1)) * (1 - eInOut(seg(t, 1.4, T.ea0))), p = V(0, ascY, ascZ); look(p, p.clone().add(V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)))); eC.set(0, ascY - ER * 1.5, ascZ - ER * 0.62); }
    else { const u = seg(t, T.ea0, T.sw), alt = ER * (0.5 + 1.1 * (Math.exp(2.0 * u) - 1) / (Math.exp(2.0) - 1)); earth.group.position.copy(eC); const p = V(0, eC.y + ER + alt, ascZ - 1100 * Math.pow(seg(t, T.wp0, T.sw), 2.2)); look(p, p.clone().add(V(0, Math.sin(pitch), -Math.cos(pitch)))); earth.U.uT.value = t * 30; }
    if (t > T.wp0) { const k = seg(t, T.wp0, T.wp0 + 0.4) * (1 - seg(t, 3.85, T.co0)), sp = 40 + 260 * seg(t, T.wp0, T.sw) - 150 * seg(t, T.sw, T.co0); for (let i = 0; i < 320; i++) { const s = wst[i]; s.z += sp * dt / 30; if (s.z > 1) s.set(rnd(-1, 1), rnd(-1, 1), -1); const x = s.x * 30, y = s.y * 30, z = s.z * 30, L = sp * 0.035, q = Math.hypot(x, y) > 1.2 ? 1 : 0; warp.set(i, cP.x + x, cP.y + y, cP.z + z, cP.x + x, cP.y + y, cP.z + z - L, 0.5, 0.65, 1.0, k * q); } warp.touch(); }
  }
  // ② 탄생 — 무거운 별의 일생을 그대로 따라감:
  //    분자 구름 속으로 → 물러나면 구름 전체가 중력으로 돌며 납작하게 오그라듦 → 가운데가 달아올라 원시별 (먼지 원반 + 양극 제트) →
  //    그 중심 속으로: 수천만 도 플라스마에서 전자가 떨어져 나간 수소 원자핵끼리 융합 (양성자+양성자→중수소 · 중수소+양성자→헬륨3 · 헬륨3+헬륨3→헬륨4+양성자 둘) →
  //    점화: 푸른 주계열성이 남은 고치를 별빛과 별바람으로 날려 버림 → 중심의 수소가 떨어지면 부풀고 식어 붉은 초거성 →
  //    단면: 겹겹이 타는 껍질 (수소·헬륨·탄소·산소·규소·철) → 더 태울 수 없는 철 핵이 순식간에 무너짐 (중성미자 섬광) →
  //    되튐 충격파가 안에서 바깥으로 별을 뚫고 나옴 → 초신성 → 남은 핵이 떨어지는 잔해를 삼키며 더 무너져 시공간 우물 → 사건의 지평선 → 잔해가 강착원반 · 제트
  // 원자 배치: 긴 화면 쪽으로 펼침 (세로 화면이면 위아래로)
  const L = (u, v, z) => port ? V(v, u, z) : V(u, v, z), atomD = port ? fit(1.9, 3.5) : fit(3.5, 1.9);
  const A = {}; let atomsMade = false;
  function makeAtoms() { atomsMade = true; const a = atoms.atom.bind(atoms);
    A.p1 = a(L(-1.42, 0.32, 0.2), 1, 0); A.p2 = a(L(-0.82, 0.56, -0.25), 1, 0); A.d1 = a(L(1.42, -0.3, 0.25), 1, 1); A.p3 = a(L(0.84, -0.58, -0.2), 1, 0); A.h1 = a(L(-0.36, -0.1, 0.32), 2, 1); A.h2 = a(L(0.38, 0.14, -0.3), 2, 1);
    for (let i = 0; i < 10; i++) { const d = V(gauss(), gauss() * 0.7, -Math.abs(gauss())).normalize().multiplyScalar(rnd(2.2, 5)); d.z -= 1.2; const b = a(d, 1, 0, 0.6); b.v.set(rnd(-0.15, 0.15), rnd(-0.15, 0.15), rnd(-0.15, 0.15)); }
    for (const k of ["p1", "p2", "d1", "p3", "h1", "h2"]) A[k].s0 = A[k].p.clone(); }
  const fuseAt = (a, b, t0, t1) => { const m = a.s0.clone().add(b.s0).multiplyScalar(0.5), u = eIn(seg(t, t0, t1)); a.p.copy(a.s0).lerp(m, u); b.p.copy(b.s0).lerp(m, u); return m; };
  const fitR = (R, k) => fit(2 * R / k, 2 * R / k);   // 반지름 R인 공이 화면 짧은 쪽의 k만큼
  const dv = new Float32Array(12000 * 3), dk = new Uint8Array(12000), dr = new Float32Array(12000);
  let dSN = 20, Rsn = 2;
  function nebSet(R, col, core, hot, a) { neb.mesh.scale.setScalar(R); neb.U.uCol.value = col; neb.U.uCore.value = core; neb.U.uHot.value = hot; neb.U.uA.value = a; }
  function birth(dt) {
    const on = t >= T.sw && t < T.tp; worldB.visible = on; if (!on) return;
    const core = t >= T.dv0 + 0.13 && t < T.ig;   // 별 속
    neb.mesh.visible = t < T.ig + 0.75 && neb.U.uA.value > 0.003; cloud.pts.visible = neb.mesh.visible && !core;
    // ① 분자 구름: 어두운 먼지 사이로 빛나는 가스 속을 파고듦
    if (t < T.co0) { const u = eInOut(seg(t, T.sw, T.co0)), d = Math.exp(lerp(Math.log(7000), Math.log(5.5), u)); nebSet(700, 0, 0, 0, 1); neb.U.uDust.value = 1; look(V(0, 0.15 * u, d), V(0, 0, d - 10)); setCloud(700, 0, 0); }
    // ② 물러나면 구름 전체 → 중력으로 돌며 납작하게 오그라듦 → 가운데가 달아오름(원시별) → 그 중심 속으로
    else if (t < T.ig && !core) { const u = seg(t, T.co0, T.co0 + 0.4), cu = seg(t, T.co0 + 0.32, T.co1), R = Math.exp(lerp(Math.log(700), Math.log(5.5), eInOut(cu)));
      let d = t < T.co0 + 0.4 ? Math.exp(lerp(Math.log(5.5), Math.log(2500), eIn(u) * 0.55 + u * 0.45)) : Math.exp(lerp(Math.log(2500), Math.log(16), eInOut(cu)));
      d *= Math.exp(Math.log(0.04) * eIn(seg(t, T.dv0, T.dv0 + 0.13)));
      nebSet(R, sstep(cu), 0.9 * cu * cu + 0.6 * seg(t, T.co1 - 0.2, T.dv0) + 3 * seg(t, T.dv0, T.dv0 + 0.13), 0, lerp(0.32, 1, seg(t, T.co0, T.co0 + 0.3))); neb.U.uDust.value = 1 - cu; setCloud(R, sstep(cu), cu);
      look(sph(V(), d * 1.06, 0.16 + 0.35 * seg(t, T.co1 - 0.4, T.dv0), lerp(0.33, 0.2, seg(t, T.co1 - 0.4, T.dv0))), V(0, 0, 0)); }
    protoG.visible = t >= T.co1 - 0.4 && t < T.dv0 + 0.13; if (protoG.visible) { const k = seg(t, T.co1 - 0.4, T.co1 + 0.1); const dvu = eIn(seg(t, T.dv0, T.dv0 + 0.13)); protoU.uA.value = k * 0.42 * (1 + 0.1 * Math.sin(t * 21)) * (1 + 4 * dvu); protoG.scale.setScalar((0.55 + 0.6 * k) * (1 + 6 * dvu)); }
    protoJ.group.visible = t >= T.pj && t < T.dv0 + 0.13; if (protoJ.group.visible) { protoJ.U.uL.value = eOut(seg(t, T.pj, T.pj + 0.5)); protoJ.U.uA.value = 2.6 * seg(t, T.pj, T.pj + 0.12); protoJ.U.uT.value = t; }
    // ③ 별 속: 플라스마에서 수소 원자핵끼리 융합
    atoms.group.visible = fel.lines.visible = core;
    if (core) { if (!atomsMade) makeAtoms(); atoms.setBare(true); nebSet(14, 0, 0.3, 1, 0.3); neb.U.uDust.value = 0;
      if (t < T.f1 + 0.02) fuseAt(A.p1, A.p2, T.at0 - 0.15, T.f1); if (t < T.f2 + 0.02) fuseAt(A.d1, A.p3, T.at0 - 0.02, T.f2); if (t < T.f3 + 0.02) fuseAt(A.h1, A.h2, T.at0 + 0.1, T.f3);
      if (t >= T.f1) at("F1", () => { const m = A.p1.p.clone(); A.p1.alive = A.p2.alive = false; const d = atoms.atom(m, 1, 1); d.v.set(0.05, -0.04, 0.05); d.w.multiplyScalar(1.5); atoms.flash(m, 0.8); atoms.shoot(m, L(-0.6, 0.8, 0.3), 6, [2.4, 0.5, 1.3], 0.06, 0.5); atoms.shoot(m, L(-0.9, -0.2, 0.6), 18, [0.5, 0.75, 1.0], 0.04, 0.4); snd.fuse(0.7); buzz(1); });
      if (t >= T.f2) at("F2", () => { const m = A.d1.p.clone(); A.d1.alive = A.p3.alive = false; const h = atoms.atom(m, 2, 1); h.v.set(-0.04, 0.04, 0); atoms.flash(m, 1.0); atoms.shoot(m, L(0.7, 0.5, 0.5), 18, [2.0, 2.0, 3.2], 0.08, 0.45); snd.fuse(0.9); buzz(1); });
      if (t >= T.f3) at("F3", () => { const m = A.h1.p.clone(); A.h1.alive = A.h2.alive = false; atoms.atom(m, 2, 2, 1.2); for (const s of [1, -1]) { const p = atoms.atom(m.clone(), 1, 0); p.v.copy(L(1.2 * s, 0.4 * s, 0.4)); } atoms.flash(m, 1.8, 1.2); atoms.shoot(m, L(0.2, 1, 0.4), 20, [2.4, 2.4, 3.6], 0.1, 0.6); snd.fuse(1.4); buzz(2); });
      atoms.inst.visible = true; atoms.update(t, dt); stepElectrons(dt);
      const u = seg(t, T.at0, T.f3), dd = atomD * lerp(1.12, 0.95, eOut(u)); look(V(dd * 0.08, dd * 0.07, dd), V(0, 0, 0), Math.sin(t * 0.7) * 0.02); }
    // ④ 점화 → 푸른 주계열성 · ⑤ 붉은 초거성 · ⑥ 단면(껍질) · ⑦ 철 핵 붕괴 → 되튐 충격파가 표면을 뚫음
    star.group.visible = t >= T.ig && t < T.sn; rem.visible = t >= T.sn + 0.1 && t < T.hz1 + 0.3; snG.visible = t >= T.sn && t < T.sn + 0.9;
    if (t >= T.ig && t < T.sn) { const g = seg(t, T.ig, T.ig + 0.24), ev = sstep(seg(t, T.ev0, T.ev1)), evC = sstep(seg(t, T.ev0, T.ev0 + 0.34)), fe = seg(t, T.fe0, T.col0), cl = eIn(seg(t, T.col0, T.bnc)), sh = seg(t, T.bnc, T.sn - 0.02), bo = sm01((t - T.sn + 0.07) / 0.07);
      const R = 0.9 * eBack(g, 2.4) * lerp(1, 2.3, ev); Rsn = R; star.group.scale.setScalar(Math.max(R, 0.001));
      star.U.uTemp.value = lerp(1.45, 0.24, evC) + bo * 1.3; star.U.uI.value = lerp(1.7, 1.05, evC) * (1 + bo * 5) + 5 * Math.exp(-(t - T.ig) * 10); star.U.uCell.value = lerp(6.5, 2.2, ev); star.U.uT.value = t * (1 + ev); star.U.uPulse.value = 0.07 * Math.sin(t * 8) * ev * (1 - fe);
      star.GU.uC.value.setRGB(lerp(0.55, 1.0, evC), lerp(0.65, 0.42, evC), lerp(1.0, 0.2, evC)); star.GU.uA.value = lerp(0.55, 0.3, evC) + bo * 2;
      star.setCut(eInOut(seg(t, T.cut0, T.cut1))); star.CU.uLay.value = 5.3 * seg(t, T.cut0 + 0.06, T.lay1); star.CU.uCol.value = 0.25 * cl + 0.35 * sh; star.CU.uHot.value = fe; star.CU.uFe.value = cl; star.CU.uSh.value = sh > 0 ? 0.02 + eIn(sh) : 0; star.CU.uI.value = 0.55 + 0.4 * fe + bo * 3;
      const blow = eOut(seg(t, T.ig, T.ig + 1.1)); nebSet(5.5 + 30 * blow, 1, 1.4 * (1 - seg(t, T.ig, T.ig + 0.3)), 0, 1 - seg(t, T.ig + 0.05, T.ig + 0.7)); setCloud(5.5 + 30 * blow, 1, 1, 1 - seg(t, T.ig + 0.1, T.ig + 0.9), 2.2 * blow);
      // 카메라: 별 크기에 맞춰 · 단면 땐 쐐기를 비스듬히 봄
      const Rv = Math.max(0.9 * lerp(1, 2.3, sstep(seg(t, T.ev0 + 0.3, T.cut0 + 0.12))), 0.5), az = lerp(0.15, Math.PI / 4 - 0.62, eInOut(seg(t, T.ev0 - 0.1, T.cut0 + 0.15))), d0 = lerp(fitR(Rv, 0.5), fitR(Rv, 0.62), seg(t, T.cut0, T.cut1)) * lerp(1, 0.88, seg(t, T.fe0, T.sn)), el = lerp(0.34, 0.26, ev);
      const dd = lerp(atomD * 0.9, d0, eOut(seg(t, T.ig, T.ig + 0.6))); dSN = dd; look(sph(V(), dd, az, el), V(0, 0.06 * ev, 0)); }
    // ⑧ 초신성: 섬광 → 뜨거운 불덩이가 덩어리진 실 같은 껍질로 퍼짐 → 남은 핵(중성자별) 깜빡
    shell.mesh.visible = t >= T.sn && t < T.hz0 + 0.4; debris.pts.visible = t >= T.sn && t < T.tp;
    if (t >= T.sn && t < T.tp) { const u = t - T.sn, R = Rsn + 15 * (1 - Math.exp(-u * 2.1)); shell.mesh.scale.setScalar(R); shell.U.uA.value = 0.85 * Math.exp(-u * 1.0) * (1 - seg(t, T.gr0 + 0.35, T.hz0 + 0.1)); shell.U.uR.value = R; shell.U.uF.value = 1.5 * Math.exp(-u * 3.4);
      snU.uA.value = 3 * Math.exp(-u * 8); snG.scale.setScalar(0.6 + u * 4); remU.uA.value = (0.6 + 0.25 * Math.sin(t * 40)) * seg(t, T.sn + 0.1, T.sn + 0.4) * (1 - seg(t, T.hz0 + 0.1, T.hz1)); rem.scale.setScalar(0.4); }
    // ⑨ 격자 · 지평선 · 원반 · 제트
    grid.lines.visible = t >= T.gr0 && t < T.gp0 + 0.9; if (grid.lines.visible) { grid.U.uA.value = 0.9 * seg(t, T.gr0, T.gr0 + 0.35) * (1 - seg(t, T.gp0 + 0.45, T.gp0 + 0.85)); grid.U.uEps.value = lerp(2.6, 0.5, eIn(seg(t, T.gr0, T.hz1))); grid.U.uDepth.value = 9.5 * eIn(seg(t, T.gr0 + 0.05, T.hz0 + 0.2)) / (1 / grid.U.uEps.value - 1 / 15); grid.U.uPull.value = eIn(seg(t, T.gp0, T.gp0 + 0.9)); }
    jets.group.visible = t >= T.jet; jets.U.uA.value = 1.8 * seg(t, T.jet, T.jet + 0.25) * (1 + 1.2 * Math.exp(-(t - T.jet) * 5)); jets.U.uL.value = eOut(seg(t, T.jet, T.jet + 0.7)); jets.U.uT.value = t;
    // 카메라: 폭발에 밀려 물러나며 위로 → 격자 우물을 내려다봄 → 원반 옆 높이로 내려와 천천히 돎 → 둘레 별들이 다 보이게 조금 더 물러남
    if (t >= T.sn) { const u1 = eOut(seg(t, T.sn, T.sn + 0.75)), u2 = eInOut(seg(t, T.hz1 - 0.15, T.done)), ue = eInOut(seg(t, T.done - 0.5, T.done + 1.0)), dBH = fit(14 * RsF * 2.05, 14 * RsF * 1.15), dEat = fit(28, 15);
      const az = Math.PI / 4 - 0.62 + 0.4 * u1 - 0.3 * u2 + 0.045 * Math.max(0, t - T.done), dd = lerp(lerp(lerp(dSN, 36, u1), dBH, u2), dEat, ue), el = lerp(lerp(lerp(0.26, 0.74, eInOut(seg(t, T.sn + 0.3, T.gr0 + 0.5))), 0.155, u2), 0.2, ue); look(sph(V(), dd, az, el), V(0, -0.35 * (1 - u2) * seg(t, T.gr0, T.hz0), 0), 0.035 * u2); }
    // 잔해: 퍼짐 → 일부가 돌며 원반 면으로
    if (t >= T.sn && t < T.tp) at("debris", () => { for (let i = 0; i < debris.N; i++) { const d = V(gauss(), gauss(), gauss()).normalize(), sp = Math.exp(gauss() * 0.5) * 3.2; debris.p.set([d.x * Rsn * 0.85, d.y * Rsn * 0.85, d.z * Rsn * 0.85], i * 3); dv[i * 3] = d.x * sp; dv[i * 3 + 1] = d.y * sp; dv[i * 3 + 2] = d.z * sp; debris.s[i] = rnd(0.025, 0.07); dk[i] = Math.random() < 0.55 ? 1 : 0; dr[i] = rnd(3.4, 15) * RsF; } });
    if (debris.pts.visible) stepDebris(dt);
    tde.pts.visible = tdN > 0; tdeL.lines.visible = false; if (t >= T.sn) eatStars(dt);
  }
  function setCloud(R, col, cu, a = 1, wind = 0) { cloud.U.uR.value = R; cloud.U.uCol.value = col; cloud.U.uFlat.value = col; cloud.U.uSpin.value = 0.3 + 2.4 * cu * cu; cloud.U.uA.value = a; cloud.U.uWind.value = wind; }
  // 플라스마 속 자유 전자: 빠르게 이리저리
  function stepElectrons(dt) { for (let i = 0; i < NFE; i++) { const p = feP[i], v = feV[i]; if (v.lengthSq() === 0 || p.length() > 4.6) { p.copy(L(rnd(-3.6, 3.6), rnd(-2.6, 2.6), rnd(-2, 1.4))); v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(rnd(5, 11)); } v.x += gauss() * dt * 40; v.y += gauss() * dt * 40; v.z += gauss() * dt * 40; p.addScaledVector(v, dt); const q = 0.05; fel.set(i, p.x, p.y, p.z, p.x - v.x * q, p.y - v.y * q, p.z - v.z * q, 0.5, 0.68, 1.5, 0.5); } fel.touch(); }
  function stepDebris(dt) { const u = t - T.sn, cap = seg(t, T.dk0, T.dk0 + 1.6), heat = Math.exp(-u * 1.3);
    for (let i = 0; i < debris.N; i++) { const o = i * 3; let x = debris.p[o], y = debris.p[o + 1], z = debris.p[o + 2];
      if (dk[i] && cap > 0) { const r = Math.hypot(x, z), ph = Math.atan2(z, x), w = 2.2 / Math.pow(Math.max(r / RsF, 2.5), 1.5) * 9, nr = lerp(r, dr[i], 1 - Math.exp(-dt * 2.2 * cap)), nph = ph + w * dt * cap; x = Math.cos(nph) * nr; z = Math.sin(nph) * nr; y *= Math.exp(-dt * 3 * cap); dr[i] *= Math.exp(-dt * 0.15 * cap); }
      else { x += dv[o] * dt; y += dv[o + 1] * dt; z += dv[o + 2] * dt; const k = 1 - dt * 0.25; dv[o] *= k; dv[o + 1] *= k; dv[o + 2] *= k; }
      debris.p[o] = x; debris.p[o + 1] = y; debris.p[o + 2] = z; const r = Math.hypot(x, y, z) / RsF, hot = dk[i] ? clamp((16 - r) / 12, 0, 1) * cap : 0, k = 0.3 + 1.0 * heat + hot;
      const c = bbJ(k), fo = dk[i] ? (1 - seg(t, T.dk0 + 1.0, T.done)) * (0.25 + 0.75 * seg(t, T.dk0, T.dk0 + 0.6)) : (1 - seg(t, T.sn + 0.6, T.hz0)), I = (0.12 + 0.9 * heat + 1.0 * hot) * fo; debris.c[i * 4] = c[0] * I; debris.c[i * 4 + 1] = c[1] * I; debris.c[i * 4 + 2] = c[2] * I; debris.c[i * 4 + 3] = r < 1.2 ? 0 : 1; }
    debris.touch(); }
  // 온도 → 빛깔 (매 프레임 수만 번 부르므로 새 배열을 만들지 않고 하나를 돌려 씀)
  const BBO = [0, 0, 0], ssb = (k, a, b) => { const q = clamp((k - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  function bbJ(k) { k = Math.max(k, 0); const s0 = ssb(k, 0, 0.22); let r = s0, g = 0.16 * s0, b = 0.02 * s0, e = ssb(k, 0.14, 0.42); r += (1 - r) * e; g += (0.5 - g) * e; b += (0.14 - b) * e; e = ssb(k, 0.38, 0.74); r += (1 - r) * e; g += (0.84 - g) * e; b += (0.62 - b) * e; e = ssb(k, 0.7, 1.04); r += (0.94 - r) * e; g += (0.96 - g) * e; b += (1 - b) * e; e = ssb(k, 1.04, 1.7); r += (0.6 - r) * e; g += (0.72 - g) * e; b += (1 - b) * e; BBO[0] = r; BBO[1] = g; BBO[2] = b; return BBO; }
  const sm01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  // ③ 둘레의 별 무리: 미리 계산해 둔 궤도를 따라감 (1/240초 간격 표를 보간)
  const sP = V(), sV = V(), rH = V(), vH = V(), YUP = V(0, 1, 0);
  function sibAt(s, tt, P, Vv) { const f = clamp((tt - T.sn) / HS, 0, s.N - 1.001), i = f | 0, w = f - i, a = s.tab, o = i * 6; P.set(a[o] + (a[o + 6] - a[o]) * w, a[o + 1] + (a[o + 7] - a[o + 1]) * w, a[o + 2] + (a[o + 8] - a[o + 2]) * w); if (Vv) Vv.set(a[o + 3] + (a[o + 9] - a[o + 3]) * w, a[o + 4] + (a[o + 10] - a[o + 4]) * w, a[o + 5] + (a[o + 11] - a[o + 5]) * w); return P; }
  // 찢긴 별 → 가스 줄기: 블랙홀 쪽 살은 더 단단히 묶여 먼저 감겨 들고, 바깥쪽 살은 덜 묶여 길게 늘어지거나 튕겨 나감
  function spawnTDE(s, n) { rH.copy(sP).normalize(); vH.copy(sV).normalize(); const vm = sV.length(), rr = s.R * 1.3, g = s.R * 0.08;
    for (let j = 0; j < n && tdN < NT; j++) { const i = tdN++, o = i * 3, x = Math.random() * 2 - 1, dvv = x * vm * 0.04, jv = vm * 0.004;
      tde.p[o] = sP.x + rH.x * x * rr + gauss() * g; tde.p[o + 1] = sP.y + rH.y * x * rr + gauss() * g; tde.p[o + 2] = sP.z + rH.z * x * rr + gauss() * g;
      tdV[o] = sV.x + vH.x * dvv + gauss() * jv; tdV[o + 1] = sV.y + vH.y * dvv + gauss() * jv; tdV[o + 2] = sV.z + vH.z * dvv + gauss() * jv; tdA[i] = 0; tdK[i] = s.temp; tdC[i] = 0; } }
  // 가스: 블랙홀 중력(가까울수록 상대론적으로 더 셈) · 안쪽을 지나며 부딪혀 원반 방향으로 돌게 되고(원반 면으로 가라앉음) 점점 감겨 들어가 사라짐
  function stepTDE(dt) { let eaten = 0;
    for (let i = 0; i < tdN; i++) { if (tdA[i] < 0) continue; const o = i * 3; let x = tde.p[o], y = tde.p[o + 1], z = tde.p[o + 2], vx = tdV[o], vy = tdV[o + 1], vz = tdV[o + 2], r = Math.hypot(x, y, z); tdA[i] += dt;
      const n = clamp(Math.ceil(Math.hypot(vx, vy, vz) * dt / (0.08 * r)), 1, 12), h = dt / n;
      for (let k = 0; k < n; k++) { r = Math.hypot(x, y, z); if (r < RsF * 1.3) break; const a = -GMb / ((r - RsF) * (r - RsF)) / r; vx += x * a * h; vy += y * a * h; vz += z * a * h;
        if (r < 5.2 && tdA[i] > 0.12) tdC[i] = Math.min(1, tdC[i] + h * 1.1); const c = tdC[i];
        if (c > 0) { const rq = Math.hypot(x, z) + 1e-4, vc = Math.sqrt(GMb * r) / (r - RsF) * 0.93, kk = Math.min(1, c * 2.4 * h); vx += (-z / rq * vc - vx) * kk; vz += (x / rq * vc - vz) * kk; vy += (-y * 10 - vy * 3) * c * h; }
        x += vx * h; y += vy * h; z += vz * h; }
      r = Math.hypot(x, y, z); if (r < RsF * 1.3 || r > 90) { tdA[i] = -1; tde.c[i * 4 + 3] = 0; if (r < 5) eaten++; continue; }
      tde.p[o] = x; tde.p[o + 1] = y; tde.p[o + 2] = z; tdV[o] = vx; tdV[o + 1] = vy; tdV[o + 2] = vz;
      const heat = clamp((9 - r) / 7.5, 0, 1), fo = sm01(tdA[i] / 0.08) * (1 - sm01((r - 30) / 40)) * sm01((r - RsF * 1.3) / (RsF * 0.7)), I = (0.11 + 0.36 * heat) * fo, c = bbJ(0.3 + 0.2 * tdK[i] + 0.45 * heat);
      tde.c[i * 4] = c[0] * I; tde.c[i * 4 + 1] = c[1] * I; tde.c[i * 4 + 2] = c[2] * I; tde.c[i * 4 + 3] = 1; tde.s[i] = 0.3 * (1 + 0.3 * heat);
    }
    flare += eaten * 0.0004; tde.touch(); }
  function eatStars(dt) {
    const fin = sm01((t - T.sn - 0.1) / 0.45);   // 초신성 빛 속에서 서서히 드러남
    for (const s of sibs) { if (s.gone) continue; const vis = t >= T.sn + 0.1; s.b.group.visible = vis; if (!vis) continue;
      sibAt(s, t, sP, sV); const r = sP.length(); s.b.group.position.copy(sP); s.b.group.quaternion.setFromUnitVectors(YUP, rH.copy(sP).normalize());
      if (t < s.tDis) { const e = Math.pow(clamp((RDis * 1.75 - r) / (RDis * 0.75), 0, 1), 2); s.b.group.scale.set(s.R * (1 - 0.3 * e), s.R * (1 + 1.7 * e), s.R * (1 - 0.3 * e)); s.b.U.uI.value = s.lum * (1 + 0.5 * e); s.b.U.uFade.value = fin; }
      else { const u = (t - s.tDis) / 0.24; at("tde" + s.i, () => { flare += 0.25; snd.scream(0.55); buzz(1); });
        const want = u >= 1 ? s.np : Math.round(s.np * sm01(u * 1.05)); if (want > s.sp) { spawnTDE(s, want - s.sp); s.sp = want; }
        if (u >= 1) { s.gone = true; s.b.group.visible = false; continue; }
        const k = 1 - u; s.b.group.scale.set(s.R * 0.7 * k, s.R * (2.7 + 2.5 * u) * Math.sqrt(k), s.R * 0.7 * k); s.b.U.uI.value = s.lum * (1.5 - 0.5 * u); s.b.U.uFade.value = 1; }
      s.b.spin.rotation.y = t * 0.25; s.b.update(t); }
    if (tdN) stepTDE(dt);
  }

  // ④ 달력: 지구(파란 하늘)에서 부들부들 떨다 통째로 날아감 → 구름을 지나 대기권을 뚫고 우주로 (블랙홀은 아직 안 보임) →
  //    달력은 화면 오른쪽 살짝 아래로 날아가고, 천체들이 왼쪽 위 뒤에서 달력보다 빠르게 날아와 지나치며 퍽퍽 부숨 (하나, 둘 → 점점 많고 빠르게) → 가루
  const FD = V(1, -0.3, -0.1).normalize(), EDIR = V(-0.82, 0.42, -0.4).normalize(), SUNF = V(0.38, 0.6, 0.7).normalize();
  const FU = V(0, 1, 0).addScaledVector(FD, -FD.y).normalize(), BH = V(), DN = FU.clone().addScaledVector(FD, -0.16).normalize();
  const DZ = V().crossVectors(V(1, 0, 0), DN).normalize(), DX = V().crossVectors(DN, DZ).normalize();
  const daySky = buildDaySky(); daySky.U.uUp.value.copy(EDIR).negate(); daySky.U.uSun.value.copy(SUNF); daySky.mesh.visible = false; scene.add(daySky.mesh);
  const clouds = []; for (let i = 0; i < 16; i++) { const c = cloudSprite(noise), s = lerp(-8, 60, i / 15) + rnd(-3, 3), fg = false, z = -rnd(14, 75), lat = (i % 2 ? 1 : -1) * rnd(6, 10 + Math.abs(z) * 0.35); c.mesh.position.copy(FD).multiplyScalar(s).addScaledVector(FU, lat).add(V(0, 0, z)); c.mesh.scale.setScalar(rnd(6, 16)); c.mesh.visible = false; scene.add(c.mesh); clouds.push({ c, s, fg }); }
  const plasma = glowPoints(64, PS, 1.6), heat = streaks(64); scene.add(plasma.pts, heat.lines); plasma.pts.visible = heat.lines.visible = false;
  // 좁은 세로 화면(폰)은 달력이 화면 폭을 거의 다 차지해 조각이 금방 화면 밖으로 나감 → 화면이 좁을수록 카메라를 뒤로 빼서 넓게 보여 줌
  const ZF = clamp(1 + (1 - aspect) * 0.75, 1, 1.42);
  const AN = V(), GQ = new THREE.Quaternion(), QF = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, -0.52, -0.1)), keyDir = SUNF;
  let flight = null, Vc = 0, lastSmash = 0, schedI = 0;
  const inP = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const bgLin = (() => { const c = new THREE.Color(bgCol); return [c.r, c.g, c.b]; })();
  function pulverize(s, k = 1) { const n = clamp(Math.round(s.area / 0.00028 * k), 4, 70); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const v of s.P) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    for (let i = 0, g = 0; i < n && g < n * 6; g++) { const x = rnd(x0, x1), y = rnd(y0, y1); if (!inP(s.P, x, y)) continue; i++; const w = V(x - s.c[0], y - s.c[1], 0).applyQuaternion(s.q).add(s.p), col = s.bg ? bgLin : colAt(x, y), br = 1 - s.burn * 0.85; powder.spawn(w.x, w.y, w.z, s.v.x + gauss() * 0.45, s.v.y + gauss() * 0.45, s.v.z + gauss() * 0.45, col[0] * br, col[1] * br, col[2] * br, rnd(0.008, 0.022)); }
    shards.kill(s); }
  function puff(p, k) { const f = puffs.reduce((a, b) => (a.t > b.t ? a : b)); f.t = 0; f.k = k; f.b.position.copy(p); f.b.visible = true; const bv = FD.clone().multiplyScalar(Vc); for (let i = 0; i < 24 * k; i++) powder.spawn(p.x, p.y, p.z, bv.x + gauss() * 1.3 * k, bv.y + gauss() * 1.3 * k, bv.z + gauss() * 1.3 * k, 0.8, 0.79, 0.76, rnd(0.006, 0.016)); }
  const segD = (c, a, b) => { tv.copy(b).sub(a); const l2 = tv.lengthSq() || 1; const u = clamp(tv2.copy(c).sub(a).dot(tv) / l2, 0, 1); return tv2.copy(a).addScaledVector(tv, u).distanceTo(c); };
  // 날아올 차례 [나오는 시각, 종류, 반지름, 빠르기(m/s)]: 처음엔 별이 하나씩 천천히 쳐서 조금씩 떼어 냄 → 점점 자주·빠르게 → 행성들도 합세해 다 부숨
  const sched = []; { const S0 = T.spc; [[0.3, 6], [1.35, 6.5], [2.2, 7.5], [2.85, 8.5], [3.35, 10], [3.75, 11]].forEach(([a, v], i) => sched.push([S0 + a, "star", 0.19 + i * 0.015, v]));
    [[4.05, "moon", 0.42, 12], [4.3, "star", 0.28, 13], [4.52, "rust", 0.48, 14], [4.72, "star", 0.3, 14], [4.9, "jupiter", 0.7, 15], [5.05, "rock", 0.26, 17], [5.18, "star", 0.3, 17], [5.3, "neptune", 0.6, 17]].forEach(([a, k, R, v]) => sched.push([S0 + a, k, R, v]));
    const ks = ["star", "rock", "europa", "star", "io", "rock", "mercury", "star", "uranus", "rock", "moon", "star", "rock", "rust", "star", "rock", "io", "star", "rock", "europa"]; let tt = S0 + 5.42, i = 0;
    while (tt < T.barE) { const u = (tt - S0 - 5.42) / (T.barE - S0 - 5.42), k = ks[i % ks.length]; sched.push([tt, k, k === "rock" ? rnd(0.18, 0.3) : k === "star" ? rnd(0.24, 0.32) : k === "uranus" ? 0.58 : rnd(0.32, 0.5), lerp(18, 32, u)]); i++; tt += lerp(0.13, 0.055, u); } }
  // 천체는 카메라 쪽 왼쪽 위(화면 구석 바로 밖)에서 나와 달력 앞면으로 날아들어 맞히고, 그대로 뚫고 오른쪽 아래 먼 곳으로 지나감
  function spawnBody(kind, R, speed) { const f = pool.find(q => !q.on && !q.used && q.kind === kind) || pool.find(q => !q.on && !q.used); if (!f) return null; f.on = true; f.used = true; f.R = R; f.b.group.scale.setScalar(R); f.b.group.visible = true;
    f.b.U.uFade.value = 1; camNow(); const th = Math.tan(cam.fov * Math.PI / 360), Dd = rnd(4.4, 5.3) * ZF + R, Rv = R * (f.b.isStar ? 2.6 : 1.1), st = cam.localToWorld(V(-(th * aspect * Dd + Rv * Math.hypot(1, th * aspect) + 0.03), rnd(0.3, 1.0) * th * Dd, -Dd)).sub(AN);
    const alive = shards.S.filter(s => s.alive); let tg; if (alive.length) { let tot = 0; for (const s of alive) tot += s.area; let r = Math.random() * tot, pick = alive[0]; for (const s of alive) { r -= s.area; if (r <= 0) { pick = s; break; } }
      let lx = pick.c[0], ly = pick.c[1]; for (let g = 0; g < 12; g++) { const px = pick.c[0] + rnd(-0.4, 0.4) * Math.sqrt(pick.area), py = pick.c[1] + rnd(-0.4, 0.4) * Math.sqrt(pick.area); if (inP(pick.P, px, py)) { lx = px; ly = py; break; } }
      tg = V(lx - pick.c[0], ly - pick.c[1], 0).applyQuaternion(pick.q).add(pick.p).sub(AN); const th = st.distanceTo(tg) / speed; tg.addScaledVector(tv.copy(pick.v).addScaledVector(FD, -Vc), th); } else tg = V(rnd(-0.3, 0.3), rnd(-0.6, 0.6), 0).applyQuaternion(GQ);
    const dir = tg.clone().sub(st).normalize();
    f.rel = st; f.vrel = dir.multiplyScalar(speed); f.prev = f.rel.clone(); f.left = st.distanceTo(tg); f.crossed = false; f.ax.set(rnd(-1, 1), 1, rnd(-1, 1)).normalize(); f.w = rnd(0.4, 1.4); flyers.push(f); snd.flyby(R * 1.3, speed * 2); return f; }
  // 공(반지름 Rv)이 화면에 조금이라도 걸리는지
  const inView = (p, Rv) => { tv.copy(p).applyMatrix4(cam.matrixWorldInverse); const D = -tv.z, th = Math.tan(cam.fov * Math.PI / 360), m = Rv * 1.08; if (D < -Rv) return false; return Math.abs(tv.x) < th * aspect * Math.max(D, 0) + m && Math.abs(tv.y) < th * Math.max(D, 0) + m; };
  // 점과 다각형 사이 거리 (안이면 0)
  function polyD(P, x, y) { if (inP(P, x, y)) return 0; let m = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); m = Math.min(m, Math.hypot(x - a[0] - dx * u, y - a[1] - dy * u)); } return m; }
  // 맞은 조각: 맞은 자리 둘레는 잘게 쪼개져 맞은 방향으로 튀어 나가고, 먼 쪽 큰 조각은 달력에 붙은 채로 남음
  function impact(s, lx, ly, f) {
    const sq = s.q.clone(), hitW = V(lx - s.c[0], ly - s.c[1], 0).applyQuaternion(sq).add(s.p), dirB = f.vrel.clone().normalize(), nrm = V(0, 0, 1).applyQuaternion(sq), sp = f.vrel.length();
    if (s.area < 0.004 || s.lvl >= 3) pulverize(s, 1.3);
    else { const kids = shards.split(s, hitW, V(), s.lvl === 0 ? 14 : s.lvl === 1 ? 10 : 7, 0, true);
      for (const k of kids) { const dx = k.c[0] - lx, dy = k.c[1] - ly, d = Math.hypot(dx, dy), out = V(dx, dy, 0).applyQuaternion(sq).normalize(); k.held = false; k.immune = f;
        k.v.copy(s.v).addScaledVector(out, 0.1 + 2.2 / (1 + d * 7)).addScaledVector(dirB, sp * 0.2 / (1 + d * 6)).addScaledVector(nrm, -(0.06 + 0.9 / (1 + d * 6)));
        k.w.copy(s.w).multiplyScalar(0.6).add(V(gauss(), gauss(), gauss()).multiplyScalar(0.25 + 7 / (1 + d * 6))); if (f.b.isStar) k.burn = Math.max(k.burn, clamp(0.6 - d * 1.6, 0, 0.6)); if (k.area < 0.0012 && Math.random() < 0.5) pulverize(k); } }
    // 퍽: 섬광 · 충격 고리 · 종이 가루와 부스러기 · 별이면 불티
    const pf = puffs.reduce((a, b) => (a.t > b.t ? a : b)); pf.t = 0; pf.k = Math.min(1.6, 0.6 + f.R * 1.3) * (f.b.isStar ? 1.5 : 1); pf.b.position.copy(hitW); pf.b.visible = true; pf.U.uC.value.setRGB(f.b.isStar ? 1.4 : 1, f.b.isStar ? 1.0 : 0.97, f.b.isStar ? 0.6 : 0.92);
    const rg = rings.reduce((a, b) => (a.t > b.t ? a : b)); rg.t = 0; rg.k = 0.4 + f.R * 0.8; rg.b.position.copy(hitW); rg.b.visible = true;
    const col = colAt(lx, ly), bv = FD.clone().multiplyScalar(Vc); for (let i = 0; i < 40 + 60 * f.R; i++) { const o = V(gauss(), gauss(), gauss()).multiplyScalar(1.4).addScaledVector(dirB, rnd(1, 6)), w = Math.random() < 0.5 ? col : [0.85, 0.84, 0.8], j = powder.spawn(hitW.x, hitW.y, hitW.z, bv.x + o.x, bv.y + o.y, bv.z + o.z, w[0], w[1], w[2], rnd(0.006, 0.02)); if (f.b.isStar && j >= 0 && Math.random() < 0.5) powder.s[j * 2 + 1] = rnd(0.5, 0.95); }
    if (t - lastSmash > 0.04) { lastSmash = t; snd.smash(Math.min(1.5, 0.55 + f.R * 1.2)); buzz(f.R > 0.6 ? [3, 40, 2] : 2); }
    if (t < T.spc + 4.1 && hitCool <= 0) { hitStop = 0.09; hitCool = 0.55; } hitShake = Math.min(1.6, hitShake + 0.5 + f.R * 0.8);
  }
  function calendar(dt) {
    const on = t >= T.tp && t < T.sk0 + 4.5; daySky.mesh.visible = t >= T.tp && t < T.brk + 0.6; if (!on) { powder.pts.visible = t >= T.tp && !!powder.n && t < T.dark + 0.5; return; } powder.pts.visible = true;
    if (!flight) { flight = true; AN.set(0, 0, 0); GQ.identity(); }
    // 속도: 떠오름 → 대기 속을 가속 → 우주에서 일정
    Vc = t < T.L0 ? 0 : t < T.L0 + 0.9 ? 20 * eIn(seg(t, T.L0, T.L0 + 0.9)) : t < T.brk ? lerp(20, 75, seg(t, T.L0 + 0.9, T.brk)) : lerp(75, 26, eOut(seg(t, T.brk, T.spc + 0.5)));
    AN.addScaledVector(FD, Vc * dt);
    // 자세: 부들부들 떨림 → 날아가는 자세 + 펄럭임
    const k = eInOut(seg(t, T.L0, T.L0 + 1.0)), fl = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(t * 2.3) * k, 0.06 * Math.sin(t * 1.7 + 1) * k, 0.04 * Math.sin(t * 2.9 + 2) * k)); GQ.identity().slerp(QF, k).multiply(fl);
    const trem = t < T.L0 + 0.3 ? seg(t, T.tp + 0.15, T.L0) : 0, ta = 0.0015 + 0.011 * trem * trem, JP = V(gauss() * ta, gauss() * ta, gauss() * ta * 0.4), GJ = GQ.clone().multiply(tmpQ.setFromEuler(new THREE.Euler(gauss() * ta * 1.5, gauss() * ta * 1.5, gauss() * ta * 2.5)));
    for (const s of shards.S) { if (!s.alive || !s.held) continue; tv.set(s.c[0], s.c[1], 0).applyQuaternion(GJ); s.p.copy(AN).add(tv).add(JP); s.q.copy(GJ); s.v.copy(FD).multiplyScalar(Vc); s.w.set(0, 0, 0); }
    // 빛: 해 + 하늘빛 (대기권 돌파 때는 앞 가장자리가 달아오름)
    const sp = seg(t, T.L0, T.L0 + 0.8), brk = seg(t, T.brk - 0.25, T.brk + 0.2) * (1 - seg(t, T.brk + 0.35, T.spc)); shards.U.uEmis.value = 1 - 0.62 * sp; shards.U.uKey.value.copy(SUNF); shards.U.uKeyC.value.setRGB(1.12, 1.08, 1.0).multiplyScalar(0.35 + 0.65 * sp);
    shards.U.uBack.value.copy(FD); shards.U.uBackC.value.setRGB(lerp(0.3, 2.4, brk), lerp(0.42, 0.9, brk), lerp(0.7, 0.3, brk)).multiplyScalar(sp * (t < T.spc ? 1 : 0.35 + 0.65 * brk)); shards.U.uAmb.value.setRGB(0.07, 0.08, 0.11).multiplyScalar(t < T.brk ? 1.8 : 1);
    shards.step(dt, (s, dt) => { s.v.addScaledVector(tv.copy(FD).multiplyScalar(Vc).sub(s.v), Math.min(1, dt * 0.85)); s.w.multiplyScalar(Math.exp(-dt * 0.35)); if (s.burn > 0) s.burn = Math.min(1, s.burn + dt * 0.3); });
    // 카메라: 정면(화면 그대로) → 비스듬히 옆에서 따라가며 달력이 오른쪽 아래에 보이게
    if (t < T.rev) { const ofs = V(0, 0, Dm).lerp(V(-0.5 * SW, 0.28 * SH, 1.8 * Dm).multiplyScalar(ZF), k), lk = V().lerp(V(-0.2 * SW - 0.14 * SW * seg(t, T.spc, T.rev), 0.13 * SH + 0.05 * SH * seg(t, T.spc, T.rev), 0), k); look(AN.clone().add(ofs), AN.clone().add(lk)); }
    // 구름 (대기 속) · 지구 (돌파한 뒤 뒤쪽 위) · 우주 먼지 줄
    const alt = sstep(seg(t, T.L0 + 0.4, T.brk + 0.35)); daySky.U.uAlt.value = alt; daySky.U.uVis.value = 1 - sstep(seg(t, T.brk + 0.05, T.brk + 0.55));
    for (const q of clouds) { q.c.mesh.visible = t >= T.L0 - 0.2 && t < T.brk + 0.5; if (!q.c.mesh.visible) continue; q.c.U.uLit.value = lerp(1.15, 0.55, alt); q.c.U.uA.value = 0.85 * (1 - seg(t, T.brk, T.brk + 0.45)) * (1 - clamp((q.s - 30) / 45, 0, 0.6)); }
    if (t >= T.brk - 0.15 && earth.group.parent === scene) { const ev = sstep(seg(t, T.brk - 0.15, T.brk + 0.5)); earth.U.uVisE.value = ev; earth.AU.uA.value = 1.25 * ev; } if (t >= T.brk - 0.15 && earth.group.parent === scene) at("earthPos", () => { camNow(); const f = V(0, 0, -1).transformDirection(cam.matrixWorld), r = V(1, 0, 0).transformDirection(cam.matrixWorld), u = V(0, 1, 0).transformDirection(cam.matrixWorld), th = Math.atan(Math.hypot(Math.tan(cam.fov * Math.PI / 360) * aspect, Math.tan(cam.fov * Math.PI / 360))), dirE = f.clone().multiplyScalar(Math.cos(th + 0.62)).addScaledVector(r.clone().multiplyScalar(-aspect).add(u).normalize(), Math.sin(th + 0.62)).normalize(); earth.group.position.copy(cP).addScaledVector(dirE, ER * 1.48); earth.group.scale.setScalar(ER); earth.U.uSun.value.copy(f).negate().addScaledVector(u, 0.4).addScaledVector(r, 0.3).normalize(); });
    warp.lines.visible = t >= T.L0 + 0.5 && t < T.rev + 1.5; if (warp.lines.visible) { const kk = (t < T.brk ? 0.35 * seg(t, T.L0 + 0.5, T.L0 + 1) : 0.9) * (1 - seg(t, T.rev + 0.6, T.rev + 1.4)), L = Vc * 0.03 + 0.4, bx = 9; for (let i = 0; i < 320; i++) { const s = wst[i]; s.addScaledVector(FD, -Vc * dt / bx); if (s.lengthSq() > 2.6) s.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).addScaledVector(FD, 1.1).normalize().multiplyScalar(rnd(0.3, 1.2)); const x = cP.x + s.x * bx, y = cP.y + s.y * bx, z = cP.z + s.z * bx * 1.6 - 4; warp.set(i, x, y, z, x - FD.x * L, y - FD.y * L, z - FD.z * L, 0.62, 0.7, 0.86, kk * (Math.hypot(s.x, s.y) > 0.12 ? 0.55 : 0)); } warp.touch(); }
    // 대기권 돌파: 앞 가장자리 불꽃 + 뒤로 끌리는 열 줄기
    plasma.pts.visible = heat.lines.visible = brk > 0.001; if (brk > 0.001) { for (let i = 0; i < 64; i++) { const u = i / 63, e = i % 2, lp = e ? V(SW / 2, lerp(-SH / 2, SH / 2, u), 0) : V(lerp(-SW / 2, SW / 2, u), -SH / 2, 0); tv.copy(lp).applyQuaternion(GQ); const lead = clamp(tv.dot(FD) / (SW * 0.5) * 0.8 + 0.25, 0, 1); tv.add(AN); const fk = brk * lead * (0.6 + 0.4 * Math.sin(t * 47 + i * 1.7)); plasma.p.set([tv.x, tv.y, tv.z], i * 3); plasma.c.set([2.6 * fk, 1.2 * fk, 0.45 * fk, 1], i * 4); plasma.s[i] = 0.16 + 0.08 * Math.sin(t * 31 + i); const Lh = (0.8 + 1.6 * Math.abs(Math.sin(i * 3.1 + t * 7))) * brk * lead; heat.set(i, tv.x, tv.y, tv.z, tv.x - FD.x * Lh, tv.y - FD.y * Lh, tv.z - FD.z * Lh, 1.8 * fk, 0.8 * fk, 0.3 * fk, 1); } plasma.touch(); heat.touch(); }
    // 천체: 앞면을 통과하는 순간 맞힘 (그 자리 조각들) · 이미 떨어져 나간 조각은 스치면 가루
    while (schedI < sched.length && t >= sched[schedI][0]) { const [, kd, R, spd] = sched[schedI++]; spawnBody(kd, R, spd); }
    for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.prev.copy(f.rel); f.rel.addScaledVector(f.vrel, dt); f.left -= f.vrel.length() * dt; f.p.copy(AN).add(f.rel); f.b.group.position.copy(f.p); f.b.spin.rotateOnAxis(f.ax, f.w * dt); f.b.update(t, keyDir, null);
      if (f.left < 0) { const dc = f.p.distanceTo(cP); f.b.U.uFade.value = 1 - sm01((dc - 170) / 110); if (dc > 280 || !inView(f.p, f.R * (f.b.isStar ? 2.6 : 1.1))) { f.on = false; f.b.group.visible = false; flyers.splice(i, 1); continue; } }
      if (t >= T.rev + 0.3) continue;
      const hits = []; for (const s of shards.S) { if (!s.alive || s.immune === f) continue; const c = s.p.clone().sub(AN); if (segD(c, f.prev, f.rel) > f.R + s.r) continue;
        const n = V(0, 0, 1).applyQuaternion(s.q), a = f.prev.clone().sub(c).dot(n), b = f.rel.clone().sub(c).dot(n); if (a * b > 0 && Math.min(Math.abs(a), Math.abs(b)) > f.R * 0.6) continue;
        const u = a * b <= 0 ? a / (a - b) : (Math.abs(a) < Math.abs(b) ? 0 : 1), x = f.prev.clone().lerp(f.rel, u).sub(c).applyQuaternion(s.q.clone().invert()), lx = x.x + s.c[0], ly = x.y + s.c[1]; if (polyD(s.P, lx, ly) < f.R * 0.9) hits.push([s, lx, ly]); }
      for (const [q, lx, ly] of hits) if (q.alive) impact(q, lx, ly, f); }
    if (t >= T.pulv && t < T.rev + 0.6) { for (const s of shards.S) { if (s.alive && Math.random() < dt * 3) pulverize(s, 0.8); } }
    if (t >= T.rev + 0.6) for (const s of shards.S) if (s.alive) pulverize(s, 0.6);
    shards.upload();
    for (const f of puffs) { if (f.t > 1) { f.b.visible = false; continue; } f.t += dt; f.b.position.addScaledVector(FD, Vc * dt); f.U.uA.value = f.k * 1.6 * Math.exp(-f.t * 13); f.b.scale.setScalar(0.25 + f.t * 3 * f.k); }
    for (const r of rings) { if (r.t > 1) { r.b.visible = false; continue; } r.t += dt; r.b.position.addScaledVector(FD, Vc * dt); r.U.uR.value = Math.min(0.95, r.t * 3.2); r.U.uA.value = 0.6 * r.k * Math.exp(-r.t * 6); r.b.scale.setScalar(1.1 * r.k); }
    // 다 가루가 되면: 카메라가 날아가는 쪽으로 돌아서며 그제야 블랙홀이 보임 (가루가 그리로 흘러감)
    if (t >= T.rev) { at("bhPlace", () => { BH.copy(AN).addScaledVector(FD, 420).addScaledVector(FU, -14); revCam = cP.clone(); revLook = cL.clone(); revAN = AN.clone(); });
      if (t < T.sk0) { const u = eInOut(seg(t, T.rev, T.sk0)), cam0 = revCam.clone().add(tv.copy(AN).sub(revAN)), cam1 = AN.clone().addScaledVector(FD, -9).addScaledVector(FU, 2.2), l0 = revLook.clone().add(tv2.copy(AN).sub(revAN)); look(cam0.lerp(cam1, u), l0.lerp(BH, u)); } }
  }
  let revCam = null, revLook = null, revAN = null;
  // 가루: 날아가던 속도 그대로 → ⑤에서 나선으로 원반에 빨려 듦 (지평선 가까이서 붉어지며 꺼짐)
  const NP = 26000, pr0 = new Float32Array(NP), pph = new Float32Array(NP), ph0 = new Float32Array(NP), pdl = new Float32Array(NP), pdu = new Float32Array(NP); let infall = false;
  function stepPowder(dt) {
    if (!powder.n) return;
    if (t < T.sk0) { powder.step(dt, (i, dt) => { const o = i * 3, kk = Math.min(1, dt * 0.35); powder.v[o] += (FD.x * Vc - powder.v[o]) * kk; powder.v[o + 1] += (FD.y * Vc - powder.v[o + 1]) * kk; powder.v[o + 2] += (FD.z * Vc - powder.v[o + 2]) * kk; }); return; }
    if (!infall) { infall = true; for (let i = 0; i < powder.n; i++) { const o = i * 3; tv.set(powder.p[o] - BH.x, powder.p[o + 1] - BH.y, powder.p[o + 2] - BH.z); const h = tv.dot(DN), x = tv.dot(DX), z = tv.dot(DZ); pr0[i] = Math.max(Math.hypot(x, z), 4 * RsC); pph[i] = Math.atan2(z, x); ph0[i] = h; pdl[i] = rnd(0, 0.5) + clamp(tv.length() / 420, 0, 1) * 0.45; pdu[i] = rnd(1.3, 2.2); powder.c[i * 4 + 3] = Math.min(powder.c[i * 4 + 3], 1); } }
    for (let i = 0; i < powder.n; i++) { const o = i * 3; if (powder.c[i * 4 + 3] <= 0) continue; const u = clamp((t - T.sk0 - pdl[i]) / pdu[i], 0, 1); if (u >= 1) { powder.c[i * 4 + 3] = 0; continue; }
      const r = lerp(pr0[i], 1.6 * RsC, Math.pow(u, 1.35)); pph[i] += dt * (0.25 + 9 * Math.pow(RsC * 3 / r, 1.5)) * (u > 0 ? 1 : 0.05); const h = ph0[i] * Math.pow(1 - u, 2.5);
      const cx = Math.cos(pph[i]) * r, cz = Math.sin(pph[i]) * r; powder.p[o] = BH.x + DX.x * cx + DZ.x * cz + DN.x * h; powder.p[o + 1] = BH.y + DX.y * cx + DZ.y * cz + DN.y * h; powder.p[o + 2] = BH.z + DX.z * cx + DZ.z * cz + DN.z * h;
      const heat = clamp((14 * RsC - r) / (11 * RsC), 0, 1); powder.s[i * 2 + 1] = heat * (1 - sm01((u - 0.82) / 0.18)); powder.s[i * 2] = lerp(powder.s[i * 2], 0.03 * (1 + 2.2 * heat), dt * 2); powder.c[i * 4 + 3] = 1 - sm01((u - 0.86) / 0.14); }
    powder.step(0, null);
  }
  // ⑤ 빨려 듦 → 암흑과 빛 구슬
  let sucked = null, skCam = null, skLook = null;
  function suck(dt) {
    if (t < T.sk0 || t >= B) { orb.visible = t >= T.ev && t < B + 0.12; return; }
    if (!skCam) { skCam = cP.clone(); skLook = cL.clone(); }
    const u = eInOut(seg(t, T.sk0, T.sk0 + 1.7)), dV = fit(14 * RsC * 2.5, 14 * RsC * 1.35), V1 = BH.clone().addScaledVector(FD, -dV).addScaledVector(FU, dV * 0.2); look(skCam.clone().lerp(V1, u).lerp(BH, 0.16 * sstep(seg(t, T.skyS, T.dark))), skLook.clone().lerp(BH, u));
    if (!sucked) { sucked = []; camNow();
      for (const f of flyers) { if (!f.on) continue; tv.copy(f.p).sub(BH); f.e = { r0: Math.max(Math.hypot(tv.dot(DX), tv.dot(DZ)), 4 * RsC), ph0: Math.atan2(tv.dot(DZ), tv.dot(DX)), h0: tv.dot(DN), t0: t, dur: rnd(1.5, 2.0), p0: f.p.clone(), v0: FD.clone().multiplyScalar(Vc).add(f.vrel), fly: true }; sucked.push(f); }
      flyers.length = 0;
      const free = pool.filter(q => !q.on && !q.used); for (let i = 0; i < free.length && sucked.length < 16; i++) { const f = free[i]; f.on = true; f.used = true; f.R = f.kind === "rock" ? rnd(1.2, 2.2) : f.kind === "jupiter" ? 5 : f.kind === "neptune" || f.kind === "uranus" ? 3.6 : rnd(1.8, 3.0); f.b.group.scale.setScalar(f.R);
        let e = null; for (let g = 0; g < 14; g++) { const t0 = T.sk0 + 0.15 + i * 0.2 + rnd(0, 0.12); e = { r0: rnd(120, 190), ph0: rnd(0, 6.283), h0: rnd(-40, 40), t0, dur: Math.min(rnd(1.6, 2.0), T.skyE - 0.3 - t0) }; tv2.copy(BH).addScaledVector(DX, Math.cos(e.ph0) * e.r0).addScaledVector(DZ, Math.sin(e.ph0) * e.r0).addScaledVector(DN, e.h0); if (!inView(tv2, f.R * (f.b.isStar ? 2.6 : 1.1))) break; }
        f.e = e; sucked.push(f); }
      const big = { saturn: 6, star: 4.6, jupiter: 6.5, neptune: 3.6, uranus: 3.8, venus: 3, mercury: 2 }; let j = 0; tv.copy(skCam).lerp(V1, 1).sub(BH); const rC = Math.hypot(tv.dot(DX), tv.dot(DZ)), pC = Math.atan2(tv.dot(DZ), tv.dot(DX)), hC = tv.dot(DN);
      for (const k of ["mercury", "venus", "neptune", "star", "uranus", "jupiter", "saturn"]) { const bp = bangP.find(q => q.kind === k); if (!bp || !bp.b) continue; const R = big[k], t0 = T.skyS - 0.7 + j * 0.3, f = { b: bp.b, R, kind: k, on: true, big: true }; j++; bp.b.group.scale.setScalar(R);
        // 카메라 바로 옆(화면 밖)에서 나와 눈앞을 가로질러 블랙홀로 휘감겨 듦
        let e = null; for (let g = 0; g < 24; g++) { e = { r0: rC * rnd(0.72, 0.9), ph0: pC - rnd(0.12, 0.3) - g * 0.03, h0: hC * rnd(0.5, 1.1) + rnd(-12, 12), t0, dur: Math.min(2.5, T.skyE - 0.25 - t0) }; tv2.copy(BH).addScaledVector(DX, Math.cos(e.ph0) * e.r0).addScaledVector(DZ, Math.sin(e.ph0) * e.r0).addScaledVector(DN, e.h0); if (!inView(tv2, R * (k === "star" ? 2.6 : k === "saturn" ? 2.4 : 1.1))) break; }
        f.e = e; sucked.push(f); } }
    for (const f of sucked) { if (!f.on) continue; const e = f.e, uu = clamp((t - e.t0) / e.dur, 0, 1); f.b.group.visible = t >= e.t0; if (!f.b.group.visible) continue; if (uu >= 1) { f.on = false; f.b.group.visible = false; flare += f.big ? 0.6 : 0.4; if (f.big) snd.scream(0.35); continue; }
      const r = lerp(e.r0, 1.3 * RsC, Math.pow(uu, 1.3)), ph = e.ph0 + 4.5 * Math.pow(uu, 1.7), h = e.h0 * Math.pow(1 - uu, 2); f.b.group.position.copy(BH).addScaledVector(DX, Math.cos(ph) * r).addScaledVector(DZ, Math.sin(ph) * r).addScaledVector(DN, h);
      if (e.fly) f.b.group.position.lerp(tv.copy(e.p0).addScaledVector(e.v0, t - e.t0), 1 - sstep(seg(t, e.t0, e.t0 + 0.8)));
      const tid = clamp((8 * RsC - r) / (6 * RsC), 0, 1), u2 = Math.min(1, uu + 0.01), r2 = lerp(e.r0, 1.3 * RsC, Math.pow(u2, 1.3)), ph2 = e.ph0 + 4.5 * Math.pow(u2, 1.7); tv.copy(BH).addScaledVector(DX, Math.cos(ph2) * r2).addScaledVector(DZ, Math.sin(ph2) * r2).sub(f.b.group.position).normalize(); f.b.group.quaternion.setFromUnitVectors(V(0, 1, 0), tv); f.b.group.scale.set(f.R * (1 - 0.65 * tid), f.R * (1 + 4 * tid * tid), f.R * (1 - 0.65 * tid)); f.b.U.uFade.value = (1 - sm01((uu - 0.8) / 0.2)) * (e.fly ? 1 : sm01((t - e.t0) / 0.3)); f.b.update(t, keyDir, null); }
    orb.visible = t >= T.ev; if (orb.visible) { orb.position.copy(BH); orb.scale.setScalar(0.5 * cP.distanceTo(BH) / Dm * eOut(seg(t, T.ev, T.dark))); orbU.uA.value = seg(t, T.ev, T.ev + 0.3); orbU.uT.value = t; orbU.uP.value = 0.5 + 0.5 * Math.sin(t * 2.4); }
    if (t > T.dark + 1.6 && hint.style.opacity !== "1") hint.style.opacity = "1";
  }
  // ⑥ 빅뱅
  const sideOf = [V(-1, 0.3, 0), V(1, -0.25, 0), V(-0.65, -0.8, 0), V(0.8, 0.6, 0), V(-1, -0.1, 0), V(0.7, -0.75, 0), V(-0.5, 0.85, 0), V(1, 0.15, 0)].map(v => v.normalize());
  const sizes = { saturn: 6.5, star: 10, jupiter: 8, neptune: 4.2, uranus: 4.4, earth: 4.0, venus: 3.8, mercury: 2.1 }, durs = [1.05, 1.15, 1.25, 1.35, 1.43, 1.55, 1.64, 1.74];
  const SUN_B = V(-0.42, 0.52, 0.74).normalize();
  // 일론이 설 자리: 큰 협곡 바로 위쪽의 붉은 땅 (극관 얼음 위가 아니라)
  const MSPOT = (() => { const lon = -1.0, lat = 0.05; return V(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)); })();
  function bang(dt) {
    if (t < B) return; const u = t - B, C = BH, camB = cP.clone(); orb.visible = u < 0.08; orbU.uA.value = 1 + u * 30;
    burst.lines.visible = bstars.pts.visible = u < 7.5;
    for (let i = 0; i < NBS; i++) { const s = bsp[i], k = 1.25, r = s * (1 - Math.exp(-k * u)) / k + s * 0.02 * u, vr = s * Math.exp(-k * u) + s * 0.02, o = i * 3; const x = C.x + bdir[o] * r, y = C.y + bdir[o + 1] * r, z = C.z + bdir[o + 2] * r; bstars.p[o] = x; bstars.p[o + 1] = y; bstars.p[o + 2] = z;
      const hot = Math.exp(-u * 1.6), I = (0.4 + 1.5 * hot) * (1 - seg(u, 5, 7.3)) * sm01(r / 14); bstars.c[i * 4] = lerp(bcol[o], 1.3, hot) * I; bstars.c[i * 4 + 1] = lerp(bcol[o + 1], 1.35, hot) * I; bstars.c[i * 4 + 2] = lerp(bcol[o + 2], 1.7, hot) * I; bstars.c[i * 4 + 3] = 1; bstars.s[i] = 0.26;
      if (i < 5000) { const Lt = vr * 0.05; burst.set(i, x, y, z, x - bdir[o] * Lt, y - bdir[o + 1] * Lt, z - bdir[o + 2] * Lt, 0.6 * I, 0.7 * I, 1.0 * I, clamp(vr / 45, 0, 1) * 0.8); } }
    bstars.touch(); burst.touch();
    for (const g of gals) { const k = Math.max(0, u - g.t0); g.g.mesh.visible = k > 0 && k < 4; g.g.mesh.position.copy(C).addScaledVector(g.d, g.sp * k * (1 + k * 0.6)); g.g.mesh.quaternion.copy(g.q); g.g.mesh.scale.setScalar(g.s); g.g.U.uA.value = seg(k, 0, 0.4) * 0.9; }
    const cf = V().subVectors(C, camB).normalize(), cr = V().crossVectors(cf, V(0, 1, 0)).normalize(), cu = V().crossVectors(cr, cf);
    bangP.forEach((b, i) => { const t0 = BT.pl[i], k = (u - t0) / durs[i], vis = k >= 0 && k < 1; b.group.visible = vis; if (!vis) return; const R = sizes[b.kind], s = sideOf[i], off = cr.clone().multiplyScalar(s.x).addScaledVector(cu, s.y).multiplyScalar(R * (b.kind === "star" ? 2.3 : 1.45) + (b.kind === "star" ? 8 : 4.5)), end = camB.clone().add(off).addScaledVector(cf, -R * 2.5 - 6);
      b.group.position.copy(C).lerp(end, Math.pow(k, 1.12)); b.group.scale.setScalar(R * (0.03 + 0.97 * sm01(k / 0.2)));
      if (b.b) { b.b.U.uFade.value = 1; b.group.quaternion.identity(); b.b.spin.rotation.y = t * 0.4; if (b.kind === "saturn") b.group.quaternion.setFromEuler(new THREE.Euler(0.42, 0, 0.3)); if (b.kind === "uranus") b.group.quaternion.setFromEuler(new THREE.Euler(0.1, 0, 1.45)); b.b.update(t, SUN_B, b.kind === "star" ? null : new THREE.Color(1.55, 1.48, 1.4)); }
      else { if (b.e.group.parent !== b.group) { b.group.add(b.e.group); b.e.group.position.set(0, 0, 0); b.e.group.scale.setScalar(1); b.e.group.visible = true; } b.e.U.uSun.value.copy(SUN_B); b.e.U.uVisE.value = 1; b.e.AU.uA.value = 1.25; b.e.U.uT.value = t * 20; b.m.U.uSun.value.copy(SUN_B); b.e.group.rotation.y = t * 0.3; }
      at("pb" + i, () => snd.flyby(R * 0.35 + 0.6, 40 + 30 * (1 - i / 8), true)); });
    // 화성 + 일론: 빨리 다가와 천천히 지나감 (일론이 또렷한 시간 약 1초)
    const mk = u - BT.mars; mars.group.visible = K.root.visible = mk >= 0 && mk < 2.4;
    if (mars.group.visible) { const em = sm01(mk / 0.3), sc = 0.03 + 0.97 * em, d = mk < 0.85 ? lerp(C.distanceTo(camB), 10.5, 1 - Math.pow(1 - mk / 0.85, 2.6)) : mk < 1.85 ? lerp(10.5, 6.8, (mk - 0.85) / 1.0) : lerp(6.8, -14, eIn(seg(mk, 1.85, 2.4))), py = (-2.2 - RM) * em;
      const mc = camB.clone().addScaledVector(cf, d).addScaledVector(cu, py).addScaledVector(cr, 0.12 * em); mars.group.position.copy(mc); mars.group.scale.setScalar(RM * sc); K.root.scale.setScalar(sc); mars.U.uSun.value.copy(SUN_B); mars.U.uT.value = t; mars.group.quaternion.setFromUnitVectors(MSPOT, cu);
      const feet = mc.clone().addScaledVector(cu, (RM - 0.05) * sc); K.root.position.copy(feet); const qu = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), cu); tv.copy(camB).sub(feet).applyQuaternion(qu.clone().invert()); K.root.quaternion.copy(qu).multiply(tmpQ.setFromAxisAngle(V(0, 1, 0), Math.atan2(tv.x, tv.z))); poseElon(mk, dt);
      at("mars", () => snd.flyby(2.2, 30, true)); if (mk > 0.55) at("thumb", () => { snd.thumbs(); buzz(2); }); }
    const pit = 0.12 * eInOut(seg(u, BT.mars - 0.3, BT.mars + 0.8)); look(camB, camB.clone().add(cf).addScaledVector(cu, -pit));
  }
  // 일론 자세: 선 채로 가슴 앞에서 두 손 엄지척 · 살짝 들썩
  const PO = { wL: V(0.26, 1.24, 0.4), FL: V(-0.12, 0.08, 1), NL: V(-1, 0, -0.1), wR: V(-0.26, 1.24, 0.4), FR: V(0.12, 0.08, 1), NR: V(1, 0, -0.1), pL: V(0.5, -1, -0.2), pR: V(-0.5, -1, -0.2) };
  const qL = new THREE.Quaternion(), qR = new THREE.Quaternion(), nw = V(), toC = V(), qw = new THREE.Quaternion(), qn = new THREE.Quaternion(), qi = new THREE.Quaternion(), eh = new THREE.Euler(); let yawS = 0, pitS = 0;
  function poseElon(mk, dt) { K.begin(); const up = eBack(seg(mk, 0.35, 0.68), 2.0), bob = Math.sin(mk * 6) * 0.01; K.B.hips.position.y = 0.98 + bob; K.setE("hips", 0.03, 0, 0); K.setE("spine", 0.03, 0, 0); K.setE("chest", -0.03, 0, 0); K.sync();
    K.leg("L", V(0.13, 0.085, 0.02), 0, 0.14, V(0.3, 0, 1)); K.leg("R", V(-0.13, 0.085, 0.02), 0, -0.14, V(-0.3, 0, 1));
    const wL = V(0.27, 0.95, 0.14).lerp(PO.wL, up), wR = V(-0.27, 0.95, 0.14).lerp(PO.wR, up); K.arm("L", wL, PO.pL, K.handQ("L", PO.FL, PO.NL, qL)); K.arm("R", wR, PO.pR, K.handQ("R", PO.FR, PO.NR, qR)); K.thumbUp("L", Math.min(1, up)); K.thumbUp("R", Math.min(1, up)); K.sync();
    K.B.neck.getWorldPosition(nw); K.root.worldToLocal(nw); K.root.worldToLocal(toC.copy(cam.position)).sub(nw); const yaw = clamp(Math.atan2(toC.x, toC.z), -0.9, 0.9), pit = clamp(-Math.atan2(toC.y, Math.hypot(toC.x, toC.z)), -0.5, 0.45); yawS += (yaw - yawS) * (1 - Math.exp(-dt * 12)); pitS += (pit - pitS) * (1 - Math.exp(-dt * 12));
    qw.setFromEuler(eh.set(pitS, yawS, Math.sin(mk * 1.7) * 0.04, "YXZ")); K.quatOf(K.B.chest, qn); K.B.neck.quaternion.copy(qn.clone().invert().multiply(qw)).slerp(qi, 0.5); K.sync(); K.quatOf(K.B.neck, qn); K.B.head.quaternion.copy(qn.invert().multiply(qw)); K.sync(); }

  // ────────── 블랙홀·하늘·톤 값 ──────────
  function params() {
    for (const k in P) delete P[k];
    P.sky = 1; P.neb = 1; P.tm = 1;
    if (t < T.sw) { P.sky = seg(t, 1.25, 1.95); P.tm = sstep(seg(t, 0.12, 0.9)); P.neb = 0.6; P.bloom = 0.34 * P.tm; P.vig = 0.32 * P.tm; }
    else if (t < T.tp) {
      P.sky = t < T.dv0 + 0.13 ? 1 : t < T.ig ? 0 : 1; P.neb = t < T.co1 ? 1.3 : 1;   // 별 속에선 하늘이 안 보임
      if (t > T.dv0 && t < T.dv0 + 0.45) { P.flash = 1.0 * Math.exp(-Math.pow((t - T.dv0 - 0.13) / 0.075, 2)); P.flashC = new THREE.Color(1.0, 0.72, 0.45); }
      if (t >= T.ig && t < T.ig + 0.5) { P.flash = 1.0 * Math.exp(-(t - T.ig) * 11); P.flashC = new THREE.Color(0.85, 0.9, 1.05); }
      if (t >= T.bnc && t < T.bnc + 0.3) { P.flash = 0.08 * Math.exp(-(t - T.bnc) * 16); P.flashC = new THREE.Color(0.7, 0.82, 1.2); }
      if (t >= T.sn) { const u = t - T.sn; P.flash = (P.flash || 0) + 2.6 * Math.exp(-u * 13); P.flashC = new THREE.Color(1, 0.94, 0.86); P.ca = 2.0 * Math.exp(-u * 4); }
      if (t >= T.hz0) { P.rs = RsF * eOut(seg(t, T.hz0, T.hz1)); P.bh = V(0, 0, 0); P.dn = V(0, 1, 0); P.disk = sstep(seg(t, T.dk0, T.dk0 + 1.25)); P.dform = sstep(seg(t, T.dk0 + 0.25, T.done)); P.dout = lerp(6, 14, eOut(seg(t, T.dk0, T.done))); P.heat = lerp(0.8, 1, seg(t, T.dk0, T.done)); P.spin = -1; P.flare = Math.min(flare, 0.3);
        
        }
    } else {
      P.tm = sstep(seg(t, T.L0, T.L0 + 0.8)); if (t < T.L0 + 0.8) { P.bloom = 0.34 * P.tm; P.vig = 0.32 * P.tm; }
      P.rs = t < T.rev ? 0 : t < T.ev ? RsC : RsC * (1 - eIn(seg(t, T.ev, T.dark))); P.bh = BH; P.dn = DN; P.disk = (1 - sstep(seg(t, T.dkOff, T.dkOff + 0.55))) * seg(t, T.rev, T.rev + 0.3); P.dform = 1; P.dout = 14; P.heat = 1; P.spin = -1; P.flare = Math.min(flare, 0.7);
      if (t > T.brk && t < T.spc + 0.4) { P.flash = 0.45 * Math.exp(-Math.pow((t - T.brk - 0.32) / 0.11, 2)); P.flashC = new THREE.Color(0.8, 0.9, 1.1); }
      if (t < T.tp + 0.45) { const u = t - T.tp; P.flash = 1.1 * Math.exp(-u * 16); P.flashC = new THREE.Color(0.75, 0.85, 1.2); P.ca = 2.6 * Math.exp(-u * 8); }
      if (t >= T.skyS) { const a = seg(t, T.skyS, T.skyE - 1.2), b = seg(t, T.skyE - 1.2, T.skyE); P.suck = b > 0 ? 1 - (0.36 * Math.pow(1 - b, 1.3) + 0.004) / Math.PI : 0.885 * Math.pow(a, 1.5); P.sw = 2.2; P.sc = BH.clone().sub(cP).normalize(); P.sky = 1 - seg(t, T.skyE - 0.12, T.skyE + 0.05); }
      if (t >= T.dark) { P.sky = 0; P.rs = 0; P.bloom = 0.4; }
      if (t >= B) { const u = t - B; P.rs = 0; P.sky = seg(u, 0.02, 0.5); P.suck = 1 - eOut(seg(u, 0.03, 2.9)); P.sw = -2.4; P.sc = BH.clone().sub(cP).normalize(); P.flash = 3.0 * Math.exp(-u * 22); P.flashC = new THREE.Color(1, 0.97, 0.92); P.ca = 3 * Math.exp(-u * 3.5);
        const s = BH.clone().project(cam); P.shC = new THREE.Vector2(s.x * 0.5 + 0.5, s.y * 0.5 + 0.5); P.shR = u * 1.25; P.shA = 0.8 * Math.exp(-u * 1.6) * (u < 2.5 ? 1 : 0); P.bloom = 0.3; P.fade = seg(u, BT.fade, BT.end - 0.05); }
    }
    P.shake = shake;
  }
  // ────────── 소리·진동 ──────────
  function sounds() {
    if (t > 0.05) at("go", () => { snd.whoosh(1.6, 0.8); snd.wind(1.9); }); if (t > T.ea0) at("ea", () => snd.whoosh(1.0, 0.5)); if (t > T.wp0) at("warp", () => snd.warp(T.co0 - T.wp0)); if (t > T.sw - 0.3) at("mus", () => snd.music());
    if (t > T.co0) at("zo", () => snd.whoosh(0.7, 0.6)); if (t > T.pj) at("pj", () => snd.jet()); if (t > T.dv0) at("dv", () => snd.whoosh(0.5, 0.75)); if (t > T.bnc) at("bnc", () => buzz(2)); if (t > T.ig) at("ig", () => { snd.ignite(); buzz(2); }); if (t > T.col0) at("imp", () => snd.implode(T.sn - T.col0)); if (t > T.sn) at("sn", () => { snd.supernova(); buzz([3, 90, 3, 120, 2]); shake = 0.3; });
    if (t > T.hz0) at("hz", () => { snd.sub(); buzz(3); }); if (t > T.dk0) at("hum", () => snd.hum(1)); if (t > T.jet) at("jet", () => { snd.jet(); buzz(2); }); if (t > T.done) at("done", () => snd.chord(0));
    if (t > T.tp - 0.12) at("tp", () => { snd.zap(); snd.hum(0); snd.musicEnd(); buzz(2); }); if (t > T.tp + 0.2) at("trem", () => snd.tremble(T.L0 + 0.3 - T.tp)); if (t > T.L0) at("launch", () => { snd.whoosh(1.2, 0.9); snd.wind(T.brk - T.L0 + 0.3); buzz(2); }); if (t > T.brk + 0.25) at("brk", () => { snd.boom(); buzz([3, 60, 2]); shake = Math.max(shake, 0.05); }); if (t > T.spc) at("spc", () => snd.hum(0.4)); if (t > T.rev) at("rev", () => { snd.hum(1); snd.whoosh(1.4, 0.6); });
    if (t > T.sk0) at("suck", () => snd.suck(T.dark - T.sk0)); if (t > T.dkOff) at("hum3", () => snd.hum(0)); if (t > T.ev) at("orb", () => snd.shimmer(true));
    if (t >= B) at("bang", () => { snd.shimmer(false); snd.bang(); snd.chord(1); buzz([3, 60, 3, 60, 3, 140, 2]); shake = 0.5; });
  }
  // 치울 것
  const disposables = () => [daySky, plasma, heat, tde, tdeL, protoJ, fel, ...clouds.map(q => q.c), post, shards, powder, neb, atoms, cloud, star, shell, debris, grid, jets, burst, bstars, warp, earth, mars, ...pool.map(q => q.b), ...sibs.map(q => q.b), ...bangP.map(b => b.b || { dispose() { b.m.dispose(); } }), ...gals.map(g => ({ dispose() { g.g.mesh.geometry.dispose(); g.g.mesh.material.dispose(); } })), ...[rem, snG, orb, protoG, ...puffs.map(p => p.b), ...rings.map(r => r.b)].map(m => ({ dispose() { m.geometry.dispose(); m.material.dispose(); } }))];
  // ────────── 준비 ──────────
  const allVis = [daySky.mesh, plasma.pts, heat.lines, ...clouds.map(q => q.c.mesh), worldB, neb.mesh, atoms.group, cloud.pts, star.group, shell.mesh, debris.pts, grid.lines, jets.group, rem, snG, tde.pts, tdeL.lines, protoG, protoJ.group, fel.lines, earth.group, mars.group, K.root, burst.lines, bstars.pts, orb, warp.lines, powder.pts, shards.mesh, ...pool.map(q => q.b.group), ...bangP.map(b => b.group), ...gals.map(g => g.g.mesh), ...sibs.map(q => q.b.group), ...puffs.map(p => p.b), ...rings.map(r => r.b)];
  { const was = allVis.map(v => v.visible); allVis.forEach(v => (v.visible = true)); star.faces.forEach(f => (f.visible = true)); makeAtoms(); atoms.update(0, 0); renderer.setRenderTarget(post.sRT); await renderer.compileAsync(scene, cam).catch(() => {});
    // 모양·그림을 미리 GPU에 올려 둠 (처음 보이는 순간 멈칫하지 않게): 1화소로 한 번 그림
    const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissorTest(); renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true); renderer.render(scene, cam); renderer.setScissorTest(sc); renderer.setViewport(vp); renderer.setRenderTarget(null); post.warm(); allVis.forEach((v, i) => (v.visible = was[i])); star.faces.forEach(f => (f.visible = false)); }
    if (o.warm) { scene.remove(K.root); K.root.visible = true; for (const d of disposables()) try { d.dispose(); } catch (e) {} noise.dispose(); envT.dispose(); pageT.dispose(); sky.mesh.geometry.dispose(); sky.mat.dispose(); disposeBodies(); return; }
  const ov = css => { const e = document.createElement("div"); e.style.cssText = "position:fixed;inset:0;z-index:19;pointer-events:none;opacity:0;" + css; document.body.append(e); return e; };
  const fade = ov("background:#000"), tapL = document.createElement("div"), hint = document.createElement("div"); tapL.style.cssText = "position:fixed;inset:0;z-index:20;touch-action:none;pointer-events:none;"; hint.textContent = "빛을 눌러!"; hint.style.cssText = `position:fixed;left:0;right:0;bottom:calc(16% + env(safe-area-inset-bottom));z-index:20;text-align:center;font:800 21px ${FONT};letter-spacing:.08em;color:#fff;text-shadow:0 0 12px rgba(150,190,255,.9),0 0 28px rgba(120,160,255,.55);pointer-events:none;opacity:0;transition:opacity .6s`; document.body.append(tapL, hint);
  const capEl = document.createElement("div"); capEl.style.cssText = `position:fixed;left:0;right:0;bottom:calc(8.5% + env(safe-area-inset-bottom));z-index:20;text-align:center;font:600 14px ${FONT};letter-spacing:.2em;color:rgba(255,255,255,.92);text-shadow:0 0 8px rgba(0,0,0,.75),0 0 22px rgba(130,165,255,.35);pointer-events:none;opacity:0;padding:0 16px`; document.body.append(capEl);
  function captions() { let best = "", ba = 0; for (const [a, b, s] of CAPS) { const al = sm01((t - a) / 0.22) * (1 - sm01((t - b) / 0.22)); if (al > ba) { ba = al; best = s; } } if (capEl.textContent !== best && ba > 0) capEl.textContent = best; capEl.style.opacity = ba.toFixed(3); }
  // 화면 크기 버퍼를 미리 만들고 한 번 그려 둠 (첫 화면이 바로 뜨게)
  update(0); params(); cam.position.copy(cP); cam.up.copy(cUp); cam.lookAt(cL); cam.updateMatrixWorld(true); post.render(scene, cam, P, 0);
  X.use("bhole", 3); document.documentElement.classList.add("bhole-on");
  const fire = () => { if (B < Infinity || t < T.dark - 0.2) return; B = t; hint.style.opacity = "0"; tapL.style.pointerEvents = "none"; };
  const onOrb = (x, y) => { const s = BH.clone().project(cam), sx = (s.x * 0.5 + 0.5) * vw, sy = (0.5 - s.y * 0.5) * vh; return Math.hypot(x - sx, y - sy) < Math.max(70, vmin * 0.24); };
  tapL.addEventListener("pointerdown", e => { if (innerWidth !== vw || innerHeight !== vh || onOrb(e.clientX, e.clientY)) fire(); }); const onKey = e => { if (e.key === " " || e.key === "Enter") fire(); }; addEventListener("keydown", onKey);
  if (import.meta.env.DEV) { window.__bhTap = fire; window.__bhK = K; }
  let last = performance.now(), raf = 0, ended = false;
  function update(dt) {
    t += dt; if (import.meta.env.DEV) { window.__bhT = t; window.__bhB = B; }
    if (t >= T.dark && B === Infinity && tapL.style.pointerEvents !== "auto") tapL.style.pointerEvents = "auto";
    ascent(dt); birth(dt); calendar(dt); stepPowder(dt); suck(dt); bang(dt); sounds(); captions();
    neb.update(cam); hitShake *= Math.exp(-dt * 9); flare *= Math.exp(-dt * 2.5); shake *= Math.exp(-dt * 4.5); if (t > T.col0 && t < T.sn) shake = Math.max(shake, 0.05 * seg(t, T.col0, T.sn)); if (t > T.tp && t < T.L0 + 0.2) shake = Math.max(shake, 0.004 + 0.02 * seg(t, T.tp, T.L0));
  }
  function frame(now) {
    const raw = clamp((now - last) / 1000, 0, 0.05); last = now; let dt = raw; hitCool -= raw; if (hitStop > 0) { hitStop -= raw; dt = raw * 0.16; }
    if (import.meta.env.DEV && window.__bhTo != null) { const to = window.__bhTo; if (to > t + 1e-4) { let n = 0; while (t < to - 1e-4 && n++ < 6000) { if (B === Infinity && t >= T.dark + 0.2 && to > T.dark + 0.2) break; update(Math.min(1 / 40, to - t)); } } update(0); } else if (import.meta.env.DEV && window.__bhStop != null) update(Math.max(0, Math.min(dt, window.__bhStop - t))); else update(dt);
    if (!(import.meta.env.DEV && window.__bhTo != null)) post.adapt(raw);
    if (X.mine("bhole")) { params(); const s = (P.shake || 0) * (t < T.tp ? 1 : 0.4); cam.position.copy(cP); cam.up.copy(cUp); cam.lookAt(cL); if (hitShake > 0.01) { const h = hitShake * 0.07; cam.position.x += rnd(-1, 1) * h; cam.position.y += rnd(-1, 1) * h; cam.position.z += rnd(-1, 1) * h * 0.5; } if (s > 0) { const k = s * Math.max(0.05, cP.distanceTo(cL) * 0.02); cam.position.x += rnd(-1, 1) * k; cam.position.y += rnd(-1, 1) * k; } cam.updateMatrixWorld(true); neb.update(cam);
      for (const p of [atoms, cloud, powder, debris, tde, bstars]) if (p.U && p.U.uScale) p.U.uScale.value = PS * post.q;
      post.render(scene, cam, P, t); }
    if (B < Infinity && t - B >= BT.end) { finish(); return; } raf = requestAnimationFrame(frame); }
  function finish() { cancelAnimationFrame(raf); if (ended) return; ended = true; X.drop("bhole"); document.documentElement.classList.remove("bhole-on"); renderer.autoClear = true; renderer.setRenderTarget(null); snd.end(); removeEventListener("keydown", onKey);
    scene.remove(K.root); K.root.visible = true; K.show("b"); K.root.position.set(0, 0, 0); K.root.quaternion.identity(); K.root.scale.setScalar(1);
    for (const d of disposables()) try { d.dispose(); } catch (e) {}
    noise.dispose(); envT.dispose(); pageT.dispose(); sky.mesh.geometry.dispose(); sky.mat.dispose(); disposeBodies();
    tapL.remove(); hint.remove(); capEl.remove(); fade.style.opacity = "1"; setTimeout(() => { fade.style.transition = "opacity .6s"; fade.style.opacity = "0"; setTimeout(() => fade.remove(), 700); }, 60); o.onDone && o.onDone(); }
  raf = requestAnimationFrame(frame);
}

// ── 소리 (전부 직접 합성) · 큰 소리는 잔향(직접 만든 공간 울림)을 거침 ──
function makeSound(get) {
  const A = () => get && get(); let rv = null, loops = {}, mOn = false, mg = null, mT = 0;
  const bus = a => { if (rv) return rv; const c = a.c, Ln = 3.6 * c.sampleRate, ir = c.createBuffer(2, Ln, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < Ln; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / Ln, 3.2) * (i < 200 ? i / 200 : 1); } const cv = c.createConvolver(); cv.buffer = ir; const g = c.createGain(); g.gain.value = 0.55; cv.connect(g); g.connect(a.out); rv = cv; return rv; };
  const out = (a, wet) => { if (!wet) return a.out; const g = a.c.createGain(); g.gain.value = 1; g.connect(a.out); const s = a.c.createGain(); s.gain.value = wet; g.connect(s); s.connect(bus(a)); return g; };
  const noise = (a, t, type, f0, f1, q, gain, att, dur, to) => { const s = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain(); s.buffer = a.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(to || a.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); };
  const tone = (a, t, type, f0, f1, gain, att, dur, to, lp) => { const o = a.c.createOscillator(), g = a.c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); if (lp) { const f = a.c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g); g.connect(to || a.out); o.start(t); o.stop(t + dur + 0.05); };
  function loop(name, make, lvl, tc = 0.25) { const a = A(); if (!a) return; let Lp = loops[name]; if (!Lp) { if (lvl <= 0) return; Lp = loops[name] = make(a); } Lp.g.gain.setTargetAtTime(Math.max(0.0001, lvl), a.c.currentTime, tc); }
  // 직접 만든 화음 진행: Dm(add9) → B♭maj7 → Gm9 → A(sus4) (느린 패드) · 끝에 D장조로 풀림
  const PAD = [[146.8, 220, 329.6, 349.2], [116.5, 233.1, 293.7, 440], [98, 233.1, 293.7, 349.2], [110, 220, 293.7, 329.6]];
  return {
    whoosh(d, g = 0.7) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 220, 2400, 0.9, g, d * 0.6, d); noise(a, t, "lowpass", 180, 900, 0.7, g * 0.6, d * 0.6, d + 0.02); },
    wind(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 300, 2600, 0.6, 0.9, d * 0.55, d); noise(a, t + d * 0.3, "bandpass", 900, 200, 2, 0.4, d * 0.4, d * 0.7); tone(a, t, "sawtooth", 40, 70, 0.22, d * 0.5, d, null, 220); },
    warp(d) { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.4); noise(a, t, "bandpass", 300, 3200, 1.6, 0.6, d * 0.7, d, o); tone(a, t, "sawtooth", 55, 220, 0.12, d * 0.7, d, o, 900); tone(a, t + d * 0.6, "sine", 2400, 600, 0.08, d * 0.3, d * 0.5, o); },
    fuse(k) { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.6); tone(a, t, "sine", 1760 * (0.9 + k * 0.2), 1700, 0.18 * k, 0.002, 1.4, o); tone(a, t, "sine", 2637, 2600, 0.08 * k, 0.002, 1.1, o); tone(a, t, "triangle", 120, 40, 0.5 * k, 0.002, 0.35); noise(a, t, "highpass", 6000, 3000, 0.7, 0.18 * k, 0.001, 0.3, o); for (let i = 0; i < 10; i++) noise(a, t + Math.random() * 0.25, "bandpass", rnd(3000, 8000), 2000, 4, 0.05 * k, 0.001, 0.03); },
    music() { const a = A(); if (!a || mOn) return; mOn = true; mg = a.c.createGain(); mg.gain.value = 0.0001; mg.gain.exponentialRampToValueAtTime(0.42, a.c.currentTime + 2.5); mg.connect(a.out); const s = a.c.createGain(); s.gain.value = 0.5; mg.connect(s); s.connect(bus(a)); const t0 = a.c.currentTime, bar = 1.9; let n = 0;
      const tick = () => { if (!mOn) return; const now = a.c.currentTime; while (t0 + n * bar < now + 0.3) { const w = t0 + n * bar, ch = PAD[n % 4], k = Math.min(1, 0.45 + n * 0.12); if (w >= now - 0.05) { for (const f of ch) { tone(a, w, "sawtooth", f, f * 1.001, 0.05 * k, 0.6, bar * 1.15, mg, 900 + n * 260); tone(a, w, "sawtooth", f * 1.006, f * 1.006, 0.04 * k, 0.6, bar * 1.15, mg, 700 + n * 200); tone(a, w, "sine", f * 2, f * 2, 0.025 * k, 0.4, bar, mg); } tone(a, w, "sine", ch[0] / 2, ch[0] / 2, 0.22 * k, 0.3, bar * 1.1, mg);
        for (let j = 0; j < 8; j++) { const f = ch[(j * 3) % 4] * (j % 2 ? 4 : 2); tone(a, w + j * bar / 8, "triangle", f, f, 0.03 * k * (n > 1 ? 1 : 0.4), 0.005, bar / 6, mg, 5000); } } n++; } mT = setTimeout(tick, 80); }; tick(); },
    musicEnd() { const a = A(); mOn = false; clearTimeout(mT); if (!a || !mg) return; const c = a.c.currentTime; mg.gain.cancelScheduledValues(c); mg.gain.setTargetAtTime(0.0001, c, 0.06); },
    ignite() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.5); tone(a, t, "sine", 70, 30, 0.9, 0.004, 1.2); noise(a, t, "lowpass", 2400, 120, 0.7, 0.8, 0.005, 1.4, o); tone(a, t, "sawtooth", 110, 220, 0.1, 0.4, 1.4, o, 1200); },
    implode(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", 300, 5000, 1.2, 0.9, d * 0.95, d + 0.02); tone(a, t, "sawtooth", 50, 300, 0.25, d * 0.9, d, null, 1500); },
    supernova() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.9); tone(a, t, "sine", 90, 18, 1, 0.002, 3.4); noise(a, t, "lowpass", 7000, 40, 0.7, 1, 0.002, 4.4, o); noise(a, t + 0.04, "bandpass", 2200, 90, 0.8, 0.9, 0.003, 2.6, o); tone(a, t, "sawtooth", 58, 16, 0.5, 0.002, 2.6, o, 400); for (let i = 0; i < 80; i++) { const q = Math.pow(Math.random(), 1.6) * 3; noise(a, t + q, "bandpass", rnd(200, 2600), 120, 1.2, rnd(0.08, 0.26) * (1 - q / 3.4), 0.002, rnd(0.04, 0.16)); } },
    sub() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.7); tone(a, t, "sine", 64, 24, 1, 0.01, 2.6); tone(a, t, "sine", 3200, 600, 0.05, 0.01, 1.6, o); noise(a, t, "lowpass", 400, 40, 0.9, 0.5, 0.05, 2, o); },
    hum(l) { loop("hum", a => { const g = a.c.createGain(); g.gain.value = 0.0001; const f = a.c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260; const o1 = a.c.createOscillator(), o2 = a.c.createOscillator(), lf = a.c.createOscillator(), lg = a.c.createGain(); o1.type = "sawtooth"; o2.type = "sawtooth"; o1.frequency.value = 36.7; o2.frequency.value = 36.9; lf.frequency.value = 0.55; lg.gain.value = 120; lf.connect(lg); lg.connect(f.frequency); o1.connect(f); o2.connect(f); f.connect(g); g.connect(a.out); const s = a.c.createBufferSource(); s.buffer = a.noise; s.loop = true; const nf = a.c.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 500; nf.Q.value = 3; const ng = a.c.createGain(); ng.gain.value = 0.18; s.connect(nf); nf.connect(ng); ng.connect(g); lg.connect(nf.frequency); o1.start(); o2.start(); lf.start(); s.start(); return { g, stop() { o1.stop(); o2.stop(); lf.stop(); s.stop(); } }; }, l * 0.36, 0.5); },
    jet() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.5); noise(a, t, "highpass", 1200, 4000, 0.7, 0.5, 0.02, 1.4, o); tone(a, t, "sawtooth", 220, 880, 0.08, 0.05, 0.9, o, 3000); },
    chord(k) { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.8), C = k ? [73.4, 146.8, 220, 293.7, 370, 440, 587.3] : [73.4, 146.8, 220, 293.7, 349.2, 440]; for (const f of C) { tone(a, t, "sawtooth", f, f, 0.06, 0.15, k ? 4.5 : 3.2, o, 2200); tone(a, t, "sine", f, f, 0.05, 0.1, k ? 4.8 : 3.4, o); } if (k) for (let j = 0; j < 12; j++) { const f = [587.3, 740, 880, 1174.7][j % 4] * (j > 7 ? 2 : 1); tone(a, t + 0.4 + j * 0.11, "triangle", f, f, 0.05, 0.005, 0.5, o, 6000); } },
    scream(k) { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.6); noise(a, t, "bandpass", 400, 4200, 6, 0.4 * k, 0.4, 0.7, o); tone(a, t, "sawtooth", 300, 1400, 0.05 * k, 0.4, 0.7, o, 2400); tone(a, t + 0.6, "sine", 90, 30, 0.6 * k, 0.003, 0.6); },
    zap() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.4); tone(a, t, "sawtooth", 3200, 60, 0.18, 0.003, 0.35, o, 6000); noise(a, t, "highpass", 5000, 400, 0.8, 0.5, 0.002, 0.3, o); tone(a, t, "sine", 120, 40, 0.8, 0.002, 0.5); },
    boom() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.6); tone(a, t, "sine", 95, 24, 1, 0.002, 1.4); noise(a, t, "lowpass", 4200, 70, 0.7, 0.95, 0.002, 1.6, o); noise(a, t + 0.05, "bandpass", 1400, 160, 0.8, 0.6, 0.004, 0.9, o); for (let i = 0; i < 30; i++) noise(a, t + Math.random() * 0.5, "bandpass", rnd(600, 3200), 300, 1.4, rnd(0.08, 0.2), 0.002, rnd(0.04, 0.1)); },
    tremble(d) { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "lowpass", 70, 260, 0.9, 0.9, d * 0.8, d); tone(a, t, "sawtooth", 30, 46, 0.35, d * 0.7, d, null, 160); for (let i = 0; i < 60; i++) { const q = Math.pow(Math.random(), 0.6) * d; noise(a, t + q, "bandpass", rnd(1800, 5200), 1200, 3, 0.05 + 0.12 * (q / d), 0.001, 0.03); } },
    pop() { const a = A(); if (!a) return; const t = a.c.currentTime; noise(a, t, "bandpass", rnd(1600, 2600), 700, 1.4, 0.28, 0.002, 0.12); tone(a, t, "sine", 260, 120, 0.25, 0.002, 0.1); noise(a, t + 0.02, "highpass", 4000, 2500, 0.8, 0.1, 0.002, 0.18); },
    shatter() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.5); noise(a, t, "lowpass", 3000, 200, 0.7, 0.9, 0.003, 0.7, o); tone(a, t, "sine", 150, 40, 0.7, 0.002, 0.5); for (let i = 0; i < 40; i++) noise(a, t + Math.random() * 0.4, "bandpass", rnd(1500, 6000), 1000, 2.4, rnd(0.08, 0.2), 0.001, rnd(0.03, 0.07)); },
    flyby(sz, sp, big) { const a = A(); if (!a) return; const t = a.c.currentTime, d = big ? 1.3 : 0.75, o = out(a, big ? 0.35 : 0.15); noise(a, t, "bandpass", 900 + sp * 20, 160, 1.2, 0.35 + 0.25 * sz, d * 0.7, d, o); tone(a, t, "sawtooth", 160 / Math.sqrt(sz), 50 / Math.sqrt(sz), 0.12 * sz, d * 0.7, d, o, 700); },
    smash(k) { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.25); tone(a, t, "sine", 150 / Math.max(0.6, k), 40, 0.75 * k, 0.002, 0.32); noise(a, t, "lowpass", 3200, 160, 0.8, 0.75 * k, 0.002, 0.42, o); for (let i = 0; i < 14; i++) noise(a, t + Math.random() * 0.16, "bandpass", rnd(1400, 5600), 900, 2.2, rnd(0.08, 0.22) * k, 0.001, rnd(0.02, 0.06)); },
    suck(d) { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.6); noise(a, t, "bandpass", 120, 3800, 1.2, 0.9, d * 0.9, d, o); tone(a, t, "sawtooth", 40, 400, 0.25, d * 0.9, d, o, 1600); tone(a, t, "sawtooth", 80, 800, 0.12, d * 0.9, d, o, 2400); tone(a, t + d - 0.05, "sine", 70, 20, 0.7, 0.01, 1.2); },
    shimmer(on) { loop("shim", a => { const g = a.c.createGain(); g.gain.value = 0.0001; const o1 = a.c.createOscillator(), o2 = a.c.createOscillator(), o3 = a.c.createOscillator(), lf = a.c.createOscillator(), lg = a.c.createGain(), am = a.c.createGain(); o1.frequency.value = 1174.7; o2.frequency.value = 1760; o3.frequency.value = 2349.3; o1.type = o2.type = o3.type = "sine"; lf.frequency.value = 2.4; lg.gain.value = 0.35; am.gain.value = 0.65; lf.connect(lg); lg.connect(am.gain); o1.connect(am); o2.connect(am); o3.connect(am); const h = a.c.createGain(); h.gain.value = 0.06; am.connect(h); h.connect(g); g.connect(a.out); const s = a.c.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(bus(a)); o1.start(); o2.start(); o3.start(); lf.start(); return { g, stop() { o1.stop(); o2.stop(); o3.stop(); lf.stop(); } }; }, on ? 1 : 0, on ? 0.6 : 0.03); },
    bang() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 1); tone(a, t, "sine", 110, 16, 1, 0.001, 4); noise(a, t, "lowpass", 9000, 40, 0.6, 1, 0.001, 5, o); noise(a, t + 0.02, "bandpass", 3000, 100, 0.8, 0.9, 0.002, 3, o); tone(a, t, "sawtooth", 70, 18, 0.55, 0.001, 3, o, 500); for (let i = 0; i < 90; i++) { const q = Math.pow(Math.random(), 1.4) * 3.6; noise(a, t + 0.1 + q, "bandpass", rnd(300, 4000), 200, 1.3, rnd(0.06, 0.2) * (1 - q / 4), 0.004, rnd(0.08, 0.3), o); } },
    thumbs() { const a = A(); if (!a) return; const t = a.c.currentTime, o = out(a, 0.4); [587.3, 740, 880, 1174.7].forEach((f, i) => { tone(a, t + i * 0.09, "square", f, f, 0.08, 0.006, 0.24, o, 3200); tone(a, t + i * 0.09, "sine", f * 2, f * 2, 0.07, 0.006, 0.34, o); }); },
    end() { mOn = false; clearTimeout(mT); for (const k in loops) { try { loops[k].stop(); loops[k].g.disconnect(); } catch (e) {} } loops = {}; if (mg) try { mg.disconnect(); } catch (e) {} mg = null; },
  };
}
