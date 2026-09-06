import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 배포용. 주소가 https://rlslel.github.io/backward-schoolroadmap/ 이므로
// base 를 저장소 이름으로 맞춰야 한다. 기본값('/')이면 흰 화면만 뜬다.
export default defineConfig({
  base: "/backward-schoolroadmap/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist" },
});
