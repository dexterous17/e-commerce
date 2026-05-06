import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

/**
 * Isolated so `@paypal/react-paypal-js` loads in its own chunk only when this module is imported.
 */
const OrderPayPalSection = ({
  clientId,
  orderId,
  totalPrice,
  onApproveCapture,
}) => (
  <PayPalScriptProvider
    options={{
      clientId,
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
                value: Number(totalPrice).toFixed(2),
              },
            },
          ],
        })
      }
      onApprove={(data, actions) =>
        actions.order.capture().then((details) => {
          onApproveCapture({
            id: details.id,
            status: details.status,
            update_time: details.update_time,
            payer: details.payer,
          });
        })
      }
    />
  </PayPalScriptProvider>
);

export default OrderPayPalSection;
