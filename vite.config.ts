import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// dev 模式把 /auth 代理到本机 oce；生产同源部署无需代理
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": "http://localhost:8986",
    },
  },
  build: {
    outDir: "dist",
  },
});
