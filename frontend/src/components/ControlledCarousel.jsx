import { Image, Button } from "react-bootstrap";
import { useState, useMemo, useEffect } from "react";

import { rewriteDirectS3ImageUrlToProxy } from "../utils/rewriteProductImageUrls";

const ControlledCarousel = ({ product }) => {
  const { images: rawImages, name } = product;

  const filteredImages = useMemo(
    () => (rawImages || []).filter((image) => image && image.length > 2),
    [rawImages]
  );

  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [product._id]);

  useEffect(() => {
    if (filteredImages.length === 0) return;
    setImageIndex((i) => Math.min(i, filteredImages.length - 1));
  }, [filteredImages.length]);

  const changeImageLeft = () => {
    if (filteredImages.length === 0) return;
    setImageIndex((i) => (i === 0 ? filteredImages.length - 1 : i - 1));
  };

  const changeImageRight = () => {
    if (filteredImages.length === 0) return;
    setImageIndex((i) =>
      i === filteredImages.length - 1 ? 0 : i + 1
    );
  };

  if (filteredImages.length === 0) {
    return null;
  }

  return (
    <>
      <Image
        src={rewriteDirectS3ImageUrlToProxy(filteredImages[imageIndex])}
        alt={name}
        fluid
        className="w-100"
        loading={imageIndex === 0 ? undefined : "lazy"}
        decoding="async"
      />
      <div className="d-flex mt-2 mb-2">
        <Button variant="outline-dark" block onClick={changeImageLeft}>
          Previous
        </Button>
        <Button
          variant="dark"
          block
          className="h-100 mt-0"
          onClick={changeImageRight}
        >
          Next
        </Button>
      </div>
    </>
  );
};

export default ControlledCarousel;
