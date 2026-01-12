import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setCredentials } from "./store/slices/authSlice";

// Components
import Layout from "./components/Layout"; 
import Footer from "./components/Footer"; 
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Pages - Customer
import HomePage from "./pages/HomePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import OrdersPage from "./pages/OrdersPage";
import VnpayReturn from "./pages/checkout/VnpayReturn";
import OrderDetailPage from "./pages/OrderDetailPage";
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage";
import OAuthSuccess from "./pages/OAuthSuccess";

// Pages - Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminBrands from "./pages/admin/AdminBrands";
import AdminQuestions from "./pages/admin/AdminQuestions";
import AdminQuestionDetail from "./pages/admin/AdminQuestionDetail";
import AdminProductNewPage from "./pages/admin/AdminProductNewPage";
import AdminProductEditPage from "./pages/admin/AdminProductEditPage";

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);

  // Restore auth state
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    console.log("App init - checking auth restore:", {
      token: !!token,
      userStr: !!userStr,
      isAuthenticated,
    });

    if (token && userStr && !isAuthenticated) {
      try {
        const user = JSON.parse(userStr);
        console.log("Restoring auth state for user:", user.username);
        dispatch(setCredentials({ token, user }));
      } catch (error) {
        console.error("Failed to restore auth state:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("roles");
      }
    }
  }, [dispatch, isAuthenticated]);

  // Clean up pending checkout
  useEffect(() => {
    if (isAuthenticated) {
      const pendingCheckoutStr = localStorage.getItem("pendingCheckout");
      if (pendingCheckoutStr) {
        try {
          const pendingCheckout = JSON.parse(pendingCheckoutStr);
          const timestamp = pendingCheckout.timestamp || 0;
          if (Date.now() - timestamp > 300000) {
            console.log("Removing old pendingCheckout");
            localStorage.removeItem("pendingCheckout");
          }
        } catch (e) {
          localStorage.removeItem("pendingCheckout");
        }
      }
    }
  }, [isAuthenticated]);

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* CUSTOMER ROUTES */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="oauth/success" element={<OAuthSuccess />} />
          
          {/* Protected Customer Routes */}
          <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="checkout/vnpay-return" element={<VnpayReturn />} />
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
        </Route>

        {/* ADMIN ROUTES */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        
        <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
        <Route path="/admin/products/new" element={<AdminRoute><AdminProductNewPage /></AdminRoute>} />
        <Route path="/admin/products/edit/:id" element={<AdminRoute><AdminProductEditPage /></AdminRoute>} />
        
        <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/orders/:orderId" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
        <Route path="/admin/brands" element={<AdminRoute><AdminBrands /></AdminRoute>} />
        
        <Route path="/admin/questions" element={<AdminRoute><AdminQuestions /></AdminRoute>} />
        <Route path="/admin/questions/:question_id" element={<AdminRoute><AdminQuestionDetail /></AdminRoute>} />

      </Routes>  
    </Router>
  );
}

export default App;