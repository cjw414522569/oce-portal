import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "site",
  plugins: [vue()],
  // 统一门户部署在 oce 同源根路径；远端部署（如 GitHub Pages）可用 VITE_BASE_PATH 覆盖
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
