// ── 거대한 발: 그림(워커 + 청바지) · 그림자 · 밑창 자국 · 금 ──
// 단위: 밑창 길이 = 1. 원점은 밑창 가운데, +y가 발끝(화면 아래), 오른발 기준(엄지 쪽이 +x). 왼발은 좌우로 뒤집어 그림.
// 위에서 내려다본 모습이라 다리는 화면 위쪽으로 뻗어 나가고, 발뒤꿈치는 바짓단에 가려짐.
const rnd = (a, b) => a + Math.random() * (b - a);

// 밑창 둘레 (뒤꿈치 → 엄지 쪽 → 발끝 → 새끼발가락 쪽)
const PER = [[0, -0.5], [0.07, -0.49], [0.118, -0.455], [0.136, -0.4], [0.138, -0.32], [0.128, -0.24], [0.106, -0.15], [0.112, -0.06], [0.14, 0.04], [0.166, 0.15],
  [0.172, 0.25], [0.16, 0.34], [0.128, 0.415], [0.08, 0.468], [0.028, 0.496], [-0.012, 0.502], [-0.052, 0.493], [-0.096, 0.466], [-0.13, 0.418], [-0.153, 0.35],
  [-0.165, 0.26], [-0.165, 0.16], [-0.155, 0.06], [-0.142, -0.05], [-0.135, -0.15], [-0.134, -0.25], [-0.136, -0.34], [-0.13, -0.41], [-0.11, -0.46], [-0.066, -0.49]];
