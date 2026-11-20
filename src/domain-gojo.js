// 영역전개 · 고죠: 무량공처(無量空處)
// 오른손 검지·중지를 꼬아 인을 맺음 → 끝없는 우주(별·흘러나가는 빛줄기·하늘의 빛고리)가 번짐
// → 바닥의 쇠 파편이 떠올라 그 자리에 뚝 멈춤(시간 정지) → 오른손으로 가리키면 왼쪽에 파란 구슬(끌어당김)이 생겨 파편을 소용돌이째 빨아들임
// → 왼손을 펴면 오른쪽에 빨간 구슬(밀어냄) → 두 구슬이 서로 돌며 부딪혀 보라색 구슬 → 두 손으로 밀어 화면 쪽으로 쏘아 보냄 → 보랏빛으로 뒤덮였다가 걷힘
import * as THREE from "three";
import { domainBase, placeHand, tremble, fg, FIST, POSE, Q, key2, makePts, makeOrb, synth, clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V } from "./domain-kit.js";
import { radialTex, buzz } from "./fx-util.js";

const T = { seal: 1.0 };
T.text = T.seal + 0.14;
T.lift = T.seal + 0.55;     // 파편이 떠오름 → 뚝 멈춤
T.stop = T.lift + 0.95;     // 시간 정지 (멈추는 소리)
T.blue = T.stop + 0.55;     // 파란 구슬
T.red = T.blue + 1.55;      // 빨간 구슬
T.merge = T.red + 0.75;     // 두 구슬이 서로 돌며 다가감
T.fuse = T.merge + 0.75;    // 부딪혀 보라색
T.fire = T.fuse + 0.6;      // 쏘아 보냄
T.boom = T.fire + 0.42;     // 화면을 덮음 (이때 달력을 밑에 깔아 둠)
T.retract = T.boom + 0.75;
T.end = T.retract + 0.95;

// 검지·중지 꼬기: 중지가 손바닥 쪽으로 살짝 굽으며 검지 앞을 가로지름 · 약지·새끼는 접고 엄지로 누름
const CROSS = { index: fg(0.1, 0.02, 0, -0.3), middle: fg(-0.3, -0.03, 0.02, 0.4), ring: FIST.ring, pinky: FIST.pinky, thumb: [[-0.75, 0.55, 0], [-0.55, 0, 0], [-0.5, 0, 0]] };
const PRE = { index: fg(-0.1, -0.15, -0.1, -0.05), middle: fg(-0.15, -0.2, -0.1, 0.1), ring: fg(-0.9, -1.0, -0.6), pinky: fg(-0.95, -1.0, -0.6), thumb: [[-0.3, 0.3, 0], [-0.3, 0, 0], [-0.3, 0, 0]] };

