import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// 단일 HTML 빌드용. 파일을 더블클릭해 여는 방식이라 base 가 './' 여야 한다.
// 업무망 차단 대비용이며, 인터넷이 없으므로 시트를 읽지 못해 개인 모드로만 동작한다.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: "dist-single", assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
