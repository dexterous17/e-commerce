import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Carousel, Image } from "react-bootstrap";

//CSS
import "./FeaturedCarousel.css";

//components
import BunnyLoader from "./BunnyLoader";
import Message from "./Message";

//actions
import { listFeaturedProducts } from "../actions/productActions";
import { rewriteDirectS3ImageUrlToProxy } from "../utils/rewriteProductImageUrls";

const FeaturedCarousel = () => {
  const dispatch = useDispatch();

  const featuredProducts = useSelector((state) => state.productFeatured);
  const { loading, error, products: rawProducts } = featuredProducts;
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const withImages = products.filter((p) => p?.images?.[0]);

  useEffect(() => {
    dispatch(listFeaturedProducts());
  }, [dispatch]);

  return loading ? (
    <BunnyLoader />
  ) : error ? (
    <Message variant="danger">{error}</Message>
  ) : withImages.length === 0 ? null : (
    <Carousel pause="hover" className="bg-dark featured-carousel">
      {withImages.map((product, index) => (
        <Carousel.Item key={product._id}>
          <Link to={`/products/${product._id}`}>
            <Image
              src={rewriteDirectS3ImageUrlToProxy(product.images[0])}
              alt={product.name}
              fluid
              loading={index === 0 ? undefined : "lazy"}
              decoding="async"
              {...(index === 0 ? { fetchPriority: "high" } : {})}
            />
            <Carousel.Caption className="carousel-caption">
              <h2>
                {product.name} (${product.price})
              </h2>
            </Carousel.Caption>
          </Link>
        </Carousel.Item>
      ))}
    </Carousel>
  );
};

export default FeaturedCarousel;
