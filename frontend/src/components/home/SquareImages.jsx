//CSS
import { useEffect, useState } from "react";
import axios from "axios";

import BunnyLoader from "../BunnyLoader";
import Message from "../Message";
import { resolvePublicApiUrl } from "../../apiBase";
import { rewriteDirectS3ImageUrlToProxy } from "../../utils/rewriteProductImageUrls";

import "./SquareImages.css";

const GALLERY_SLOTS = 14;

const POSITION_CLASSES = [
  "gallery__item gallery__item--1",
  "gallery__item gallery__item--2",
  "gallery__item gallery__item--3",
  "gallery__item gallery__item--4",
  "gallery__item gallery__item--5",
  "gallery__item gallery__item--6",
  "gallery__item gallery__item--7",
  "gallery__item gallery__item--8",
  "gallery__item gallery__item--9",
  "gallery__item gallery__item--10",
  "gallery__item gallery__item--11",
  "gallery__item gallery__item--12",
  "gallery__item gallery__item--13",
  "gallery__item gallery__item--14",
];

function gallerySrc(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "";
  }
  const t = url.trim();
  if (t.startsWith("/api/media/s3") || t.includes("/api/media/s3?")) {
    return resolvePublicApiUrl(t);
  }
  if (/^https?:\/\//i.test(t)) {
    return rewriteDirectS3ImageUrlToProxy(t);
  }
  /** /uploads/... — root-relative unless SPA and API use different hosts */
  return resolvePublicApiUrl(t.startsWith("/") ? t : `/${t}`);
}

/**
 * Home collage: uses live catalog images instead of hardcoded /uploads/image_*.jpg
 * (those files are not shipped in the repo and 404 in production).
 */
const SquareImages = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get("/api/products", {
          params: { pageNumber: 1, pageSize: 40, keyword: "", filter: "" },
        });
        const products = data?.products || [];
        const withImage = products.filter((p) => p?.images?.[0]);
        const slice = withImage.slice(0, GALLERY_SLOTS).map((p, i) => ({
          key: p._id || `g-${i}`,
          src: gallerySrc(p.images[0]),
          alt: p.name || `Gallery ${i + 1}`,
          className: POSITION_CLASSES[i] ?? POSITION_CLASSES[0],
        }));
        if (!cancelled) {
          setItems(slice);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e.response?.data?.message ||
              e.message ||
              "Could not load gallery images."
          );
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="gallery-section"
      aria-label="Boutique photo collage and welcome"
    >
      <div className="gallery">
        {loading && (
          <div className="gallery__loading" aria-busy="true">
            <BunnyLoader />
          </div>
        )}
        {!loading && error && (
          <div className="gallery__message">
            <Message variant="warning">{error}</Message>
          </div>
        )}
        {!loading &&
          items.map((image, index) => (
            <figure key={image.key} className={image.className}>
              <img
                src={image.src}
                alt={image.alt}
                className="gallery__img"
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </figure>
          ))}
      </div>
      <div className="welcome-box">
        <h2>Welcome to my shop!</h2>
        <h1>Tailored by Boutique</h1>
      </div>
    </section>
  );
};

export default SquareImages;
