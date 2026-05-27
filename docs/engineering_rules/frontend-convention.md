# Frontend Convention — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Phạm vi:** `client/app/` — React SPA conventions  
> **Liên quan:** [`fe-master-context.md`](./fe-master-context.md) · [`design-system.md`](./design-system.md) · [`frontend-api-integration.md`](./frontend-api-integration.md)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [File & Component Naming](#3-file--component-naming)
4. [Import Conventions](#4-import-conventions)
5. [Component Patterns](#5-component-patterns)
6. [Page Patterns](#6-page-patterns)
7. [Hooks Conventions](#7-hooks-conventions)
8. [State Management](#8-state-management)
9. [Form Conventions](#9-form-conventions)
10. [Styling Conventions](#10-styling-conventions)
11. [Routing Conventions](#11-routing-conventions)
12. [Error & Loading States](#12-error--loading-states)
13. [Locale & Formatting](#13-locale--formatting)
14. [Anti-patterns](#14-anti-patterns)

---

## 1. Tổng quan

Frontend LaptopStore tuân theo **functional React** với **hooks-first** approach. Không dùng class components, HOCs, hay render props.

| Principle | Mô tả |
|-----------|-------|
| Functional components | `export default function ComponentName()` |
| Hooks for logic | Custom hooks trong `hooks/`, không logic nặng trong JSX |
| Colocation | Page-specific logic trong page file; shared logic trong hooks/components |
| No CSS modules | Tailwind utilities + global component classes |
| Vietnamese UI | User-facing text tiếng Việt |

---

## 2. Cấu trúc thư mục

```
app/
├── main.jsx              # Entry — providers only
├── App.jsx               # Router — route definitions only
├── components/           # Shared reusable UI (18 files)
├── pages/                # Route-level screens
│   ├── admin/            # Admin-only pages (11 files)
│   └── checkout/         # Payment return pages
├── hooks/                # Custom hooks (12 files)
├── store/
│   ├── store.js          # configureStore
│   └── slices/           # RTK slices (4 files)
├── services/
│   └── api.js            # Axios client + API groups
└── utils/                # Pure utility functions
```

### Quy tắc đặt file

| Loại | Location | Extension | Naming |
|------|----------|-----------|--------|
| Page | `pages/` or `pages/admin/` | `.jsx` | `{Name}Page.jsx` or `Admin{Name}.jsx` |
| Component | `components/` | `.jsx` | `{Name}.jsx` PascalCase |
| Hook | `hooks/` | `.js` | `use{Name}.js` |
| Slice | `store/slices/` | `.js` | `{name}Slice.js` |
| Utility | `utils/` | `.js` | `{name}.js` camelCase |
| Service | `services/` | `.js` | `{name}.js` |

### Khi nào tạo file mới

| Tình huống | Tạo ở |
|------------|-------|
| UI dùng ≥ 2 pages | `components/` |
| Logic fetch/mutate data | `hooks/` |
| Route mới | `pages/` + route in `App.jsx` |
| Client-only state (global) | `store/slices/` |
| Pure function (format, validate) | `utils/` |

---

## 3. File & Component Naming

### 3.1. Components

```
ProductCard.jsx       → export default function ProductCard()
LoadingSpinner.jsx    → export default function LoadingSpinner({ size = "md" })
ProtectedRoute.jsx    → export default function ProtectedRoute({ children })
```

### 3.2. Pages

```
HomePage.jsx              → export default function HomePage()
ProductDetailPage.jsx     → export default function ProductDetailPage()
AdminProducts.jsx         → export default function AdminProducts()
AdminProductNewPage.jsx   → export default function AdminProductNewPage()
VnpayReturn.jsx           → export default function VnpayReturn()
```

### 3.3. Hooks

```
useProducts.js     → export function useProducts(), useProductsV2(), ...
useAuth.js         → export function useLogin(), useLogout(), useMe(), ...
useOrders.js       → export function useUserOrders(), useCreateOrder(), ...
useCart.js         → export function useGetCart(), useAddToCart(), ...
```

**Prefix conventions:**

| Prefix | Meaning | Example |
|--------|---------|---------|
| `use` | Standard hook | `useProductDetail` |
| `customerUse` | Customer-facing normalized data | `customerUseBrands()` |
| `useAdmin` | Admin-only hooks | `useAdminOrders()` |

### 3.4. Redux slices

```
authSlice.js    → export authReducer, { setCredentials, logout, ... }
cartSlice.js    → export cartReducer, { setCart, addItem, clearCart, ... }
```

---

## 4. Import Conventions

### 4.1. Hiện tại: relative imports

```javascript
// From pages/
import { useProductsV2 } from "../hooks/useProducts"
import ProductCard from "../components/ProductCard"
import { formatPrice } from "../utils/formatters"

// From pages/admin/
import { useAdminOrders } from "../../hooks/useOrders"
```

### 4.2. Alias configured (chưa dùng)

```javascript
// vite.config.js: "@" → "./app"
// Khuyến nghị cho code mới:
import ProductCard from "@/components/ProductCard"
import { useProductsV2 } from "@/hooks/useProducts"
import { formatPrice } from "@/utils/formatters"
```

### 4.3. Import order (khuyến nghị)

```javascript
// 1. React/framework
import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useSelector, useDispatch } from "react-redux"

// 2. Third-party
import { ShoppingCart } from "lucide-react"

// 3. Internal — hooks, components, utils
import { useProductsV2 } from "../hooks/useProducts"
import ProductCard from "../components/ProductCard"
import { formatPrice } from "../utils/formatters"
```

---

## 5. Component Patterns

### 5.1. Presentational component

```jsx
export default function ProductCard({ product, onAddToCart }) {
  const { product_name, thumbnail_url, price, discount_percentage } = product

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 ...">
      <img src={thumbnail_url} alt={product_name} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h3 className="font-medium text-gray-900 line-clamp-2">{product_name}</h3>
        <span className="text-lg font-bold text-blue-600">{formatPrice(price)}</span>
      </div>
    </div>
  )
}
```

### 5.2. Container-like page section

Logic stays in page; component receives processed props:

```jsx
// HomePage.jsx — state + hooks
const { data, isLoading } = useProductsV2(filters)

// Render
{data?.products?.map(p => <ProductCard key={p.product_id} product={p} />)}
```

### 5.3. Route guard component

```jsx
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useSelector(state => state.auth)
  const hasToken = Boolean(localStorage.getItem("token"))

  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />
  }
  return children
}
```

### 5.4. Dialog/Modal pattern

```jsx
export default function EditShippingAddressDialog({ order, open, onClose, onSuccess }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        {/* form content */}
      </div>
    </div>
  )
}
```

---

## 6. Page Patterns

### 6.1. Standard page structure

```jsx
export default function ExamplePage() {
  // 1. Hooks (router, auth, data)
  const navigate = useNavigate()
  const { isAuthenticated } = useSelector(state => state.auth)
  const { data, isLoading, error } = useSomeData()

  // 2. Local state
  const [filters, setFilters] = useState({})

  // 3. Effects
  useEffect(() => { ... }, [])

  // 4. Handlers
  const handleSubmit = async () => { ... }

  // 5. Early returns (loading, error)
  if (isLoading) return <LoadingSpinner size="lg" />
  if (error) return <div className="text-red-600">Lỗi tải dữ liệu</div>

  // 6. Render
  return (
    <div className="container mx-auto px-4 py-8">
      {/* content */}
    </div>
  )
}
```

### 6.2. Auth page pattern

```jsx
<div className="min-h-screen flex items-center justify-center bg-gray-50">
  <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
    <h1 className="text-2xl font-bold text-center mb-6">Đăng nhập</h1>
    {error && <div className="bg-red-50 ... mb-4">{error}</div>}
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* fields */}
    </form>
  </div>
</div>
```

### 6.3. Admin page pattern

```jsx
export default function AdminExamplePage() {
  const { data, isLoading } = useAdminData()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quản lý ...</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg ...">
          Thêm mới
        </button>
      </div>
      {/* table or form */}
    </div>
  )
}
```

---

## 7. Hooks Conventions

### 7.1. Data fetching hook

```javascript
export function useProductDetail(id) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`)
      return data
    },
    enabled: !!id,
  })
}
```

### 7.2. Mutation hook

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

### 7.3. Debounced effect hook (non-React Query)

```javascript
export function useShippingQuote({ province_id, ward_id, subtotal }) {
  const [quote, setQuote] = useState(null)

  useEffect(() => {
    if (!province_id || !ward_id) return
    const timer = setTimeout(async () => {
      const { data } = await api.get("/quote", { params: { province_id, ward_id, subtotal } })
      setQuote(data)
    }, 300)
    return () => clearTimeout(timer)
  }, [province_id, ward_id, subtotal])

  return quote
}
```

### 7.4. Rules

| Rule | Mô tả |
|------|-------|
| One hook file per domain | `useProducts.js`, `useOrders.js` |
| Export named functions | `export function useX()` not default |
| No hooks inside utils/ | Hooks only in `hooks/` |
| User-scoped query keys | Include `user?.user_id` for personal data |
| Don't fetch in components | Wrap in hook, call hook in page/component |

---

## 8. State Management

### 8.1. Decision tree

```
Need server data?     → React Query hook
Need auth/session?    → Redux authSlice + localStorage
Need cart mirror?     → Redux cartSlice (synced from API)
Need compare list?    → Redux compareSlice
Need UI toggle?       → Redux uiSlice or local useState
Need form input?      → local useState
Need URL state?       → useSearchParams / useParams
```

### 8.2. Redux slice pattern

```javascript
// store/slices/exampleSlice.js
import { createSlice } from "@reduxjs/toolkit"

const initialState = { items: [], loading: false }

const exampleSlice = createSlice({
  name: "example",
  initialState,
  reducers: {
    setItems: (state, action) => { state.items = action.payload },
    clearItems: (state) => { state.items = [] },
  },
})

export const { setItems, clearItems } = exampleSlice.actions
export default exampleSlice.reducer
```

### 8.3. Không dùng createAsyncThunk

Server async operations → React Query mutations, không RTK async thunks.

---

## 9. Form Conventions

### 9.1. No form library

Không dùng react-hook-form, formik, zod. Pattern:

```javascript
const [formData, setFormData] = useState({ email: "", password: "" })
const [errors, setErrors] = useState({})
const [loading, setLoading] = useState(false)

const handleChange = (e) => {
  setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
}

const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)
  try {
    await mutation.mutateAsync(formData)
  } catch (err) {
    setErrors({ general: err.response?.data?.message })
  } finally {
    setLoading(false)
  }
}
```

### 9.2. Input binding

```jsx
<input
  name="email"
  type="email"
  value={formData.email}
  onChange={handleChange}
  required
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
{errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
```

### 9.3. Client validation

```javascript
// RegisterPage — before API call
if (password.length < 6) {
  setErrors({ password: "Mật khẩu phải có ít nhất 6 ký tự" })
  return
}
if (password !== confirmPassword) {
  setErrors({ confirmPassword: "Mật khẩu không khớp" })
  return
}
```

### 9.4. Server validation mapping

```javascript
// express-validator errors array
if (error.response?.data?.errors) {
  const mapped = {}
  error.response.data.errors.forEach(e => { mapped[e.path] = e.msg })
  setErrors(mapped)
}
```

---

## 10. Styling Conventions

Chi tiết: [`design-system.md`](./design-system.md).

| Rule | Convention |
|------|------------|
| Primary approach | Tailwind utility classes inline |
| Component classes | `.btn-primary`, `.input-field` (defined, migrate to these) |
| Conditional classes | `cn()` from `utils/cn.js` (recommended, not yet used) |
| No CSS modules | ❌ |
| No styled-components | ❌ |
| Responsive | Mobile-first (`sm:`, `md:`, `lg:` prefixes) |
| Icons | lucide-react, size `w-5 h-5` |

---

## 11. Routing Conventions

### 11.1. Route definition (App.jsx only)

Tất cả routes định nghĩa tập trung trong `App.jsx` — không lazy load hiện tại.

### 11.2. Navigation

```javascript
// Programmatic
const navigate = useNavigate()
navigate("/checkout", { state: { mode: "buy_now", items: [...] } })

// Link
<Link to={`/products/${product.slug || product.product_id}`}>Xem chi tiết</Link>
```

### 11.3. URL params

```javascript
const { id } = useParams()           // /products/:id
const [searchParams] = useSearchParams()
const search = searchParams.get("search")
```

### 11.4. Route param fallback

```javascript
// Product detail accepts slug OR numeric id
const { id } = useParams()
useProductDetail(id)  // backend handles both
```

---

## 12. Error & Loading States

### 12.1. Loading

```jsx
// Full page
if (isLoading) return <LoadingSpinner size="lg" />

// Inline button
<button disabled={mutation.isPending}>
  {mutation.isPending ? "Đang xử lý..." : "Đặt hàng"}
</button>
```

### 12.2. Error

```jsx
// Page level
if (error) return (
  <div className="text-center py-12">
    <p className="text-red-600">{error.message || "Có lỗi xảy ra"}</p>
    <button onClick={() => refetch()} className="mt-4 text-blue-600">Thử lại</button>
  </div>
)

// Form level
{errors.general && (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
    {errors.general}
  </div>
)}
```

### 12.3. Empty state

```jsx
{items.length === 0 && (
  <div className="text-center py-12 text-gray-500">
    <p>Chưa có sản phẩm nào</p>
  </div>
)}
```

---

## 13. Locale & Formatting

| Utility | File | Output |
|---------|------|--------|
| `formatPrice(n)` | `utils/formatters.js` | `15.000.000 ₫` |
| `formatDate(d)` | `utils/formatters.js` | `26 tháng 5, 2026` |
| `formatDateTime(d)` | `utils/formatters.js` | `26 tháng 5, 2026, 14:30` |

**Locale:** `vi-VN` — luôn dùng utilities thay vì format thủ công.

**UI copy:** Tiếng Việt cho user-facing text. Error messages từ API có thể English — wrap với fallback Vietnamese.

---

## 14. Anti-patterns

| Anti-pattern | Thay bằng |
|--------------|-----------|
| `"use client"` directive | Xóa (không phải Next.js) |
| Fetch trong useEffect ở page | Custom hook + React Query |
| Direct axios trong component | Hook hoặc api.js group |
| Inline API URL strings everywhere | Centralize in api.js / hooks |
| Prop drilling > 3 levels | Context hoặc Redux |
| Duplicate filter logic | Shared hook |
| Hardcoded prices without formatPrice | `formatPrice()` |
| Admin logic in public components | Separate admin pages |
| Emoji icons in admin sidebar | lucide-react icons |
| Global mutable variables | Redux or React state |

---

*Phản ánh conventions thực tế trong `client/app/` và hướng dẫn cho code frontend mới.*
