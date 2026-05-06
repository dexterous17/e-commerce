import axios from "axios";

import {
  USER_LOGOUT,
  USER_DETAILS_RESET,
  USER_LIST_RESET,
} from "./constants/userConstants";
import { ORDER_LIST_MY_RESET } from "./constants/orderConstants";

let authSessionRedirectScheduled = false;

function loginPathFromEnv() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return base ? `${base}/login` : "/login";
}

function isLoginRequest(config) {
  const url = String(config?.url || "");
  return url.includes("/users/login");
}

/**
 * Clears stored auth and redirects to login when an authenticated request returns 401.
 * Skips failed credential checks on POST /api/users/login.
 */
export function setupAxios(store) {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const config = error.config || {};

      if (status === 401 && !isLoginRequest(config)) {
        const hadSession = Boolean(localStorage.getItem("userInfo"));
        if (hadSession && !authSessionRedirectScheduled) {
          authSessionRedirectScheduled = true;
          localStorage.removeItem("userInfo");
          store.dispatch({ type: USER_LOGOUT });
          store.dispatch({ type: USER_DETAILS_RESET });
          store.dispatch({ type: ORDER_LIST_MY_RESET });
          store.dispatch({ type: USER_LIST_RESET });

          const login = loginPathFromEnv();
          const returnTo = `${window.location.pathname}${window.location.search}`;
          const safeReturn = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
          window.location.assign(
            `${login}?redirect=${encodeURIComponent(safeReturn)}`
          );
        }
      }

      return Promise.reject(error);
    }
  );
}
