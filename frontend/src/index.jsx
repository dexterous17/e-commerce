import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import axios from "axios";

import { getApiOrigin } from "./apiBase";
import { setupAxios } from "./setupAxios";
import store from "./store";
import "./bootstrap.min.css";
import "./index.css";
import App from "./App";

const apiOrigin = getApiOrigin();
if (apiOrigin) {
  axios.defaults.baseURL = apiOrigin;
}

setupAxios(store);

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
