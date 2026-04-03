import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await import(path.resolve(__dirname, "../config/loadEnv.js"));

const port = Number.parseInt(process.env.PORT || "5002", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

await new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once("error", reject);
  s.once("listening", () => {
    s.close(() => resolve());
  });
  s.listen(port);
}).catch((err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `\nPort ${port} is already in use. Another process is still listening.\n` +
        "Common cases:\n" +
        "  • Old host API: stale node server → direct S3 image URLs and 403 in the browser.\n" +
        "  • Docker: `docker compose up backend` publishes this host port — stop it (`docker compose stop backend`) or pick another PORT.\n\n" +
        "Inspect and free the port, then run npm start again:\n" +
        `  lsof -iTCP:${port} -sTCP:LISTEN\n` +
        `  kill $(lsof -t -iTCP:${port} -sTCP:LISTEN)\n\n` +
        "Or use a free port and point Vite at it:\n" +
        `  PORT=5003 npm start\n` +
        "  # frontend/.env → DEV_PROXY_TARGET=http://localhost:5003\n"
    );
    process.exit(1);
  }
  throw err;
});
