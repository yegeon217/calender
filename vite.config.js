import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // 3D(three.js)는 짓누르기를 누를 때만 따로 불러오는 큰 조각이라 경고 기준을 올림
  build: { outDir: "dist", target: "es2020", chunkSizeWarningLimit: 700 },
});
