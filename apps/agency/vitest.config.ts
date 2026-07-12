import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@entities": `${srcPath}/entities`,
      "@shared": `${srcPath}/shared`,
      "@views": `${srcPath}/views`,
      "@widgets": `${srcPath}/widgets`
    }
  },
  test: {
    exclude: ["**/.next/**", "**/node_modules/**"],
    include: ["src/**/*.test.ts"]
  }
});
