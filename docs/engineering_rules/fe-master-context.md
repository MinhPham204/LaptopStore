# FE Master Context — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Mục đích:** Tài liệu ngữ cảnh tổng hợp cho developer/AI khi làm việc với frontend  
> **Phạm vi:** `client/` — React SPA  
> **Liên quan:** [`frontend-convention.md`](./frontend-convention.md) · [`frontend-api-integration.md`](./frontend-api-integration.md) · [`design-system.md`](./design-system.md) · [`../master_specification.md`](../master_specification.md)

---

## 1. Dự án là gì?

**LaptopStore** là nền tảng **bán laptop trực tuyến** thị trường Việt Nam. Frontend là **Single Page Application (SPA)** cung cấp:

- **Storefront:** Danh mục laptop, lọc kỹ thuật, so sánh, gợi ý AI, giỏ hàng, checkout
- **User account:** Đăng ký/đăng nhập, OAuth, profile, quản lý đơn hàng
- **Admin panel:** CRUD sản phẩm, đơn hàng, users, categories, brands, Q&A, analytics

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| UI | React | 18.2 |
| Build | Vite | 5.4 |
| Routing | React Router DOM | 7.9 |
| Server state | TanStack React Query | 5.14 |
| Client state | Redux Toolkit | 2.0 |
| HTTP | Axios | 1.6 |
| Styling | Tailwind CSS | 3.4 |
| Icons | lucide-react | 0.294 |
| Maps | Leaflet + react-leaflet | 1.9 / 4.2 |
| Charts | Recharts | 3.6 |
| Rich text | react-quill | 2.0 |
| Locale | Vietnamese (`vi-VN`) | — |

---

## 3. Cấu trúc thư mục

```
client/
├── index.html                  # Entry HTML → /app/main.jsx
├── vite.config.js              # Vite config, @ alias, dev proxy
├── tailwind.config.js          # Design tokens
├── postcss.config.js
├── package.json
├── Dockerfile                  # Multi-stage: build → nginx serve
├── src/
│   └── index.css               # Tailwind + component classes
└── app/
    ├── main.jsx                # React root, providers
    ├── App.jsx                 # Router definitions
    ├── components/             # 18 reusable components
    ├── pages/                  # Route-level pages
    │   ├── admin/              # 11 admin pages
    │   └── checkout/           # VnpayReturn
    ├── hooks/                  # 12 custom hooks
    ├── store/
    │   ├── store.js
    │   └── slices/             # auth, cart, ui, compare
    ├── services/
    │   └── api.js              # Axios + API groups
    └── utils/                  # formatters, cn, orderTabs, orderCanCancel
```

---

## 4. Application Bootstrap

**File:** `app/main.jsx`

```jsx
// Provider hierarchy:
<Provider store={store}>           // Redux
  <QueryClientProvider client={queryClient}>  // React Query
    <App />                        // Router
  </QueryClientProvider>
</Provider>
```

**Auth bootstrap (before render):**

```javascript
const token = localStorage.getItem("token")
const user = JSON.parse(localStorage.getItem("user"))
if (token && user) {
  store.dispatch(setCredentials({ token, user }))
  api.defaults.headers.common.Authorization = `Bearer ${token}`
}
```

**React Query defaults:**

```javascript
{ refetchOnWindowFocus: false, retry: 1, staleTime: 5 * 60 * 1000 }
```

---

## 5. Routing Architecture

### 5.1. Route map

| Path | Page | Guard | Layout |
|------|------|-------|--------|
| `/` | HomePage | Public | Layout (Header+Footer) |
| `/products/:id` | ProductDetailPage | Public | Layout |
| `/cart` | CartPage | Public | Layout |
| `/login` | LoginPage | Public | Layout |
| `/register` | RegisterPage | Public | Layout |
| `/oauth/success` | OAuthSuccess | Public | Layout |
| `/checkout` | CheckoutPage | ProtectedRoute | Layout |
| `/checkout/success` | CheckoutSuccessPage | Public | Layout |
| `/checkout/vnpay-return` | VnpayReturn | Public | Layout |
| `/profile` | ProfilePage | ProtectedRoute | Layout |
| `/orders` | OrdersPage | ProtectedRoute | Layout |
| `/orders/:id` | OrderDetailPage | Public* | Layout |
| `/admin/*` | Admin pages | AdminRoute | Admin sidebar |

