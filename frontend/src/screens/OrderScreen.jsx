import { useEffect, useState } from "react";
import { Row, Col, ListGroup, Image, Card, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

//components
import Message from "../components/Message";
import BunnyLoader from "../components/BunnyLoader";
import Meta from "../components/Meta";
import ConfirmationModal from "../components/ConfirmationModal";

//actions
import { getOrderDetails, payOrder, shipOrder } from "../actions/orderActions";

//constants // ACTIONS
import { ORDER_PAY_RESET, ORDER_SHIP_RESET } from "../constants/orderConstants";
import { rewriteDirectS3ImageUrlToProxy } from "../utils/rewriteProductImageUrls";

const OrderScreen = () => {
  const { id: orderId } = useParams();
  const navigate = useNavigate();

  //functionality for the mark to shipped modal confirmation
  const [showShip, setShowShip] = useState(false);
  const handleCloseShip = () => setShowShip(false);
  const handleShowShip = () => {
    setShowShip(true);
  };

  const [paypalClientId, setPaypalClientId] = useState(null);

  const dispatch = useDispatch();

  //once the order goes through, we need access to the state that the action will send back
  const orderDetails = useSelector((state) => state.orderDetails);
  //deconstruct the orderDetails state
  const { order, loading, error } = orderDetails;

  //once the payment successfully goes through, we need access to the state that the action will send back
  const orderPay = useSelector((state) => state.orderPay);
  //deconstruct the orderPay state, since the variables are used above, rename them
  const { loading: loadingPay, success: successPay } = orderPay;

  const orderShip = useSelector((state) => state.orderShip);
  const { loading: loadingShip, success: successShip } = orderShip;

  //used as a check to make sure user is logged in
  const userLogin = useSelector((state) => state.userLogin);
  const { userInfo } = userLogin;

  useEffect(() => {
    setPaypalClientId(null);
  }, [orderId]);

  useEffect(() => {
    if (!userInfo) {
      navigate("/login");
      return;
    }

    if (!order || successPay || successShip || order._id !== orderId) {
      dispatch({ type: ORDER_PAY_RESET });
      dispatch({ type: ORDER_SHIP_RESET });
      dispatch(getOrderDetails(orderId));
      return;
    }

    if (!order.isPaid && paypalClientId === null) {
      axios
        .get("/api/config/paypal")
        .then(({ data }) => {
          const id =
            typeof data === "string"
              ? data.trim()
              : String(data?.clientId ?? "").trim();
          setPaypalClientId(id || "");
        })
        .catch(() => setPaypalClientId(""));
    }
  }, [
    order,
    orderId,
    dispatch,
    successPay,
    navigate,
    userInfo,
    successShip,
    paypalClientId,
  ]);

  const successPaymentHandler = (paymentResult) => {
    dispatch(payOrder(orderId, paymentResult));
  };

  const shipHandler = () => {
    dispatch(shipOrder(orderId));
  };

  //if it is laoding show the loader, if there is an errror, show error, else render order
  return loading ? (
    <BunnyLoader />
  ) : error ? (
    <Message variant="danger">{error}</Message>
  ) : (
    <div className="order-screen">
      <Meta title="Tailored by Boutique - Order" />
      <h1>Order {order._id}</h1>
      <Row>
        <Col lg={8} className="mb-3">
          <ListGroup variant="flush">
            {/* shipping confirmation */}
            <ListGroup.Item>
              <h2>Shipping</h2>
              <p>
                <strong>Name: </strong> {order.user.name}
              </p>
              <p>
                <strong>Email: </strong>
                <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
              </p>
              <p>
                <strong>Address: </strong>
                {order.shippingAddress.address}, {order.shippingAddress.city},{" "}
                {order.shippingAddress.postalCode},{" "}
                {order.shippingAddress.country}
              </p>
              {order.isShipped ? (
                <Message variant="success">
                  Shipped on {order.shippedAt.substring(0, 10)}
                </Message>
              ) : (
                <Message variant="danger">Not Shipped</Message>
              )}
            </ListGroup.Item>

            <ListGroup.Item>
              {/* payment confirmation */}
              <h2>Payment Method</h2>
              <p>
                <strong>Method: </strong>
                {order.paymentMethod}
              </p>
              {order.isPaid ? (
                <Message variant="success">
                  Paid on {order.paidAt.substring(0, 10)}
                </Message>
              ) : (
                <Message variant="danger">Not Paid</Message>
              )}
            </ListGroup.Item>

            <ListGroup.Item>
              <h2>Order Items</h2>
              {/* Check to confirm there are items in the cart */}
              {order.orderItems.length === 0 ? (
                <Message>Order is empty</Message>
              ) : (
                <ListGroup variant="flush">
                  {order.orderItems.map((item) => (
                    <ListGroup.Item key={item.product}>
                      <Row className="d-flex align-items-center">
                        <Col md={2} className="pl-0 pr-0 order-screen__image">
                          <Image
                            src={rewriteDirectS3ImageUrlToProxy(item.images[0])}
                            alt={item.name}
                            fluid
                            rounded
                          />
                        </Col>
                        <Col>
                          <Link to={`/products/${item.product}`}>
                            {item.name}
                          </Link>
                        </Col>
                        <Col md={4}>
                          {item.qty} x ${item.price} ={" "}
                          <strong>${item.qty * item.price}</strong>
                        </Col>
                      </Row>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </ListGroup.Item>
          </ListGroup>
        </Col>
        <Col lg={4}>
          <Card className="shadow">
            <ListGroup variant="flush">
              <ListGroup.Item>
                <h2>Order Summary</h2>
              </ListGroup.Item>
              {/* items subtotal */}
              <ListGroup.Item>
                <Row>
                  <Col>Items</Col>
                  <Col>${order.itemsPrice.toFixed(2)}</Col>
                </Row>
              </ListGroup.Item>
              {/* shipping total */}
              <ListGroup.Item>
                <Row>
                  <Col>Shipping</Col>
                  <Col>${order.shippingPrice.toFixed(2)}</Col>
                </Row>
              </ListGroup.Item>
              {/* tax total */}
              <ListGroup.Item>
                <Row>
                  <Col>Tax</Col>
                  <Col>${order.taxPrice.toFixed(2)}</Col>
                </Row>
              </ListGroup.Item>
              {/* items TOTAL */}
              <ListGroup.Item>
                <Row>
                  <Col>Total</Col>
                  <Col>${order.totalPrice.toFixed(2)}</Col>
                </Row>
              </ListGroup.Item>
              {/* if order is not paid, render the paypal pay button */}
              {!order.isPaid && (
                <ListGroup.Item>
                  {loadingPay && <BunnyLoader />}
                  {paypalClientId === null ? (
                    <BunnyLoader />
                  ) : paypalClientId === "" ? (
                    <Message variant="warning">
                      PayPal is not configured (missing PAYPAL_CLIENT_ID on the
                      server).
                    </Message>
                  ) : (
                    <PayPalScriptProvider
                      options={{
                        clientId: paypalClientId,
                        currency: "USD",
                      }}
                    >
                      <PayPalButtons
                        style={{ layout: "vertical" }}
                        createOrder={(data, actions) =>
                          actions.order.create({
                            purchase_units: [
                              {
                                custom_id: orderId,
                                amount: {
                                  currency_code: "USD",
                                  value: Number(order.totalPrice).toFixed(2),
                                },
                              },
                            ],
                          })
                        }
                        onApprove={(data, actions) =>
                          actions.order.capture().then((details) => {
                            successPaymentHandler({
                              id: details.id,
                              status: details.status,
                              update_time: details.update_time,
                              payer: details.payer,
                            });
                          })
                        }
                      />
                    </PayPalScriptProvider>
                  )}
                </ListGroup.Item>
              )}
              {loadingShip && <BunnyLoader />}
              {userInfo &&
                userInfo.isAdmin &&
                order.isPaid &&
                !order.isShipped && (
                  <ListGroup.Item>
                    <Button block onClick={handleShowShip}>
                      Mark as Shipped
                    </Button>
                  </ListGroup.Item>
                )}
            </ListGroup>
          </Card>
        </Col>
      </Row>
      <ConfirmationModal
        show={showShip}
        onHide={handleCloseShip}
        confirmHandler={shipHandler}
        title="Mark as Shipped"
        body="Are you sure you want to mark this item as shipped?"
        cancelButton="Cancel"
        cancelButtonColor="primary"
        confirmButton="Ship"
        confirmButtonColor="secondary"
        id={orderId}
      />
    </div>
  );
};

export default OrderScreen;
