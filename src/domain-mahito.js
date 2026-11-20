// 영역전개 · 마히토: 자폐원돈과(自閉圓頓裹)
// 두 손을 오목하게 오므려 인을 맺음 → 꿰맨 자국투성이 살갗 같은 공간이 번짐(솔기가 청록으로 숨 쉬듯 빛남)
// → 바닥의 쇠 파편이 영혼처럼 빨려 올라가 하늘만 한 "거대한 손"으로 빚어짐(청록 영혼 빛이 손 모양을 따라 맺힘)
// → 거대한 손가락이 살아 있는 것처럼 꿈틀 → 화면(보는 사람) 쪽으로 확 덮쳐 오며 움켜쥠 → 손아귀 속 어둠, 손가락 틈으로 새는 청록 빛
// → 세 번 꽉꽉 으스러뜨림 → 손아귀가 안쪽에서 터지며 파편이 사방으로 날아감 → 걷힘
import * as THREE from "three";
import { domainBase, placeHand, tremble, fg, POSE, Q, key2, makePts, synth, clamp, lerp, rnd, seg, sstep, eOut, eIn, eInOut, eBack, V } from "./domain-kit.js";
import { radialTex, buzz } from "./fx-util.js";

const T = { seal: 1.0 };
T.text = T.seal + 0.14;
T.form = T.seal + 0.55;      // 파편이 거대한 손으로 빚어짐
T.alive = T.form + 1.75;     // 손가락이 꿈틀
T.lunge = T.alive + 0.95;    // 화면 쪽으로 덮침
T.grab = T.lunge + 0.62;     // 움켜쥠 (손아귀 속)
T.sq = [T.grab + 0.35, T.grab + 0.75, T.grab + 1.1];   // 꽉꽉 으스러뜨림
T.burst = T.grab + 1.5;      // 터짐
T.boom = T.burst + 0.12;
T.retract = T.burst + 0.95;
T.end = T.retract + 0.95;
T.toff = T.alive - 0.2;

const CUP = { index: fg(-0.42, -0.5, -0.38, 0.06), middle: fg(-0.4, -0.5, -0.38, 0), ring: fg(-0.42, -0.52, -0.38, -0.05), pinky: fg(-0.46, -0.52, -0.38, -0.12), thumb: [[0.45, -0.25, 0], [-0.35, 0, 0], [-0.35, 0, 0]] };
// 거대한 손 자세: 쫙 편 손 · 반쯤 굽힌 손(덮칠 때) · 주먹
const G_OPEN = { index: fg(0.1, 0.05, 0, 0.26), middle: fg(0.08, 0.05, 0, 0.07), ring: fg(0.08, 0.05, 0, -0.12), pinky: fg(0.08, 0.05, 0, -0.3), thumb: [[0.35, -0.45, 0], [0.1, 0, 0], [0.1, 0, 0]] };
const G_HALF = { index: fg(-0.55, -0.7, -0.45, 0.12), middle: fg(-0.6, -0.72, -0.45, 0.03), ring: fg(-0.62, -0.74, -0.45, -0.06), pinky: fg(-0.66, -0.74, -0.45, -0.14), thumb: [[0.1, -0.25, 0], [-0.3, 0, 0], [-0.35, 0, 0]] };
const G_FIST = { index: fg(-1.45, -1.7, -1.05), middle: fg(-1.5, -1.75, -1.1), ring: fg(-1.55, -1.75, -1.1), pinky: fg(-1.6, -1.7, -1.05), thumb: [[-0.5, 0.45, 0], [-0.6, 0, 0], [-0.6, 0, 0]] };

