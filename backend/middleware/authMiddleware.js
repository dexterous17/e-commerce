import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";

import { getUserById } from "../models/userModel.js";
import { dbgAuth } from "../utils/debugLog.js";

//next will call the next middleware
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });

      req.user = await getUserById(decoded.id);

      if (!req.user) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      next();
      return;
    } catch (error) {
      dbgAuth("JWT verify failed: %s", error?.message || error);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  res.status(401);
  throw new Error("Not authorized, no token");
});

export const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
    return;
  }
  res.status(403);
  next(new Error("Not authorized as an admin"));
};
