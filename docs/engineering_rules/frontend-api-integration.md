# Frontend API Integration — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Phạm vi:** Cách frontend (`client/`) giao tiếp với backend API  
> **Liên quan:** [`api-standard.md`](./api-standard.md) · [`fe-master-context.md`](./fe-master-context.md) · [`frontend-convention.md`](./frontend-convention.md)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Axios Client Setup](#2-axios-client-setup)
3. [API Module Groups](#3-api-module-groups)
4. [Authentication Flow](#4-authentication-flow)
5. [React Query Integration](#5-react-query-integration)
6. [Hooks Reference](#6-hooks-reference)
7. [Error Handling](#7-error-handling)
8. [Pagination & Filtering](#8-pagination--filtering)
9. [File Upload (Admin)](#9-file-upload-admin)
10. [External API Calls (Non-backend)](#10-external-api-calls-non-backend)
11. [Env Variables & Proxy](#11-env-variables--proxy)
12. [Known Mismatches & Fixes](#12-known-mismatches--fixes)

---

## 1. Tổng quan

Frontend giao tiếp backend qua **Axios HTTP client** (`app/services/api.js`), wrapped bởi **TanStack React Query** hooks (`app/hooks/`).

```
Page/Component
  → Custom Hook (useProducts, useOrders, ...)
    → React Query (useQuery / useMutation)
      → api.js (axios instance)
        → Backend REST API (/api/*)
```

**Không có** GraphQL, tRPC, hay WebSocket. ML recommendations cũng đi qua backend proxy (không gọi trực tiếp Flask service).

---

## 2. Axios Client Setup

**File:** `client/app/services/api.js`

### 2.1. Instance creation

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

const api = axios.create({ baseURL: API_BASE_URL })
```

### 2.2. Request interceptor — attach JWT

```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### 2.3. Response interceptor — 401 auto-logout

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ""
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register")

    if ((status === 401 || legacyInvalidToken403) && !isAuthEndpoint) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      localStorage.removeItem("roles")
      delete api.defaults.headers.common.Authorization
      store.dispatch(clearCart())
      store.dispatch(logout())
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)
```

**Quan trọng:** Login/Register 401 **không** trigger redirect — page tự hiển thị lỗi.

### 2.4. Auth bootstrap (main.jsx)

Trước khi render, restore session từ localStorage:

```javascript
if (token && user) {
  store.dispatch(setCredentials({ token, user }))
  api.defaults.headers.common.Authorization = `Bearer ${token}`
}
```

---

## 3. API Module Groups

### 3.1. authAPI

```javascript
export const authAPI = {
  register:       (data) => api.post("/auth/register", data),
  registerEmail:  (data) => api.post("/auth/register-email", data),
  login:          (data) => api.post("/auth/login", data),
  getCurrentUser: ()     => api.get("/auth/me"),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword:  (data) => api.post("/auth/reset-password", data),
}
```

### 3.2. productsAPI

```javascript
export const productsAPI = {
  getProducts:        (params) => api.get("/products", { params }),
  getProductById:     (id)     => api.get(`/products/${id}`),
  getRecommendations: (id)     => api.get(`/products/variations/${id}/recommendations`),
}
```

> **Lưu ý:** Hooks thường gọi trực tiếp `api.get("/products/v2?...")` thay vì qua `productsAPI`.

### 3.3. cartAPI

```javascript
export const cartAPI = {
  getCart:        ()           => api.get("/cart"),
  addToCart:      (data)       => api.post("/cart", data),
  updateCartItem: (itemId, data) => api.put(`/cart/${itemId}`, data),
  removeFromCart: (itemId)     => api.delete(`/cart/${itemId}`),
  clearCart:      ()           => api.delete("/cart"),
}
```

### 3.4. ordersAPI

```javascript
export const ordersAPI = {
  createOrder:  (data) => api.post("/orders", data),
  getOrders:    ()     => api.get("/orders"),
  getOrderById: (id)   => api.get(`/orders/${id}`),
}
```

> Hooks mở rộng thêm: preview, cancel, counters, retry payment, update shipping.

### 3.5. adminAPI

```javascript
export const adminAPI = {
  // Products
  createProduct:  (data) => api.post("/admin/products", data),
  updateProduct:  (id, data) => api.put(`/admin/products/${id}`, data),
  deleteProduct:  (id) => api.delete(`/admin/products/${id}`),
  createVariation: (productId, data) => api.post(`/admin/products/${productId}/variations`, data),
  updateVariation: (productId, variationId, data) => api.put(`/admin/products/${productId}/variations/${variationId}`, data),

  // Orders, Users, Categories, Brands — see api.js
}
```

### 3.6. geoAPI

```javascript
export const geoAPI = {
  getProvinces: (params) => api.get("/provinces", { params: { fields: "province_id,name", ...params } }),
  getWards: (province_id, params) => api.get("/wards", { params: { province_id, ...params } }),
}
```

> **⚠️ Mismatch:** Backend thực tế là `GET /provinces/:id/wards`, không phải `GET /wards?province_id=`. Cần fix.

---

## 4. Authentication Flow

### 4.1. Login

```javascript
// hooks/useAuth.js
const useLogin = () => {
  const dispatch = useDispatch()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentials) => authAPI.login(credentials),
    onSuccess: (response) => {
      const { token, user } = response.data
      dispatch(setCredentials({ token, user }))  // → localStorage
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}
```

### 4.2. Logout

```javascript
const useLogout = () => {
  const dispatch = useDispatch()
  const queryClient = useQueryClient()

  return () => {
    dispatch(logout())           // clear Redux + localStorage
    queryClient.clear()          // clear all cached queries
    delete api.defaults.headers.common.Authorization
  }
}
```

### 4.3. OAuth

```javascript
// LoginPage.jsx — redirect to backend OAuth
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
window.location.href = `${BACKEND}/api/auth/google`
// Callback → /oauth/success?token=... → OAuthSuccess.jsx parses token
```

### 4.4. Protected data access

```javascript
// React Query — guard with enabled
useQuery({
  queryKey: ["cart", user?.user_id],
  queryFn: () => cartAPI.getCart().then(r => r.data),
  enabled: !!isAuthenticated && !!user?.user_id,
})
```

---

## 5. React Query Integration

### 5.1. Global config

```javascript
// main.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,  // 5 minutes
    },
  },
})
```

### 5.2. Query pattern

```javascript
export function useProductsV2(filters = {}) {
  return useQuery({
    queryKey: ["products-v2", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append("search", filters.search)
      if (filters.category_id?.length)
        params.append("category_id", filters.category_id.join(","))
      // ... more filters
      const { data } = await api.get(`/products/v2?${params}`)
      return data
    },
  })
}
```

### 5.3. Mutation pattern

```javascript
export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item) => cartAPI.addToCart(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}
```

### 5.4. Cache invalidation map

| Mutation | Invalidates |
|----------|-------------|
| Login | `["cart"]` |
| Add/update/remove cart | `["cart"]` |
| Create order | `["cart"]`, `["orders"]` |
| Cancel order | `["orders"]`, `["order-counters"]` |
| Admin create/update product | `["products-v2"]`, `["product"]` |
| Admin update order status | `["admin-orders"]`, `["orders"]` |

### 5.5. staleTime overrides

| Query | staleTime | Lý do |
|-------|-----------|-------|
| Categories, brands | `Infinity` | Static catalog data |
| Cart | `60_000` (1 min) | Frequently updated |
| Admin lists | `0` | Always fresh |
| Product detail | default (5 min) | Moderate change |

---

## 6. Hooks Reference

### 6.1. useProducts.js

| Hook | Query key | API call |
|------|-----------|----------|
| `useProducts(filters)` | `["products", filters]` | `GET /products?...` |
| `useProductsV2(filters)` | `["products-v2", filters]` | `GET /products/v2?...` |
| `useProductDetail(id)` | `["product", id]` | `GET /products/:id` |
| `useProductFacets(filters)` | `["facets", filters]` | `GET /products/facets?...` |
| `useSearchSuggestions(q)` | `["search-suggestions", q]` | `GET /products/search-suggestions?q=` |
| `useRecommendedByVariation(id)` | `["recommendations", id]` | `GET /products/variations/:id/recommendations` |
| `customerUseCategories()` | `["categories"]` | `GET /products/categories` |
| `customerUseBrands()` | `["brands"]` | `GET /products/brands` |
| `useAdminCreateProduct()` | mutation | `POST /admin/products` |
| `useAdminUpdateProduct()` | mutation | `PUT /admin/products/:id` |

### 6.2. useAuth.js

| Hook | Type | API |
|------|------|-----|
| `useLogin()` | mutation | `POST /auth/login` |
| `useRegister()` | mutation | `POST /auth/register` |
| `useMe()` | query | `GET /auth/me` |
| `useCurrentUser()` | query | alias for useMe |
| `useLogout()` | function | local only |
| `useForgotPassword()` | mutation | `POST /auth/forgot-password` |
| `useResetPassword()` | mutation | `POST /auth/reset-password` |

### 6.3. useOrders.js

| Hook | API |
|------|-----|
| `useUserOrders(params)` | `GET /orders?tab=&page=&limit=` |
| `useOrderDetail(id)` | `GET /orders/:id` |
| `useOrderCounters()` | `GET /orders/counters` |
| `useCreateOrder()` | `POST /orders` |
| `useOrderPreview()` | `POST /orders/preview` |
| `useCancelOrder()` | `POST /orders/:id/cancel` |
| `useRetryPayment()` | `POST /orders/:id/payments/retry` |
| `useUpdateShippingAddress()` | `PUT /orders/:id/shipping-address` |
| `useAdminOrders(params)` | `GET /admin/orders` |
| `useAdminAnalytics()` | `GET /admin/analytics/dashboard` |

### 6.4. useCart.js

| Hook | API | Side effect |
|------|-----|-------------|
| `useGetCart()` | `GET /cart` | dispatch `setCart()` to Redux |
| `useAddToCart()` | `POST /cart` | invalidate cart |
| `useUpdateCartItem()` | `PUT /cart/:id` | invalidate cart |
| `useRemoveFromCart()` | `DELETE /cart/:id` | invalidate cart |

### 6.5. Non-React Query hooks

| Hook | Pattern | API |
|------|---------|-----|
| `useProvinces()` | useEffect + useState | `geoAPI.getProvinces()` |
| `useWards(provinceId)` | useEffect + useState | `geoAPI.getWards(provinceId)` |
| `useShippingQuote(params)` | debounced useEffect (300ms) | `GET /quote?...` |
| `useOrderPreview(data)` | debounced useEffect (500ms) | `POST /orders/preview` |

---

## 7. Error Handling

### 7.1. Display pattern in pages

```javascript
// Standard error extraction
const message = error?.response?.data?.message || "Đã xảy ra lỗi. Vui lòng thử lại."

// Validation errors (register)
if (error.response?.data?.errors) {
  const fieldErrors = {}
  error.response.data.errors.forEach(e => {
    fieldErrors[e.path] = e.msg
  })
  setErrors(fieldErrors)
}
```

### 7.2. Error display UI

```jsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
    {errorMessage}
  </div>
)}
```

### 7.3. Loading state

```jsx
const { data, isLoading, error } = useProductsV2(filters)

if (isLoading) return <LoadingSpinner size="lg" />
if (error) return <div className="text-red-600">Không thể tải sản phẩm</div>
```

### 7.4. Mutation error

```jsx
const mutation = useCreateOrder()

const handleSubmit = async () => {
  try {
    const result = await mutation.mutateAsync(orderData)
    if (result.redirect) window.location.href = result.redirect  // VNPay
    else navigate("/checkout/success")
  } catch (err) {
    setError(err.response?.data?.message || "Không thể tạo đơn hàng")
  }
}
```

---

## 8. Pagination & Filtering

### 8.1. FE filter state → API params mapping

```javascript
// HomePage local state
const [filters, setFilters] = useState({
  search: "",
  category_id: [],
  brand_id: [],
  minPrice: "",
  maxPrice: "",
  processor: [],
  ram: [],
  storage: [],
  graphics_card: [],
  page: 1,
  limit: 12,
  sortBy: "newest",
})

// useProductsV2 converts camelCase → snake_case API params
filters.minPrice  → min_price
filters.maxPrice  → max_price
filters.sortBy    → sort_by
filters.category_id → category_id (CSV)
```

### 8.2. URL search params (optional)

```javascript
// HomePage may read ?search= from URL
const [searchParams] = useSearchParams()
const initialSearch = searchParams.get("search") || ""
```

### 8.3. Order tabs

```javascript
const tabs = ["all", "awaiting_payment", "to_ship", "shipping", "completed", "cancelled", "failed"]
// → GET /orders?tab=awaiting_payment&page=1&limit=10
```

---

## 9. File Upload (Admin)

Admin product/category/brand create/update dùng **FormData**:

```javascript
const formData = new FormData()
formData.append("product_name", name)
formData.append("description", description)
formData.append("category_id", categoryId)
formData.append("variations", JSON.stringify(variationsArray))

if (thumbnailFile) formData.append("thumbnail", thumbnailFile)
imageFiles.forEach(f => formData.append("product_images", f))

await api.post("/admin/products", formData, {
  headers: { "Content-Type": "multipart/form-data" },
})
```

**Không qua** React Query mutation wrapper trong một số admin pages — gọi `api.post` trực tiếp.

---

## 10. External API Calls (Non-backend)

### 10.1. OpenStreetMap Nominatim (CheckoutPage)

```javascript
// Reverse geocoding — gọi trực tiếp, KHÔNG qua backend
const response = await fetch(
  `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
)
```

### 10.2. Leaflet map tiles (MapPicker)

```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### 10.3. OAuth redirects

```
{BACKEND_URL}/api/auth/google
{BACKEND_URL}/api/auth/facebook
```

---

## 11. Env Variables & Proxy

### 11.1. Environment

| Variable | Used in | Default |
|----------|---------|---------|
| `VITE_API_URL` | `api.js` | `http://localhost:5000/api` |
| `VITE_BACKEND_URL` | LoginPage, RegisterPage | `http://localhost:5000` |

### 11.2. Vite dev proxy

```javascript
// vite.config.js
server: {
  port: 3000,
  proxy: {
    "/api": { target: "http://localhost:5000", changeOrigin: true },
  },
}
```

Khi dùng proxy, có thể set `VITE_API_URL=/api` (relative) — hiện tại dùng absolute URL.

### 11.3. Production (Docker/Nginx)

```
Browser → Nginx :80/api/ → server:5000
Frontend built with VITE_API_URL=http://domain/api (at build time)
```

---

## 12. Known Mismatches & Fixes

| # | Issue | FE code | BE actual | Fix |
|---|-------|---------|-----------|-----|
| 1 | Wards endpoint | `GET /wards?province_id=` | `GET /provinces/:id/wards` | Update `geoAPI.getWards` |
| 2 | Env var name | `VITE_API_URL` | Docker sets `VITE_API_BASE_URL` | Standardize |
| 3 | Admin variation update path | `/admin/products/:pid/variations/:vid` | `/admin/variations/:vid` | Fix adminAPI path |
| 4 | Admin user role update | `/admin/users/:id/role` | `/admin/users/:id/roles` | Fix adminAPI path |
| 5 | Centroid endpoint | CheckoutPage calls `/wards/:id/centroid` | Not implemented | Remove or implement BE |
| 6 | api.js incomplete | Many endpoints only in hooks | — | Expand api.js or document hook-only pattern |

---

## Phụ lục — Template hook mới

```javascript
// hooks/useExample.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../services/api"

export function useExampleList(params = {}) {
  return useQuery({
    queryKey: ["examples", params],
    queryFn: async () => {
      const { data } = await api.get("/examples", { params })
      return data
    },
  })
}

export function useCreateExample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post("/examples", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examples"] })
    },
  })
}
```

---

*Phản ánh cách frontend tích hợp API thực tế trong `client/app/services/api.js` và `client/app/hooks/`.*
