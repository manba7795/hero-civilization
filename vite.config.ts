import { defineConfig } from "vite";

export default defineConfig({
  base: "/hero-civilization/",
  server: { host: "0.0.0.0", port: 5173 },
  build: { target: "es2022" }
});
