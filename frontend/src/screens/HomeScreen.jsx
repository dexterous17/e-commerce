import { lazy, Suspense } from "react";

//components
import Meta from "../components/Meta";

const FeaturedCarousel = lazy(() => import("../components/FeaturedCarousel"));
const SquareImages = lazy(() => import("../components/home/SquareImages"));

const HomeScreen = () => {
  return (
    <>
      <Meta title="Tailored by Boutique - Welcome" />
      <Suspense fallback={null}>
        <FeaturedCarousel />
      </Suspense>
      <Suspense fallback={null}>
        <SquareImages />
      </Suspense>
    </>
  );
};

export default HomeScreen;
