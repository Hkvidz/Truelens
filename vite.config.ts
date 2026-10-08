import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Bound to 0.0.0.0 so the sandbox live preview can reach the dev server.
// `.e2b.app` lets the preview hostnames pass Vite's host check.
const allowedHosts = [".e2b.app", "localhost"];

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5174, allowedHosts },
  preview: { host: "0.0.0.0", port: 4174, allowedHosts },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
