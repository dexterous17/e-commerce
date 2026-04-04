import path from "path";
import { fileURLToPath } from "url";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(frontendDir, "../env/frontend");

// Default API proxy: localhost:5002 (see env/backend/.env.example). macOS AirPlay often uses 5000 (403 for HTTP).
// Use DEV_PROXY_TARGET (not VITE_*): only VITE_-prefixed vars are meant for browser code;
// keeping the proxy URL out of that namespace avoids accidentally bundling it via import.meta.env.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const devProxyTarget =
    env.DEV_PROXY_TARGET ||
    env.VITE_DEV_PROXY_TARGET ||
    "http://localhost:5002";

  /**
   * Empty = same-origin `/api` (host nginx routes to the API container). Use this in production
   * when TLS terminates on the storefront hostname only (avoids blocked/mixed requests to a
   * separate API host). Set VITE_API_ORIGIN=https://backend.ecommerce.harshildex.com only when
   * that host is reachable with HTTPS and CORS allows the storefront origin.
   */
  const hasExplicitApiOrigin = Object.prototype.hasOwnProperty.call(
    env,
    "VITE_API_ORIGIN"
  );
  const mergedApiOrigin = (
    hasExplicitApiOrigin ? String(env.VITE_API_ORIGIN ?? "").trim() : ""
  ).replace(/\/$/, "");

  return {
    base: process.env.PUBLIC_URL || "/",
    define: {
      "import.meta.env.VITE_API_ORIGIN": JSON.stringify(mergedApiOrigin),
    },
    plugins: [
      react(),
      {
        name: "warn-airplay-proxy",
        configureServer(server) {
          server.httpServer?.once("listening", () => {
            try {
              const u = new URL(devProxyTarget);
              if (process.platform === "darwin" && u.port === "5000") {
                server.config.logger.warn(
                  "\n[Vite] Dev proxy uses port 5000. On macOS, AirPlay Receiver often occupies 5000 and returns 403 for API/upload proxies. Set DEV_PROXY_TARGET to your backend URL (e.g. http://localhost:5002) and run the API on that port.\n"
                );
              }
            } catch {
              /* ignore invalid URL */
            }
          });
        },
      },
    ],
    server: {
      host: true,
      port: 5173,
      strictPort: true, // match .vscode launch / Simple Browser (localhost:5173)
      proxy: {
        "/api": devProxyTarget,
        "/uploads": devProxyTarget,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("\\react-dom\\") ||
              id.includes("\\react\\")
            ) {
              return "react-vendor";
            }
            if (id.includes("react-router")) {
              return "router";
            }
            if (id.includes("redux") || id.includes("react-redux")) {
              return "redux";
            }
            if (id.includes("react-bootstrap") || id.includes("/bootstrap/")) {
              return "ui-bootstrap";
            }
          },
        },
      },
    },
  };
});
