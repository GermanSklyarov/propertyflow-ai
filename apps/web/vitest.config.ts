import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@app": `${srcPath}/app`,
      "@entities": `${srcPath}/entities`,
      "@features": `${srcPath}/features`,
      "@shared": `${srcPath}/shared`,
      "@views": `${srcPath}/views`,
      "@widgets": `${srcPath}/widgets`
    }
  },
  test: {
    exclude: ["**/.test-build/**", "**/.next/**", "**/node_modules/**"],
    include: ["src/**/*.test.ts"]
  }
});
