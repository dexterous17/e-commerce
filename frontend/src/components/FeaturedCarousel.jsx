import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { Link } from "react-router-dom";

//CSS
import "./FeaturedCarousel.css";

//components
import BunnyLoader from "./BunnyLoader";
import Message from "./Message";

//actions
import { listFeaturedProducts } from "../actions/productActions";
import { resolvePublicApiUrl } from "../apiBase";

const CAROUSEL_INTERVAL_MS = 5000;

const FeaturedCarousel = () => {
  const dispatch = useDispatch();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const featuredProducts = useSelector(
    (state) => state.productFeatured,
    shallowEqual
  );
  const { loading, error, products: rawProducts } = featuredProducts;
  const products = useMemo(
    () => (Array.isArray(rawProducts) ? rawProducts : []),
    [rawProducts]
  );
  const withImages = useMemo(
    () => products.filter((p) => p?.images?.[0]),
    [products]
  );

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
                src={resolvePublicApiUrl(product.images[0])}
                alt={product.name}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                {...(i === 0 ? { fetchpriority: "high" } : {})}
              />
              <div className="carousel-caption">
                <div className="featured-carousel__caption-inner">
                  <span className="featured-carousel__eyebrow">Featured</span>
                  <h2 className="featured-carousel__title">{product.name}</h2>
                  <p className="featured-carousel__meta">
                    <span className="featured-carousel__price">
                      ${product.price}
                    </span>
                    <span className="featured-carousel__hint" aria-hidden="true">
                      View
                    </span>
                  </p>
                </div>
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
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            aria-label="Previous slide"
          >
            <span className="carousel-control-prev-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="carousel-control-next"
            onClick={() => go(1)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
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
