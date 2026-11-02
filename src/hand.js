// 실제 사람 손 모델(WebXR generic-hand, MIT) + 손가락 굽히기
// 모델의 관절 25개는 계층 없이 나란히 있음(VR 추적값을 바로 넣는 구조) → 쉬는 자세에서 관절끼리의
// 상대 위치를 구해 두고, 굽힌 각도를 손가락 뿌리부터 끝까지 차례로 곱해 내려가서(순방향 운동학) 각 관절에 넣음.
// 관절 좌표계: -Z가 손가락 끝 방향, +Y가 손등 쪽 → 손바닥 쪽으로 굽히기 = X축으로 음의 회전
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import handUrl from "./assets/hand-right.glb?url";

export const FINGER_NAMES = ["index", "middle", "ring", "pinky"];
const CHAIN = n => [`${n}-finger-metacarpal`, `${n}-finger-phalanx-proximal`, `${n}-finger-phalanx-intermediate`, `${n}-finger-phalanx-distal`, `${n}-finger-tip`];
const THUMB = ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"];
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// 모델 파일은 한 번만 받아 두고, 쓸 때마다 새로 풀어서 씀 (앞서 쓴 장면을 정리하며 지워도 다시 쓸 수 있게)
let fileP = null;
export const preloadHand = () => (fileP = fileP || fetch(handUrl).then(r => r.arrayBuffer()));
export async function loadHand(material) {
  const gltf = await new GLTFLoader().parseAsync((await preloadHand()).slice(0), "");
  let mesh = null;
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  mesh.material = material; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const bones = {}; mesh.skeleton.bones.forEach(b => (bones[b.name] = b));
  const restM = {}; for (const n in bones) restM[n] = new THREE.Matrix4().compose(bones[n].position, bones[n].quaternion, new THREE.Vector3(1, 1, 1));
  const chains = { thumb: THUMB };
  FINGER_NAMES.forEach(n => (chains[n] = CHAIN(n)));
  // 쉬는 자세에서 부모 관절 기준 상대 변환
  const local = {};
  for (const k in chains) { const c = chains[k]; local[k] = c.map((n, i) => (i ? restM[c[i - 1]].clone().invert().multiply(restM[n]) : restM[n].clone())); }

  const M = new THREE.Matrix4(), R = new THREE.Matrix4(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), s = new THREE.Vector3();
  const world = {};   // 관절별 현재 변환 (모델 공간)
  // rot[k] = [x, y, z] 관절 k에서 돌릴 각도 (관절 자기 좌표계, 라디안)
  function setChain(k, rot) {
    const c = chains[k], L = local[k];
    for (let i = 0; i < c.length; i++) {
      if (i === 0) M.copy(L[0]); else M.multiply(L[i]);
      const r = rot[i];
      if (r) { q.setFromAxisAngle(X, r[0] || 0).multiply(qa.setFromAxisAngle(Y, r[1] || 0)).multiply(qa.setFromAxisAngle(Z, r[2] || 0)); M.multiply(R.makeRotationFromQuaternion(q)); }
      const b = bones[c[i]]; M.decompose(b.position, b.quaternion, s);
      (world[c[i]] || (world[c[i]] = new THREE.Matrix4())).copy(M);
    }
  }
  return { scene: gltf.scene, mesh, bones, chains, setChain, world, restM };
}
