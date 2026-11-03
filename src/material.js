// ── 재질: 종이(기본) · 유리 · 나무 · 돌 ──
// 도구 동작은 그대로이고, 칸 겉모습 · 깨지는 모양 · 파편 · 소리 · 무게 · 단단한 정도 · 불에 대한 반응이 달라짐 (설정에서 고름)
const KEY = "smash-mat";
export const MATS = [
  { id: "paper", name: "종이", note: "잘 타요" },
  { id: "glass", name: "유리", note: "잘 깨지고 불에 녹아요" },
  { id: "wood", name: "나무", note: "단단하고 천천히 타요" },
  { id: "stone", name: "돌", note: "아주 단단하고 안 타요" },
];
// 강도: 클수록 단단함 → 같은 파괴력으로 덜 부서짐 (망치·총·폭탄·레이저·발 모두)
export const STR = { paper: 1, glass: 0.75, wood: 2.2, stone: 4 };
export const str = () => STR[cur];
// 불: 종이·나무만 탐 (나무는 잘 안 붙고 천천히 탐) · 유리·돌은 달궈지기만 함 (유리는 오래 달구면 녹아 흘러내림)
export const burns = () => cur === "paper" || cur === "wood";
let cur = "paper";
try { const v = localStorage.getItem(KEY); if (MATS.some(m => m.id === v)) cur = v; } catch (e) {}
export const mat = () => cur;
export function setMat(id) { cur = id; try { localStorage.setItem(KEY, id); } catch (e) {} }
export const isDark = () => !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);

// 물리: 유리·돌은 무겁고 덜 튀고, 나무는 가볍고 잘 튐
export const PHYS = {
  paper: { density: 0.0012, restitution: 0.16, friction: 0.45 },
  glass: { density: 0.0021, restitution: 0.2, friction: 0.22 },
  wood: { density: 0.0009, restitution: 0.3, friction: 0.55 },
  stone: { density: 0.0027, restitution: 0.06, friction: 0.75 },
};
// 나무결 방향: 긴 쪽을 따라 (세로로 긴 칸은 세로결)
export const grainOf = (w, h) => (h > w * 1.15 ? Math.PI / 2 : 0);

