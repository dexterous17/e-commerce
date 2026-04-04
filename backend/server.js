import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
//allows you to change colors of output to terminal
import colors from "colors";
import morgan from "morgan";

import "./config/loadEnv.js";
import {
  preferredBackendEnvPath,
  resolvedBackendEnvPath,
} from "./config/repoEnvPaths.js";
//routes
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import { paypalWebhookHandler } from "./routes/paypalWebhookRoutes.js";

import connectDB from "./config/db.js";
import { dbgServer } from "./utils/debugLog.js";
import { isImageProxyEnabled } from "./utils/mediaImageUrls.js";

//middleware
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import {
  applyCors,
  applyHelmet,
  applyRateLimits,
  applyTrustProxy,
} from "./middleware/securityMiddleware.js";

const __backendDir = path.dirname(fileURLToPath(import.meta.url));

const app = express();

applyTrustProxy(app);
applyHelmet(app);
applyCors(app);

//only run morgan in development
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.post(
  "/api/webhooks/paypal",
  express.raw({
    type: (req) =>
      String(req.headers["content-type"] || "").includes("application/json"),
    limit: "512kb",
  }),
  paypalWebhookHandler
);

//this will allow us to accept json data in the body
app.use(express.json({ limit: "1mb" }));
applyRateLimits(app);

//anything that comes to the route will be linked to productRoutes
app.use("/api/products", productRoutes);

//anything that comes to the route will be linked to userRoutes
app.use("/api/users", userRoutes);

//anything that comes to the route will be linked to orderRoutes
app.use("/api/orders", orderRoutes);

app.use("/api/upload", uploadRoutes);

app.use("/api/media", mediaRoutes);

// Public PayPal client id (safe to expose; used by the browser SDK)
app.get("/api/config/paypal", (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  if (!clientId) {
    res.status(503).json({ message: "PayPal is not configured" });
    return;
  }
  res.json({ clientId });
});

/** Confirms this Node process is the API and whether S3 image URLs are rewritten for clients. */
app.get("/api/health", (req, res) => {
  const awsKeysInEnv = Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
  res.json({
    ok: true,
    s3ImageProxy: isImageProxyEnabled(),
    /** False does not rule out IAM/instance roles; true means static keys are in env. */
    awsAccessKeyEnvSet: awsKeysInEnv,
    listenPort: Number.parseInt(process.env.PORT || "5002", 10),
    nodeEnv: process.env.NODE_ENV || null,
  });
});

app.use("/uploads", express.static(path.join(__backendDir, "uploads")));
app.use("/upload", express.static(path.join(__backendDir, "upload")));

const frontendDistRoot = path.join(__backendDir, "../frontend", "dist");
const shouldServeFrontend =
  process.env.SERVE_FRONTEND === "true" ||
  (process.env.NODE_ENV === "production" && fs.existsSync(frontendDistRoot));

if (shouldServeFrontend) {
  app.use(express.static(frontendDistRoot));
  app.get("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile("index.html", { root: frontendDistRoot });
  });
} else {
  app.get("/", (req, res) => {
    res.send("API IS RUNNING......");
  });
}

//if the route was not found, respond with a 404 not found
app.use(notFound);

//overwriting the default error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5002;

const startServer = async () => {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    console.error(
      "JWT_SECRET is missing or empty. Add it to env/backend/.env (see env/backend/.env.example), or set JWT_SECRET_FILE."
        .red.bold
    );
    console.error(
      `Expected env file: ${resolvedBackendEnvPath ?? preferredBackendEnvPath}`.yellow
    );
    process.exit(1);
  }
  process.env.JWT_SECRET = jwtSecret;

  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(
      `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
    );
    dbgServer("listening on %s (NODE_ENV=%s)", PORT, process.env.NODE_ENV);

    if (isImageProxyEnabled()) {
      console.log(
        "[S3 media] Image proxy ON — product APIs return /api/media/s3?key=… (not direct S3 URLs)."
          .green
      );
    } else if (process.env.NODE_ENV === "production") {
      console.log(
        "[S3 media] Production — product APIs return direct AWS image URLs (set AWS_S3_PUBLIC_BASE_URL in env/aws for a stable public base). Use AWS_S3_IMAGE_PROXY=true only if you need the backend to stream from a private bucket."
          .green
      );
    } else {
      console.warn(
        "[S3 media] Image proxy OFF — product APIs return raw S3 URLs; browsers often see 403 on private buckets. Set AWS_REGION and AWS_S3_BUCKET_NAME (see env/aws/.env.example), avoid AWS_S3_IMAGE_PROXY=false unless intentional, then restart. If curl still shows https://…amazonaws.com, another process may still be bound to this port."
          .yellow
      );
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      const alt = Number(PORT) + 1 || 5002;
      console.error(
        `Port ${PORT} is already in use. Stop the other listener (e.g. duplicate \`npm start\`, or \`docker compose stop backend\` if the stack maps this host port), check with \`lsof -iTCP:${PORT} -sTCP:LISTEN\`, or use another port: PORT=${alt} npm start`
          .red.bold
      );
      process.exit(1);
    }
    throw err;
  });
};

startServer();
