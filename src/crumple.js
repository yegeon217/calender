// 종이 꾸기기 미리 계산 (위치 기반 동역학)
// 늘어나지 않는 질점 그물을 줄어드는 타원체 안에 가둬 압축하면, 종이가 스스로 휘고 접히며 구겨진 공이 됨.
// 넓이 1인 종이로 계산해 두고, 비율이 비슷한 조각들은 같은 결과를 크기만 맞춰 함께 씀.
// 점 순서는 THREE.PlaneGeometry와 같음(위 줄부터, 왼쪽부터) → 조각 평면의 꼭짓점에 그대로 복사하면 됨.
export const BALL_R = 0.22;   // 다 꾸겨진 공의 반지름 (넓이 1 기준)

export function bakeCrumple(aspect, seed = 1) {
  let s = (seed * 7919) % 2147483647 || 1;
  const rand = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const NT = 300, nx = Math.max(4, Math.round(Math.sqrt(NT * aspect))), ny = Math.max(4, Math.round(NT / nx)), n = nx * ny;
  const w = Math.sqrt(aspect), h = 1 / Math.sqrt(aspect), dx = w / (nx - 1), dy = h / (ny - 1);
  const P = new Float32Array(n * 3), Q = new Float32Array(n * 3);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const k = (iy * nx + ix) * 3; P[k] = -w / 2 + ix * dx; P[k + 1] = h / 2 - iy * dy; P[k + 2] = 0;
  }
  const flat = P.slice();
  for (let i = 0; i < n; i++) P[i * 3 + 2] = (rand() - 0.5) * 0.006;   // 아주 작은 흔들림 → 압축될 때 휘어지는 방향이 제각각
  Q.set(P);
  // 거리 제약: 점 a·b, 원래 길이, 단단함 (빠르게 돌리려고 배열 여러 개로)
  const CA = [], CB = [], CL = [], CK = [], dist = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1]);
  const add = (a, b, k) => { CA.push(a); CB.push(b); CL.push(dist(a, b)); CK.push(k); };
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const i = iy * nx + ix;
    if (ix < nx - 1) add(i, i + 1, 1);
    if (iy < ny - 1) add(i, i + nx, 1);
    if (ix < nx - 1 && iy < ny - 1) { add(i, i + nx + 1, 1); add(i + 1, i + nx, 1); }
    if (ix < nx - 2) add(i, i + 2, 0.06);          // 약한 굽힘 저항 → 날카로운 접힌 자국이 생김
    if (iy < ny - 2) add(i, i + 2 * nx, 0.06);
  }
  const NC = CA.length, A_ = Int32Array.from(CA), B_ = Int32Array.from(CB), L_ = Float32Array.from(CL), K_ = Float32Array.from(CK);
  // 압축하는 타원체: 축마다 줄어드는 속도가 달라 접히는 모양이 고르지 않게
  const R0 = Math.hypot(w, h) / 2 * 1.02, ax = [0.75 + rand() * 0.5, 0.75 + rand() * 0.5, 0.75 + rand() * 0.5];
  const yaw = rand() * 6.283, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const rc = Math.min(dx, dy) * 0.62, rc2 = rc * rc, cell = new Map();
  const keys = [flat], STEPS = 78, SQUEEZE = 60;
  for (let step = 1; step <= STEPS; step++) {
    const u = Math.min(1, step / SQUEEZE), e = u * u * (3 - 2 * u), R = R0 + (BALL_R - R0) * e;
    // 속도 (감쇠 큼)
    for (let i = 0; i < n * 3; i++) { const v = (P[i] - Q[i]) * 0.82; Q[i] = P[i]; P[i] += v; }
    for (let it = 0; it < 9; it++) {
      for (let c = 0; c < NC; c++) {
        const a3 = A_[c] * 3, b3 = B_[c] * 3, L = L_[c], k = K_[c];
        const ex = P[b3] - P[a3], ey = P[b3 + 1] - P[a3 + 1], ez = P[b3 + 2] - P[a3 + 2], d = Math.hypot(ex, ey, ez) || 1e-9;
        if (k < 1 && d < L) continue;               // 굽힘 제약은 '펴지려는' 쪽만 약하게
        const f = ((d - L) / d) * 0.5 * k;
        P[a3] += ex * f; P[a3 + 1] += ey * f; P[a3 + 2] += ez * f; P[b3] -= ex * f; P[b3 + 1] -= ey * f; P[b3 + 2] -= ez * f;
      }
      // 타원체 밖으로 나간 점은 안으로
      const rx = R * (1 + (ax[0] - 1) * e), ry = R * (1 + (ax[1] - 1) * e), rz = R * (1 + (ax[2] - 1) * e);
      for (let i = 0; i < n; i++) {
        const i3 = i * 3, x = P[i3] * cy + P[i3 + 1] * sy, y = -P[i3] * sy + P[i3 + 1] * cy, z = P[i3 + 2];
        const m = Math.hypot(x / rx, y / ry, z / rz);
        if (m > 1) { P[i3] /= m; P[i3 + 1] /= m; P[i3 + 2] /= m; }
      }
    }
    // 종이끼리 뚫고 지나가지 않게 서로 밀어냄
    cell.clear();
    const key = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
    for (let i = 0; i < n; i++) { const k = key(Math.floor(P[i * 3] / rc), Math.floor(P[i * 3 + 1] / rc), Math.floor(P[i * 3 + 2] / rc)); let a = cell.get(k); if (!a) cell.set(k, (a = [])); a.push(i); }
    for (let i = 0; i < n; i++) {
      const i3 = i * 3, gx = Math.floor(P[i3] / rc), gy = Math.floor(P[i3 + 1] / rc), gz = Math.floor(P[i3 + 2] / rc);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        const a = cell.get(key(gx + ox, gy + oy, gz + oz)); if (!a) continue;
        for (const j of a) {
          if (j <= i) continue; const j3 = j * 3;
          const ex = P[j3] - P[i3], ey = P[j3 + 1] - P[i3 + 1], ez = P[j3 + 2] - P[i3 + 2], d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= rc2 || d2 < 1e-12) continue;
          const d = Math.sqrt(d2), f = ((rc - d) / d) * 0.5;
          P[i3] -= ex * f; P[i3 + 1] -= ey * f; P[i3 + 2] -= ez * f; P[j3] += ex * f; P[j3 + 1] += ey * f; P[j3 + 2] += ez * f;
        }
      }
    }
    // 가운데를 원점에
    let mx = 0, my = 0, mz = 0; for (let i = 0; i < n; i++) { mx += P[i * 3]; my += P[i * 3 + 1]; mz += P[i * 3 + 2]; }
    mx /= n; my /= n; mz /= n; for (let i = 0; i < n; i++) { P[i * 3] -= mx; P[i * 3 + 1] -= my; P[i * 3 + 2] -= mz; Q[i * 3] -= mx; Q[i * 3 + 1] -= my; Q[i * 3 + 2] -= mz; }
    if (step % 5 === 0 || step === STEPS) keys.push(P.slice());
  }
  return { nx, ny, w, h, keys };
}

// 꾸김 정도 c(0~1)에 맞는 모양을 out에 (넓이 1 기준 → scale을 곱해서)
export function sampleCrumple(T, c, scale, out) {
  const f = Math.min(1, Math.max(0, c)) * (T.keys.length - 1), i = Math.min(T.keys.length - 2, Math.floor(f)), t = f - i, A = T.keys[i], B = T.keys[i + 1];
  for (let k = 0; k < out.length; k++) out[k] = (A[k] + (B[k] - A[k]) * t) * scale;
}
