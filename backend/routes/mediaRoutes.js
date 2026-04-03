import express from "express";
import asyncHandler from "express-async-handler";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { isValidObjectKey } from "../utils/mediaImageUrls.js";

const router = express.Router();

function getBucketName() {
  return process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
}

function getS3Client() {
  const region = process.env.AWS_REGION?.trim();
  const bucket = getBucketName();
  if (!region || !bucket) {
    return null;
  }

  return new S3Client({ region });
}

router.get(
  "/s3",
  asyncHandler(async (req, res) => {
    const key = String(req.query.key || "").trim();

    if (!key || !isValidObjectKey(key)) {
      res.status(400).json({ message: "Invalid or missing object key" });
      return;
    }

    const client = getS3Client();
    const bucket = getBucketName();

    if (!client || !bucket) {
      res.status(503).json({ message: "S3 media is not configured" });
      return;
    }

    try {
      const out = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      const contentType = out.ContentType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");

      if (out.ContentLength != null) {
        res.setHeader("Content-Length", String(out.ContentLength));
      }

      const body = out.Body;
      if (body && typeof body.pipe === "function") {
        body.pipe(res);
        return;
      }

      const bytes = await out.Body.transformToByteArray();
      res.end(Buffer.from(bytes));
    } catch (err) {
      if (err?.name === "NoSuchKey" || err?.Code === "NoSuchKey") {
        res.status(404).end();
        return;
      }

      throw err;
    }
  })
);

export default router;
