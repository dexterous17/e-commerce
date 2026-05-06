import { combineReducers, createStore, applyMiddleware } from "redux";
import { thunk } from "redux-thunk";
import { composeWithDevTools } from "@redux-devtools/extension";

import { resolvePublicApiUrl } from "./apiBase";

//reducers
import {
  productListReducer,
  productDetailsReducer,
  productRemoveInventoryReducer,
  productDeleteReducer,
  productCreateReducer,
  productUpdateReducer,
  productFeaturedReducer,
} from "./reducers/productReducers";
import { cartReducers } from "./reducers/cartReducers";
import {
  userLoginReducer,
  userRegisterReducer,
  userDetailsReducer,
  userUpdateProfileReducer,
  userListReducer,
  userDeleteReducer,
  userUpdateReducer,
} from "./reducers/userReducers";
import {
  orderCreateReducer,
  orderDetailsReducer,
  orderPayReducer,
  orderListMyReducer,
  orderListReducer,
  orderShipReducer,
} from "./reducers/orderReducers";

//takes object of all of the imported reducers
const reducer = combineReducers({
  //the key is the state, the value is the reducer
  productList: productListReducer,
  productDetails: productDetailsReducer,
  cart: cartReducers,
  userLogin: userLoginReducer,
  userRegister: userRegisterReducer,
  userDetails: userDetailsReducer,
  userUpdateProfile: userUpdateProfileReducer,
  orderCreate: orderCreateReducer,
  orderDetails: orderDetailsReducer,
  orderPay: orderPayReducer,
  orderListMy: orderListMyReducer,
  userList: userListReducer,
  userDelete: userDeleteReducer,
  userUpdate: userUpdateReducer,
  productRemoveInventory: productRemoveInventoryReducer,
  productCreate: productCreateReducer,
  productUpdate: productUpdateReducer,
  productDelete: productDeleteReducer,
  orderList: orderListReducer,
  orderShip: orderShipReducer,
  productFeatured: productFeaturedReducer,
});

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

//upon inilization it will check local storage to see if there are any cartItems, if there is, it adds it to our initial state, otherwise it sets it as empty array
const cartItemsParsed = readJson("cartItems", []);
const cartItemsRaw = Array.isArray(cartItemsParsed) ? cartItemsParsed : [];
const cartItemsFromLocalStorage = cartItemsRaw.map((item) =>
  !item?.images?.length
    ? item
    : { ...item, images: item.images.map((u) => resolvePublicApiUrl(u)) }
);
if (
  cartItemsRaw.length > 0 &&
  JSON.stringify(cartItemsFromLocalStorage) !== JSON.stringify(cartItemsRaw)
) {
  localStorage.setItem("cartItems", JSON.stringify(cartItemsFromLocalStorage));
}

//upon inilization it will check local storage to see if there is any userInfo, if there is, it adds it to our initial state, otherwise it sets it as empty object
const userParsed = readJson("userInfo", null);
const userInfoFromLocalStorage =
  userParsed && typeof userParsed === "object" ? userParsed : null;

//upon inilization it will check local storage to see if there is any shippingInfo, if there is, it adds it to our initial state, otherwise it sets it as empty object
const shippingParsed = readJson("shippingAddress", {});
const shippingAddressFromLocalStorage =
  shippingParsed && typeof shippingParsed === "object"
    ? shippingParsed
    : {};

const paymentParsed = readJson("paymentMethod", {});
const paymentMethodFromLocalStorage =
  paymentParsed && typeof paymentParsed === "object" ? paymentParsed : {};

const initialState = {
  cart: {
    cartItems: cartItemsFromLocalStorage,
    shippingAddress: shippingAddressFromLocalStorage,
    paymentMethod: paymentMethodFromLocalStorage,
  },
  userLogin: {
    userInfo: userInfoFromLocalStorage,
  },
};

const middleware = [thunk];

const enhancer = import.meta.env.DEV
  ? composeWithDevTools(applyMiddleware(...middleware))
  : applyMiddleware(...middleware);

const store = createStore(reducer, initialState, enhancer);

export default store;
