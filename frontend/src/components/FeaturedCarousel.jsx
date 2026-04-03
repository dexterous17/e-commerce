import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";

//CSS
import "./FeaturedCarousel.css";

//components
import BunnyLoader from "./BunnyLoader";
import Message from "./Message";

//actions
import { listFeaturedProducts } from "../actions/productActions";
import { rewriteDirectS3ImageUrlToProxy } from "../utils/rewriteProductImageUrls";

const CAROUSEL_INTERVAL_MS = 5000;

const FeaturedCarousel = () => {
  const dispatch = useDispatch();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const featuredProducts = useSelector((state) => state.productFeatured);
  const { loading, error, products: rawProducts } = featuredProducts;
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const withImages = products.filter((p) => p?.images?.[0]);

  useEffect(() => {
    dispatch(listFeaturedProducts());
  }, [dispatch]);

  useEffect(() => {
    setIndex((i) => {
      if (withImages.length === 0) return 0;
      return Math.min(i, withImages.length - 1);
    });
  }, [withImages.length]);

  useEffect(() => {
    if (withImages.length <= 1 || paused) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % withImages.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [withImages.length, paused]);

  const go = (delta) => {
    setIndex((i) => {
      const n = withImages.length;
      return (i + delta + n) % n;
    });
  };

  return loading ? (
    <BunnyLoader />
  ) : error ? (
    <Message variant="danger">{error}</Message>
  ) : withImages.length === 0 ? null : (
    <div
      className="carousel slide bg-dark featured-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {withImages.length > 1 && (
        <ol className="carousel-indicators">
          {withImages.map((product, i) => (
            <li
              key={product._id}
              className={i === index ? "active" : undefined}
            >
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1} of ${withImages.length}`}
                aria-current={i === index ? "true" : undefined}
              />
            </li>
          ))}
        </ol>
      )}
      <div className="carousel-inner">
        {withImages.map((product, i) => (
          <div
            key={product._id}
            className={`carousel-item${i === index ? " active" : ""}`}
          >
            <Link to={`/products/${product._id}`}>
              <img
                className="img-fluid"
                src={rewriteDirectS3ImageUrlToProxy(product.images[0])}
                alt={product.name}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                {...(i === 0 ? { fetchpriority: "high" } : {})}
              />
              <div className="carousel-caption">
                <h2>
                  {product.name} (${product.price})
                </h2>
              </div>
            </Link>
          </div>
        ))}
      </div>
      {withImages.length > 1 && (
        <>
          <button
            type="button"
            className="carousel-control-prev"
            onClick={() => go(-1)}
            aria-label="Previous slide"
          >
            <span className="carousel-control-prev-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="carousel-control-next"
            onClick={() => go(1)}
            aria-label="Next slide"
          >
            <span className="carousel-control-next-icon" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
};

export default FeaturedCarousel;
