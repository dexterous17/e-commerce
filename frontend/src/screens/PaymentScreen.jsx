import { useEffect, useState } from "react";
import { Form, Button, Col } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

//components
import FormContainer from "../components/FormContainer";
import CheckoutSteps from "../components/CheckoutSteps";
import Meta from "../components/Meta";

//actions
import { savePaymentMethod } from "../store/actions/cartActions";

const PaymentScreen = () => {
  const navigate = useNavigate();
  //checks local storage to see if this fields are already filled oug
  //if they are, it fills them in, if not, nothing
  const cart = useSelector((state) => state.cart);
  const { shippingAddress } = cart;

  useEffect(() => {
    if (!shippingAddress || !shippingAddress.address) {
      navigate("/shipping");
    }
  }, [shippingAddress, navigate]);

  //paypal is our default payment method
  const [paymentMethod, setPaymentMethod] = useState("PayPal or Credit Card");

  const dispatch = useDispatch();

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(savePaymentMethod(paymentMethod));
    navigate("/placeorder");
  };

  return (
    <FormContainer>
      <Meta title="Tailored by Boutique - Payment" />
      {/* shows the progress steps, need to send props that represent current progress, this is step2 */}
      <CheckoutSteps step1 step2 step3 />
      <h1>Payment Method</h1>
      <Form onSubmit={handleSubmit}>
        {/* radio buttons to select payment method */}
        <Form.Group>
          <Form.Label as="legend">Select Payment Method</Form.Label>

          <Col>
            <Form.Check
              type="radio"
              label="PayPal or Credit Card"
              id="PayPal"
              name="paymentMethod"
              value="PayPal or Credit Card"
              checked
              onChange={(e) => setPaymentMethod(e.target.value)}
            ></Form.Check>
            {/* <Form.Check
              type="radio"
              label="Stripe"
              id="Stripe"
              name="paymentMethod"
              value="Stripe"
              onChange={(e) => setPaymentMethod(e.target.value)}
            ></Form.Check> */}
          </Col>
        </Form.Group>

        {/* button */}
        <Button type="submit" variant="secondary">
          Continue to Place Order
        </Button>
      </Form>
    </FormContainer>
  );
};

export default PaymentScreen;
