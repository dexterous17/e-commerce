import asyncHandler from "express-async-handler";

import {
  createUser,
  deleteUserById,
  findUserByEmail,
  getUserById as getUserByIdRecord,
  listUsers,
  matchPassword,
  updateUserById,
} from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";

function buildAuthResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    token: generateToken(user._id),
  };
}

async function ensureEmailIsAvailable(email, currentUserId = null) {
  const existingUser = await findUserByEmail(email);

  if (existingUser && existingUser._id !== currentUserId) {
    const error = new Error("User already exists");
    error.statusCode = 400;
    throw error;
  }
}

// @desc      Auth user & get token
// @route     POST /api/users/login
// @access    public
export const authUser = asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const password = req.body?.password;

  if (!email || password == null || String(password).length === 0) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await findUserByEmail(email, { includePassword: true });

  if (user && (await matchPassword(password, user.password))) {
    res.json(buildAuthResponse(user));
    return;
  }

  res.status(401);
  throw new Error("Invalid email or password");
});

// @desc      register a new user
// @route     POST /api/users
// @access    public
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerUser = asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = req.body?.password;

  if (!name) {
    res.status(400);
    throw new Error("Name is required");
  }
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400);
    throw new Error("A valid email is required");
  }
  if (password == null || String(password).length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  try {
    await ensureEmailIsAvailable(email);
  } catch (error) {
    res.status(error.statusCode || 400);
    throw error;
  }

  const user = await createUser({
    name,
    email,
    password,
  });

  res.status(201).json(buildAuthResponse(user));
});

// @desc      get user profile
// @route     GET /api/users/profile
// @access    private
export const getUserProfile = asyncHandler(async (req, res) => {
  const user = await getUserByIdRecord(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json(user);
});

// @desc      update user profile
// @route     PUT /api/users/profile
// @access    private
export const updateUserProfile = asyncHandler(async (req, res) => {
  const existingUser = await getUserByIdRecord(req.user._id);

  if (!existingUser) {
    res.status(404);
    throw new Error("User not found");
  }

  const nextEmail = req.body.email || existingUser.email;

  try {
    await ensureEmailIsAvailable(nextEmail, existingUser._id);
  } catch (error) {
    res.status(error.statusCode || 400);
    throw error;
  }

  const updatedUser = await updateUserById(existingUser._id, {
    name: req.body.name || existingUser.name,
    email: nextEmail,
    ...(req.body.password ? { password: req.body.password } : {}),
  });

  res.json(buildAuthResponse(updatedUser));
});

// @desc      get all user profile
// @route     GET /api/users/
// @access    private/admin only
export const getUsers = asyncHandler(async (req, res) => {
  res.json(await listUsers());
});

// @desc      delete a user profile
// @route     DELETE /api/users/:id
// @access    private/admin only
export const deleteUser = asyncHandler(async (req, res) => {
  const removed = await deleteUserById(req.params.id);

  if (!removed) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({ message: "User removed" });
});

// @desc      get an individual user profile by id
// @route     GET /api/users/:id
// @access    private/admin only
export const getUserByIdHandler = asyncHandler(async (req, res) => {
  const user = await getUserByIdRecord(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json(user);
});

// @desc      update user
// @route     PUT /api/users/:id
// @access    private/admin only
export const updateUser = asyncHandler(async (req, res) => {
  const existingUser = await getUserByIdRecord(req.params.id);

  if (!existingUser) {
    res.status(404);
    throw new Error("User not found");
  }

  const nextEmail = req.body.email || existingUser.email;

  try {
    await ensureEmailIsAvailable(nextEmail, existingUser._id);
  } catch (error) {
    res.status(error.statusCode || 400);
    throw error;
  }

  const updatedUser = await updateUserById(existingUser._id, {
    name: req.body.name || existingUser.name,
    email: nextEmail,
    isAdmin:
      req.body.isAdmin === undefined ? existingUser.isAdmin : req.body.isAdmin,
  });

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    isAdmin: updatedUser.isAdmin,
  });
});

export { getUserByIdHandler as getUserById };
