// 2D 달력 위에 겹쳐 그리는 3D 화면 하나를 손바닥·바주카·핵이 같이 씀 (WebGL 화면을 여러 개 만들면 폰 메모리가 모자람)
// 좌표: 화면 픽셀 = 월드 단위, z=0 평면이 화면(달력)과 1:1로 겹침 · 카메라는 z=D (fov 35)
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let R = null;
export function fx3d() {
  const vw = innerWidth, vh = innerHeight;
  if (R && !R.lost && R.vw === vw && R.vh === vh) return R;
  if (R) R.dispose();
  const cv = document.createElement("canvas"); cv.id = "gFx3d";
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
  const PR = Math.min(devicePixelRatio || 1, 2); renderer.setPixelRatio(PR); renderer.setSize(vw, vh, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.localClippingEnabled = true;
  const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const FOV = 35, D = vh / 2 / Math.tan((FOV / 2) * Math.PI / 180);
  const users = new Set();
  const r = { vw, vh, PR, cv, renderer, pmrem, env, FOV, D, lost: false, users, owner: null,
    // 쓰는 쪽이 하나라도 있으면 화면에 붙임 · 맨 마지막에 그리는 쪽(owner)만 그림 (필살기가 바주카보다 먼저)
    use(k, prio = 0) { users.add(k); if (!r.owner || prio >= (r.prio || 0)) { r.owner = k; r.prio = prio; } if (!cv.isConnected) document.body.append(cv); },
    drop(k) { users.delete(k); if (r.owner === k) { r.owner = users.size ? [...users].pop() : null; r.prio = 0; } if (!users.size) { renderer.clear(); cv.remove(); } },
    mine(k) { return r.owner === k; },
    atS: (sx, sy, z) => new THREE.Vector3((sx - vw / 2) * (D - z) / D, (vh / 2 - sy) * (D - z) / D, z),
    toS: p => ({ x: vw / 2 + p.x * D / (D - p.z), y: vh / 2 - p.y * D / (D - p.z) }),
    dispose() { renderer.dispose(); pmrem.dispose(); env.dispose(); cv.remove(); } };
  cv.addEventListener("webglcontextlost", () => (r.lost = true));
  return (R = r);
}