const BODY = `
vec3 body(vec2 p){
  vec2 q = (p - uC) / uRes.y; float r = length(q), a = atan(q.y, q.x);
  vec3 col = vec3(0.003, 0.005, 0.018);
  // 성운
  float nb = fbm(q * 2.0 + vec2(uT * 0.02, -uT * 0.015));
  col += vec3(0.04, 0.07, 0.2) * pow(nb, 2.0) * 1.8 + vec3(0.13, 0.03, 0.22) * pow(vn(q * 3.3 - 4.0), 3.0) * 0.9;
  // 별
  vec2 g = p / 9.0, id = floor(g); float hs = h21(id); vec2 f = fract(g) - 0.5 - (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.7;
  col += vec3(0.8, 0.9, 1.0) * step(0.962, hs) * smoothstep(0.17, 0.0, length(f)) * (0.55 + 0.45 * sin(uFT * 3.0 + hs * 60.0));
  // 끝없이 흘러나가는 빛줄기 (정보의 홍수)
  float lr = log(max(r, 0.002));
  for (int L = 0; L < 2; L++) {
    float Nn = L == 0 ? 240.0 : 120.0;
    float ca = (a / 6.2832 + 0.5) * Nn, id2 = floor(ca), fx = fract(ca) - 0.5;
    float hh = h21(vec2(id2, float(L) * 13.0 + 1.0));
    float on = step(0.5 - uWarp * 0.35, h21(vec2(id2, float(L) * 7.0 + 3.0)));
    float sp = (0.35 + hh * 0.7) * (1.0 + uWarp * 5.0);
    float ph = fract(hh * 7.0 + lr * (0.5 + 0.3 * float(L)) - uFT * sp * 0.5);
    float len = 0.1 + 0.18 * h21(vec2(id2, 5.0 + float(L)));
    float s = ph < len ? pow(1.0 - ph / len, 2.0) : 0.0;
    float w = exp(-fx * fx / (L == 0 ? 0.012 : 0.03));
    col += mix(vec3(0.45, 0.75, 1.0), vec3(0.95, 0.97, 1.0), s) * s * w * on * smoothstep(0.08, 0.5, r) * (0.55 + uWarp) * uFlow;
  }
  // 하늘의 빛고리 (가운데는 새까만 구멍)
  float rr = abs(r - uRing);
  col *= mix(1.0, 0.15, smoothstep(uRing, uRing * 0.85, r) * uFlow);
  col += vec3(0.45, 0.72, 1.0) * (exp(-rr * rr / 0.00012) * 1.4 + exp(-rr * rr / 0.004) * 0.35) * uFlow;
  col += vec3(0.85, 0.92, 1.0) * exp(-rr * rr / 0.00002) * uFlow;
  // 쏘아 보낸 보랏빛이 덮음
  col += vec3(0.55, 0.75, 1.0) * uStopF * (0.35 + 0.65 * smoothstep(0.0, 0.9, r));
  col = mix(col, vec3(0.78, 0.5, 1.0), uPurp);
  vec2 vq = (p / uRes - 0.5) * vec2(1.2, 0.9); col *= 1.0 - 0.45 * dot(vq, vq) * 2.0 * (1.0 - uPurp);
  return col;
}`;