// ── 이어 붙여도 이음매가 안 보이는(주기) 잡음 ──
function ih(i, j, s) {
  let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function pn(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  const i0 = ((xi % px) + px) % px, j0 = ((yi % py) + py) % py, i1 = (i0 + 1) % px, j1 = (j0 + 1) % py;
  const h00 = ih(i0, j0, s), h10 = ih(i1, j0, s), h01 = ih(i0, j1, s), h11 = ih(i1, j1, s);
  return h00 + (h10 - h00) * a + (h01 - h00) * b + (h00 - h10 - h01 + h11) * a * b;
}
function fbm(x, y, px, py, oct, s) {
  let v = 0, am = 0.5, t = 0;
  for (let k = 0; k < oct; k++) { v += am * pn(x, y, px, py, s + k * 17); t += am; x *= 2; y *= 2; px *= 2; py *= 2; am *= 0.5; }
  return v / t;
}
const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// 나무: 가로결 · 나이테(늦은재는 진하고 경계가 또렷) · 가는 섬유 · 얼룩 · 물관 자국
function woodTex(dk) {
  const W = 1024, H = 384, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), im = x.createImageData(W, H), d = im.data;
  const E = dk ? [112, 78, 50] : [226, 190, 140], LT = dk ? [62, 40, 24] : [168, 112, 58], DEEP = dk ? [40, 25, 14] : [126, 78, 36];
  for (let y = 0; y < H; y++) for (let u = 0; u < W; u++) {
    const warp = fbm(u / 256, y / 64, 4, 6, 3, 1);
    const ring = (y + (warp - 0.5) * 74) / 24 + fbm(u / 128, y / 48, 8, 8, 2, 7) * 1.3;
    const t = ring - Math.floor(ring);
    const late = Math.pow(t, 5) * 0.85 + Math.pow(t, 22) * 0.6;
    const fib = fbm(u / 64, y / 1.5, 16, 256, 2, 3);
    const blot = fbm(u / 128, y / 96, 8, 4, 3, 5);
    let k = 0.12 + late + (fib - 0.5) * 0.42 + (blot - 0.5) * 0.36;
    let c = k < 1 ? mixc(E, LT, cl01(k)) : mixc(LT, DEEP, cl01(k - 1));
    if (ih(u >> 2, y, 99) > 0.988) c = mixc(c, DEEP, 0.45);
    const i = (y * W + u) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  x.putImageData(im, 0, 0); return cv;
}
// 돌: 얼룩진 화강암 · 검은/흰 알갱이 · 가는 석영 줄
function stoneTex(dk) {
  const N = 512, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const x = cv.getContext("2d"), im = x.createImageData(N, N), d = im.data;
  const A = dk ? [52, 54, 59] : [150, 148, 144], B = dk ? [84, 86, 92] : [204, 202, 197];
  for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
    const base = fbm(u / 128, v / 128, 4, 4, 5, 11), mid = fbm(u / 16, v / 16, 32, 32, 2, 21);
    let c = mixc(A, B, cl01((base - 0.5) * 1.9 + 0.5 + (mid - 0.5) * 0.6));
    const fl = pn(u / 1.6, v / 1.6, 320, 320, 31), fl2 = pn(u / 3.2, v / 3.2, 160, 160, 37);
    if (fl > 0.84 && fl2 > 0.45) c = mixc(c, dk ? [14, 15, 18] : [38, 38, 40], 0.62);
    else if (fl < 0.11) c = mixc(c, dk ? [150, 152, 158] : [246, 245, 241], 0.55);
    // 드문드문 굵기가 다른 석영 줄 (가는 잡음 대신 큰 흐름을 따라)
    const vein = Math.abs(fbm(u / 256, v / 256, 2, 2, 3, 41) - 0.5), vw = 0.006 + 0.008 * fbm(u / 64, v / 64, 8, 8, 2, 43);
    if (vein < vw) c = mixc(c, dk ? [128, 130, 136] : [232, 231, 226], 0.38 * (1 - vein / vw));
    const i = (v * N + u) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  x.putImageData(im, 0, 0); return cv;
}
const TEX = new Map();
function tex(m, dk) { const k = m + dk; if (!TEX.has(k)) TEX.set(k, m === "wood" ? woodTex(dk) : stoneTex(dk)); return TEX.get(k); }
// 고른 재질의 무늬를 미리 만들어 둠 (첫 칸 그릴 때 멈칫하지 않게)
export function warmTex() { if (cur === "wood" || cur === "stone") tex(cur, isDark()); }

function rr(x, l, t, w, h, r) { x.beginPath(); x.roundRect(l, t, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function texFill(x, b, pd, rot) {
  const T = tex(cur, isDark()), pat = x.createPattern(T, "repeat");
  const ox = Math.random() * T.width, oy = Math.random() * T.height;
  let M = new DOMMatrix().translate(b.left, b.top);
  if (rot) M = M.rotate(90);
  M = M.translate(-ox / pd, -oy / pd).scale(1 / pd);
  try { pat.setTransform(M); } catch (e) {}
  x.fillStyle = pat; x.fillRect(b.left, b.top, b.width, b.height);
}
// 위·왼쪽은 밝게, 아래·오른쪽은 어둡게: 두께 있는 판처럼
function bevel(x, b, r, hi, lo, w, ins) {
  const l = b.left + ins, t = b.top + ins, R = b.left + b.width - ins, B = b.top + b.height - ins, rc = Math.max(0, r - ins);
  x.lineWidth = w; x.lineCap = "round";
  x.strokeStyle = hi; x.beginPath(); x.moveTo(l, B - rc); x.lineTo(l, t + rc); x.arcTo(l, t, l + rc, t, rc); x.lineTo(R - rc, t); x.stroke();
  x.strokeStyle = lo; x.beginPath(); x.moveTo(R, t + rc); x.lineTo(R, B - rc); x.arcTo(R, B, R - rc, B, rc); x.lineTo(l + rc, B); x.stroke();
}

// 칸 바탕
export function fillCell(x, b, rad, bg, pd) {
  if (cur === "paper") { x.fillStyle = bg; rr(x, b.left, b.top, b.width, b.height, rad); x.fill(); return; }
  const dk = isDark(), { left: l, top: t, width: w, height: h } = b;
  x.save(); rr(x, l, t, w, h, rad); x.clip();
  if (cur === "glass") {
    let g = x.createLinearGradient(0, t, 0, t + h);
    g.addColorStop(0, dk ? "rgba(185,220,238,.22)" : "rgba(236,248,252,.55)"); g.addColorStop(1, dk ? "rgba(120,170,200,.12)" : "rgba(200,228,238,.36)");
    x.fillStyle = g; x.fillRect(l, t, w, h);
    // 비스듬한 반사 두 줄
    const s = Math.max(w, h);
    g = x.createLinearGradient(l, t, l + s, t + s); const a = dk ? 0.5 : 1;
    [[0, 0], [0.1, 0.5], [0.17, 0], [0.24, 0.2], [0.29, 0], [1, 0]].forEach(([o, v]) => g.addColorStop(o, `rgba(255,255,255,${v * a})`));
    x.fillStyle = g; x.fillRect(l, t, w, h);
    x.restore();
    // 유리 단면: 푸르스름한 가장자리 + 안쪽 밝은 테 + 아래·오른쪽 두께
    x.lineWidth = 0.9; x.strokeStyle = dk ? "rgba(120,180,190,.7)" : "rgba(92,150,158,.85)"; rr(x, l + 0.45, t + 0.45, w - 0.9, h - 0.9, rad); x.stroke();
    bevel(x, b, rad, dk ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.95)", dk ? "rgba(90,150,165,.45)" : "rgba(70,128,140,.42)", 1.3, 1.6);
    return;
  }
  const rot = cur === "wood" && grainOf(w, h) !== 0;
  texFill(x, b, pd, rot);
  // 판마다 색이 조금씩 다름
  x.globalCompositeOperation = "multiply"; x.fillStyle = `rgba(${cur === "wood" ? "150,105,60" : "120,118,114"},${Math.random() * 0.22})`; x.fillRect(l, t, w, h);
  x.globalCompositeOperation = "source-over";
  // 광택
  let g = x.createLinearGradient(l, t, l + w * 0.7, t + h);
  g.addColorStop(0, `rgba(255,255,255,${dk ? 0.07 : cur === "stone" ? 0.22 : 0.14})`); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(0,0,0,${dk ? 0.18 : 0.08})`);
  x.fillStyle = g; x.fillRect(l, t, w, h);
  x.restore();
  if (cur === "wood") {
    x.lineWidth = 1; x.strokeStyle = dk ? "rgba(10,5,0,.6)" : "rgba(70,38,12,.5)"; rr(x, l + 0.5, t + 0.5, w - 1, h - 1, rad); x.stroke();
    bevel(x, b, rad, dk ? "rgba(255,220,180,.16)" : "rgba(255,238,210,.6)", dk ? "rgba(0,0,0,.45)" : "rgba(60,30,8,.32)", 1, 1.4);
  } else {
    x.lineWidth = 0.8; x.strokeStyle = dk ? "rgba(0,0,0,.6)" : "rgba(60,58,55,.45)"; rr(x, l + 0.4, t + 0.4, w - 0.8, h - 0.8, rad); x.stroke();
    bevel(x, b, rad, dk ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.7)", dk ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.26)", 1.2, 1.3);
  }
}
// 일정 칩: 유리는 색유리, 나무·돌은 칠한 것처럼 (결·알갱이가 비침)
export function fillChip(x, b, rad, bg, pd) {
  const { left: l, top: t, width: w, height: h } = b;
  if (cur === "paper") { x.fillStyle = bg; rr(x, l, t, w, h, rad); x.fill(); return; }
  x.save(); rr(x, l, t, w, h, rad); x.clip();
  if (cur === "glass") {
    x.globalAlpha = 0.74; x.fillStyle = bg; x.fillRect(l, t, w, h); x.globalAlpha = 1;
    const g = x.createLinearGradient(0, t, 0, t + h); g.addColorStop(0, "rgba(255,255,255,.42)"); g.addColorStop(0.48, "rgba(255,255,255,.08)"); g.addColorStop(0.52, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.12)");
    x.fillStyle = g; x.fillRect(l, t, w, h); x.restore();
    x.lineWidth = 0.7; x.strokeStyle = "rgba(255,255,255,.7)"; rr(x, l + 0.6, t + 0.6, w - 1.2, h - 1.2, rad); x.stroke();
    return;
  }
  x.fillStyle = bg; x.fillRect(l, t, w, h);
  x.globalCompositeOperation = "multiply"; x.globalAlpha = cur === "wood" ? 0.5 : 0.42; texFill(x, b, pd, false);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  const g = x.createLinearGradient(0, t, 0, t + h); g.addColorStop(0, "rgba(255,255,255,.16)"); g.addColorStop(1, "rgba(0,0,0,.1)");
  x.fillStyle = g; x.fillRect(l, t, w, h); x.restore();
}
// 테두리: 종이·오늘 표시(두꺼운 테두리)만 그대로 그림
export const keepBorder = bw => cur === "paper" || bw >= 1.5;

// 글자: 나무는 인두로 지진 것처럼, 돌은 새긴 것처럼(아래쪽 밝은 테), 유리는 인쇄 + 옅은 번짐
function rgbOf(col) {
  const m = col.match(/[\d.]+/g); if (!m) return [0, 0, 0, 1];
  return [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1];
}
const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export function textPass(x, col, onChip, pd, draw) {
  if (cur === "paper" || onChip) { x.fillStyle = col; draw(0, 0); return; }
  const dk = isDark(), c = rgbOf(col);
  if (cur === "wood") {
    if (!dk) { x.save(); x.globalCompositeOperation = "multiply"; x.fillStyle = css(mixc(c, [58, 30, 10], 0.6), c[3]); draw(0, 0); x.restore(); }
    else { x.fillStyle = css(mixc(c, [250, 226, 196], 0.4), c[3] * 0.92); draw(0, 0); }
  } else if (cur === "stone") {
    x.fillStyle = dk ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.6)"; draw(0, 0.75);
    x.fillStyle = dk ? css(mixc(c, [255, 255, 255], 0.1), c[3]) : css(mixc(c, [30, 30, 32], 0.5), c[3]); draw(0, 0);
  } else {
    x.save(); x.shadowColor = dk ? "rgba(0,0,0,.7)" : "rgba(255,255,255,.95)"; x.shadowBlur = 2 * pd; x.fillStyle = col; draw(0, 0); x.restore();
  }
}

// 파편 색: 바탕색 자리를 재질 색으로
const PAL = {
  wood: [["#cf9c60", "#b98247", "#e2bd86", "#9a6534", "#f0d3a6"], ["#7a5434", "#634229", "#8d6440", "#4c3220"]],
  stone: [["#b4b2ad", "#9d9b96", "#cbc9c3", "#85837e", "#6f6d69"], ["#55575c", "#46484d", "#686a70", "#3a3c40"]],
  glass: [["#dff2f7", "#c7e6ee", "#eefafc", "#b5dce6"], ["#8fb7c8", "#a9cdd9", "#7aa4b6"]],
};
export function matColors(colors, bgCount) {
  if (cur === "paper") return colors;
  const P = PAL[cur][isDark() ? 1 : 0], out = colors.slice(bgCount);
  for (let i = 0; i < Math.max(3, P.length); i++) out.push(P[i % P.length]);
  return out;
}
export const matPal = () => (cur === "paper" ? null : PAL[cur][isDark() ? 1 : 0]);

// 버튼·메뉴의 작은 견본
export function swatch(id) {
  switch (id) {
    case "glass": return "linear-gradient(135deg,rgba(255,255,255,.95) 0 18%,rgba(190,228,238,.75) 30%,rgba(150,205,220,.55) 62%,rgba(255,255,255,.7) 70%,rgba(160,210,224,.6) 78%)";
    case "wood": return "repeating-linear-gradient(8deg,#d7aa6c 0 3px,#c08848 3px 4px,#dcb479 4px 7px,#a87038 7px 8px)";
    case "stone": return "radial-gradient(circle at 30% 30%,#333 0 1px,transparent 1.5px),radial-gradient(circle at 70% 60%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 55% 25%,#444 0 .8px,transparent 1.2px),linear-gradient(135deg,#c9c7c2,#8d8b86)";
    default: return "linear-gradient(135deg,#fff,#eceae4)";
  }
}
