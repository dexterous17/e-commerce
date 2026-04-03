import { Card, Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useState, useCallback, memo } from "react";
import { useDispatch } from "react-redux";

import "./Product.css";

import ProductModal from "../components/ProductModal";

import { addToCart } from "../actions/cartActions";
import { rewriteDirectS3ImageUrlToProxy } from "../utils/rewriteProductImageUrls";

const Product = memo(({ product, inCart }) => {
  const [modalShow, setModalShow] = useState(false);

  const {
    name,
    images,
    brand,
    nwt,
    size,
    price,
    countInStock,
    _id: id,
  } = product;

  const dispatch = useDispatch();

  const handleAddToCart = useCallback(() => {
    dispatch(addToCart(id, 1));
  }, [dispatch, id]);

  const handleModalClose = useCallback(() => {
    setModalShow(false);
  }, []);

  const openModal = useCallback(() => {
    setModalShow(true);
  }, []);

  return (
    <Card className="my-3 p-3 rounded text-dark shadow test">
      <Link to={`/products/${id}`}>
        <Card.Img
          src={rewriteDirectS3ImageUrlToProxy(images[0])}
          variant="top"
          className="position-relative product__image rounded"
          loading="lazy"
          decoding="async"
        />
      </Link>
      {nwt && <span className="nwt badge badge-pill badge-primary">NWT</span>}

      <div className="card-body m-0 p-0">
        <Link to={`/products/${id}`}>
          <Card.Text as="div" className="text-dark name__font pt-1">
            {name}
          </Card.Text>
        </Link>

        <Container className="px-0 d-flex justify-content-between pt-1">
          <Card.Text as="div">
            <strong>${price}</strong>
          </Card.Text>
          <Card.Text as="div" className="d-flex align-items-center">
            <small className="text-uppercase mr-1 size__font text-muted">
              size
            </small>
            <span className="badge badge-pill badge-primary">
              <strong>{size}</strong>
            </span>
          </Card.Text>
        </Container>

        <Card.Title className="my-1">
          <strong>{brand}</strong>
        </Card.Title>
      </div>

      <Card.Footer>
        <Button size="sm" block variant="primary" onClick={openModal}>
          Quick View
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          block
          onClick={handleAddToCart}
          disabled={countInStock < 1 || inCart}
        >
          {inCart
            ? "Item in Cart"
            : countInStock < 1
            ? "Out of Stock"
            : "Quick Add to Cart"}
        </Button>
      </Card.Footer>

      <ProductModal
        show={modalShow}
        onHide={handleModalClose}
        product={product}
        handleAddToCart={handleAddToCart}
        inCart={inCart}
      />
    </Card>
  );
});

Product.displayName = "Product";

export default Product;
