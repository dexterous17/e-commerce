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
  const product = await createProductRecord({
    user: req.user._id,
    name: "Name",
    nwt: false,
    brand: "Brand",
    price: 0,
    size: "Size",
    description: "Description",
    sex: "Sex",
    category: "Category",
    subCategory: "Sub Category",
    color: "Color",
    subColor: "subColor",
    countInStock: 0,
    images: [],
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

  const imagesForStore = Array.isArray(req.body.images)
    ? canonicalizeImageUrlsForStorage(req.body.images)
    : req.body.images;

  const updatedProduct = await updateProductById(req.params.id, {
    user: existingProduct.user,
    name: req.body.name,
    nwt: req.body.nwt,
    brand: req.body.brand,
    price: req.body.price,
    size: req.body.size,
    description: req.body.description,
    sex: req.body.sex,
    category: req.body.category,
    subCategory: req.body.subCategory,
    color: req.body.color,
    subColor: req.body.subColor,
    countInStock: req.body.countInStock,
    images: imagesForStore,
  });

  res.status(201).json(mapProductImagesForApi(updatedProduct));
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
