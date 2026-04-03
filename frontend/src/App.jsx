import { lazy, Suspense } from "react";
import { Container } from "react-bootstrap";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";
import BunnyLoader from "./components/BunnyLoader";

const AllProductsScreen = lazy(() => import("./screens/AllProductsScreen"));
const HomeScreen = lazy(() => import("./screens/HomeScreen"));
const ProductScreen = lazy(() => import("./screens/ProductScreen"));
const CartScreen = lazy(() => import("./screens/CartScreen"));
const LoginScreen = lazy(() => import("./screens/LoginScreen"));
const RegisterScreen = lazy(() => import("./screens/RegisterScreen"));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen"));
const ShippingScreen = lazy(() => import("./screens/ShippingScreen"));
const PaymentScreen = lazy(() => import("./screens/PaymentScreen"));
const PlaceOrderScreen = lazy(() => import("./screens/PlaceOrderScreen"));
const OrderScreen = lazy(() => import("./screens/OrderScreen"));
const UserListScreen = lazy(() => import("./screens/UserListScreen"));
const UserEditScreen = lazy(() => import("./screens/UserEditScreen"));
const ProductListScreen = lazy(() => import("./screens/ProductListScreen"));
const ProductEditScreen = lazy(() => import("./screens/ProductEditScreen"));
const OrderListScreen = lazy(() => import("./screens/OrderListScreen"));

const RouteSuspenseFallback = () => <BunnyLoader />;

const ContainedPageLayout = () => (
  <Container>
    <Outlet />
  </Container>
);

const MainRoutes = () => (
  <Suspense fallback={<RouteSuspenseFallback />}>
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route element={<ContainedPageLayout />}>
        <Route path="login" element={<LoginScreen />} />
        <Route path="shipping" element={<ShippingScreen />} />
        <Route path="orders/:id" element={<OrderScreen />} />
        <Route path="payment" element={<PaymentScreen />} />
        <Route path="placeorder" element={<PlaceOrderScreen />} />
        <Route path="register" element={<RegisterScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route
          path="products/page/:pageNumber/:filter"
          element={<AllProductsScreen />}
        />
        <Route
          path="products/page/:pageNumber"
          element={<AllProductsScreen />}
        />
        <Route
          path="products/search/:keyword/page/:pageNumber/:filter"
          element={<AllProductsScreen />}
        />
        <Route
          path="products/search/:keyword/page/:pageNumber"
          element={<AllProductsScreen />}
        />
        <Route
          path="products/search/:keyword/:filter"
          element={<AllProductsScreen />}
        />
        <Route path="products/:id" element={<ProductScreen />} />
        <Route path="products" element={<AllProductsScreen />} />
        <Route path="cart/:id" element={<CartScreen />} />
        <Route path="cart" element={<CartScreen />} />
        <Route path="admin/userlist" element={<UserListScreen />} />
        <Route path="admin/users/:id/edit" element={<UserEditScreen />} />
        <Route
          path="admin/productlist/:pageNumber"
          element={<ProductListScreen />}
        />
        <Route path="admin/productlist" element={<ProductListScreen />} />
        <Route
          path="admin/products/:id/edit"
          element={<ProductEditScreen />}
        />
        <Route path="admin/orderlist" element={<OrderListScreen />} />
      </Route>
    </Routes>
  </Suspense>
);

const App = () => {
  const routerBaseName = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  return (
    <Router
      basename={routerBaseName}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Header />
      <main id="main-content" className="py-3">
        <MainRoutes />
      </main>
      <Footer />
    </Router>
  );
};

export default App;
