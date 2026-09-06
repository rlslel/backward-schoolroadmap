import { defineConfig } from "vitest/config";

// 테스트에는 React·Tailwind 플러그인이 필요 없으므로 빌드 설정과 분리한다.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