const BODY = `
vec2 hh2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec3 body(vec2 p){
  vec2 q = p / uRes.y * 4.2;
  q += vec2(sin(uT * 0.45 + q.y * 0.9), cos(uT * 0.37 + q.x * 0.8)) * (0.1 + 0.12 * uPulse);   // 숨 쉬듯 일렁임
  vec2 ip = floor(q), fp = fract(q); float F1 = 8.0, F2 = 8.0; vec2 cid = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)), r = o + hh2(ip + o) * 0.85 - fp; float dd = dot(r, r);
    if (dd < F1) { F2 = F1; F1 = dd; cid = ip + o; } else if (dd < F2) F2 = dd;
  }
  float e = sqrt(F2) - sqrt(F1), hc = h21(cid);
  vec3 col = mix(vec3(0.075, 0.062, 0.078), vec3(0.13, 0.1, 0.12), hc) * (0.6 + 0.7 * fbm(q * 1.7 + cid * 3.1));
  col = mix(col, vec3(0.1, 0.12, 0.13), step(0.8, hc) * 0.6);
  // 솔기: 꺼진 홈 + 청록 빛 + 가로지르는 바늘땀
  col *= 1.0 - smoothstep(0.08, 0.0, e) * 0.85;
  col += vec3(0.12, 0.95, 0.72) * smoothstep(0.035, 0.0, e) * (0.35 + 0.35 * sin(uT * 2.2 + hc * 25.0)) * uGlow;
  float dash = step(0.62, fract((q.x * 0.71 + q.y * 0.71) * 6.5 + hc)), band = smoothstep(0.13, 0.09, e) * smoothstep(0.015, 0.04, e);
  col = mix(col, vec3(0.62, 0.6, 0.58), dash * band * 0.85);
  // 가운데 영혼 빛
  vec2 cq = (p - uC) / uRes.y; col += vec3(0.08, 0.75, 0.58) * exp(-dot(cq, cq) / 0.03) * uCore + vec3(0.6, 1.0, 0.9) * uFlash;
  vec2 vq = (p / uRes - 0.5) * vec2(1.2, 0.9); col *= 1.0 - 0.55 * dot(vq, vq) * 2.0;
  return col;
}`;