export function outline(n = 8) {
  const P = PER, N = P.length, out = [];
  for (let i = 0; i < N; i++) {
    const a = P[(i - 1 + N) % N], b = P[i], c = P[(i + 1) % N], d = P[(i + 2) % N];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, f = j => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  return out;
}
// 안쪽으로 d만큼 들인 둘레
export function inset(O, d) {
  const N = O.length, out = [];
  for (let i = 0; i < N; i++) {
    const a = O[(i - 1 + N) % N], c = O[(i + 1) % N], tx = c[0] - a[0], ty = c[1] - a[1], n = Math.hypot(tx, ty) || 1;
    let nx = ty / n, ny = -tx / n;
    if (nx * -O[i][0] + ny * -O[i][1] < 0) { nx = -nx; ny = -ny; }
    out.push([O[i][0] + nx * d, O[i][1] + ny * d]);
  }
  return out;
}
const path = (x, P) => { x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) x.lineTo(P[i][0], P[i][1]); x.closePath(); };
export function inPoly(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// ── 질감 ──
function noiseCv(n, fn) {
  const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d"), im = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const [r, g, b, a] = fn(i % n, (i / n) | 0); im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = a; }
  x.putImageData(im, 0, 0); return c;
}
// 데님 능직: 비스듬한 실 + 굵기가 고르지 않은 세로 실(슬럽) + 잔 알갱이
function denimCv() {
  const n = 96, slub = Array.from({ length: n }, () => Math.random());
  return noiseCv(n, (u, v) => {
    const tw = (u * 2 + v) % 6, line = tw < 2 ? 1 : tw < 3 ? 0.4 : 0, s = slub[u] > 0.86 ? 0.5 : 0, r = Math.random();
    const a = Math.min(255, (line * 0.55 + s * 0.45 + r * 0.4) * 70);
    return [235, 240, 255, a];
  });
}
function grainCv() { return noiseCv(64, () => { const r = Math.random(); return r < 0.5 ? [0, 0, 0, r * 70] : [255, 240, 220, (r - 0.5) * 40]; }); }
function pat(x, cv, U, rot) {
  const p = x.createPattern(cv, "repeat");
  try { let M = new DOMMatrix(); if (rot) M = M.rotate(rot); p.setTransform(M.scale(1 / U)); } catch (e) {}
  return p;
}

// ── 워커 + 청바지 ──
// U: 그림에서 밑창 길이 1이 몇 px인지 · leg: 발 위로 뻗은 다리 길이(밑창 길이 배수)
export function bootSprite(U, leg) {
  const X0 = -0.34, X1 = 0.34, Y0 = -0.5 - leg, Y1 = 0.53;
  const cv = document.createElement("canvas"); cv.width = Math.ceil((X1 - X0) * U); cv.height = Math.ceil((Y1 - Y0) * U);
  const x = cv.getContext("2d");
  x.setTransform(U, 0, 0, U, -X0 * U, -Y0 * U);
  const O = outline(10), I = inset(O, 0.026), Iw = inset(O, 0.0135);
  const G = grainCv(), D = denimCv();

  // 밑창 테두리(고무): 왼쪽 위에서 오는 빛
  path(x, O);
  let g = x.createLinearGradient(-0.18, -0.2, 0.18, 0.3); g.addColorStop(0, "#5a4a3e"); g.addColorStop(0.45, "#3a2e26"); g.addColorStop(1, "#1d1713");
  x.fillStyle = g; x.fill();
  x.save(); path(x, O); x.clip();
  x.lineWidth = 0.012; x.strokeStyle = "rgba(255,240,220,.16)"; path(x, inset(O, 0.004)); x.stroke();
  // 웰트(가죽 테) + 박음질
  x.lineWidth = 0.011; x.strokeStyle = "#6e4a2a"; path(x, Iw); x.stroke();
  x.setLineDash([0.0085, 0.0055]); x.lineWidth = 0.0034; x.strokeStyle = "rgba(0,0,0,.45)"; x.save(); x.translate(0.0012, 0.0016); path(x, Iw); x.stroke(); x.restore();
  x.strokeStyle = "#e3c08a"; path(x, Iw); x.stroke(); x.setLineDash([]);
  x.restore();

  // 갑피(누벅 가죽): 볼록한 덩어리처럼 가운데 밝고 가장자리 어둡게
  x.save(); path(x, I); x.clip();
  g = x.createRadialGradient(-0.06, 0.16, 0.02, 0.0, 0.1, 0.42);
  g.addColorStop(0, "#e2ab66"); g.addColorStop(0.35, "#c98e4a"); g.addColorStop(0.7, "#a06a30"); g.addColorStop(1, "#6e4419");
  x.fillStyle = g; x.fillRect(-0.3, -0.6, 0.6, 1.2);
  x.globalCompositeOperation = "multiply"; x.fillStyle = pat(x, G, U); x.globalAlpha = 0.9; x.fillRect(-0.3, -0.6, 0.6, 1.2);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  // 가장자리 그늘(밑창에 닿는 곳)
  x.lineWidth = 0.07; x.strokeStyle = "rgba(60,30,8,.32)"; path(x, I); x.stroke();
  x.lineWidth = 0.024; x.strokeStyle = "rgba(50,24,6,.4)"; path(x, I); x.stroke();
  // 발등 쪽 오른편은 빛을 덜 받음
  g = x.createLinearGradient(-0.17, 0, 0.17, 0); g.addColorStop(0, "rgba(255,230,190,.14)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(40,18,0,.28)");
  x.fillStyle = g; x.fillRect(-0.3, -0.6, 0.6, 1.2);
  // 앞코 광택
  g = x.createRadialGradient(-0.05, 0.37, 0, -0.05, 0.37, 0.13); g.addColorStop(0, "rgba(255,236,200,.42)"); g.addColorStop(1, "rgba(255,236,200,0)");
  x.fillStyle = g; x.fillRect(-0.3, 0.1, 0.6, 0.5);
  x.save(); x.translate(-0.06, 0.39); x.rotate(-0.5); x.scale(1, 0.45);
  g = x.createRadialGradient(0, 0, 0, 0, 0, 0.045); g.addColorStop(0, "rgba(255,248,232,.5)"); g.addColorStop(1, "rgba(255,248,232,0)");
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 0.045, 0, 7); x.fill(); x.restore();

  // 걸을 때 접히는 주름(옆면) · 앞코 닳은 자국 · 밑창 가까이 묻은 때
  const crease = (pts, a) => {
    x.lineCap = "round"; x.lineWidth = 0.007; x.strokeStyle = `rgba(70,36,8,${0.4 * a})`;
    x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
    x.lineWidth = 0.004; x.strokeStyle = `rgba(255,228,185,${0.3 * a})`;
    x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px - 0.003, py - 0.005) : x.moveTo(px - 0.003, py - 0.005))); x.stroke();
  };
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const y = 0.02 + i * 0.03 + rnd(-0.008, 0.008), x0 = s * (0.075 + rnd(0, 0.01)), x1 = s * (0.13 + rnd(0, 0.02));
    crease([[x0, y], [(x0 + x1) / 2, y + rnd(0.01, 0.02)], [x1, y + rnd(0.0, 0.03)]], 1 - i * 0.18);
  }
  for (let i = 0; i < 14; i++) {
    const cx = rnd(-0.12, 0.12), cy = rnd(0.28, 0.46), r = rnd(0.008, 0.026);
    g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(240,205,160,${rnd(0.12, 0.3)})`); g.addColorStop(1, "rgba(240,205,160,0)");
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  x.lineWidth = 0.03; x.strokeStyle = "rgba(70,52,36,.22)"; path(x, inset(O, 0.03)); x.stroke();

  // 앞코 덧댄 가죽 이음새 (발등 쪽으로 볼록) + 두 줄 박음질
  const cap = (o) => { x.beginPath(); x.moveTo(-0.17, 0.262 + o); x.bezierCurveTo(-0.11, 0.17 + o, 0.1, 0.165 + o, 0.18, 0.255 + o); };
  x.lineWidth = 0.011; x.strokeStyle = "rgba(55,26,6,.5)"; cap(0.004); x.stroke();
  x.lineWidth = 0.004; x.strokeStyle = "rgba(255,226,180,.4)"; cap(0.009); x.stroke();
  x.setLineDash([0.008, 0.005]); x.lineWidth = 0.0032;
  for (const o of [-0.011, -0.021]) { x.strokeStyle = "rgba(0,0,0,.35)"; cap(o + 0.0015); x.stroke(); x.strokeStyle = "#e9cc98"; cap(o); x.stroke(); }
  x.setLineDash([]);
  // 옆 이음새 (끈 구멍 줄에서 밑창 쪽으로)
  const side = (s) => { x.beginPath(); x.moveTo(s * 0.06, 0.03); x.bezierCurveTo(s * 0.1, 0.01, s * 0.13, -0.03, s * 0.15, -0.08); };
  for (const s of [-1, 1]) {
    x.lineWidth = 0.008; x.strokeStyle = "rgba(55,26,6,.45)"; side(s); x.stroke();
    x.setLineDash([0.007, 0.005]); x.lineWidth = 0.003; x.strokeStyle = "#e9cc98"; x.save(); x.translate(0, 0.009); side(s); x.stroke(); x.restore(); x.setLineDash([]);
  }

  // 혀(가운데 덧댄 가죽) + 양옆 끈 구멍 덧단
  const ex = i => 0.066 - 0.019 * (i / 5), ey = i => -0.19 + i * 0.064;
  x.beginPath(); x.moveTo(-0.075, -0.26); x.lineTo(0.075, -0.26); x.lineTo(0.058, 0.17); x.quadraticCurveTo(0, 0.2, -0.058, 0.17); x.closePath();
  g = x.createLinearGradient(-0.07, 0, 0.07, 0); g.addColorStop(0, "#c48a48"); g.addColorStop(0.4, "#e0aa68"); g.addColorStop(1, "#99632c");
  x.fillStyle = g; x.fill();
  x.globalCompositeOperation = "multiply"; x.fillStyle = pat(x, G, U); x.fill(); x.globalCompositeOperation = "source-over";
  for (const s of [-1, 1]) {
    x.beginPath();
    for (let i = 0; i <= 5; i++) { const px = s * (ex(i) + 0.022), py = ey(i) - 0.035; i ? x.lineTo(px, py) : x.moveTo(px, py - 0.08); }
    x.lineTo(s * (ex(5) + 0.016), ey(5) + 0.03);
    for (let i = 5; i >= 0; i--) x.lineTo(s * (ex(i) - 0.017), ey(i) + (i === 5 ? 0.03 : 0));
    x.lineTo(s * (ex(0) - 0.017), ey(0) - 0.12); x.closePath();
    // 덧단이 혀 위에 얹혀서 생기는 그늘
    x.save(); x.shadowColor = "rgba(40,18,2,.55)"; x.shadowBlur = 0.012 * U; x.shadowOffsetX = -s * 0.004 * U; x.shadowOffsetY = 0.003 * U;
    g = x.createLinearGradient(s * 0.03, 0, s * 0.11, 0); g.addColorStop(0, "#a8702f"); g.addColorStop(1, "#7d4d1f");
    x.fillStyle = g; x.fill(); x.restore();
    x.globalCompositeOperation = "multiply"; x.fillStyle = pat(x, G, U); x.fill(); x.globalCompositeOperation = "source-over";
    x.setLineDash([0.007, 0.0045]); x.lineWidth = 0.0028; x.strokeStyle = "#ebd09e";
    x.beginPath(); for (let i = 0; i <= 5; i++) { const px = s * (ex(i) - 0.011), py = ey(i); i ? x.lineTo(px, py) : x.moveTo(px, py - 0.1); } x.stroke();
    x.setLineDash([]);
  }
  // 끈 구멍(놋쇠 고리)
  const eye = [];
  for (let i = 0; i <= 5; i++) for (const s of [-1, 1]) {
    const px = s * ex(i), py = ey(i); eye.push([px, py]);
    x.beginPath(); x.arc(px + 0.002, py + 0.003, 0.0125, 0, 7); x.fillStyle = "rgba(30,14,2,.45)"; x.fill();
    g = x.createRadialGradient(px - 0.004, py - 0.004, 0.001, px, py, 0.012); g.addColorStop(0, "#fff0c0"); g.addColorStop(0.45, "#c9a14f"); g.addColorStop(1, "#6b4f1c");
    x.beginPath(); x.arc(px, py, 0.0115, 0, 7); x.fillStyle = g; x.fill();
    x.beginPath(); x.arc(px, py, 0.0055, 0, 7); x.fillStyle = "#1e1208"; x.fill();
  }
  // 끈: 발끝 쪽 가로 한 줄 → 위로 X자로 엇갈림 (밑에 깔린 줄 먼저)
  const lace = (a, b, over) => {
    const [ax, ay] = a, [bx, by] = b, mx = (ax + bx) / 2, my = (ay + by) / 2 + (over ? 0.004 : 0.0);
    x.lineCap = "round";
    x.lineWidth = 0.016; x.strokeStyle = "rgba(25,10,0,.4)"; x.beginPath(); x.moveTo(ax + 0.002, ay + 0.004); x.quadraticCurveTo(mx + 0.002, my + 0.004, bx + 0.002, by + 0.004); x.stroke();
    x.lineWidth = 0.0115; x.strokeStyle = over ? "#6a4322" : "#553419"; x.beginPath(); x.moveTo(ax, ay); x.quadraticCurveTo(mx, my, bx, by); x.stroke();
    x.lineWidth = 0.0035; x.strokeStyle = over ? "rgba(255,214,160,.45)" : "rgba(255,214,160,.22)"; x.beginPath(); x.moveTo(ax - 0.0015, ay - 0.002); x.quadraticCurveTo(mx - 0.0015, my - 0.003, bx - 0.0015, by - 0.002); x.stroke();
  };
  const L = i => eye[i * 2], R = i => eye[i * 2 + 1];
  for (let i = 4; i >= 0; i--) lace(R(i + 1), L(i), false);
  lace(L(5), R(5), true);
  for (let i = 4; i >= 0; i--) lace(L(i + 1), R(i), true);
  x.restore();

  // 바짓단 아래로 빠져나온 끈 끝
  x.lineCap = "round";
  for (const [ax, ay, bx, by, cx, cy] of [[0.02, -0.25, 0.1, -0.2, 0.115, -0.1], [0.035, -0.25, 0.13, -0.23, 0.15, -0.14]]) {
    x.lineWidth = 0.016; x.strokeStyle = "rgba(25,10,0,.35)"; x.beginPath(); x.moveTo(ax, ay + 0.005); x.quadraticCurveTo(bx, by + 0.006, cx + 0.003, cy + 0.006); x.stroke();
    x.lineWidth = 0.0115; x.strokeStyle = "#6a4322"; x.beginPath(); x.moveTo(ax, ay); x.quadraticCurveTo(bx, by, cx, cy); x.stroke();
    x.lineWidth = 0.0035; x.strokeStyle = "rgba(255,214,160,.4)"; x.beginPath(); x.moveTo(ax - 0.002, ay - 0.002); x.quadraticCurveTo(bx - 0.002, by - 0.003, cx - 0.002, cy - 0.002); x.stroke();
    const a = Math.atan2(cy - by, cx - bx);
    x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = "#1c1410"; x.beginPath(); x.roundRect(-0.004, -0.0065, 0.026, 0.013, 0.004); x.fill();
    x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(0, -0.0045, 0.02, 0.003); x.restore();
  }

  // ── 청바지 ──
  const hw = y => 0.212 + 0.07 * Math.min(1, Math.max(0, (-0.26 - y) / 1.6));
  const hemY = (xx, w) => -0.248 + 0.078 * (1 - (xx / w) * (xx / w));
  const legPath = () => {
    x.beginPath(); const w0 = hw(-0.25), N = 24;
    x.moveTo(-w0, hemY(-w0, w0));
    for (let i = 1; i <= N; i++) { const xx = -w0 + (2 * w0 * i) / N; x.lineTo(xx, hemY(xx, w0)); }
    for (let y = -0.25; y >= Y0; y -= 0.05) x.lineTo(hw(y), y);
    x.lineTo(hw(Y0), Y0); x.lineTo(-hw(Y0), Y0);
    for (let y = Y0; y <= -0.25; y += 0.05) x.lineTo(-hw(y), y);
    x.closePath();
  };
  // 바지가 신발에 드리우는 그림자
  x.save(); x.shadowColor = "rgba(20,8,0,.55)"; x.shadowBlur = 0.03 * U; x.shadowOffsetX = 0.01 * U; x.shadowOffsetY = 0.022 * U;
  legPath(); x.fillStyle = "#24385a"; x.fill(); x.restore();
  x.save(); legPath(); x.clip();
  g = x.createLinearGradient(-0.29, 0, 0.29, 0);
  g.addColorStop(0, "#14233d"); g.addColorStop(0.16, "#2a4570"); g.addColorStop(0.36, "#3d6196"); g.addColorStop(0.55, "#33568a"); g.addColorStop(0.82, "#213a63"); g.addColorStop(1, "#111d33");
  x.fillStyle = g; x.fillRect(-0.4, Y0, 0.8, 1 + leg);
  // 빛바랜 무릎·허벅지 쪽
  for (let i = 0; i < 9; i++) {
    const cy = -0.35 - Math.random() * leg, cx = rnd(-0.08, 0.04), r = rnd(0.05, 0.13);
    g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, "rgba(150,180,220,.10)"); g.addColorStop(1, "rgba(150,180,220,0)");
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  x.fillStyle = pat(x, D, U, -8); x.fillRect(-0.4, Y0, 0.8, 1 + leg);
  // 주름은 번진 선으로: 그림자만 남기는 방법(선은 멀리 밀어 두고 그림자만 제자리에)으로 부드럽게
  const soft = (pathFn, lw, col, blur) => { x.save(); x.shadowColor = col; x.shadowBlur = blur * U; x.shadowOffsetX = 3 * U; x.translate(-3, 0); x.lineWidth = lw; x.lineCap = "round"; x.strokeStyle = "#000"; pathFn(); x.stroke(); x.restore(); };
  // 발목에 쌓인 주름: 밑단을 따라 휘고, 위는 빛을 받고 아래는 그늘. 위로 갈수록 옅고 짧아짐
  const w0h = hw(-0.25);
  const fold = (lift, a, x0, x1, wav, ph) => () => {
    x.beginPath();
    for (let i = 0; i <= 16; i++) { const xx = x0 + (x1 - x0) * (i / 16), yy = -0.248 + (hemY(Math.max(-w0h, Math.min(w0h, xx)), w0h) + 0.248) * (1 - a) - lift + Math.sin(i * 0.7 + ph) * wav; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); }
  };
  for (const [lift, a, x0, x1, wav, ph, k] of [[0.045, 0.2, -0.19, 0.17, 0.006, 0, 1], [0.088, 0.45, -0.15, 0.19, 0.008, 2, 0.85], [0.14, 0.7, -0.18, 0.1, 0.007, 4, 0.65], [0.2, 0.85, -0.08, 0.16, 0.006, 1, 0.45], [0.29, 0.95, -0.15, 0.04, 0.005, 3, 0.3]]) {
    const f = fold(lift, a, x0, x1, wav, ph);
    soft(f, 0.026, `rgba(4,10,26,${0.62 * k})`, 0.016);
    x.save(); x.translate(0, -0.016); soft(f, 0.016, `rgba(170,200,240,${0.32 * k})`, 0.012); x.restore();
  }
  // 정강이 앞쪽의 세로로 긴 빛 + 바깥쪽 긴 주름
  soft(() => { x.beginPath(); x.moveTo(-0.03, -0.6); x.bezierCurveTo(-0.05, -0.9, -0.02, -1.3, -0.04, Y0); }, 0.05, "rgba(160,190,235,.16)", 0.05);
  soft(() => { x.beginPath(); x.moveTo(0.12, -0.45); x.bezierCurveTo(0.14, -0.7, 0.1, -1.0, 0.13, Y0); }, 0.02, "rgba(4,10,26,.25)", 0.025);
  // 바깥 솔기(새끼발가락 쪽) + 오렌지색 박음질
  const seamX = y => -hw(y) + 0.034;
  x.lineWidth = 0.01; x.strokeStyle = "rgba(4,10,24,.5)";
  x.beginPath(); for (let y = -0.22; y >= Y0; y -= 0.04) { const xx = seamX(y) + Math.sin(y * 9) * 0.004; y > -0.23 ? x.moveTo(xx, y) : x.lineTo(xx, y); } x.stroke();
  x.lineWidth = 0.004; x.strokeStyle = "rgba(140,170,215,.28)";
  x.beginPath(); for (let y = -0.22; y >= Y0; y -= 0.04) { const xx = seamX(y) + 0.007 + Math.sin(y * 9) * 0.004; y > -0.23 ? x.moveTo(xx, y) : x.lineTo(xx, y); } x.stroke();
  x.setLineDash([0.009, 0.006]); x.lineWidth = 0.0032; x.strokeStyle = "#d4954a";
  for (const o of [0.013, 0.021]) { x.beginPath(); for (let y = -0.22; y >= Y0; y -= 0.04) { const xx = seamX(y) + o + Math.sin(y * 9) * 0.004; y > -0.23 ? x.moveTo(xx, y) : x.lineTo(xx, y); } x.stroke(); }
  x.setLineDash([]);
  // 밑단: 접어 박은 띠(닳아서 밝음) + 박음질
  const w0 = hw(-0.25), hem = (o) => { x.beginPath(); for (let i = 0; i <= 30; i++) { const xx = -w0 + (2 * w0 * i) / 30, yy = hemY(xx, w0) - o; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } };
  x.lineWidth = 0.034; x.strokeStyle = "rgba(120,150,195,.26)"; hem(0.016); x.stroke();
  x.lineWidth = 0.006; x.strokeStyle = "rgba(5,12,28,.55)"; hem(0.034); x.stroke();
  x.setLineDash([0.009, 0.006]); x.lineWidth = 0.0032; x.strokeStyle = "#d9a058"; hem(0.026); x.stroke(); x.setLineDash([]);
  x.lineWidth = 0.008; x.strokeStyle = "rgba(200,220,245,.35)"; hem(0.002); x.stroke();
  x.restore();
  return { cv, U, ox: -X0 * U, oy: -Y0 * U };
}

// 그림자: 실루엣을 흐린 정도별로 몇 장 만들어 두고 섞어 그림
export function shadowSprites(sp, scale = 0.25) {
  const w = Math.ceil(sp.cv.width * scale), h = Math.ceil(sp.cv.height * scale), pad = 40;
  const sil = document.createElement("canvas"); sil.width = w; sil.height = h;
  const s = sil.getContext("2d"); s.drawImage(sp.cv, 0, 0, w, h); s.globalCompositeOperation = "source-in"; s.fillStyle = "#000"; s.fillRect(0, 0, w, h);
  return [1.2, 5, 14].map(b => {
    const c = document.createElement("canvas"); c.width = w + pad * 2; c.height = h + pad * 2; const x = c.getContext("2d");
    x.shadowColor = "#000"; x.shadowBlur = b; x.shadowOffsetX = 10000; x.drawImage(sil, pad - 10000, pad);
    return { cv: c, U: sp.U * scale, ox: sp.ox * scale + pad, oy: sp.oy * scale + pad };
  });
}

// ── 밑창 자국: 눌린 자리 그늘 + 고무 돌기(가장자리 블록 · 뒤꿈치 가로줄 · 앞쪽 V자) + 군데군데 덜 찍힌 곳 ──
export function printSprite(U, dark) {
  const X0 = -0.22, Y0 = -0.54, W = 0.44, H = 1.08;
  const cv = document.createElement("canvas"); cv.width = Math.ceil(W * U); cv.height = Math.ceil(H * U);
  const x = cv.getContext("2d"); x.setTransform(U, 0, 0, U, -X0 * U, -Y0 * U);
  const O = outline(10), I1 = inset(O, 0.012), I2 = inset(O, 0.058), I3 = inset(O, 0.068);
  // 눌려 들어간 자리
  x.save(); path(x, O); x.fillStyle = dark ? "rgba(0,0,0,.2)" : "rgba(60,50,40,.07)"; x.fill(); x.clip();
  x.lineWidth = 0.05; x.strokeStyle = dark ? "rgba(0,0,0,.3)" : "rgba(40,32,24,.16)"; x.shadowColor = x.strokeStyle; x.shadowBlur = 0.02 * U; path(x, O); x.stroke();
  x.restore();
  // 돌기는 따로 그린 뒤 얼룩지게 지워서 얹음
  const L = document.createElement("canvas"); L.width = cv.width; L.height = cv.height;
  const l = L.getContext("2d"); l.setTransform(U, 0, 0, U, -X0 * U, -Y0 * U);
  l.fillStyle = l.strokeStyle = "#000"; l.lineJoin = "round"; l.lineCap = "round"; l.lineWidth = 0.008;
  // 가장자리 블록 (발 안쪽 아치는 땅에 안 닿음)
  const N = I1.length, len = [0];
  for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(I1[i % N][0] - I1[i - 1][0], I1[i % N][1] - I1[i - 1][1]));
  const tot = len[N], BL = 0.034, GAP = 0.011;
  for (let s0 = 0; s0 < tot; s0 += BL + GAP) {
    const pts = [], pin = [];
    for (let i = 0; i < N; i++) if (len[i] >= s0 && len[i] <= s0 + BL) { pts.push(I1[i]); pin.push(I3[i]); }
    if (pts.length < 2) continue;
    const m = pts[pts.length >> 1]; if (m[0] > 0.04 && m[1] > -0.24 && m[1] < -0.07) continue;
    l.beginPath(); l.moveTo(pts[0][0], pts[0][1]); for (const p of pts) l.lineTo(p[0], p[1]); for (let i = pin.length - 1; i >= 0; i--) l.lineTo(pin[i][0], pin[i][1]); l.closePath(); l.fill(); l.stroke();
  }
  l.save(); path(l, I2); l.clip();
  // 뒤꿈치: 가운데 홈으로 나뉜 가로 막대 (끝이 둥근 돌기)
  const bar = (ax, ay, bx, by, w) => { l.lineWidth = w; l.beginPath(); l.moveTo(ax, ay); l.lineTo(bx, by); l.stroke(); };
  for (let j = 0; j < 5; j++) { const y = -0.43 + j * 0.043; for (const s of [-1, 1]) bar(s * 0.022, y, s * 0.14, y + 0.01, 0.022); }
  // 앞쪽: 발끝을 향한 V자 돌기
  for (let j = 0; j < 10; j++) { const y = -0.05 + j * 0.05; for (const s of [-1, 1]) bar(s * 0.02, y + 0.034, s * 0.21, y - 0.038, 0.024); }
  l.restore();
  // 흙먼지로 찍힌 자국이라 오톨도톨하고 군데군데 옅음: 모래알 크기로 지우고, 넓게 옅어진 곳도 몇 군데
  const gn = document.createElement("canvas"); gn.width = gn.height = 192; const gx = gn.getContext("2d"), gi = gx.createImageData(192, 192);
  for (let i = 0; i < 192 * 192; i++) { const r = Math.random(); gi.data[i * 4 + 3] = r < 0.42 ? 0 : r < 0.8 ? rnd(40, 140) : rnd(150, 235); }
  gx.putImageData(gi, 0, 0);
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = "destination-out";
  l.fillStyle = l.createPattern(gn, "repeat"); l.fillRect(0, 0, L.width, L.height);
  for (let i = 0; i < 26; i++) {
    const cx = rnd(0, L.width), cy = rnd(0, L.height), r = rnd(0.03, 0.09) * U, gr = l.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, `rgba(0,0,0,${rnd(0.25, 0.6)})`); gr.addColorStop(1, "rgba(0,0,0,0)"); l.fillStyle = gr; l.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  l.globalCompositeOperation = "source-in"; l.fillStyle = dark ? "rgba(210,198,182,.55)" : "rgba(66,54,44,.74)"; l.fillRect(0, 0, L.width, L.height);
  x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(L, 0, 0);
  // 테두리 밖으로 튄 흙먼지
  x.setTransform(U, 0, 0, U, -X0 * U, -Y0 * U);
  x.save(); x.lineWidth = 0.022; x.strokeStyle = dark ? "rgba(200,190,175,.12)" : "rgba(120,104,88,.13)"; x.shadowColor = x.strokeStyle; x.shadowBlur = 0.03 * U; path(x, inset(O, -0.012)); x.stroke(); x.restore();
  return { cv, U, ox: -X0 * U, oy: -Y0 * U };
}

// ── 금: 둘레에서 바깥으로 뻗고 가지를 침. 유리는 곧게 뻗고 고리 모양으로 이어짐, 나무는 결을 따라 휨 ──
// 반환: 선분 목록 {x0,y0,x1,y1,d(처음부터 거리),w(굵기)}
export function makeCracks(poly, cx, cy, Ls, reach, style, grain) {
  const segs = [], N = poly.length, ST = 6;
  const noise = style === "glass" ? 0.05 : style === "grain" ? 0.12 : 0.3;
  const walk = (x, y, a, len, d0, w0, dep, out) => {
    let d = 0, px = x, py = y;
    while (d < len) {
      a += rnd(-noise, noise);
      if (style === "grain") { const t = Math.cos(a - grain) >= 0 ? grain : grain + Math.PI; let da = t - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; a += da * 0.14; }
      const nx = px + Math.cos(a) * ST, ny = py + Math.sin(a) * ST, w = w0 * Math.pow(1 - d / len, 0.7) + 0.35;
      segs.push({ x0: px, y0: py, x1: nx, y1: ny, d: d0 + d, w });
      if (out) out.push([nx, ny, d]);
      px = nx; py = ny; d += ST;
      if (dep < 1 && Math.random() < (style === "glass" ? 0.016 : 0.03)) walk(px, py, a + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 0.9), (len - d) * rnd(0.3, 0.65), d0 + d, w * 0.75, dep + 1, null);
    }
  };
  const M = style === "glass" ? 14 : 11, rays = [];
  for (let k = 0; k < M; k++) {
    const i = Math.floor(((k + rnd(-0.3, 0.3)) / M) * N + N) % N, p = poly[i], a = poly[(i - 1 + N) % N], b = poly[(i + 1) % N];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]); const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
    if (nx * (p[0] - cx) + ny * (p[1] - cy) < 0) { nx = -nx; ny = -ny; }
    const ray = [];
    walk(p[0], p[1], Math.atan2(ny, nx) + rnd(-0.25, 0.25), Ls * rnd(0.18, 0.56) * reach, 0, rnd(1.6, 2.5), 0, ray);
    rays.push(ray);
  }
  // 유리: 같은 거리의 점끼리 이어 거미줄
  if (style === "glass") for (const R of [0.08, 0.19]) {
    const r = R * Ls * reach;
    for (let k = 0; k < rays.length; k++) {
      const A = rays[k], B = rays[(k + 1) % rays.length], ia = Math.round(r / ST), ib = Math.round((r * rnd(0.85, 1.15)) / ST);
      if (ia >= A.length || ib >= B.length || Math.random() < 0.35) continue;
      const [ax, ay] = A[ia], [bx, by] = B[ib], mx = (ax + bx) / 2 + rnd(-4, 4), my = (ay + by) / 2 + rnd(-4, 4);
      segs.push({ x0: ax, y0: ay, x1: mx, y1: my, d: r, w: 0.8 }, { x0: mx, y0: my, x1: bx, y1: by, d: r, w: 0.8 });
    }
  }
  // 밟힌 자리 안쪽도 갈라짐
  for (let k = 0; k < 4; k++) {
    let x, y, t = 0; do { x = cx + rnd(-0.17, 0.17) * Ls; y = cy + rnd(-0.45, 0.45) * Ls; } while (!inPoly(poly, x, y) && ++t < 20);
    walk(x, y, rnd(0, 6.28), Ls * rnd(0.12, 0.3), 0, rnd(1, 1.7), 1, null);
  }
  return segs;
}
