import { Row, Col } from "react-bootstrap";
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector, shallowEqual } from "react-redux";

//actions
import { listProducts } from "../store/actions/productActions";

//components
import Product from "../components/Product";
import BunnyLoader from "../components/BunnyLoader";
import Message from "../components/Message";
import Paginate from "../components/Paginate";
import Meta from "../components/Meta";

const AllProductsScreen = () => {
  const { keyword: keywordParam, filter: filterParam, pageNumber: pageParam } =
    useParams();
  const keyword = keywordParam ? decodeURIComponent(keywordParam) : undefined;
  const filter = filterParam ?? "";
  const pageNumber = pageParam ? Number(pageParam) : 1;
  //to use disatch you must define and call it
  const pageSize = 50;
  //to use disatch you must define and call it
  const dispatch = useDispatch();

  const { productList, cartItems } = useSelector(
    (state) => ({
      productList: state.productList,
      cartItems: state.cart.cartItems,
    }),
    shallowEqual
  );

  const { loading, error, products, page, pages, count } = productList;

  const cartProductIds = useMemo(
    () => new Set(cartItems.map((item) => item.product)),
    [cartItems]
  );

  //useEffect takes a list of dependencies, it will fire off whenever any of those dependencies changes
  useEffect(() => {
    //fire off the listProducts action creator to fetch all the products
    //will also account for narrowing down the results if there is a keyword
    dispatch(listProducts(keyword ?? "", pageNumber, pageSize, filter));
  }, [dispatch, keyword, pageNumber, pageSize, filter]);

  return (
    <>
      <Meta title="Tailored by Boutique - Shopping" />
      {/* check the loading state to, loading icon if its loading, , check for error and render all the product cards if it is not */}
      {loading ? (
        <BunnyLoader />
      ) : error ? (
        //danger is red because it is an error
        <Message variant="danger">
          <h3>{error}</h3>
        </Message>
      ) : (
        <>
          <h1>Latest Products</h1>
          <h2>
            {keyword &&
              count > 4 &&
              `There is a total of ${count} items that meet the criteria of ${keyword} in ${filter}.`}
          </h2>
          {count === 0 && (
            <h2>There are currently no items. Please check back later!</h2>
          )}
          {!keyword && count !== 0 && (
            <h2>
              There are currently {count} items available. Happy shopping!
            </h2>
          )}
          <>
            <Paginate
              filter={filter}
              pages={pages}
              page={page}
              keyword={keyword ? keyword : ""}
            />
            <Row>
              {/* renders all of the product carts in a grid format, each product goes in a col, already in a row */}
              {products.map((product) => (
                <Col
                  key={product._id}
                  sm={12}
                  md={6}
                  lg={4}
                  xl={3}
                  className="d-flex justify-content-center align-self-stretch"
                >
                  <Product
                    product={product}
                    inCart={cartProductIds.has(product._id)}
                  />
                </Col>
              ))}
            </Row>
            <Paginate
              filter={filter}
              pages={pages}
              page={page}
              keyword={keyword ? keyword : ""}
            />
          </>
        </>
      )}
    </>
  );
};

export default AllProductsScreen;
