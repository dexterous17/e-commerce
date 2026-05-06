import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";

//components
import Message from "../components/Message";
import BunnyLoader from "../components/BunnyLoader";
import FormContainer from "../components/FormContainer";
import Meta from "../components/Meta";

//actions
import { listProductDetails, updateProduct } from "../actions/productActions";

//constants ACTIONS
import { PRODUCT_UPDATE_RESET } from "../constants/productConstants";

function ProductEditForm({ product, productId, userInfo, dispatch }) {
  const imageSeed =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.join(", ")
      : "";

  const [name, setName] = useState(product.name);
  const [nwt, setNwt] = useState(Boolean(product.nwt));
  const [brand, setBrand] = useState(product.brand);
  const [price, setPrice] = useState(product.price);
  const [size, setSize] = useState(product.size);
  const [description, setDescription] = useState(product.description);
  const [sex, setSex] = useState(product.sex);
  const [category, setCategory] = useState(product.category);
  const [subCategory, setSubCategory] = useState(product.subCategory);
  const [color, setColor] = useState(product.color);
  const [subColor, setSubColor] = useState(product.subColor);
  const [countInStock, setCountInStock] = useState(product.countInStock);
  const [images, setImages] = useState(imageSeed);
  const [uploading, setUploading] = useState(false);

  const submitHandler = (e) => {
    e.preventDefault();
    dispatch(
      updateProduct({
        _id: productId,
        name,
        nwt,
        brand,
        price,
        size,
        description,
        sex,
        category,
        subCategory,
        color,
        subColor,
        countInStock,
        images: images.split(","),
      })
    );
  };

  const uploadFileHandler = async (e) => {
    const files = e.target.files;
    const formData = new FormData();

    for (let i = 0; i < files.length; i++) {
      formData.append("image", files[i]);
    }

    setUploading(true);

    try {
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      const { data } = await axios.post("/api/upload", formData, config);
      let paths = data.map((item) => "/" + item.path);
      paths = paths.join(", ");

      setImages(!images ? paths : `${images}, ${paths}`);
      setUploading(false);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  return (
    <Form onSubmit={submitHandler}>
      <Form.Group controlId="name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="nwt">
        <Form.Check
          type="checkbox"
          label="NWT?"
          checked={nwt}
          onChange={(e) => setNwt(e.target.checked)}
        />
      </Form.Group>

      <Form.Group controlId="brand">
        <Form.Label>Brand</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="price">
        <Form.Label>Price</Form.Label>
        <Form.Control
          type="number"
          placeholder="Enter Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="size">
        <Form.Label>Size</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={6}
          placeholder="Enter Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="sex">
        <Form.Label>Sex</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Sex"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="category">
        <Form.Label>Category</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="subCategory">
        <Form.Label>sub Category</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Sub Category"
          value={subCategory}
          onChange={(e) => setSubCategory(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="color">
        <Form.Label>Color</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="subColor">
        <Form.Label>Sub Color</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Sub Color"
          value={subColor}
          onChange={(e) => setSubColor(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="countInStock">
        <Form.Label>Count In Stock</Form.Label>
        <Form.Control
          type="number"
          placeholder="Enter Count In Stock"
          value={countInStock}
          onChange={(e) => setCountInStock(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="images">
        <Form.Label>Images</Form.Label>
        <Form.File
          className="mb-2"
          id="image-file"
          label="Choose File"
          multiple
          custom
          onChange={uploadFileHandler}
        />
        {uploading && <BunnyLoader />}
        <Form.Control
          as="textarea"
          rows={16}
          placeholder="Enter Images"
          value={images}
          onChange={(e) => setImages(e.target.value)}
        />
      </Form.Group>

      <Button type="submit" variant="secondary">
        Update
      </Button>
    </Form>
  );
}

const ProductEditScreen = () => {
  const { id: productId } = useParams();
  const navigate = useNavigate();

  const dispatch = useDispatch();

  const productDetails = useSelector((state) => state.productDetails);
  const { loading, error, product } = productDetails;

  const productUpdate = useSelector((state) => state.productUpdate);
  const {
    loading: loadingUpdate,
    error: errorUpdate,
    success: successUpdate,
  } = productUpdate;

  const userLogin = useSelector((state) => state.userLogin);
  const { userInfo } = userLogin;

  useEffect(() => {
    if (successUpdate) {
      dispatch({
        type: PRODUCT_UPDATE_RESET,
      });
      navigate("/admin/productlist");
    }
  }, [successUpdate, dispatch, navigate]);

  useEffect(() => {
    if (!successUpdate && (!product?.name || product?._id !== productId)) {
      dispatch(listProductDetails(productId));
    }
  }, [dispatch, successUpdate, productId, product?.name, product?._id]);

  return (
    <>
      <Link to="/admin/productlist" className="btn btn-outline-secondary mb-3">
        Go Back to All Products
      </Link>
      <FormContainer>
        <h1>Edit Product</h1>
        {loadingUpdate && <BunnyLoader />}
        {errorUpdate && <Message variant="danger">{errorUpdate}</Message>}

        {loading ? (
          <BunnyLoader />
        ) : error ? (
          <Message variant="danger">{error}</Message>
        ) : product?._id === productId && userInfo ? (
          <ProductEditForm
            key={product._id}
            product={product}
            productId={productId}
            userInfo={userInfo}
            dispatch={dispatch}
          />
        ) : (
          <BunnyLoader />
        )}
      </FormContainer>
      <Meta title="Tailored by Boutique - Edit Product" />
    </>
  );
};

export default ProductEditScreen;
