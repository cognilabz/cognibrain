import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  test: {
    exclude: [...configDefaults.exclude, ".cognibrain/**", "**/.cognibrain/**"]
  },
  build: {
    outDir: "dist/dashboard"
  }
});
