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
      `\nPort ${port} is already in use. Another process is still listening (often an old \`node server.js\`).\n` +
        "That listener keeps serving stale code — for example product APIs return direct S3 URLs while the bucket is private (images 403 in the browser).\n\n" +
        "Free the port, then run npm start again:\n" +
        `  lsof -iTCP:${port} -sTCP:LISTEN\n` +
        `  kill $(lsof -t -iTCP:${port} -sTCP:LISTEN)\n`
    );
    process.exit(1);
  }
  throw err;
});
