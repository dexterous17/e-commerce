import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
//allows you to change colors of output to terminal
import colors from "colors";
import morgan from "morgan";

import "./config/loadEnv.js";
//routes
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";

import connectDB from "./config/db.js";
import { dbgServer } from "./utils/debugLog.js";
import { isImageProxyEnabled } from "./utils/mediaImageUrls.js";

//middleware
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const __backendDir = path.dirname(fileURLToPath(import.meta.url));

const app = express();

//only run morgan in development
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

//this will allow us to accept json data in the body
app.use(express.json());

//anything that comes to the route will be linked to productRoutes
app.use("/api/products", productRoutes);

//anything that comes to the route will be linked to userRoutes
app.use("/api/users", userRoutes);

//anything that comes to the route will be linked to orderRoutes
app.use("/api/orders", orderRoutes);

app.use("/api/upload", uploadRoutes);

app.use("/api/media", mediaRoutes);

//special route to access the paypal client id
app.get("/api/config/paypal", (req, res) =>
  res.send(process.env.PAYPAL_CLIENT_ID)
);

app.use("/uploads", express.static(path.join(__backendDir, "uploads")));

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

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    console.error(
      "JWT_SECRET is missing or empty. Add it to backend/.env (see .env.example), or set JWT_SECRET_FILE."
        .red.bold
    );
    console.error(`Expected env file: ${path.join(__backendDir, ".env")}`.yellow);
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
    } else {
      console.warn(
        "[S3 media] Image proxy OFF — product APIs return raw S3 URLs; browsers often see 403 on private buckets. Set AWS_REGION and AWS_S3_BUCKET_NAME (see backend/.env.example), avoid AWS_S3_IMAGE_PROXY=false unless intentional, then restart. If curl still shows https://…amazonaws.com, another process may still be bound to this port."
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