### 5.2. Route guards

| Guard | Check | Redirect |
|-------|-------|----------|
| `ProtectedRoute` | `isAuthenticated` OR localStorage token | `/login` |
| `AdminRoute` | authenticated + `roles.includes("admin")` | `/login` or `/` |

### 5.3. Layout zones

```
Public zone:  Layout → Header + Outlet + Footer
Admin zone:   AdminRoute → Sidebar + main content (NO public Header/Footer)
```

---

## 6. State Management Strategy

### 6.1. Phân chia trách nhiệm

| Concern | Tool | Examples |
|---------|------|----------|
| **Server data** | React Query | Products, orders, cart (API), facets |
| **Auth session** | Redux + localStorage | token, user, roles |
| **Cart mirror** | Redux (synced from API) | items, selection, totals |
| **Compare list** | Redux | max 3 variation_ids |
| **UI toggles** | Redux | sidebar, modals, search |
| **Form state** | Component useState | Login, checkout, admin forms |
| **URL state** | React Router + searchParams | Filters, pagination, search |

### 6.2. Redux slices

| Slice | Key state | Persist |
|-------|-----------|---------|
| `authSlice` | user, token, isAuthenticated | localStorage |
| `cartSlice` | items[], totalItems, totalPrice, selection | API sync |
| `compareSlice` | items[] (max 3) | Memory only |
| `uiSlice` | sidebarOpen, cartDrawerOpen, theme | Memory only |

### 6.3. React Query key conventions

```
["products", filters]
["products-v2", filters]
["product", id]
["cart", user?.user_id]
["orders", user?.user_id, params]
["admin-orders", params]
["categories"]          // staleTime: Infinity
["brands"]              // staleTime: Infinity
["facets", filters]
["recommendations", variationId]
```

**User-scoped keys:** Luôn include `user?.user_id` cho data cá nhân (cart, orders).

---

## 7. API Integration Overview

**Base URL:** `VITE_API_URL` || `http://localhost:5000/api`

**API groups** (`services/api.js`):

| Group | Prefix | Auth |
|-------|--------|------|
| `authAPI` | `/auth` | Mixed |
| `productsAPI` | `/products` | Public |
| `cartAPI` | `/cart` | JWT |
| `ordersAPI` | `/orders` | JWT |
| `adminAPI` | `/admin` | JWT + admin |
| `geoAPI` | `/provinces`, `/wards` | Public |

**401 handling:** Axios interceptor auto-logout + redirect `/login` (trừ auth endpoints).

Chi tiết: [`frontend-api-integration.md`](./frontend-api-integration.md).

---

## 8. Key User Flows (Frontend)

### 8.1. Browse → Purchase

```
HomePage (filter/search)
  → ProductDetailPage (select variation, add to cart / buy now)
  → CartPage (optional)
  → CheckoutPage (address, map, payment)
  → CheckoutSuccessPage (COD) OR VnpayReturn (VNPay)
```

### 8.2. Buy Now shortcut

```javascript
navigate("/checkout", {
  state: { mode: "buy_now", items: [{ variation_id, quantity: 1 }] }
})
```

CheckoutPage reads `location.state` — nếu chưa login, lưu `pendingCheckout` vào localStorage.

### 8.3. Auth flows

```
Register → JWT in localStorage → redirect home
Login → JWT → invalidate cart query
OAuth → /oauth/success?token= → parse token → setCredentials
Forgot password → email link → reset form
```

### 8.4. Admin flows

```
AdminRoute gate → AdminDashboard / AdminProducts / AdminOrders / ...
Product CRUD → FormData multipart upload → Cloudinary via backend
Order management → status actions (ship, deliver, refund)
```

---

## 9. Component Hierarchy