export function buildGojo(c) {
  const { vw, vh, D, S, K, FLOOR, R, L } = c;
  const glowTex = radialTex([[0, "rgba(255,255,255,1)"], [0.22, "rgba(255,255,255,.55)"], [0.5, "rgba(255,255,255,.14)"], [1, "rgba(255,255,255,0)"]]);
  const bgU = { uC: { value: new THREE.Vector2(vw / 2, vh * 0.62), glsl: "vec2" }, uWarp: { value: 0, glsl: "float" }, uFlow: { value: 0, glsl: "float" }, uRing: { value: 0.3, glsl: "float" }, uPurp: { value: 0, glsl: "float" }, uFT: { value: 0, glsl: "float" }, uStopF: { value: 0, glsl: "float" } };
  const freezeT = t => Math.min(t, T.stop) + Math.max(0, Math.min(t, T.blue + 0.3) - T.stop) * 0.02 + Math.max(0, t - T.blue - 0.3);
  const HS = 0.72;   // 손 크기
  const P_BLUE = V(-vw * 0.2, vh * 0.1, 30), P_RED = V(vw * 0.2, vh * 0.1, 30), P_MID = V(0, vh * 0.05, 70);
  const OR = Math.min(vw, vh) * 0.07;   // 구슬 기본 반지름
  let api = null;

  const def = {
    key: "gojo", T, bg: { body: BODY, u: bgU, rim: 0x8fd0ff },
    init(par, o, E) {
      for (const q of par) {
        Object.assign(q, { L: T.lift + Math.pow(Math.random(), 1.3) * 0.5, Ld: rnd(0.55, 0.85), hy: FLOOR + 50 + Math.pow(Math.random(), 0.8) * vh * 0.72,
          dx: rnd(-40, 40) + q.x * 0.15, dz: rnd(-60, 30), wx: rnd(-3, 3), wy: rnd(-3, 3), wz: rnd(-3, 3), om: rnd(5, 9) * (Math.random() < 0.85 ? 1 : -1) });
        const hx = q.x + q.dx, d = Math.hypot(hx - P_BLUE.x, q.hy - P_BLUE.y);
        q.ta = T.blue + 0.25 + clamp(d / (vw * 0.9), 0, 1) * 1.05 + rnd(0, 0.25); q.td = rnd(0.55, 0.85);
      }
      E.absorbed = 0;
    },
    update(t, dt, E) {
      hands(t);
      // 파편: 떠올라 뚝 멈춤 → 파란 구슬로 소용돌이치며 빨려 듦
      const ob = orbBlue.pos(t); let got = 0;
      for (let i = 0; i < E.N; i++) {
        const q = E.par[i];
        let x = q.x, y = q.y, z = q.z, rx = q.rx, ry = q.ry, rz = q.rz, k = 1;
        const u = seg(t, q.L, q.L + q.Ld);
        if (u > 0) { const e = eOut(u), sp = q.Ld * (u - u * u / 2) * 2.2; y = lerp(y, q.hy, e); x += q.dx * e; z += q.dz * e; rx += q.wx * sp; ry += q.wy * sp; rz += q.wz * sp; }
        if (t > T.stop && t < T.stop + 0.4) { const j = Math.exp(-(t - T.stop) * 14) * Math.sin((t - T.stop) * 90 + i) * 2.5; x += j; y += j * 0.6; }
        const u2 = seg(t, q.ta, q.ta + q.td);
        if (u2 > 0) {
          const e = eIn(u2), rr = 1 - e, ang = q.om * e * 1.4;
          const ox = x - ob.x, oy = y - ob.y, ca = Math.cos(ang), sa = Math.sin(ang);
          x = ob.x + (ox * ca - oy * sa) * rr; y = ob.y + (ox * sa + oy * ca) * rr; z = lerp(z, ob.z, e);
          rx += 9 * e; ry += 7 * e; k = 1 - seg(u2, 0.7, 1); if (u2 >= 1) got++;
        }
        E.setFrag(i, x, y, z, rx, ry, rz, q.s, Math.max(0.0001, k));
      }
      E.absorbed = E.N ? got / E.N : 1;
      orbs(t, dt, E); fxExtra(t);
    },
    light(t, E) {
      const { dir, p1, p2 } = E.L, dk = E.dk;
      dir.color.setRGB(0.55, 0.75, 1); dir.intensity = 3.0 * dk;
      const b = orbBlue.a, r = orbRed.a, pu = orbPur.a;
      p1.color.setRGB(lerp(0.3, 0.75, pu), lerp(0.55, 0.4, pu), 1); p1.position.copy(pu > 0.01 ? orbPur.g.position : orbBlue.g.position); p1.intensity = 5 * Math.max(b, pu * 1.6) * dk;
      p2.color.setRGB(1, 0.25, 0.18); p2.position.copy(orbRed.g.position); p2.intensity = 4.5 * r * dk;
      const { bg } = E; bgU.uFlow.value = sstep(seg(t, T.seal, T.seal + 0.9));
      bgU.uWarp.value = 0.15 * sstep(seg(t, T.blue, T.red)) + 0.85 * sstep(seg(t, T.fuse, T.boom)) * (1 - seg(t, T.boom, T.retract));
      bgU.uRing.value = 0.3 + 0.04 * Math.sin(t * 0.7) - 0.12 * sstep(seg(t, T.fuse, T.boom));
      bgU.uFT.value = freezeT(t); bgU.uStopF.value = Math.exp(-Math.max(0, t - T.stop) * 9) * (t >= T.stop ? 0.5 : 0);
      bgU.uPurp.value = sstep(seg(t, T.boom - 0.1, T.boom + 0.05)) * (1 - sstep(seg(t, T.boom + 0.15, T.retract + 0.1)));
      bg.u.uRim.value = Math.max(bg.u.uRim.value, 0);
    },
    beats(t, E) {
      const { snd } = E.ctx;
      if (t >= T.stop) E.once("stop", () => { sn.stop(); buzz([2, 60, 3]); E.freeze = 0.05; });
      if (t >= T.blue) E.once("blue", () => { sn.hum(0.6, T.merge - T.blue + 0.4, 55); buzz(2); E.shake = 5; });
      if (t >= T.blue + 0.3) E.once("suck", () => snd.whoosh(1.6));
      if (t >= T.red) E.once("red", () => { sn.hum(1.4, T.fuse - T.red + 0.2, 160); buzz([2, 40, 2]); E.shake = 7; });
      if (t >= T.merge) E.once("merge", () => { sn.beat(T.fuse - T.merge); });
      if (t >= T.fuse) E.once("fuse", () => { sn.fuse(); buzz([3, 40, 3, 90, 3]); E.shake = 22; E.freeze = 0.1; E.invert(); });
      if (t >= T.fire) E.once("fire", () => { sn.fire(); snd.launch(); buzz([3, 30, 3, 30, 3, 30, 3]); E.shake = 26; });
      if (t >= T.boom) E.once("flash", () => { const f = E.ctx.ui.querySelector(".cr-flash"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 140); buzz(3); E.titleOff(); });
    },
    cam(t, E) {
      const { cp, cl } = E;
      const k2 = eInOut(seg(t, T.lift, T.blue)); cp.lerp(V(0, -vh * 0.04, D * 1.04), k2); cl.lerp(V(0, vh * 0.05, 0), k2);
      const k3 = eInOut(seg(t, T.merge - 0.2, T.fuse + 0.1)); cp.lerp(V(0, -vh * 0.02, D * 0.9), k3); cl.lerp(V(0, vh * 0.04, 40), k3);
      const k4 = eIn(seg(t, T.fire, T.boom)); cp.z -= D * 0.12 * k4;
      E.amp = 2.5 * seg(t, T.blue, T.blue + 0.5) * (1 - seg(t, T.red, T.red + 0.3)) + 4 * seg(t, T.red, T.fuse) + 7 * seg(t, T.fuse, T.fuse + 0.1) * (1 - seg(t, T.boom, T.retract));
    },
  };

  // ── 손 ──
  const K_R = {
    start: key2(V(-vw * 0.55, -vh / 2 - S * 2.3, 60), Q(0.7, 0.6, -0.6)),
    sign: key2(V(-S * 0.15, -vh * 0.05, 165), Q(0.12, -0.42, 0.1), [0.4, 0.12]),
    aim: key2(V(-vw * 0.12, -vh * 0.2, 190), Q(0.35, 0.25, 0.55), [0.35, 0.05]),
    gather: key2(V(-S * 0.85, -vh * 0.16, 180), Q(0.15, 0.75, -0.15), [0.3, 0.1]),
    push: key2(V(-S * 0.7, -vh * 0.14, 250), Q(-0.55, 0.35, 0.15), [0.05, 0]),
    exit: key2(V(-vw * 0.4, -vh / 2 - S * 2.5, 100), Q(0.6, 0.5, -0.3)),
  };
  const K_L = { ...K_R, sign: K_R.start, aim: key2(V(-vw * 0.12, -vh * 0.21, 185), Q(0.2, 0.55, 0.45), [0.3, 0.1]) };
  function hands(t) {
    placeHand(R, K_R, [["sign", eBack(seg(t, 0.05, T.seal), 1.2)], ["aim", eInOut(seg(t, T.blue - 0.35, T.blue + 0.05))], ["gather", eInOut(seg(t, T.merge - 0.25, T.merge + 0.2))], ["push", eOut(seg(t, T.fire - 0.12, T.fire + 0.1))], ["exit", eIn(seg(t, T.boom, T.retract + 0.3))]],
      [[PRE, sstep(seg(t, 0.3, 0.8))], [CROSS, eIn(seg(t, T.seal - 0.16, T.seal))], [POSE.point, eOut(seg(t, T.blue - 0.3, T.blue))], [POSE.claw, sstep(seg(t, T.merge - 0.2, T.merge + 0.15))], [POSE.spread, eOut(seg(t, T.fire - 0.1, T.fire + 0.06))], [POSE.relax, sstep(seg(t, T.boom + 0.3, T.retract))]],
      HS, (xf, pose) => {
        const rs = t - T.seal; if (rs > 0 && rs < 1.2) { const a = Math.exp(-rs * 6) * Math.sin(rs * 34); xf.p.y -= S * 0.04 * a; xf.p.z -= 14 * a; }
        tremble(xf, t, 1, (t > T.seal && t < T.blue - 0.3 ? 0.3 : 0) + 1.2 * seg(t, T.red, T.fuse) * (t < T.fire ? 1 : 0));
      });
    placeHand(L, K_L, [["aim", eInOut(seg(t, T.red - 0.4, T.red + 0.02))], ["gather", eInOut(seg(t, T.merge - 0.25, T.merge + 0.2))], ["push", eOut(seg(t, T.fire - 0.12, T.fire + 0.1))], ["exit", eIn(seg(t, T.boom, T.retract + 0.3))]],
      [[POSE.palm, eOut(seg(t, T.red - 0.3, T.red))], [POSE.claw, sstep(seg(t, T.merge - 0.2, T.merge + 0.15))], [POSE.spread, eOut(seg(t, T.fire - 0.1, T.fire + 0.06))], [POSE.relax, sstep(seg(t, T.boom + 0.3, T.retract))]],
      HS, xf => tremble(xf, t, -1, 1.2 * seg(t, T.red, T.fuse) * (t < T.fire ? 1 : 0)));
  }

  // ── 구슬 ──
  const mk = (col, glowC) => { const o = makeOrb(col, glowTex); o.glow.material.color.set(glowC); o.a = 0; o.pos = () => o.g.position; return o; };
  const orbBlue = mk(0x2f7dff, 0x3a8cff), orbRed = mk(0xff3020, 0xff4a2a), orbPur = mk(0x9a4dff, 0xb070ff);
  orbRed.u.uSpin.value = -2.4; orbPur.u.uSpin.value = 3.2;
  const merged = (t, a, b) => { const u = eIn(seg(t, T.merge, T.fuse)), ang = u * 7.5, rr = 1 - u; const ox = (a.x - P_MID.x), oy = (a.y - P_MID.y); return V(P_MID.x + (ox * Math.cos(ang) - oy * Math.sin(ang)) * rr, P_MID.y + (ox * Math.sin(ang) + oy * Math.cos(ang)) * rr, lerp(a.z, P_MID.z, u)); };
  orbBlue.pos = t => (t < T.merge ? P_BLUE : merged(t, P_BLUE));
  // 둘레의 빛 알갱이: 파랑은 원반처럼 감겨 듦 · 빨강은 바깥으로 튐 · 보라는 사방으로 번개처럼
  const NB = 520, pts = makePts(c, NB * 2, { soft: 0 }); def.ptsMesh = pts.mesh;
  const BP = Array.from({ length: NB }, () => ({ r: rnd(1.3, 4.2), a: rnd(0, 6.28), w: rnd(2.5, 6), y: rnd(-0.18, 0.18), s: rnd(3, 8), ph: rnd(0, 1) }));
  const RP = Array.from({ length: NB }, () => ({ d: V(rnd(-1, 1), rnd(-1, 1), rnd(-0.6, 0.6)).normalize(), sp: rnd(0.6, 1.6), ph: rnd(0, 1), s: rnd(3, 9) }));
  function orbs(t, dt, E) {
    const fuseU = seg(t, T.fuse - 0.05, T.fuse + 0.05);
    // 파랑
    const bA = sstep(seg(t, T.blue - 0.05, T.blue + 0.35)) * (1 - fuseU), pb = orbBlue.pos(t), br = OR * (0.5 + 0.7 * sstep(seg(t, T.blue, T.blue + 0.5)) + 0.55 * E.absorbed) * (1 + 0.06 * Math.sin(t * 23));
    orbBlue.g.position.copy(pb); orbBlue.a = bA; orbBlue.set(t, br, bA);
    // 빨강
    const rA = sstep(seg(t, T.red - 0.05, T.red + 0.3)) * (1 - fuseU), pr = t < T.merge ? P_RED : merged(t, P_RED), rr = OR * (0.45 + 0.75 * eBack(seg(t, T.red, T.red + 0.45), 2)) * (1 + 0.1 * Math.sin(t * 31));
    orbRed.g.position.copy(pr); orbRed.a = rA; orbRed.set(t, rr, rA);
    // 보라: 부딪힌 자리에서 커지고 → 화면 쪽으로 날아옴
    const pA = sstep(seg(t, T.fuse - 0.03, T.fuse + 0.12)) * (1 - seg(t, T.boom - 0.02, T.boom + 0.05));
    const fz = eIn(seg(t, T.fire, T.boom)), pp = P_MID.clone().lerp(V(0, -vh * 0.02, D * 0.86), fz);
    const pR = OR * (1.6 + 0.8 * eBack(seg(t, T.fuse, T.fuse + 0.45), 2.5)) * (1 + 0.07 * Math.sin(t * 41)) * (1 + 1.5 * fz);
    orbPur.g.position.copy(pp); orbPur.a = pA; orbPur.set(t, pR, pA);
    // 알갱이
    for (let i = 0; i < NB; i++) {
      const b = BP[i], j = i;
      if (bA > 0.01) { const a = b.a + t * b.w * (1.6 / b.r), r = br * b.r * (1 - 0.35 * fract(t * 0.6 + b.ph)); pts.set(j, pb.x + Math.cos(a) * r, pb.y + Math.sin(a) * r * 0.35 + b.y * br, pb.z + Math.sin(a) * r * 0.6, b.s, 0.55 * bA, 0.55, 0.78, 1); } else pts.hide(j);
      const q = RP[i], jj = NB + i;
      if (rA > 0.01) { const u = fract(t * q.sp + q.ph), r = rr * (1.1 + u * 4.5); pts.set(jj, pr.x + q.d.x * r, pr.y + q.d.y * r, pr.z + q.d.z * r, q.s * (1 - u * 0.6), 0.6 * rA * (1 - u), 1, 0.42, 0.3); }
      else if (pA > 0.01) { const u = fract(t * q.sp * 1.6 + q.ph), r = pR * (1.05 + u * 3.2); pts.set(jj, pp.x + q.d.x * r, pp.y + q.d.y * r, pp.z + q.d.z * r, q.s * 1.4 * (1 - u * 0.5), 0.7 * pA * (1 - u), 0.8, 0.55, 1); }
      else pts.hide(jj);
    }
    pts.upd();
  }
  const fract = x => x - Math.floor(x);
  // 시간이 멈추는 순간 화면 가운데서 퍼지는 빛 고리 두 겹
  const sRing = [0, 1].map(() => new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 160), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })));
  const SR_P = V(0, vh * 0.08, 60), diag = Math.hypot(vw, vh);
  // 번개: 화면과 나란한 띠 (몇 프레임마다 새로 꺾임)
  const NBOLT = 5, NSEG = 16, bPos = new Float32Array(NBOLT * NSEG * 2 * 3), bCol = new Float32Array(NBOLT * NSEG * 2 * 4), bIdx = [];
  for (let k = 0; k < NBOLT; k++) for (let j = 0; j < NSEG - 1; j++) { const a = (k * NSEG + j) * 2; bIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3)); bGeo.setAttribute("color", new THREE.BufferAttribute(bCol, 4)); bGeo.setIndex(bIdx);
  const bolts = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  let boltT = -1; const boltSeed = Array.from({ length: NBOLT }, () => []);
  function fxExtra(t) {
    sRing.forEach((m, i) => { const u = seg(t, T.stop + i * 0.08, T.stop + i * 0.08 + 0.7); m.visible = u > 0 && u < 1; m.position.copy(SR_P); m.scale.setScalar(Math.max(1, diag * 0.9 * eOut(u))); m.material.opacity = (1 - u) * (i ? 0.5 : 0.9); });
    // 번개: 두 구슬이 서로 돌며 다가갈 때는 둘 사이를, 보라색이 된 뒤엔 그 둘레에서 사방으로
    const m1 = seg(t, T.merge - 0.1, T.merge + 0.1) * (t < T.fuse ? 1 : 0), m2 = orbPur.a * (t < T.boom ? 1 : 0), on = Math.max(m1, m2);
    bolts.visible = on > 0.01; if (!bolts.visible) return;
    if (Math.floor(t * 22) !== boltT) { boltT = Math.floor(t * 22); boltSeed.forEach(b => { b.length = 0; for (let j = 0; j < NSEG; j++) b.push(rnd(-1, 1), rnd(-1, 1)); }); }
    const A = orbBlue.g.position, B = orbRed.g.position, P = orbPur.g.position, pr = orbPur.g.scale.x;
    for (let k = 0; k < NBOLT; k++) {
      let a, b; if (m1 > 0.01) { a = A; b = B; } else { const an = k * 1.257 + Math.floor(t * 7) * 0.9; a = P; b = V(P.x + Math.cos(an) * pr * 3.2, P.y + Math.sin(an) * pr * 3.2, P.z); }
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, sd = boltSeed[k];
      for (let j = 0; j < NSEG; j++) {
        const u = j / (NSEG - 1), amp = Math.sin(Math.PI * u) * L * 0.12, x = a.x + dx * u + nx * sd[j * 2] * amp, y = a.y + dy * u + ny * sd[j * 2] * amp, z = lerp(a.z, b.z, u) + 5, w = 2.2 + 1.5 * Math.sin(Math.PI * u);
        const i0 = (k * NSEG + j) * 2, al = on * (0.55 + 0.45 * sd[j * 2 + 1]) * (m1 > 0.01 ? 1 : 1 - u * 0.7);
        bPos.set([x + nx * w, y + ny * w, z, x - nx * w, y - ny * w, z], i0 * 3);
        bCol.set([0.85, 0.7, 1, al, 0.85, 0.7, 1, al], i0 * 4);
      }
    }
    bGeo.attributes.position.needsUpdate = bGeo.attributes.color.needsUpdate = true;
  }

  // ── 소리 ──
  let sn = null;
  const mkSound = get => {
    const S2 = synth(get);
    return {
      stop: () => S2.play((a, t) => { S2.ring(a, t, 1320, 0.22, 2.6); S2.ring(a, t + 0.03, 1980, 0.12, 2.2); S2.noise(a, t, "highpass", 6000, 3000, 0.7, 0.3, 0.002, 0.25); S2.tone(a, t, "sine", 880, 440, 0.2, 0.005, 0.6); }),
      hum: (k, d, f) => S2.play((a, t) => { S2.tone(a, t, k < 1 ? "sine" : "sawtooth", f, f * 2, 0.22 / k, 0.4, d); S2.tone(a, t, "sine", f * 1.5, f * 3, 0.1, 0.5, d); S2.noise(a, t, "bandpass", k < 1 ? 300 : 1400, k < 1 ? 900 : 3200, 3, 0.25, d * 0.7, d); }),
      beat: d => S2.play((a, t) => { S2.tone(a, t, "sine", 110, 220, 0.25, d * 0.8, d + 0.05); S2.tone(a, t, "sine", 113, 232, 0.25, d * 0.8, d + 0.05); S2.noise(a, t, "bandpass", 600, 4000, 1.5, 0.4, d * 0.9, d + 0.05); for (let i = 0; i < 22; i++) { const at = t + Math.pow(Math.random(), 0.7) * d; S2.noise(a, at, "highpass", rnd(3000, 7000), rnd(1500, 3000), 1, rnd(0.15, 0.35), 0.001, rnd(0.02, 0.06)); } }),
      fuse: () => S2.play((a, t) => { S2.tone(a, t, "sine", 70, 24, 1, 0.004, 1.8); S2.noise(a, t, "lowpass", 3000, 80, 0.7, 0.9, 0.004, 1.4); S2.ring(a, t, 233, 0.3, 3.5); S2.tone(a, t, "sawtooth", 330, 55, 0.12, 0.01, 1.2); }),
      fire: () => S2.play((a, t) => { S2.noise(a, t, "bandpass", 200, 5000, 0.8, 0.9, 0.35, 0.5); S2.tone(a, t, "sawtooth", 60, 240, 0.25, 0.3, 0.45); S2.tone(a, t + 0.42, "sine", 50, 20, 1, 0.004, 1.6); S2.noise(a, t + 0.42, "lowpass", 2500, 60, 0.7, 1, 0.004, 1.6); }),
    };
  };

  api = domainBase(c, def);
  [orbBlue.g, orbRed.g, orbPur.g, pts.mesh, bolts, ...sRing].forEach(api.E.add);
  const start0 = api.start;
  api.start = o => { sn = mkSound(o.sfx); [orbBlue.g, orbRed.g, orbPur.g, pts.mesh].forEach(m => (m.visible = true)); start0(o); };
  return api;
}
