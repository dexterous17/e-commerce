import { Image, Button } from "react-bootstrap";
import { useState, useMemo } from "react";

import { resolvePublicApiUrl } from "../lib/apiBase";

const ControlledCarousel = ({ product }) => {
  const { images: rawImages, name } = product;

  const filteredImages = useMemo(
    () => (rawImages || []).filter((image) => image && image.length > 2),
    [rawImages]
  );

  const [imageIndex, setImageIndex] = useState(0);

  const cappedIndex =
    filteredImages.length === 0
      ? 0
      : Math.min(imageIndex, filteredImages.length - 1);

  const changeImageLeft = () => {
    if (filteredImages.length === 0) return;
    setImageIndex((i) => {
      const cur = Math.min(i, filteredImages.length - 1);
      return cur === 0 ? filteredImages.length - 1 : cur - 1;
    });
  };

  const changeImageRight = () => {
    if (filteredImages.length === 0) return;
    setImageIndex((i) => {
      const cur = Math.min(i, filteredImages.length - 1);
      return cur === filteredImages.length - 1 ? 0 : cur + 1;
    });
  };

  if (filteredImages.length === 0) {
    return null;
  }

  return (
    <>
      <Image
        src={resolvePublicApiUrl(filteredImages[cappedIndex])}
        alt={name}
        fluid
        className="w-100"
        loading={cappedIndex === 0 ? undefined : "lazy"}
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