export function buildMahito(c) {
  const { vw, vh, D, S, K, FLOOR, R, L, PALM_Z, cam } = c;
  const glowTex = radialTex([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,.5)"], [0.6, "rgba(255,255,255,.12)"], [1, "rgba(255,255,255,0)"]]);
  const bgU = { uC: { value: new THREE.Vector2(vw / 2, vh / 2), glsl: "vec2" }, uPulse: { value: 0, glsl: "float" }, uGlow: { value: 0, glsl: "float" }, uCore: { value: 0, glsl: "float" }, uFlash: { value: 0, glsl: "float" } };
  const HS = 0.72;

  // ── 거대한 손의 겉면 점: 손 모델을 세 자세로 굽혀 보고 같은 꼭짓점 자리를 손 좌표로 받아 둠 ──
  const NS = 4200, mesh = R.H.mesh, nv = mesh.geometry.attributes.position.count;
  const VI = Array.from({ length: NS }, () => (Math.random() * nv) | 0);
  const poses = [G_OPEN, G_HALF, G_FIST].map(P => {
    for (const n in P) R.H.setChain(n, P[n]);
    R.root.updateMatrixWorld(true);
    const inv = R.root.matrixWorld.clone().invert(), out = new Float32Array(NS * 3), v = V();
    VI.forEach((vi, i) => { mesh.getVertexPosition(vi, v); v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); out.set([v.x, v.y, v.z], i * 3); });
    return out;
  });
  // 손 크기: 편 손의 위아래 길이 · 손목 높이
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < NS; i++) { const y = poses[0][i * 3 + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const HL = y1 - y0;
  // 놓는 자리: 멀리 뒤에서 아래로부터 솟아 화면을 거의 채움 → 덮칠 땐 카메라 바로 앞까지
  const ZG = -D * 0.5, SG = (vh * 1.05 * (D * 1.0 - ZG) / D) / HL;
  const G0 = { p: V(0, -vh * 1.6, ZG), q: Q(0.05, 0, 0) }, G1 = { p: V(0, -vh * 0.05 - (y0 + HL * 0.42) * SG, ZG), q: Q(0.05, 0, 0) };
  const G2 = { p: V(0, -(y0 + HL * 0.4) * SG * 0.55, D * 0.42), q: Q(-0.25, 0, 0.1) };
  const gm = new THREE.Matrix4(), gp = V(), gq = new THREE.Quaternion(), gs = V();
  function giant(t) {
    const rise = eOut(seg(t, T.form - 0.2, T.form + 1.2)), lu = eIn(seg(t, T.lunge, T.grab));
    gp.copy(G0.p).lerp(G1.p, rise).lerp(G2.p, lu); gq.copy(G0.q).slerp(G1.q, rise).slerp(G2.q, lu);
    // 살아 있는 듯 천천히 흔들림 · 덮치기 직전 뒤로 움츠림
    gp.x += Math.sin(t * 0.9) * vw * 0.02 * rise; gp.y += Math.sin(t * 1.3) * vh * 0.012 * rise;
    gp.z -= D * 0.1 * Math.sin(Math.PI * seg(t, T.lunge - 0.35, T.lunge + 0.1));
    if (t > T.grab) { const sq = sqK(t); gp.z -= 12 * sq; }
    gm.compose(gp, gq, gs.setScalar(SG * (1 + 0.04 * sqK(t))));
  }
  const sqK = t => T.sq.reduce((m, p) => Math.max(m, Math.sin(Math.PI * seg(t, p - 0.08, p + 0.22)) ** 2), 0);
  // 굽힘 정도 (0 편 손 → 1 반쯤 → 2 주먹). 꿈틀거릴 땐 손가락마다(가로 위치) 다른 박자
  const curlAt = (t, lx) => {
    const wig = (t > T.alive ? 0.45 * sstep(seg(t, T.alive, T.alive + 0.3)) * (0.5 + 0.5 * Math.sin(t * 7 + lx * 9)) : 0) * (1 - seg(t, T.lunge - 0.3, T.lunge));
    return wig + eInOut(seg(t, T.lunge - 0.35, T.lunge + 0.15)) * 0.6 + eIn(seg(t, T.lunge + 0.15, T.grab)) * 1.4;
  };
  const hv = V();
  function handPt(i, t, out) {
    const lx = poses[0][i * 3] / (HL * 0.5), cu = Math.min(2, curlAt(t, lx)), a = cu < 1 ? 0 : 1, b = a + 1, u = cu - a;
    const A = poses[a], B = poses[b];
    out.set(A[i * 3] + (B[i * 3] - A[i * 3]) * u, A[i * 3 + 1] + (B[i * 3 + 1] - A[i * 3 + 1]) * u, A[i * 3 + 2] + (B[i * 3 + 2] - A[i * 3 + 2]) * u);
    return out.applyMatrix4(gm);
  }

  // 영혼 빛 알갱이: 손 겉면에 맺힘 → 터질 때 같이 흩어짐
  const NP = 900, pts = makePts(c, NP, { soft: 0.1 });
  const PP = Array.from({ length: NP }, (_, i) => ({ si: (i * 4.67 | 0) % NS, ph: rnd(0, 6.28), s: rnd(5, 14), d: V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), sp: rnd(0.6, 1.6) }));
  // 손아귀 속: 새까만 어둠 + 손가락 틈으로 새는 청록 빛 (화면 위에 덮는 캔버스)
  let fistEl = null, seamEl = null;
  const mkFist = () => {
    const W = Math.round(vw), H = Math.round(vh), mk = () => { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; Object.assign(cv.style, { position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", pointerEvents: "none" }); return cv; };
    fistEl = mk(); seamEl = mk(); seamEl.style.mixBlendMode = "screen";
    let x = fistEl.getContext("2d"); const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, "#07100e"); g.addColorStop(1, "#000"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x = seamEl.getContext("2d"); x.lineCap = "round";
    // 손가락 사이 틈: 가운데가 넓고 양끝이 가늘어지는 휜 빛줄기 (흐린 번짐 + 밝은 심)
    const seam = (y, bend, wd, x0, x1) => {
      const P = []; for (let i = 0; i <= 40; i++) { const u = i / 40, px = lerp(x0, x1, u); P.push([px, y + bend * Math.sin(Math.PI * u) + rnd(-2, 2), Math.pow(Math.sin(Math.PI * u), 0.7)]); }
      for (const [blur, lw, col] of [[30, wd * 30, "rgba(30,255,180,.5)"], [10, wd * 9, "rgba(70,255,205,.75)"], [0, wd * 2.6, "rgba(215,255,245,1)"]]) {
        x.filter = blur ? `blur(${blur}px)` : "none"; x.strokeStyle = col;
        for (let i = 1; i < P.length; i++) { x.lineWidth = Math.max(0.5, lw * P[i][2]); x.beginPath(); x.moveTo(P[i - 1][0], P[i - 1][1]); x.lineTo(P[i][0], P[i][1]); x.stroke(); }
      }
      x.filter = "none";
    };
    x.save(); x.translate(W / 2, H / 2); x.rotate(-0.14); x.translate(-W / 2, -H / 2);
    seam(H * 0.2, -H * 0.16, 1.3, -W * 0.08, W * 0.84); seam(H * 0.42, -H * 0.13, 2.0, -W * 0.08, W * 0.9); seam(H * 0.64, -H * 0.1, 1.7, -W * 0.08, W * 0.88);
    seam(H * 0.86, -H * 0.07, 1.0, W * 0.02, W * 0.78); x.restore();
    // 엄지와 검지 사이 (세로로 휜 틈)
    x.save(); x.translate(W * 0.86, H * 0.5); x.rotate(1.35); x.translate(-W * 0.86, -H * 0.5); seam(H * 0.5, H * 0.06, 2.2, W * 0.86 - H * 0.45, W * 0.86 + H * 0.45); x.restore();
  };
  mkFist();   // 미리 그려 둠 (시작 순간 멈칫하지 않게)

  const pv = V(), cw = V();
  const def = {
    key: "mahito", T, bg: { body: BODY, u: bgU, rim: 0x5dffd0 },
    init(par) {
      par.forEach((q, i) => {
        q.si = (i * 1.31 | 0) % NS;
        // 손목 쪽부터 손끝 쪽으로 차례로 쌓임
        const ly = (poses[0][q.si * 3 + 1] - y0) / HL;
        q.tg = T.form + ly * 1.0 + rnd(0, 0.35); q.dg = rnd(0.5, 0.8); q.arc = rnd(-0.3, 0.3) * vw;
        q.bv = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.5, 1.4) * vw); q.wx = rnd(-14, 14); q.wy = rnd(-14, 14);
        q.k = rnd(1.6, 2.6);   // 거대한 손에선 파편을 크게
      });
      grabC = null;
    },
    update(t, dt, E) {
      hands(t); giant(t);
      // 터지는 순간 카메라 자리 (손아귀 한가운데)
      if (t >= T.burst && !grabC) grabC = cam.position.clone();
      for (let i = 0; i < E.N; i++) {
        const q = E.par[i];
        let x = q.x, y = q.y, z = q.z, rx = q.rx, ry = q.ry, rz = q.rz, k = 1;
        if (t >= T.burst) {   // 손아귀가 안쪽에서 터짐: 카메라에서 멀어지는 쪽으로 사방
          const tb = T.burst, a = t - tb; handPt(q.si, tb, pv);
          const away = pv.clone().sub(grabC); const dl = away.length() || 1; away.multiplyScalar(1 / dl);
          pv.addScaledVector(away, a * (vw * 1.6 + q.bv.length() * 0.6)).addScaledVector(q.bv, a * 0.35); pv.y -= 220 * a * a;
          x = pv.x; y = pv.y; z = pv.z; rx += q.wx * a; ry += q.wy * a; k = q.k * (1 - seg(a, 0.6, 1.0));
        } else {
          const u = seg(t, q.tg, q.tg + q.dg);
          if (u > 0) {
            handPt(q.si, t, pv); const e = eInOut(u);
            x = lerp(x, pv.x, e) + Math.sin(Math.PI * u) * q.arc; y = lerp(y, pv.y, e); z = lerp(z, pv.z, e);
            rx += 5 * e + t * 0.4; ry += 3 * e; k = lerp(1, q.k, e);
          } else { const w = seg(t, T.seal, q.tg); y += Math.sin(t * 17 + i) * 3 * w; }
        }
        E.setFrag(i, x, y, z, rx, ry, rz, q.s, k);
      }
      // 영혼 빛 알갱이
      const form = sstep(seg(t, T.form + 0.3, T.alive));
      for (let i = 0; i < NP; i++) {
        const p = PP[i];
        if (t >= T.burst) { const a = t - T.burst; handPt(p.si, T.burst, pv); const away = pv.clone().sub(grabC).normalize(); pv.addScaledVector(away, a * vw * 2 * p.sp).addScaledVector(p.d, a * vw * 0.4); pts.set(i, pv.x, pv.y, pv.z, p.s * 1.4, 0.9 * (1 - seg(a, 0.3, 0.9)), 0.3, 1, 0.78); }
        else if (form > 0.01 && t < T.grab) { handPt(p.si, t, pv); pts.set(i, pv.x, pv.y, pv.z, p.s, 0.45 * form * (0.45 + 0.55 * Math.sin(t * 3 + p.ph)), 0.3, 1, 0.8); }
        else pts.hide(i);
      }
      pts.upd();
      // 손아귀 속 어둠
      if (fistEl) {
        const cl = sstep(seg(t, T.grab - 0.12, T.grab + 0.02)) * (1 - sstep(seg(t, T.burst - 0.02, T.burst + 0.1)));
        fistEl.style.opacity = cl.toFixed(3);
        seamEl.style.opacity = (cl * (1 - 0.55 * sqK(t) + 0.08 * Math.sin(t * 13))).toFixed(3);   // 꽉 쥘 때 틈이 좁아져 어두워짐
        seamEl.style.transform = `scale(${1 - 0.04 * sqK(t)}, ${1 - 0.12 * sqK(t)})`;
      }
    },
    light(t, E) {
      const { dir, p1, p2 } = E.L, dk = E.dk, form = sstep(seg(t, T.form + 0.3, T.alive));
      dir.color.setRGB(0.4, 1, 0.8); dir.intensity = 2.6 * dk;
      p1.color.setRGB(0.25, 1, 0.75); giant(t); p1.position.set(0, 0, 0).applyMatrix4(gm).add(V(0, 0, 200)); p1.intensity = dk * (1.5 + 3 * form);
      p2.color.setRGB(0.6, 0.3, 0.9); p2.position.set(0, -vh * 0.4, 260); p2.intensity = 1.6 * dk;
      bgU.uGlow.value = sstep(seg(t, T.seal, T.seal + 0.8)); bgU.uPulse.value = 0.6 * form + 2 * seg(t, T.alive, T.lunge) * (1 - seg(t, T.burst, T.retract));
      bgU.uC.value.set(vw / 2, vh * 0.5); bgU.uCore.value = 0.5 * form * (1 - seg(t, T.lunge, T.grab));
      bgU.uFlash.value = Math.max(0, 1 - Math.abs(t - T.burst - 0.04) / 0.28) * 0.9;
    },
    beats(t, E) {
      const { snd } = E.ctx;
      if (t >= T.form) E.once("f", () => { snd.whoosh(1.6); sn.goo(1.8); buzz(2); });
      if (t >= T.alive) E.once("al", () => sn.creak(T.lunge - T.alive));
      if (t >= T.lunge - 0.3) E.once("lu", () => { sn.roar(); snd.whoosh(0.8); });
      if (t >= T.grab) E.once("grab", () => { sn.grab(); buzz([3, 40, 3, 80, 3]); E.shake = 30; E.freeze = 0.08; });
      T.sq.forEach((p, i) => { if (t >= p) E.once("sq" + i, () => { sn.squish(1 + i * 0.35); buzz(i === 2 ? [3, 50, 3] : 3); E.shake = 10 + i * 6; }); });
      if (t >= T.burst) E.once("burst", () => { sn.burst(); snd.shatter(); buzz([3, 30, 3, 30, 3]); E.shake = 26; E.freeze = 0.06; E.invert(); });
    },
    cam(t, E) {
      const { cp, cl } = E;
      const k2 = eInOut(seg(t, T.form, T.alive)); cp.lerp(V(0, -vh * 0.06, D * 1.05), k2); cl.lerp(V(0, vh * 0.1, 0), k2);
      const k3 = eInOut(seg(t, T.alive, T.lunge)); cp.lerp(V(0, -vh * 0.04, D * 1.1), k3); cl.lerp(V(0, vh * 0.12, 0), k3);
      const k4 = eIn(seg(t, T.lunge, T.grab)); cl.lerp(V(0, vh * 0.02, 0), k4); cp.z -= D * 0.05 * k4;
      E.amp = 2 * seg(t, T.form, T.alive) + 5 * seg(t, T.lunge, T.grab) * (1 - seg(t, T.burst, T.retract)) + 3 * sqK(t);
    },
  };
  let grabC = null;

  // ── 내 손: 오목한 인 → 줄 인형을 놀리듯 양옆에서 손가락을 놀림 → 덮쳐 오면 막듯이 손바닥을 앞으로 → 터지면 휙 ──
  const Q_FACE = Q(0, Math.PI / 2, 0);
  // 손가락 방향(f)과 손바닥이 보는 쪽(n)으로 손 회전 만들기 (엄지 = f × n)
  const qBasis = (f, n) => { f = f.clone().normalize(); n = n.clone().addScaledVector(f, -n.dot(f)).normalize(); const xA = V().crossVectors(f, n); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, f, n)); };
  const side = (gap, y, z, tilt = 0.08, psi = 0.32) => { const qc = Q(tilt, psi, 0); return key2(V(-(gap / 2 + PALM_Z * HS), 0, 0).applyQuaternion(qc).add(V(0, y, z)), qc.multiply(Q_FACE), [0.5, 0.3]); };
  const KS = {
    start: key2(V(-vw * 0.55, -vh / 2 - S * 2.3, 60), Q(0.7, 0.6, -0.6)),
    ready: side(S * 1.0, -vh * 0.06, 110),
    sign: side(S * 0.52, -vh * 0.06, 110),
    puppet: key2(V(-vw * 0.26, -vh * 0.2, 170), qBasis(V(0.25, 0.3, -0.92), V(0.05, -1, -0.3)), [0.25, 0.05]),
    guard: key2(V(-S * 1.0, -vh * 0.16, 230), Q(-0.3, 0.3, 0.1), [0.1, 0]),
    exit: key2(V(-vw * 0.5, -vh / 2 - S * 2.5, 160), Q(0.6, 0.5, -0.3)),
  };
  function hands(t) {
    for (const [rg, sd] of [[R, 1], [L, -1]]) {
      placeHand(rg, KS, [["ready", eBack(seg(t, 0.05, 0.72), 1.1)], ["sign", eIn(seg(t, T.seal - 0.13, T.seal))], ["puppet", eInOut(seg(t, T.form - 0.1, T.form + 0.4))], ["guard", eOut(seg(t, T.lunge - 0.1, T.lunge + 0.25))], ["exit", eIn(seg(t, T.grab - 0.15, T.grab + 0.05))]],
        [[POSE.claw, sstep(seg(t, 0.3, 0.85))], [CUP, eIn(seg(t, T.seal - 0.13, T.seal))], [POSE.claw, eOut(seg(t, T.form - 0.1, T.form + 0.3))], [POSE.spread, eOut(seg(t, T.lunge - 0.1, T.lunge + 0.15))], [POSE.relax, sstep(seg(t, T.burst + 0.3, T.retract))]],
        HS, (xf, pose) => {
          const rs = t - T.seal; if (rs > 0 && rs < 1.2) { const a = Math.exp(-rs * 6) * Math.sin(rs * 34); xf.p.y -= S * 0.04 * a; xf.p.z -= 14 * a; }
          // 줄 인형 놀리기: 손가락을 번갈아 까딱
          const pu = sstep(seg(t, T.form, T.form + 0.4)) * (1 - seg(t, T.lunge - 0.2, T.lunge));
          if (pu > 0) { ["index", "middle", "ring", "pinky"].forEach((n, j) => { const w = Math.sin(t * 6 + j * 1.3 + sd) * 0.35 * pu; pose[n][1][0] += w; pose[n][2][0] += w * 0.8; }); xf.p.y += Math.sin(t * 2.2 + sd) * 8 * pu; }
          tremble(xf, t, sd, (t > T.seal && t < T.form ? 0.5 : 0) + 1.6 * seg(t, T.lunge, T.grab) * (t < T.grab ? 1 : 0));
        });
    }
  }

  let sn = null;
  const mkSound = get => {
    const S2 = synth(get);
    return {
      goo: d => S2.play((a, t) => { for (let i = 0; i < 18; i++) { const at = t + Math.random() * d, f = rnd(90, 260); S2.tone(a, at, "sine", f, f * rnd(0.4, 0.7), 0.14, 0.01, rnd(0.12, 0.3)); } S2.noise(a, t, "lowpass", 300, 900, 1, 0.25, d * 0.5, d); for (let i = 0; i < 26; i++) { const at = t + Math.random() * d, f = rnd(2500, 7000); S2.tone(a, at, "sine", f, f * 0.99, 0.03, 0.001, 0.06); } }),
      creak: d => S2.play((a, t) => { for (let i = 0; i < 9; i++) { const at = t + i * d / 9; S2.tone(a, at, "sawtooth", rnd(60, 90), rnd(40, 55), 0.12, 0.05, 0.3); S2.noise(a, at, "bandpass", rnd(300, 600), 200, 3, 0.2, 0.03, 0.25); } }),
      roar: () => S2.play((a, t) => { S2.noise(a, t, "lowpass", 200, 1400, 0.8, 0.8, 0.45, 0.75); S2.tone(a, t, "sawtooth", 45, 90, 0.25, 0.4, 0.7); S2.noise(a, t, "bandpass", 500, 2500, 1, 0.4, 0.5, 0.7); }),
      grab: () => S2.play((a, t) => { S2.tone(a, t, "sine", 70, 28, 1, 0.003, 1.2); S2.noise(a, t, "lowpass", 2500, 80, 0.7, 1, 0.003, 0.9); for (let i = 0; i < 30; i++) { const f = rnd(2000, 7000); S2.tone(a, t + Math.random() * 0.25, "sine", f, f * 0.99, 0.05, 0.001, 0.08); } }),
      squish: k => S2.play((a, t) => { S2.tone(a, t, "sine", 120 * k, 40, 0.8, 0.01, 0.4); S2.noise(a, t, "bandpass", 600, 150, 2, 0.6, 0.02, 0.45); S2.noise(a, t, "lowpass", 1800, 120, 0.7, 0.5, 0.005, 0.3); for (let i = 0; i < 10; i++) { const f = rnd(1500, 5000); S2.tone(a, t + Math.random() * 0.15, "sine", f, f * 0.98, 0.05, 0.001, 0.07); } }),
      burst: () => S2.play((a, t) => { S2.tone(a, t, "sine", 60, 22, 1, 0.003, 1.6); S2.noise(a, t, "lowpass", 3500, 70, 0.7, 1, 0.003, 1.5); S2.ring(a, t, 311, 0.3, 2.6); S2.noise(a, t, "highpass", 5000, 2500, 0.7, 0.5, 0.002, 0.2); }),
    };
  };

  const api = domainBase(c, def);
  api.E.add(pts.mesh);
  const start0 = api.start;
  api.start = o => { sn = mkSound(o.sfx); pts.mesh.visible = true; fistEl.style.opacity = seamEl.style.opacity = "0"; o.ui.append(fistEl, seamEl); start0(o); };
  return api;
}
