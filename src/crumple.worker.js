// 종이 꾸기기 계산을 화면을 멈추지 않고 뒤에서 (비율별로 하나씩 받아 돌려줌)
import { bakeCrumple } from "./crumple.js";
self.onmessage = e => {
  const { id, aspect, seed } = e.data, T = bakeCrumple(aspect, seed);
  self.postMessage({ id, T }, T.keys.map(k => k.buffer));
};
