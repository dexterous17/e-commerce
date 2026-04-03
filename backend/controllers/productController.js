import asyncHandler from "express-async-handler";

import {
  createProduct as createProductRecord,
  deleteProductById,
  getFeaturedProducts as getFeaturedProductsList,
  getProductById as getProductByIdRecord,
  listProducts,
  setProductInventoryToZero,
  updateProductById,
} from "../models/productModel.js";
import {
  canonicalizeImageUrlsForStorage,
  mapProductImagesForApi,
  mapProductListResponseForApi,
} from "../utils/mediaImageUrls.js";

// @desc      Fetch all products
// @route     GET /api/products/
// @access    public
export const getProducts = asyncHandler(async (req, res) => {
  const products = await listProducts({
    keyword: req.query.keyword || "",
    filter: req.query.filter || "name",
    page: Number.parseInt(req.query.pageNumber || "1", 10),
    pageSize: Number.parseInt(req.query.pageSize || "50", 10),
  });

  res.json(mapProductListResponseForApi(products));
});

// @desc      Fetch single product
// @route     GET /api/products/:id
// @access    public
export const getProductByIdHandler = asyncHandler(async (req, res) => {
  const product = await getProductByIdRecord(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json(mapProductImagesForApi(product));
});

// @desc      SETS INVENTORY TO ZERO
// @route     PATCH /api/products/:id
// @access    private/admin
export const productRemoveInventory = asyncHandler(async (req, res) => {
  const product = await setProductInventoryToZero(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json({ message: "Product inventory set to 0" });
});

// @desc      DELETE a product
// @route     DELETE /api/products/:id
// @access    private/admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const removed = await deleteProductById(req.params.id);

  if (!removed) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json({ message: "Product removed" });
});

// @desc      Create a product
// @route     POST /api/products
// @access    private/admin
export const createProductHandler = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = String(body.name ?? "").trim();
  if (!name) {
    res.status(400);
    throw new Error("Product name is required");
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400);
    throw new Error("A valid non-negative price is required");
  }

  const description = String(body.description ?? "").trim();
  const category = String(body.category ?? "").trim();
  const color = String(body.color ?? "").trim();
  if (!description || !category || !color) {
    res.status(400);
    throw new Error("Description, category, and color are required");
  }

  const imagesForStore = Array.isArray(body.images)
    ? canonicalizeImageUrlsForStorage(body.images)
    : [];

  const countInStock = Number(body.countInStock ?? 0);
  if (!Number.isFinite(countInStock) || countInStock < 0 || !Number.isInteger(countInStock)) {
    res.status(400);
    throw new Error("countInStock must be a non-negative integer");
  }

  const product = await createProductRecord({
    user: req.user._id,
    name,
    nwt: Boolean(body.nwt),
    brand: body.brand != null ? String(body.brand).trim() || null : null,
    price,
    size: body.size != null ? String(body.size).trim() || null : null,
    description,
    sex: body.sex != null ? String(body.sex).trim() || null : null,
    category,
    subCategory:
      body.subCategory != null ? String(body.subCategory).trim() || null : null,
    color,
    subColor: body.subColor != null ? String(body.subColor).trim() || null : null,
    countInStock,
    images: imagesForStore,
  });

  res.status(201).json(mapProductImagesForApi(product));
});

// @desc      Update a product
// @route     PUT /api/products/:id
// @access    private/admin
export const updateProduct = asyncHandler(async (req, res) => {
  const existingProduct = await getProductByIdRecord(req.params.id);

  if (!existingProduct) {
    res.status(404);
    throw new Error("Product not found");
  }

  const b = req.body || {};

  let name = existingProduct.name;
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) {
      res.status(400);
      throw new Error("Product name cannot be empty");
    }
    name = n;
  }

  let price = existingProduct.price;
  if (b.price !== undefined) {
    const p = Number(b.price);
    if (!Number.isFinite(p) || p < 0) {
      res.status(400);
      throw new Error("A valid non-negative price is required");
    }
    price = p;
  }

  const nwt = b.nwt !== undefined ? Boolean(b.nwt) : existingProduct.nwt;

  const strOr = (v, fallback) =>
    v !== undefined
      ? v === null
        ? null
        : String(v).trim() || null
      : fallback;

  let description = existingProduct.description;
  if (b.description !== undefined) {
    const d = String(b.description).trim();
    if (!d) {
      res.status(400);
      throw new Error("Description cannot be empty");
    }
    description = d;
  }

  let category = existingProduct.category;
  if (b.category !== undefined) {
    const c = String(b.category).trim();
    if (!c) {
      res.status(400);
      throw new Error("Category cannot be empty");
    }
    category = c;
  }

  let color = existingProduct.color;
  if (b.color !== undefined) {
    const c = String(b.color).trim();
    if (!c) {
      res.status(400);
      throw new Error("Color cannot be empty");
    }
    color = c;
  }

  let imagesForStore = existingProduct.images;
  if (Array.isArray(b.images)) {
    imagesForStore = canonicalizeImageUrlsForStorage(b.images);
  } else if (Object.prototype.hasOwnProperty.call(b, "images")) {
    imagesForStore = [];
  }

  let countInStock = existingProduct.countInStock;
  if (b.countInStock !== undefined) {
    const c = Number(b.countInStock);
    if (!Number.isFinite(c) || c < 0 || !Number.isInteger(c)) {
      res.status(400);
      throw new Error("countInStock must be a non-negative integer");
    }
    countInStock = c;
  }

  const updatedProduct = await updateProductById(req.params.id, {
    user: existingProduct.user,
    name,
    nwt,
    brand: strOr(b.brand, existingProduct.brand),
    price,
    size: strOr(b.size, existingProduct.size),
    description,
    sex: strOr(b.sex, existingProduct.sex),
    category,
    subCategory: strOr(b.subCategory, existingProduct.subCategory),
    color,
    subColor: strOr(b.subColor, existingProduct.subColor),
    countInStock,
    images: imagesForStore,
  });

  res.json(mapProductImagesForApi(updatedProduct));
});

// @desc      get featured products
// @route     GET /api/products/featured
// @access    public
export const getFeaturedProductsHandler = asyncHandler(async (req, res) => {
  const list = await getFeaturedProductsList();
  res.json(list.map(mapProductImagesForApi));
});

export {
  createProductHandler as createProduct,
  getFeaturedProductsHandler as getFeaturedProducts,
  getProductByIdHandler as getProductById,
};