```
App
└── Router
    └── Layout (public routes)
        ├── Header
        │   ├── Search (with suggestions)
        │   ├── Cart badge
        │   └── Auth menu
        ├── Outlet (page content)
        │   ├── HomePage
        │   │   ├── ProductFilter
        │   │   └── ProductCard × N
        │   ├── ProductDetailPage
        │   │   ├── SpecsTable
        │   │   ├── ProductRecommendations
        │   │   └── CompareBar
        │   ├── CheckoutPage
        │   │   ├── MapPicker
        │   │   └── PaymentOptions
        │   └── ...
        ├── CompareBar (global, from Redux)
        └── Footer

    └── AdminRoute (admin routes)
        ├── AdminSidebar
        └── Admin page content
```

---

## 10. Environment & Dev Setup

### 10.1. Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:5000/api` | Axios base URL |
| `VITE_BACKEND_URL` | `http://localhost:5000` | OAuth redirect base |

### 10.2. Dev commands

```bash
cd client
npm install
npm run dev     # Vite dev server :3000, proxy /api → :5000
npm run build   # Output to dist/
npm run preview # Preview production build
```

### 10.3. Vite config highlights

```javascript
// vite.config.js
resolve: { alias: { "@": path.resolve(__dirname, "./app") } }
server: { port: 3000, proxy: { "/api": "http://localhost:5000" } }
```

---

## 11. Conventions Quick Reference

| Topic | Convention | Doc |
|-------|------------|-----|
| File naming | PascalCase `.jsx` for components/pages | [`frontend-convention.md`](./frontend-convention.md) |
| Hooks | `use*.js` in `hooks/` | [`frontend-convention.md`](./frontend-convention.md) |
| Imports | Relative paths (not `@/` yet) | [`frontend-convention.md`](./frontend-convention.md) |
| Styling | Tailwind utilities inline | [`design-system.md`](./design-system.md) |
| Forms | useState + manual validation | [`frontend-convention.md`](./frontend-convention.md) |
| Price/date | `formatPrice`, `formatDate` (vi-VN) | [`design-system.md`](./design-system.md) |
| API calls | React Query hooks, not direct axios in pages | [`frontend-api-integration.md`](./frontend-api-integration.md) |
| Error display | `error?.response?.data?.message` | [`frontend-api-integration.md`](./frontend-api-integration.md) |

---

## 12. Known Issues & Gotchas

| Issue | Impact | Workaround |
|-------|--------|------------|
| `geoAPI.getWards` calls `/wards` | Wards fetch may fail | Should call `/provinces/:id/wards` |
| `VITE_API_URL` vs `VITE_API_BASE_URL` | Docker env mismatch | Set both or standardize |
| AdminRoute only checks `admin` role | Manager blocked from admin UI | Backend allows manager |
| Component classes unused | Inconsistent styling | Use inline blue-600 pattern |
| `"use client"` in some files | Harmless but confusing | Ignore/remove |
| `cn()` utility unused | Missed merge opportunities | Import when needed |
| Order detail page public route | May show without auth | Backend validates ownership |
| No `.env.example` in client | Setup friction | Create one |

---

## 13. Files quan trọng cần đọc trước khi code

| Priority | File | Why |
|----------|------|-----|
| 1 | `app/services/api.js` | All API endpoints, interceptors |
| 2 | `app/App.jsx` | Route map |
| 3 | `app/store/slices/authSlice.js` | Auth state management |
| 4 | `app/hooks/useProducts.js` | React Query patterns |
| 5 | `app/hooks/useOrders.js` | Order flow hooks |
| 6 | `app/pages/CheckoutPage.jsx` | Most complex user flow |
| 7 | `app/components/AdminRoute.jsx` | Admin layout |
| 8 | `app/utils/formatters.js` | vi-VN formatting |

---

## 14. External Dependencies (Frontend-only)

| Service | Used in | Direct call? |
|---------|---------|-------------|
| Backend API | All hooks, api.js | Via axios |
| OpenStreetMap Nominatim | CheckoutPage | ✅ Direct HTTP |
| Leaflet map tiles | MapPicker | ✅ Direct (OSM tiles) |
| Cloudinary | Product images | ❌ Via URL from API |
| VNPay | CheckoutPage | ❌ Redirect URL from API |
| Google/Facebook OAuth | Login/Register | ❌ Redirect to backend |

---

*Tài liệu ngữ cảnh tổng hợp — đọc file này trước khi làm bất kỳ task frontend nào trên LaptopStore.*
