import { dbgError } from "../utils/debugLog.js";

//if the route was not found, respond with a 404 not found
const notFound = (req, res, next) => {
  //we have access to the original route/url
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

//overwriting the default error handler
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image too large (max 5MB per file)"
        : err.message || "Upload failed";
    res.status(400);
    res.json({
      message,
      stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
    return;
  }

  if (err?.message === "Images only!") {
    res.status(400);
    res.json({
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
    return;
  }

  //you always want to look at the status code, sometimes it can be 200 but still have an error
  //make all 200 codes to 500 which means server error, otherwise set error to status code
  const statusCode =
    res.statusCode === 200 ? err.statusCode || 500 : res.statusCode;
  res.status(statusCode);
  //we always want to send json back, instead of default html
  if (dbgError.enabled && process.env.NODE_ENV !== "production") {
    dbgError("%s %s → %s", req.method, req.originalUrl, err.message);
    if (err.stack) {
      dbgError(err.stack);
    }
  }

  res.json({
    message: err.message,
    //have stack traced if we are in development, not production
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export { notFound, errorHandler };
