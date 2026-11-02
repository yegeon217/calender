// 3D 장면(짓누르기·영역전개)이 같이 쓰는 작은 도구들
import * as THREE from "three";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const sstep = x => x * x * (3 - 2 * x);
export const eOut = t => 1 - Math.pow(1 - t, 3), eIn = t => t * t * t, eInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const eBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = sstep(x - xi), v = sstep(y - yi), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// 진동: 1 가볍게 · 2 보통 · 3 세게, 배열이면 [세기, 쉬는 ms, 세기, …] 순서대로
export const buzz = s => {
  if (Array.isArray(s)) { let t = 0; s.forEach((v, i) => { if (i % 2) t += v; else setTimeout(() => buzz(v), t); }); return; }
  try { Haptics.impact({ style: s === 3 ? ImpactStyle.Heavy : s === 2 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {}); } catch (e) {}
};

// ── 질감용 작은 텍스처 ──
export function noiseTex(size, rep, amp, fine = 0.35) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), im = x.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const u = i % size, v = (i / size) | 0, n = 128 + (vnoise(u * fine, v * fine) - 0.5) * amp + (Math.random() - 0.5) * amp * 0.6; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = n; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
export function radialTex(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
