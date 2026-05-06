import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import axios from "axios";

import { getApiOrigin } from "./lib/apiBase";
import { setupAxios } from "./lib/setupAxios";
import store from "./store";
import "./styles/bootstrap.min.css";
import "./styles/index.css";
import App from "./app/App";

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
