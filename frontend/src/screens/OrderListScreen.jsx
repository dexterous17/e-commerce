import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Table, Button } from "react-bootstrap";

//actions
import { listOrders } from "../store/actions/orderActions";

//components
import BunnyLoader from "../components/BunnyLoader";
import Message from "../components/Message";
import Meta from "../components/Meta";

const OrderListScreen = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const orderList = useSelector((state) => state.orderList);
  const { orders, loading, error } = orderList;

  const userLogin = useSelector((state) => state.userLogin);
  const { userInfo } = userLogin;

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listOrders());
    } else {
      navigate("/login");
    }
  }, [dispatch, userInfo, navigate]);

  return (
    <>
      <Meta title="Tailored by Boutique - Orders" />
      <h1>Orders</h1>
      {loading ? (
        <BunnyLoader />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <>
          <Table striped bordered hover responsive className="table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>DATE</th>
                <th>TOTAL</th>
                <th>PAID</th>
                <th>SHIPPED</th>
                <th>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>{order._id}</td>
                  <td>
                    {/* only want the first 10 characters of the date string */}
                    {order.createdAt.substring(0, 10)}
                  </td>
                  <td>${order.totalPrice.toFixed(2)}</td>
                  {/* is paid */}
                  <td>
                    {order.isPaid ? (
                      order.paidAt.substring(0, 10)
                    ) : (
                      <i className="fas fa-times" style={{ color: "red" }}></i>
                    )}
                  </td>
                  {/* is shipped */}
                  <td>
                    {order.isShipped ? (
                      order.shippedAt.substring(0, 10)
                    ) : (
                      <i className="fas fa-times" style={{ color: "red" }}></i>
                    )}
                  </td>
                  <td>
                    <Button
                      as={Link}
                      to={`/orders/${order._id}`}
                      block
                      size="sm"
                      variant="info"
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
};

export default OrderListScreen;
